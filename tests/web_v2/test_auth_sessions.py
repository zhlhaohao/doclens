"""SessionsStore.auth_sessions 登录会话方法测试。"""
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from doclens.web_v2.sessions_store import SessionsStore


@pytest.fixture
def store(tmp_path: Path) -> SessionsStore:
    return SessionsStore(tmp_path / "sessions.db")


class TestAuthSessions:
    def test_create_and_validate(self, store):
        token = store.create_auth_session()
        assert token
        assert store.validate_auth_session(token, touch=False) is True

    def test_unknown_token(self, store):
        assert store.validate_auth_session("no-such-token", touch=False) is False

    def test_expired_session_invalid_and_purged(self, store):
        token = store.create_auth_session(ttl_hours=1)
        future = datetime.utcnow() + timedelta(hours=2)
        assert store.validate_auth_session(token, now=future) is False
        # 过期会话被顺手删除
        assert store.validate_auth_session(token, now=future) is False

    def test_touch_throttle_no_write_when_fresh(self, store):
        """剩余有效期 > 23h 时不顺延（节流）。"""
        token = store.create_auth_session(ttl_hours=24)
        before = self._expires_at(store, token)
        assert store.validate_auth_session(token, touch=True) is True
        assert self._expires_at(store, token) == before

    def test_touch_extends_when_near_expiry(self, store):
        """剩余有效期 < 23h 时顺延为 now + 24h（滑动续期）。"""
        token = store.create_auth_session(ttl_hours=24)
        soon = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        self._set_expires_at(store, token, soon)
        now = datetime.utcnow()
        assert store.validate_auth_session(token, touch=True, now=now) is True
        new_expires = datetime.fromisoformat(self._expires_at(store, token))
        assert new_expires > now + timedelta(hours=23)

    def test_no_touch_keeps_expiry(self, store):
        token = store.create_auth_session(ttl_hours=24)
        soon = (datetime.utcnow() + timedelta(hours=1)).isoformat()
        self._set_expires_at(store, token, soon)
        assert store.validate_auth_session(token, touch=False) is True
        assert self._expires_at(store, token) == soon

    def test_delete_session(self, store):
        token = store.create_auth_session()
        store.delete_auth_session(token)
        assert store.validate_auth_session(token, touch=False) is False

    def test_revoke_all_sessions(self, store):
        store.create_auth_session()
        store.create_auth_session()
        assert store.revoke_all_auth_sessions() == 2
        assert store.revoke_all_auth_sessions() == 0

    def test_purge_expired(self, store):
        expired = store.create_auth_session(ttl_hours=1)
        fresh = store.create_auth_session(ttl_hours=24)
        past = (datetime.utcnow() - timedelta(hours=1)).isoformat()
        self._set_expires_at(store, expired, past)
        assert store.purge_expired_auth_sessions() == 1
        assert store.validate_auth_session(fresh, touch=False) is True

    def test_history_sessions_unaffected(self, store):
        """auth_sessions 表与历史 sessions 表互不影响。"""
        from doclens.web_v2.sessions_store import SessionType

        store.create_auth_session()
        assert store.delete_by_type(None) == 0  # 清历史会话不动 auth_sessions
        assert store.revoke_all_auth_sessions() == 1
        assert SessionType.SEARCH.value == "search"

    # ---- helpers ----

    @staticmethod
    def _expires_at(store: SessionsStore, token: str) -> str:
        with sqlite3.connect(store._db_path) as conn:
            row = conn.execute(
                "SELECT expires_at FROM auth_sessions WHERE token = ?", (token,)
            ).fetchone()
            return row[0]

    @staticmethod
    def _set_expires_at(store: SessionsStore, token: str, iso: str) -> None:
        with sqlite3.connect(store._db_path) as conn:
            conn.execute(
                "UPDATE auth_sessions SET expires_at = ? WHERE token = ?", (iso, token)
            )
