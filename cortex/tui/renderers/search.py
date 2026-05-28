"""搜索结果渲染器 - 将搜索数据转换为 Rich 可渲染对象"""

import re

from rich.rule import Rule
from rich.text import Text


def render_search_header(query: str, count: int, is_ripgrep: bool = False, is_like: bool = False) -> Rule:
    source = " (LIKE)" if is_like else ""
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
    max_anchor_lines: int = 3,
    context_expand_range: int = 5,
    min_keywords_per_line: int = 2,
    max_context_lines: int = 5,
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

    # 内容片段 — 智能锚点上下文选择（与 CLI _render_results 对齐）
    lines = display_text.split("\n")
    kw_lower = [kw.lower() for kw in query_words if kw]

    # 给每行计算包含几个关键词
    line_keyword_counts: list[tuple[int, int, str]] = []
    for j, l in enumerate(lines):
        l_lower = l.lower()
        cnt = sum(1 for w in kw_lower if w in l_lower)
        if cnt > 0:
            line_keyword_counts.append((cnt, j, l))

    selected_line_indices: list[int]
    if not line_keyword_counts:
        # 无匹配行：取前 max_context_lines 个非空行
        selected_line_indices = []
        for j, line in enumerate(lines):
            if line.strip():
                selected_line_indices.append(j)
            if len(selected_line_indices) >= max_context_lines:
                break
    else:
        # 按关键词命中数降序排序
        line_keyword_counts.sort(key=lambda x: -x[0])
        # 筛选命中数 >= min_keywords_per_line 的行作为锚点
        best_lines = [
            (j, l)
            for cnt, j, l in line_keyword_counts
            if cnt >= min_keywords_per_line
        ]
        if not best_lines:
            best_lines = [
                (j, l)
                for cnt, j, l in line_keyword_counts[:max_context_lines]
            ]
        # 取前 max_anchor_lines 个锚点，向前后扩展 context_expand_range 行
        context_indices = set()
        for j, _l in best_lines[:max_anchor_lines]:
            for offset in range(-context_expand_range, context_expand_range + 1):
                idx = j + offset
                if 0 <= idx < len(lines):
                    context_indices.add(idx)
        selected_line_indices = sorted(context_indices)

    selected = [lines[j].strip() for j in selected_line_indices if lines[j].strip()]
    snippet = "\n".join(selected)
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
    max_anchor_lines: int = 3,
    context_expand_range: int = 5,
    min_keywords_per_line: int = 2,
    max_context_lines: int = 5,
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
                max_anchor_lines=max_anchor_lines,
                context_expand_range=context_expand_range,
                min_keywords_per_line=min_keywords_per_line,
                max_context_lines=max_context_lines,
            )
        )

    return output
