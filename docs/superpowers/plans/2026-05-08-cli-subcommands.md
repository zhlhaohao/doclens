# CLI Subcommands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `cortex search <query>`, `cortex ai <msg>`, `cortex index [--force]`, and `cortex status` CLI commands that run in headless/plain-text mode without launching the Textual TUI.

**Architecture:** Add `argparse` with subparsers to `cortex_cli:main()`. Extract shared initialization into `_init_components()`. CLI command handlers reuse existing `NotebookSearchCLI` and `IndexManager` methods with plain-text output via `print()`.

**Tech Stack:** Python stdlib `argparse`, existing `NotebookSearchCLI`, `IndexManager`, `CortexAgent`

---

## File Map

- **Modify:** `cortex/cortex_cli.py` — add argparse, `_init_components()`, CLI handlers; keep TUI path unchanged
- **Create:** `tests/test_cli_subcommands.py` — unit tests for all 4 CLI subcommands

---

## Task 1: Scaffold argparse and `_init_components()`

**Files:**
- Modify: `cortex/cortex_cli.py` (add 50-60 lines near top of `main()` section)

- [ ] **Step 1: Add `argparse` import and `_init_components()` helper**

Find the line `def main():` (line 776). Above it, add:

```python
# ─────────────────────────────────────────────────────────────────────────────
# CLI mode: argparse subcommands
# ─────────────────────────────────────────────────────────────────────────────

def _init_components():
    """Shared initialization for both CLI and TUI modes.

    Returns:
        tuple: (config, idx)
    """
    config = CortexConfig.load()
    idx = IndexManager(config)
    return config, idx


def _build_parser():
    """Build argparse parser with subcommands."""
    parser = argparse.ArgumentParser(
        prog="cortex",
        description="Cortex CLI — structure-aware document retrieval"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # cortex search <query>
    search_parser = sub.add_parser(
        "search", help="Search for a query string in the indexed documents"
    )
    search_parser.add_argument("query", nargs="+", help="Search query keywords")
    search_parser.set_defaults(func=_cli_search)

    # cortex ai <message>
    ai_parser = sub.add_parser(
        "ai", help="Send a message to the LLM agent"
    )
    ai_parser.add_argument("message", nargs="+", help="Message to send")
    ai_parser.set_defaults(func=_cli_ai)

    # cortex index [--force]
    index_parser = sub.add_parser(
        "index", help="Build or update the document index"
    )
    index_parser.add_argument(
        "--force", "-f", action="store_true",
        help="Force full rebuild (delete existing index first)"
    )
    index_parser.set_defaults(func=_cli_index)

    # cortex status
    sub.add_parser("status", help="Show index and system status").set_defaults(
        func=_cli_status
    )

    return parser
```

- [ ] **Step 2: Import `argparse` at top of file**

In `cortex/cortex_cli.py`, add to the imports section near line 16:

```python
import argparse
```

- [ ] **Step 3: Add `_cli_search` stub**

Add this function right before `main()`:

```python
def _cli_search(args, config, idx):
    """Handle `cortex search <query>` — plain text output."""
    query = " ".join(args.query)
    print(f"[search] query={query!r}")
    # TODO: implement
```

- [ ] **Step 4: Add remaining stub handlers**

Add below `_cli_search`:

```python
def _cli_ai(args, config, idx):
    """Handle `cortex ai <message>` — plain text output."""
    message = " ".join(args.message)
    print(f"[ai] message={message!r}")
    # TODO: implement


def _cli_index(args, config, idx):
    """Handle `cortex index [--force]` — plain text output."""
    force = args.force
    print(f"[index] force={force}")
    # TODO: implement


def _cli_status(args, config, idx):
    """Handle `cortex status` — plain text output."""
    print("[status]")
    # TODO: implement
```

- [ ] **Step 5: Modify `main()` to dispatch to CLI or TUI**

Replace the entire `main()` function body with:

```python
def main():
    import sqlite3
    from cortex.tui.app import CortexApp
    from treesearch.treesearch import TreeSearch

    parser = _build_parser()
    args = parser.parse_args()

    if args.command is not None:
        config, idx = _init_components()
        args.func(args, config, idx)
        return

    # ── TUI mode (unchanged original logic) ──
    config = CortexConfig.load()  # 首次运行会在此自动初始化并退出
    index_path = config.index_path or os.path.join(config.search_path, ".cortex", "index.db")

    doc_count = 0
    if os.path.exists(index_path):
        try:
            with sqlite3.connect(index_path) as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM documents")
                doc_count = cursor.fetchone()[0]
        except sqlite3.Error as e:
            print(f"[警告] 无法读取索引: {e}")

    if doc_count == 0:
        search_path = config.search_path
        try:
            response = input(
                f"当前目录 '{search_path}' 尚未建立索引，是否创建？ [Y/n] "
            ).strip().lower()
        except EOFError:
            print("当前目录尚未建立索引，请在交互式终端中运行或先手动创建索引。")
            sys.exit(1)
        except KeyboardInterrupt:
            print("\n已取消。")
            sys.exit(1)

        if response and response not in ("y", "yes"):
            print("已取消。如需进入 TUI，请先建立索引。")
            sys.exit(1)

        print("正在创建索引...")

        def on_progress(current_file: str, processed: int, total: int):
            print(f"Indexing [{processed}/{total}] {current_file}")

        try:
            ts = TreeSearch(search_path, db_path=index_path)
            ts.index(search_path, progress_callback=on_progress)
            print("索引创建完成。")
        except Exception as e:
            print(f"索引创建失败: {e}")
            sys.exit(1)

    app = CortexApp()
    app.run(mouse=True)
```

- [ ] **Step 6: Run smoke test**

```bash
cd /c/Users/lianghao/github/cortex && python -m cortex --help
```

Expected output:
```
usage: cortex [-h] {search,ai,index,status}]
```

- [ ] **Step 7: Commit**

```bash
git add cortex/cortex_cli.py && git commit -m "feat(cli): scaffold argparse subcommands and _init_components"
```

---

## Task 2: Implement `_cli_search`

**Files:**
- Modify: `cortex/cortex_cli.py` (replace stub in `_cli_search`)

- [ ] **Step 1: Replace `_cli_search` stub with full implementation**

```python
def _cli_search(args, config, idx):
    """Handle `cortex search <query>` — plain text output."""
    query = " ".join(args.query)

    # Load or build index if needed
    idx.load_or_build_index()

    # Perform search
    nodes, docs = idx.search(query, max_results=config.max_results)

    # Reuse NotebookSearchCLI's format_results for plain text output
    cli = NotebookSearchCLI.__new__(NotebookSearchCLI)
    cli.config = config
    cli.idx = idx
    cli.max_results = config.max_results
    cli.format_results(nodes, docs, query, max_results=cli.max_results)
```

- [ ] **Step 2: Run smoke test**

```bash
cd /c/Users/lianghao/github/cortex && python -m cortex search test
```

Verify it prints search results in plain text format to stdout.

- [ ] **Step 3: Commit**

```bash
git add cortex/cortex_cli.py && git commit -m "feat(cli): implement cortex search command"
```

---

## Task 3: Implement `_cli_index`

**Files:**
- Modify: `cortex/cortex_cli.py` (replace stub in `_cli_index`)

- [ ] **Step 1: Replace `_cli_index` stub with full implementation**

```python
def _cli_index(args, config, idx):
    """Handle `cortex index [--force]` — plain text output."""
    force = args.force

    # Ensure idx has the config attached (for reindex signaling)
    idx.load_or_build_index()

    if force:
        print("正在执行全量重建索引...")
        idx.reindex(force=True)
        doc_count = len(idx.documents)
        print(f"索引全量重建完成: {doc_count} 个文档")
    else:
        print("正在执行增量更新索引...")
        idx.reindex(force=False)
        doc_count = len(idx.documents)
        print(f"索引增量更新完成: {doc_count} 个文档")
```

Note: Verify `IndexManager.reindex()` accepts `progress_callback` — if not, adjust to match actual signature.

- [ ] **Step 2: Run smoke test (no-op if no files changed)**

```bash
cd /c/Users/lianghao/github/cortex && python -m cortex index
```

- [ ] **Step 3: Commit**

```bash
git add cortex/cortex_cli.py && git commit -m "feat(cli): implement cortex index command"
```

---

## Task 4: Implement `_cli_status`

**Files:**
- Modify: `cortex/cortex_cli.py` (replace stub in `_cli_status`)

- [ ] **Step 1: Replace `_cli_status` stub with full implementation**

```python
def _cli_status(args, config, idx):
    """Handle `cortex status` — plain text output."""
    idx.load_or_build_index()

    index_abs_path = os.path.abspath(idx.index_path)
    index_size = 0
    if os.path.exists(index_abs_path):
        index_size = os.path.getsize(index_abs_path)

    docs = idx.documents
    total_files = len(docs)
    total_size = 0
    file_type_counts: dict[str, int] = {}

    for doc in docs:
        if hasattr(doc, "metadata") and doc.metadata:
            size = doc.metadata.get("file_size", 0)
            total_size += size
            source_path = doc.metadata.get("source_path", "")
            ext = os.path.splitext(source_path)[1].lower() if source_path else ""
            if ext:
                file_type_counts[ext] = file_type_counts.get(ext, 0) + 1

    def _format_size(sz: int) -> str:
        if sz >= 1024 * 1024 * 1024:
            return f"{sz / (1024 * 1024 * 1024):.2f} GB"
        elif sz >= 1024 * 1024:
            return f"{sz / (1024 * 1024):.2f} MB"
        elif sz >= 1024:
            return f"{sz / 1024:.2f} KB"
        return f"{sz} B"

    missing = check_dependencies()
    deps_ok = not missing

    type_lines = ""
    for ext, count in sorted(file_type_counts.items(), key=lambda x: -x[1])[:10]:
        type_name = SUPPORTED_FORMATS.get(ext, (ext, None))[0] if ext in SUPPORTED_FORMATS else ext
        type_lines += f"  {ext}: {count} 个 ({type_name})\n"

    print(f"""━━━ NotebookSearch 状态 ━━━
  索引路径:   {index_abs_path}
  索引大小:   {_format_size(index_size)}
  ─────────────────────────────
  搜索路径:   {idx.search_path}
  文档总数:   {total_files}
  文件总大小: {_format_size(total_size)}
  ─────────────────────────────
  文件类型统计 (前10)
{type_lines}  依赖状态:   {'全部已安装' if deps_ok else '部分缺失'}""")
```

- [ ] **Step 2: Run smoke test**

```bash
cd /c/Users/lianghao/github/cortex && python -m cortex status
```

- [ ] **Step 3: Commit**

```bash
git add cortex/cortex_cli.py && git commit -m "feat(cli): implement cortex status command"
```

---

## Task 5: Implement `_cli_ai`

**Files:**
- Modify: `cortex/cortex_cli.py` (replace stub in `_cli_ai`)

- [ ] **Step 1: Replace `_cli_ai` stub with full implementation**

```python
def _cli_ai(args, config, idx):
    """Handle `cortex ai <message>` — plain text output."""
    message = " ".join(args.message)

    # Initialize agent
    from cortex.agent_integration import CortexAgent
    agent = CortexAgent(Path(idx.search_path)).initialize()

    # Capture stdout from agent
    old_stdout = sys.stdout
    captured = io.StringIO()
    try:
        sys.stdout = captured
        history = agent.run_query(message, [])
    finally:
        sys.stdout = old_stdout

    output = captured.getvalue()
    if output.strip():
        print(output.rstrip())
    else:
        print("(Agent 已完成，无文本输出)")
```

Note: `_cli_ai` needs `import io` — verify `io` is already imported at the top of the file (it is, from line 4: `import io`).

- [ ] **Step 2: Run smoke test**

```bash
cd /c/Users/lianghao/github/cortex && python -m cortex ai hello
```

(Expect agent response or an error if no API key — both are valid for smoke test.)

- [ ] **Step 3: Commit**

```bash
git add cortex/cortex_cli.py && git commit -m "feat(cli): implement cortex ai command"
```

---

## Task 6: Add unit tests

**Files:**
- Create: `tests/test_cli_subcommands.py`

- [ ] **Step 1: Write tests for CLI subcommands**

```python
"""Tests for CLI subcommands: search, ai, index, status"""

import pytest
from unittest.mock import patch, MagicMock
from io import StringIO

from cortex.cortex_cli import (
    main, _build_parser, _init_components,
    _cli_search, _cli_ai, _cli_index, _cli_status
)


class TestArgParser:
    def test_parser_has_search_subcommand(self):
        parser = _build_parser()
        # parse_args with no args exits, so use parse_known_args
        # Instead test that subparsers exist
        assert "search" in parser._subparsers._group_actions[0].choices

    def test_parser_has_ai_subcommand(self):
        parser = _build_parser()
        assert "ai" in parser._subparsers._group_actions[0].choices

    def test_parser_has_index_subcommand(self):
        parser = _build_parser()
        assert "index" in parser._subparsers._group_actions[0].choices

    def test_parser_has_status_subcommand(self):
        parser = _build_parser()
        assert "status" in parser._subparsers._group_actions[0].choices


class TestSearchCommand:
    @patch("cortex.cortex_cli.IndexManager")
    @patch("cortex.cortex_cli.CortexConfig")
    def test_search_calls_format_results(self, MockConfig, MockIdx):
        from cortex.cortex_cli import _cli_search

        mock_config = MagicMock()
        mock_config.max_results = 20
        mock_idx = MagicMock()
        mock_idx.search_path = "/tmp"
        mock_idx.index_path = "/tmp/.cortex/index.db"
        mock_idx.documents = []
        mock_idx.path_map = {}
        mock_idx.search.return_value = ([], [])
        mock_idx.max_results = 20
        mock_idx.title_width = 60
        mock_idx.line_width = 120
        mock_idx.max_context_lines = 10
        mock_idx.context_expand_range = 2
        mock_idx.min_keyword_match = 1
        mock_idx.min_proximity_score = 0
        mock_idx.min_keywords_per_line = 1
        mock_idx.max_anchor_lines = 3
        mock_idx.rg_context_before = 2
        mock_idx.rg_context_after = 2
        mock_idx.max_span = 50
        mock_idx.scoring_weights = {"title": 1.0, "body": 0.8}
        mock_idx.load_or_build_index = MagicMock()

        args = MagicMock()
        args.query = ["test", "query"]

        # Should not raise
        _cli_search(args, mock_config, mock_idx)


class TestIndexCommand:
    @patch("cortex.cortex_cli.IndexManager")
    @patch("cortex.cortex_cli.CortexConfig")
    def test_index_with_force_flag(self, MockConfig, MockIdx):
        from cortex.cortex_cli import _cli_index

        mock_config = MagicMock()
        mock_idx = MagicMock()
        mock_idx.load_or_build_index = MagicMock()
        mock_idx.reindex = MagicMock()
        mock_idx.documents = []

        args = MagicMock()
        args.force = True

        _cli_index(args, mock_config, mock_idx)
        mock_idx.reindex.assert_called_once()
        call_kwargs = mock_idx.reindex.call_args[1]
        assert call_kwargs["force"] is True


class TestStatusCommand:
    @patch("cortex.cortex_cli.IndexManager")
    @patch("cortex.cortex_cli.CortexConfig")
    @patch("sys.stdout", new_callable=StringIO)
    def test_status_prints_output(self, mock_stdout, MockConfig, MockIdx):
        from cortex.cortex_cli import _cli_status

        mock_config = MagicMock()
        mock_idx = MagicMock()
        mock_idx.load_or_build_index = MagicMock()
        mock_idx.index_path = "/tmp/.cortex/index.db"
        mock_idx.search_path = "/tmp"
        mock_idx.documents = []
        # Document with metadata
        mock_doc = MagicMock()
        mock_doc.metadata = {"file_size": 1024, "source_path": "/tmp/test.py"}
        mock_idx.documents = [mock_doc]

        args = MagicMock()

        _cli_status(args, mock_config, mock_idx)
        output = mock_stdout.getvalue()
        assert "NotebookSearch 状态" in output or "索引路径" in output
```

- [ ] **Step 2: Run tests**

```bash
cd /c/Users/lianghao/github/cortex && python -m pytest tests/test_cli_subcommands.py -v
```

- [ ] **Step 3: Commit**

```bash
git add tests/test_cli_subcommands.py && git commit -m "test(cli): add unit tests for CLI subcommands"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run all CLI tests**

```bash
cd /c/Users/lianghao/github/cortex && python -m pytest tests/test_cli_subcommands.py tests/test_cortex_cli_main.py -v
```

- [ ] **Step 2: Manual smoke test all 4 commands**

```bash
cd /c/Users/lianghao/github/cortex && python -m cortex search test
python -m cortex status
python -m cortex index
python -m cortex ai hello
```

- [ ] **Step 3: Verify TUI still works**

```bash
# (Ctrl+C to exit the TUI)
cd /c/Users/lianghao/github/cortex && timeout 2 python -m cortex || true
```

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "feat: add CLI subcommands for search, ai, index, status"
```
