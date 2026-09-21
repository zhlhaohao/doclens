"""FileWatcher 索引范围排除语义测试（handler 层，平台无关）。

数据目录（开发 .cortex / 发行版 .doclens）、影子 Markdown（._*.md）与
.gitignore 命中文件的事件必须被 _should_handle 丢弃——不触发 reindex、
不产生回调。这是「写日志 → IN_MODIFY → 自反馈」链路在 doclens 侧的
防线之一（watchdog 自身 debug 日志另由 logging 配置压制到 WARNING）。
"""
from pathlib import Path

from watchdog.events import FileModifiedEvent

from doclens.config import data_dirname
from doclens.file_watcher import _ChangeHandler


def _handler(tmp_path: Path) -> _ChangeHandler:
    """只考察 _should_handle 返回值的测试用（回调丢弃）。"""
    return _ChangeHandler(lambda _path: None, str(tmp_path))


def test_data_dir_files_excluded(tmp_path: Path):
    seen: list = []
    h = _ChangeHandler(seen.append, str(tmp_path))
    log_file = tmp_path / data_dirname() / "logs" / "debug_20260921.log"
    assert h._should_handle(str(log_file)) is False
    h.on_modified(FileModifiedEvent(str(log_file)))
    assert seen == []


def test_data_dir_nested_files_excluded(tmp_path: Path):
    h = _handler(tmp_path)
    db = tmp_path / data_dirname() / "rewind" / "session-1" / "backup.md"
    assert h._should_handle(str(db)) is False


def test_supported_file_outside_data_dir_passes(tmp_path: Path):
    (tmp_path / "docs").mkdir()
    h = _handler(tmp_path)
    assert h._should_handle(str(tmp_path / "docs" / "note.md")) is True


def test_unsupported_extension_excluded(tmp_path: Path):
    h = _handler(tmp_path)
    assert h._should_handle(str(tmp_path / "tools" / "binary.exe")) is False


def test_shadow_md_excluded(tmp_path: Path):
    """索引器生成的影子 Markdown（._x.md）事件丢弃（与索引 walk 同规则）。"""
    h = _handler(tmp_path)
    shadow = tmp_path / "docs" / "._paper.pdf.md"
    assert h._should_handle(str(shadow)) is False


def test_gitignored_file_excluded(tmp_path: Path):
    """索引根 .gitignore 命中的文件事件被丢弃（与索引器同规则源）。"""
    (tmp_path / ".gitignore").write_text("generated/\n*.draft.md\n", encoding="utf-8")
    (tmp_path / "generated").mkdir()
    seen: list = []
    h = _ChangeHandler(seen.append, str(tmp_path))

    gen = tmp_path / "generated" / "out.md"
    draft = tmp_path / "docs" / "note.draft.md"
    assert h._should_handle(str(gen)) is False
    assert h._should_handle(str(draft)) is False
    h.on_modified(FileModifiedEvent(str(gen)))
    assert seen == []


def test_gitignore_absent_no_filter(tmp_path: Path):
    """无 .gitignore 时不过滤（行为与旧版一致）。"""
    (tmp_path / "docs").mkdir()
    h = _handler(tmp_path)
    assert h._gitignore_spec is None
    assert h._should_handle(str(tmp_path / "docs" / "note.draft.md")) is True
