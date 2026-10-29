"""会话导出/导入（ADR-0038）：全保真往返、同 id 跳过、结构校验拒绝。

导出 = sessions 行 + 全部 session_items 原样（含死段/边界/usage）；
导入 = 结构校验（不语义校验）→ 原 id 原时间戳写入；同 id 跳过。
"""
import asyncio
import json
from datetime import datetime, timedelta, timezone

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
        """导出 → 跨实例导入：items payload 逐字节一致，元数据保留
        （updated_at 例外：导入即置为当前时刻，见 TestImportTimestamps）。"""
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
        assert s_dst.created_at == s_src.created_at  # created_at 保留源值
        assert s_dst.updated_at > s_src.updated_at   # updated_at = 导入时刻

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


class TestImportTimestamps:
    """导入时间戳口径（2026-10-29）：created_at 保留源值，updated_at 置为
    导入时刻——历史列表按 updated_at 排序，导入即置顶（旧口径原样保留会让
    刚导入的会话埋在列表深处，用户以为「没反应」）。"""

    def _export(self, store) -> dict:
        now = datetime.now(timezone.utc)
        store.create(SessionSummary(
            id="OLD", type=SessionType.CHAT, title="旧会话", preview="",
            created_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            updated_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
        ))
        store._append_item("OLD", "message_user", {"content": "q"})
        store._append_item("OLD", "message_ai", {"content": "a"})
        return store.export_session("OLD")

    def test_updated_at_is_import_time(self, store, store2):
        before = datetime.now(timezone.utc)
        data = self._export(store)
        assert store2.import_session(data, workdir=None) is True
        s = store2.get("OLD")
        assert s.created_at == datetime(2024, 1, 1, tzinfo=timezone.utc)
        assert s.updated_at >= before
        # 条目 created_at 不动（序时保真，与源侧逐条一致）
        src_items = store.get_detail("OLD")
        dst_items = store2.get_detail("OLD")
        assert [(i.seq, i.created_at) for i in dst_items] == \
               [(i.seq, i.created_at) for i in src_items]

    def test_imported_session_sorts_first(self, store, store2):
        """导入后列表排序置顶（updated_at DESC 口径）。"""
        newer = datetime.now(timezone.utc) - timedelta(hours=1)
        store2.create(SessionSummary(
            id="NEWER", type=SessionType.CHAT, title="较新", preview="",
            created_at=newer, updated_at=newer,
        ))
        data = self._export(store)
        store2.import_session(data, workdir=None)
        listed = store2.list(SessionType.CHAT)
        assert [s.id for s in listed][0] == "OLD"


class TestImportAsCopy:
    """重复导入「作为新副本导入」（as_copy，2026-10-29）：同 id 已存在时
    改导新 id 副本（标题后缀「（导入副本）」、starred 不继承），而不是跳过。"""

    def _export(self, store) -> dict:
        _seed_rich_session(store, sid="SRC")
        return store.export_session("SRC")

    def test_as_copy_creates_new_id(self, store):
        data = self._export(store)
        assert store.import_session(data, as_copy=True) is True
        copy = [s for s in store.list(SessionType.CHAT) if s.title.endswith("（导入副本）")]
        assert len(copy) == 1
        c = copy[0]
        assert c.id != "SRC"
        # 条目全量复制（保真，与 duplicate 同口径）
        src_items = [(i.seq, i.kind, i.payload) for i in store.get_detail("SRC")]
        copy_items = [(i.seq, i.kind, i.payload) for i in store.get_detail(c.id)]
        assert copy_items == src_items

    def test_as_copy_does_not_inherit_star(self, store):
        now = datetime.now(timezone.utc)
        store.create(SessionSummary(
            id="STARRED", type=SessionType.CHAT, title="星标", preview="",
            created_at=now, updated_at=now, starred=True,
        ))
        store._append_item("STARRED", "message_user", {"content": "q"})
        data = store.export_session("STARRED")
        assert store.import_session(data, as_copy=True) is True
        copy = [s for s in store.list(SessionType.CHAT) if s.title.endswith("（导入副本）")][0]
        assert copy.starred is False or copy.starred == 0

    def test_as_copy_when_absent_imports_plainly(self, store, store2):
        """as_copy 但目标端无该 id：按普通导入（保留原 id 与标题）。"""
        data = self._export(store)
        assert store2.import_session(data, as_copy=True) is True
        s = store2.get("SRC")
        assert s is not None and s.title == "富会话"

    def test_repeated_as_copy_stacks(self, store):
        """连续两次副本导入 → 两条副本（id 各自唯一）。"""
        data = self._export(store)
        assert store.import_session(data, as_copy=True) is True
        assert store.import_session(data, as_copy=True) is True
        copies = [s for s in store.list(SessionType.CHAT) if s.title.endswith("（导入副本）")]
        assert len(copies) == 2
        assert len({c.id for c in copies}) == 2


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

    def test_duplicate_as_copy_imports(self, store, monkeypatch, tmp_path):
        """as_copy=true：同 id 已存在时改导副本（path=imported）。"""
        _seed_rich_session(store)
        data = store.export_session("RICH1")
        api = self._patch(monkeypatch, store, tmp_path)
        res = asyncio.run(api.import_session_upload(
            self._upload("s.json", json.dumps(data).encode()), as_copy=True,
        ))
        assert res["imported"] == 1 and res["path"] == "imported"
        assert any(
            s.title.endswith("（导入副本）")
            for s in store.list(SessionType.CHAT)
        )

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


class TestDeleteTurn:
    """删除对话对（2026-10-29）：user 消息起至下一处 user 前的整轮。

    粒度是整轮——半删会让回放把 user 与 assistant 拆散；历史级边界
    （compacted / rewound）范围内的轮次拒绝删除。
    """

    def _seed(self, st, sid="DEL"):
        now = datetime.now(timezone.utc)
        st.create(SessionSummary(
            id=sid, type=SessionType.CHAT, title="清理", preview="",
            created_at=now, updated_at=now,
        ))
        st._append_item(sid, "skill_context", {"name": "kb", "content": "body"})
        st._append_item(sid, "message_user", {"content": "q1"})      # 1
        st._append_item(sid, "tool_trace", {"name": "read", "input": {}})
        st._append_item(sid, "message_ai", {"content": "a1"})        # 3
        st.append_usages(sid, [{"input": 10, "output": 5}])
        st._append_item(sid, "message_user", {"content": "q2"})      # 5
        st._append_item(sid, "message_ai", {"content": "a2"})        # 6
        st.update_count_and_time(sid, 4)
        return sid

    def test_deletes_whole_turn(self, store):
        self._seed(store)
        res = store.delete_turn("DEL", 1)
        assert res["deleted_items"] == 5  # skill_context + 本轮 4 条
        assert res["message_count"] == 2
        kinds = [i.kind for i in store.get_detail("DEL")]
        assert kinds == ["message_user", "message_ai"]
        assert store.get("DEL").message_count == 2

    def test_history_after_delete(self, store):
        """回放只剩未被删的轮次（user/assistant 不拆散）。"""
        self._seed(store)
        store.delete_turn("DEL", 1)
        assert store.get_chat_history("DEL") == [
            {"role": "user", "content": "q2"},
            {"role": "assistant", "content": "a2"},
        ]

    def test_last_turn_deleted_to_end(self, store):
        """末轮：删除范围到会话末尾。"""
        self._seed(store)
        store.delete_turn("DEL", 5)
        # 首轮的 skill_context 注入仍在（属 q1 轮，未被删）
        assert store.get_chat_history("DEL") == [
            {"role": "user", "content": "body"},
            {"role": "assistant", "content": "Noted."},
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
        ]
        assert store.get("DEL").message_count == 2

    def test_invalid_anchor_rejected(self, store):
        self._seed(store)
        with pytest.raises(ValueError, match="须为用户消息"):
            store.delete_turn("DEL", 3)  # message_ai 不是轮首
        with pytest.raises(ValueError, match="锚点无效"):
            store.delete_turn("DEL", 999)

    def test_dead_anchor_rejected(self, store):
        """死段内的 user 消息不可删（它已不可见）。"""
        self._seed(store)
        store.append_rewound("DEL", 1, [], [])
        with pytest.raises(ValueError, match="不在当前时间线"):
            store.delete_turn("DEL", 1)

    def test_boundary_in_range_rejected(self, store):
        """范围内含压缩/回退边界 → 拒绝（不静默改写回放事实）。"""
        now = datetime.now(timezone.utc)
        store.create(SessionSummary(
            id="BND", type=SessionType.CHAT, title="边界", preview="",
            created_at=now, updated_at=now,
        ))
        store._append_item("BND", "message_user", {"content": "q1"})      # 0
        store._append_item("BND", "message_ai", {"content": "a1"})        # 1
        store._append_item("BND", "message_user", {"content": "q2"})      # 2
        store.append_compacted("BND", [{"role": "user", "content": "摘要"}], 100)
        store._append_item("BND", "message_ai", {"content": "a2"})
        with pytest.raises(ValueError, match="边界"):
            store.delete_turn("BND", 2)
        # 拒绝时不写库
        assert len(store.get_detail("BND")) == 5

    def test_missing_session(self, store):
        assert store.delete_turn("NOPE", 1) is None


class TestDeleteTurnApi:
    """DELETE /sessions/{id}/turns/{seq}（依赖注入风格，同既有约定）。"""

    def _patch(self, monkeypatch, store):
        from doclens.web_v2.api import sessions as sessions_api
        monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
        return sessions_api

    def _seed(self, st, sid="DEL"):
        now = datetime.now(timezone.utc)
        st.create(SessionSummary(
            id=sid, type=SessionType.CHAT, title="清理", preview="",
            created_at=now, updated_at=now,
        ))
        st._append_item(sid, "message_user", {"content": "q1"})
        st._append_item(sid, "message_ai", {"content": "a1"})
        st._append_item(sid, "message_user", {"content": "q2"})
        st._append_item(sid, "message_ai", {"content": "a2"})
        st.update_count_and_time(sid, 4)

    def test_delete_ok(self, store, monkeypatch):
        self._seed(store)
        api = self._patch(monkeypatch, store)
        res = asyncio.run(api.delete_turn("DEL", 2))
        assert res["ok"] is True and res["message_count"] == 2
        assert [i.kind for i in store.get_detail("DEL")] == [
            "message_user", "message_ai",
        ]

    def test_invalid_anchor_400(self, store, monkeypatch):
        self._seed(store)
        api = self._patch(monkeypatch, store)
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(api.delete_turn("DEL", 1))  # AI 消息
        assert ei.value.status == 400 and ei.value.code == "INVALID_ANCHOR"

    def test_search_session_rejected(self, store, monkeypatch):
        now = datetime.now(timezone.utc)
        store.create(SessionSummary(
            id="SRCH", type=SessionType.SEARCH, title="搜", preview="",
            created_at=now, updated_at=now,
        ))
        store._append_item("SRCH", "message_user", {"content": "kw"})
        api = self._patch(monkeypatch, store)
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(api.delete_turn("SRCH", 0))
        assert ei.value.status == 400 and ei.value.code == "NOT_CHAT_SESSION"
