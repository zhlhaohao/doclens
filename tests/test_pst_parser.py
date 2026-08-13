"""pst_parser 附件解析超时与可观测性测试（PST 卡死修复）。

背景：pdf_to_tree / docx_to_tree 等声明 async def 但内部同步阻塞，PST 消费者
直接 await 会卡死整个事件循环。修复后附件解析在独立线程池执行 + 单附件超时。
"""
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

import pytest

import treesearch.parsers.pst_parser as P
from treesearch.parsers.pst_parser import _parse_attachment_text


def _patch_pool(monkeypatch) -> ThreadPoolExecutor:
    """用独立线程池替换模块级 _ATTACHMENT_POOL，避免卡死的慢线程污染其他测试。"""
    pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="test-att")
    monkeypatch.setattr(P, "_ATTACHMENT_POOL", pool)
    return pool


def test_attachment_parse_timeout(monkeypatch, tmp_path):
    """慢 parser 超过 _ATTACHMENT_PARSE_TIMEOUT_S → 抛 TimeoutError，且不等到慢调用结束。"""
    _patch_pool(monkeypatch)
    monkeypatch.setattr(P, "_ATTACHMENT_PARSE_TIMEOUT_S", 0.3)

    def slow_sync(_path: str) -> dict:
        time.sleep(2)
        return {}

    monkeypatch.setattr(P, "_parse_attachment_sync", slow_sync)
    fake = tmp_path / "x.pdf"
    fake.write_bytes(b"%PDF")

    t0 = time.monotonic()
    with pytest.raises(asyncio.TimeoutError):
        asyncio.run(_parse_attachment_text(str(fake)))
    elapsed = time.monotonic() - t0
    assert elapsed < 1.0, f"超时未及时触发，耗时 {elapsed:.1f}s（应 ~0.3s）"


def test_attachment_parse_not_blocked_by_slow_one(monkeypatch, tmp_path):
    """前一个附件超时卡在池里，后续附件仍能立即解析（主流程不被坏附件拖死）。"""
    _patch_pool(monkeypatch)
    monkeypatch.setattr(P, "_ATTACHMENT_PARSE_TIMEOUT_S", 0.3)

    def slow_sync(_path: str) -> dict:
        time.sleep(1.5)
        return {}

    monkeypatch.setattr(P, "_parse_attachment_sync", slow_sync)
    slow_file = tmp_path / "slow.pdf"
    slow_file.write_bytes(b"%PDF")
    with pytest.raises(asyncio.TimeoutError):
        asyncio.run(_parse_attachment_text(str(slow_file)))

    # 慢线程仍在池里 sleep(1.5)；切快 parser，确认不被阻塞
    def fast_sync(_path: str) -> dict:
        return {"structure": [{"title": "快附件标题", "text": "正文"}]}

    monkeypatch.setattr(P, "_parse_attachment_sync", fast_sync)
    fast_file = tmp_path / "fast.pdf"
    fast_file.write_bytes(b"%PDF")
    t0 = time.monotonic()
    text = asyncio.run(_parse_attachment_text(str(fast_file)))
    elapsed = time.monotonic() - t0
    assert elapsed < 0.8, f"快附件被慢线程阻塞，耗时 {elapsed:.1f}s"
    assert "快附件标题" in text and "正文" in text


def test_attachment_parse_normal(monkeypatch, tmp_path):
    """正常 parser 返回 tree → flatten 出文本（非回归）。"""
    _patch_pool(monkeypatch)
    monkeypatch.setattr(P, "_ATTACHMENT_PARSE_TIMEOUT_S", 5)

    def ok_sync(_path: str) -> dict:
        return {
            "structure": [
                {"title": "第一节", "text": "内容 A"},
                {"title": "纯标题节点"},  # 无 text，只取 title
            ]
        }

    monkeypatch.setattr(P, "_parse_attachment_sync", ok_sync)
    f = tmp_path / "ok.pdf"
    f.write_bytes(b"%PDF")
    text = asyncio.run(_parse_attachment_text(str(f)))
    assert "第一节" in text and "内容 A" in text
    assert "纯标题节点" in text
