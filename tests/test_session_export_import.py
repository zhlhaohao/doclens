"""会话导出/导入（ADR-0038）：全保真往返、同 id 跳过、结构校验拒绝。

导出 = sessions 行 + 全部 session_items 原样（含死段/边界/usage）；
导入 = 结构校验（不语义校验）→ 原 id 原时间戳写入；同 id 跳过。
"""
import json
from datetime import datetime, timezone

import pytest

from doclens.web_v2.sessions_store import (
    SessionSummary,
    SessionType,
    SessionsStore,
)


@pytest.fixture()
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


@pytest.fixture()
def store2(tmp_path):
    """目标实例（导入方）——独立 DB 模拟跨实例。"""
    return SessionsStore(tmp_path / "sessions2.db")


def _seed_rich_session(st: SessionsStore, sid: str = "RICH1") -> None:
    """落一个含全 kind 的会话：user/ai/raw/压缩边界/回退边界/usage/skill。"""
    now = datetime.now(timezone.utc)
    st.create(SessionSummary(
        id=sid, type=SessionType.CHAT, title="富会话", preview="p", mode="skill",
        created_at=now, updated_at=now,
    ))
    st._append_item(sid, "message_user", {
        "content": "问题", "images": [{"data": "abc", "media_type": "image/png"}],
    })
    st.append_raw_messages(sid, [
        {"role": "user", "content": "问题"},
        {"role": "assistant", "content": [
            {"type": "tool_use", "id": "tu1", "name": "search_kb", "input": {}},
        ]},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "tu1", "content": "ok"},
        ]},
        {"role": "assistant", "content": "回答"},
    ])
    st.append_compacted(sid, [{"role": "user", "content": "摘要"}], 1234)
    st.append_rewound(sid, 0, [], [])
    st.append_usages(sid, [{"input": 100, "output": 50}])
    st._append_item(sid, "skill_context", {"name": "kb", "content": "body"})


class TestExport:
    def test_export_full_fidelity(self, store):
        """导出含 sessions 行 + 全部 items 原样（死段/边界/usage 照导）。"""
        _seed_rich_session(store)
        data = store.export_session("RICH1")
        assert data["format"] == 1
        s = data["session"]
        assert s["id"] == "RICH1" and s["title"] == "富会话" and s["mode"] == "skill"
        kinds = [i["kind"] for i in data["items"]]
        assert set(kinds) == {
            "message_user", "raw_messages", "compacted", "rewound",
            "usage", "skill_context",
        }
        # payload 原样透传（字符串，不重排 JSON）
        for it in data["items"]:
            assert isinstance(it["payload"], str)
            json.loads(it["payload"])

    def test_export_missing(self, store):
        assert store.export_session("NOPE") is None


class TestImportRoundtrip:
    def test_roundtrip_identical(self, store, store2):
        """导出 → 跨实例导入：items payload 逐字节一致，元数据保留。"""
        _seed_rich_session(store)
        data = store.export_session("RICH1")
        assert store2.import_session(data) is True

        src = store.get_detail("RICH1")
        dst = store2.get_detail("RICH1")
        assert [(i.seq, i.kind, i.payload) for i in dst] == \
               [(i.seq, i.kind, i.payload) for i in src]

        s_src, s_dst = store.get("RICH1"), store2.get("RICH1")
        assert s_dst.id == s_src.id
        assert s_dst.title == s_src.title
        assert s_dst.mode == s_src.mode
        assert s_dst.created_at == s_src.created_at  # 时间戳保留源值
        assert s_dst.updated_at == s_src.updated_at

    def test_roundtrip_chat_history_equal(self, store, store2):
        """导入后 LLM 回放投影与源会话一致（续聊语义不丢）。"""
        _seed_rich_session(store)
        # rewound(0) 清空全部 → 两边回放都应为空；先验证敏感等价
        assert store2.import_session(store.export_session("RICH1")) is True
        assert store2.get_chat_history("RICH1") == store.get_chat_history("RICH1")

    def test_roundtrip_live_history(self, store, store2):
        """无回退边界的活会话：导入后回放逐条等价。"""
        now = datetime.now(timezone.utc)
        store.create(SessionSummary(
            id="LIVE", type=SessionType.CHAT, title="活", preview="",
            created_at=now, updated_at=now,
        ))
        store._append_item("LIVE", "message_user", {"content": "q"})
        store._append_item("LIVE", "message_ai", {"content": "a"})
        assert store2.import_session(store.export_session("LIVE")) is True
        assert store2.get_chat_history("LIVE") == [
            {"role": "user", "content": "q"},
            {"role": "assistant", "content": "a"},
        ]

    def test_dup_import_skipped(self, store):
        """同 id 已存在 → 跳过（幂等，防双份）。"""
        _seed_rich_session(store)
        data = store.export_session("RICH1")
        assert store.import_session(data) is False
        assert len(store.get_detail("RICH1")) == len(
            [i for i in store.export_session("RICH1")["items"]]
        )  # 无重复写入


class TestImportValidation:
    def test_unknown_format_rejected(self, store):
        with pytest.raises(ValueError, match="版本不支持"):
            store.import_session({"format": 99, "session": {}, "items": []})

    def test_missing_session_rejected(self, store):
        with pytest.raises(ValueError, match="session"):
            store.import_session({"format": 1, "items": []})

    def test_bad_type_rejected(self, store):
        s = {"id": "x", "type": "weird", "title": "t",
             "created_at": "2026-01-01", "updated_at": "2026-01-01"}
        with pytest.raises(ValueError, match="type"):
            store.import_session({"format": 1, "session": s, "items": []})

    def test_bad_payload_json_rejected(self, store):
        s = {"id": "x", "type": "chat", "title": "t",
             "created_at": "2026-01-01", "updated_at": "2026-01-01"}
        with pytest.raises(ValueError, match="payload"):
            store.import_session({
                "format": 1, "session": s,
                "items": [{"kind": "k", "payload": "{broken"}],
            })

    def test_validation_failure_writes_nothing(self, store):
        """整体拒绝：校验失败不落任何行。"""
        s = {"id": "BAD", "type": "chat", "title": "t",
             "created_at": "2026-01-01", "updated_at": "2026-01-01"}
        with pytest.raises(ValueError):
            store.import_session({
                "format": 1, "session": s,
                "items": [{"kind": "k", "payload": "{broken"}],
            })
        assert store.get("BAD") is None
