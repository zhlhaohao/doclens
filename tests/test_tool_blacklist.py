"""工具黑名单（PLANIFY_DISABLED_TOOLS）测试。

背景：白名单需要穷举全部工具名，工具多时维护成本高。黑名单只列要禁用的，
默认全开；与白名单并存时黑名单优先（先留后减）。
"""
import pytest

from planify.tools.registry import build_tool_registry, handle_task


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("PLANIFY_ENABLED_TOOLS", raising=False)
    monkeypatch.delenv("PLANIFY_DISABLED_TOOLS", raising=False)


def _build(tmp_path, **kw):
    tools, handlers = build_tool_registry(workdir=tmp_path, **kw)
    return {t["name"] for t in tools}, handlers


class TestToolBlacklist:
    def test_removes_only_listed_tools(self, tmp_path, monkeypatch):
        """只屏蔽列出的工具，其余保持注册（默认全开）。"""
        monkeypatch.setenv("PLANIFY_DISABLED_TOOLS", "bash,webfetch")
        names, handlers = _build(tmp_path)
        assert "bash" not in names and "webfetch" not in names
        assert "bash" not in handlers and "webfetch" not in handlers
        assert "read_file" in names  # 未列出的照常
        assert "read_file" in handlers

    def test_whitespace_and_empty_items_tolerated(self, tmp_path, monkeypatch):
        monkeypatch.setenv("PLANIFY_DISABLED_TOOLS", " bash , , webfetch ,")
        names, _ = _build(tmp_path)
        assert "bash" not in names and "webfetch" not in names

    def test_unknown_names_ignored_without_crash(self, tmp_path, monkeypatch):
        """未知工具名只告警，不影响其他工具的注册。"""
        monkeypatch.setenv("PLANIFY_DISABLED_TOOLS", "no_such_tool")
        names, handlers = _build(tmp_path)
        assert "bash" in names and "read_file" in names
        assert "no_such_tool" not in handlers

    def test_blacklist_wins_over_whitelist(self, tmp_path, monkeypatch):
        """白名单先留、黑名单再减：两者都点名时以黑名单为准。"""
        monkeypatch.setenv("PLANIFY_ENABLED_TOOLS", "bash,read_file")
        monkeypatch.setenv("PLANIFY_DISABLED_TOOLS", "bash")
        names, handlers = _build(tmp_path)
        assert names == {"read_file"}
        assert "bash" not in handlers

    def test_gui_mode_explicit_disable_of_ask_user_question(self, tmp_path, monkeypatch):
        """黑名单是显式点名，GUI 下不强制保留（白名单漏列才兜底）。"""
        monkeypatch.setenv("PLANIFY_DISABLED_TOOLS", "ask_user_question")
        names, _ = _build(tmp_path, gui_mode=True)
        assert "ask_user_question" not in names

    def test_subagent_inherits_blacklist(self, tmp_path, monkeypatch):
        """黑名单屏蔽的基础工具不得在子代理工具面复活。"""
        monkeypatch.setenv("PLANIFY_DISABLED_TOOLS", "bash,TodoWrite")
        registry_defs, handlers = build_tool_registry(workdir=tmp_path)
        captured = []

        def fake_sub(prompt, agent_type, workdir, client, model, **kw):
            captured.append(kw)
            return "(ok)"

        result = handle_task(
            "explore",
            "Explore",
            tmp_path,
            client=None,
            model="test",
            handlers=handlers,
            run_subagent=fake_sub,
            registry_tools=registry_defs,
        )
        assert result == "(ok)"
        kw = captured[0]
        assert "bash" in set(kw["disabled_tools"])
        assert kw["run_bash"] is None
