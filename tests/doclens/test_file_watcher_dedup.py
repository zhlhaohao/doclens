"""_ChangeHandler modified 事件去重测试。

问题背景：watchdog 在 Windows 上对纯读取也会触发 on_modified
（典型场景：atime 更新被报告为 modified）。结果是用户点开文件预览
→ 后端读文件 → watchdog 误报 → watch-badge 短暂变 "待更新1"。
"""

import os

import pytest

from doclens.file_watcher import _ChangeHandler


class _FakeEvent:
    def __init__(self, src_path: str, is_directory: bool = False):
        self.is_directory = is_directory
        self.src_path = src_path
        self.dest_path = ""


@pytest.fixture
def sample_file(tmp_path):
    f = tmp_path / "doc.md"
    f.write_text("# hi\n")
    return f


def _make_handler(captured, search_path):
    return _ChangeHandler(
        callback=lambda p: captured.append(p),
        search_path=search_path,
    )


def test_first_modified_event_is_always_counted(sample_file, tmp_path):
    """首次见到文件的 modified 事件总要触发 callback（保留兼容性）。"""
    captured = []
    h = _make_handler(captured, str(tmp_path))
    h.on_modified(_FakeEvent(str(sample_file)))
    assert captured == [str(sample_file)]


def test_repeated_modified_without_real_change_is_deduped(sample_file, tmp_path):
    """mtime/size 未变的重复 modified 不应触发 callback（atime-only 误报）。"""
    captured = []
    h = _make_handler(captured, str(tmp_path))
    # 首次必触发
    h.on_modified(_FakeEvent(str(sample_file)))
    assert len(captured) == 1
    # 后续 modified，文件内容未变 → 应被去重
    h.on_modified(_FakeEvent(str(sample_file)))
    h.on_modified(_FakeEvent(str(sample_file)))
    assert captured == [str(sample_file)]


def test_real_content_change_triggers_callback(sample_file, tmp_path):
    """size 变化时 modified 必须触发 callback。"""
    captured = []
    h = _make_handler(captured, str(tmp_path))
    h.on_modified(_FakeEvent(str(sample_file)))
    assert len(captured) == 1
    # 写入更多内容 → size 变 → 触发
    sample_file.write_text("# hi\n\nmore content\n")
    h.on_modified(_FakeEvent(str(sample_file)))
    assert len(captured) == 2


def test_mtime_change_triggers_callback(sample_file, tmp_path):
    """mtime 变（即使 size 同）也应触发 callback。"""
    captured = []
    h = _make_handler(captured, str(tmp_path))
    h.on_modified(_FakeEvent(str(sample_file)))
    assert len(captured) == 1
    # 显式推进 mtime（某些 FS 上 write 太快 mtime 不变，所以用 utime）
    st = os.stat(sample_file)
    os.utime(sample_file, (st.st_atime + 10, st.st_mtime + 10))
    h.on_modified(_FakeEvent(str(sample_file)))
    assert len(captured) == 2


def test_modified_on_disappeared_file_does_not_trigger(tmp_path):
    """modified 事件对应的文件已被删，不应记录 callback（on_deleted 会单独处理）。"""
    captured = []
    h = _make_handler(captured, str(tmp_path))
    ghost = tmp_path / "gone.md"  # 不创建
    h.on_modified(_FakeEvent(str(ghost)))
    assert captured == []


def test_modified_on_directory_is_ignored(tmp_path):
    """目录事件不在 _should_handle 内，handler 必须忽略。"""
    captured = []
    h = _make_handler(captured, str(tmp_path))
    h.on_modified(_FakeEvent(str(tmp_path), is_directory=True))
    assert captured == []