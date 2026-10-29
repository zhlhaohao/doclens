"""PATCH /api/sessions/{id}（遗留追加端点）契约测试。

端点已被 071d5169 淘汰（展示层落库统一到后端），保留仅为兼容缓存旧
bundle 的 WebView。2026-10-29 收紧入参校验：payload 传对象 / 缺 kind
此前会穿过 API 层抛 InterfaceError / KeyError → 500，现统一 400。
"""
import asyncio
import json
from datetime import datetime, timezone

import pytest

from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.sessions_store import (
    SessionSummary,
    SessionType,
    SessionsStore,
)


@pytest.fixture()
def store(tmp_path):
    st = SessionsStore(tmp_path / "sessions.db")
    now = datetime.now(timezone.utc)
    st.create(SessionSummary(
        id="S1", type=SessionType.CHAT, title="追加", preview="",
        created_at=now, updated_at=now,
    ))
    return st


@pytest.fixture()
def api(monkeypatch, store):
    from doclens.web_v2.api import sessions as sessions_api
    monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
    return sessions_api


def _append(api, items, message_count=None):
    from doclens.web_v2.models.session import SessionAppendRequest
    return asyncio.run(api.append_session(
        "S1", SessionAppendRequest(items=items, message_count=message_count),
    ))


class TestAppendPayloadNormalization:
    def test_json_string_payload_accepted(self, store, api):
        """旧调用形态（payload 已是 JSON 字符串）：原样落库。"""
        _append(api, [{"kind": "message_user", "payload": '{"content":"q"}'}])
        item = store.get_detail("S1")[0]
        assert item.seq == 0 and item.kind == "message_user"
        assert json.loads(item.payload) == {"content": "q"}

    def test_object_payload_serialized(self, store, api):
        """payload 传对象（曾经的 500 路径）：自动 dumps 落库。"""
        _append(api, [{"kind": "message_user", "payload": {"content": "q"}}])
        assert json.loads(store.get_detail("S1")[0].payload) == {"content": "q"}

    def test_missing_payload_defaults_empty_object(self, store, api):
        _append(api, [{"kind": "usage"}])
        assert json.loads(store.get_detail("S1")[0].payload) == {}

    def test_seq_continues_and_count_updates(self, store, api):
        _append(api, [{"kind": "message_user", "payload": {"content": "q"}}], 1)
        res = _append(api, [{"kind": "message_ai", "payload": {"content": "a"}}], 2)
        assert res["message_count"] == 2
        assert [i.seq for i in store.get_detail("S1")] == [0, 1]


class TestAppendValidation:
    def test_missing_kind_400(self, store, api):
        with pytest.raises(CortexAPIError) as ei:
            _append(api, [{"payload": {"content": "q"}}])
        assert ei.value.status == 400 and ei.value.code == "INVALID_ITEM"
        assert store.get_detail("S1") == []  # 整批不写

    def test_empty_kind_400(self, store, api):
        with pytest.raises(CortexAPIError) as ei:
            _append(api, [{"kind": "  ", "payload": "{}"}])
        assert ei.value.status == 400

    def test_non_json_string_payload_400(self, store, api):
        with pytest.raises(CortexAPIError) as ei:
            _append(api, [{"kind": "message_user", "payload": "not-json"}])
        assert ei.value.status == 400 and ei.value.code == "INVALID_ITEM"

    def test_partial_batch_not_written(self, store, api):
        """任何一条非法 → 整批拒绝（不部分写入）。"""
        with pytest.raises(CortexAPIError):
            _append(api, [
                {"kind": "message_user", "payload": {"content": "q"}},
                {"payload": {"content": "oops"}},
            ])
        assert store.get_detail("S1") == []

    def test_missing_session_404(self, api):
        from doclens.web_v2.models.session import SessionAppendRequest
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(api.append_session(
                "NOPE", SessionAppendRequest(items=[{"kind": "message_user"}]),
            ))
        assert ei.value.status == 404 and ei.value.code == "SESSION_NOT_FOUND"

    def test_endpoint_marked_deprecated(self):
        """OpenAPI 里标 deprecated：遗留端点，新代码不该用。"""
        from doclens.web_v2.api import sessions as sessions_api
        routes = [
            r for r in sessions_api.router.routes
            if getattr(r, "path", "") == "/sessions/{session_id}"
            and "PATCH" in getattr(r, "methods", set())
        ]
        assert routes and routes[0].deprecated is True
