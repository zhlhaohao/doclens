# Cortex CLAUDE.md

## 项目概述

Cortex — 结构感知文档检索工具，使用 SQLite FTS5/BM25 全文索引，支持 Markdown、Python、JavaScript、PDF、DOCX 等多种文件类型。

## CLI 测试方法

### 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行指定测试文件
python -m pytest tests/test_cli_subcommands.py -v
python -m pytest tests/test_cortex_cli_main.py -v

# 运行指定测试类
python -m pytest tests/test_cli_subcommands.py::TestSearchCommand -v

# 带覆盖率
python -m pytest tests/ --cov=cortex --cov-report=term-missing
```

### 编写 CLI 测试

**测试 `main()` 入口时需 mock `sys.argv`：**

```python
import pytest
from unittest.mock import patch, MagicMock

@patch("sys.argv", ["cortex"])
@patch("cortex.tui.app.CortexApp")
@patch("cortex.config.CortexConfig")
def test_main_launches_tui(self, MockConfig, MockApp):
    from cortex.cortex_cli import main
    main()
    MockApp.return_value.run.assert_called_once_with(mouse=True)
```

**使用 mock 测试 CLI 命令处理器：**

```python
from unittest.mock import patch, MagicMock

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

    from cortex.cortex_cli import _cli_search
    _cli_search(args, mock_config, mock_idx)

    mock_idx.load_or_build_index.assert_called_once()
    mock_idx.search.assert_called_once()
```

---

## 开发命令

```bash
# 创建虚拟环境
python -m venv .venv
source .venv/Scripts/activate  # Windows
pip install -e "."

# 运行 CLI
python -m cortex search <query>   # 搜索
python -m cortex ai <message>     # AI 对话
python -m cortex index [--force]  # 重建索引
python -m cortex status            # 查看状态
python -m cortex                  # 启动 TUI

# 启动 TUI（开发时）
python -c "from cortex.tui.app import CortexApp; CortexApp().run()"
```
