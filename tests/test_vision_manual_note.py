# -*- coding: utf-8 -*-
"""AP-50：手动备注不得被静默覆盖。

三条本来会让用户手写内容无声消失的路径：
1. `set_manual_note` 用 UPDATE 打 manual 标记，队列无该行时影响 0 行却照常返回成功
   —— 备注只活在文件元数据里，而元数据写入失败仅 warning 降级；
2. force 重建 `vision_clear()` 无条件清空队列 → manual 标记丢失；
3. 重新入队 `vision_enqueue()` 无条件重置 pending → worker 用 AI 结果整篇覆盖。

护栏统一为「model='manual' 的行不参与清理/入队/取件」。
"""
import time

import pytest

from treesearch.fts import FTS5Index

_SRC = "/kb/a.jpg"


@pytest.fixture()
def fts(tmp_path):
    db = FTS5Index(db_path=str(tmp_path / "index.db"))
    yield db
    db.close()


def _row(fts, path=_SRC):
    r = fts._conn.execute(
        "SELECT status, model FROM vision_queue WHERE source_path = ?", (path,)
    ).fetchone()
    return None if r is None else (r[0], r[1])


def _mark_manual(fts, path=_SRC):
    fts._conn.execute(
        "INSERT INTO vision_queue (source_path, rel_path, status, attempts, model,"
        " last_error, updated_at) VALUES (?, '', 'done', 0, 'manual', '', ?)",
        (path, time.time()),
    )
    fts.commit()


class TestManualSurvivesClear:
    def test_clear_keeps_manual_rows(self, fts):
        _mark_manual(fts)
        fts.vision_enqueue("/kb/b.jpg", "b.jpg")
        assert _row(fts, "/kb/b.jpg") == ("pending", "")

        fts.vision_clear()

        assert _row(fts) == ("done", "manual"), "手动备注不是缓存，重建不得清掉"
        assert _row(fts, "/kb/b.jpg") is None, "普通行仍应被清空以重新登记"


class TestManualSurvivesEnqueue:
    def test_enqueue_is_noop_for_manual(self, fts):
        _mark_manual(fts)
        fts.vision_enqueue(_SRC, "a.jpg")
        assert _row(fts) == ("done", "manual")

    def test_enqueue_still_resets_normal_rows(self, fts):
        fts.vision_enqueue(_SRC, "a.jpg")
        fts._conn.execute(
            "UPDATE vision_queue SET status='done', model='vision-v1', attempts=2"
        )
        fts.commit()

        fts.vision_enqueue(_SRC, "a.jpg")

        status, model = _row(fts)
        assert status == "pending"
        assert model == "vision-v1", "model 由 mark_done 覆写，入队不动它（既有语义）"


class TestManualNeverClaimed:
    def test_next_pending_skips_manual(self, fts):
        _mark_manual(fts)
        # 历史脏数据：manual 行被旧版本置成了 pending
        fts._conn.execute(
            "UPDATE vision_queue SET status='pending' WHERE source_path = ?", (_SRC,)
        )
        fts.commit()

        assert fts.vision_next_pending() is None
        assert _row(fts)[0] == "pending", "不得被抢占成 processing"

    def test_next_pending_still_returns_normal_rows(self, fts):
        _mark_manual(fts)
        fts.vision_enqueue("/kb/b.jpg", "b.jpg")
        item = fts.vision_next_pending()
        assert item["source_path"] == "/kb/b.jpg"


class TestNotePersistsWithoutQueueRow:
    """端到端：队列里没有该图的行时，手动备注仍要落成 manual 行。"""

    def test_upsert_creates_manual_row(self, fts):
        # 复刻 _run_note_blocking 的队列落库语句（不调视觉 API / 不建索引）
        assert _row(fts) is None
        fts._conn.execute(
            "INSERT INTO vision_queue "
            "(source_path, rel_path, status, attempts, model, last_error, updated_at) "
            "VALUES (?, '', 'done', 0, 'manual', '', ?) "
            "ON CONFLICT(source_path) DO UPDATE SET "
            "    status='done', attempts=0, model='manual', "
            "    last_error='', updated_at=excluded.updated_at",
            (_SRC, time.time()),
        )
        fts.commit()
        assert _row(fts) == ("done", "manual")
        # 之后即使重建，也不会被清 / 被入队 / 被取件
        fts.vision_clear()
        fts.vision_enqueue(_SRC, "a.jpg")
        assert _row(fts) == ("done", "manual")
        assert fts.vision_next_pending() is None
