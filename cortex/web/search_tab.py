"""搜索 Tab — Hero 空状态 + 搜索后全宽双栏布局"""

import html
import logging
import os
import re

import gradio as gr

from cortex.scoring import tokenize_query
from cortex.scoring_pipeline import score_and_rank

logger = logging.getLogger(__name__)

# Lucide SVG 图标
ICON_FILE = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" '
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>'
    '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>'
    '<path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>'
)
ICON_SEARCH = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" '
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'
)
ICON_EYE = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" '
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>'
    '<circle cx="12" cy="12" r="3"/></svg>'
)
ICON_FILE_TEXT = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" '
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>'
    '<path d="M14 2v4a2 2 0 0 0 2 2h4"/>'
    '<path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>'
)

# 卡片点击 JS（内联到 onclick，因为 Gradio innerHTML 不执行 <script>）
_CARD_ONCLICK_JS = (
    "var p=this.getAttribute('data-path'),l=this.getAttribute('data-line'),"
    "v=p+(l?':'+l:''),c=document.getElementById('card-selector');"
    "if(!c)return;"
    "var i=c.querySelector('textarea')||c.querySelector('input');"
    "if(!i)return;"
    "i.focus();i.value=v;"
    "i.dispatchEvent(new Event('input',{bubbles:true}));"
    "i.dispatchEvent(new Event('change',{bubbles:true}));"
    "i.blur();"
    "document.querySelectorAll('.search-card').forEach(function(x){x.classList.remove('active')});"
    "this.classList.add('active');"
)


# ---------------------------------------------------------------------------
# 文本处理工具
# ---------------------------------------------------------------------------

def _highlight_html(text: str, keywords: list[str]) -> str:
    if not keywords or not text:
        return html.escape(text)
    result = html.escape(text)
    for kw in keywords:
        if not kw:
            continue
        escaped_kw = html.escape(kw)
        pattern = re.compile(re.escape(escaped_kw), re.IGNORECASE)
        result = pattern.sub(lambda m: f"<mark>{m.group()}</mark>", result)
    return result


def _truncate_text(text: str, max_len: int = 300) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def _select_context_lines(text: str, query_words: list[str], max_lines: int = 5) -> str:
    lines = text.split("\n")
    kw_lower = [kw.lower() for kw in query_words if kw]
    line_scores = []
    for j, line in enumerate(lines):
        line_lower = line.lower()
        cnt = sum(1 for w in kw_lower if w in line_lower)
        if cnt > 0:
            line_scores.append((cnt, j, line))
    if not line_scores:
        selected = []
        for line in lines:
            if line.strip():
                selected.append(line.strip())
            if len(selected) >= max_lines:
                break
        return "\n".join(selected)
    line_scores.sort(key=lambda x: -x[0])
    best_indices = sorted(set(j for _, j, _ in line_scores[:max_lines]))
    return "\n".join(lines[j].strip() for j in best_indices if lines[j].strip())


# ---------------------------------------------------------------------------
# HTML 渲染
# ---------------------------------------------------------------------------

def _build_score_bar_html(score: float, matched: int, total: int) -> str:
    pct = int(score * 100)
    return (
        f'<div class="score-bar-wrapper">'
        f'  <div class="score-bar-track">'
        f'    <div class="score-bar-fill" style="width: {pct}%"></div>'
        f'  </div>'
        f'  <span class="score-bar-label">{pct}% | 匹配: {matched}/{total} 词</span>'
        f'</div>'
    )


def _build_result_card(
    index: int,
    path_display: str,
    raw_path: str,
    line_start: int | None,
    snippet: str,
    score_html: str,
) -> str:
    data_line = str(line_start) if line_start else ""
    return (
        f'<div class="search-card" data-path="{html.escape(raw_path)}" '
        f'data-line="{data_line}" onclick="{_CARD_ONCLICK_JS}">'
        f'  <div class="search-card-path">{ICON_FILE} {html.escape(path_display)}</div>'
        f'  <div class="search-card-snippet">{snippet}</div>'
        f'  {score_html}'
        f'</div>'
    )


def _render_html_results(
    results: list[tuple],
    query: str,
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int = 20,
    source: str = "fts",
) -> str:
    if not results:
        return (
            f'<div class="empty-state">'
            f'  {ICON_SEARCH}'
            f'  <div class="empty-state-title">未找到结果</div>'
            f'  <div class="empty-state-desc">未找到包含 "{html.escape(query)}" 的文档，<br>请尝试其他关键词</div>'
            f'</div>'
        )

    source_label = (
        " (LIKE)" if source == "like"
        else " (ripgrep)" if source == "ripgrep"
        else ""
    )
    stats_html = (
        f'<div class="result-stats">'
        f'  找到 <strong>{len(results)}</strong> 条结果'
        f'  {"— " + html.escape(query) + html.escape(source_label)}'
        f'</div>'
    )

    cards = []
    for i, item in enumerate(results[:max_results], 1):
        if source == "like":
            doc_id = item["doc_id"]
            node = {"title": item.get("title", ""), "text": item.get("summary", "")}
            matched = 1
            composite = item.get("fts_score", 0.0)
        elif source == "ripgrep":
            doc_id, node, matched, prox, fts = item
            composite = 0.0
        else:
            composite, (doc_id, node, matched, prox, fts) = item

        path = path_map.get(doc_id, "")
        path_display = path.replace("\\", "/")
        line_start = node.get("line_start")
        if line_start is not None:
            path_display += f":{line_start}"

        display_text = node.get("text", "") or ""
        if display_text:
            snippet_text = _select_context_lines(display_text, query_words)
            snippet_text = _truncate_text(snippet_text)
            snippet_html = _highlight_html(snippet_text, query_words)
        else:
            snippet_html = html.escape(node.get("title", "") or "")

        if source == "fts":
            score_html = _build_score_bar_html(composite, matched, len(query_words))
        else:
            score_html = (
                f'<div class="score-bar-wrapper">'
                f'  <span class="score-bar-label">匹配: {matched}/{len(query_words)} 词</span>'
                f'</div>'
            )

        cards.append(_build_result_card(
            i, path_display, path, line_start, snippet_html, score_html,
        ))

    cards_html = "\n".join(cards)
    return f'{stats_html}<div class="search-results-container">{cards_html}</div>'


# ---------------------------------------------------------------------------
# 文件预览
# ---------------------------------------------------------------------------

def _read_file_content(abs_path: str, highlight_line: int | None = None) -> str:
    ext = os.path.splitext(abs_path)[1].lower()
    if ext == ".pdf":
        return _read_pdf_content(abs_path)
    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception as e:
        return (
            f'<div class="preview-empty"><div class="preview-empty-title">读取失败</div>'
            f'<div class="preview-empty-desc">{html.escape(str(e))}</div></div>'
        )
    if not lines:
        return '<div class="preview-empty"><div class="preview-empty-title">文件为空</div></div>'

    max_lines = 500
    if len(lines) > max_lines:
        if highlight_line and 0 < highlight_line <= len(lines):
            start = max(0, highlight_line - max_lines // 2)
            end = min(len(lines), start + max_lines)
        else:
            start, end = 0, max_lines
        lines = lines[start:end]
        offset = start
    else:
        offset = 0

    rendered = []
    for i, line in enumerate(lines):
        line_no = offset + i + 1
        escaped = html.escape(line.rstrip("\n"))
        if highlight_line and line_no == highlight_line:
            rendered.append(
                f'<div class="highlight-line"><span class="line-number">{line_no}</span>{escaped}</div>'
            )
        else:
            rendered.append(f'<span class="line-number">{line_no}</span>{escaped}')
    return "\n".join(rendered)


def _read_pdf_content(abs_path: str) -> str:
    try:
        import pdfplumber
    except ImportError:
        return (
            '<div class="preview-empty"><div class="preview-empty-title">PDF 预览不可用</div>'
            '<div class="preview-empty-desc">请安装 pdfplumber</div></div>'
        )
    try:
        pages = []
        with pdfplumber.open(abs_path) as pdf:
            for page_idx, page in enumerate(pdf.pages[:50]):
                text = page.extract_text()
                if text:
                    pages.append(f'<div class="pdf-page">--- 第 {page_idx + 1} 页 ---</div>')
                    for line_no, line in enumerate(text.split("\n"), 1):
                        pages.append(
                            f'<span class="line-number">{line_no}</span>{html.escape(line)}'
                        )
        if not pages:
            return '<div class="preview-empty"><div class="preview-empty-title">PDF 无文本内容</div></div>'
        return "\n".join(pages)
    except Exception as e:
        logger.exception("PDF preview failed: %s", e)
        return (
            f'<div class="preview-empty"><div class="preview-empty-title">PDF 解析失败</div>'
            f'<div class="preview-empty-desc">{html.escape(str(e))}</div></div>'
        )


def _resolve_path(path: str) -> str | None:
    """解析文件路径（支持绝对路径和相对路径）"""
    if os.path.isabs(path) and os.path.exists(path):
        return path
    from cortex.web.deps import get_index_manager
    idx = get_index_manager()
    abs_path = os.path.join(idx.search_path, path)
    if os.path.exists(abs_path):
        return abs_path
    return None


def preview_file(card_value: str) -> str:
    if not card_value or not card_value.strip():
        return _preview_empty_html()
    parts = card_value.strip().rsplit(":", 1)
    path = parts[0]
    highlight_line = None
    if len(parts) == 2 and parts[1].isdigit():
        highlight_line = int(parts[1])

    abs_path = _resolve_path(path)
    if not abs_path:
        return (
            f'<div class="preview-panel">'
            f'  <div class="preview-header">{ICON_FILE_TEXT} '
            f'    <span class="preview-header-path">{html.escape(path)}</span>'
            f'  </div>'
            f'  <div class="preview-content">'
            f'    <div class="preview-empty">'
            f'      <div class="preview-empty-title">文件未找到</div>'
            f'      <div class="preview-empty-desc">{html.escape(path)}</div>'
            f'    </div>'
            f'  </div>'
            f'</div>'
        )

    content_html = _read_file_content(abs_path, highlight_line)
    path_display = path.replace("\\", "/")
    if highlight_line:
        path_display += f":{highlight_line}"
    return (
        f'<div class="preview-panel">'
        f'  <div class="preview-header">{ICON_FILE_TEXT} '
        f'    <span class="preview-header-path">{html.escape(path_display)}</span>'
        f'  </div>'
        f'  <div class="preview-content">{content_html}</div>'
        f'</div>'
    )


# ---------------------------------------------------------------------------
# 搜索逻辑
# ---------------------------------------------------------------------------

def _do_search(query: str) -> str:
    if not query or not query.strip():
        return (
            f'<div class="empty-state">'
            f'  {ICON_SEARCH}'
            f'  <div class="empty-state-title">开始搜索</div>'
            f'  <div class="empty-state-desc">输入关键词搜索文档</div>'
            f'</div>'
        )
    query = query.strip()
    from cortex.web.deps import get_index_manager
    idx = get_index_manager()
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    nodes, docs = idx.search(query)
    result = score_and_rank(nodes, docs, query, query_words, idx)
    if result.source == "like":
        return _render_html_results(
            result.like_raw, query, query_words, idx.path_map,
            max_results=idx.max_results, source="like",
        )
    elif result.source == "ripgrep":
        return _render_html_results(
            result.results, query, query_words, idx.path_map,
            max_results=idx.max_results, source="ripgrep",
        )
    else:
        return _render_html_results(
            result.results, query, query_words, idx.path_map,
            max_results=idx.max_results, source="fts",
        )


def _preview_empty_html() -> str:
    return (
        f'<div class="preview-panel">'
        f'  <div class="preview-content">'
        f'    <div class="preview-empty">'
        f'      {ICON_EYE}'
        f'      <div class="preview-empty-title">文件预览</div>'
        f'      <div class="preview-empty-desc">点击左侧搜索结果查看文件内容</div>'
        f'    </div>'
        f'  </div>'
        f'</div>'
    )


# ---------------------------------------------------------------------------
# 构建 Tab UI — Hero 空状态 + 紧凑搜索结果状态
# ---------------------------------------------------------------------------

def build_search_tab():
    """构建搜索 Tab UI（Hero 空状态 → 搜索后切换紧凑布局）"""

    # === Hero 区域（初始可见）===
    hero_section = gr.Column(elem_classes=["hero-section"], visible=True)
    with hero_section:
        gr.HTML(
            '<div class="hero-title">Cortex</div>'
            '<div class="hero-subtitle">结构感知文档检索</div>'
        )
        with gr.Row(elem_classes=["hero-search-row"]):
            hero_input = gr.Textbox(
                placeholder="输入搜索关键词...",
                show_label=False,
                scale=4,
            )
            hero_btn = gr.Button("搜索", variant="primary", scale=1, elem_classes=["search-btn"])

    # === 结果区域（初始隐藏）===
    results_section = gr.Column(visible=False)
    with results_section:
        # 紧凑搜索栏
        with gr.Row(elem_classes=["compact-search-row"]):
            compact_input = gr.Textbox(
                placeholder="输入搜索关键词...",
                show_label=False,
                scale=4,
            )
            compact_btn = gr.Button("搜索", variant="primary", scale=1, elem_classes=["search-btn"])

        # 双栏布局
        with gr.Row(elem_classes=["search-layout"]):
            with gr.Column(scale=2, elem_classes=["search-results-col"]):
                search_output = gr.HTML()
            with gr.Column(scale=3, elem_classes=["preview-col"]):
                preview_output = gr.HTML()

    # 隐藏 input 接收卡片点击路径（CSS 隐藏，保持 DOM 存在以便 JS 更新）
    card_selector = gr.Textbox(elem_id="card-selector", elem_classes=["hidden-input"])

    # --- Hero 搜索事件 ---
    def _hero_search(query):
        results_html = _do_search(query)
        return (
            gr.Column(visible=False),   # hero_section 隐藏
            gr.Column(visible=True),    # results_section 显示
            results_html,               # search_output
            _preview_empty_html(),      # preview_output
        )

    hero_input.submit(
        fn=_hero_search,
        inputs=[hero_input],
        outputs=[hero_section, results_section, search_output, preview_output],
    )
    hero_btn.click(
        fn=_hero_search,
        inputs=[hero_input],
        outputs=[hero_section, results_section, search_output, preview_output],
    )

    # --- 紧凑搜索事件 ---
    compact_input.submit(
        fn=_do_search,
        inputs=[compact_input],
        outputs=[search_output],
    )
    compact_btn.click(
        fn=_do_search,
        inputs=[compact_input],
        outputs=[search_output],
    )

    # --- 卡片点击预览 ---
    card_selector.change(
        fn=preview_file,
        inputs=[card_selector],
        outputs=[preview_output],
    )
