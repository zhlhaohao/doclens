"""知识库根指导文件自动注入测试（agent_prompt.kb_root_guidance）。

行为：{workdir}/CLAUDE.md 优先于 AGENTS.md（第一个命中即全文注入）；
超 32k 字符截断；无文件/空文件/读失败返回空串。
"""

from doclens.agent_prompt import GUIDE_MAX_CHARS, kb_root_guidance


def test_claude_md_injected_full(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("# 指导\n\n项目约定内容", encoding="utf-8")
    out = kb_root_guidance(tmp_path)
    assert out.startswith("# Knowledge base guidance（来自知识库根的 CLAUDE.md")
    assert "项目约定内容" in out


def test_agents_md_fallback_when_no_claude_md(tmp_path):
    (tmp_path / "AGENTS.md").write_text("AGENTS 内容", encoding="utf-8")
    out = kb_root_guidance(tmp_path)
    assert "AGENTS.md" in out and "AGENTS 内容" in out


def test_claude_md_takes_priority(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("来自 CLAUDE", encoding="utf-8")
    (tmp_path / "AGENTS.md").write_text("来自 AGENTS", encoding="utf-8")
    out = kb_root_guidance(tmp_path)
    assert "来自 CLAUDE" in out and "来自 AGENTS" not in out


def test_no_files_returns_empty(tmp_path):
    assert kb_root_guidance(tmp_path) == ""


def test_empty_file_skipped_to_next_candidate(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("   \n", encoding="utf-8")
    (tmp_path / "AGENTS.md").write_text("AGENTS 兜底", encoding="utf-8")
    out = kb_root_guidance(tmp_path)
    assert "AGENTS 兜底" in out


def test_oversized_truncated(tmp_path):
    (tmp_path / "CLAUDE.md").write_text("x" * (GUIDE_MAX_CHARS + 100), encoding="utf-8")
    out = kb_root_guidance(tmp_path)
    assert len(out) < GUIDE_MAX_CHARS + 500  # 头部 + 截断提示可控
    assert "超长已截断" in out
    assert "x" * GUIDE_MAX_CHARS in out
