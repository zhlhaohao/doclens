"""workdir_store（ADR-0043 最近工作目录）回归。

重点：``normalize_workdir`` / ``record_workdir`` / ``same_workdir`` 必须兼容
``str`` 与 ``os.PathLike``——启动链路 ``app._start_components`` 传 ``Path``
（曾因 ``path.strip()`` 抛 AttributeError 使后台组件线程整体夭折：
watcher/vision/git sync/MCP 全部未启动）。
"""
import os
from pathlib import Path

import pytest

from doclens.web_v2 import workdir_store
from doclens.web_v2.workdir_store import (
    normalize_workdir,
    record_workdir,
    remove_workdir,
    same_workdir,
)


@pytest.fixture(autouse=True)
def _isolated_store(tmp_path, monkeypatch):
    """把全局存储重定向到 tmp_path，避免污染真实 ~/.cortex/recent_workdirs.json。"""
    monkeypatch.setattr(workdir_store, "_store_path", lambda: tmp_path / "recent_workdirs.json")
    yield


class TestNormalize:
    def test_str_input(self, tmp_path):
        assert normalize_workdir(str(tmp_path)) == str(tmp_path)

    def test_pathlike_input(self, tmp_path):
        # 回归：启动链路传 Path，曾抛 AttributeError: 'WindowsPath' object has no attribute 'strip'
        assert normalize_workdir(tmp_path) == str(tmp_path)

    def test_strip_and_trailing_slash(self):
        norm = normalize_workdir("  C:/foo/bar/  ")
        assert norm == norm.rstrip("\\/")

    def test_expanduser(self):
        assert normalize_workdir("~").startswith(os.path.expanduser("~"))


class TestSame:
    def test_case_insensitive_on_windows(self):
        assert same_workdir("C:\\Foo\\Bar", "c:/foo/bar")


class TestRecordListRemove:
    def test_record_pathlike_and_list(self, tmp_path):
        record_workdir(tmp_path)  # Path 入参（启动链路口径）
        items = workdir_store.list_recent()
        assert len(items) == 1
        assert items[0]["path"] == str(tmp_path)
        assert items[0]["last_used"]

    def test_record_dedup_moves_to_top(self, tmp_path):
        a, b = tmp_path / "a", tmp_path / "b"
        a.mkdir(); b.mkdir()
        record_workdir(a)
        record_workdir(b)
        record_workdir(a)  # 再次记录 → 置顶去重
        items = workdir_store.list_recent()
        assert [it["path"] for it in items] == [str(a), str(b)]

    def test_list_filters_missing_dirs(self, tmp_path):
        gone = tmp_path / "gone"
        gone.mkdir()
        record_workdir(gone)
        gone.rmdir()
        assert workdir_store.list_recent() == []

    def test_remove(self, tmp_path):
        record_workdir(tmp_path)
        assert remove_workdir(tmp_path) is True
        assert workdir_store.list_recent() == []
        assert remove_workdir(tmp_path) is False
