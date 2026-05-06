"""搜索结果渲染器 - 将搜索数据转换为 Rich 可渲染对象"""

from rich.panel import Panel
from rich.rule import Rule
from rich.style import Style
from rich.text import Text


def render_search_header(query: str, count: int, is_ripgrep: bool = False) -> Rule:
    source = " (ripgrep)" if is_ripgrep else ""
    return Rule(
        f" 关键词: {query}  |  找到 {count} 个匹配{source} ",
        style="#7aa2f7",
        characters="─",
    )


def render_no_results(query: str) -> Text:
    return Text(f"未找到包含 '{query}' 的结果", style="#565f89")


def _highlight_keywords(text: str, keywords: list[str], base_style: str = "#c0caf5") -> Text:
    if not keywords or not text:
        return Text(text, style=base_style)

    rich_text = Text(style=base_style)
    remaining = text
    while remaining:
        earliest_pos = len(remaining)
        earliest_kw = None
        for kw in keywords:
            if not kw:
                continue
            pos = remaining.lower().find(kw.lower())
            if pos >= 0 and pos < earliest_pos:
                earliest_pos = pos
                earliest_kw = kw

        if earliest_kw is None:
            rich_text.append(remaining)
            break

        if earliest_pos > 0:
            rich_text.append(remaining[:earliest_pos])

        match_text = remaining[earliest_pos:earliest_pos + len(earliest_kw)]
        rich_text.append(match_text, style="#e0af68 bold")

        remaining = remaining[earliest_pos + len(earliest_kw):]

    return rich_text


def _truncate_text(text: str, max_len: int = 200) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def _format_score(score: float) -> Text:
    pct = int(score * 100)
    filled = score * 5
    stars = "★" * int(filled) + "☆" * (5 - int(filled))
    return Text(f"{stars} {pct}%", style="#e0af68")


def render_search_result(
    index: int,
    doc_id: str,
    node: dict,
    matched: int,
    total_keywords: int,
    composite: float = 0.0,
    path: str = "",
    is_ripgrep: bool = False,
    query_words: list[str] | None = None,
) -> Panel:
    query_words = query_words or []
    title_text = node.get("title", "")
    display_text = node.get("text", "") or ""
    display_line = node.get("line_start")

    title = _highlight_keywords(title_text, query_words, "#7aa2f7 bold")

    content_parts: list = []
    if path:
        path_display = path.replace("\\", "\\\\")
        if display_line is not None:
            path_display += f":{display_line}"
        content_parts.append(Text(f"\U0001f4c4 {path_display}", style="#7aa2f7"))
        content_parts.append(Text(""))

    lines = display_text.split("\n")
    # 找到包含关键词的行索引
    kw_lower = [kw.lower() for kw in query_words if kw]
    match_indices = [
        i for i, line in enumerate(lines)
        if any(kw in line.lower() for kw in kw_lower)
    ]

    if match_indices:
        # 从第一个匹配行到最后一个匹配行，前后各扩展 1 行上下文
        first = max(0, match_indices[0] - 1)
        last = min(len(lines) - 1, match_indices[-1] + 1)
        selected = lines[first:last + 1]
    else:
        # 无关键词匹配时取前 5 行
        selected = []
        for line in lines:
            stripped = line.strip()
            if stripped:
                selected.append(stripped)
            if len(selected) >= 5:
                break

    snippet_lines = [line.strip() for line in selected if line.strip()]

    snippet = "\n".join(snippet_lines)
    snippet = _truncate_text(snippet, 300)
    content_parts.append(_highlight_keywords(snippet, query_words))

    content_parts.append(Text(""))
    if is_ripgrep:
        score_text = Text(f"匹配: {matched}/{total_keywords} 词", style="#565f89")
    else:
        score_text = Text()
        score_text.append("评分: ")
        score_text.append_text(_format_score(composite))
        score_text.append(f"  匹配: {matched}/{total_keywords} 词")
    content_parts.append(score_text)

    panel_content = Text("\n").join(
        p if isinstance(p, Text) else Text(str(p))
        for p in content_parts
    )

    return Panel(
        panel_content,
        title=f"[{index}]",
        title_align="left",
        border_style="#3b3d57",
        padding=(0, 1),
    )


def render_search_results(
    results: list[tuple],
    query: str,
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int = 20,
    is_ripgrep: bool = False,
) -> list:
    output: list = []

    if not results:
        output.append(render_no_results(query))
        return output

    output.append(render_search_header(query, len(results), is_ripgrep))

    display_items = results[:max_results]
    for i, item in enumerate(display_items, 1):
        if is_ripgrep:
            doc_id, node, matched, prox, fts = item
            composite = 0.0
        else:
            composite, (doc_id, node, matched, prox, fts) = item

        path = path_map.get(doc_id, "")
        output.append(
            render_search_result(
                index=i,
                doc_id=doc_id,
                node=node,
                matched=matched,
                total_keywords=len(query_words),
                composite=composite,
                path=path,
                is_ripgrep=is_ripgrep,
                query_words=query_words,
            )
        )

    return output
