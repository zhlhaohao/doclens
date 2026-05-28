"""grep 工具定义和处理器

为 AI Agent 提供 ripgrep 正则搜索能力，搜索工作目录下所有文件。
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Callable

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
            "glob": {
                "type": "string",
                "description": "文件过滤 glob 模式，如 '*.py', '*.{md,txt}'",
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
    workdir: Path,
) -> tuple[list[dict], dict[str, Callable]]:
    """构建 grep 工具定义和处理器。

    Args:
        workdir: 工作目录（搜索根路径）

    Returns:
        (tools, handlers) 元组
    """
    handlers = {
        "grep": lambda **kw: _handle_grep(workdir, **kw),
    }
    return [GREP_TOOL], handlers


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------

def _read_matched_lines(
    hits: dict[str, list[int]],
    workdir: Path,
    max_results: int,
) -> list[tuple[str, int, str]]:
    """从 rg_search 结果中读取匹配行内容。

    Args:
        hits: {file_path: [1-based line_numbers]}
        workdir: 工作目录（用于生成相对路径）
        max_results: 最大返回条数

    Returns:
        [(relative_path, line_number, line_text)]
    """
    results: list[tuple[str, int, str]] = []
    total = 0

    for abs_path, line_nums in hits.items():
        if total >= max_results:
            break

        try:
            rel_path = os.path.relpath(abs_path, str(workdir))
        except ValueError:
            rel_path = abs_path

        try:
            with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                all_lines = f.readlines()
        except OSError:
            continue

        for line_num in line_nums:
            if total >= max_results:
                break
            idx = line_num - 1
            if 0 <= idx < len(all_lines):
                line_text = all_lines[idx].rstrip("\n\r")
                results.append((rel_path, line_num, line_text))
                total += 1

    return results


# ---------------------------------------------------------------------------
# 处理函数
# ---------------------------------------------------------------------------

def _handle_grep(
    workdir: Path,
    *,
    pattern: str,
    glob: str | None = None,
    case_sensitive: bool = False,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> str:
    """在工作目录中搜索文件内容。"""
    from treesearch.ripgrep import rg_available, rg_search

    if not rg_available():
        return "ripgrep (rg) 未安装或不在 PATH 中，无法使用 grep 工具。"

    if not pattern:
        return "搜索模式不能为空。"

    # 构造搜索路径
    if glob:
        file_paths = [str(p) for p in Path(workdir).rglob(glob) if p.is_file()]
        if not file_paths:
            return f"未找到匹配 glob '{glob}' 的文件。"
    else:
        file_paths = [str(workdir)]

    # 执行 ripgrep 搜索
    hits = rg_search(
        pattern,
        file_paths,
        case_sensitive=case_sensitive,
        use_regex=True,
        max_count=max_results,
    )

    logger.debug("grep pattern=%r, glob=%s, hits=%d files", pattern, glob, len(hits))

    if not hits:
        return f"未找到匹配 '{pattern}' 的结果。"

    # 读取匹配行内容
    matched_lines = _read_matched_lines(hits, workdir, max_results)

    if not matched_lines:
        return f"未找到匹配 '{pattern}' 的结果。"

    # 统计文件数
    unique_files = len({p for p, _, _ in matched_lines})
    total_hits = sum(len(nums) for nums in hits.values())

    # 格式化输出
    lines = [f"Found {total_hits} results in {unique_files} files:\n"]
    total_chars = len(lines[0])
    shown = 0

    for rel_path, line_num, text in matched_lines:
        entry = f"{rel_path}:{line_num}: {text}"
        entry_len = len(entry) + 1

        if total_chars + entry_len > MAX_TOTAL_CHARS:
            remaining = total_hits - shown
            if remaining > 0:
                lines.append(f"\n({remaining} more results truncated. Use max_results parameter to get more.)")
            break

        lines.append(entry)
        total_chars += entry_len
        shown += 1

    if shown == len(matched_lines) and total_hits > shown:
        remaining = total_hits - shown
        lines.append(f"\n({remaining} more results truncated. Use max_results parameter to get more.)")

    logger.debug("grep results: shown=%d, total_hits=%d", shown, total_hits)

    return "\n".join(lines)
