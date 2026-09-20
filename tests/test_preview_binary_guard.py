# -*- coding: utf-8 -*-
"""二进制嗅探预览闸门测试（未知二进制不进文本兜底喷乱码）。

覆盖：
- _looks_binary 判定（NUL 嗅探 / 纯文本 / 空文件 / 读取失败容错）；
- 端点级：apk 等未知二进制 → 415 BINARY_NOT_PREVIEWABLE；md 文本 → 正常 200。
- 已知二进制文档（pdf/docx，BINARY_PREVIEW_EXTS）走 DB 合成分支，先于
  嗅探（代码序保证），不在本测试构造真索引验证。
"""
import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.web_v2.api import preview as preview_api
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.api.preview import _looks_binary


def test_looks_binary(tmp_path):
    # NUL 在前 8KB 内 → 二进制（zip/apk 头即命中）
    apk = tmp_path / "a.apk"
    apk.write_bytes(b"PK\x03\x04" + b"\x00" * 16 + b"x" * 100)
    assert _looks_binary(apk) is True
    # NUL 在 8KB 之外（>嗅探窗）→ 视为文本（超长文本文件深处的孤立 NUL 不误杀）
    far = tmp_path / "far.md"
    far.write_bytes(b"a" * 9000 + b"\x00")
    assert _looks_binary(far) is False
    # 纯文本（含中文/换行）→ 非二进制
    md = tmp_path / "note.md"
    md.write_text("# 标题\n正文", encoding="utf-8")
    assert _looks_binary(md) is False
    # 空文件 → 非二进制（交由正常空文本路径）
    empty = tmp_path / "empty.txt"
    empty.write_bytes(b"")
    assert _looks_binary(empty) is False


def test_preview_endpoint_rejects_unknown_binary(tmp_path, monkeypatch):
    fake_idx = SimpleNamespace(search_path=str(tmp_path), path_map={})
    (tmp_path / "app-debug.apk").write_bytes(
        b"PK\x03\x04" + bytes(range(256)) * 8
    )
    with pytest.raises(CortexAPIError) as ei:
        asyncio.run(preview_api.preview(
            path="app-debug.apk", start_line=0, end_line=0, idx=fake_idx,
        ))
    assert ei.value.status == 415
    assert ei.value.code == "BINARY_NOT_PREVIEWABLE"
    assert "下载" in ei.value.detail


def test_preview_endpoint_text_still_works(tmp_path, monkeypatch):
    fake_idx = SimpleNamespace(search_path=str(tmp_path), path_map={})
    (tmp_path / "note.md").write_text("# 标题\n\n正文", encoding="utf-8")
    resp = asyncio.run(preview_api.preview(
        path="note.md", start_line=0, end_line=0, idx=fake_idx,
    ))
    assert resp.language == "markdown"
    assert "# 标题" in resp.content
