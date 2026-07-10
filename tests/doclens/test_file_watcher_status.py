"""FileWatcher.status() 可观测状态测试。"""
import time

from doclens.file_watcher import FileWatcher


class FakeIdx:
    """假 IndexManager：trigger_background_reindex 同步调用 on_complete，便于测试。"""
    search_path = "/tmp/__doclens_test__"

    def __init__(self, result=(True, 5, 0)):
        self._result = result

    def trigger_background_reindex(self, on_complete=None):
        success, doc_count, failed = self._result
        if on_complete:
            on_complete(success, doc_count, failed)


def test_status_initial_values():
    w = FileWatcher(FakeIdx())
    st = w.status()
    assert st == {
        "running": False,
        "reindexing": False,
        "changed_count": 0,
        "last_reindex_at": None,
        "last_doc_count": None,
        "last_success": None,
    }
    w.stop()


def test_on_change_increments_changed_count():
    w = FileWatcher(FakeIdx())
    w._on_change("/tmp/a.md")
    w._on_change("/tmp/b.md")
    assert w.status()["changed_count"] == 2
    w.stop()


def test_do_reindex_clears_count_and_updates_last():
    w = FileWatcher(FakeIdx())
    w._on_change("/tmp/a.md")
    assert w.status()["changed_count"] == 1
    before = time.time()
    w._do_reindex()  # FakeIdx 同步完成 → _on_reindex_complete 立即触发
    st = w.status()
    assert st["changed_count"] == 0
    assert st["reindexing"] is False
    assert st["last_doc_count"] == 5
    assert st["last_success"] is True
    assert st["last_reindex_at"] is not None
    assert st["last_reindex_at"] >= before
    w.stop()


def test_do_reindex_skips_when_already_reindexing():
    w = FileWatcher(FakeIdx())
    # 手动置 reindexing 模拟进行中
    w.reindexing = True
    w._do_reindex()  # 应直接 return，不更新 last_*
    assert w.status()["last_doc_count"] is None
    w.stop()


def test_do_reindex_failure_marks_last_success_false():
    w = FileWatcher(FakeIdx(result=(False, 0, 0)))
    w._do_reindex()
    st = w.status()
    assert st["last_success"] is False
    assert st["last_doc_count"] == 0
    assert st["reindexing"] is False
    w.stop()


def test_changed_count_cleared_on_reindex_complete_when_incremented_during():
    """reindex 进行中累加的 changed_count 在完成回调里清零（不卡住）。"""
    pending = []

    class SlowIdx:
        """trigger 不立即完成，挂起 on_complete 模拟 reindex 进行中。"""
        search_path = "/tmp/__doclens_test__"

        def trigger_background_reindex(self, on_complete=None):
            pending.append(on_complete)  # 不立即完成

    w = FileWatcher(SlowIdx())
    w._do_reindex()  # reindexing=True, changed_count 已在 _do_reindex 清零, trigger 挂起
    assert w.status()["reindexing"] is True
    # reindex 进行中文件变化
    w._on_change("/tmp/a.md")
    w._on_change("/tmp/b.md")
    assert w.status()["changed_count"] == 2
    # reindex 完成
    pending[0](True, 5, 0)
    st = w.status()
    assert st["reindexing"] is False
    assert st["changed_count"] == 0   # 修复后清零
    assert st["last_doc_count"] == 5
    w.stop()
