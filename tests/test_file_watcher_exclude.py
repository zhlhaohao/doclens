"""FileWatcher 数据目录排除语义测试（handler 层，平台无关）。

数据目录（开发 .cortex / 发行版 .doclens）内的高频写入（日志 / index.db /
sessions.db）事件必须被 _should_handle 丢弃——不触发 reindex、不产生
回调。这是「写日志 → IN_MODIFY → 自反馈」链路在 doclens 侧的最后防线
（watchdog 自身 debug 日志另由 logging 配置压制到 WARNING）。
"""
from pathlib import Path

from doclens.config import data_dirname
from doclens.file_watcher import _ChangeHandler


def _handler(tmp_path: Path, seen: list):
    return _ChangeHandler(seen.append, str(tmp_path))


def test_data_dir_files_excluded(tmp_path: Path):
    seen: list = []
    h = _handler(tmp_path, seen)
    log_file = tmp_path / data_dirname() / "logs" / "debug_20260921.log"
    assert h._should_handle(str(log_file)) is False
    h.on_modified(_Evt(str(log_file)))
    assert seen == []


def test_data_dir_nested_files_excluded(tmp_path: Path):
    seen: list = []
    h = _handler(tmp_path, seen)
    db = tmp_path / data_dirname() / "rewind" / "session-1" / "backup.md"
    assert h._should_handle(str(db)) is False


def test_supported_file_outside_data_dir_passes(tmp_path: Path):
    seen: list = []
    h = _handler(tmp_path, seen)
    doc = tmp_path / "docs" / "note.md"
    assert h._should_handle(str(doc)) is True


def test_unsupported_extension_excluded(tmp_path: Path):
    seen: list = []
    h = _handler(tmp_path, seen)
    exe = tmp_path / "tools" / "binary.exe"
    assert h._should_handle(str(exe)) is False


class _Evt:
    """最小 watchdog 事件桩（on_modified 只用 is_directory/src_path）。"""

    def __init__(self, src_path: str):
        self.src_path = src_path
        self.is_directory = False
