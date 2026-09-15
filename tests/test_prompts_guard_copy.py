"""build_system_prompt 的 Working Directory Guard 段——按门禁三态配置动态渲染。

脚本内容级外部访问由提示词层承担模型自审职责（工具层只查直接工具调用），
prompt 必须与 guard.get_guard_mode() 同源：ask=事前询问 / allow=事后说明 /
block=禁止绕过。宿主中性（模块边界规则 5：不得出现宿主名）。
"""

import pytest

from planify.prompts import build_system_prompt
from planify.tools.guard import GUARD_ENV


def _guard_section(monkeypatch, mode):
    if mode is None:
        monkeypatch.delenv(GUARD_ENV, raising=False)
    else:
        monkeypatch.setenv(GUARD_ENV, mode)
    prompt = build_system_prompt(".")
    start = prompt.index("# Working Directory Guard")
    return prompt[start:]


class TestGuardRulesByMode:
    def test_default_unsupported_falls_back_to_ask(self, monkeypatch):
        for mode in (None, "ask", "bogus"):
            section = _guard_section(monkeypatch, mode)
            assert "需用户确认（ask）" in section
            assert "ask_user_question" in section
            assert "安全违规" in section

    def test_allow_no_prerisk_no_ask(self, monkeypatch):
        section = _guard_section(monkeypatch, "allow")
        assert "直接放行（allow）" in section
        assert "无需事前询问" in section
        # 用户已选免打扰——提示词不得把询问加回来
        assert "ask_user_question" not in section
        assert "事后透明" in section

    def test_block_hard_deny_no_ask(self, monkeypatch):
        section = _guard_section(monkeypatch, "block")
        assert "一律拦截（block）" in section
        assert "不要执行" in section
        # 对话授权无法豁免硬策略——不该引导询问
        assert "ask_user_question 请求例外" in section

    def test_common_self_audit_all_modes(self, monkeypatch):
        for mode in ("ask", "allow", "block"):
            section = _guard_section(monkeypatch, mode)
            assert "脚本内容由你自审" in section
            assert "不会被自动拦截" in section

    def test_host_neutral_no_doclens_wording(self, monkeypatch):
        for mode in ("ask", "allow", "block"):
            assert "doclens" not in _guard_section(monkeypatch, mode).lower()
