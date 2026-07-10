"""trigger_background_reindex(force, on_progress) 扩展测试。"""
import os
import threading

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager


def _make_idx(tmp_path):
    config = CortexConfig(
        search_path=str(tmp_path),
        index_path=str(tmp_path / ".cortex" / "index.db"),
    )
    return IndexManager(config)


def test_trigger_force_invokes_on_progress_and_on_complete(temp_workdir):
    idx = _make_idx(temp_workdir)
    progress = []
    result = {}
    done = threading.Event()

    def on_progress(file_path, n):
        progress.append((os.path.basename(file_path), n))

    def on_complete(success, doc_count, failed_count):
        result.update(success=success, doc_count=doc_count, failed_count=failed_count)
        done.set()

    t = idx.trigger_background_reindex(force=True, on_progress=on_progress, on_complete=on_complete)
    assert t is not None
    t.join(timeout=120)
    assert done.is_set(), "on_complete 未在超时内调用"
    assert result["success"] is True
    assert result["doc_count"] >= 1  # temp_workdir 至少 doc1.md/data.csv 被索引
    assert len(progress) >= 1
    counts = [n for _, n in progress]
    assert counts == sorted(counts)  # indexed_count 单调递增
    assert counts[-1] == len(progress)


def test_trigger_defaults_no_force_no_progress(temp_workdir):
    """不传 force/on_progress 时向后兼容（无回调也能正常完成）。"""
    idx = _make_idx(temp_workdir)
    done = threading.Event()
    result = {}

    def on_complete(success, doc_count, failed_count):
        result.update(success=success, doc_count=doc_count)
        done.set()

    t = idx.trigger_background_reindex(on_complete=on_complete)
    t.join(timeout=120)
    assert done.is_set()
    assert result["success"] is True
