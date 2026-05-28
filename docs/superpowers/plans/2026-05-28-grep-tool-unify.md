# grep tool 搜索逻辑统一 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 grep tool 和 TUI `/grep` 的搜索逻辑统一为 `execute_grep_search()`，消除重复代码，各自保留独立输出格式。

**Architecture:** 在 `cortex/ripgrep.py` 新增 `GrepResult` dataclass 和 `execute_grep_search()` 统一搜索入口。TUI `_do_grep` 和 grep tool `_handle_grep` 都调用该函数，分别用 Rich 渲染和纯文本格式化输出。

**Tech Stack:** Python, dataclasses, 现有 IndexManager / ripgrep / like_search 基础设施

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `cortex/ripgrep.py` | 修改 | 新增 `GrepResult` + `execute_grep_search()` |
| `cortex/grep_tools.py` | 重写 | 调用 `execute_grep_search()`，Agent 纯文本格式化 |
| `cortex/tui/app.py` | 修改 | `_do_grep` 改为调用 `execute_grep_search()` |
| `cortex/agent_integration.py` | 修改 | `build_grep_tools(self.workdir)` → `build_grep_tools(self.idx)` |
| `cortex/cortex_cli.py` | 修改 | 删除 `--glob` 参数，`build_grep_tools(workdir)` → `build_grep_tools(idx)` |

---

### Task 1: 在 `cortex/ripgrep.py` 新增 `GrepResult` 和 `execute_grep_search()`

**Files:**
- Modify: `cortex/ripgrep.py` (末尾追加)

- [ ] **Step 1: 在文件头部添加 dataclass 导入**

在 `ripgrep.py` 第 3 行 `import os` 后添加：

```python
from dataclasses import dataclass
```

- [ ] **Step 2: 在文件末尾添加 `GrepResult` 和 `execute_grep_search()`**

追加到 `search_paths_by_regex()` 函数之后：

```python
# ---------------------------------------------------------------------------
# 统一 grep 搜索入口
# ---------------------------------------------------------------------------

@dataclass
class GrepResult:
    """grep 搜索结果。

    Attributes:
        content_results: 内容匹配 [(doc_id, node_dict, matched, proximity, fts_score)]
        path_results: 路径匹配，格式同上
        query_words: 查询词列表
    """
    content_results: list[tuple[str, dict, int, int, float]]
    path_results: list[tuple[str, dict, int, int, float]]
    query_words: list[str]


def execute_grep_search(
    idx,
    query: str,
    max_results: int = 50,
) -> GrepResult:
    """执行统一的 grep 搜索流程。

    搜索流程:
    1. like_search(use_regex=True) — SQLite REGEXP 搜索
    2. 若无结果: rg_fallback_search — ripgrep 降级搜索
    3. search_paths_by_regex — 路径正则匹配

    Args:
        idx: IndexManager 实例
        query: 正则表达式
        max_results: 最大结果数

    Returns:
        GrepResult 包含内容结果、路径结果和查询词
    """
    from __main__ import __dict__ as _  # noqa: F401 — avoid circular

    query_words = [query]

    # 步骤 1: like_search
    like_results = idx.like_search(query, max_results=max_results, use_regex=True)

    if like_results:
        # like_search 返回 dict 列表，转为 tuple 格式
        content_results = [
            (item["doc_id"], {"title": item.get("title", ""), "text": item.get("summary", "")}, 1, 0, item.get("fts_score", 0.0))
            for item in like_results
        ]
    else:
        # 步骤 2: ripgrep 降级
        content_results = rg_fallback_search(
            query,
            idx.path_map,
            {},
            query_words,
            context_before=idx.rg_context_before,
            context_after=idx.rg_context_after,
            use_regex=True,
        )

    # 步骤 3: 路径搜索
    path_results = search_paths_by_regex(
        query,
        idx.path_map,
        max_results=max_results,
    )

    return GrepResult(
        content_results=content_results,
        path_results=path_results,
        query_words=query_words,
    )
```

- [ ] **Step 3: 验证语法无误**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "from cortex.ripgrep import execute_grep_search, GrepResult; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add cortex/ripgrep.py
git commit -m "feat(grep): 新增 GrepResult 和 execute_grep_search 统一搜索入口"
```

---

### Task 2: 重写 `cortex/grep_tools.py` 调用统一搜索入口

**Files:**
- Modify: `cortex/grep_tools.py` (全文件重写)

- [ ] **Step 1: 重写 `grep_tools.py`**

完整替换为：

```python
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
```

- [ ] **Step 2: 验证语法无误**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "from cortex.grep_tools import build_grep_tools; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add cortex/grep_tools.py
git commit -m "refactor(grep): grep_tools 调用 execute_grep_search 统一入口，删除 glob 参数"
```

---

### Task 3: 简化 TUI `_do_grep` 调用统一搜索入口

**Files:**
- Modify: `cortex/tui/app.py:514-578`

- [ ] **Step 1: 替换 `_do_grep` 方法体**

将 `_do_grep` 方法（约第 514-578 行）替换为：

```python
    def _do_grep(self, query: str) -> None:
        """后台线程：执行正则搜索"""
        worker = get_current_worker()
        if worker.is_cancelled:
            return

        try:
            from cortex.ripgrep import execute_grep_search

            result = execute_grep_search(self.idx, query, self.max_results)
            all_results = result.content_results + result.path_results

            renderables = render_search_results(
                results=all_results,
                query=query,
                query_words=result.query_words,
                path_map=self.idx.path_map,
                max_results=self.max_results,
                is_ripgrep=True,
            )
            self.call_from_thread(self._on_search_done, renderables)

        except Exception as exc:
            self.call_from_thread(self._on_search_error, str(exc))
```

注意：替换后 `app.py` 顶部的 `from cortex import ripgrep as rg_module` 导入可能不再需要（如果 `_do_grep` 是唯一使用 `rg_module` 的地方）。检查文件中其他 `rg_module` 引用，若已无其他使用则删除该导入。

- [ ] **Step 2: 检查 `rg_module` 是否还有其他引用**

Run: `cd C:/Users/lianghao/github/cortex && grep -n 'rg_module' cortex/tui/app.py`
Expected: 只剩导入行（若有其他引用则保留导入，否则删除）

- [ ] **Step 3: 验证语法无误**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "from cortex.tui.app import CortexApp; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add cortex/tui/app.py
git commit -m "refactor(tui): _do_grep 调用 execute_grep_search 统一入口"
```

---

### Task 4: 更新调用方 — `agent_integration.py` 和 `cortex_cli.py`

**Files:**
- Modify: `cortex/agent_integration.py:230-233`
- Modify: `cortex/cortex_cli.py:874-891` 和 `1099-1111`

- [ ] **Step 1: 修改 `agent_integration.py` — 传入 idx**

将第 230-233 行：

```python
        # --- grep 工具注册 ---
        from cortex.grep_tools import build_grep_tools
        grep_tools, grep_handlers = build_grep_tools(self.workdir)
        register_external_tools(grep_tools, grep_handlers)
```

替换为：

```python
        # --- grep 工具注册 ---
        from cortex.grep_tools import build_grep_tools
        grep_tools, grep_handlers = build_grep_tools(self.idx)
        register_external_tools(grep_tools, grep_handlers)
```

- [ ] **Step 2: 修改 `cortex_cli.py` — 删除 `--glob` 参数**

将 grep subparser 部分（约第 874-891 行）：

```python
    # cortex grep <pattern>
    grep_parser = sub.add_parser(
        "grep", help="Search file content with ripgrep regex"
    )
    grep_parser.add_argument("pattern", help="Regex search pattern (ripgrep syntax)")
    grep_parser.add_argument(
        "--glob", "-g", default=None,
        help="File filter glob, e.g. '*.py', '*.{md,txt}'"
    )
    grep_parser.add_argument(
        "--case-sensitive", "-s", action="store_true",
        help="Case sensitive search"
    )
    grep_parser.add_argument(
        "--max-results", type=int, default=50,
        help="Max results (default: 50)"
    )
    grep_parser.set_defaults(func=_cli_grep)
```

替换为：

```python
    # cortex grep <pattern>
    grep_parser = sub.add_parser(
        "grep", help="Search file content with ripgrep regex"
    )
    grep_parser.add_argument("pattern", help="Regex search pattern (ripgrep syntax)")
    grep_parser.add_argument(
        "--case-sensitive", "-s", action="store_true",
        help="Case sensitive search"
    )
    grep_parser.add_argument(
        "--max-results", type=int, default=50,
        help="Max results (default: 50)"
    )
    grep_parser.set_defaults(func=_cli_grep)
```

- [ ] **Step 3: 修改 `_cli_grep` 函数**

将 `_cli_grep` 函数（约第 1099-1111 行）：

```python
def _cli_grep(args, config, idx):
    """Handle `cortex grep <pattern>` — ripgrep regex search on working directory."""
    from cortex.grep_tools import build_grep_tools

    workdir = Path(config.search_path).resolve()
    _, handlers = build_grep_tools(workdir)
    result = handlers["grep"](
        pattern=args.pattern,
        glob=args.glob,
        case_sensitive=args.case_sensitive,
        max_results=args.max_results,
    )
    print(result)
```

替换为：

```python
def _cli_grep(args, config, idx):
    """Handle `cortex grep <pattern>` — regex search on working directory."""
    from cortex.grep_tools import build_grep_tools

    _, handlers = build_grep_tools(idx)
    result = handlers["grep"](
        pattern=args.pattern,
        case_sensitive=args.case_sensitive,
        max_results=args.max_results,
    )
    print(result)
```

- [ ] **Step 4: 验证语法无误**

Run: `cd C:/Users/lianghao/github/cortex && .venv/Scripts/python.exe -c "from cortex.cortex_cli import main; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add cortex/agent_integration.py cortex/cortex_cli.py
git commit -m "refactor(grep): 调用方传入 IndexManager，删除 glob 参数"
```

---

### Task 5: E2E 验证

**Files:** 无改动，仅运行验证

- [ ] **Step 1: CLI grep 验证**

Run: `cd C:/Users/lianghao/github/cortex/test_work_dir && ../.venv/Scripts/python.exe -m cortex grep "python"`
Expected: 输出搜索结果，格式为 `Found N results in M files:` + 路径行

- [ ] **Step 2: 验证路径格式**

确认输出中的文件路径为 `path_map` 中的相对路径（如 `科技/doc.md`），而非绝对路径。

- [ ] **Step 3: 检查 TUI grep 是否正常（如能启动）**

Run: `cd C:/Users/lianghao/github/cortex/test_work_dir && ../.venv/Scripts/python.exe -m cortex`
在 TUI 中输入 `/grep AI`，确认搜索结果正常显示。
