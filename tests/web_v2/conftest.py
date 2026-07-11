"""pytest fixtures for web_v2 tests."""
import os
import sys
from pathlib import Path

import pytest

# ---- 修正 editable install 的 MAPPING（worktree 共享主仓库 .venv）----
# doclens 的 editable finder 把 doclens/planify/treesearch 映射到「安装时的源目录」
# （模块级 MAPPING）。多 worktree 共享同一 .venv 时，该目录可能是已删除的旧 worktree
# （如 0708-3），失效后 planify 等子包的 find_spec 走 `PathFinder(path=[失效目录])`
# 返回 None，中断 import。把 MAPPING 强制指向本仓库根，确保测试用本地代码。
import importlib as _importlib

_REPO_ROOT = Path(__file__).resolve().parents[2]
for _finder in sys.meta_path:
    _mod_name = getattr(_finder, "__module__", "")
    if "editable" not in _mod_name:
        continue
    _mod = sys.modules.get(_mod_name) or _importlib.import_module(_mod_name)
    _mapping = getattr(_mod, "MAPPING", None)
    if isinstance(_mapping, dict):
        for _pkg in ("doclens", "planify", "treesearch"):
            _sub = _REPO_ROOT / _pkg
            if _sub.is_dir():
                _mapping[_pkg] = str(_sub)


@pytest.fixture
def temp_workdir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """创建临时工作目录，含几个示例文档。"""
    (tmp_path / "doc1.md").write_text("# Doc 1\n\nHello world from doc1.", encoding="utf-8")
    (tmp_path / "doc2.py").write_text("def hello():\n    return 'world'\n", encoding="utf-8")
    (tmp_path / "data.csv").write_text(
        "name,age\nAlice,30\nBob,25\n",
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    return tmp_path


@pytest.fixture
def env_cortex_config(temp_workdir: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """配置 CORTEX_* 环境变量指向临时目录。"""
    monkeypatch.setenv("CORTEX_WORK_DIR", str(temp_workdir / ".cortex"))
    monkeypatch.setenv("CORTEX_INDEX_PATH", str(temp_workdir / ".cortex" / "index.db"))
