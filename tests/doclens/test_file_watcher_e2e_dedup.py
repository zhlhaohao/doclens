"""真实 watchdog observer 下的 dedup 端到端测试。

之前 _ChangeHandler 的单元测试只验证了逻辑层面；这里启动真正的
Observer，在临时目录里创建文件，等 observer 起来后：
1. 触发一次"读"模拟（构造 repeated modified 事件 → 检查 dedup）
2. 真实写入文件 → 触发 on_modified

目的：在真实 watchdog 事件流下复现用户的"点文件 → badge 闪"现象，
确认 dedup 是否真生效。
"""

import os
import time
from threading import Event

import pytest

from doclens.file_watcher import FileWatcher


class _IdleIdx:
    """不真实 reindex，只挂起 trigger。"""
    def __init__(self, search_path):
        self.search_path = search_path

    def trigger_background_reindex(self, on_complete=None):
        # 立即完成，模拟小库
        if on_complete:
            on_complete(True, 1, 0)


@pytest.fixture
def workspace(tmp_path):
    """创建工作目录 + 一个 md 文件 + 启动 watcher。"""
    f = tmp_path / "note.md"
    f.write_text("# hello\n")
    idx = _IdleIdx(str(tmp_path))
    w = FileWatcher(idx, debounce_seconds=60)  # 大 debounce 防止定时器自动清零
    captured = []
    w._on_change_callback = lambda p: captured.append(p)
    ok = w.start()
    assert ok, "watchdog 不可用"
    # 等 observer 启动 + 接收初始事件（如果有）
    time.sleep(0.3)
    yield tmp_path, f, w, captured
    w.stop()


def _trigger_modified(file_path: str):
    """通过 stat + touch 不行——直接调用 handler 模拟 watchdog 事件。"""
    pass  # 用 _on_change 直接喂给 FileWatcher 不算——那不走 dedup。
    # 真实方式：修改文件 → 等 observer。


def test_real_write_triggers_callback(workspace):
    """真实写入文件应触发 on_change_callback 一次（不计 watchdog 启动时的初次事件）。"""
    tmp_path, f, w, captured = workspace
    # 重置 captured（吞掉启动时的初次报告）
    captured.clear()
    # 真实修改
    time.sleep(0.05)
    f.write_text("# hello\n\nmore\n")
    time.sleep(0.5)  # 等 observer + handler 派发
    assert any(str(f) in p for p in captured), \
        f"真实修改未被检测: captured={captured}"


def test_read_only_does_not_trigger_callback(workspace):
    """模拟"读访问"→ 反复 stat 不应触发 on_change_callback。

    由于 watchdog 在 Windows 上对纯读访问也可能报 modified，
    我们通过 _on_modified 直接调用 _ChangeHandler 来模拟：
    """
    tmp_path, f, w, captured = workspace
    # 不重置 captured（因为启动事件可能已经在快照里）
    # 关键测试：连续触发 on_modified 但文件不变 → 不应新增 callback
    before = len(captured)
    # 拿到底层的 _ChangeHandler（_observer.daemon → handler 在第一个 watch 里）
    # watchdog 私有路径：observer._watches 不可靠；改用直接构造一个 handler 测
    from doclens.file_watcher import _ChangeHandler
    h = _ChangeHandler(
        callback=lambda p: captured.append(p),
        search_path=str(tmp_path),
    )
    # 第一次：首次见到 → 触发
    h.on_modified(type("E", (), {"is_directory": False, "src_path": str(f), "dest_path": ""})())
    first_count = len(captured)
    # 后续重复 modified，文件没真变 → 不触发
    h.on_modified(type("E", (), {"is_directory": False, "src_path": str(f), "dest_path": ""})())
    h.on_modified(type("E", (), {"is_directory": False, "src_path": str(f), "dest_path": ""})())
    h.on_modified(type("E", (), {"is_directory": False, "src_path": str(f), "dest_path": ""})())
    assert len(captured) == first_count, \
        f"读访问触发了 callback: {len(captured) - first_count} 次"
    # 真实修改 → 应触发
    f.write_text("# hello\n\nchanged\n")
    h.on_modified(type("E", (), {"is_directory": False, "src_path": str(f), "dest_path": ""})())
    assert len(captured) == first_count + 1
    w.stop()


def test_watchdog_initial_scan_does_not_phantom_trigger(workspace):
    """watchdog 启动后对已有文件不应误报 modified（如果快照机制正确）。"""
    tmp_path, f, w, captured = workspace
    # 等 watchdog 启动稳定（防止启动阶段的初次扫描噪音）
    time.sleep(1.0)
    # 此时 captured 应该有文件（启动扫描）
    initial = len(captured)
    # 不操作文件
    time.sleep(1.0)
    # 不应有新增（启动扫描已经记录在快照里）
    # 注：实际启动行为依赖平台；这里只验证不增加
    final = len(captured)
    assert final == initial, \
        f"无操作时仍新增事件：{initial} → {final}"