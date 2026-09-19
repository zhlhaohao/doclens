# -*- coding: utf-8 -*-
"""回退（ADR-0027：回退即事实）测试。

覆盖三层：
- sessions_store：rewound 边界投影（死段 = 区间并集）、锚点校验、
  count_live_messages、快照环形淘汰、backfill；
- RewindTracker：改前备份 / null 标记 / shell 扫描 / 大小上限 / 首版本
  fallback / purge / bind_rewind_hooks 包装；
- API 端点：GET rewind/preview + POST rewind（校验分支 + 主流程）。
"""
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from doclens.web_v2.sessions_store import (
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
)
from doclens.web_v2.rewind_tracker import RewindTracker, bind_rewind_hooks

_NOW = datetime.now(timezone.utc)


@pytest.fixture()
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


def _create(store, sid="s1"):
    store.create(SessionSummary(
        id=sid, type=SessionType.CHAT, title="t", preview="",
        created_at=_NOW, updated_at=_NOW, message_count=0,
    ))


def _append(store, sid, seq, kind, payload_obj):
    store.append_item(SessionItem(
        session_id=sid, seq=seq, kind=kind,
        payload=json.dumps(payload_obj, ensure_ascii=False),
        created_at=_NOW,
    ))


def _contents(store, sid):
    return [m.get("content") for m in store.get_chat_history(sid)]


# ---------- store：rewound 边界投影 ----------

def test_rewind_projection_basic(store):
    _create(store)
    for seq, kind, c in [(0, "message_user", "q1"), (1, "message_ai", "a1"),
                         (2, "message_user", "q2"), (3, "message_ai", "a2")]:
        _append(store, "s1", seq, kind, {"content": c})
    store.append_rewound("s1", 0)
    # 锚点（seq 0）与其后全部死亡 → 空历史
    assert _contents(store, "s1") == []
    # 新对话照常可见
    _append(store, "s1", 5, "message_user", {"content": "q3"})
    _append(store, "s1", 6, "message_ai", {"content": "a3"})
    assert _contents(store, "s1") == ["q3", "a3"]


def test_rewind_projection_union_not_last_wins(store):
    """在新对话里再次回退：旧边界的死段必须继续生效（并集而非最后覆盖）。"""
    _create(store)
    for seq, kind, c in [(0, "message_user", "q1"), (1, "message_ai", "a1")]:
        _append(store, "s1", seq, kind, {"content": c})
    store.append_rewound("s1", 0)          # 边界 (0, 2)
    _append(store, "s1", 3, "message_user", {"content": "q2"})
    _append(store, "s1", 4, "message_ai", {"content": "a2"})
    store.append_rewound("s1", 3)          # 边界 (3, 5)
    # 两段全死：seq 0-2 靠旧边界、3-5 靠新边界
    assert _contents(store, "s1") == []


def test_compacted_in_dead_zone_keeps_live_prefix(store):
    _create(store)
    _append(store, "s1", 0, "message_user", {"content": "q1"})
    _append(store, "s1", 1, "message_ai", {"content": "a1"})
    _append(store, "s1", 2, "message_user", {"content": "q2"})
    store.append_compacted("s1", [
        {"role": "user", "content": "[Compressed] 摘要"},
        {"role": "assistant", "content": "Understood."},
    ], 100)
    _append(store, "s1", 5, "message_user", {"content": "q3"})
    store.append_rewound("s1", 2)  # compacted(4) 落进死段
    assert _contents(store, "s1") == ["q1", "a1"]


def test_rewind_before_compact_boundary_revives_full_history(store):
    """回退到压缩边界之前：旧全量历史复活（摘要边界失效）。"""
    _create(store)
    _append(store, "s1", 0, "message_user", {"content": "q1"})
    _append(store, "s1", 1, "message_ai", {"content": "a1"})
    store.append_compacted("s1", [
        {"role": "user", "content": "[Compressed] 摘要"},
        {"role": "assistant", "content": "Understood."},
    ], 100)
    _append(store, "s1", 3, "message_user", {"content": "q2"})
    store.append_rewound("s1", 0)  # 回到 q1（压缩边界之后死了）
    assert _contents(store, "s1") == []


def test_anchor_validation_and_count(store):
    _create(store)
    _append(store, "s1", 0, "message_user", {"content": "q1"})
    _append(store, "s1", 1, "message_ai", {"content": "a1"})
    _append(store, "s1", 2, "message_user", {"content": "q2"})
    _append(store, "s1", 3, "message_ai", {"content": "a2"})
    store.append_rewound("s1", 2)
    _append(store, "s1", 5, "message_user", {"content": "q3"})
    assert store.is_live_anchor("s1", 5)
    assert not store.is_live_anchor("s1", 2)   # 死锚点
    assert not store.is_live_anchor("s1", 3)   # 非用户消息
    assert not store.is_live_anchor("s1", 99)  # 不存在
    # 活消息 = q1/a1（锚点 2 之前）+ q3 → 3 条
    assert store.count_live_messages("s1") == 3


def test_snapshot_ring_and_backfill(store):
    _create(store)
    evicted_all = []
    for i in range(102):
        evicted_all.extend(store.append_rewind_snapshot(
            "s1", i, {"f": {"backup_file_name": f"b{i}", "version": i}},
        ))
    snaps = store.list_rewind_snapshots("s1")
    assert len(snaps) == 100
    assert [s["anchor_seq"] for s in snaps] == list(range(2, 102))
    # 环形淘汰最旧 2 条（锚点 0、1）
    assert len(evicted_all) == 2
    assert evicted_all[0]["tracked_file_backups"]["f"]["backup_file_name"] == "b0"
    # backfill：最新快照补条目，幂等
    assert store.backfill_rewind_snapshot("s1", "g", {"backup_file_name": "g1", "version": 1})
    assert store.backfill_rewind_snapshot("s1", "g", {"backup_file_name": "gX", "version": 9})
    snaps = store.list_rewind_snapshots("s1")
    assert snaps[-1]["tracked_file_backups"]["g"] == {"backup_file_name": "g1", "version": 1}


# ---------- RewindTracker ----------

@pytest.fixture()
def tracker_env(tmp_path):
    store = SessionsStore(tmp_path / "t.db")
    work = tmp_path / "kb"
    work.mkdir()
    _create(store, sid="s2")
    tr = RewindTracker(store, tmp_path / "rewind", max_bytes=1024)
    return store, work, tr


def _turn(store, sid, seq, content):
    _append(store, sid, seq, "message_user", {"content": content})


def test_track_structured_restore_roundtrip(tracker_env):
    store, work, tr = tracker_env
    f = work / "note.md"
    f.write_text("v1 原文", encoding="utf-8")
    _turn(store, "s2", 0, "q1")
    tr.begin_turn("s2")
    tr.track_structured("s2", str(f), work)
    f.write_text("v2 被改", encoding="utf-8")
    assert tr.preview("s2", 0)["restored"] == [str(f)]
    tr.restore("s2", 0)
    assert f.read_text(encoding="utf-8") == "v1 原文"
    # 恢复后内容 == 备份 → 再预览不再列为恢复项（无差异不动）
    assert tr.preview("s2", 0)["restored"] == []


def test_null_marker_deletes_created_file(tracker_env):
    store, work, tr = tracker_env
    newf = work / "gen.md"
    _turn(store, "s2", 0, "q1")
    tr.begin_turn("s2")
    tr.track_structured("s2", str(newf), work)   # 不存在 → null
    newf.write_text("x", encoding="utf-8")
    assert tr.preview("s2", 0)["deleted"] == [str(newf)]
    tr.restore("s2", 0)
    assert not newf.exists()


def test_shell_scan_backup_and_no_null_for_missing(tracker_env):
    store, work, tr = tracker_env
    f = work / "shell.md"
    f.write_text("shell v1", encoding="utf-8")
    _turn(store, "s2", 0, "q1")
    tr.begin_turn("s2")
    # sed 写段命中现存文件 → 备份；`新文件.md` 不存在 → 不记 null（防误删）
    tr.track_shell("s2", "sed -i s/a/b/ shell.md && cp shell.md 新文件.md", work)
    f.write_text("shell v2", encoding="utf-8")
    (work / "新文件.md").write_text("created", encoding="utf-8")
    pv = tr.preview("s2", 0)
    assert pv["restored"] == [str(f)]
    assert pv["deleted"] == []  # 命令扫描不产生 null → 不误删
    tr.restore("s2", 0)
    assert f.read_text(encoding="utf-8") == "shell v1"
    assert (work / "新文件.md").exists()  # best-effort：漏网的写不恢复


def test_shell_read_command_no_backup(tracker_env):
    store, work, tr = tracker_env
    f = work / "read.md"
    f.write_text("只读", encoding="utf-8")
    _turn(store, "s2", 0, "q1")
    tr.begin_turn("s2")
    tr.track_shell("s2", "cat read.md | grep x read.md", work)
    pv = tr.preview("s2", 0)
    assert pv["restored"] == [] and pv["deleted"] == []


def test_size_limit_skip(tracker_env):
    store, work, tr = tracker_env
    big = work / "big.bin"
    big.write_bytes(b"x" * 2048)  # > max_bytes=1024
    _turn(store, "s2", 0, "q1")
    tr.begin_turn("s2")
    tr.track_structured("s2", str(big), work)
    big.write_bytes(b"y" * 2048)
    pv = tr.preview("s2", 0)
    # 超限无备份 → 跳过并给出原因，绝不误删
    assert pv["restored"] == [] and pv["deleted"] == []
    assert any(s["path"] == str(big) for s in pv["skipped"])


def test_first_version_fallback_for_earlier_anchor(tracker_env):
    """回退到「文件首次被触碰之前」的锚点：v1（首触前内容）兜底恢复。"""
    store, work, tr = tracker_env
    f = work / "doc.md"
    _turn(store, "s2", 0, "q1")     # 轮1：文件还没被碰
    tr.begin_turn("s2")             # 快照0：无追踪
    _turn(store, "s2", 1, "q2")     # 轮2：编辑 doc.md
    tr.begin_turn("s2")             # 快照1
    f.write_text("原始", encoding="utf-8")
    tr.track_structured("s2", str(f), work)  # v1 = 原始，回填快照1
    f.write_text("被改", encoding="utf-8")
    # 回退到快照1（锚点 1）：快照条目直接命中
    assert tr.preview("s2", 1)["restored"] == [str(f)]
    # 回退到快照0（锚点 0，早于首触）：first-version fallback 找到 v1
    pv = tr.preview("s2", 0)
    assert pv["restored"] == [str(f)]
    tr.restore("s2", 0)
    assert f.read_text(encoding="utf-8") == "原始"


def test_track_idempotent_within_snapshot(tracker_env):
    store, work, tr = tracker_env
    f = work / "a.md"
    f.write_text("1", encoding="utf-8")
    _turn(store, "s2", 0, "q1")
    tr.begin_turn("s2")
    tr.track_structured("s2", str(f), work)
    f.write_text("2", encoding="utf-8")
    tr.track_structured("s2", str(f), work)  # 第二次编辑：最新快照已追踪 → 跳过
    snaps = store.list_rewind_snapshots("s2")
    entry = snaps[-1]["tracked_file_backups"][str(f)]
    assert entry["version"] == 1  # v1 仍是「1」的内容，不被 2 覆盖
    tr.restore("s2", 0)
    assert f.read_text(encoding="utf-8") == "1"


def test_purge(tracker_env, tmp_path):
    store, work, tr = tracker_env
    _turn(store, "s2", 0, "q1")
    tr.begin_turn("s2")
    f = work / "x.md"
    f.write_text("x", encoding="utf-8")
    tr.track_structured("s2", str(f), work)
    backup_dir = tmp_path / "rewind" / "s2"
    assert backup_dir.exists()
    tr.purge("s2")
    assert not backup_dir.exists()


def test_bind_rewind_hooks_wraps_handlers(tmp_path):
    store = SessionsStore(tmp_path / "h.db")
    _create(store, sid="s3")
    tr = RewindTracker(store, tmp_path / "rewind")
    calls = []
    handlers = {
        "write_file": lambda **kw: calls.append(("write", kw)) or "ok",
        "bash": lambda **kw: calls.append(("bash", kw)) or "ok",
        "read_file": lambda **kw: calls.append(("read", kw)) or "ok",
    }
    bind_rewind_hooks(handlers, tr, "s3", tmp_path)
    assert handlers["write_file"](path="a.md", content="x") == "ok"
    assert handlers["bash"](command="cat a.md") == "ok"
    assert handlers["read_file"](path="a.md") == "ok"
    # 原逻辑照常执行（三个调用都到）
    assert [c[0] for c in calls] == ["write", "bash", "read"]
    # tracker=None / 空 session 为 no-op（绑定不炸、原 handler 保留）
    handlers2 = {"write_file": lambda **kw: "raw"}
    bind_rewind_hooks(handlers2, None, "s3", tmp_path)
    assert handlers2["write_file"](path="a") == "raw"


# ---------- planify guard：extract_write_targets ----------

def test_extract_write_targets():
    from planify.tools.guard import extract_write_targets
    work = Path("W:/kb")
    # 写段：首 token（命令词）与 flag（-i）排除；sed 脚本含分隔符是已接受噪音
    out = extract_write_targets("sed -i s/a/b/ note.md", work)
    assert work / "note.md" in out and (work / "-i") not in out
    out = extract_write_targets("cp a.md b.md", work)
    assert out == [work / "a.md", work / "b.md"]
    # 重定向段：整段按写
    out = extract_write_targets("python gen.py > out.txt", work)
    assert (work / "gen.py") in out and (work / "out.txt") in out
    # 纯读段（无写词无重定向）不产生候选
    assert extract_write_targets("cat a.md && grep x b.md", work) == []
    # 空设备排除；段落切分（|;& 换行）只取写段
    out = extract_write_targets("echo hi > nul; cat r.md | sort > o.txt", work)
    assert out == [work / "o.txt"]
    # 管道后段写词
    out = extract_write_targets("cat src | tee dst.log", work)
    assert out == [work / "dst.log"]


# ---------- API 端点 ----------

@pytest.fixture()
def api_env(tmp_path, monkeypatch):
    from doclens.web_v2.api import sessions as sessions_api

    store = SessionsStore(tmp_path / "api.db")
    _create(store, sid="s1")
    for seq, kind, c in [(0, "message_user", "q1"), (1, "message_ai", "a1"),
                         (2, "message_user", "q2"), (3, "message_ai", "a2")]:
        _append(store, "s1", seq, kind, {"content": c})
    tracker = RewindTracker(store, tmp_path / "rewind")
    monkeypatch.setattr(sessions_api, "_get_store", lambda: store)
    monkeypatch.setattr(
        "doclens.web_v2.deps.get_rewind_tracker", lambda: tracker
    )
    return store, tracker, sessions_api


def test_rewind_preview_endpoint(api_env):
    store, tracker, api = api_env
    res = asyncio.run(api.rewind_preview(session_id="s1", point_seq=2))
    assert res["ok"] and res["files"]["restored"] == []


def test_rewind_endpoint_flow(api_env):
    store, tracker, api = api_env
    from doclens.web_v2.models.session import SessionRewindRequest
    res = asyncio.run(api.rewind_session(
        "s1", SessionRewindRequest(point_seq=2, restore_files=False),
    ))
    assert res["ok"] and res["message_count"] == 2
    # rewound 已落库 + 投影生效
    assert _contents(store, "s1") == ["q1", "a1"]
    assert store.rewind_boundaries("s1") == [(2, 4)]


def test_rewind_endpoint_rejects(api_env):
    from doclens.web_v2.api.errors import CortexAPIError
    _, _, api = api_env
    from doclens.web_v2.models.session import SessionRewindRequest
    # 死锚点 / 非消息 seq → 400
    with pytest.raises(CortexAPIError):
        asyncio.run(api.rewind_session(
            "s1", SessionRewindRequest(point_seq=99, restore_files=False),
        ))
    with pytest.raises(CortexAPIError):
        asyncio.run(api.rewind_preview(session_id="s1", point_seq=1))
    # 流式中 → 409
    from doclens.web_v2 import chat_interrupt
    ev = chat_interrupt.register_interrupt("s1")
    try:
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(api.rewind_session(
                "s1", SessionRewindRequest(point_seq=2, restore_files=False),
            ))
        assert ei.value.status == 409
    finally:
        chat_interrupt.unregister_interrupt("s1", ev)
