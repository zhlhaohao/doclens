"""doclens.diary_worker 测试：总结流程（mock 视觉与对话模型）。"""
from datetime import date
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from doclens import diary
from doclens.diary_worker import (
    DiaryWorker,
    _strip_thinking,
    build_summary_input,
    describe_photo,
    seconds_until_next_run,
)


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
        vision_protocol=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class TestDescribePhotoProtocol:
    """describe_photo 按 vision_protocol 分流（openai-compat / anthropic）。"""

    def test_default_calls_openai_path(self, tmp_path, monkeypatch):
        img = tmp_path / "x.webp"
        img.write_bytes(b"\x00")
        called = {}

        def fake_openai(b64, media, prompt, c):
            called["path"] = "openai"
            return "openai-desc"

        monkeypatch.setattr("doclens.diary_worker._vision_openai", fake_openai)
        assert describe_photo(img, _config(vision_protocol=None)) == "openai-desc"
        assert called["path"] == "openai"

    def test_anthropic_calls_anthropic_path(self, tmp_path, monkeypatch):
        img = tmp_path / "x.webp"
        img.write_bytes(b"\x00")
        called = {}

        def fake_anthropic(b64, media, prompt, c):
            called["path"] = "anthropic"
            return "anthropic-desc"

        monkeypatch.setattr("doclens.diary_worker._vision_anthropic", fake_anthropic)
        assert describe_photo(img, _config(vision_protocol="anthropic")) == "anthropic-desc"
        assert called["path"] == "anthropic"

    def test_vision_anthropic_uses_planify_provider(self, tmp_path, monkeypatch):
        """anthropic 分支：构造 image source block，经 planify provider，提取 text。"""
        import base64 as _b64

        from doclens.diary_worker import _vision_anthropic

        img = tmp_path / "x.webp"
        img.write_bytes(b"\x00")
        cfg = _config(
            vision_protocol="anthropic",
            vision_api_key="mk",
            vision_base_url="https://api.minimaxi.com/anthropic",
            vision_model="MiniMax-M3",
        )
        captured = {}

        class _FakeResp:
            def __init__(self):
                self.content = [SimpleNamespace(text="一只橘猫在长椅上")]

        class _FakeProvider:
            def chat(self, messages, system, tools, max_tokens):
                captured["messages"] = messages
                captured["max_tokens"] = max_tokens
                return _FakeResp()

        def fake_create(provider_cfg):
            captured["provider_cfg"] = provider_cfg
            return _FakeProvider()

        monkeypatch.setattr("planify.core.llm.create_provider", fake_create)
        result = _vision_anthropic(
            _b64.b64encode(img.read_bytes()).decode("ascii"),
            "image/webp",
            "描述这张照片",
            cfg,
        )
        assert result == "一只橘猫在长椅上"
        # image source block（Anthropic 格式）
        content = captured["messages"][0]["content"]
        assert any(
            b.get("type") == "image"
            and b["source"]["type"] == "base64"
            and b["source"]["media_type"] == "image/webp"
            for b in content
        )
        # provider 用 vision_* 配置（非 planify_*）
        assert captured["provider_cfg"]["base_url"] == "https://api.minimaxi.com/anthropic"
        assert captured["provider_cfg"]["model_id"] == "MiniMax-M3"
        assert captured["provider_cfg"]["api_key"] == "mk"


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


class TestSecondsUntilNextRun:
    def test_before_0005_targets_today(self):
        # 00:00 → 5 分钟后
        assert seconds_until_next_run(datetime(2026, 8, 2, 0, 0, 0)) == 300.0
        # 23:59 → 6 分钟
        assert seconds_until_next_run(datetime(2026, 8, 2, 23, 59, 0)) == 360.0

    def test_after_0005_targets_tomorrow(self):
        # 00:06 → 23h59m
        assert seconds_until_next_run(datetime(2026, 8, 2, 0, 6, 0)) == 24 * 3600 - 60
        # 正午 → 12h05m
        assert seconds_until_next_run(datetime(2026, 8, 2, 12, 0, 0)) == 12 * 3600 + 300

    def test_exactly_0005_counts_as_past(self):
        # 整 00:05 也排到下一天（避免刚跑完又立刻再跑）
        assert seconds_until_next_run(datetime(2026, 8, 2, 0, 5, 0)) == 24 * 3600.0


class TestNextWakeup:
    def test_no_retry_waits_until_0005(self, workdir: Path):
        worker = DiaryWorker(_FakeIdx(workdir), lambda: _config())
        wait = worker._next_wakeup_s()
        assert 0 < wait <= 24 * 3600

    def test_pending_retry_wakes_earlier(self, workdir: Path):
        import time

        worker = DiaryWorker(_FakeIdx(workdir), lambda: _config())
        worker._retry_after["2026-08-01"] = (1, time.monotonic() + 60)
        assert worker._next_wakeup_s() <= 60.0


class TestBuildSummaryInput:
    def test_text_and_photo_as_entries(self):
        frags = [
            diary.Fragment(fid="a", time="09:15", kind="text", text="早上喝了咖啡"),
            diary.Fragment(
                fid="b", time="18:30", kind="photo", text="晚霞",
                image="images/2026-08-01/x.webp",
            ),
        ]
        s = build_summary_input(frags, {"b": "天边大片橙红色晚霞"})
        assert "条目1（文字，09:15）" in s
        assert "09:15 早上喝了咖啡" in s
        assert "条目2（照片，18:30）" in s
        assert "![晚霞](images/2026-08-01/x.webp)" in s
        assert "备注：晚霞" in s
        assert "照片内容：天边大片橙红色晚霞" in s

    def test_text_fragments_within_1h_merged(self):
        """相邻间隔 ≤60min 的文字片段合为一个编号条目。"""
        frags = [
            diary.Fragment(fid="a", time="10:12", kind="text", text="开始工作"),
            diary.Fragment(fid="b", time="10:30", kind="text", text="开了个会"),
            diary.Fragment(fid="c", time="11:00", kind="text", text="继续写代码"),
            diary.Fragment(fid="d", time="12:30", kind="text", text="吃午饭"),
        ]
        s = build_summary_input(frags, {})
        # 10:12→10:30(18)→11:00(30) 相邻 ≤60 → 条目1（10:12~11:00）；11:00→12:30(90)>60 → 条目2
        assert "条目1（文字，10:12~11:00）" in s
        assert "条目2（文字，12:30）" in s
        assert s.count("条目") == 2

    def test_text_fragments_boundary_60min_merged(self):
        """恰好 60min 间隔仍合并（含端点）。"""
        frags = [
            diary.Fragment(fid="a", time="10:00", kind="text", text="a"),
            diary.Fragment(fid="b", time="11:00", kind="text", text="b"),
        ]
        s = build_summary_input(frags, {})
        assert s.count("条目") == 1
        assert "条目1（文字，10:00~11:00）" in s

    def test_text_fragments_over_1h_split(self):
        frags = [
            diary.Fragment(fid="a", time="10:00", kind="text", text="a"),
            diary.Fragment(fid="b", time="11:01", kind="text", text="b"),
        ]
        s = build_summary_input(frags, {})
        assert s.count("条目") == 2  # 61min > 60 → 分组

    def test_photo_breaks_text_group(self):
        """图片片段独立成条目，中断文字组（即使前后文字在 1h 内）。"""
        frags = [
            diary.Fragment(fid="a", time="10:00", kind="text", text="a"),
            diary.Fragment(fid="b", time="10:30", kind="photo", text="照片", image="images/x.webp"),
            diary.Fragment(fid="c", time="10:45", kind="text", text="c"),
        ]
        s = build_summary_input(frags, {})
        assert s.count("条目") == 3  # a | photo | c 三条目

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
