"""搜索结果渲染器 - 将搜索数据转换为 Rich 可渲染对象"""

import re

from rich.rule import Rule
from rich.text import Text


def render_search_header(query: str, count: int, is_ripgrep: bool = False, is_like: bool = False) -> Rule:
    source = " (ripgrep)" if is_ripgrep else (" (LIKE)" if is_like else "")
    return Rule(
        f" 关键词: {query}  |  找到 {count} 个匹配{source} ",
        style="#7aa2f7",
        characters="─",
    )


def render_no_results(query: str) -> Text:
    return Text(f"未找到包含 '{query}' 的结果", style="#565f89")


def _highlight_keywords(
    text: str,
    keywords: list[str],
    base_style: str = "#c0caf5",
    is_regex: bool = False,
) -> Text:
    if not keywords or not text:
        return Text(text, style=base_style)

    rich_text = Text(style=base_style)
    remaining = text
    while remaining:
        earliest_pos = len(remaining)
        earliest_len = 0
        for kw in keywords:
            if not kw:
                continue
            if is_regex:
                m = re.search(kw, remaining, re.IGNORECASE)
                if m and m.start() < earliest_pos:
                    earliest_pos = m.start()
                    earliest_len = m.end() - m.start()
            else:
                pos = remaining.lower().find(kw.lower())
                if pos >= 0 and pos < earliest_pos:
                    earliest_pos = pos
                    earliest_len = len(kw)

        if earliest_len == 0:
            rich_text.append(remaining)
            break

        if earliest_pos > 0:
            rich_text.append(remaining[:earliest_pos])

        match_text = remaining[earliest_pos:earliest_pos + earliest_len]
        rich_text.append(match_text, style="#e0af68 bold")

        remaining = remaining[earliest_pos + earliest_len:]

    return rich_text


def _truncate_text(text: str, max_len: int = 200) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def _format_score(score: float) -> Text:
    pct = int(score * 100)
    filled = score * 5
    stars = "★" * int(filled) + "☆" * (5 - int(filled))
    return Text(f"{stars} {pct}%", style="#9e9e9e")


def render_search_result(
    index: int,
    doc_id: str,
    node: dict,
    matched: int,
    total_keywords: int,
    composite: float = 0.0,
    path: str = "",
    is_ripgrep: bool = False,
    is_like: bool = False,
    query_words: list[str] | None = None,
) -> Text:
    query_words = query_words or []
    title_text = node.get("title", "")
    display_text = node.get("text", "") or ""
    display_line = node.get("line_start")

    # 路径行: [序号] 路径:行号
    header = Text()
    header.append(f"[{index}] ", style="#7aa2f7 bold")
    if path:
        path_note = path.replace("\\", "/")
        if display_line is not None:
            path_note += f":{display_line}"
        header.append(path_note, style="#7aa2f7")
    else:
        header.append(_highlight_keywords(title_text, query_words, "#7aa2f7", is_regex=is_ripgrep))

    # 内容片段
    lines = display_text.split("\n")
    kw_lower = [kw.lower() for kw in query_words if kw]
    match_indices = [
        i for i, line in enumerate(lines)
        if any(kw in line.lower() for kw in kw_lower)
        or (is_ripgrep and any(re.search(kw, line, re.IGNORECASE) for kw in query_words if kw))
    ]

    if match_indices:
        first = max(0, match_indices[0] - 1)
        last = min(len(lines) - 1, match_indices[-1] + 1)
        selected = lines[first:last + 1]
    else:
        selected = []
        for line in lines:
            stripped = line.strip()
            if stripped:
                selected.append(stripped)
            if len(selected) >= 5:
                break

    snippet = "\n".join(line.strip() for line in selected if line.strip())
    snippet = _truncate_text(snippet, 300)

    # 评分行 - 使用暗色与正文区分
    score_style = "#4a4a5a"
    if is_ripgrep or is_like:
        score_text = Text(f"匹配 {matched}/{total_keywords} 词", style=score_style)
    else:
        score_text = Text(style=score_style)
        score_text.append("评分: ")
        score_text.append_text(_format_score(composite))
        score_text.append(f"  匹配: {matched}/{total_keywords} 词")

    # 组装: 标题 \n 分隔线 \n 内容 \n\n 评分 \n
    result_parts: list[Text] = [
        header,
        Text("─" * 60, style="#3b3d57"),
        _highlight_keywords(snippet, query_words, is_regex=is_ripgrep),
        Text(""),
        score_text,
        Text(""),
    ]

    return Text("\n").join(result_parts)


def render_search_results(
    results: list[tuple],
    query: str,
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int = 20,
    is_ripgrep: bool = False,
    is_like: bool = False,
) -> list:
    output: list = []

    if not results:
        output.append(render_no_results(query))
        return output

    output.append(render_search_header(query, len(results), is_ripgrep, is_like))
    output.append(Text(""))

    display_items = results[:max_results]
    for i, item in enumerate(display_items, 1):
        if is_like:
            # LIKE results are dicts: {node_id, doc_id, title, summary, fts_score, depth}
            doc_id = item["doc_id"]
            node = {
                "title": item.get("title", ""),
                "text": item.get("summary", ""),
            }
            matched = 1
            composite = item.get("fts_score", 0.0)
        elif is_ripgrep:
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
                is_like=is_like,
                query_words=query_words,
            )
        )

    return output
