# -*- coding: utf-8 -*-
"""GUI 工具表显式降级（2026-11-17 决策 B）回归。

团队协作/协议工具在回合制宿主无生态位（详见 agent_integration.GUI_FILTERED_TOOLS
注释）；本测试锁定两层不变量：
1. 过滤清单本身完整（legacy ask + 团队 5 + 协议 3）；
2. _stage_tools 的过滤逻辑确实按清单执行——用最小桩装配验证工具表/处理器
   双侧同步剔除，防「只滤 tools 不滤 handlers」的半过滤回归。
"""
import pytest

from doclens import agent_integration as ai


class TestGuiFilteredTools:
    def test_filter_set_is_complete(self):
        """清单锁定：新增/删除工具名必须显式改这里（有意决策，非意外漂移）。"""
        assert ai.GUI_FILTERED_TOOLS == frozenset({
            "ask_user", "user_confirm",
            "spawn_teammate", "list_teammates", "send_message",
            "read_inbox", "broadcast",
            "shutdown_request", "plan_approval", "idle",
        })

    def test_stage_tools_filters_definitions_and_handlers(self, monkeypatch, tmp_path):
        """_stage_tools 产出的 tools/handlers 双侧均不含过滤清单成员。"""
        from planify.tools.team_tools import get_team_tools_definitions

        fake_defs = (
            get_team_tools_definitions(["message"])
            + [{"name": n, "input_schema": {}} for n in ("ask_user", "bash", "read_file")]
        )
        fake_handlers = {t["name"]: lambda **kw: "ok" for t in fake_defs}

        captured = {}

        def fake_build_tool_registry(**kwargs):
            captured.update(kwargs)
            return fake_defs, fake_handlers

        monkeypatch.setattr(ai, "build_tool_registry", fake_build_tool_registry)

        agent = ai.CortexAgent.__new__(ai.CortexAgent)
        agent.workdir = tmp_path

        class _Asm:
            todo_mgr = None
            task_mgr = None
            bg_mgr = None
            bus = None
            team = None
            skills = None
            skill_state = None
            run_subagent = None
            config = {}
            client = None
            dirs = {"transcripts": tmp_path}
            max_tokens = 8000
            tools = None
            tool_handlers = None

        asm = _Asm()
        agent._stage_tools(asm)

        names = {t["name"] for t in asm.tools}
        assert names & ai.GUI_FILTERED_TOOLS == set(), "过滤清单成员泄漏进 GUI 工具表"
        assert set(asm.tool_handlers) & ai.GUI_FILTERED_TOOLS == set(), \
            "处理器侧未同步过滤（半过滤 = 工具不可见但调用面残留）"
        # 未被过滤的工具原样保留
        assert {"bash", "read_file"} <= names
