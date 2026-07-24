"""后台 reindex 完成后，内存 documents 应立即反映新索引。

files API 的 indexed 标志直接读 idx.documents（不经 load_or_build_index），
故后台 reindex 完成后必须刷新内存 documents，否则改名/新增文件的 indexed
永不更新。回归场景：改名后新文件应出现在 indexed 集合中。
"""
import os
import threading
from pathlib import Path

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager
from doclens.web_v2.api.files import _indexed_paths


def _make_idx(tmp_path: Path) -> IndexManager:
    config = CortexConfig(
        search_path=str(tmp_path),
        index_path=str(tmp_path / ".cortex" / "index.db"),
    )
    return IndexManager(config)


def test_bg_reindex_refreshes_documents_for_renamed_file(temp_workdir: Path):
    idx = _make_idx(temp_workdir)
    base = Path(idx.search_path)
    idx.load_or_build_index()

    # 初始：doc1.md 已索引
    assert "doc1.md" in _indexed_paths(idx, base)

    # 改名 doc1.md -> renamed.md（触发 FileWatcher 的典型场景）
    os.rename(temp_workdir / "doc1.md", temp_workdir / "renamed.md")

    # 后台 reindex（force=False，模拟 FileWatcher 触发的增量重建）
    done = threading.Event()

    def on_complete(success, doc_count, failed_count):
        done.set()

    t = idx.trigger_background_reindex(on_complete=on_complete)
    assert t is not None
    t.join(timeout=120)
    assert done.is_set(), "后台 reindex 未在超时内完成"

    # 关键：不再调用 load_or_build_index，直接读 idx.documents（files API 的真实路径）
    indexed_after = _indexed_paths(idx, base)
    assert "renamed.md" in indexed_after, f"改名后新文件未反映到 documents: {indexed_after}"
    assert "doc1.md" not in indexed_after, f"旧文件未从 documents 移除: {indexed_after}"
