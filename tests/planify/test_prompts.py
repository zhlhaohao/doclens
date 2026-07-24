"""build_system_prompt 当前日期注入测试。

回归测试:AI tab 问"前天是几号"曾幻觉出错误日期(2025-09-17)，
根因是 system prompt 未注入 Current date，LLM 缺乏真实日期信号。
这里固化 Environment 段必须包含今天的 ISO 日期。
"""

from datetime import date

from planify.prompts import SystemPromptBuilder, build_system_prompt


def test_build_system_prompt_includes_today():
    """build_system_prompt 的 Environment 段必须含今天 ISO 日期。"""
    prompt = build_system_prompt(".", "streaming")
    assert f"Current date: {date.today().isoformat()}" in prompt


def test_current_date_present_for_all_agent_types():
    """主代理 / 流式 / 子代理三种类型都应注入当前日期。"""
    today_iso = date.today().isoformat()
    for agent_type in ("agent", "streaming", "subagent"):
        prompt = build_system_prompt(".", agent_type)
        assert f"Current date: {today_iso}" in prompt


def test_prompt_builder_injects_current_date():
    """run_stream 实际走 SystemPromptBuilder.get()，同样应注入日期。"""
    builder = SystemPromptBuilder()
    prompt = builder.get(".", "streaming")
    assert f"Current date: {date.today().isoformat()}" in prompt
