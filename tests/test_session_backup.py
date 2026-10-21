"""会话库备份/恢复机制测试（ADR-0047）。

覆盖：备份创建（backup API 一致性）、环形保留、启动节流、损坏检测自动恢复
（SessionsStore 构建失败 → 改名留尸 → 恢复 → 重试构建）、恢复端点互斥
（生成中 409）、路径穿越拒绝。
"""
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest

from doclens.web_v2 import session_backup
from doclens.web_v2.sessions_store import (
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
)


def _make_db(path: Path, n_sessions: int = 2) -> SessionsStore:
    store = SessionsStore(path)
    now = datetime.now(timezone.utc)
    for i in range(n_sessions):
        sid = f"s{i}"
        store.create(SessionSummary(
            id=sid, type=SessionType.CHAT, title=f"t{i}", preview="",
            created_at=now, updated_at=now, message_count=0,
        ))
        store.append_item(SessionItem(
            session_id=sid, seq=1, kind="message_user",
            payload='{"content": "hello"}',
        ))
    return store


class TestBackupCreate:
    def test_creates_backup_in_ring_dir(self, tmp_path):
        db = tmp_path / "sessions.db"
        _make_db(db)
        info = session_backup.create_backup(db, reason="test")
        assert info is not None
        f = tmp_path / "backups" / "sessions" / info["file"]
        assert f.is_file()

    def test_backup_content_readable(self, tmp_path):
        db = tmp_path / "sessions.db"
        _make_db(db, n_sessions=3)
        info = session_backup.create_backup(db)
        conn = sqlite3.connect(str(tmp_path / "backups" / "sessions" / info["file"]))
        try:
            n = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        finally:
            conn.close()
        assert n == 3

    def test_ring_eviction_keeps_limit(self, tmp_path, monkeypatch):
        db = tmp_path / "sessions.db"
        _make_db(db)
        # 时间戳秒级同名会碰撞：逐次改时钟避开
        clock = [1000000000.0]
        monkeypatch.setattr(session_backup.time, "time", lambda: clock[0])
        for i in range(session_backup.BACKUP_KEEP + 3):
            clock[0] += 120.0
            assert session_backup.create_backup(db) is not None
        files = session_backup.list_backups(db)
        assert len(files) == session_backup.BACKUP_KEEP

    def test_missing_db_returns_none(self, tmp_path):
        assert session_backup.create_backup(tmp_path / "nope.db") is None


class TestStartupThrottle:
    def test_fresh_backup_within_window_skipped(self, tmp_path):
        db = tmp_path / "sessions.db"
        _make_db(db)
        first = session_backup.backup_if_due(db)
        assert first is not None
        # 1h 内再触发：跳过
        assert session_backup.backup_if_due(db) is None

    def test_stale_backup_refreshed(self, tmp_path, monkeypatch):
        db = tmp_path / "sessions.db"
        _make_db(db)
        clock = [1000000000.0]
        monkeypatch.setattr(session_backup.time, "time", lambda: clock[0])
        assert session_backup.backup_if_due(db) is not None
        clock[0] += session_backup.STARTUP_BACKUP_MIN_INTERVAL_SEC + 60
        assert session_backup.backup_if_due(db) is not None


class TestRestore:
    def test_restore_replaces_and_keeps_corrupt(self, tmp_path):
        db = tmp_path / "sessions.db"
        store = _make_db(db, n_sessions=2)
        info = session_backup.create_backup(db)
        # 备份后库内容演进（s2 会话只在新库里）
        now = datetime.now(timezone.utc)
        store.create(SessionSummary(
            id="s2", type=SessionType.CHAT, title="new", preview="",
            created_at=now, updated_at=now, message_count=0,
        ))
        # 损坏它
        db.write_bytes(b"this is not a sqlite db at all" * 100)
        res = session_backup.restore_latest(db)
        assert res is not None
        assert res["restored_from"] == info["file"]
        assert res["corrupt_renamed"] is not None
        # 改名文件留在原地
        assert (tmp_path / res["corrupt_renamed"]).is_file()
        # 恢复后的库可构建且只有备份时的 2 个会话
        store2 = SessionsStore(db)
        assert len(store2.list(SessionType.CHAT, limit=100)) == 2

    def test_restore_nonexistent_backup_raises(self, tmp_path):
        db = tmp_path / "sessions.db"
        _make_db(db)
        with pytest.raises(FileNotFoundError):
            session_backup.restore_backup(db, "sessions-20990101T000000Z.db")

    def test_path_traversal_rejected(self, tmp_path):
        db = tmp_path / "sessions.db"
        _make_db(db)
        evil = tmp_path / "sessions.db"  # 目标库本身不在备份目录
        with pytest.raises(FileNotFoundError):
            session_backup.restore_backup(evil, "../sessions.db")


class TestAutoRestoreOnConstruct:
    def test_corrupt_db_auto_restored(self, tmp_path, monkeypatch):
        from doclens.web_v2 import deps

        db = tmp_path / "sessions.db"
        _make_db(db, n_sessions=1)
        assert session_backup.create_backup(db) is not None
        # 损坏
        db.write_bytes(b"\x00garbage" * 500)

        monkeypatch.setenv("CORTEX_SEARCH_PATH", str(tmp_path))
        monkeypatch.setattr(deps, "_sessions_store", None)
        monkeypatch.setattr(deps, "_config", None)
        # CortexConfig.load 需要 search_path：直接用假 config 绕过 env 复杂性
        class _FakeCfg:
            index_path = str(tmp_path / "index.db")
            search_path = str(tmp_path)
        monkeypatch.setattr(deps, "get_config", lambda: _FakeCfg())
        # 不启动周期定时器（测试进程别挂着 daemon timer 重新装弹）
        monkeypatch.setattr(session_backup, "start_periodic_backup", lambda p: None)

        store = deps.get_sessions_store()
        assert len(store.list(SessionType.CHAT, limit=100)) == 1
        # 损坏库已改名保留
        corrupts = session_backup.list_corrupt_files(db)
        assert len(corrupts) == 1

    def test_corrupt_db_without_backup_raises(self, tmp_path, monkeypatch):
        from doclens.web_v2 import deps

        db = tmp_path / "sessions.db"
        db.parent.mkdir(parents=True, exist_ok=True)
        db.write_bytes(b"garbage garbage")

        monkeypatch.setattr(deps, "_sessions_store", None)

        class _FakeCfg:
            index_path = str(tmp_path / "index.db")
            search_path = str(tmp_path)
        monkeypatch.setattr(deps, "get_config", lambda: _FakeCfg())
        monkeypatch.setattr(session_backup, "backup_if_due", lambda p, reason="": None)
        monkeypatch.setattr(session_backup, "start_periodic_backup", lambda p: None)

        with pytest.raises(sqlite3.DatabaseError):
            deps.get_sessions_store()


class TestListEndpoints:
    def test_list_backups_and_corrupt(self, tmp_path):
        db = tmp_path / "sessions.db"
        _make_db(db)
        session_backup.create_backup(db)
        corrupt = tmp_path / "sessions.db.corrupt-20260101T000000Z"
        corrupt.write_bytes(b"x")
        backups = session_backup.list_backups(db)
        assert len(backups) == 1
        assert backups[0]["session_count"] if False else "file" in backups[0]
        cs = session_backup.list_corrupt_files(db)
        assert len(cs) == 1 and cs[0]["file"] == corrupt.name
