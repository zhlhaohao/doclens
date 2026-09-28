# -*- coding: utf-8 -*-
"""PDF 原生预览 API 测试（ADR-0031）。

覆盖：
- GET /api/preview（preview()）的 pdf 分支：language=pdf、无 content、
  page_starts 有则带 / 未索引 None、预览与索引解耦（不因未索引报错）；
- GET /api/preview/pdf：inline 200 application/pdf、文件移走 FILE_MOVED、
  非 PDF NOT_A_PDF、文件名反查。
"""
import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.web_v2.api import preview as preview_api
from doclens.web_v2.api.errors import CortexAPIError


def _fake_idx(tmp_path: Path, index_path: Path | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        search_path=str(tmp_path),
        index_path=str(index_path or (tmp_path / ".cortex" / "index.db")),
        path_map={},
    )


def _make_pdf(tmp_path: Path, name: str = "样本.pdf") -> Path:
    # 最小合法 PDF 头（内容无所谓——端点不做 PDF 解析，只透传字节）
    p = tmp_path / name
    p.write_bytes(b"%PDF-1.4\n%%EOF\n")
    return p


def _make_db_with_page_starts(tmp_path: Path, rel: str, page_starts: list) -> Path:
    from treesearch.fts import FTS5Index
    from treesearch.tree import Document

    db = tmp_path / ".cortex" / "index.db"
    db.parent.mkdir(exist_ok=True)
    fts = FTS5Index(db_path=str(db))
    try:
        fts.save_document(Document(
            doc_id="d1",
            doc_name="样本",
            structure=[{"title": "样本", "node_id": "0", "text": "", "nodes": []}],
            source_type="pdf",
            metadata={"source_path": str(tmp_path / rel)},
            page_starts=page_starts,
        ))
    finally:
        fts.close()
    return db


class TestPdfPreviewMeta:
    def test_meta_with_page_starts(self, tmp_path):
        _make_pdf(tmp_path)
        db = _make_db_with_page_starts(tmp_path, "样本.pdf", [1, 40, 88])
        resp = asyncio.run(preview_api.preview(
            path="样本.pdf", start_line=0, end_line=0,
            idx=_fake_idx(tmp_path, db),
        ))
        assert resp.language == "pdf"
        assert resp.content == ""
        assert resp.writable is False
        assert resp.page_starts == [1, 40, 88]

    def test_meta_unindexed_still_ok(self, tmp_path):
        """预览与索引解耦：未索引不报错，page_starts=None。"""
        _make_pdf(tmp_path)
        resp = asyncio.run(preview_api.preview(
            path="样本.pdf", start_line=0, end_line=0, idx=_fake_idx(tmp_path),
        ))
        assert resp.language == "pdf"
        assert resp.page_starts is None

    def test_meta_disk_missing_still_ok(self, tmp_path):
        """元数据不查磁盘（字节端点负责 FILE_MOVED）；索引仍在 → 页表可带。"""
        db = _make_db_with_page_starts(tmp_path, "已移走.pdf", [1, 5])
        resp = asyncio.run(preview_api.preview(
            path="已移走.pdf", start_line=0, end_line=0,
            idx=_fake_idx(tmp_path, db),
        ))
        assert resp.language == "pdf"
        assert resp.page_starts == [1, 5]


class TestPdfBytesEndpoint:
    def test_inline_200(self, tmp_path):
        pdf = _make_pdf(tmp_path)
        resp = asyncio.run(preview_api.preview_pdf(
            path="样本.pdf", idx=_fake_idx(tmp_path),
        ))
        assert resp.media_type == "application/pdf"
        assert Path(str(resp.path)) == pdf

    def test_file_moved_404(self, tmp_path):
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(preview_api.preview_pdf(
                path="不存在.pdf", idx=_fake_idx(tmp_path),
            ))
        assert ei.value.status == 404
        assert ei.value.code == "FILE_MOVED"

    def test_not_a_pdf_400(self, tmp_path):
        (tmp_path / "note.md").write_text("x", encoding="utf-8")
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(preview_api.preview_pdf(
                path="note.md", idx=_fake_idx(tmp_path),
            ))
        assert ei.value.status == 400
        assert ei.value.code == "NOT_A_PDF"

    def test_filename_lookup_via_path_map(self, tmp_path):
        """直拼 miss → path_map 反查命中。"""
        sub = tmp_path / "docs"
        sub.mkdir()
        pdf = _make_pdf(sub, "deep.pdf")
        idx = SimpleNamespace(
            search_path=str(tmp_path),
            index_path=str(tmp_path / ".cortex" / "index.db"),
            path_map={"deep": str(pdf)},
        )
        resp = asyncio.run(preview_api.preview_pdf(path="deep.pdf", idx=idx))
        assert Path(str(resp.path)) == pdf

    def test_path_traversal_blocked(self, tmp_path):
        with pytest.raises(CortexAPIError) as ei:
            asyncio.run(preview_api.preview_pdf(
                path="../outside.pdf", idx=_fake_idx(tmp_path),
            ))
        assert ei.value.status == 404
