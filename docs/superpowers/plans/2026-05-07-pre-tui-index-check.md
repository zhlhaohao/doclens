# Pre-TUI Index Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before launching the TUI, check if the current directory has an index with documents; if not, prompt the user in the terminal to create one, show progress during indexing, then enter the TUI.

**Architecture:** Add a pre-flight check in `cortex_cli.py:main()` that queries SQLite for document count. If zero, prompt via `input()` and call `TreeSearch.index()` with a `progress_callback` that prints to stdout. Update `build_index()` to pass `(file_path, processed, total)` to the callback so progress is accurate. Update the existing `index_manager.py` callback to accept the new args.

**Tech Stack:** Python, SQLite, asyncio (via TreeSearch), Textual (TUI), pytest.

---

### Task 1: Update `build_index()` progress callback signature

**Files:**
- Modify: `treesearch/indexer.py:1479-1496` (fingerprint loop)
- Modify: `treesearch/indexer.py:1564-1565` (success path inside `_index_one()`)

**Context:** `build_index()` already accepts `progress_callback: Optional[callable] = None` at line 1295. It currently calls `progress_callback(fp)` in two places. We need to change this to `progress_callback(fp, processed, total)` where `processed` is a running counter and `total` is `len(expanded)`.

- [ ] **Step 1: Add counter and total variables**

After line 1349 (`expanded = resolve_paths(...)`), add:

```python
    total_files = len(expanded)
    processed_counter = [0]
```

- [ ] **Step 2: Update skipped-file callback in fingerprint loop**

In `treesearch/indexer.py`, around line 1493, replace:

```python
                    skipped.append(fp)
                    if progress_callback:
                        progress_callback(fp)
                    continue
```

With:

```python
                    skipped.append(fp)
                    processed_counter[0] += 1
                    if progress_callback:
                        progress_callback(fp, processed_counter[0], total_files)
                    continue
```

- [ ] **Step 3: Update success callback inside `_index_one()`**

In `treesearch/indexer.py`, around line 1564, replace:

```python
                # Call progress callback if provided
                if progress_callback:
                    progress_callback(fp)
```

With:

```python
                # Call progress callback if provided
                processed_counter[0] += 1
                if progress_callback:
                    progress_callback(fp, processed_counter[0], total_files)
```

- [ ] **Step 4: Run existing indexer tests**

Run: `pytest tests/test_indexer.py -v`
Expected: All existing tests pass (no behavior change when `progress_callback` is not provided).

- [ ] **Step 5: Commit**

```bash
git add treesearch/indexer.py
git commit -m "feat: pass processed/total counts to progress_callback in build_index"
```

---

### Task 2: Update existing `on_file_indexed` callback in `index_manager.py`

**Files:**
- Modify: `cortex/index_manager.py:154`

**Context:** `index_manager.py` calls `new_ts.index(self.search_path, progress_callback=on_file_indexed)` at line 184. The callback currently takes one arg. We must update it to accept the new `(file_path, processed, total)` signature without breaking its behavior.

- [ ] **Step 1: Update callback signature**

In `cortex/index_manager.py`, line 154, replace:

```python
                    def on_file_indexed(file_path: str):
```

With:

```python
                    def on_file_indexed(file_path: str, processed: int = 0, total: int = 0):
```

- [ ] **Step 2: Verify no other changes needed**

The body of `on_file_indexed` only uses `file_path` and increments `indexed_count[0]`, so no body changes are required.

- [ ] **Step 3: Run tests**

Run: `pytest tests/test_tui_app.py -v -k "not async"`
Expected: Tests pass.

- [ ] **Step 4: Commit**

```bash
git add cortex/index_manager.py
git commit -m "fix: adapt index_manager progress callback to new 3-arg signature"
```

---

### Task 3: Implement pre-TUI index check in `cortex_cli.py`

**Files:**
- Modify: `cortex/cortex_cli.py:776-785`

**Context:** `main()` currently just creates `CortexApp()` and runs it. We need to insert a check before that.

- [ ] **Step 1: Replace `main()` implementation**

In `cortex/cortex_cli.py`, replace lines 776-785:

```python
def main():
    """主函数 - 启动 TUI"""
    from cortex.tui.app import CortexApp

    app = CortexApp()
    app.run(mouse=True)
```

With:

```python
def main():
    """主函数 - 启动 TUI"""
    import os
    import sqlite3
    import sys
    from cortex.config import CortexConfig
    from cortex.tui.app import CortexApp
    from treesearch.treesearch import TreeSearch

    config = CortexConfig.load()
    index_path = config.index_path or os.path.join(config.search_path, ".cortex", "index.db")

    # Check if index exists and contains documents
    doc_count = 0
    if os.path.exists(index_path):
        try:
            conn = sqlite3.connect(index_path)
            cursor = conn.execute("SELECT COUNT(*) FROM documents")
            doc_count = cursor.fetchone()[0]
            conn.close()
        except Exception:
            pass  # Corrupt or missing table — treat as empty

    if doc_count == 0:
        search_path = config.search_path
        try:
            response = input(
                f"当前目录 '{search_path}' 尚未建立索引，是否创建？ [Y/n] "
            ).strip().lower()
        except EOFError:
            print("当前目录尚未建立索引，请在交互式终端中运行或先手动创建索引。")
            sys.exit(1)

        if response and response not in ("y", "yes"):
            print("已取消。如需进入 TUI，请先建立索引。")
            sys.exit(1)

        print("正在创建索引...")

        def on_progress(current_file: str, processed: int, total: int):
            print(f"Indexing [{processed}/{total}] {current_file}")

        try:
            ts = TreeSearch(search_path, db_path=index_path)
            ts.index(progress_callback=on_progress)
            print("索引创建完成。")
        except Exception as e:
            print(f"索引创建失败: {e}")
            sys.exit(1)

    app = CortexApp()
    app.run(mouse=True)
```

- [ ] **Step 2: Verify imports are correct**

`os`, `sqlite3`, and `sys` are standard library modules — no extra deps needed.
`CortexConfig`, `CortexApp`, and `TreeSearch` are already imported in the module.

- [ ] **Step 3: Commit**

```bash
git add cortex/cortex_cli.py
git commit -m "feat: check for index before TUI and prompt to build if missing"
```

---

### Task 4: Test `build_index()` progress callback

**Files:**
- Modify: `tests/test_indexer.py`

**Context:** We need to verify that `build_index()` calls `progress_callback` with the correct 3-argument signature.

- [ ] **Step 1: Add test for progress callback with new args**

Append to `tests/test_indexer.py`:

```python
import tempfile
from unittest.mock import MagicMock
from treesearch.indexer import build_index


async def test_build_index_progress_callback():
    """progress_callback should receive (file_path, processed, total)."""
    tmpdir = tempfile.mkdtemp()

    # Create two temp files
    md_path = os.path.join(tmpdir, "doc.md")
    with open(md_path, "w") as f:
        f.write("# Hello\n\nWorld\n")

    txt_path = os.path.join(tmpdir, "notes.txt")
    with open(txt_path, "w") as f:
        f.write("Some notes\n")

    db_path = os.path.join(tmpdir, "test.db")
    callback = MagicMock()

    await build_index(
        paths=[tmpdir],
        db_path=db_path,
        force=True,
        progress_callback=callback,
    )

    # Should have been called twice (once per file)
    assert callback.call_count == 2

    # First call: processed=1, total=2
    first_call = callback.call_args_list[0]
    assert first_call[0][1] == 1
    assert first_call[0][2] == 2

    # Second call: processed=2, total=2
    second_call = callback.call_args_list[1]
    assert second_call[0][1] == 2
    assert second_call[0][2] == 2

    # Cleanup
    import shutil
    shutil.rmtree(tmpdir, ignore_errors=True)
```

- [ ] **Step 2: Run the new test**

Run: `pytest tests/test_indexer.py::test_build_index_progress_callback -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_indexer.py
git commit -m "test: verify progress_callback receives processed/total counts"
```

---

### Task 5: Test `main()` pre-TUI logic

**Files:**
- Create: `tests/test_cortex_cli_main.py`

**Context:** We need to test three scenarios: (1) index exists → TUI launches, (2) no index + user says yes → index builds then TUI launches, (3) no index + user says no → exit.

- [ ] **Step 1: Create test file**

Create `tests/test_cortex_cli_main.py`:

```python
"""Tests for cortex.cortex_cli:main pre-TUI index check."""

import os
import sqlite3
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from cortex.cortex_cli import main


class TestMainPreTuiCheck:
    def _create_empty_index(self, db_path: str):
        """Create an index.db with a documents table but zero rows."""
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.execute("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY)")
        conn.commit()
        conn.close()

    def _create_index_with_doc(self, db_path: str):
        """Create an index.db with one document row."""
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.execute("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY)")
        conn.execute("INSERT INTO documents VALUES ('doc_1')")
        conn.commit()
        conn.close()

    @patch("cortex.cortex_cli.CortexApp")
    @patch("cortex.cortex_cli.CortexConfig")
    def test_skips_prompt_when_index_has_documents(self, MockConfig, MockApp):
        """If documents exist, main() should launch TUI immediately."""
        tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(tmpdir, ".cortex", "index.db")
        self._create_index_with_doc(db_path)

        mock_config = MagicMock()
        mock_config.search_path = tmpdir
        mock_config.index_path = db_path
        MockConfig.load.return_value = mock_config

        mock_app = MagicMock()
        MockApp.return_value = mock_app

        main()

        mock_app.run.assert_called_once_with(mouse=True)

        # Cleanup
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

    @patch("cortex.cortex_cli.CortexApp")
    @patch("cortex.cortex_cli.CortexConfig")
    @patch("cortex.cortex_cli.TreeSearch")
    @patch("builtins.input", return_value="y")
    def test_prompts_and_builds_index_when_empty(self, mock_input, MockTreeSearch, MockConfig, MockApp):
        """If no documents, user agrees, index builds, then TUI launches."""
        tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(tmpdir, ".cortex", "index.db")
        # No index file — doc_count will be 0

        mock_config = MagicMock()
        mock_config.search_path = tmpdir
        mock_config.index_path = db_path
        MockConfig.load.return_value = mock_config

        mock_ts = MagicMock()
        MockTreeSearch.return_value = mock_ts

        mock_app = MagicMock()
        MockApp.return_value = mock_app

        main()

        mock_input.assert_called_once()
        MockTreeSearch.assert_called_once_with(tmpdir, db_path=db_path)
        mock_ts.index.assert_called_once()
        # Verify progress_callback was passed
        call_kwargs = mock_ts.index.call_args[1]
        assert "progress_callback" in call_kwargs
        mock_app.run.assert_called_once_with(mouse=True)

        # Cleanup
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

    @patch("cortex.cortex_cli.CortexConfig")
    @patch("builtins.input", return_value="n")
    def test_exits_when_user_declines(self, mock_input, MockConfig):
        """If user declines, main() should print message and exit."""
        tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(tmpdir, ".cortex", "index.db")

        mock_config = MagicMock()
        mock_config.search_path = tmpdir
        mock_config.index_path = db_path
        MockConfig.load.return_value = mock_config

        with pytest.raises(SystemExit) as exc_info:
            main()

        assert exc_info.value.code == 1
        mock_input.assert_called_once()

        # Cleanup
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)

    @patch("cortex.cortex_cli.CortexConfig")
    @patch("builtins.input", side_effect=EOFError)
    def test_exits_on_eof_error(self, mock_input, MockConfig):
        """In non-interactive environments, EOFError should exit gracefully."""
        tmpdir = tempfile.mkdtemp()
        db_path = os.path.join(tmpdir, ".cortex", "index.db")

        mock_config = MagicMock()
        mock_config.search_path = tmpdir
        mock_config.index_path = db_path
        MockConfig.load.return_value = mock_config

        with pytest.raises(SystemExit) as exc_info:
            main()

        assert exc_info.value.code == 1

        # Cleanup
        import shutil
        shutil.rmtree(tmpdir, ignore_errors=True)
```

- [ ] **Step 2: Run the new tests**

Run: `pytest tests/test_cortex_cli_main.py -v`
Expected: All 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_cortex_cli_main.py
git commit -m "test: add tests for pre-TUI index check and build flow"
```

---

### Task 6: Full integration verification

- [ ] **Step 1: Run all tests**

Run: `pytest tests/test_indexer.py tests/test_tui_app.py tests/test_cortex_cli_main.py -v`
Expected: All tests pass.

- [ ] **Step 2: Manual smoke test (optional but recommended)**

In a temp directory with no `.cortex/index.db`:

```bash
cd /tmp/smoke-test
echo "# Hello" > readme.md
python -m cortex.cortex_cli
```

Expected behavior:
1. Terminal shows: `当前目录 '/tmp/smoke-test' 尚未建立索引，是否创建？ [Y/n]`
2. Press `Enter` (default Yes)
3. Terminal shows progress lines like `Indexing [1/1] /tmp/smoke-test/readme.md`
4. Terminal shows: `索引创建完成。`
5. TUI opens.

Run it again in the same directory:
Expected: TUI opens immediately with no prompt.

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: verify pre-TUI index check integration"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Check `index.db` existence and `documents` count — Task 3
- ✅ Terminal prompt `[Y/n]` — Task 3
- ✅ Default Yes (Enter) — Task 3 (`if response and response not in ("y", "yes")`)
- ✅ User decline → exit with message — Task 3 + Task 5 test
- ✅ User agree → full index build with progress — Task 3 + Task 1
- ✅ Progress shows `Indexing [N/M] filename` — Task 3 `on_progress`
- ✅ Index build failure → exit with error — Task 3 `except Exception`
- ✅ After build, enter TUI — Task 3
- ✅ Non-interactive environment (EOFError) — Task 3 + Task 5 test
- ✅ `progress_callback` signature change — Task 1 + Task 2

**Placeholder scan:** No TBD, TODO, or vague steps found.

**Type consistency:**
- `progress_callback(fp, processed_counter[0], total_files)` in `indexer.py`
- `def on_file_indexed(file_path: str, processed: int = 0, total: int = 0)` in `index_manager.py`
- `def on_progress(current_file: str, processed: int, total: int)` in `cortex_cli.py`
All signatures match.
