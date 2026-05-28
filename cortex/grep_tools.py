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
DEFAULT_MAX_RESULTS = 50

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
            "case_sensitive": {
                "type": "boolean",
                "description": "是否区分大小写，默认 false",
                "default": False,
            },
            "max_results": {
                "type": "integer",
                "description": "最大返回结果数，默认 50",
                "default": 50,
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

def _format_agent_output(
    content_results: list[tuple[str, dict, int, int, float]],
    path_results: list[tuple[str, dict, int, int, float]],
    path_map: dict[str, str],
    max_results: int,
) -> str:
    """将搜索结果格式化为 Agent 友好的纯文本。

    格式:
        Found N results in M files:
        Use read_document tool to read full content: path=<path value>.

        path:line: text
        ...

        Paths matched: path1, path2
    """
    if not content_results and not path_results:
        return ""

    lines: list[str] = []

    if content_results:
        unique_files = len({path_map.get(doc_id, doc_id) for doc_id, _, _, _, _ in content_results})
        lines.append(f"Found {len(content_results)} results in {unique_files} files:")
        lines.append("Use read_document tool to read full content: path=<path value>.\n")

        total_chars = sum(len(l) for l in lines)
        shown = 0

        for doc_id, node, _matched, _prox, _fts in content_results:
            path = path_map.get(doc_id, doc_id)
            line_start = node.get("line_start")
            text = (node.get("text", "") or "").split("\n")[0].strip()

            path_note = f"{path}"
            if line_start is not None:
                path_note += f":{line_start}"
            entry = f"{path_note}: {text}"
            entry_len = len(entry) + 1

            if total_chars + entry_len > MAX_TOTAL_CHARS:
                remaining = len(content_results) - shown
                if remaining > 0:
                    lines.append(f"\n({remaining} more results truncated. Use max_results parameter to get more.)")
                break

            lines.append(entry)
            total_chars += entry_len
            shown += 1

    if path_results:
        path_strs = [path_map.get(doc_id, doc_id) for doc_id, _, _, _, _ in path_results]
        lines.append(f"\nPaths matched: {', '.join(path_strs)}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 处理函数
# ---------------------------------------------------------------------------

def _handle_grep(
    idx: IndexManager,
    *,
    pattern: str,
    case_sensitive: bool = False,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> str:
    """在工作目录中搜索文件内容。"""
    if not pattern:
        return "搜索模式不能为空。"

    from cortex.ripgrep import execute_grep_search

    result = execute_grep_search(idx, pattern, max_results)

    output = _format_agent_output(
        content_results=result.content_results,
        path_results=result.path_results,
        path_map=idx.path_map,
        max_results=max_results,
    )

    if not output:
        return f"未找到匹配 '{pattern}' 的结果。"

    logger.debug("grep pattern=%r, content=%d, paths=%d", pattern, len(result.content_results), len(result.path_results))

    return output
