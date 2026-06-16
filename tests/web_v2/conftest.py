"""pytest fixtures for web_v2 tests."""
import os
import sys
from pathlib import Path

import pytest


@pytest.fixture
def temp_workdir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """创建临时工作目录，含几个示例文档。"""
    (tmp_path / "doc1.md").write_text("# Doc 1\n\nHello world from doc1.", encoding="utf-8")
    (tmp_path / "doc2.py").write_text("def hello():\n    return 'world'\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    return tmp_path


@pytest.fixture
def env_cortex_config(temp_workdir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """配置 CORTEX_* 环境变量指向临时目录。"""
    monkeypatch.setenv("CORTEX_WORK_DIR", str(temp_workdir / ".cortex"))
    monkeypatch.setenv("CORTEX_INDEX_PATH", str(temp_workdir / ".cortex" / "index.db"))
