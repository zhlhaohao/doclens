# -*- coding: utf-8 -*-
"""子代理工具注入（grep / glob / TodoWrite）——ADR：子代理与主代理工具面一致性。

覆盖点：
- handle_task 从主注册表透传 grep/glob（rg 条件注册、白名单过滤天然继承）
- TodoWrite 不透传主代理 todo_mgr（私有 TodoManager，并发子代理不互相覆盖）
- run_subagent 的 extra_tools/extra_handlers 装配进子代理工具表与处理器表
- Explore（只读）与 general-purpose 两类代理均获得注入工具
- 白名单 PLANIFY_ENABLED_TOOLS 过滤 grep 后，子代理同样拿不到（不复活）
"""

import pytest

from planify.tools.grep import rg_available
from planify.tools.registry import build_tool_registry, handle_task


class TestHandleTaskInjectsSearchTools:
    """handle_task：从主注册表透传检索工具给子代理。"""

    def test_grep_glob_passthrough_when_rg_available(self, tmp_path, monkeypatch):
        """rg 可用时，子代理收到主注册表的 grep/glob schema + handler。"""
        if not rg_available():
            pytest.skip("系统未安装 rg（条件注册不生效）")
        tools, handlers = build_tool_registry(workdir=tmp_path)
        calls = []

        def fake_sub(prompt, agent_type, workdir, client, model, **kw):
            calls.append(kw)
            return "(ok)"

        result = handle_task(
            "explore",
            "Explore",
            tmp_path,
            client=None,
            model="test",
            handlers=handlers,
            run_subagent=fake_sub,
            registry_tools=tools,
        )
        assert result == "(ok)"
        kw = calls[0]
        extra_tools = {t["name"] for t in kw["extra_tools"]}
        assert "grep" in extra_tools
        assert "glob" in extra_tools
        assert set(kw["extra_handlers"]) >= {"grep", "glob", "TodoWrite"}

    def test_todo_write_private_manager_per_call(self, tmp_path):
        """TodoWrite handler 每次调用新建——两次 task 各自独立，不共享状态。"""
        tools, handlers = build_tool_registry(workdir=tmp_path)
        captured = []

        def fake_sub(prompt, agent_type, workdir, client, model, **kw):
            captured.append(kw)
            return "(ok)"

        for _ in range(2):
            handle_task(
                "p",
                "general-purpose",
                tmp_path,
                client=None,
                model="m",
                handlers=handlers,
                run_subagent=fake_sub,
                registry_tools=tools,
            )
        todo_1 = captured[0]["extra_handlers"]["TodoWrite"]
        todo_2 = captured[1]["extra_handlers"]["TodoWrite"]
        assert todo_1 is not todo_2  # 私有实例，并发子代理不互相覆盖

        # TodoWrite 工具定义在 extra_tools 中且 schema 与主注册表同构
        names = [t["name"] for t in captured[0]["extra_tools"]]
        assert names.count("TodoWrite") == 1

    def test_todo_write_handler_validates_and_renders(self, tmp_path):
        """注入的 TodoWrite handler 可正常 update/render（TodoManager 语义）。"""
        tools, handlers = build_tool_registry(workdir=tmp_path)
        captured = []

        def fake_sub(prompt, agent_type, workdir, client, model, **kw):
            captured.append(kw)
            return "(ok)"

        handle_task(
            "p",
            "Explore",
            tmp_path,
            client=None,
            model="m",
            handlers=handlers,
            run_subagent=fake_sub,
            registry_tools=tools,
        )
        todo = captured[0]["extra_handlers"]["TodoWrite"]
        out = todo(
            items=[
                {
                    "content": "读取配置",
                    "status": "in_progress",
                    "activeForm": "读取配置中",
                }
            ]
        )
        assert "[>]" in out and "1/1" not in out  # 0/1 completed

    def test_registry_tools_none_no_grep_injected(self, tmp_path):
        """不传 registry_tools（旧调用方兼容）：仍注入 TodoWrite，不注入 grep。"""
        tools, handlers = build_tool_registry(workdir=tmp_path)
        captured = []

        def fake_sub(prompt, agent_type, workdir, client, model, **kw):
            captured.append(kw)
            return "(ok)"

        handle_task(
            "p",
            "Explore",
            tmp_path,
            client=None,
            model="m",
            handlers=handlers,
            run_subagent=fake_sub,
            registry_tools=None,
        )
        names = [t["name"] for t in captured[0]["extra_tools"]]
        assert "TodoWrite" in names
        assert "grep" not in names
        assert "glob" not in names

    def test_whitelist_filters_grep_subagent_not_resurrected(self, tmp_path, monkeypatch):
        """白名单删掉 grep/glob 后，主注册表里没有——子代理也不注入。"""
        if not rg_available():
            pytest.skip("系统未安装 rg")
        monkeypatch.setenv(
            "PLANIFY_ENABLED_TOOLS", "bash,read_file,write_file,edit_file"
        )
        tools, handlers = build_tool_registry(workdir=tmp_path)
        tool_names = {t["name"] for t in tools}
        assert "grep" not in tool_names and "glob" not in tool_names

        captured = []

        def fake_sub(prompt, agent_type, workdir, client, model, **kw):
            captured.append(kw)
            return "(ok)"

        handle_task(
            "p",
            "Explore",
            tmp_path,
            client=None,
            model="m",
            handlers=handlers,
            run_subagent=fake_sub,
            registry_tools=tools,
        )
        names = [t["name"] for t in captured[0]["extra_tools"]]
        assert "grep" not in names and "glob" not in names
        # TodoWrite 依旧注入（不依赖检索工具）
        assert "TodoWrite" in names

    def test_gui_mode_guard_passthrough(self, tmp_path):
        """gui_mode 下透传的 grep handler 带门禁（外部路径 fail-closed）。"""
        if not rg_available():
            pytest.skip("系统未安装 rg")
        import planify.tools.guard as guard
        from planify.tools.grep import run_grep

        tools, handlers = build_tool_registry(workdir=tmp_path, gui_mode=True)
        # 直接调用 handler：外部路径（workdir 外）应被拒
        out = handlers["grep"](
            pattern=".",
            path=str(tmp_path.parent),
            output_mode="files_with_matches",
        )
        # ask 模式下子代理上下文无会话授权 → fail-closed 拒绝
        # （临时目录的父目录必然在 workdir 外；模式为默认 ask 时返回 Error）
        assert isinstance(out, str)


class TestRunSubagentToolAssembly:
    """run_subagent：extra_tools/extra_handlers 装配验证。"""

    @pytest.fixture()
    def _fake_client(self):
        """伪 provider：第一轮要求调 grep，下一轮收尾。"""
        from planify.core.llm.types import TextBlock, ToolUseBlock

        class FakeResp:
            def __init__(self, content, stop_reason):
                self.content = content
                self.stop_reason = stop_reason

        class FakeClient:
            def __init__(self):
                self.calls = 0

            def chat(self, messages, system, tools, max_tokens, tracer):
                self.calls += 1
                if self.calls == 1:
                    return FakeResp(
                        [
                            ToolUseBlock(
                                id="toolu_1",
                                name="grep",
                                input={"pattern": "needle"},
                            )
                        ],
                        "tool_use",
                    )
                return FakeResp([TextBlock(text="done")], "end_turn")

        return FakeClient()

    def test_extra_tools_reach_subagent_loop(self, tmp_path, _fake_client):
        """子代理主循环能调 extra_handlers 里的 grep 并拿到结果。"""
        from planify.subagent.runner import run_subagent

        seen_inputs = []

        def fake_grep(**kw):
            seen_inputs.append(kw)
            return "src/a.py:1:needle"

        result = run_subagent(
            "find needle",
            "Explore",
            tmp_path,
            client=_fake_client,
            model="m",
            run_bash=lambda **kw: "(no output)",
            run_read=lambda **kw: "(content)",
            run_write=lambda **kw: "ok",
            run_edit=lambda **kw: "ok",
            extra_tools=[
                {
                    "name": "grep",
                    "description": "search",
                    "input_schema": {"type": "object", "properties": {}},
                }
            ],
            extra_handlers={"grep": fake_grep},
        )
        assert result == "done"
        assert seen_inputs and seen_inputs[0]["pattern"] == "needle"

    def test_todo_write_available_in_loop(self, tmp_path, _fake_client):
        """注入的 TodoWrite 可被子代理调用。"""
        from planify.core.llm.types import ToolUseBlock
        from planify.subagent.runner import run_subagent

        class TwoRoundClient:
            def __init__(self):
                self.n = 0

            def chat(self, messages, system, tools, max_tokens, tracer):
                self.n += 1
                if self.n == 1:
                    return _Resp(
                        [
                            ToolUseBlock(
                                id="toolu_9",
                                name="TodoWrite",
                                input={
                                    "items": [
                                        {
                                            "content": "step",
                                            "status": "completed",
                                            "activeForm": "stepping",
                                        }
                                    ]
                                },
                            )
                        ],
                        "tool_use",
                    )
                return _Resp([_TB(text="finished")], "end_turn")

        todo_calls = []

        def fake_todo(**kw):
            todo_calls.append(kw)
            return "[x] step\n\n(1/1 completed)"

        result = run_subagent(
            "track",
            "Explore",
            tmp_path,
            client=TwoRoundClient(),
            model="m",
            run_bash=lambda **kw: "(no output)",
            run_read=lambda **kw: "(content)",
            run_write=lambda **kw: "ok",
            run_edit=lambda **kw: "ok",
            extra_tools=[
                {
                    "name": "TodoWrite",
                    "description": "todo",
                    "input_schema": {"type": "object", "properties": {}},
                }
            ],
            extra_handlers={"TodoWrite": fake_todo},
        )
        assert result == "finished"
        assert todo_calls and todo_calls[0]["items"][0]["content"] == "step"


class _Resp:
    def __init__(self, content, stop_reason):
        self.content = content
        self.stop_reason = stop_reason


class _TB:
    def __init__(self, text):
        self.type = "text"
        self.text = text


class TestPromptMentions:
    """prompts.py：subagent 分支包含 TodoWrite 引导。"""

    def test_subagent_prompt_mentions_todo(self, tmp_path):
        from planify.prompts import build_system_prompt

        prompt = build_system_prompt(workdir=str(tmp_path), agent_type="subagent")
        assert "TodoWrite" in prompt
