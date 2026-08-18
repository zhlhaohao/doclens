"""工具白名单（PLANIFY_ENABLED_TOOLS）测试。

回归背景：白名单示例/旧配置只列了 ask_user,user_confirm，GUI 模式下
ask_user_question 被过滤 → 模型要求结构化提问时无工具可用、静默卡死。
修复：gui_mode 下强制保留 ask_user_question。
"""
import pytest

from planify.tools.registry import build_tool_registry


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("PLANIFY_ENABLED_TOOLS", raising=False)


def _build(tmp_path, gui_mode: bool, whitelist: str, monkeypatch):
    monkeypatch.setenv("PLANIFY_ENABLED_TOOLS", whitelist)
    tools, _ = build_tool_registry(workdir=tmp_path, gui_mode=gui_mode)
    return {t["name"] for t in tools}


class TestToolWhitelist:
    def test_gui_mode_force_keeps_ask_user_question(self, tmp_path, monkeypatch):
        """白名单不含 ask_user_question 时，GUI 模式仍保留（强制兜底）。"""
        names = _build(tmp_path, gui_mode=True, whitelist="bash,read_file", monkeypatch=monkeypatch)
        assert "ask_user_question" in names
        assert "bash" in names
        assert "read_document" not in names  # 其他工具仍按白名单过滤

    def test_tui_mode_whitelist_filters_ask_user_question(self, tmp_path, monkeypatch):
        """非 GUI 模式不兜底：白名单不含即过滤。"""
        names = _build(tmp_path, gui_mode=False, whitelist="bash,read_file", monkeypatch=monkeypatch)
        assert "ask_user_question" not in names

    def test_no_whitelist_registers_all(self, tmp_path, monkeypatch):
        """未设置白名单：GUI 模式注册 ask_user_question。"""
        monkeypatch.delenv("PLANIFY_ENABLED_TOOLS", raising=False)
        tools, _ = build_tool_registry(workdir=tmp_path, gui_mode=True)
        names = {t["name"] for t in tools}
        assert "ask_user_question" in names
        assert "read_document" not in names  # 外部工具由主应用另行注册
        assert "bash" in names
