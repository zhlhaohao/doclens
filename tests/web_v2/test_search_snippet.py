"""search.py snippet 合成纯函数测试。

聚焦 PDF snippet 合成（_compose_pdf_snippet / _make_snippet），
不依赖 IndexManager / HTTP，快速验证文本清洗规则：
  - PDF node.text 是纯文本 → 合成 `# {title}` 让卡片渲染成 heading
  - 剥除首行 title 重复（_cut_md_text 从 heading 行切片导致）
  - 剥除 [PAGE N] 内部标记（preview 路径会剥，search 路径原先泄漏）
"""
from doclens.web_v2.api.search import _compose_pdf_snippet, _make_snippet


def test_pdf_snippet_renders_title_as_heading():
    """PDF node.text 是纯文本，snippet 应以 `# {title}` 开头让卡片渲染成 heading。"""
    text = (
        "1.1 Google 13000x Speedup\n"
        "October 2025: 13000x speedup over classical supercomputers."
    )
    snippet = _compose_pdf_snippet(text, "1.1 Google 13000x Speedup", max_lines=10)
    assert snippet.startswith("# 1.1 Google 13000x Speedup")


def test_pdf_snippet_strips_leading_title_duplicate():
    """node.text 首行重复 title，正文段落里不应再次出现裸 title。"""
    text = "1.1 Google\n正文 classical supercomputers。"
    snippet = _compose_pdf_snippet(text, "1.1 Google", max_lines=10)
    body = snippet.split("\n\n", 1)[1] if "\n\n" in snippet else ""
    assert "1.1 Google" not in body


def test_pdf_snippet_strips_page_marker():
    """[PAGE N] 内部标记不应泄漏到卡片 snippet。"""
    text = "正文 classical。\n\n[PAGE 3]\n\n下一页正文。"
    snippet = _compose_pdf_snippet(text, "某节", max_lines=10)
    assert "[PAGE" not in snippet


def test_pdf_snippet_empty_body_only_heading():
    """正文为空时，snippet 退化为单个 heading。"""
    assert _compose_pdf_snippet("", "标题", max_lines=5) == "# 标题"


def test_pdf_snippet_no_title_returns_body_only():
    """无 title 时不应输出空 `#`。"""
    assert _compose_pdf_snippet("正文内容", "", max_lines=5) == "正文内容"


def test_make_snippet_non_pdf_keeps_raw_text():
    """非 PDF 文件保持裸 text（其本身已含 markdown 语法），不合成 heading。"""
    raw = "## 已有标题\n\n正文"
    assert _make_snippet(raw, "title", "doc.md", max_lines=10) == raw
    assert _make_snippet(raw, "title", "report.docx", max_lines=10) == raw


def test_make_snippet_pdf_composes_heading():
    """PDF 路径触发合成：以 `# title` 开头。"""
    snippet = _make_snippet("正文", "标题", "doc.pdf", max_lines=10)
    assert snippet.startswith("# 标题")


def test_pdf_snippet_truncates_body_to_max_lines():
    """body 行数受 max_lines 控制（heading 不挤占正文配额）。"""
    text = "\n".join(f"行{i}" for i in range(20))
    snippet = _compose_pdf_snippet(text, "标题", max_lines=3)
    body = snippet.split("\n\n", 1)[1] if "\n\n" in snippet else ""
    assert len(body.split("\n")) <= 3
