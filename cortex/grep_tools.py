"""grep 工具定义和处理器

为 AI Agent 提供正则搜索能力，复用 execute_grep_search 统一搜索逻辑。
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from cortex.index_manager import IndexManager

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

MAX_TOTAL_CHARS = 8000

# ---------------------------------------------------------------------------
# Anthropic tool use schema
# ---------------------------------------------------------------------------

GREP_TOOL = {
    "name": "grep",
    "description": (
        "在工作目录中使用正则表达式搜索文件内容。"
        "支持 ripgrep 正则语法，搜索所有文件（包括未索引的）。"
        "当 search_kb 未找到结果，或需要精确匹配代码/配置中的特定模式时使用。"
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "pattern": {
                "type": "string",
                "description": "正则表达式搜索模式（ripgrep 语法）",
            },
        },
        },
        "required": ["pattern"],
    },
}

# ---------------------------------------------------------------------------
# 公共入口
# ---------------------------------------------------------------------------

def build_grep_tools(
    idx: IndexManager,
) -> tuple[list[dict], dict[str, Callable]]:
    """构建 grep 工具定义和处理器。

    Args:
        idx: IndexManager 实例

    Returns:
        (tools, handlers) 元组
    """
    handlers = {
        "grep": lambda **kw: _handle_grep(idx, **kw),
    }
    return [GREP_TOOL], handlers


# ---------------------------------------------------------------------------
# Agent 输出格式化
# ---------------------------------------------------------------------------

def _select_keyword_lines(
    text: str,
    kw_lower: list[str],
    max_lines: int = 3,
    context_range: int = 1,
) -> str:
    """从文本中选取包含关键词的行及其上下文。

    逻辑与 TUI render_search_result 的锚点选择一致：
    1. 遍历所有行，统计每行包含的关键词数
    2. 按命中数降序取锚点行
    3. 向前后各扩展 context_range 行
    4. 拼接并截断
    """
    if not text or not kw_lower:
        return (text or "")[:200].strip()

    all_lines = text.split("\n")

    # 统计每行命中关键词数
    line_hits: list[tuple[int, int]] = []  # (count, line_index)
    for j, line in enumerate(all_lines):
        l_lower = line.lower()
        cnt = sum(1 for w in kw_lower if w in l_lower)
        if cnt > 0:
            line_hits.append((cnt, j))

    if not line_hits:
        # 无匹配行：取前几个非空行
        selected = [l.strip() for l in all_lines if l.strip()][:max_lines]
        return " ".join(selected)[:200]

    # 按命中数降序，取前 max_lines 个锚点
    line_hits.sort(key=lambda x: -x[0])
    anchor_indices = [j for _, j in line_hits[:max_lines]]

    # 向前后各扩展 context_range 行
    context_indices: set[int] = set()
    for j in anchor_indices:
        for offset in range(-context_range, context_range + 1):
            idx = j + offset
            if 0 <= idx < len(all_lines):
                context_indices.add(idx)

    selected = [all_lines[j].strip() for j in sorted(context_indices) if all_lines[j].strip()]
    return " ".join(selected)[:200]


def _format_agent_output(
    content_results: list[tuple[str, dict, int, int, float]],
    path_results: list[tuple[str, dict, int, int, float]],
    path_map: dict[str, str],
    total_terms: int,
    query_words: list[str],
) -> str:
    """将搜索结果格式化为结构化 XML，与 search_kb 输出格式对齐。

    格式:
        Found N results in M files:
        Use read_document tool to read full content: path=<path value>.

        <result index="1" score="100%" matches="3/3">
          <path>科技/quantum_ai_report.pdf:59</path>
          <content>NSFC launched the 'Explainable Next-Gen AI' program...</content>
        </result>
        ...

        Paths matched: path1, path2
    """
    if not content_results and not path_results:
        return ""

    total_terms = max(total_terms, 1)
    kw_lower = [w.lower() for w in query_words if w]
    output_lines: list[str] = []

    if content_results:
        unique_files = len({path_map.get(doc_id, doc_id) for doc_id, _, _, _, _ in content_results})
        output_lines.append(f"Found {len(content_results)} results in {unique_files} files:")
        output_lines.append("Use read_document tool to read full content: path=<path value>.")

        total_chars = sum(len(l) for l in output_lines)
        shown = 0

        for doc_id, node, matched, _prox, _fts in content_results:
            path = path_map.get(doc_id, doc_id)
            line_start = node.get("line_start")
            full_text = node.get("text", "") or ""

            snippet = _select_keyword_lines(full_text, kw_lower)

            path_note = path
            if line_start is not None:
                path_note += f":{line_start}"
            pct = int(matched / total_terms * 100)

            entry = f'<result index="{shown + 1}" score="{pct}%" matches="{matched}/{total_terms}">\n'
            entry += f"  <path>{path_note}</path>\n"
            entry += f"  <content>{snippet}</content>\n"
            entry += "</result>"

            entry_len = len(entry) + 1

            if total_chars + entry_len > MAX_TOTAL_CHARS:
                remaining = len(content_results) - shown
                if remaining > 0:
                    output_lines.append(f"\n({remaining} more results truncated. Use max_results parameter to get more.)")
                break

            output_lines.append(entry)
            total_chars += entry_len
            shown += 1

    if path_results:
        path_strs = [path_map.get(doc_id, doc_id) for doc_id, _, _, _, _ in path_results]
        output_lines.append(f"\nPaths matched: {', '.join(path_strs)}")

    return "\n\n".join(output_lines)


# ---------------------------------------------------------------------------
# 处理函数
# ---------------------------------------------------------------------------

def _handle_grep(
    idx: IndexManager,
    *,
    pattern: str,
) -> str:
    """在工作目录中搜索文件内容。"""
    if not pattern:
        return "搜索模式不能为空。"

    from cortex.ripgrep import execute_grep_search

    result = execute_grep_search(idx, pattern)

    output = _format_agent_output(
        content_results=result.content_results,
        path_results=result.path_results,
        path_map=idx.path_map,
        total_terms=len(result.query_words),
        query_words=result.query_words,
    )

    if not output:
        return f"未找到匹配 '{pattern}' 的结果。"

    logger.debug("grep pattern=%r, content=%d, paths=%d", pattern, len(result.content_results), len(result.path_results))

    return output
