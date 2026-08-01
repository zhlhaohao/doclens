"""doclens.diary_worker 测试：总结流程（mock 视觉与对话模型）。"""
from datetime import date
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from doclens import diary
from doclens.diary_worker import DiaryWorker, _strip_thinking, build_summary_input


def _config(**overrides):
    base = dict(
        planify_api_key="sk-test",
        planify_model_id="test-model",
        planify_provider="anthropic",
        planify_protocol="",
        planify_base_url=None,
        vision_api_key=None,
        vision_base_url="https://example.invalid/v1",
        vision_model="vl-test",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class _FakeIdx:
    """IndexManager 替身：只提供 worker 用到的接口。"""

    def __init__(self, workdir: Path):
        self.search_path = str(workdir)
        self.dirty = False
        self.reindexed = False

    def mark_index_dirty(self):
        self.dirty = True

    def trigger_background_reindex(self):
        self.reindexed = True


@pytest.fixture()
def workdir(tmp_path: Path) -> Path:
    return tmp_path


def _raw_day(workdir: Path, date_str: str) -> None:
    diary.append_text(workdir, date_str, "09:15", "091500", "早上喝了咖啡")
    diary.append_text(workdir, date_str, "18:30", "183000", "晚上散步")


class TestBuildSummaryInput:
    def test_text_and_photo_lines(self):
        frags = [
            diary.Fragment(fid="a", time="09:15", kind="text", text="早上喝了咖啡"),
            diary.Fragment(
                fid="b", time="18:30", kind="photo", text="晚霞",
                image="images/2026-08-01/x.webp",
            ),
        ]
        s = build_summary_input(frags, {"b": "天边大片橙红色晚霞"})
        assert "09:15 早上喝了咖啡" in s
        assert "18:30 [照片 images/2026-08-01/x.webp]" in s
        assert "备注：晚霞" in s
        assert "照片内容：天边大片橙红色晚霞" in s

    def test_photo_without_description_or_caption(self):
        frags = [
            diary.Fragment(
                fid="b", time="18:30", kind="photo", text="照片",
                image="images/2026-08-01/x.webp",
            ),
        ]
        s = build_summary_input(frags, {})
        assert "备注" not in s and "照片内容" not in s


class TestStripThinking:
    def test_closed_think_block_removed(self):
        text = "<think>让我想想…</think>今天很充实。"
        assert _strip_thinking(text) == "今天很充实。"

    def test_thinking_variant_and_multiline(self):
        text = "<thinking>\n多行\n推理\n</thinking>\n\n正文"
        assert _strip_thinking(text) == "正文"

    def test_unclosed_think_truncates(self):
        """思考段未闭合（响应截断）：正文没写出来，整体丢弃为空。"""
        assert _strip_thinking("<think>推理到一半") == ""

    def test_no_think_passthrough(self):
        assert _strip_thinking("普通正文") == "普通正文"


class TestSummarizeDay:
    def test_success_rewrites_day(self, workdir: Path):
        _raw_day(workdir, "2026-07-31")
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config())

        with patch("doclens.diary_worker.summarize_day_text", return_value="今天很充实。"):
            worker._summarize_day("2026-07-31", _config())

        day = diary.get_day(workdir, "2026-07-31")
        assert day.state == "summarized"
        assert day.content == "今天很充实。"
        assert idx.dirty and idx.reindexed
        assert worker.status()["summarized_count"] == 1

    def test_skips_non_raw_day(self, workdir: Path):
        _raw_day(workdir, "2026-07-31")
        diary.rewrite_day(workdir, "2026-07-31", "已有成品")
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config())

        with patch("doclens.diary_worker.summarize_day_text") as m:
            worker._summarize_day("2026-07-31", _config())
            m.assert_not_called()
        assert diary.get_day(workdir, "2026-07-31").content == "已有成品"

    def test_chat_failure_keeps_raw(self, workdir: Path):
        """整日重试：对话模型失败 → 原文保留在片段态，不覆盖。"""
        _raw_day(workdir, "2026-07-31")
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config())

        with patch(
            "doclens.diary_worker.summarize_day_text", side_effect=RuntimeError("api down")
        ), pytest.raises(RuntimeError):
            worker._summarize_day("2026-07-31", _config())

        day = diary.get_day(workdir, "2026-07-31")
        assert day.state == "raw"
        assert len(day.fragments) == 2

    def test_vision_failure_degrades_per_image(self, workdir: Path):
        """逐图降级：视觉失败仅该图退化为备注，整日总结照常完成。"""
        import io

        from PIL import Image

        img = Image.new("RGB", (100, 80), (1, 2, 3))
        buf = io.BytesIO()
        img.save(buf, "JPEG")
        rel = diary.save_photo(workdir, "2026-07-31", "183012", buf.getvalue())
        diary.append_photo(workdir, "2026-07-31", "18:30", "183012", rel, "晚霞")

        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config(vision_api_key="vk"))
        captured = {}

        def fake_input(frags, descriptions):
            captured["descriptions"] = descriptions
            return build_summary_input(frags, descriptions)

        with patch(
            "doclens.diary_worker.describe_photo", side_effect=RuntimeError("vision down")
        ), patch(
            "doclens.diary_worker.build_summary_input", side_effect=fake_input
        ), patch(
            "doclens.diary_worker.summarize_day_text", return_value="看到了晚霞。"
        ):
            worker._summarize_day("2026-07-31", _config(vision_api_key="vk"))

        assert captured["descriptions"] == {}  # 降级：无描述，但不阻塞
        assert diary.get_day(workdir, "2026-07-31").state == "summarized"


class TestScanOnce:
    def test_scan_summarizes_all_pending(self, workdir: Path):
        _raw_day(workdir, "2026-07-30")
        _raw_day(workdir, "2026-07-31")
        _raw_day(workdir, date.today().isoformat())  # 今天的不总结
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config())

        with patch("doclens.diary_worker.summarize_day_text", return_value="成品"):
            worker._scan_once()

        assert diary.get_day(workdir, "2026-07-30").state == "summarized"
        assert diary.get_day(workdir, "2026-07-31").state == "summarized"
        assert diary.get_day(workdir, date.today().isoformat()).state == "raw"

    def test_scan_idle_without_api_key(self, workdir: Path):
        _raw_day(workdir, "2026-07-31")
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config(planify_api_key=None))
        with patch("doclens.diary_worker.summarize_day_text") as m:
            worker._scan_once()
            m.assert_not_called()
        assert diary.get_day(workdir, "2026-07-31").state == "raw"

    def test_failure_backoff_skips_next_round(self, workdir: Path):
        _raw_day(workdir, "2026-07-31")
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config())
        with patch(
            "doclens.diary_worker.summarize_day_text", side_effect=RuntimeError("down")
        ) as m:
            worker._scan_once()
            assert m.call_count == 1
            worker._scan_once()  # 退避中：不再调用
            assert m.call_count == 1
        assert "2026-07-31" in worker._retry_after
        assert diary.get_day(workdir, "2026-07-31").state == "raw"
