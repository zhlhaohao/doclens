"""db 锁冲突保护：build_index 返回空（如锁冲突被跳过）时，_bg_work 不得清空现有索引。

回归：外部改名触发 FileWatcher reindex，若此时 db 文件锁被并发占用，
build_index 会返回 []。修复前 _bg_work 用空结果覆盖 self._ts.documents，
导致 files API 的 indexed 标志全部消失（已索引列空白）。修复后保留旧索引。
"""
import threading
from unittest.mock import patch

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager
from treesearch import TreeSearch


def _make_idx(tmp_path):
    config = CortexConfig(
        search_path=str(tmp_path),
        index_path=str(tmp_path / ".cortex" / "index.db"),
    )
    return IndexManager(config)


def test_bg_reindex_preserves_documents_when_build_returns_empty(temp_workdir):
    """build_index 返回空（模拟锁冲突）时，现有索引不被清空。"""
    idx = _make_idx(temp_workdir)
    idx.load_or_build_index()
    base_count = len(idx.documents)
    assert base_count > 0  # 前置：已建好索引

    # 模拟 build_index 因 db 锁冲突返回空：patch TreeSearch.index 使 new_ts.documents 清空
    def _empty_index(self, *a, **k):
        self.documents = []
        return []

    done = threading.Event()
    result = {}

    def on_complete(success, doc_count, failed_count):
        result.update(success=success, doc_count=doc_count, failed=failed_count)
        done.set()

    with patch.object(TreeSearch, "index", _empty_index):
        idx.trigger_background_reindex(on_complete=on_complete)
        done.wait(60)

    assert done.is_set(), "后台 reindex 未在超时内完成"
    # 关键：现有索引保留，不被空结果清空
    assert len(idx.documents) == base_count, (
        f"锁冲突时现有索引被清空：期望保留 {base_count}，实际 {len(idx.documents)}"
    )
    # on_complete 报告的是保留的文档数（而非 0），避免前端徽标/统计异常
    assert result["doc_count"] == base_count
