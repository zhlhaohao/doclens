"""TeammateManager 单元测试（无真实 LLM，FakeProvider 脚本化驱动）

覆盖关键路径：
- 编程任务全流程：spawn → write_file（干活）→ idle（转空闲）→ idle_timeout 自动 shutdown
- 状态机：config.json 中 working → idle → shutdown
- 消息唤醒：idle 队友在 poll_interval 内收到 inbox 消息恢复 working
- 自动认领 (s11)：idle 队友扫 .tasks/ 自动 claim 无主无阻塞任务
- 认领过滤：blockedBy 非空 / 有 owner 的任务不被自动认领
- spawn 幂等：同名 idle 队友重激活；working 时拒绝
- shutdown()：经 MessageBus 发 shutdown_request，线程退出
- LLM 异常即 shutdown（teammate_manager.py:321-323）
"""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path

import pytest

from planify.core.llm.types import LLMResponse, TextBlock, ToolUseBlock
from planify.managers.task_manager import TaskManager
from planify.managers.teammate_manager import TeammateManager
from planify.messaging.message_bus import MessageBus


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------

class FakeProvider:
    """脚本化 LLMProvider：每次 chat() 弹出预排响应。

    responses 元素: LLMResponse 或 Exception（注入失败）。
    耗尽后返回 end_turn（防止测试意外死循环）。
    """

    def __init__(self, responses: list):
        self.responses = list(responses)
        self.calls = 0
        self.seen_messages: list[list[dict]] = []  # 每次调用时的消息快照

    def chat(self, messages, system, tools, max_tokens=8000, **kw):
        self.calls += 1
        # 守卫回归契约：provider 收到的 messages 必须整体可 JSON 序列化。
        # 真实 SDK 会 json.dumps(messages)——teammate loop 曾把 ToolUseBlock
        # dataclass 直接 append 进 assistant 消息，第 2 轮请求在 SDK 序列化时
        # 炸 TypeError，被裸 except 吞掉表现为"队友无声死亡"（已修复，
        # teammate_manager.py assistant_blocks 归一化）。FakeProvider 在此
        # 模拟同一条序列化路径，防回归。
        json.dumps(messages, ensure_ascii=False)
        # 快照浅拷贝即可：teammate loop 每次 append 后才调 chat
        self.seen_messages.append([dict(m) for m in messages])
        if self.responses:
            r = self.responses.pop(0)
            if isinstance(r, Exception):
                raise r
            return r
        return LLMResponse(
            content=[TextBlock(type="text", text="done")], stop_reason="end_turn",
            model="fake", usage=dict(_NO_USAGE),
        )

    # Protocol 其余成员不被 teammate loop 使用，无需实现


_NO_USAGE = {"input_tokens": 0, "output_tokens": 0}


def tool_use_resp(name: str, input: dict, idx: int = 0) -> LLMResponse:
    return LLMResponse(
        content=[ToolUseBlock(id=f"tu_{name}_{idx}", name=name, input=input)],
        stop_reason="tool_use",
        model="fake",
        usage=dict(_NO_USAGE),
    )


def end_resp(text: str = "done") -> LLMResponse:
    return LLMResponse(
        content=[TextBlock(type="text", text=text)], stop_reason="end_turn",
        model="fake", usage=dict(_NO_USAGE),
    )


class ToolRecorder:
    """记录四类基础工具调用，write_file 真写盘（编程任务要落地产物）。"""

    def __init__(self, workdir: Path):
        self.workdir = workdir
        self.calls: list[tuple] = []

    def bash(self, command, workdir):
        self.calls.append(("bash", command))
        return "ok"

    def read(self, path, workdir, offset=None, limit=None):
        self.calls.append(("read_file", path))
        p = Path(path) if Path(path).is_absolute() else self.workdir / path
        if not p.exists():
            return f"Error: not found: {path}"
        return p.read_text(encoding="utf-8")

    def write(self, path, content, workdir):
        self.calls.append(("write_file", path))
        p = Path(path) if Path(path).is_absolute() else self.workdir / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Wrote {len(content)} chars to {path}"

    def edit(self, path, old_text, new_text, workdir, offset=None, replace_all=False):
        self.calls.append(("edit_file", path))
        p = Path(path) if Path(path).is_absolute() else self.workdir / path
        text = p.read_text(encoding="utf-8")
        assert text.count(old_text) == 1, "old_text must be unique (对齐生产语义)"
        p.write_text(text.replace(old_text, new_text), encoding="utf-8")
        return "Edited"


@pytest.fixture()
def env(tmp_path: Path):
    """组装一套可运行的 TeammateManager 依赖。"""
    bus = MessageBus(tmp_path / "inbox")
    task_mgr = TaskManager(tmp_path / "tasks")
    tools = ToolRecorder(tmp_path)
    holder = {}  # provider 由单个测试注入

    def make(provider_responses: list) -> tuple[TeammateManager, FakeProvider]:
        provider = FakeProvider(provider_responses)
        team = TeammateManager(
            bus=bus,
            task_mgr=task_mgr,
            team_dir=tmp_path / "team",
            workdir=tmp_path,
            model="fake-model",
            client=provider,
            poll_interval=1,
            idle_timeout=2,
            run_bash=tools.bash,
            run_read=tools.read,
            run_write=tools.write,
            run_edit=tools.edit,
        )
        holder["provider"] = provider
        return team, provider

    return type("Env", (), {
        "bus": bus, "tasks": task_mgr, "tools": tools,
        "tmp": tmp_path, "make": staticmethod(make),
    })()


def wait_until(cond, timeout: float = 10.0, interval: float = 0.05) -> bool:
    """轮询等待条件成立（teammate 跑在 daemon 线程，断言前需等状态落盘）。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if cond():
            return True
        time.sleep(interval)
    return cond()


def member_status(team: TeammateManager, name: str) -> str | None:
    m = team._find(name)
    return m["status"] if m else None


def join_thread(team: TeammateManager, name: str, timeout: float = 10.0) -> None:
    with team._threads_lock:
        t = team.threads.get(name)
    if t and t.is_alive():
        t.join(timeout=timeout)


# ---------------------------------------------------------------------------
# 编程任务全流程（用户要求的「用编程任务来测试」）
# ---------------------------------------------------------------------------

class TestProgrammingTaskLifecycle:
    def test_spawn_write_file_then_idle_then_auto_shutdown(self, env):
        """编程任务：spawn 队友写一个 hello.py → 调 idle 转空闲 → 空闲超时自动关闭。

        脚本：第 1 轮 write_file（干活），第 2 轮 idle（进 IDLE），
        之后无人派活，idle_timeout=2s 后线程退出、status=shutdown。
        """
        team, provider = env.make([
            tool_use_resp("write_file", {"path": "hello.py", "content": "print('hi')\n"}),
            tool_use_resp("idle", {}),
        ])

        assert team.spawn("coder1", "coder", "写 hello.py") == "Spawned 'coder1' (role: coder)"
        assert member_status(team, "coder1") == "working"

        # 文件确实被队友线程写出
        assert wait_until(lambda: (env.tmp / "hello.py").exists()), "队友未写出 hello.py"
        assert (env.tmp / "hello.py").read_text(encoding="utf-8") == "print('hi')\n"

        # write_file 工具被真实路由（经 ToolRecorder）
        assert env.tools.calls and env.tools.calls[0][0] == "write_file"

        # idle 后转空闲
        assert wait_until(lambda: member_status(team, "coder1") == "idle"), "未转 idle"
        join_thread(team, "coder1")
        assert member_status(team, "coder1") == "shutdown"
        assert provider.calls == 2

    def test_edit_file_roundtrip(self, env):
        """编程任务第二式：spawn 后用 edit_file 修改既有文件（唯一性校验语义）。"""
        (env.tmp / "calc.py").write_text("def add(a, b):\n    return a + b\n", encoding="utf-8")
        team, _ = env.make([
            tool_use_resp("edit_file", {
                "path": "calc.py",
                "old_text": "return a + b",
                "new_text": "return a + b + 0",
            }),
            tool_use_resp("idle", {}),
        ])
        team.spawn("coder2", "coder", "改 calc.py")

        assert wait_until(
            lambda: "return a + b + 0" in (env.tmp / "calc.py").read_text(encoding="utf-8")
        ), "edit_file 未生效"
        join_thread(team, "coder2")

    def test_bash_available_in_tool_dispatch(self, env):
        """编程任务可跑 bash（如 pytest/构建命令），走 run_bash 通道。"""
        team, _ = env.make([
            tool_use_resp("bash", {"command": "echo build"}),
            tool_use_resp("idle", {}),
        ])
        team.spawn("builder", "builder", "跑构建")
        assert wait_until(lambda: ("bash", "echo build") in env.tools.calls)
        join_thread(team, "builder")


# ---------------------------------------------------------------------------
# 状态机与消息
# ---------------------------------------------------------------------------

class TestStateMachine:
    def test_spawn_same_name_while_working_rejected(self, env):
        team, _ = env.make([tool_use_resp("idle", {})])
        team.spawn("alice", "coder", "干活")
        assert wait_until(lambda: member_status(team, "alice") == "idle")
        # idle 后同名 spawn = 重激活
        resp = team.spawn("alice", "reviewer", "新任务")
        assert resp == "Spawned 'alice' (role: reviewer)"
        # working 中再 spawn 报错（本轮脚本耗尽 → FakeProvider 返回 end_turn → 退出 work 循环）
        assert "Error" in team.spawn("alice", "coder", "重复 spawn")
        join_thread(team, "alice")

    def test_inbox_message_revives_idle_teammate(self, env):
        """idle 队友收到 inbox 消息后恢复 working 并看到消息内容。"""
        team, provider = env.make([
            tool_use_resp("idle", {}),                      # 第一段工作：直接 idle
            tool_use_resp("write_file", {"path": "revived.txt", "content": "back"}),  # 唤醒后干活
            end_resp(),
        ])
        team.spawn("bob", "coder", "先待命")
        assert wait_until(lambda: member_status(team, "bob") == "idle")

        env.bus.send("lead", "bob", "写 revived.txt")
        assert wait_until(
            lambda: (env.tmp / "revived.txt").exists()
        ), "idle 队友未被消息唤醒"

        # 唤醒后消息以 user 身份进入对话
        msgs = provider.seen_messages[-1]
        joined = json.dumps(msgs, ensure_ascii=False)
        assert "写 revived.txt" in joined
        join_thread(team, "bob")
        assert provider.calls >= 2


# ---------------------------------------------------------------------------
# 自动认领 (s11)
# ---------------------------------------------------------------------------

class TestAutoClaim:
    def test_idle_teammate_auto_claims_unclaimed_task(self, env):
        """idle 队友自动认领 pending/无 owner/无阻塞任务，并注入 <auto-claimed>。"""
        team, provider = env.make([
            tool_use_resp("idle", {}),
            tool_use_resp("bash", {"command": "echo work"}),
            end_resp(),
        ])
        team.spawn("carol", "coder", "待命")
        assert wait_until(lambda: member_status(team, "carol") == "idle")

        env.tasks.create("修一个 bug", "修复 tests 失败")
        assert wait_until(lambda: _task_owner(env, 1) == "carol"), "未自动认领"

        # 认领消息进入对话（身份重注入 + auto-claimed 标签）
        joined = json.dumps(provider.seen_messages, ensure_ascii=False)
        assert "<auto-claimed>Task #1: 修一个 bug" in joined
        join_thread(team, "carol")

    def test_blocked_or_owned_task_not_claimed(self, env):
        """blockedBy 非空 / 已有 owner 的任务不会被自动认领 → 空闲超时自动关闭。"""
        team, provider = env.make([tool_use_resp("idle", {})])
        team.spawn("dave", "coder", "待命")
        assert wait_until(lambda: member_status(team, "dave") == "idle")

        env.tasks.create("阻塞任务", "有前置依赖")
        env.tasks.update(1, add_blocked_by=[99])  # 永远被 99 阻塞
        env.tasks.create("有主任务", "已被认领")
        env.tasks.update(2, status="in_progress")
        # 直接落 owner 字段（update 不暴露 owner 参数）
        _set_task_owner(env, 2, "someone")

        join_thread(team, "dave")  # idle_timeout=2s 内无活可领 → 自动 shutdown
        assert member_status(team, "dave") == "shutdown"
        assert _task_owner(env, 1) is None
        assert _task_owner(env, 2) == "someone"


# ---------------------------------------------------------------------------
# 关闭与容错
# ---------------------------------------------------------------------------

class TestShutdownAndErrors:
    def test_explicit_shutdown_sets_status(self, env):
        team, _ = env.make([tool_use_resp("idle", {})])
        team.spawn("eve", "coder", "待命")
        assert wait_until(lambda: member_status(team, "eve") == "idle")

        assert team.shutdown("eve") == "Shutdown 'eve'"
        assert wait_until(lambda: member_status(team, "eve") == "shutdown")

    def test_llm_exception_marks_shutdown(self, env):
        """LLM 调用抛异常 → 立即 shutdown（teammate_manager.py:321-323 契约）。"""
        team, provider = env.make([RuntimeError("provider down")])
        team.spawn("frank", "coder", "必败任务")
        join_thread(team, "frank")
        assert member_status(team, "frank") == "shutdown"
        assert provider.calls == 1

    def test_no_teammates_listing(self, env):
        team, _ = env.make([])
        assert team.list_all() == "No teammates."


def _task_owner(env, tid: int):
    p = env.tmp / "tasks" / f"task_{tid}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8")).get("owner")


def _set_task_owner(env, tid: int, owner: str):
    p = env.tmp / "tasks" / f"task_{tid}.json"
    t = json.loads(p.read_text(encoding="utf-8"))
    t["owner"] = owner
    p.write_text(json.dumps(t, indent=2), encoding="utf-8")
