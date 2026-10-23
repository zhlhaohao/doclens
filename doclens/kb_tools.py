"""知识库工具定义和处理器

为 AI Agent 提供知识库搜索、索引管理和文档阅读能力。
"""

import logging

logger = logging.getLogger(__name__)

import asyncio
import os
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional, Tuple

from doclens.index_manager import IndexManager
from doclens.search_targets import (
    SEARCH_PATHS_PROPERTY,
    format_missed_note,
    resolve_search_targets,
)

# 词切分器与 planify.read_file 共用（单一真相源：两工具的词序号语义必须一致）
from planify.tools.basic import split_words_with_seps

if TYPE_CHECKING:
    from planify.skills.access_state import SkillAccessState


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
            "paths": SEARCH_PATHS_PROPERTY,
        },
        "required": ["query"],
    },
}

MANAGE_KB_TOOL = {
    "name": "manage_kb",
    "description": (
        "管理知识库索引。支持 reindex（重建索引）和 stats（查看统计）两种操作。"
        "reindex 用于索引损坏或语料更新后重建，非常规检索重试手段。"
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

FILE_INFO_TOOL = {
    "name": "file_info",
    "description": (
        "获取单个文件的概况信息（大小、总词数、章节数、章节清单、修改时间、是否已索引），"
        "不返回正文内容。在 read_document 之前调用，用于判断文件规模、"
        "选择要读取的章节（section）或词区间（start_word/end_word），避免盲目读取浪费 token。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "path": {
                "type": "string",
                "description": "文档路径（相对知识库根目录，从搜索结果中获取）",
            },
        },
        "required": ["path"],
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
            "section": {
                "type": "string",
                "description": (
                    "单个章节标题，用于读取该章节及其子章节内容（可选，优先于行号）。"
                    "只传入目标章节自身的标题文本，不要拼接上级章节路径。"
                    "正确: '3.4.2. 变更流程'，错误: '第三章研发项目实施 > 3.4.2. 变更流程'。"
                    "传入较大章节可获得更宽泛的内容，传入较小章节可获得更精确的内容。"
                ),
            },
            "start_word": {
                "type": "integer",
                "description": (
                    "起始词序号（可选，1-based，与 end_word 配合按词读取；被 section 覆盖）。"
                    "词的定义：中日韩文字每字算一词，其余按空白切分（英文单词/数字各算一词）。"
                    "内容被截断时用于续读后续部分。"
                ),
            },
            "end_word": {
                "type": "integer",
                "description": (
                    "结束词序号（可选，1-based，含该词；被 section 覆盖）。"
                ),
            },
        },
        "required": ["path"],
    },
}


# ---------------------------------------------------------------------------
# 格式化常量（默认值，运行时从 idx_manager 配置读取）
# ---------------------------------------------------------------------------

MAX_CONTEXT_CHARS_PER_RESULT = (200 + 600) * 8
MAX_TOTAL_CHARS = 10000
# 字符兜底默认与词窗口同量级（(200+600)×8）：旧 800 在英文语料下比词预算
# （800 词 ≈ 4500 字符）紧 5-6 倍，词窗口从未真正生效——小文档也出略标记
# 窗口不在开头时补文档开头（标题/表头）的字符预算——独立于词窗口参数
# （旧实现 min(200, before) 的 before 现为词单位，语义分离）
_HEAD_BUDGET_CHARS = 200
MAX_READ_WORDS = 4000


# ---------------------------------------------------------------------------
# 公共入口
# ---------------------------------------------------------------------------

def build_kb_tools(
    idx_manager: IndexManager,
    workdir: Path,
    skill_state: Optional["SkillAccessState"] = None,
) -> Tuple[List[Dict], Dict[str, Callable]]:
    """构建知识库工具定义和处理器。

    Args:
        idx_manager: 已初始化的 IndexManager 实例
        workdir: 工作目录（知识库搜索路径）
        skill_state: 可选，技能加载状态（历史参数，KB 门禁删除后仅占位）。

    Returns:
        (tools, handlers) 元组
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
                "paths": SEARCH_PATHS_PROPERTY,
            },
            "required": ["query"],
        },
    }

    raw_handlers = {
        "search_kb": lambda **kw: handle_search_kb(idx_manager, workdir, **kw),
        "manage_kb": lambda **kw: handle_manage_kb(idx_manager, **kw),
        "read_document": lambda **kw: handle_read_document(idx_manager, workdir, **kw),
        "file_info": lambda **kw: handle_file_info(idx_manager, workdir, **kw),
    }

    handlers = raw_handlers

    return [search_kb_schema, MANAGE_KB_TOOL, READ_DOCUMENT_TOOL, FILE_INFO_TOOL], handlers


# ---------------------------------------------------------------------------
# 搜索辅助函数
# ---------------------------------------------------------------------------

def _build_hierarchy_path(node: dict, doc_id: str, doc_nodes_map: dict[str, list[dict]], doc_title: str) -> str:
    """构建节点在文档树中的层级路径。通过遍历文档节点树找到目标节点的真实路径。"""
    node_title = node.get("title", "")
    node_line_start = node.get("line_start")

    if not node_title:
        return doc_title

    root_nodes = doc_nodes_map.get(doc_id, [])
    if not root_nodes:
        return f"{doc_title} > {node_title}"

    # 在文档树中 DFS 查找目标节点，收集从根到目标的路径
    path = _find_node_in_tree(root_nodes, node_title, node_line_start)
    if not path:
        return f"{doc_title} > {node_title}"

    # 如果路径第一段与 doc_title 相同则去掉，避免重复
    if path[0] == doc_title:
        path = path[1:]

    if not path:
        return doc_title

    return doc_title + " > " + " > ".join(path)


def _find_node_in_tree(nodes: list[dict], target_title: str, target_line_start) -> list[str] | None:
    """在节点树中 DFS 查找目标节点，返回从当前层到目标的标题路径。"""
    for node in nodes:
        title = node.get("title", "")
        line_start = node.get("line_start")

        # 匹配：标题相同且行号相同（行号均可用时比较行号）
        if title and title == target_title:
            if target_line_start is None or line_start == target_line_start:
                return [title]

        # 搜索子节点
        children = node.get("nodes", [])
        if children:
            child_path = _find_node_in_tree(children, target_title, target_line_start)
            if child_path is not None:
                return ([title] if title else []) + child_path

    return None


def _bump_heading_levels(text: str, levels: int) -> str:
    """将 markdown 文本中的标题层级提升指定级数（# → ### 等）。"""
    lines = text.split("\n")
    result = []
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith("#"):
            # 计算 # 的数量
            count = 0
            while count < len(stripped) and stripped[count] == "#":
                count += 1
            if count < 6:
                indent = line[:len(line) - len(stripped)]
                result.append(indent + "#" * levels + stripped)
            else:
                result.append(line)
        else:
            result.append(line)
    return "\n".join(result)


def _extract_keyword_window(
    text: str,
    query_words: list[str],
    before: int,
    after: int,
    max_chars: int | None = None,
) -> str:
    """从超长文本中截取统一锚点窗口：前 *before* 词 + 锚点 + 后 *after* 词。

    大表格/长名单类文档常只有一个巨型节点：固定取开头会漏掉中部、尾部的
    命中内容（LLM 看不到 → 误判"找不到资料"）。改为在命中密度最高的位置
    开窗口；窗口外内容以省略标记提示。无命中时回退为按词预算的开头截断。

    与 grep 的 _regex_led_snippet 同口径（统一窗口模型，词单位：CJK 每
    字一词，其余按空白切分——与 read_document/max_read_words 同源）。
    max_chars 为总预算的**字符兜底**（保险丝，窗口总宽不超过它）；
    None 时无字符兜底（纯词窗口）。
    """
    from doclens.word_window import WORD_CHAR_CEILING, end_after_words, start_before_words

    # 短文早退：两个口径（字符兜底/当量词预算）都富余才整篇返回——只看
    # max_chars 会让词窗口在小文本上失效（max_chars 升到词口径后，
    # 2000 字中文文本 ≤6400 但 >150 当量词，旧早退会绕过 50/100 词窗口）
    from doclens.word_window import count_equivalence_words

    ew = count_equivalence_words(text)
    if max_chars is not None and len(text) <= max_chars and ew <= before + after:
        return text
    if max_chars is None and ew <= before + after:
        return text

    # 收集所有关键词命中位置（大小写不敏感）
    hits: list[int] = []
    lowered = text.lower()
    for w in query_words:
        if not w:
            continue
        start = 0
        wl = w.lower()
        while True:
            idx = lowered.find(wl, start)
            if idx < 0:
                break
            hits.append(idx)
            start = idx + len(wl)

    if not hits:
        truncated, _cut = _truncate_to_word_budget(text, before + after)
        return truncated

    # 以"窗口内命中数最多"选锚点：把窗口左缘对齐到尽量靠前的命中，
    # 使窗口覆盖尽可能多的后续命中（滑窗取最优，命中位置数通常不多）。
    # 滑窗宽度用字符兜底口径（词窗口宽度依内容而变，无固定宽度可滑）
    slide_width = max_chars if max_chars is not None else (before + after) * WORD_CHAR_CEILING
    hits.sort()
    best_start = hits[0]
    best_count = -1
    for h in hits:
        count = 0
        limit = h + slide_width
        for p in hits:
            if p < h:
                continue
            if p > limit:
                break
            count += 1
        if count > best_count:
            best_count = count
            best_start = h

    # 窗口向锚点前回退上下文（表头/上文更有用）：词单位换算，字符兜底
    # 时夹回 max_chars 的一半（保持旧保险丝语义）
    win_start = start_before_words(text, best_start, before)
    if max_chars is not None and best_start - win_start > max_chars // 2:
        # clamp 时对齐到词边界，且不越过 0——否则窗口可能从单词中间
        # 开始（半词残留），旧版还有负值边界（best_start < max_chars//2 时）
        clamped = start_before_words(text, best_start - max_chars // 2, 1)
        win_start = max(0, min(win_start, clamped))

    # 窗口不在开头时，预留预算补带文档开头（标题/表头），
    # 否则大表格中部/尾部的行缺列名，LLM 无法解读。
    # head 只取到 win_start 之前——excerpt 本就覆盖 [win_start, …)，
    # head 越过 win_start 会与 excerpt 开头重复（中部略标记两侧同文）
    head = ""
    if win_start > 0:
        head_raw = text[:min(_HEAD_BUDGET_CHARS, win_start)]
        nl = head_raw.rfind("\n")
        head = (head_raw[:nl] if nl > 40 else head_raw).rstrip()

    # 统一窗口：终点 = 锚点后 after 词（head 只补表头不挤占后文预算），
    # 总宽仍受字符兜底约束
    win_end = end_after_words(text, best_start, after)
    if max_chars is not None:
        win_end = min(win_end, win_start + max_chars)
    excerpt = text[win_start:win_end].rstrip()
    prefix = f"{head}\n…（中部略）\n" if head else ""
    suffix = "\n…（后文略）" if win_end < len(text) else ""
    return prefix + excerpt + suffix


def _format_kb_results(
    scored_results: list[tuple],
    query_words: list[str],
    path_map: dict[str, str],
    doc_nodes_map: dict[str, list[dict]],
    doc_title_map: dict[str, str],
    max_results: int,
    max_context_chars_per_result: int = MAX_CONTEXT_CHARS_PER_RESULT,
    max_total_chars: int = MAX_TOTAL_CHARS,
    on_miss: Optional[Callable[[str], str]] = None,
    context_before: int = 200,
    context_after: int = 600,
) -> str:
    """格式化 FTS 搜索结果为 XML 结构化文本，便于 LLM 区分元信息和原始内容。

    on_miss: path_map 未命中 doc_id 时的兜底解析（如 IndexManager.resolve_doc_path，
    应对后台重索引导致的 doc_id 漂移），None 时未命中即空 path。
    context_before/after: 统一窗口模型的锚点前/后字符数（来自 config）。
    """
    total_hits = len(scored_results)
    display = scored_results[:max_results]

    lines = [
        f"Found {total_hits} results:",
        "Use read_document tool to read full content: path=<path value>, section=<single section title only, NOT the full hierarchy path>. E.g. use '3.4.2. 变更流程' not '第三章 > 3.4.2. 变更流程'. Larger section = broader content, smaller section = more specific.",
    ]

    total_chars = 0
    shown = 0
    truncated_count = 0

    for composite, (doc_id, node, matched, prox, fts, matched_kws) in display:
        node_text = node.get("text", "") or ""
        path = path_map.get(doc_id) or (on_miss(doc_id) if on_miss else "")
        doc_title = doc_title_map.get(doc_id, doc_id)
        hierarchy = _build_hierarchy_path(node, doc_id, doc_nodes_map, doc_title)

        context = _extract_keyword_window(
            node_text, query_words, context_before, context_after,
            max_chars=max_context_chars_per_result,
        )

        entry = f'<result index="{shown + 1}" score="{int(composite * 100)}%" matches="{matched}/{len(query_words)}">\n'
        entry += "  <meta>\n"
        entry += f"    <doc>{doc_title}</doc>\n"
        entry += f"    <path>{path}</path>\n"
        entry += f"    <hierarchy>{hierarchy}</hierarchy>\n"
        if matched_kws:
            entry += "    <matched>" + " ".join(matched_kws) + "</matched>\n"
        entry += "  </meta>\n"
        if context:
            entry += f"  <content>\n{context}\n  </content>\n"
        entry += "</result>"

        entry_len = len(entry)
        if total_chars + entry_len > max_total_chars:
            truncated_count = total_hits - shown
            break

        lines.append(entry)
        total_chars += entry_len
        shown += 1

    if truncated_count > 0:
        lines.append(f"\n({truncated_count} more results truncated. Use max_results parameter to get more.)")
    elif total_hits > shown:
        lines.append(f"\n({total_hits - shown} more results truncated. Use max_results parameter to get more.)")

    return "\n".join(lines)


# ---------------------------------------------------------------------------

def _kb_stats(idx_manager: IndexManager) -> str:
    """生成知识库统计信息。"""
    if idx_manager.ts is None:
        idx_manager.load_or_build_index()

    if idx_manager.ts is None:
        return "知识库索引未就绪。请用 manage_kb(action='reindex') 构建索引。"

    from doclens.index_manager import SUPPORTED_FORMATS

    # DB 轻量查询（ADR-0018）：计数/类型分布不物化 documents
    source_paths = idx_manager.indexed_source_paths()
    total_files = len(source_paths)
    total_size = 0
    unreadable: list[str] = []
    file_type_counts: dict[str, int] = {}

    for source_path in source_paths:
        try:
            total_size += os.path.getsize(source_path) if source_path else 0
        except OSError as e:
            # AP-8：单文件 stat 失败不吞——计入不可读清单，输出如实标注
            # （否则文件总大小静默少算，统计失真无提示）。
            unreadable.append(source_path or "(空路径)")
            logger.warning("kb_stats: getsize failed for %s: %s", source_path, e)
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

    stats = (
        f"知识库状态:\n"
        f"  索引路径: {index_abs}\n"
        f"  索引大小: {fmt_size(index_size)}\n"
        f"  已索引文档: {total_files} 个\n"
        f"  文件总大小: {fmt_size(total_size)}\n"
        f"  文件类型:\n"
        + "\n".join(type_lines)
    )
    if unreadable:
        stats += (
            f"\n  （警告: {len(unreadable)} 个文件大小不可读（权限/占用/已移除），"
            f"文件总大小为部分统计，如 {unreadable[0]}）"
        )
    return stats


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

    total = idx_manager.indexed_doc_count()

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


def _run_async_parser(parser_fn, file_path: str) -> dict:
    """在同步 handler 中驱动异步解析器（AP-7）。

    treesearch 的解析器全是 async def，而 kb_tools 的 handler 是同步函数。
    官方姿势是 asyncio.run()：每次干净起停事件循环，不留泄漏——旧实现
    ``get_event_loop() + run_until_complete`` 建的循环从不 close()（每次
    泄漏一个 selector/fd，同 agent_integration AP-51 的教训），且
    ``get_event_loop`` 在无运行循环线程里 3.12+ 弃用、3.14 报错。

    调用方契约：本函数不得在已运行的事件循环线程内调用（asyncio.run
    会 RuntimeError）。现有消费方均安全——planify StreamingAgent 对同步
    handler 统一经 ``asyncio.to_thread`` 在线程池执行（无 running loop），
    CLI/MCP 入口为纯同步上下文。
    """
    return asyncio.run(parser_fn(file_path))


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

    raw = _run_async_parser(parser_fn, file_path)

    # 标准化解析器输出
    title = raw.get("doc_name", os.path.basename(file_path))
    structure = raw.get("structure", [])
    nodes = _normalize_nodes(structure)
    return {"title": title, "text": "", "nodes": nodes}


def _normalize_nodes_text_first(nodes: list[dict]) -> list[dict]:
    """同 _normalize_nodes，但正文优先取完整 text（索引中的图像文档节点
    同时带 summary（≤600 字截断版）与 text（完整版），read_document 要完整内容）。"""
    result = []
    for node in nodes:
        children = node.get("nodes", [])
        result.append({
            "title": node.get("title", ""),
            "text": node.get("text", "") or node.get("summary", "") or node.get("prefix_summary", "") or "",
            "line_start": node.get("line_start", 0),
            "line_end": node.get("line_end", 0),
            "nodes": _normalize_nodes_text_first(children),
        })
    return result


def _load_indexed_image_tree(idx_manager, abs_path: str) -> Optional[dict]:
    """从索引中读取图像文件的视觉解析结果（图像不能现场重解析）。

    返回与 _parse_document 相同的 {title, text, nodes} 结构；未进索引返回 None。
    占位阶段（视觉 worker 未消费）会返回占位节点文本，属如实反馈。
    DB 精确加载单个文档（ADR-0018），不迭代全量 documents。
    """
    if idx_manager.ts is None:
        idx_manager.load_or_build_index()

    doc = _load_doc_by_source_path(idx_manager, abs_path)
    if doc is not None:
        return {
            "title": doc.doc_name,
            "text": "",
            "nodes": _normalize_nodes_text_first(doc.structure or []),
        }
    return None


# ---------------------------------------------------------------------------
# 索引读失败语义（AP-8 / AP-45 口径：DB 故障 ≠ 未入索引）
# ---------------------------------------------------------------------------


class IndexReadError(RuntimeError):
    """索引库读失败（打不开/损坏/锁死）——与「未命中返回 None」显式区分。

    旧实现把一切异常吞成 None/False：DB 损坏被伪装成「未入索引」，
    ghost 闸门静默放行、read_document 改走现场解析——路径漂移不可察觉，
    AI 据此输出「文档不存在」类幻觉结论。
    """


def _load_doc_by_source_path(idx_manager, abs_path: str):
    """按 source_path 从索引库精确加载单个 Document。

    返回契约：未命中 → None；**索引库读失败 → 上抛 IndexReadError**
    （调用方必须区分「没有」与「坏了」，不得静默降级）。
    """
    from treesearch.fts import FTS5Index

    target = os.path.abspath(abs_path)
    fts = None
    try:
        fts = FTS5Index(db_path=idx_manager.index_path)
        doc_id = fts.get_doc_id_by_source_path(target)
        if doc_id is None:
            return None
        return fts.load_document(doc_id)
    except IndexReadError:
        raise
    except Exception as e:  # noqa: BLE001
        logger.warning("load_doc_by_source_path(%s) index read failed: %s", abs_path, e)
        raise IndexReadError(str(e)) from e
    finally:
        if fts is not None:
            fts.close()


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


def _extract_intro_text(node: dict, children: list[dict]) -> str:
    """提取非叶节点自身的引导文本（去掉自标题 + 第一个子节标题之前的内容）。"""
    text = node.get("text", "") or ""
    if not text or not children:
        return ""
    # 去掉开头的自标题行（如 "## 5G网络部署现状\n"）
    title = node.get("title", "")
    if title:
        for line in text.split("\n"):
            stripped = line.strip()
            if stripped:
                # 去掉 markdown 标题符号后比较
                clean = stripped.lstrip("#").strip()
                if clean == title:
                    after_title = text[text.find(stripped) + len(stripped):].strip()
                    text = after_title
                break
    if not text:
        return ""
    # 截断到第一个子节标题
    first_title = children[0].get("title", "")
    if first_title:
        idx = text.find(first_title)
        if idx > 0:
            return text[:idx].strip()
    return text.strip()


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

                def _collect_leaf_text(n):
                    """递归收集节点文本：提取非叶节点的引导段落 + 叶子节点全文。"""
                    n_children = n.get("nodes", [])
                    if not n_children:
                        # 叶子节点：直接取 text
                        t = n.get("text", "") or ""
                        return [t] if t else []
                    # 非叶节点：提取引导段落（第一个子节标题之前的内容），再递归子节点
                    parts = []
                    own_text = _extract_intro_text(n, n_children)
                    if own_text:
                        parts.append(own_text)
                    for child in n_children:
                        parts.extend(_collect_leaf_text(child))
                    return parts

                all_texts = _collect_leaf_text(node)
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


def fmt_size(s: int) -> str:
    """文件大小人性化格式化（B/KB/MB）。"""
    if s >= 1024 * 1024:
        return f"{s / (1024*1024):.2f} MB"
    elif s >= 1024:
        return f"{s / 1024:.2f} KB"
    return f"{s} B"


def _format_document_output(
    tree: dict,
    path: str,
    abs_path: str,
    ext: str,
    file_size: int,
    start_word: Optional[int],
    end_word: Optional[int],
    section: Optional[str],
    max_read_words: int = MAX_READ_WORDS,
    show_toc: bool = False,
) -> str:
    """格式化文档内容输出。"""
    doc_title = tree.get("title", os.path.basename(path))
    nodes = tree.get("nodes", [])

    header = f"文档: {path}\n格式: {ext} ({fmt_size(file_size)})\n"

    if show_toc:
        toc_lines = _build_toc(nodes)
        if toc_lines:
            header += f"\n## 目录结构\n" + "\n".join(toc_lines) + "\n"

    if section:
        match = _find_section_text(nodes, section)
        if not match:
            return header + (
                f"\n（未找到章节: {section}。请勿臆造章节标题——"
                f"先调用 file_info(path=\"{path}\") 获取该文档的目录清单，"
                "再从清单中选择确切的 section 重试。）"
            )
        matched_title, matched_text, hierarchy = match
        display_text = _bump_heading_levels(matched_text, 2) if ext == ".pptx" else matched_text
        content, truncated = _truncate_to_word_budget(display_text, max_read_words)
        content_header = f"\n## 内容（{hierarchy}）\n"
        output = header + content_header + "\n" + content
        if truncated:
            output += (
                "\n\n（内容已截断：该章节超出单次输出上限。"
                "可用 file_info 查看其子章节清单，改用更小的 section 分段精读；"
                "或用 start_word/end_word 按全文词序号定位续读。）"
            )
        return output

    all_text_parts = _collect_all_text(nodes)

    if not all_text_parts:
        root_text = tree.get("text", "")
        if root_text:
            content, truncated = _truncate_to_word_budget(root_text, max_read_words)
            output = header + f"\n## 内容\n\n" + content
            if truncated:
                output += "\n\n（内容已截断。使用 start_word/end_word 读取后续内容。）"
            return output
        return header + "\n（文档内容为空）"

    if start_word is not None or end_word is not None:
        return _format_word_range(
            header, all_text_parts, ext, start_word, end_word, max_read_words
        )

    content_parts = []
    from doclens.word_window import count_equivalence_words as _cew

    total_words = 0.0
    for title, text, ls, le in all_text_parts:
        if title and not text.lstrip().startswith("#"):
            part = f"### {title}\n\n{text}"
        elif ext == ".pptx":
            # pptx 内容以 # 标题开头，提升 2 级（# → ###，## → ####）
            part = _bump_heading_levels(text, 2)
        else:
            part = text

        part_words = _cew(part)
        if total_words + part_words > max_read_words:
            remaining = max_read_words - total_words
            if remaining > 200:
                content_parts.append(_truncate_to_word_budget(part, remaining)[0])
            break
        content_parts.append(part)
        total_words += part_words

    if not content_parts:
        return header + "\n（指定范围内无内容）"

    content = "\n\n".join(content_parts)
    output = header + "\n## 内容\n\n" + content

    total_doc_words = sum(_cew(t) for _, t, _, _ in all_text_parts)
    if total_doc_words > max_read_words:
        output += "\n\n（内容已截断。使用 start_word/end_word 或 section 参数读取后续内容。）"

    return output


def _split_words_cjk(text: str) -> list[str]:
    """切词（仅词，不含分隔符）：委托 planify 的共享实现。"""
    return [w for w, _s in split_words_with_seps(text)]


def _truncate_to_word_budget(text: str, max_words: float) -> Tuple[str, bool]:
    """按当量词预算截断（非 CJK 词计 1，CJK 字计 0.5——1 英文词 ≈ 2 汉字），
    尽量落在段落边界。

    Returns: (截断后文本, 是否发生了截断)
    """
    from doclens.word_window import count_equivalence_words

    if count_equivalence_words(text) <= max_words:
        return text, False
    pieces = split_words_with_seps(text)
    kept = ""
    acc = 0.0
    for w, s in pieces:
        if w:
            from doclens.word_window import word_weight
            acc += word_weight(w)
            if acc > max_words:
                break
        kept += w + s
    # 优先落在段落边界，其次行边界
    last_para = kept.rfind("\n\n")
    if last_para > len(kept) // 2:
        return kept[:last_para].rstrip(), True
    last_nl = kept.rfind("\n")
    if last_nl > len(kept) // 2:
        return kept[:last_nl].rstrip(), True
    return kept.rstrip(), True


def _format_word_range(
    header: str,
    all_text_parts: list[tuple[str, str, int, int]],
    ext: str,
    start_word: Optional[int],
    end_word: Optional[int],
    max_read_words: int,
) -> str:
    """按词序号切片输出（1-based 闭区间）。

    词的定义：CJK 字符（含中文）每字一词；连续的非 CJK 字符序列按空白切分
    为一词（英文单词、数字、标点串等）。序号对同一文档稳定可复现。

    在拼接后的纯文本流上计算（不依赖节点块结构），单块文档也能精确切片。
    越界：start_word 超过总词数 → 无内容；end_word 超过 → 读到结尾。
    输出附词总数与当前位置，供 AI 续读翻页。
    """
    parts = []
    for title, text, _ls, _le in all_text_parts:
        if title and not text.lstrip().startswith("#"):
            parts.append(f"### {title}\n\n{text}")
        elif ext == ".pptx":
            parts.append(_bump_heading_levels(text, 2))
        else:
            parts.append(text)
    full_text = "\n\n".join(parts)
    words = _split_words_cjk(full_text)
    total = len(words)

    start_idx = max((start_word or 1) - 1, 0)      # 1-based → 0-based
    end_idx = end_word if end_word is not None else total  # end_word 是 1-based 含端点 = 切片上界
    end_idx = min(end_idx, total)
    if start_idx >= total or end_idx <= start_idx:
        return header + f"\n（指定范围内无内容。全文共 {total} 词，start_word 应 ≤ {total}。）"

    sliced = words[start_idx:end_idx]
    shown = sliced
    truncated = ""
    # 预算按当量词（中文 2 字计 1）：序号仍离散词，但单次读取量与
    # max_read_words 的当量词口径一致
    from doclens.word_window import word_weight

    acc = 0.0
    cut = len(sliced)
    for i, w in enumerate(sliced):
        acc += word_weight(w)
        if acc > max_read_words:
            cut = i
            break
    if cut < len(sliced):
        shown = sliced[:cut]
        truncated = (
            f"\n\n（内容已截断。使用 start_word={start_idx + len(shown) + 1} 续读后续内容。）"
        )

    first_word_no = start_idx + 1
    last_word_no = start_idx + len(shown)
    range_info = f" [第 {first_word_no}-{last_word_no} 词 / 共 {total} 词]"
    return header + f"\n## 内容{range_info}\n\n{' '.join(shown)}{truncated}"


# ---------------------------------------------------------------------------
# 处理函数
# ---------------------------------------------------------------------------

def handle_search_kb(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    query: str,
    max_results: Optional[int] = None,
    paths: Optional[List[str]] = None,
) -> str:
    """搜索知识库，返回带层次结构的格式化结果。

    paths: 可选搜索目标列表（相对目录 / 相对文件路径），只在命中的文档内搜索。
    """
    if max_results is None:
        max_results = idx_manager.max_results

    if idx_manager.ts is None:
        idx_manager.load_or_build_index()

    # AP-45：区分「空库」与「索引库不可读」——后者若报成「未收录」，
    # AI 会据此对用户宣称知识库里没有这段内容。
    availability = idx_manager.index_availability()
    if availability == "unavailable":
        return (
            "索引库不可用（无法读取索引文件，可能损坏或被占用）。\n"
            "本次检索没有执行，**不能**据此认为知识库未收录相关文档。\n"
            "请检查数据目录下的 index.db，"
            "或用 manage_kb(action='reindex', force=true) 重建。"
        )
    if idx_manager.ts is None or availability == "empty":
        return (
            "知识库索引未就绪或为空。\n"
            "请用 manage_kb(action='reindex') 构建索引，"
            "或确认知识库路径下有文件。"
        )

    # 搜索目标过滤：目录前缀 / 文件精确匹配 → 命中的文档键集合。
    # 范围限定在路由阶段 SQL 内生效（allowed_doc_ids）——范围外文档不进
    # 候选池，不存在「先截后滤丢结果」问题，候选量放大兜底已随之退役。
    allowed: Optional[set] = None
    note = ""
    if paths:
        allowed, missed = resolve_search_targets(workdir, paths, idx_manager.path_map)
        note = format_missed_note(missed)
        if not allowed:
            return note + f"所有搜索目标均未命中已索引文档（query='{query}'），未执行搜索。"

    from doclens.scoring import tokenize_query, calc_proximity_score, compute_composite_score, matched_keywords

    # 候选池 = 配置 top_k_docs（AP-47：旧 max_results 参数从未被引擎消费）；
    # `max_results` 只决定下面 _format_kb_results 显示多少条
    nodes, docs = idx_manager.search(query, allowed_doc_ids=allowed)
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]
    logger.debug("query=%r, query_words=%s, FTS nodes=%d, docs=%d", query, query_words, len(nodes), len(docs))

    if not nodes:
        return note + (
            f"未找到包含 '{query}' 的结果。\n"
            "建议换一个角度重试（同义词/上下位词/中英文）；"
            "若多角度检索均无结果，请如实告知用户未找到。"
        )

    doc_title_map: dict[str, str] = {}
    for doc in docs:
        doc_id = doc.get("doc_id", "")
        doc_name = doc.get("doc_name", doc_id)
        doc_title_map[doc_id] = doc_name

    # 嵌套树映射：用于构建层级路径（搜索结果的 nodes 是扁平列表，缺少中间层级）。
    # 仅载结果文档的树结构（ADR-0019 惰性化），不物化全量 documents。
    doc_tree_map: dict[str, list[dict]] = idx_manager.load_doc_structures(
        [d.get("doc_id", "") for d in docs]
    )

    logger.debug("max_nodes_per_doc=%d, FTS nodes=%d, docs=%d", idx_manager.max_nodes_per_doc, len(nodes), len(docs))
    # 评分融合（2026-10-19 改造）：候选直接取引擎管线已精排的 docs[].nodes
    # （每文档 top-N，携带 score_nodes_batch 的节点级 BM25+传播分 + text），
    # 宿主层只在其上做五因子综合分——不再对 doc_nodes_map 的全量节点做
    # Python 子串重扫（双重打分消除）；fts_score 因子从「文档级 max」改为
    # 「节点自身引擎分」（原实现误用文档级分数，节点间无区分度）。
    all_candidates: list[tuple] = []
    for doc in docs:
        doc_id = doc.get("doc_id", "")
        for n in doc.get("nodes", []):
            n_text = n.get("text", "") or ""
            cnt, proximity = calc_proximity_score(n_text, query_words, max_span=idx_manager.max_span)
            if cnt > 0:
                node_fts = n.get("score", 0.0)
                composite, factors = compute_composite_score(
                    matched_count=cnt,
                    total_keywords=len(query_words),
                    doc_name=doc_id,
                    node_title=n.get("title", ""),
                    fts_score=node_fts,
                    query_words=query_words,
                    weights=idx_manager.scoring_weights,
                    proximity=proximity,
                )
                all_candidates.append((doc_id, n, cnt, proximity, node_fts, composite, factors, matched_keywords(n_text, query_words)))
    _debug_lines = []
    for did, n, cnt, prox, fts, composite, factors, hits in all_candidates:
        title = n.get("title", "")[:20]
        _debug_lines.append(f"  {doc_title_map.get(did,'?')[:15]} > {title}: {composite:.0%} factors={factors}")
    logger.debug("scoring detail:\n%s", "\n".join(_debug_lines))
    logger.debug("candidates: %s", [(doc_title_map.get(d,'?')[:15], sum(1 for x in all_candidates if x[0]==d)) for d in {x[0] for x in all_candidates}])

    # Flatten + 阈值过滤
    filtered = [
        item for item in all_candidates
        if item[5] >= idx_manager.min_score_threshold
    ]
    if not filtered and query_words:
        filtered = [
            item for item in all_candidates
            if item[2] >= 1
        ]
    if not filtered:
        return note + f"未找到包含 '{query}' 的结果。可换一个角度（同义词/上下位词/中英文）再试；若多角度检索均无结果，请如实告知用户未找到。"

    scored_results = []
    for item in filtered:
        did, display_node, matched, prox, fts, composite, factors, hits = item[:8]
        scored_results.append((composite, (did, display_node, matched, prox, fts, hits)))
    scored_results.sort(key=lambda x: -x[0])

    # 评分阈值过滤：composite_score 来自 compute_composite_score，
    # 3 词 query 命中 2 词的典型综合分约 0.5。把 CORTEX_MIN_SCORE_THRESHOLD
    # 设成 0.5+ 会把大多数多关键词 query 的有效结果砍光——LLM 拿不到
    # 足够候选做综合推理。推荐保持 0.0 或最多 0.2。
    if idx_manager.min_score_threshold > 0.0:
        scored_results = [r for r in scored_results if r[0] >= idx_manager.min_score_threshold]

    return note + _format_kb_results(
        scored_results, query_words, idx_manager.path_map, doc_tree_map, doc_title_map, max_results,
        max_context_chars_per_result=idx_manager.max_context_chars_per_result,
        max_total_chars=idx_manager.max_total_chars,
        on_miss=idx_manager.resolve_doc_path,
        context_before=idx_manager.search_context_before,
        context_after=idx_manager.search_context_after,
    )




def handle_manage_kb(
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


def handle_read_document(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    path: str,
    start_word: Optional[int] = None,
    end_word: Optional[int] = None,
    section: Optional[str] = None,
) -> str:
    """读取知识库文档内容，支持多种文件格式。"""
    abs_path = _resolve_doc_path(path, workdir, idx_manager)
    if not abs_path or not os.path.exists(abs_path):
        return f"文档不存在: {path}。请确认路径是否正确。"

    ext = os.path.splitext(abs_path)[1].lower()

    # 登记闸门（ADR-0034 ghost 行）：仅登记未索引的文件（空树 ghost 行命中
    # DB）拒绝读取——与「不读取内容」的登记语义自洽，AI 读代码走 read_file。
    # 索引读失败显式报错（AP-8）：不能静默放行后走现场解析掩盖 DB 故障。
    try:
        ghost = _is_ghost_registered(idx_manager, abs_path)
    except IndexReadError as e:
        return (
            f"索引库读取失败，无法判定文档登记状态: {e}。\n"
            f"本次不走现场解析兜底（避免掩盖索引故障）；"
            f"可尝试 manage_kb(action='reindex') 修复索引后重试。"
        )
    if ghost:
        return (
            f"该文件仅登记未索引（不在索引类型白名单内）: {path}。\n"
            f"read_document 不读取其内容；请改用 read_file 工具按纯文本读取。"
        )

    try:
        # 索引优先（text-first 取完整正文）：部分格式（如 PDF）现场解析只产出
        # summary 截断摘要，完整 text 只在索引里；读索引还省掉重复解析。
        # 未命中索引回退现场解析（不触发全量建索引）；图像视觉解析结果只在索引里。
        tree, _indexed = _load_tree_for_info(idx_manager, abs_path, ext)
    except ImportError as e:
        return (
            f"文档解析失败: 缺少依赖 {e}。\n"
            f"请安装对应的解析库后重试。"
        )
    except IndexReadError as e:
        # AP-8：DB 故障 ≠ 文档坏了——单独报错，不与解析失败混同。
        return (
            f"索引库读取失败: {e}。\n"
            f"已索引文档的完整内容依赖索引库；可尝试 "
            f"manage_kb(action='reindex') 修复后重试。"
        )
    except Exception as e:
        return (
            f"文档解析失败: {e}。\n"
            f"如果是文本文件，可以尝试用 read_file 以纯文本模式读取。"
        )

    if not tree:
        from treesearch.parsers.image_parser import IMAGE_EXTENSIONS

        if ext in IMAGE_EXTENSIONS:
            return (
                f"图像文件尚未进索引: {path}。\n"
                "请先 manage_kb(action='reindex') 构建索引后重试。"
            )
        return f"文档解析结果为空: {path}"

    file_size = os.path.getsize(abs_path)
    return _format_document_output(
        tree=tree,
        path=path,
        abs_path=abs_path,
        ext=ext,
        file_size=file_size,
        start_word=start_word,
        end_word=end_word,
        section=section,
        max_read_words=idx_manager.max_read_words,
        show_toc=idx_manager.read_doc_show_toc,
    )


# ---------------------------------------------------------------------------
# file_info：read_document 之前的文件概况探查
# ---------------------------------------------------------------------------


def _is_ghost_registered(idx_manager: IndexManager, abs_path: str) -> bool:
    """路径是否为「仅登记」的 ghost 行（ADR-0034）——documents 有行但空树。

    判据 = DB 命中该 source_path 且 node_count == 0。true 索引文档至少有
    一个节点（无 heading 的 md/txt 也有单节点兜底）。

    索引读失败上抛 IndexReadError（AP-8）：闸门放行与否必须建立在
    「读到了 DB 且确认非 ghost」之上——DB 坏了不能伪装成「非 ghost」。
    """
    if getattr(idx_manager, "ts", None) is None:
        return False
    doc = _load_doc_by_source_path(idx_manager, abs_path)
    return doc is not None and not doc.structure


def _load_tree_for_info(
    idx_manager: IndexManager, abs_path: str, ext: str
) -> Tuple[Optional[dict], bool]:
    """获取文档结构树用于概况统计，返回 (tree, 是否来自索引)。

    优先读索引（structure 已在库中，避免重复解析二进制）；未命中索引时
    回退现场解析。不触发索引构建（load_or_build_index）——未索引文件
    直接现场解析，避免一次概况查询引发全量建索引。
    """
    from treesearch.parsers.image_parser import IMAGE_EXTENSIONS

    if ext in IMAGE_EXTENSIONS:
        # 图像不能现场重解析，视觉解析结果只在索引里
        tree = _load_indexed_image_tree(idx_manager, abs_path)
        return tree, tree is not None

    if getattr(idx_manager, "ts", None) is not None:
        # DB 精确加载单个文档（ADR-0019：documents 不再物化，无内存缓存可优先）
        doc = _load_doc_by_source_path(idx_manager, abs_path)
        if doc is not None:
            # 词数统计要准确：索引节点同时带 summary（截断版）与 text（完整版），
            # 用 text 优先的标准化
            return {
                "title": doc.doc_name,
                "text": "",
                "nodes": _normalize_nodes_text_first(doc.structure or []),
            }, True

    return _parse_document(abs_path, ext), False


def _count_words(text: str) -> int:
    """词数统计（离散词序号口径：CJK 每字一词），与 read_document 的
    start_word/end_word 词序号语义一致——序号 API 冻结，不用当量词。
    预算判断（截断上限）请用 word_window.count_equivalence_words。"""
    return len(_split_words_cjk(text)) if text else 0


def _subtree_text(node: dict) -> str:
    """拼接节点子树的全部文本（用于顶层章节词数估算）。"""
    parts = [node.get("text", "") or ""]
    for child in node.get("nodes", []):
        parts.append(_subtree_text(child))
    return "\n".join(p for p in parts if p)


def _assemble_full_text(tree: dict) -> str:
    """拼装全文（与 _format_word_range 的拼接方式一致，保证词数与词序号对得上）。"""
    nodes = tree.get("nodes", [])
    all_text_parts = _collect_all_text(nodes)
    if not all_text_parts:
        return tree.get("text", "") or ""
    parts = []
    for title, text, _ls, _le in all_text_parts:
        if title and not text.lstrip().startswith("#"):
            parts.append(f"### {title}\n\n{text}")
        else:
            parts.append(text)
    return "\n\n".join(parts)


def _build_info_toc(nodes: list[dict], depth: int = 0) -> Tuple[list[str], int]:
    """生成目录清单，返回 (行列表, 有标题的节点总数)。

    顶层章节（depth 0）附子树词数估算，帮助 AI 挑选 section；子章节只列标题。
    """
    lines: list[str] = []
    count = 0
    for node in nodes:
        title = node.get("title", "")
        children = node.get("nodes", [])
        if title:
            count += 1
            line = f"{'  ' * depth}- {title}"
            if depth == 0:
                wc = _count_words(_subtree_text(node))
                if wc:
                    # 当量词（中文 2 字计 1）——与 max_read_words 预算同口径，
                    # AI 据此估算 section 是否超出单次读取上限
                    from doclens.word_window import count_equivalence_words as _cew
                    ew = _cew(_subtree_text(node))
                    line += f"（约 {ew:.0f} 词）"
            lines.append(line)
        child_lines, child_count = _build_info_toc(
            children, depth + 1 if title else depth
        )
        lines.extend(child_lines)
        count += child_count
    return lines, count


def handle_file_info(
    idx_manager: IndexManager,
    workdir: Path,
    *,
    path: str,
) -> str:
    """返回单个文件的概况信息（不返回正文），供 read_document 之前探查。"""
    abs_path = _resolve_doc_path(path, workdir, idx_manager)
    if not abs_path or not os.path.exists(abs_path):
        return f"文档不存在: {path}。请确认路径是否正确。"

    ext = os.path.splitext(abs_path)[1].lower()

    # 登记态如实标注（ADR-0034）：ghost 行 = 已收录元数据、未建树——
    # 概况按「仅登记」报告，不走索引树（空树无概况可言）。
    # 索引读失败显式报错（AP-8）：不能把 DB 故障伪装成「非 ghost」。
    try:
        ghost = _is_ghost_registered(idx_manager, abs_path)
    except IndexReadError as e:
        return f"索引库读取失败，无法判定登记状态: {e}。"
    if ghost:
        stat = os.stat(abs_path)
        mtime = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
        return (
            f"文件: {path}\n"
            f"格式: {ext} ({fmt_size(stat.st_size)})\n"
            f"修改时间: {mtime}\n"
            f"已索引: 否（仅登记——文件名可搜索，内容不参与全文检索）\n"
            f"read_document 不读取该文件内容；请改用 read_file 工具。"
        )

    try:
        tree, indexed = _load_tree_for_info(idx_manager, abs_path, ext)
    except ImportError as e:
        return f"文档解析失败: 缺少依赖 {e}。请安装对应的解析库后重试。"
    except IndexReadError as e:
        # AP-8：DB 故障 ≠ 文档坏了——单独报错，不与解析失败混同。
        return (
            f"索引库读取失败: {e}。\n"
            f"词数/章节概况依赖索引树；可尝试 "
            f"manage_kb(action='reindex') 修复后重试。"
        )
    except Exception as e:
        return f"文档解析失败: {e}。"

    if not tree:
        return (
            f"文件尚未进索引或解析结果为空: {path}。\n"
            "如是图像文件，请先 manage_kb(action='reindex') 构建索引后重试。"
        )

    stat = os.stat(abs_path)
    mtime = datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")
    total_words = _count_words(_assemble_full_text(tree))

    nodes = tree.get("nodes", [])
    # text_to_tree 对无结构文本/部分格式会包一层与文档同名的伪根节点——
    # 它是文档本身而非章节：无子节点视为无章节，有子节点则提升子节点
    if len(nodes) == 1 and nodes[0].get("title") == tree.get("title"):
        nodes = nodes[0].get("nodes", [])

    toc_lines, section_count = _build_info_toc(nodes)

    header = (
        f"文档: {path}\n"
        f"格式: {ext} ({fmt_size(stat.st_size)})\n"
        f"修改时间: {mtime}\n"
        f"已索引: {'是' if indexed else '否'}\n"
        f"总词数: {total_words}"
        f"（read_document 可用 start_word/end_word 按词区间读取）\n"
        f"章节数: {section_count}"
    )

    if not toc_lines:
        return header

    return header + "\n\n## 目录结构\n" + "\n".join(toc_lines)

# 兼容别名（历史私有名；cortex_cli/mcp_server/tests 消费方已迁移公共名）
_handle_search_kb = handle_search_kb
_handle_manage_kb = handle_manage_kb
_handle_read_document = handle_read_document
_handle_file_info = handle_file_info
