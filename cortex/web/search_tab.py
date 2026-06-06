"""搜索 Tab — FTS5/关键词/正则搜索文档，Markdown 渲染结果"""

import re

import gradio as gr

from cortex.scoring import tokenize_query
from cortex.scoring_pipeline import score_and_rank


def _highlight_markdown(text: str, keywords: list[str]) -> str:
    """在文本中高亮关键词（Markdown 加粗）"""
    if not keywords or not text:
        return text
    result = text
    for kw in keywords:
        if not kw:
            continue
        pattern = re.compile(re.escape(kw), re.IGNORECASE)
        result = pattern.sub(lambda m: f"**{m.group()}**", result)
    return result


def _truncate_text(text: str, max_len: int = 300) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def _format_score_bar(score: float) -> str:
    """格式化评分条"""
    pct = int(score * 100)
    filled = int(score * 10)
    bar = "█" * filled + "░" * (10 - filled)
    return f"{bar} {pct}%"


def _render_markdown_results(
    results: list[tuple],
    query: str,
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int = 20,
    source: str = "fts",
) -> str:
    """将搜索结果格式化为 Markdown"""
    if not results:
        return f"### 未找到包含 '{query}' 的结果"

    source_label = " (LIKE)" if source == "like" else " (ripgrep)" if source == "ripgrep" else ""
    lines = [f"### 搜索结果: \"{query}\" ({len(results)} 条{source_label})", ""]

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

        # 标题行
        lines.append(f"**{i}. {path_display}**")
        lines.append("")

        # 内容片段
        display_text = node.get("text", "") or ""
        if display_text:
            snippet = _select_context_lines(display_text, query_words)
            snippet = _truncate_text(snippet)
            snippet = _highlight_markdown(snippet, query_words)
            lines.append(f"> {snippet}")
            lines.append("")

        # 评分行
        if source == "fts":
            lines.append(f"评分: {_format_score_bar(composite)}  |  匹配: {matched}/{len(query_words)} 词")
        else:
            lines.append(f"匹配: {matched}/{len(query_words)} 词")

        lines.append("---")

    return "\n".join(lines)


def _select_context_lines(text: str, query_words: list[str], max_lines: int = 5) -> str:
    """智能选择包含关键词的上下文行"""
    lines = text.split("\n")
    kw_lower = [kw.lower() for kw in query_words if kw]

    # 计算每行的关键词命中数
    line_scores = []
    for j, line in enumerate(lines):
        line_lower = line.lower()
        cnt = sum(1 for w in kw_lower if w in line_lower)
        if cnt > 0:
            line_scores.append((cnt, j, line))

    if not line_scores:
        # 无匹配行，取前几个非空行
        selected = []
        for line in lines:
            if line.strip():
                selected.append(line.strip())
            if len(selected) >= max_lines:
                break
        return "\n".join(selected)

    # 按命中数排序取最佳锚点
    line_scores.sort(key=lambda x: -x[0])
    best_indices = sorted(set(j for _, j, _ in line_scores[:max_lines]))
    return "\n".join(lines[j].strip() for j in best_indices if lines[j].strip())


def do_search(query: str) -> str:
    """执行搜索并返回 Markdown 结果"""
    if not query or not query.strip():
        return "请输入搜索关键词"

    query = query.strip()

    from cortex.web.deps import get_index_manager
    idx = get_index_manager()

    # 分词
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]

    # FTS 搜索
    nodes, docs = idx.search(query)

    # 评分排序
    result = score_and_rank(nodes, docs, query, query_words, idx)

    if result.source == "like":
        return _render_markdown_results(
            result.like_raw, query, query_words, idx.path_map,
            max_results=idx.max_results, source="like",
        )
    elif result.source == "ripgrep":
        return _render_markdown_results(
            result.results, query, query_words, idx.path_map,
            max_results=idx.max_results, source="ripgrep",
        )
    else:
        return _render_markdown_results(
            result.results, query, query_words, idx.path_map,
            max_results=idx.max_results, source="fts",
        )


def build_search_tab():
    """构建搜索 Tab UI"""
    with gr.Row():
        search_input = gr.Textbox(
            placeholder="输入搜索关键词...",
            show_label=False,
            scale=4,
        )
        search_btn = gr.Button("搜索", variant="primary", scale=1)

    search_output = gr.Markdown(
        value="输入关键词开始搜索",
        elem_id="search-results",
    )

    # 绑定事件：回车或按钮点击都触发搜索
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
