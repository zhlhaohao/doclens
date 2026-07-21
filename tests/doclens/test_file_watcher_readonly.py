"""模拟用户操作：watchdog 跑起来后调用 read_text() 读文件（仿 preview API），
观察 changed_count 是否增加 —— 用来定位根因到底是 watchdog 误报还是真修改。
"""

import time
from pathlib import Path

import pytest

from doclens.file_watcher import FileWatcher


class _IdleIdx:
    def __init__(self, search_path):
        self.search_path = search_path

    def trigger_background_reindex(self, on_complete=None):
        if on_complete:
            on_complete(True, 1, 0)


@pytest.fixture
def running_watcher(tmp_path):
    """启动 watchdog observer，等稳定后返回 watcher。"""
    f = tmp_path / "doc.md"
    f.write_text("# content\n\nbody text here\n")
    w = FileWatcher(_IdleIdx(str(tmp_path)), debounce_seconds=60)
    captured = []
    w._on_change_callback = lambda p: captured.append(p)
    w.start()
    # 等 observer 起来 + 启动初次扫描清空
    time.sleep(1.5)
    captured.clear()  # 吞掉启动噪音
    yield tmp_path, f, w, captured
    w.stop()


def test_read_text_does_not_increment_changed_count(running_watcher):
    """模拟 preview API 的 read_text() 读文件 → 不应增加 changed_count。"""
    tmp_path, f, w, captured = running_watcher
    before_count = w.status()["changed_count"]
    before_events = len(captured)

    # 模拟 preview API 的"纯读"操作
    for _ in range(5):
        text = Path(f).read_text(encoding="utf-8", errors="replace")
        assert "content" in text  # 真的读了

    # 等 watchdog 事件派发
    time.sleep(1.5)

    after_count = w.status()["changed_count"]
    after_events = len(captured)

    print(f"\n>>> before_count={before_count} after_count={after_count}")
    print(f">>> before_events={before_events} after_events={after_events}")
    print(f">>> file mtime_ns={f.stat().st_mtime_ns} size={f.stat().st_size}")

    # 核心断言：纯读不应增加 changed_count
    assert after_count == before_count, (
        f"纯读访问导致 changed_count 增加: {before_count} → {after_count} "
        f"(events: {captured})"
    )


def test_read_text_then_real_write_increments_once(running_watcher):
    """读 + 真实写入 → changed_count 应增加 1 次（不是读 + 写两次）。"""
    tmp_path, f, w, captured = running_watcher
    before_count = w.status()["changed_count"]

    # 读几次
    for _ in range(3):
        Path(f).read_text(encoding="utf-8", errors="replace")
    time.sleep(1.0)
    after_read = w.status()["changed_count"]

    # 真实写
    f.write_text("# content\n\nbody text here\n\nMORE\n")
    time.sleep(1.5)
    after_write = w.status()["changed_count"]

    print(f"\n>>> before={before_count} after_read={after_read} after_write={after_write}")
    print(f">>> events={captured}")

    assert after_read == before_count, f"读操作增加了 count: {before_count} → {after_read}"
    # 真实写至少 1 次（debounce 60s 内只触发 1 次 reindex，但 modified 事件可能多个）
    assert after_write > after_read, "真实写未触发 changed_count"