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
        with self._lock:
            ev = self._alive.get((scope, name))
            t = self._threads.get((scope, name))
            return bool(ev and not ev.is_set() and t and t.is_alive())

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
                return False
            ev = threading.Event()
            self._alive[key] = ev
            t = threading.Thread(target=self._loop, args=(scope, name, prompt, ev),
                                 name=f"bot-{name}@{scope[:8]}", daemon=True)
            self._threads[key] = t
            t.start()
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
        try:
            while not stop.is_set():
                # ---------- WORK（一轮：消费收件箱 → LLM → 工具，直到非 tool_use 或 idle）
                idle_req = False
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
                            held_task = payload.get("task_id", held_task)
                            held_output_dir = payload.get("output_dir") or held_output_dir
                            # 给 Bot 的任务说明：指令 + 交付物 + 验收 + 输出目录（程序组装，不靠模型猜）
                            msg = {**msg, "content": (
                                f"Assignment task_id={held_task}\n"
                                f"Instructions: {payload.get('instructions', '')}\n"
                                f"Write deliverables under: {held_output_dir}\n"
                                f"Deliverables: {json.dumps(payload.get('deliverables', []), ensure_ascii=False)}\n"
                                f"Acceptance (program checks): {json.dumps(payload.get('acceptance', []), ensure_ascii=False)}\n"
                                f"When done call task_update(status='completed')."
                            )}
                        messages.append({"role": "user", "content": json.dumps(msg, ensure_ascii=False) if msg.get("type") != "assignment" else msg["content"]})
                    if not inbox and (not messages or messages[-1]["role"] == "assistant"):
                        break
                    try:
                        resp = self.provider.chat(messages=messages, system=sys_prompt, tools=to_tool_defs(tool_defs))
                    except Exception:  # noqa: BLE001
                        # LLM 失败 → 线程退出（finally 把持有任务标 failed，§11b）
                        logger.exception("[bot:%s] LLM call failed; thread exits", name)
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
                            out = sc.bus.send(name, b["input"].get("to", "lead"), b["input"].get("content", ""))
                        elif b["name"] == "read_inbox":
                            out = json.dumps(sc.bus.read_inbox(name), ensure_ascii=False)
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
                if stop.is_set():
                    # 主动停止（shutdown_bot / 停止=停全部 / 会话删除）：任务释放回 ready，
                    # 由调度器重派——不是失败
                    self._release_held_task(sc, held_task)
                else:
                    # 线程自然退出（idle 超时 / LLM 异常）：持有 in_progress 任务 → failed（§11b）
                    self._fail_held_task(sc, held_task, name)
            self._persist_session(name, messages)
            with self._lock:
                self._threads.pop((scope, name), None)
                self._alive.pop((scope, name), None)

    # ------------------------------------------------------------ 工具

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

    def _task_update(self, sc, task_id: Optional[int], inp: dict) -> str:
        if task_id is None:
            return "Error: no assignment held; nothing to update"
        t = sc.tasks.get_raw(task_id)
        if not t:
            return f"Error: task #{task_id} not found"
        if inp.get("status") == "completed":
            # 程序验收：标 verifying，调度器线程池跑验收（不阻塞本线程）
            t["status"] = "verifying"
            sc.tasks.save_raw(t)
            dag = self._dag_of(sc, t.get("dag_id"))
            if dag:
                dag["steps"][t["step_id"]]["status"] = "verifying"
                from . import dag as D
                D.write_dag(sc.dags_dir, dag)
            if self.hub.scheduler:
                self.hub.scheduler.wake()
            return json.dumps({"ok": True, "status": "verifying", "note": "Acceptance is running; wait for result."})
        return json.dumps({"ok": False, "error": "only status=completed is handled in spike"})

    def _release_held_task(self, sc, task_id: int) -> None:
        """主动停止时把 in_progress 任务回 ready（调度器重派）。verifying 态不动。"""
        t = sc.tasks.get_raw(task_id)
        if t and t.get("status") == "in_progress":
            t["status"] = "pending"
            sc.tasks.save_raw(t)
            dag = self._dag_of(sc, t.get("dag_id"))
            if dag:
                st = dag["steps"].get(t.get("step_id"))
                if st and st["status"] == "in_progress":
                    st["status"] = "ready"
                    from . import dag as D
                    D.write_dag(sc.dags_dir, dag)
            if self.hub.scheduler:
                self.hub.scheduler.wake()

    def _fail_held_task(self, sc, task_id: int, name: str) -> None:
        t = sc.tasks.get_raw(task_id)
        # 只对 in_progress 动手：verifying 的归属已是调度器（线程池验收中），
        # Bot idle 退出是正常的——不是「线程死亡持有任务」
        if t and t.get("status") == "in_progress":
            t["status"] = "failed"
            t["fail_reason"] = "bot_thread_died"
            sc.tasks.save_raw(t)
            dag = self._dag_of(sc, t.get("dag_id"))
            if dag:
                st = dag["steps"].get(t.get("step_id"))
                if st and st["status"] == "in_progress":
                    st["status"] = "failed"
                    from . import dag as D
                    D.write_dag(sc.dags_dir, dag)
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
