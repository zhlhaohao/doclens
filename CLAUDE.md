# Cortex CLAUDE.md

## 项目概述

Cortex — 结构感知文档检索工具，使用 SQLite FTS5/BM25 全文索引，支持 Markdown、Python、JavaScript、PDF、DOCX 等多种文件类型。

## 测试方法论

### 1. 单元测试 (Unit Tests)

**框架:** `pytest` + `unittest.mock`

**位置:** `tests/` 目录

**示例 — 带 mock 的单元测试:**
```python
from unittest.mock import patch, MagicMock
from io import StringIO

from cortex.cortex_cli import _cli_search

class TestSearchCommand:
    @patch("cortex.cortex_cli.IndexManager")
    @patch("cortex.cortex_cli.CortexConfig")
    def test_search_calls_format_results(self, MockConfig, MockIdx):
        mock_config = MagicMock()
        mock_config.max_results = 20
        mock_idx = MagicMock()
        mock_idx.load_or_build_index = MagicMock()
        mock_idx.search.return_value = ([], [])

        args = MagicMock()
        args.query = ["test", "query"]

        _cli_search(args, mock_config, mock_idx)
        mock_idx.load_or_build_index.assert_called_once()
        mock_idx.search.assert_called_once()
```

**运行:**
```bash
python -m pytest tests/test_cli_subcommands.py -v
```

---

### 2. E2E 测试 — Textual Pilot

**用途:** TUI 功能测试，在真实终端中模拟用户交互

**位置:** `tests/e2e/` 目录

**示例 — 搜索 E2E 测试:**
```python
import pytest
from cortex.tui.app import CortexApp

def test_search_basic():
    app = CortexApp()
    async with app.run_test() as pilot:
        # 输入搜索命令
        await pilot.click("#cmd-input")
        await pilot.paste("/search test")
        await pilot.pause(2)

        # 验证结果
        content = app.query_one("#content-area")
        assert "test" in content.inner_text()
```

**运行:**
```bash
python -m pytest tests/e2e/test_e2e_search.py -v
```

**关键方法:**
- `app.run_test()` — 启动测试模式
- `pilot.click(selector)` — 点击控件
- `pilot.paste(text)` — 粘贴文本
- `pilot.press("enter")` — 按键
- `pilot.pause(seconds)` — 等待异步操作

---

### 3. 快照测试 (Snapshot Testing)

**用途:** 捕获并验证复杂输出的精确格式

```python
def test_search_output_format(tmp_path):
    from cortex.cortex_cli import _cli_capture_search

    result = _cli_capture_search("test query", index_path=tmp_path)
    snapshot_path = tmp_path / "search_snapshot.txt"
    snapshot_path.write_text(result)

    expected = snapshot_path.read_text()
    assert result == expected, f"Output changed. Diff:\n{result}"
```

---

### 4. CLI 集成测试

**测试 `main()` 入口时需 mock `sys.argv`:**

```python
@patch("sys.argv", ["cortex"])
@patch("cortex.tui.app.CortexApp")
@patch("cortex.config.CortexConfig")
def test_main_launches_tui(self, MockConfig, MockApp):
    from cortex.cortex_cli import main
    main()
    MockApp.return_value.run.assert_called_once_with(mouse=True)
```

---

### 5. 子代理驱动开发 (Subagent-Driven Development)

大型实现任务使用 subagent 两阶段审查流程：

**流程:**
```
dispatch implementer → implementer commits
    → spec reviewer (compliance check)
        → code quality reviewer
            → next task
```

**执行方式:**
```bash
# 启动 subagent 执行
/skill subagent-driven-development
```

---

### 运行所有测试

```bash
# 单元测试
python -m pytest tests/ -v

# E2E 测试（需要终端环境）
python -m pytest tests/e2e/ -v

# 带覆盖率
python -m pytest tests/ --cov=cortex --cov-report=term-missing
```

---

### 测试数据

测试用数据位于 `tests/test_data/` 目录，包含多种文件类型的样本用于索引测试。

---

## 开发命令

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 创建虚拟环境
python -m venv .venv
source .venv/Scripts/activate  # Windows
pip install -e "."

# 运行 CLI
python -m cortex search <query>
python -m cortex ai <message>
python -m cortex index [--force]
python -m cortex status
python -m cortex  # 启动 TUI

# 启动 TUI（开发时）
python -c "from cortex.tui.app import CortexApp; CortexApp().run()"
```
