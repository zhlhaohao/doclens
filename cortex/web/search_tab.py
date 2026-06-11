"""搜索 Tab — FTS5/关键词/正则搜索文档，HTML 卡片渲染结果"""

import html
import re

import gradio as gr

from cortex.scoring import tokenize_query
from cortex.scoring_pipeline import score_and_rank

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


def _highlight_html(text: str, keywords: list[str]) -> str:
    """在文本中高亮关键词（HTML <mark> 标签）"""
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
    """智能选择包含关键词的上下文行"""
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


def _build_score_bar_html(score: float, matched: int, total: int) -> str:
    """构建 CSS 渐变评分进度条 HTML"""
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
    snippet: str,
    score_html: str,
) -> str:
    """构建单条搜索结果的 HTML 卡片"""
    return (
        f'<div class="search-card">'
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
    """将搜索结果格式化为 HTML 卡片列表"""
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
        f'  {f"— {html.escape(query)}{html.escape(source_label)}" }'
        f'</div>'
    )

    cards = []
    display_items = results[:max_results]
    for i, item in enumerate(display_items, 1):
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

        # 内容片段
        display_text = node.get("text", "") or ""
        if display_text:
            snippet_text = _select_context_lines(display_text, query_words)
            snippet_text = _truncate_text(snippet_text)
            snippet_html = _highlight_html(snippet_text, query_words)
        else:
            snippet_html = html.escape(node.get("title", "") or "")

        # 评分
        if source == "fts":
            score_html = _build_score_bar_html(composite, matched, len(query_words))
        else:
            score_html = (
                f'<div class="score-bar-wrapper">'
                f'  <span class="score-bar-label">匹配: {matched}/{len(query_words)} 词</span>'
                f'</div>'
            )

        cards.append(_build_result_card(i, path_display, snippet_html, score_html))

    cards_html = "\n".join(cards)
    return f'{stats_html}<div class="search-results-container">{cards_html}</div>'


def do_search(query: str) -> str:
    """执行搜索并返回 HTML 结果"""
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


def _empty_state_html() -> str:
    """初始空状态页面"""
    return (
        f'<div class="empty-state">'
        f'  {ICON_SEARCH}'
        f'  <div class="empty-state-title">搜索文档</div>'
        f'  <div class="empty-state-desc">输入关键词开始搜索，支持多词组合查询</div>'
        f'</div>'
    )


def build_search_tab():
    """构建搜索 Tab UI"""
    with gr.Row(elem_classes=["search-input-row"]):
        search_input = gr.Textbox(
            placeholder="输入搜索关键词...",
            show_label=False,
            scale=4,
            elem_classes=["search-textbox"],
        )
        search_btn = gr.Button("搜索", variant="primary", scale=1, elem_classes=["search-btn"])

    search_output = gr.HTML(
        value=_empty_state_html(),
        elem_id="search-results",
    )

    search_input.submit(
        fn=do_search,
        inputs=[search_input],
        outputs=[search_output],
    )
    search_btn.click(
        fn=do_search,
        inputs=[search_input],
        outputs=[search_output],
    )
