"""doclens.diary_worker 测试：确定性合成流程（仅 mock 视觉模型）。"""
from datetime import date
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from doclens import diary
from doclens.diary_worker import (
    DiaryWorker,
    compose_day_body,
    describe_photo,
    seconds_until_next_run,
)
from doclens.vision_client import strip_thinking


def _config(**overrides):
    base = dict(
        planify_api_key="sk-test",
        planify_model_id="test-model",
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

        monkeypatch.setattr("doclens.vision_client._vision_openai", fake_openai)
        assert describe_photo(img, _config(vision_protocol=None)) == "openai-desc"
        assert called["path"] == "openai"

    def test_anthropic_calls_anthropic_path(self, tmp_path, monkeypatch):
        img = tmp_path / "x.webp"
        img.write_bytes(b"\x00")
        called = {}

        def fake_anthropic(b64, media, prompt, c):
            called["path"] = "anthropic"
            return "anthropic-desc"

        monkeypatch.setattr("doclens.vision_client._vision_anthropic", fake_anthropic)
        assert describe_photo(img, _config(vision_protocol="anthropic")) == "anthropic-desc"
        assert called["path"] == "anthropic"

    def test_vision_anthropic_uses_planify_create_provider(self, tmp_path, monkeypatch):
        """anthropic 分支：构造 image source block，经 planify provider，提取 text。"""
        import base64 as _b64

        from doclens.vision_client import _vision_anthropic

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
        assert captured["provider_cfg"]["api_key"] == "mk"
        assert captured["provider_cfg"]["model_id"] == "MiniMax-M3"
        assert captured["provider_cfg"]["base_url"] == "https://api.minimaxi.com/anthropic"

    def test_vision_openai_uses_planify_create_provider(self, monkeypatch):
        """openai 分支：同样经 planify provider（openai_compat 协议），无手写 urllib。"""
        from doclens.vision_client import _vision_openai

        cfg = _config(
            vision_protocol=None,
            vision_api_key="sk",
            vision_base_url="https://dashscope.example/v1",
            vision_model="qwen-vl-max",
        )
        captured = {}

        class _FakeResp:
            def __init__(self):
                self.content = [SimpleNamespace(text="一张表格的图")]

        class _FakeProvider:
            def chat(self, messages, system, tools, max_tokens):
                captured["messages"] = messages
                captured["max_tokens"] = max_tokens
                return _FakeResp()

        def fake_create(provider_cfg):
            captured["provider_cfg"] = provider_cfg
            return _FakeProvider()

        monkeypatch.setattr("planify.core.llm.create_provider", fake_create)
        result = _vision_openai("QUJD", "image/webp", "描述这张图", cfg, max_tokens=777)
        assert result == "一张表格的图"
        # openai_compat 协议 + vision_* 配置 + max_tokens 透传
        assert captured["provider_cfg"]["protocol"] == "openai_compat"
        assert captured["provider_cfg"]["api_key"] == "sk"
        assert captured["provider_cfg"]["model_id"] == "qwen-vl-max"
        assert captured["max_tokens"] == 777
        # 消息仍是 Anthropic 风格 image source block（翻译在 provider 内部完成）
        assert any(
            b.get("type") == "image" and b["source"]["type"] == "base64"
            for b in captured["messages"][0]["content"]
        )


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


class TestComposeDayBody:
    def test_text_and_photo_timeline(self):
        frags = [
            diary.Fragment(fid="a", time="09:15", kind="text", text="早上喝了咖啡"),
            diary.Fragment(
                fid="b", time="18:30", kind="photo", text="照片",
                image="images/2026-08-01/x.webp",
            ),
        ]
        s = compose_day_body(frags, {"b": "天边大片橙红色晚霞"})
        assert s.splitlines() == [
            "- 09:15 早上喝了咖啡",
            "- 18:30 ![照片](images/2026-08-01/x.webp) 天边大片橙红色晚霞",
        ]

    def test_photo_caption_overrides_description(self):
        """用户手动备注优先：不再追加 AI 视觉解读，避免成文重复/冲突。"""
        frags = [
            diary.Fragment(
                fid="b", time="18:30", kind="photo", text="晚霞",
                image="images/2026-08-01/x.webp",
            ),
        ]
        s = compose_day_body(frags, {"b": "天边大片橙红色晚霞"})
        assert s == "- 18:30 ![晚霞](images/2026-08-01/x.webp)"

    def test_text_fragments_not_clustered(self):
        """逐条时间线：相邻文字片段不合并，每条独立一行。"""
        frags = [
            diary.Fragment(fid="a", time="10:12", kind="text", text="开始工作"),
            diary.Fragment(fid="b", time="10:30", kind="text", text="开了个会"),
            diary.Fragment(fid="c", time="11:00", kind="text", text="继续写代码"),
        ]
        s = compose_day_body(frags, {})
        assert s.splitlines() == [
            "- 10:12 开始工作",
            "- 10:30 开了个会",
            "- 11:00 继续写代码",
        ]

    def test_photo_without_description_keeps_caption_only(self):
        """视觉描述缺失：仅图片引用（备注在 alt 文本里），不阻塞。"""
        frags = [
            diary.Fragment(
                fid="b", time="18:30", kind="photo", text="晚霞",
                image="images/2026-08-01/x.webp",
            ),
        ]
        s = compose_day_body(frags, {})
        assert s == "- 18:30 ![晚霞](images/2026-08-01/x.webp)"

    def test_photo_default_caption_alt(self):
        """备注为默认「照片」时 alt 文本用「照片」，不产生重复描述。"""
        frags = [
            diary.Fragment(
                fid="b", time="18:30", kind="photo", text="照片",
                image="images/2026-08-01/x.webp",
            ),
        ]
        s = compose_day_body(frags, {})
        assert s == "- 18:30 ![照片](images/2026-08-01/x.webp)"

    def test_photo_description_appended_after_ref(self):
        """有视觉描述时拼接在图片引用之后。"""
        frags = [
            diary.Fragment(
                fid="b", time="18:30", kind="photo", text="照片",
                image="images/2026-08-01/x.webp",
            ),
        ]
        s = compose_day_body(frags, {"b": "一只橘猫"})
        assert s == "- 18:30 ![照片](images/2026-08-01/x.webp) 一只橘猫"


class TestStripThinking:
    def test_closed_think_block_removed(self):
        text = "<think>让我想想…</think>今天很充实。"
        assert strip_thinking(text) == "今天很充实。"

    def test_thinking_variant_and_multiline(self):
        text = "<thinking>\n多行\n推理\n</thinking>\n\n正文"
        assert strip_thinking(text) == "正文"

    def test_unclosed_think_truncates(self):
        """思考段未闭合（响应截断）：正文没写出来，整体丢弃为空。"""
        assert strip_thinking("<think>推理到一半") == ""

    def test_no_think_passthrough(self):
        assert strip_thinking("普通正文") == "普通正文"


class TestSummarizeDay:
    def test_success_rewrites_day(self, workdir: Path):
        _raw_day(workdir, "2026-07-31")
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config())

        worker._summarize_day("2026-07-31", _config())

        day = diary.get_day(workdir, "2026-07-31")
        assert day.state == "summarized"
        assert day.content == "- 09:15 早上喝了咖啡\n- 18:30 晚上散步"
        assert idx.dirty and idx.reindexed
        assert worker.status()["summarized_count"] == 1

    def test_skips_non_raw_day(self, workdir: Path):
        _raw_day(workdir, "2026-07-31")
        diary.rewrite_day(workdir, "2026-07-31", "已有成品")
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config())

        worker._summarize_day("2026-07-31", _config())
        assert diary.get_day(workdir, "2026-07-31").content == "已有成品"

    def test_vision_failure_degrades_per_image(self, workdir: Path):
        """逐图降级：视觉失败仅该图退化为备注（alt 文本），整日合成照常完成。"""
        import io

        from PIL import Image

        img = Image.new("RGB", (100, 80), (1, 2, 3))
        buf = io.BytesIO()
        img.save(buf, "JPEG")
        rel = diary.save_photo(workdir, "2026-07-31", "183012", buf.getvalue())
        diary.append_photo(workdir, "2026-07-31", "18:30", "183012", rel, "晚霞")

        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config(vision_api_key="vk"))

        with patch(
            "doclens.diary_worker.describe_photo", side_effect=RuntimeError("vision down")
        ):
            worker._summarize_day("2026-07-31", _config(vision_api_key="vk"))

        day = diary.get_day(workdir, "2026-07-31")
        assert day.state == "summarized"
        assert day.content == f"- 18:30 ![晚霞]({rel})"


class TestScanOnce:
    def test_scan_summarizes_all_pending(self, workdir: Path):
        _raw_day(workdir, "2026-07-30")
        _raw_day(workdir, "2026-07-31")
        _raw_day(workdir, date.today().isoformat())  # 今天的不合成
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config())

        worker._scan_once()

        expected = "- 09:15 早上喝了咖啡\n- 18:30 晚上散步"
        assert diary.get_day(workdir, "2026-07-30").content == expected
        assert diary.get_day(workdir, "2026-07-31").content == expected
        assert diary.get_day(workdir, date.today().isoformat()).state == "raw"

    def test_scan_composes_without_planify_key(self, workdir: Path):
        """合成不需要对话模型：未配置 PLANIFY_API_KEY 也照常合成。"""
        _raw_day(workdir, "2026-07-31")
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config(planify_api_key=None))
        worker._scan_once()
        day = diary.get_day(workdir, "2026-07-31")
        assert day.state == "summarized"
        assert day.content == "- 09:15 早上喝了咖啡\n- 18:30 晚上散步"

    def test_failure_backoff_skips_next_round(self, workdir: Path):
        _raw_day(workdir, "2026-07-31")
        idx = _FakeIdx(workdir)
        worker = DiaryWorker(idx, lambda: _config())
        with patch(
            "doclens.diary_worker.compose_day_body", side_effect=RuntimeError("io error")
        ) as m:
            worker._scan_once()
            assert m.call_count == 1
            worker._scan_once()  # 退避中：不再调用
            assert m.call_count == 1
        assert "2026-07-31" in worker._retry_after
        assert diary.get_day(workdir, "2026-07-31").state == "raw"
