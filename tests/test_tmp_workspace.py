"""doclens/web_v2/tmp_workspace.py 单元测试。

临时工作区：`<workdir>/<data_dirname>/tmp/<session_id>/`；
覆盖目录创建、session_id 安全校验、单会话/全量清理。
"""
from pathlib import Path

import pytest

from doclens.config import data_dirname
from doclens.web_v2.tmp_workspace import (
    cleanup_all_tmp,
    cleanup_session_tmp,
    session_tmp_dir,
)


@pytest.fixture()
def workdir(tmp_path: Path) -> Path:
    return tmp_path


class TestSessionTmpDir:
    def test_creates_dir(self, workdir: Path):
        d = session_tmp_dir(workdir, "01JABC")
        assert d == workdir / data_dirname() / "tmp" / "01JABC"
        assert d.is_dir()

    def test_idempotent(self, workdir: Path):
        session_tmp_dir(workdir, "s1")
        d = session_tmp_dir(workdir, "s1")
        assert d.is_dir()

    @pytest.mark.parametrize("bad", ["", "../x", "a/b", "a\\b", "..", "a b"])
    def test_rejects_unsafe_session_id(self, workdir: Path, bad: str):
        with pytest.raises(ValueError):
            session_tmp_dir(workdir, bad)


class TestCleanupSessionTmp:
    def test_removes_existing(self, workdir: Path):
        d = session_tmp_dir(workdir, "s1")
        (d / "script.py").write_text("print(1)", encoding="utf-8")
        assert cleanup_session_tmp(workdir, "s1") is True
        assert not d.exists()

    def test_missing_dir_returns_false(self, workdir: Path):
        assert cleanup_session_tmp(workdir, "nonexistent") is False

    def test_rejects_unsafe_session_id(self, workdir: Path):
        assert cleanup_session_tmp(workdir, "../x") is False


class TestCleanupAllTmp:
    def test_removes_all_sessions(self, workdir: Path):
        for sid in ("s1", "s2", "s3"):
            d = session_tmp_dir(workdir, sid)
            (d / "f.py").write_text("x", encoding="utf-8")
        assert cleanup_all_tmp(workdir) == 3
        root = workdir / data_dirname() / "tmp"
        assert root.is_dir() and list(root.iterdir()) == []

    def test_missing_root_returns_zero(self, workdir: Path):
        assert cleanup_all_tmp(workdir) == 0

    def test_does_not_touch_other_data_dirs(self, workdir: Path):
        session_tmp_dir(workdir, "s1")
        other = workdir / data_dirname() / "tasks"
        other.mkdir(parents=True)
        cleanup_all_tmp(workdir)
        assert other.is_dir()
