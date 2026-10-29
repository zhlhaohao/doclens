"""会话导出/导入（ADR-0038）：全保真往返、同 id 跳过、结构校验拒绝。

导出 = sessions 行 + 全部 session_items 原样（含死段/边界/usage）；
导入 = 结构校验（不语义校验）→ 原 id 原时间戳写入；同 id 跳过。
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


class TestExportUpto:
    """截断导出（导出到此为止，2026-10-29）：只导锚点及之前的条目，
    产物是新 id 的独立快照——导入端不会因「同 id 跳过」把它吞掉。"""

    def _seed_turns(self, st: SessionsStore, sid: str = "UPTO") -> None:
        now = datetime.now(timezone.utc)
        st.create(SessionSummary(
            id=sid, type=SessionType.CHAT, title="长会话", preview="p",
            created_at=now, updated_at=now, starred=True,
        ))
        st._append_item(sid, "message_user", {"content": "q1"})   # seq 0
        st._append_item(sid, "message_ai", {"content": "a1"})     # seq 1
        st._append_item(sid, "message_user", {"content": "q2"})   # seq 2
        st._append_item(sid, "message_ai", {"content": "a2"})     # seq 3
        st.update_count_and_time(sid, 4)

    def test_upto_keeps_prefix_only(self, store):
        """只含 seq ≤ 锚点的条目：锚点 user 消息本身在导出范围内。"""
        self._seed_turns(store)
        data = store.export_session("UPTO", upto_seq=2)
        assert [i["seq"] for i in data["items"]] == [0, 1, 2]
        assert [i["kind"] for i in data["items"]] == [
            "message_user", "message_ai", "message_user",
        ]

    def test_upto_is_new_snapshot_identity(self, store):
        """新 id + 标题后缀 + message_count 重算 + 快照点时间 + 不继承星标。"""
        self._seed_turns(store)
        data = store.export_session("UPTO", upto_seq=2)
        s = data["session"]
        assert s["id"] != "UPTO"
        assert s["title"] == "长会话（导出至 3 条消息）"
        assert s["message_count"] == 3
        assert s["updated_at"] == data["items"][2]["created_at"]
        assert s["starred"] == 0
        # 源会话不受影响（纯读）
        assert len(store.get_detail("UPTO")) == 4
        assert store.get("UPTO").message_count == 4

    def test_upto_import_as_new_session(self, store, store2):
        """截断产物可导入为**新会话**；回放 = 前缀历史，可续聊。"""
        self._seed_turns(store)
        data = store.export_session("UPTO", upto_seq=2)
        assert store2.import_session(data, workdir=None) is True
        new_id = data["session"]["id"]
        assert store2.get_chat_history(new_id) == [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "q2"},
        ]
        # 同一文件再导一次 → 同 id 跳过（派生快照同样幂等）
        assert store2.import_session(data, workdir=None) is False

    def test_upto_respects_rewind_boundary_inside_prefix(self, store):
        """前缀内的回退边界照常生效：message_count 按活投影重算。"""
        self._seed_turns(store)
        store.append_rewound("UPTO", 2, [], [])  # 边界 seq 4：死段 [2,4]
        data = store.export_session("UPTO", upto_seq=1)  # 只到 a1：无边界
        assert data["session"]["message_count"] == 2
        data2 = store.export_session("UPTO", upto_seq=4)
        assert data2["session"]["message_count"] == 2  # q2/a2 已死

    def test_upto_none_keeps_full_export(self, store):
        """不传 upto_seq：原全量导出口径逐字不变（同 id / 同标题）。"""
        self._seed_turns(store)
        data = store.export_session("UPTO")
        assert data["session"]["id"] == "UPTO"
        assert data["session"]["title"] == "长会话"
        assert len(data["items"]) == 4


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


class TestImportDirSwitch:
    """导入目录切换提示轮（ADR-0038 后续）：chat 会话导入时追加
    message_user（目录已改）+ message_ai（明白）合成对话。"""

    def _live_export(self, store) -> dict:
        now = datetime.now(timezone.utc)
        store.create(SessionSummary(
            id="LIVE", type=SessionType.CHAT, title="活", preview="",
            created_at=now, updated_at=now,
        ))
        store._append_item("LIVE", "message_user", {"content": "q"})
        store._append_item("LIVE", "message_ai", {"content": "a"})
        store.update_count_and_time("LIVE", 2)
        return store.export_session("LIVE")

    def test_import_appends_dir_switch_turn(self, store, store2):
        """chat 会话 + workdir：末尾追加 user/ai 一轮，含新目录路径。"""
        data = self._live_export(store)
        assert store2.import_session(data, workdir="D:/newdir") is True
        items = store2.get_detail("LIVE")
        assert [i.kind for i in items] == [
            "message_user", "message_ai", "message_user", "message_ai",
        ]
        # 提示内容含当前工作目录
        import json as _json
        tail_user = _json.loads(items[2].payload)
        tail_ai = _json.loads(items[3].payload)
        assert "D:/newdir" in tail_user["content"]
        assert "[系统提示]" in tail_user["content"]
        assert "明白" in tail_ai["content"]
        # seq 续排（原 items seq 为 0/1，追加轮 2/3）
        assert items[2].seq == 2 and items[3].seq == 3

    def test_import_chat_history_includes_switch_turn(self, store, store2):
        """追加轮进入 LLM 回放：末两条为新目录声明 + AI 确认。"""
        data = self._live_export(store)
        store2.import_session(data, workdir="D:/newdir")
        history = store2.get_chat_history("LIVE")
        assert history[-2]["role"] == "user"
        assert "D:/newdir" in history[-2]["content"]
        assert history[-1]["role"] == "assistant"

    def test_import_message_count_includes_extra(self, store, store2):
        """message_count 源值 2 + 追加 2 = 4。"""
        data = self._live_export(store)
        store2.import_session(data, workdir="D:/newdir")
        s = store2.get("LIVE")
        assert s.message_count == 4
        assert store2.count_live_messages("LIVE") == 4

    def test_import_no_workdir_no_extra_turn(self, store, store2):
        """未传 workdir（旧调用方兼容）：行为与原全保真导入一致。"""
        data = self._live_export(store)
        assert store2.import_session(data) is True
        assert [i.kind for i in store2.get_detail("LIVE")] == [
            "message_user", "message_ai",
        ]
        assert store2.get("LIVE").message_count == 2

    def test_import_search_session_no_extra_turn(self, store, store2):
        """search 会话无续聊语义：即使传 workdir 也不追加。"""
        now = datetime.now(timezone.utc)
        store.create(SessionSummary(
            id="SRCH", type=SessionType.SEARCH, title="搜", preview="",
            created_at=now, updated_at=now,
        ))
        store._append_item("SRCH", "message_user", {"content": "kw"})
        data = store.export_session("SRCH")
        assert store2.import_session(data, workdir="D:/newdir") is True
        assert [i.kind for i in store2.get_detail("SRCH")] == ["message_user"]

    def test_roundtrip_identical_without_workdir_preserved(
        self, store, store2
    ):
        """既有全保真往返语义不受影响（不传 workdir 时逐字节一致）。"""
        _seed_rich_session(store)
        data = store.export_session("RICH1")
        assert store2.import_session(data) is True
        src = store.get_detail("RICH1")
        dst = store2.get_detail("RICH1")
        assert [(i.seq, i.kind, i.payload) for i in dst] == \
               [(i.seq, i.kind, i.payload) for i in src]


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


class TestImportUploadApi:
    """WebView 原生直传入口 POST /sessions/import/upload（ADR-0038）。

    端点函数依赖注入风格（_get_store/_get_workdir 调用期解析），直接
    asyncio.run 调用 + monkeypatch 注入桩（同 test_session_duplicate 约定）。
    """

    def _patch(self, monkeypatch, store, tmp_path):
        from doclens.web_v2.api import sessions as sessions_api
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        monkeypatch.setattr(sessions_api, "_get_workdir", lambda: tmp_path)
        return sessions_api

    def _upload(self, name: str, raw: bytes):
        from fastapi import UploadFile
        import io
        return UploadFile(file=io.BytesIO(raw), filename=name)

    def test_import_ok_reports_imported(self, store, monkeypatch, tmp_path):
        _seed_rich_session(store)
        data = store.export_session("RICH1")
        other = SessionsStore(tmp_path / "target.db")
        api = self._patch(monkeypatch, other, tmp_path)
        res = asyncio.run(api.import_session_upload(
            self._upload("s.json", json.dumps(data).encode()),
        ))
        assert res["imported"] == 1 and res["path"] == "imported"
        assert other.get("RICH1") is not None

    def test_duplicate_reports_skipped(self, store, monkeypatch, tmp_path):
        _seed_rich_session(store)
        data = store.export_session("RICH1")
        api = self._patch(monkeypatch, store, tmp_path)
        res = asyncio.run(api.import_session_upload(
            self._upload("s.json", json.dumps(data).encode()),
        ))
        assert res["imported"] == 0 and res["path"] == "skipped"

    def test_non_json_extension_rejected(self, store, monkeypatch, tmp_path):
        api = self._patch(monkeypatch, store, tmp_path)
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(api.import_session_upload(
                self._upload("s.txt", b"{}"),
            ))
        assert ei.value.status == 400 and ei.value.code == "INVALID_TYPE"

    def test_bad_json_rejected(self, store, monkeypatch, tmp_path):
        api = self._patch(monkeypatch, store, tmp_path)
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(api.import_session_upload(
                self._upload("s.json", b"{broken"),
            ))
        assert ei.value.status == 400 and ei.value.code == "IMPORT_INVALID"


class TestExportEndpointUpto:
    """GET /sessions/{id}/export?upto_seq=N（截断导出端点，2026-10-29）。"""

    def _patch(self, monkeypatch, store):
        from doclens.web_v2.api import sessions as sessions_api
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        return sessions_api

    def _seed(self, st, sid="UPTO"):
        now = datetime.now(timezone.utc)
        st.create(SessionSummary(
            id=sid, type=SessionType.CHAT, title="长会话", preview="",
            created_at=now, updated_at=now,
        ))
        st._append_item(sid, "message_user", {"content": "q1"})
        st._append_item(sid, "message_ai", {"content": "a1"})
        st._append_item(sid, "message_user", {"content": "q2"})
        st.update_count_and_time(sid, 3)

    def test_upto_returns_truncated_attachment(self, store, monkeypatch):
        self._seed(store)
        api = self._patch(monkeypatch, store)
        res = asyncio.run(api.export_session("UPTO", upto_seq=2))
        body = json.loads(res.body)
        assert [i["seq"] for i in body["items"]] == [0, 1, 2]
        assert body["session"]["title"] == "长会话（导出至 3 条消息）"
        assert "attachment" in res.headers["content-disposition"]

    def test_upto_invalid_anchor_400(self, store, monkeypatch):
        """锚点须为活 message_user：指向 AI 消息 → 400。"""
        self._seed(store)
        api = self._patch(monkeypatch, store)
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(api.export_session("UPTO", upto_seq=1))
        assert ei.value.status == 400 and ei.value.code == "INVALID_ANCHOR"

    def test_upto_search_session_rejected(self, store, monkeypatch):
        now = datetime.now(timezone.utc)
        store.create(SessionSummary(
            id="SRCH", type=SessionType.SEARCH, title="搜", preview="",
            created_at=now, updated_at=now,
        ))
        store._append_item("SRCH", "message_user", {"content": "kw"})
        api = self._patch(monkeypatch, store)
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(api.export_session("SRCH", upto_seq=0))
        assert ei.value.status == 400 and ei.value.code == "NOT_CHAT_SESSION"
