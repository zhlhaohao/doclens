"""Bot 线程运行器（ADR-0058 §6/§7/§8 + ADR-0059 §11a/§11b/§11c，spike 版）。

承担「线程是 Bot 的一次上班」：从 BotRegistry 取实体、从 RoleLibrary 取权限包与
persona、注入 memory、按 role 裁剪工具、contextvar 穿透 scope、线程退出时把持有
的未完成任务标 failed。

与旧 ``TeammateManager`` 并存：旧类不动（config.json 路径留给遗留调用），本类
是 DAG 链路唯一使用的 Bot 线程实现。

线程注册表 key = (scope, name)——同一 Bot 名在不同 scope 下是不同线程（但租约
保证同一时刻只有一个 scope 持有它）。
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional, Tuple

from ..core.llm.provider import LLMProvider
from ..core.llm.types import ToolUseBlock
from ..skills.access_state import set_current_session_id
from ..tools.basic import to_tool_defs

logger = logging.getLogger("planify.team.runner")

_MAX_TURNS = 50
#: 模型忘记报完成时的程序兜底提醒次数上限（防死循环）
_MAX_DONE_NAGS = 3


def D_update(sc, dag_id, mutator):
    """原子更新 DAG（read→改→write 加锁）——避免与调度器/验收线程的丢失更新。"""
    from . import dag as _D
    if dag_id is None:
        return None
    return _D.update_dag(sc.dags_dir, int(dag_id), mutator)

#: 通信/任务工具定义由 BotRunner 内置（不依赖宿主传入——宿主 lead 工具表可能
#: 没有它们，且这些工具的 handler 就在本类里，不走宿主 handler）
_BUILTIN_TOOL_DEFS = [
    {"name": "send_message", "description": "Send a message to lead or another Bot.",
     "input_schema": {"type": "object", "properties": {"to": {"type": "string"}, "content": {"type": "string"}},
                      "required": ["to", "content"]}},
    {"name": "read_inbox", "description": "Read and clear your inbox.", "input_schema": {"type": "object", "properties": {}}},
    {"name": "idle", "description": "Signal no more work; enter idle (wait for assignments).",
     "input_schema": {"type": "object", "properties": {}}},
    {"name": "claim_task", "description": "Reserved (DAG assigns tasks; do not claim manually).",
     "input_schema": {"type": "object", "properties": {"task_id": {"type": "integer"}}, "required": ["task_id"]}},
    {"name": "task_update", "description": "Report your held task completed. The program then runs acceptance.",
     "input_schema": {"type": "object", "properties": {"status": {"type": "string", "enum": ["completed"]}},
                      "required": ["status"]}},
    {"name": "load_skill", "description": "Load one of your role's skills (listed in your prompt) for its method.",
     "input_schema": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}},
]


def _bot_tool_defs(host_defs: list) -> list:
    """能力工具（宿主）+ 内置通信/任务工具，按名去重（内置优先）。"""
    out = {t["name"]: t for t in host_defs}
    for t in _BUILTIN_TOOL_DEFS:
        out[t["name"]] = t
    return list(out.values())


class BotRunner:
    def __init__(
        self,
        hub,
        provider: LLMProvider,
        workdir: Path,
        tool_defs: list,
        tool_handlers: Dict[str, Callable[..., str]],
        poll_interval: int = 5,
        idle_timeout: int = 60,
    ):
        self.hub = hub
        self.provider = provider
        self.workdir = Path(workdir)
        self.all_tool_defs = _bot_tool_defs(tool_defs)
        self.all_tool_handlers = tool_handlers
        self.poll_interval = poll_interval
        self.idle_timeout = idle_timeout
        self._threads: Dict[Tuple[str, str], threading.Thread] = {}
        self._alive: Dict[Tuple[str, str], threading.Event] = {}
        self._lock = threading.RLock()
        # 角色 tools 是否**显式**含 write_file（researcher 要写交付物；default 仅靠 FORCED 写记忆）
        self._role_explicit_write: Dict[str, set] = {}

    # ------------------------------------------------------------ 查询

    def is_alive(self, scope: str, name: str) -> bool:
        """线程是否存活。**只看 Event 未 set**——不要求 Thread.is_alive()：线程刚 start
        时 is_alive() 可能还没为 True（Python 线程启动有延迟），会被误判成「线程死了」
        → 调度器重复起线程 → 两个线程抢同一个 task（真机验证踩到）。Event 在线程
        退出（finally）时才 set。"""
        with self._lock:
            ev = self._alive.get((scope, name))
            return bool(ev) and not ev.is_set()

    def shutdown_bot(self, scope: str, name: str) -> None:
        with self._lock:
            ev = self._alive.get((scope, name))
            if ev:
                ev.set()

    # ------------------------------------------------------------ 起线程

    def start(self, scope: str, name: str, prompt: str) -> bool:
        """为 (scope, name) 起线程。线程已活着返回 False（调用方改喂消息）。"""
        key = (scope, name)
        with self._lock:
            if self.is_alive(scope, name):
                logger.info("[bot:%s] start skipped: thread alive", name)
                return False
            ev = threading.Event()
            self._alive[key] = ev
            t = threading.Thread(target=self._loop, args=(scope, name, prompt, ev),
                                 name=f"bot-{name}@{scope[:8]}", daemon=True)
            self._threads[key] = t
            t.start()
            logger.info("[bot:%s] thread started (scope=%s)", name, scope[:8])
            return True

    # ------------------------------------------------------------ 主循环

    def _loop(self, scope: str, name: str, prompt: str, stop: threading.Event) -> None:
        # contextvar 穿透：门禁 / read_inbox / group_plan_status / shell 登记全靠它
        set_current_session_id(scope)
        registry = self.hub.registry
        sc = self.hub.scope(scope)
        bot = registry.get(name)
        if not bot:
            logger.error("[bot:%s] no entity; thread exits", name)
            return
        role = self.hub.roles.get(bot["role"])
        sys_prompt = role.system_prompt(name, self.workdir) + "\n\nMemory:\n" + registry.read_memory(name)

        tool_defs = [t for t in self.all_tool_defs if t["name"] in role.allowed_tools([x["name"] for x in self.all_tool_defs])]
        allowed = {t["name"] for t in tool_defs}
        if "write_file" in role.tools:
            self._role_explicit_write[name] = {"write_file"}

        messages: list = []
        if prompt:
            messages.append({"role": "user", "content": prompt})
        held_task: Optional[int] = None
        held_output_dir: Optional[str] = None
        budget_stopped = False  # 预算超限退出：按主动停止语义（任务回 ready），不是失败
        crashed = False         # LLM 异常退出：任务标 failed（§11b）
        try:
            while not stop.is_set():
                # ---------- WORK（一轮：消费收件箱 → LLM → 工具，直到非 tool_use 或 idle）
                idle_req = False
                task_done_nags = 0
                for _ in range(_MAX_TURNS):
                    # 每轮先消费收件箱；收件箱为空且上一条已是 assistant（模型已说完）才退出 WORK
                    inbox = sc.bus.read_inbox(name)
                    for msg in inbox:
                        if msg.get("type") == "shutdown_request":
                            return
                        if msg.get("type") == "assignment":
                            # MessageBus 把 payload 塞进 content（JSON 字串）——解析出 task_id / output_dir
                            try:
                                payload = json.loads(msg.get("content") or "{}")
                            except json.JSONDecodeError:
                                payload = {}
                            incoming = payload.get("task_id")
                            # 最后一道锁（ADR-0060 §4）：已持有未完成任务时拒绝第二条
                            # assignment——recover_scope 的重投递不经 _pick_assignee，
                            # 两个 active DAG 同轮 recover 可给同一 Bot 双派。被拒的
                            # task + step 一起回 ready（复用 _release_held_task），
                            # 调度器稍后重派；不覆盖 held_task。
                            if self._task_pending(sc, held_task) and incoming != held_task:
                                logger.warning("[bot:%s] busy on task #%s, rejecting assignment task=%s",
                                               name, held_task, incoming)
                                if incoming is not None:
                                    self._release_held_task(sc, int(incoming))
                                continue
                            held_task = incoming if incoming is not None else held_task
                            held_output_dir = payload.get("output_dir") or held_output_dir
                            logger.info("[bot:%s] got assignment task=%s output=%s",
                                        name, held_task, held_output_dir)
                            # 给 Bot 的任务说明：指令 + 交付物 + 验收 + 输出目录（程序组装，不靠模型猜）
                            msg = {**msg, "content": (
                                f"Assignment task_id={held_task}\n"
                                f"Instructions: {payload.get('instructions', '')}\n"
                                f"Write deliverables under: {held_output_dir}\n"
                                f"Deliverables: {json.dumps(payload.get('deliverables', []), ensure_ascii=False)}\n"
                                f"Acceptance (program checks): {json.dumps(payload.get('acceptance', []), ensure_ascii=False)}\n"
                                f"When done call task_update(status='completed')."
                            )}
                        elif msg.get("type") == "fix_required":
                            # 打回恢复（ADR-0060 §3）：Bot 可能在报完成后 idle 退出、由用户
                            # 消息复活成无任务线程——此时 held_task=None，打回消息须把
                            # task / output_dir 装回，否则 Bot 修不了也报不了完成。
                            try:
                                payload = json.loads(msg.get("content") or "{}")
                            except json.JSONDecodeError:
                                payload = {}
                            if held_task is None and payload.get("task_id") is not None:
                                held_task = payload["task_id"]
                                held_output_dir = payload.get("output_dir") or held_output_dir
                                logger.info("[bot:%s] resumed held task #%s from fix_required", name, held_task)
                        elif msg.get("type") == "user_message":
                            # 用户直接消息（ADR-0060 §3）：不是系统通知——用户在观看会话
                            # 并对 Bot 说话，须与 assignment / Bot 间消息区分。
                            text = msg.get("content") or ""
                            messages.append({"role": "user", "content": (
                                f"[用户直接消息] {text}\n"
                                "（用户正在观看你的会话并直接对你说话；这不是系统通知，"
                                "请如实、简短地回答，然后继续手头任务。）"
                            )})
                            continue
                        messages.append({"role": "user", "content": json.dumps(msg, ensure_ascii=False) if msg.get("type") != "assignment" else msg["content"]})
                    if not inbox and (not messages or messages[-1]["role"] == "assistant"):
                        break
                    try:
                        resp = self.provider.chat(messages=messages, system=sys_prompt, tools=to_tool_defs(tool_defs))
                    except Exception:  # noqa: BLE001
                        # LLM 失败 = 崩溃：持有任务标 failed（§11b）。其余退出路径（idle 超时、
                        # 进程退出、主动停止）都不是崩溃——任务回 ready 由调度器重派。
                        logger.exception("[bot:%s] LLM call failed; thread exits", name)
                        crashed = True
                        return
                    # 预算（ADR-0059 §12）：持有任务时给所属 DAG 计数；超限 → 调度器已把 DAG 转
                    # stalled 并发 shutdown_request，本线程按主动停止路径退出（任务回 ready）
                    if held_task is not None and self.hub.scheduler is not None:
                        t = sc.tasks.get_raw(held_task)
                        dag_id = (t or {}).get("dag_id")
                        if dag_id is not None and self.hub.scheduler.bump_llm_calls(scope, int(dag_id)) is not None:
                            logger.warning("[bot:%s] DAG #%s exceeded LLM budget; stopping", name, dag_id)
                            budget_stopped = True
                            return
                    blocks = []
                    for b in resp.content:
                        bt = getattr(b, "type", None) if not isinstance(b, dict) else b.get("type")
                        if bt == "text":
                            blocks.append({"type": "text", "text": getattr(b, "text", "") if not isinstance(b, dict) else b.get("text", "")})
                        elif bt == "tool_use":
                            if isinstance(b, dict):
                                blocks.append({"type": "tool_use", "id": b.get("id"), "name": b.get("name"), "input": dict(b.get("input") or {})})
                            else:
                                blocks.append({"type": "tool_use", "id": b.id, "name": b.name, "input": dict(b.input or {})})
                    messages.append({"role": "assistant", "content": blocks})
                    if resp.stop_reason != "tool_use":
                        # 模型说完就结束了。若它持有未报完成的任务 → 程序兜底提醒它报完成
                        # （模型常忘记走「报完成」协议；Pi Bot 靠 coordinator 催，我们靠程序催）。
                        if held_task is not None and self._task_pending(sc, held_task) and not idle_req:
                            n = task_done_nags + 1
                            if n <= _MAX_DONE_NAGS:
                                task_done_nags = n
                                logger.info("[bot:%s] task #%s not reported done; reminding (round %d)",
                                            name, held_task, n)
                                messages.append({"role": "user", "content": (
                                    "System reminder: you still hold task "
                                    f"#{held_task}. The program only marks it complete when you call "
                                    "task_update(status='completed') — your reply alone does not complete it. "
                                    "Call task_update now (after checking the acceptance items yourself)."
                                )})
                                continue  # 再跑一轮
                        break
                    results = []
                    for b in blocks:
                        if b.get("type") != "tool_use":
                            continue
                        if b["name"] not in allowed:
                            out = f"Error: tool '{b['name']}' is not available to role '{role.id}'"
                        elif b["name"] == "idle":
                            idle_req = True
                            out = "Entering idle phase."
                        elif b["name"] == "task_update":
                            out = self._task_update(sc, held_task, b["input"])
                        elif b["name"] == "send_message":
                            to = b["input"].get("to", "lead")
                            if to == "user":
                                # 用户对 Bot 说话后 Bot 的直接回信走 Bot 会话（§3），
                                # 不进 lead 收件箱——避免污染 lead 上下文。
                                content = b["input"].get("content", "")
                                self._emit_bot_notice(scope, name, "user_reply", content)
                                out = "Delivered to user"
                            else:
                                out = sc.bus.send(name, to, b["input"].get("content", ""))
                        elif b["name"] == "read_inbox":
                            out = json.dumps(sc.bus.read_inbox(name), ensure_ascii=False)
                        elif b["name"] == "load_skill":
                            # 角色技能（planify/roles/<role>/skills/）——不走宿主 doclens 技能目录
                            out = role.load_skill(b["input"].get("name", ""))
                        else:
                            out = self._run_capability(b, scope, name, held_output_dir)
                        results.append({"type": "tool_result", "tool_use_id": b["id"], "content": str(out)})
                    messages.append({"role": "user", "content": results})
                    if idle_req:
                        break

                # ---------- IDLE：轮询收件箱；有新消息回 WORK（复用本线程，不起新线程）
                registry.set_status(name, "idle", scope)
                deadline = time.time() + self.idle_timeout
                resumed = False
                while not stop.is_set() and time.time() < deadline:
                    if sc.bus.list_inboxes().get(name, 0) > 0:
                        resumed = True
                        break
                    time.sleep(self.poll_interval)
                if stop.is_set() or not resumed:
                    return
                registry.set_status(name, "working", scope)
        finally:
            registry.set_status(name, "shutdown", scope)
            if held_task is not None:
                if crashed:
                    # 崩溃（LLM 异常）：持有任务 → failed（§11b）
                    self._fail_held_task(sc, held_task, name)
                else:
                    # 非崩溃退出（主动停止 / 预算刹车 / idle 超时 / 进程退出）：任务回 ready，
                    # 由调度器重派——idle 超时和进程退出都不是 Bot 的失败
                    self._release_held_task(sc, held_task)
            self._persist_session(name, messages)
            with self._lock:
                self._threads.pop((scope, name), None)
                self._alive.pop((scope, name), None)

    # ------------------------------------------------------------ 工具

    def _emit_bot_notice(self, scope: str, name: str, notice_type: str, text: str) -> None:
        """Bot 会话的系统条目（ADR-0060 §3）——经 sink 落库（无 sink 时只记日志）。

        sink 由宿主在 bootstrap_team 时注入（`set_session_sink`）；Bot 侧只发事件，
        不知道 sessions.db 存在。
        """
        sink = getattr(self, "_session_sink", None)
        if sink is not None:
            try:
                sink(scope, name, {"type": "bot_notice", "notice_type": notice_type, "text": text})
            except Exception:  # noqa: BLE001
                logger.exception("[bot:%s] session sink failed", name)
        else:
            logger.info("[bot:%s] %s: %s", name, notice_type, text[:200])

    def set_session_sink(self, sink) -> None:
        """注入 Bot 会话落库回调（宿主侧 append_item 到 sessions.db）。"""
        self._session_sink = sink

    def _run_capability(self, block: dict, scope: str, bot_name: str, output_dir: Optional[str] = None) -> str:
        # write_file 限路径 memory.md（ADR-0058 §8 / 评审 M2）：不是门禁的事——memory.md
        # 在 workdir 内不触发门禁，限制在本层做。researcher 等角色若 role.tools 显式含
        # write_file 则不受此限（它要写交付物）。
        inp = dict(block["input"])
        if block["name"] == "write_file":
            if "write_file" not in self._role_explicit_write.get(bot_name, set()):
                target = Path(inp.get("path", ""))
                try:
                    resolved = (self.workdir / target).resolve() if not target.is_absolute() else target.resolve()
                except OSError:
                    resolved = target
                allowed_mem = self.hub.registry.memory_path(bot_name).resolve()
                if resolved != allowed_mem:
                    return (f"Error: this role may only write its own memory file "
                            f"({self.hub.registry.memory_path(bot_name)}); use task_update to report.")
            # 交付物相对路径以 DAG output_dir 为基准（ADR-0059 §4c）；无 output_dir 时以 workdir 为基准
            elif output_dir and inp.get("path") and not Path(inp["path"]).is_absolute():
                inp["path"] = str(Path(output_dir) / inp["path"])
        h = self.all_tool_handlers.get(block["name"])
        if not h:
            return f"Error: no handler for '{block['name']}'"
        return str(h(**inp))

    def _task_pending(self, sc, task_id: Optional[int]) -> bool:
        """持有任务是否仍未完成（in_progress / verifying）。"""
        if task_id is None:
            return False
        t = sc.tasks.get_raw(task_id)
        return bool(t) and t.get("status") in ("in_progress", "verifying")

    def _task_update(self, sc, task_id: Optional[int], inp: dict) -> str:
        if task_id is None:
            return "Error: no assignment held; nothing to update"
        t = sc.tasks.get_raw(task_id)
        if not t:
            return f"Error: task #{task_id} not found"
        if t.get("status") not in ("in_progress",):
            # 已完成/验收中/失败的任务不再重标——模型常重复报完成（脚本化调用、
            # 多轮兜底），重标会让已完成的任务回到 verifying 反复验收
            return json.dumps({"ok": True, "status": t.get("status"),
                               "note": "task already reported; ignored duplicate completion"}, ensure_ascii=False)
        if inp.get("status") == "completed":
            # 程序验收：标 verifying，调度器线程池跑验收（不阻塞本线程）
            sc.tasks.update_raw(task_id, status="verifying")
            dag = self._dag_of(sc, t.get("dag_id"))
            if dag:
                step_id = t.get("step_id")
                def _mut(d):
                    st = d["steps"].get(step_id)
                    if st and st["status"] == "in_progress":
                        st["status"] = "verifying"
                D_update(sc, t.get("dag_id"), _mut)
            if self.hub.scheduler:
                self.hub.scheduler.wake()
            return json.dumps({"ok": True, "status": "verifying", "note": "Acceptance is running; wait for result."})
        return json.dumps({"ok": False, "error": "only status=completed is handled in spike"})

    def _release_held_task(self, sc, task_id: int) -> None:
        """非崩溃退出时把 in_progress 任务回 ready（调度器重派）。verifying 态不动——
        验收在调度器线程池里跑，归属不在 Bot；动了会与验收的失败写入竞争（verifying→failed
        被这里的 ready 覆盖）。"""
        t = sc.tasks.get_raw(task_id)
        if t and t.get("status") == "in_progress":
            sc.tasks.update_raw(task_id, status="pending")
            dag_id = t.get("dag_id")
            step_id = t.get("step_id")
            if dag_id is not None:
                def _mut(dag):
                    st = dag["steps"].get(step_id)
                    # 仅当该步骤还在 in_progress 时才回 ready（verifying 归验收线程所有）
                    if st and st["status"] == "in_progress":
                        st["status"] = "ready"
                D_update(sc, dag_id, _mut)
            if self.hub.scheduler:
                self.hub.scheduler.wake()

    def _fail_held_task(self, sc, task_id: int, name: str) -> None:
        t = sc.tasks.get_raw(task_id)
        # 只对 in_progress 动手：verifying 的归属已是调度器（线程池验收中），
        # Bot idle 退出是正常的——不是「线程死亡持有任务」
        if t and t.get("status") == "in_progress":
            sc.tasks.update_raw(task_id, status="failed", fail_reason="bot_thread_died")
            dag_id = t.get("dag_id")
            step_id = t.get("step_id")
            if dag_id is not None:
                def _mut(dag):
                    st = dag["steps"].get(step_id)
                    if st and st["status"] == "in_progress":
                        st["status"] = "failed"
                D_update(sc, dag_id, _mut)
            if self.hub.scheduler:
                self.hub.scheduler.wake()
            logger.warning("[bot:%s] thread died holding task #%s → failed", name, task_id)
        elif t and t.get("status") == "verifying":
            # 持有任务已交验收，Bot 退出不影响；清掉 held 以免 finally 误判
            self.hub.registry.set_status(name, "idle", sc.scope_id)

    def _dag_of(self, sc, dag_id):
        if dag_id is None:
            return None
        from . import dag as D
        return D.read_dag(sc.dags_dir, int(dag_id))

    def _persist_session(self, name: str, messages: list) -> None:
        try:
            d = self.hub.registry.sessions_dir(name)
            (d / f"{int(time.time())}.jsonl").write_text(
                "\n".join(json.dumps(m, ensure_ascii=False) for m in messages), encoding="utf-8")
        except OSError:
            logger.exception("[bot:%s] session persist failed", name)
