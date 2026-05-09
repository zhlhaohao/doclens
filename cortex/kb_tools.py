"""知识库工具定义和处理器

为 AI Agent 提供知识库搜索、索引管理和文档阅读能力。
"""

import asyncio
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from cortex.index_manager import IndexManager


# ---------------------------------------------------------------------------
# Anthropic tool use schema 定义
# ---------------------------------------------------------------------------

SEARCH_KB_TOOL = {
    "name": "search_kb",
    "description": (
        "在知识库索引中搜索相关文档片段。"
        "支持中英文混合查询，返回带层次结构的搜索结果。"
        "当用户提问与知识库内容相关时使用此工具。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "搜索关键词，支持中英文混合",
            },
            "max_results": {
                "type": "integer",
                "description": "返回的最大结果数，默认 10",
                "default": 10,
            },
        },
        "required": ["query"],
    },
}

SEARCH_KB_V2_TOOL = {
    "name": "search_kb_v2",
    "description": (
        "使用结构化查询在知识库索引中搜索相关文档片段。"
        "query_tokens 支持: "
        "AND (所有词匹配), OR (任一匹配), NOT (排除), PHRASE (短语精确匹配)。"
        "返回带层次结构的搜索结果。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "query_tokens": {
                "type": "object",
                "description": "结构化查询，支持 AND/OR/NOT/PHRASE 操作符",
                "properties": {
                    "type": {"type": "string", "enum": ["and", "or", "not", "phrase"]},
                    "terms": {"type": "array", "items": {"type": "string"}},
                    "term": {"type": "string"},
                    "text": {"type": "string"},
                    "exclude": {"type": "array", "items": {"type": "string"}},
                },
            },
            "max_results": {
                "type": "integer",
                "description": "返回的最大结果数，默认 10",
                "default": 10,
            },
        },
        "required": ["query_tokens"],
    },
}

MANAGE_KB_TOOL = {
    "name": "manage_kb",
    "description": (
        "管理知识库索引。支持 reindex（重建索引）和 stats（查看统计）两种操作。"
        "搜索无结果时可用 reindex 重建索引。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "action": {
                "type": "string",
                "enum": ["reindex", "stats"],
                "description": "操作类型: reindex 重建索引, stats 查看统计",
            },
            "force": {
                "type": "boolean",
                "description": "reindex 时是否强制全量重建，默认 false",
                "default": False,
            },
        },
        "required": ["action"],
    },
}

READ_DOCUMENT_TOOL = {
    "name": "read_document",
    "description": (
        "读取知识库文档的完整或部分内容。"
        "支持多种文件格式: md, pdf, docx, pptx, xlsx, html, 代码文件, 纯文本等。"
        "返回带层次结构和目录信息的内容。"
        "对于 PDF/DOCX/PPTX/XLSX 等二进制格式，必须使用此工具而非 read_file。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "文档路径（从搜索结果中获取）",
            },
            "start_line": {
                "type": "integer",
                "description": "起始行号（可选）",
            },
            "end_line": {
                "type": "integer",
                "description": "结束行号（可选）",
            },
            "section": {
                "type": "string",
                "description": "章节标题，如 '第三章 实验方法'（可选，优先于行号）",
            },
        },
        "required": ["path"],
    },
}


# ---------------------------------------------------------------------------
# 格式化常量（默认值，运行时从 idx_manager 配置读取）
# ---------------------------------------------------------------------------

MAX_CONTEXT_CHARS_PER_RESULT = 800
MAX_TOTAL_CHARS = 10000
MAX_READ_CHARS = 6000


# ---------------------------------------------------------------------------
# 公共入口
# ---------------------------------------------------------------------------

def build_kb_tools(
    idx_manager: IndexManager,
    workdir: Path,
) -> Tuple[List[Dict], Dict[str, Callable]]:
    """构建知识库工具定义和处理器。

    Args:
        idx_manager: 已初始化的 IndexManager 实例
        workdir: 工作目录（知识库搜索路径）

    Returns:
        (tools, handlers) 元组
        - tools: Anthropic tool use 格式的工具定义列表
        - handlers: 工具名 -> 处理函数的映射
    """
    # 动态生成 search_kb schema，使用配置中的 max_results
    search_kb_schema = {
        "name": "search_kb",
        "description": SEARCH_KB_TOOL["description"],
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词，支持中英文混合",
                },
                "max_results": {
                    "type": "integer",
                    "description": "返回的最大结果数",
                    "default": idx_manager.max_results,
                },
            },
            "required": ["query"],
        },
    }

    handlers = {
        "search_kb": lambda **kw: _handle_search_kb(idx_manager, workdir, **kw),
        "search_kb_v2": lambda **kw: _handle_search_kb_v2(idx_manager, workdir, **kw),
        "manage_kb": lambda **kw: _handle_manage_kb(idx_manager, **kw),
        "read_document": lambda **kw: _handle_read_document(idx_manager, workdir, **kw),
    }
    return [search_kb_schema, SEARCH_KB_V2_TOOL, MANAGE_KB_TOOL, READ_DOCUMENT_TOOL], handlers


# ---------------------------------------------------------------------------
# 搜索辅助函数
# ---------------------------------------------------------------------------

def _build_fts5_query(query_tokens: dict) -> str:
    """将结构化查询转换为 FTS5 查询语法。

    Args:
        query_tokens: 结构化查询字典，支持以下类型：
            - {"type": "and", "terms": [...], "exclude": [...]}  # 所有词都匹配，可选排除
            - {"type": "or", "terms": [...]}  # 任一词匹配
            - {"type": "not", "term": "word"}  # 排除该词
            - {"type": "phrase", "text": "exact phrase"}  # 短语精确匹配

    Returns:
        FTS5 查询字符串
    """
    qtype = query_tokens.get("type", "").lower()

    if qtype == "and":
        terms = query_tokens.get("terms", [])
        exclude = query_tokens.get("exclude", [])
        parts = list(terms)
        for ex in exclude:
            parts.append(f"-{ex}")
        return " ".join(parts)

    elif qtype == "or":
        terms = query_tokens.get("terms", [])
        return " OR ".join(terms)

    elif qtype == "not":
        term = query_tokens.get("term", "")
        return f"-{term}"

    elif qtype == "phrase":
        text = query_tokens.get("text", "")
        return f'"{text}"'

    else:
        raise ValueError(f"Unknown query type: {qtype}")


def _build_hierarchy_path(node: dict, doc_nodes_map: dict[str, list[dict]], doc_title: str) -> str:
    """构建节点在文档树中的层级路径。"""
    node_title = node.get("title", "")
    node_line_start = node.get("line_start")

    if not node_title:
        return doc_title

    all_nodes: list[dict] = []
    for nodes_list in doc_nodes_map.values():
        all_nodes.extend(nodes_list)

    if not all_nodes:
        return f"{doc_title} > {node_title}"

    candidates = []
    for n in all_nodes:
        n_title = n.get("title", "")
        n_line = n.get("line_start")
        if not n_title or n_title == node_title:
            continue
        if n_line is not None and node_line_start is not None:
            if n_line < node_line_start:
                candidates.append((n_line, n_title))

    if not candidates:
        return f"{doc_title} > {node_title}"

    candidates.sort()
    ancestors = [title for _, title in candidates[-3:]]
    parts = [doc_title] + ancestors + [node_title]
    return " > ".join(parts)


def _truncate_to_paragraphs(text: str, max_chars: int) -> str:
    """以段落为单位截断文本，不超过 max_chars。"""
    if len(text) <= max_chars:
        return text

    truncated = text[:max_chars]
    last_para = truncated.rfind("\n\n")
    if last_para > max_chars // 2:
        return truncated[:last_para].rstrip()

    last_nl = truncated.rfind("\n")
    if last_nl > max_chars // 2:
        return truncated[:last_nl].rstrip()

    return truncated.rstrip()


def _format_kb_results(
    scored_results: list[tuple],
    query_words: list[str],
    path_map: dict[str, str],
    doc_nodes_map: dict[str, list[dict]],
    doc_title_map: dict[str, str],
    max_results: int,
    max_context_chars_per_result: int = MAX_CONTEXT_CHARS_PER_RESULT,
    max_total_chars: int = MAX_TOTAL_CHARS,
) -> str:
    """格式化 FTS 搜索结果为带层次结构的文本。"""
    total_hits = len(scored_results)
    display = scored_results[:max_results]

    lines = [f"搜索到 {total_hits} 个结果："]

    total_chars = 0
    shown = 0
    truncated_count = 0

    for composite, (doc_id, node, matched, prox, fts) in display:
        node_title = node.get("title", "")
        node_text = node.get("text", "") or ""
        path = path_map.get(doc_id, "")
        doc_title = doc_title_map.get(doc_id, doc_id)
        hierarchy = _build_hierarchy_path(node, doc_nodes_map, doc_title)

        context = _truncate_to_paragraphs(node_text, max_context_chars_per_result)

        entry = (
            f"\n=== 结果 {shown + 1} [评分: {int(composite * 100)}%] ===\n"
            f"文档: {doc_title}\n"
            f"路径: {path}\n"
            f"层级: {hierarchy}\n"
            f"标题: {node_title}\n"
        )
        if context:
            entry += f"\n{context}\n"

        entry_len = len(entry)
        if total_chars + entry_len > max_total_chars:
            truncated_count = total_hits - shown
            break

        lines.append(entry)
        total_chars += entry_len
        shown += 1

    if truncated_count > 0:
        lines.append(f"\n（还有 {truncated_count} 个结果被截断，可用 max_results 参数获取更多）")

    return "\n".join(lines)


def _format_ripgrep_results(
    results: list[tuple],
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int,
    max_context_chars_per_result: int = MAX_CONTEXT_CHARS_PER_RESULT,
) -> str:
    """格式化 ripgrep 降级搜索结果。"""
    display = results[:max_results]
    lines = [f"搜索到 {len(results)} 个结果 (ripgrep 降级)："]

    for i, (doc_id, node, matched, prox, fts) in enumerate(display, 1):
        node_title = node.get("title", "")
        node_text = node.get("text", "") or ""
        path = path_map.get(doc_id, "")

        context = _truncate_to_paragraphs(node_text, max_context_chars_per_result)

        entry = (
            f"\n=== 结果 {i} [匹配: {matched}/{len(query_words)} 词] ===\n"
            f"路径: {path}\n"
            f"标题: {node_title}\n"
        )
        if context:
            entry += f"\n{context}\n"
        lines.append(entry)

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 索引管理辅助函数
# ---------------------------------------------------------------------------

def _kb_stats(idx_manager: IndexManager) -> str:
    """生成知识库统计信息。"""
    if idx_manager.ts is None:
        idx_manager.load_or_build_index()

    if idx_manager.ts is None:
        return "知识库索引未就绪。请用 manage_kb(action='reindex') 构建索引。"

    from cortex.index_manager import SUPPORTED_FORMATS

    docs = idx_manager.documents
    total_files = len(docs)
    total_size = 0
    file_type_counts: dict[str, int] = {}

    for doc in docs:
        if hasattr(doc, 'metadata') and doc.metadata:
            size = doc.metadata.get('file_size', 0)
            total_size += size
            source_path = doc.metadata.get('source_path', '')
            ext = os.path.splitext(source_path)[1].lower() if source_path else ''
            if ext:
                file_type_counts[ext] = file_type_counts.get(ext, 0) + 1

    index_abs = os.path.abspath(idx_manager.index_path)
    index_size = os.path.getsize(index_abs) if os.path.exists(index_abs) else 0

    def fmt_size(s):
        if s >= 1024 * 1024:
            return f"{s / (1024*1024):.2f} MB"
        elif s >= 1024:
            return f"{s / 1024:.2f} KB"
        return f"{s} B"

    type_lines = []
    for ext, count in sorted(file_type_counts.items(), key=lambda x: -x[1])[:10]:
        type_name = SUPPORTED_FORMATS.get(ext, (ext, None))[0] if ext in SUPPORTED_FORMATS else ext
        type_lines.append(f"  {ext}: {count} 个 ({type_name})")

    return (
        f"知识库状态:\n"
        f"  索引路径: {index_abs}\n"
        f"  索引大小: {fmt_size(index_size)}\n"
        f"  已索引文档: {total_files} 个\n"
        f"  文件总大小: {fmt_size(total_size)}\n"
        f"  文件类型:\n"
        + "\n".join(type_lines)
    )


def _kb_reindex(idx_manager: IndexManager, force: bool = False) -> str:
    """重建知识库索引。"""
    if force:
        index_abs = os.path.abspath(idx_manager.index_path)
        idx_manager._ts = None
        idx_manager._path_map = {}
        # 删除索引文件及 WAL/SHM 文件（带重试，兼容 Windows 文件锁）
        for suffix in ("", "-wal", "-shm"):
            p = index_abs + suffix
            for attempt in range(3):
                try:
                    if os.path.exists(p):
                        os.remove(p)
                    break
                except PermissionError:
                    import time
                    time.sleep(0.3 * (attempt + 1))
                    import gc; gc.collect()

    idx_manager.reindex(force=force)

    docs = idx_manager.documents
    total = len(docs)

    return (
        f"索引重建完成 (mode={'全量' if force else '增量'}):\n"
        f"  总文档数: {total} 个\n"
        f"  搜索路径: {idx_manager.search_path}\n"
        f"  索引路径: {os.path.abspath(idx_manager.index_path)}"
    )


# ---------------------------------------------------------------------------
# 文档阅读辅助函数
# ---------------------------------------------------------------------------

def _resolve_doc_path(path: str, workdir: Path, idx_manager: IndexManager) -> Optional[str]:
    """解析文档路径为绝对路径。"""
    if os.path.isabs(path) and os.path.exists(path):
        return path

    candidate = os.path.join(str(workdir), path)
    if os.path.exists(candidate):
        return os.path.abspath(candidate)

    for key, mapped_path in idx_manager.path_map.items():
        if key == path or mapped_path == path or mapped_path.endswith(path):
            if os.path.exists(mapped_path):
                return mapped_path
            candidate = os.path.join(str(workdir), mapped_path)
            if os.path.exists(candidate):
                return os.path.abspath(candidate)

    if os.path.exists(path):
        return os.path.abspath(path)

    return None


def _get_or_create_event_loop() -> asyncio.AbstractEventLoop:
    """获取或创建事件循环。"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop


def _parse_document(file_path: str, ext: str) -> Optional[dict]:
    """使用 treesearch ParserRegistry 解析文档。

    解析器返回格式为 {doc_name, structure: [Node...], source_path}。
    我们将其标准化为 {title, text, nodes} 格式：
    - structure 中的节点 → nodes（递归转换字段名）
    - summary 字段 → text
    - prefix_summary 字段 → text（根节点）
    """
    from treesearch.parsers.registry import get_parser

    parser_fn = get_parser(ext)
    if parser_fn is None:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            text = f.read()
        return {"title": os.path.basename(file_path), "text": text, "nodes": []}

    loop = _get_or_create_event_loop()
    raw = loop.run_until_complete(parser_fn(file_path))

    # 标准化解析器输出
    title = raw.get("doc_name", os.path.basename(file_path))
    structure = raw.get("structure", [])
    nodes = _normalize_nodes(structure)
    return {"title": title, "text": "", "nodes": nodes}


def _normalize_nodes(nodes: list[dict]) -> list[dict]:
    """将解析器节点递归标准化为统一的 {title, text, line_start, line_end, nodes} 格式。"""
    result = []
    for node in nodes:
        title = node.get("title", "")
        # 正文内容优先用 summary，回退到 prefix_summary
        text = node.get("summary", "") or node.get("prefix_summary", "") or node.get("text", "") or ""
        line_start = node.get("line_start", 0)
        line_end = node.get("line_end", 0)
        children = node.get("nodes", [])
        normalized = {
            "title": title,
            "text": text,
            "line_start": line_start,
            "line_end": line_end,
            "nodes": _normalize_nodes(children),
        }
        result.append(normalized)
    return result


def _build_toc(nodes: list[dict], indent: int = 0) -> list[str]:
    """从节点列表生成目录结构。"""
    lines = []
    for node in nodes:
        title = node.get("title", "")
        if title:
            lines.append(f"{'  ' * indent}- {title}")
        children = node.get("nodes", [])
        if children:
            lines.extend(_build_toc(children, indent + 1))
    return lines


def _collect_all_text(nodes: list[dict]) -> list[tuple[str, str, int, int]]:
    """递归收集所有节点的 (title, text, line_start, line_end)。"""
    results = []
    for node in nodes:
        title = node.get("title", "")
        text = node.get("text", "") or ""
        line_start = node.get("line_start") or 0
        line_end = node.get("line_end") or 0
        if text.strip():
            results.append((title, text, line_start, line_end))
        children = node.get("nodes", [])
        if children:
            results.extend(_collect_all_text(children))
    return results


def _find_section_text(
    nodes: list[dict],
    section: str,
) -> Optional[tuple[str, str, str]]:
    """在节点树中查找匹配章节的内容。

    优先返回最深（最具体）的匹配节点，避免宽泛的父节点先被选中。
    """
    section_lower = section.lower()
    matches: list[tuple[str, str, list[str]]] = []

    queue = [(nodes, [])]
    while queue:
        current_nodes, path = queue.pop(0)
        for node in current_nodes:
            title = node.get("title", "")
            children = node.get("nodes", [])
            current_path = path + [title] if title else path

            if title and section_lower in title.lower():
                text = node.get("text", "") or ""

                def _collect_all_text(n, root_text=text):
                    parts = [root_text] if root_text else []
                    for child in n.get("nodes", []):
                        child_text = child.get("text", "") or ""
                        if child_text:
                            parts.append(child_text)
                        parts.extend(_collect_all_text(child))
                    return parts

                all_texts = _collect_all_text(node)
                combined_text = "\n\n".join(all_texts)
                matches.append((title, combined_text, current_path))

            if children:
                queue.append((children, current_path))

    if not matches:
        return None

    # 排序优先级：
    # 1. 路径深度（最深优先，即最具体的节点）
    # 2. 标题与 section 的相似度（标题越短且包含 section，越精确）
    #    用 len(section) / len(title) 衡量：section 占标题比例越高越精确
    def _match_score(m):
        path_depth = len(m[2])
        title_lower = m[0].lower()
        ratio = len(section_lower) / max(len(title_lower), 1)
        return (path_depth, ratio)

    best = max(matches, key=_match_score)
    hierarchy = " > ".join(best[2])
    return (best[0], best[1], hierarchy)


def _format_document_output(
    tree: dict,
    path: str,
    abs_path: str,
    ext: str,
    file_size: int,
    start_line: Optional[int],
    end_line: Optional[int],
    section: Optional[str],
    max_read_chars: int = MAX_READ_CHARS,
) -> str:
    """格式化文档内容输出。"""
    def fmt_size(s):
        if s >= 1024 * 1024:
            return f"{s / (1024*1024):.2f} MB"
        elif s >= 1024:
            return f"{s / 1024:.2f} KB"
        return f"{s} B"

    doc_title = tree.get("title", os.path.basename(path))
    nodes = tree.get("nodes", [])

    header = f"文档: {path}\n格式: {ext} ({fmt_size(file_size)})\n"

    toc_lines = _build_toc(nodes)
    if toc_lines:
        header += f"\n## 目录结构\n" + "\n".join(toc_lines) + "\n"

    if section:
        match = _find_section_text(nodes, section)
        if match:
            matched_title, matched_text, hierarchy = match
            content = _truncate_to_paragraphs(matched_text, max_read_chars)
            content_header = f"\n## 内容（{hierarchy}）\n"
            output = header + content_header + "\n" + content
            if len(matched_text) > max_read_chars:
                output += f"\n\n（内容已截断。使用 start_line/end_line 读取后续内容。）"
            return output

    all_text_parts = _collect_all_text(nodes)

    if not all_text_parts:
        root_text = tree.get("text", "")
        if root_text:
            content = _truncate_to_paragraphs(root_text, max_read_chars)
            output = header + f"\n## 内容\n\n" + content
            if len(root_text) > max_read_chars:
                output += "\n\n（内容已截断。使用 start_line/end_line 读取后续内容。）"
            return output
        return header + "\n（文档内容为空）"

    if start_line is not None or end_line is not None:
        filtered = []
        for title, text, ls, le in all_text_parts:
            if end_line is not None and ls > end_line:
                continue
            if start_line is not None and le < start_line:
                continue
            filtered.append((title, text, ls, le))
        all_text_parts = filtered

    content_parts = []
    total_chars = 0
    for title, text, ls, le in all_text_parts:
        if title:
            part = f"### {title}\n\n{text}"
        else:
            part = text

        if total_chars + len(part) > max_read_chars:
            remaining = max_read_chars - total_chars
            if remaining > 200:
                content_parts.append(_truncate_to_paragraphs(part, remaining))
            break
        content_parts.append(part)
        total_chars += len(part)

    if not content_parts:
        return header + "\n（指定范围内无内容）"

    content = "\n\n".join(content_parts)
    line_info = ""
    if start_line is not None or end_line is not None:
        line_info = f" [第 {start_line or '?'}-{end_line or '?'} 行]"

    output = header + f"\n## 内容{line_info}\n\n" + content

    total_text_len = sum(len(t) for _, t, _, _ in all_text_parts)
    if total_text_len > max_read_chars:
        output += "\n\n（内容已截断。使用 start_line/end_line 或 section 参数读取后续内容。）"

    return output


# ---------------------------------------------------------------------------
# 处理函数
# ---------------------------------------------------------------------------

def _handle_search_kb(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    query: str,
    max_results: Optional[int] = None,
) -> str:
    """搜索知识库，返回带层次结构的格式化结果。"""
    if max_results is None:
        max_results = idx_manager.max_results

    if idx_manager.ts is None:
        idx_manager.load_or_build_index()

    if idx_manager.ts is None or not idx_manager.documents:
        return (
            "知识库索引未就绪或为空。\n"
            "请用 manage_kb(action='reindex') 构建索引，"
            "或确认知识库路径下有文件。"
        )

    from cortex.scoring import tokenize_query, calc_proximity_score, compute_composite_score
    from cortex import ripgrep as rg_module

    nodes, docs = idx_manager.search(query, max_results=max_results)
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]

    if not nodes:
        filtered = rg_module.rg_fallback_search(
            query, idx_manager.path_map, {}, query_words,
            context_before=idx_manager.rg_context_before, context_after=idx_manager.rg_context_after,
        )
        if not filtered:
            return (
                f"未找到包含 '{query}' 的结果。\n"
                "建议：\n"
                "1. 尝试不同的关键词\n"
                "2. 用 manage_kb(action='reindex') 重建索引\n"
                "3. 用 bash grep 搜索文件名或内容"
            )
        return _format_ripgrep_results(filtered, query_words, idx_manager.path_map, max_results)

    doc_nodes_map: dict[str, list[dict]] = {}
    doc_title_map: dict[str, str] = {}
    for doc in docs:
        doc_id = doc.get("doc_id", "")
        doc_name = doc.get("doc_name", doc_id)
        doc_title_map[doc_id] = doc_name
        doc_nodes_map[doc_id] = list(doc.get("nodes", []))

    doc_best: dict[str, tuple] = {}
    doc_fts_best: dict[str, float] = {}
    for node in nodes:
        doc_id = node.get("doc_id", "")
        score = node.get("score", 0.0)
        if doc_id not in doc_fts_best or score > doc_fts_best[doc_id]:
            doc_fts_best[doc_id] = score
        if doc_id in doc_best:
            continue
        all_nodes = doc_nodes_map.get(doc_id, [])
        best_node = None
        best_count = 0
        best_proximity = 0
        for n in all_nodes:
            n_text = n.get("text", "") or ""
            cnt, proximity = calc_proximity_score(n_text, query_words, max_span=idx_manager.max_span)
            if proximity > best_proximity or (proximity == best_proximity and cnt > best_count):
                best_count = cnt
                best_proximity = proximity
                best_node = n
        if best_node and best_count > 0:
            doc_best[doc_id] = (best_node, best_count, best_proximity, doc_fts_best.get(doc_id, 0.0))

    filtered = [
        (did, bn, cnt, prox, fts)
        for did, (bn, cnt, prox, fts) in doc_best.items()
        if cnt >= idx_manager.min_keyword_match and prox >= idx_manager.min_proximity_score
    ]
    if not filtered and query_words:
        filtered = [
            (did, bn, cnt, prox, fts)
            for did, (bn, cnt, prox, fts) in doc_best.items()
            if cnt >= 1
        ]
    if not filtered:
        filtered = rg_module.rg_fallback_search(
            query, idx_manager.path_map, doc_nodes_map, query_words,
            context_before=idx_manager.rg_context_before, context_after=idx_manager.rg_context_after,
        )

    if not filtered:
        return f"未找到包含 '{query}' 的结果。请尝试不同的关键词或重建索引。"

    scored_results = []
    for item in filtered:
        did, display_node, matched, prox, fts = item
        composite, _ = compute_composite_score(
            matched_count=matched,
            total_keywords=len(query_words),
            doc_name=did,
            node_title=display_node.get("title", ""),
            fts_score=fts,
            query_words=query_words,
            weights=idx_manager.scoring_weights,
        )
        scored_results.append((composite, item))
    scored_results.sort(key=lambda x: -x[0])

    return _format_kb_results(
        scored_results, query_words, idx_manager.path_map, doc_nodes_map, doc_title_map, max_results,
        max_context_chars_per_result=idx_manager.max_context_chars_per_result,
        max_total_chars=idx_manager.max_total_chars,
    )


def _handle_search_kb_v2(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    query_tokens: dict,
    max_results: Optional[int] = None,
) -> str:
    """使用结构化查询搜索知识库。

    Args:
        query_tokens: 结构化查询字典
            - {"type": "and", "terms": [...], "exclude": [...]}  # 所有词匹配，可选排除
            - {"type": "or", "terms": [...]}  # 任一词匹配
            - {"type": "not", "term": "word"}  # 排除该词
            - {"type": "phrase", "text": "exact phrase"}  # 短语精确匹配
        max_results: 最大结果数

    Returns:
        带层次结构的格式化搜索结果
    """
    qtype = query_tokens.get("type", "").lower()
    if qtype not in ("and", "or", "not", "phrase"):
        raise ValueError(f"Unknown query type: {qtype}")

    if max_results is None:
        max_results = idx_manager.max_results

    if idx_manager.ts is None:
        idx_manager.load_or_build_index()

    if idx_manager.ts is None or not idx_manager.documents:
        return (
            "知识库索引未就绪或为空。\n"
            "请用 manage_kb(action='reindex') 构建索引，"
            "或确认知识库路径下有文件。"
        )

    from cortex.scoring import calc_proximity_score, compute_composite_score
    from cortex import ripgrep as rg_module

    # 解析结构化查询为 FTS5 语法
    try:
        fts_query = _build_fts5_query(query_tokens)
    except ValueError as e:
        return f"无效的查询结构: {e}"

    # 提取关键词用于 proximity 评分
    query_words = _extract_keywords(query_tokens)

    # 执行 FTS5 搜索
    nodes, docs = idx_manager.search(fts_query, max_results=max_results)

    if not nodes:
        # 降级到 ripgrep
        filtered = rg_module.rg_fallback_search(
            fts_query, idx_manager.path_map, {}, query_words,
            context_before=idx_manager.rg_context_before, context_after=idx_manager.rg_context_after,
        )
        if not filtered:
            return (
                f"未找到包含 '{fts_query}' 的结果。\n"
                "建议：\n"
                "1. 尝试不同的关键词\n"
                "2. 用 manage_kb(action='reindex') 重建索引\n"
                "3. 用 bash grep 搜索文件名或内容"
            )
        return _format_ripgrep_results(filtered, query_words, idx_manager.path_map, max_results)

    doc_nodes_map: dict[str, list[dict]] = {}
    doc_title_map: dict[str, str] = {}
    for doc in docs:
        doc_id = doc.get("doc_id", "")
        doc_name = doc.get("doc_name", doc_id)
        doc_title_map[doc_id] = doc_name
        doc_nodes_map[doc_id] = list(doc.get("nodes", []))

    doc_best: dict[str, tuple] = {}
    doc_fts_best: dict[str, float] = {}
    for node in nodes:
        doc_id = node.get("doc_id", "")
        score = node.get("score", 0.0)
        if doc_id not in doc_fts_best or score > doc_fts_best[doc_id]:
            doc_fts_best[doc_id] = score
        if doc_id in doc_best:
            continue
        all_nodes = doc_nodes_map.get(doc_id, [])
        best_node = None
        best_count = 0
        best_proximity = 0
        for n in all_nodes:
            n_text = n.get("text", "") or ""
            cnt, proximity = calc_proximity_score(n_text, query_words, max_span=idx_manager.max_span)
            if proximity > best_proximity or (proximity == best_proximity and cnt > best_count):
                best_count = cnt
                best_proximity = proximity
                best_node = n
        if best_node and best_count > 0:
            doc_best[doc_id] = (best_node, best_count, best_proximity, doc_fts_best.get(doc_id, 0.0))

    filtered = [
        (did, bn, cnt, prox, fts)
        for did, (bn, cnt, prox, fts) in doc_best.items()
        if cnt >= idx_manager.min_keyword_match and prox >= idx_manager.min_proximity_score
    ]
    if not filtered and query_words:
        filtered = [
            (did, bn, cnt, prox, fts)
            for did, (bn, cnt, prox, fts) in doc_best.items()
            if cnt >= 1
        ]
    if not filtered:
        filtered = rg_module.rg_fallback_search(
            fts_query, idx_manager.path_map, doc_nodes_map, query_words,
            context_before=idx_manager.rg_context_before, context_after=idx_manager.rg_context_after,
        )

    if not filtered:
        return f"未找到包含 '{fts_query}' 的结果。请尝试不同的关键词或重建索引。"

    scored_results = []
    for item in filtered:
        did, display_node, matched, prox, fts = item
        composite, _ = compute_composite_score(
            matched_count=matched,
            total_keywords=len(query_words),
            doc_name=did,
            node_title=display_node.get("title", ""),
            fts_score=fts,
            query_words=query_words,
            weights=idx_manager.scoring_weights,
        )
        scored_results.append((composite, item))
    scored_results.sort(key=lambda x: -x[0])

    return _format_kb_results(
        scored_results, query_words, idx_manager.path_map, doc_nodes_map, doc_title_map, max_results,
        max_context_chars_per_result=idx_manager.max_context_chars_per_result,
        max_total_chars=idx_manager.max_total_chars,
    )


def _extract_keywords(query_tokens: dict) -> list[str]:
    """从结构化查询中提取所有关键词用于 proximity 评分。

    Args:
        query_tokens: 结构化查询字典

    Returns:
        关键词列表
    """
    qtype = query_tokens.get("type", "").lower()
    keywords = []

    if qtype == "and":
        keywords.extend(query_tokens.get("terms", []))
        # exclude 关键词不参与 proximity 评分
    elif qtype == "or":
        keywords.extend(query_tokens.get("terms", []))
    elif qtype == "not":
        term = query_tokens.get("term", "")
        if term:
            keywords.append(term)
    elif qtype == "phrase":
        text = query_tokens.get("text", "")
        if text:
            keywords.append(text)

    return keywords


def _handle_manage_kb(
    idx_manager: IndexManager,
    *,
    action: str,
    force: bool = False,
) -> str:
    """管理知识库索引。"""
    if action == "stats":
        return _kb_stats(idx_manager)
    elif action == "reindex":
        return _kb_reindex(idx_manager, force=force)
    else:
        return f"未知操作: {action}。支持的操作: reindex, stats"


def _handle_read_document(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    path: str,
    start_line: Optional[int] = None,
    end_line: Optional[int] = None,
    section: Optional[str] = None,
) -> str:
    """读取知识库文档内容，支持多种文件格式。"""
    abs_path = _resolve_doc_path(path, workdir, idx_manager)
    if not abs_path or not os.path.exists(abs_path):
        return f"文档不存在: {path}。请确认路径是否正确。"

    ext = os.path.splitext(abs_path)[1].lower()

    try:
        tree = _parse_document(abs_path, ext)
    except ImportError as e:
        return (
            f"文档解析失败: 缺少依赖 {e}。\n"
            f"请安装对应的解析库后重试。"
        )
    except Exception as e:
        return (
            f"文档解析失败: {e}。\n"
            f"如果是文本文件，可以尝试用 read_file 以纯文本模式读取。"
        )

    if not tree:
        return f"文档解析结果为空: {path}"

    file_size = os.path.getsize(abs_path)
    return _format_document_output(
        tree=tree,
        path=path,
        abs_path=abs_path,
        ext=ext,
        file_size=file_size,
        start_line=start_line,
        end_line=end_line,
        section=section,
        max_read_chars=idx_manager.max_read_chars,
    )
