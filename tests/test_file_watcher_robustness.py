"""FileWatcher 鲁棒性回归测试（AP-1/2/3 修复的锁死断言）。

- AP-1：handler 回调抛异常时派发线程不死（_invoke_callback 吞异常落日志）；
  _on_reindex_start 抛异常时 _reindexing 必须被复位（不永卡 True）。
- AP-2：reindex 进行中又有事件触发 _do_reindex 时记 _pending_rerun，
  _on_reindex_complete 完成后重挂防抖补一轮。
- AP-3：on_moved 的 dest 分支登记基线，原子保存（rename 覆盖）后第一次
  真实修改不被 prev=None 兜底分支吞掉。
"""
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from watchdog.events import FileModifiedEvent, FileMovedEvent

from doclens.file_watcher import FileWatcher, _ChangeHandler


# ---------- AP-3：on_moved 登记 dest 基线 ----------

def test_on_moved_records_dest_baseline(tmp_path: Path):
    """原子保存后 dest 文件应登记基线，紧随其后的真修改不被吞。"""
    seen: list[str] = []
    h = _ChangeHandler(seen.append, str(tmp_path))

    src = tmp_path / ".~atomic.tmp"
    dest = tmp_path / "docs" / "note.md"
    dest.parent.mkdir(parents=True)
    src.write_text("v1", encoding="utf-8")
    # 先创建 dest（让 on_moved 之前的基线不存在，模拟 rename 覆盖）
    dest.write_text("v1", encoding="utf-8")
    # 清掉 _init_baseline 的覆盖，模拟 dest 从未建档
    h._mod_snapshot.pop(h._snapshot_key(str(dest)), None)

    h.on_moved(FileMovedEvent(str(src), str(dest)))
    # dest 已登记基线
    assert h._snapshot_key(str(dest)) in h._mod_snapshot

    # 紧随其后的真修改（mtime/size 变化）应被识别为真修改并触发回调
    import time, os
    time.sleep(0.01)
    dest.write_text("v2-with-more-content", encoding="utf-8")
    os.utime(dest, None)
    before = len(seen)
    h.on_modified(FileModifiedEvent(str(dest)))
    assert len(seen) == before + 1
    assert seen[-1] == str(dest)


# ---------- AP-1：回调异常防护 ----------

def test_handler_callback_exception_does_not_propagate(tmp_path: Path):
    """handler 回调抛异常时不应外溢（保住 watchdog 派发线程）。"""
    def boom(_path):
        raise RuntimeError("callback exploded")

    h = _ChangeHandler(boom, str(tmp_path))
    f = tmp_path / "docs" / "note.md"
    f.parent.mkdir(parents=True)
    f.write_text("x", encoding="utf-8")

    # 不应抛
    h.on_created(FileModifiedEvent(str(f)))  # 用 ModifiedEvent 走 on_created 也行，重点是 _invoke_callback
    # 再来一次仍应正常工作（模拟线程未被杀死，后续事件继续派发）
    h.on_created(FileModifiedEvent(str(f)))


def test_on_reindex_start_exception_resets_reindexing(tmp_path: Path):
    """_on_reindex_start 抛异常时 _reindexing 必须复位，不永卡 True。"""
    idx = MagicMock()
    idx.search_path = str(tmp_path)

    def bad_start():
        raise RuntimeError("on_reindex_start exploded")

    w = FileWatcher(idx, debounce_seconds=0.01, on_reindex_start=bad_start)
    w._do_reindex()

    assert w._reindexing is False
    # 后续 _do_reindex 不应被幽灵锁挡住
    w._do_reindex()
    assert w._reindexing is False  # 仍然走完 except 复位路径


# ---------- AP-2：reindex 撞锁补账 ----------

def test_pending_rerun_triggers_followup_reindex(tmp_path: Path):
    """reindex 进行中撞锁 → 记 pending → 完成后重挂防抖补跑。"""
    idx = MagicMock()
    idx.search_path = str(tmp_path)

    # trigger_background_reindex 立即同步调 on_complete（简化时序）
    def fake_trigger(on_complete):
        on_complete(True, 0, 0, 0)

    idx.trigger_background_reindex.side_effect = fake_trigger

    w = FileWatcher(idx, debounce_seconds=0.01)

    # 模拟：第一次 reindex 占锁
    with w._state_lock:
        w._reindexing = True

    # 撞锁的 _do_reindex 应记 pending 而不是静默 return
    w._do_reindex()
    assert w._pending_rerun is True
    # trigger_background_reindex 未被调用（因为早退）
    idx.trigger_background_reindex.assert_not_called()

    # 手动清锁并触发完成回调（模拟 reindex 自然完成）
    with w._state_lock:
        w._reindexing = False
    w._on_reindex_complete(True, 0, 0, 0)

    # pending 被消费并重挂了防抖
    assert w._pending_rerun is False
    assert w._timer is not None

    w.stop()
