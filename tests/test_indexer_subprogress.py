# -*- coding: utf-8 -*-
"""验证 build_index 把 sub_progress_callback 透传给 parser（PST 邮件级子进度链路）。

链路：build_index(sub_progress_callback) → _index_one 在 common 里绑 fp 闭包
→ parser_fn(**common) 收到 → 调用 cb(n) → 上层回调拿到 (fp, n)。
"""
import asyncio

from treesearch import TreeSearchConfig, set_config
from treesearch.indexer import build_index
from treesearch.parsers import registry as reg_module
from treesearch.parsers.registry import ParserRegistry


def test_build_index_propagates_sub_progress_callback(tmp_path):
    set_config(TreeSearchConfig())
    f = tmp_path / "demo.mockpst"
    f.write_text("dummy")

    received: list[tuple[str, int]] = []

    async def mock_parser(fp: str, **kw) -> dict:
        cb = kw.get("sub_progress_callback")
        if cb:
            cb(100)  # 模拟 PST parser 上报已解析 100 封邮件
        return {
            "doc_name": "demo",
            "structure": [{
                "title": "T", "text": "body", "line_num": 1,
                "line_start": 1, "line_end": 1, "level": 1,
            }],
            "source_path": fp,
        }

    ParserRegistry.register(".mockpst", mock_parser)
    try:
        def sub_cb(file_path: str, n: int) -> None:
            received.append((file_path, n))

        asyncio.run(build_index(
            [str(f)], db_path=str(tmp_path / "idx.db"),
            sub_progress_callback=sub_cb,
        ))
    finally:
        reg_module._PARSER_REGISTRY.pop(".mockpst", None)

    assert received, "sub_progress_callback 未被透传到 parser"
    assert received[0][1] == 100
    assert received[0][0].endswith("demo.mockpst")
