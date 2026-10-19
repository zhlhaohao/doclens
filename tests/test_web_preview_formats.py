# -*- coding: utf-8 -*-
"""预览格式矩阵（e2e-search-test-plan §3.1 C）+ 搜索降级链路 + 预览定位数据链。

语料 = tests/fixtures/e2e_search/语料（≥10 页/章/表多页样本）。
preview 直调路由函数（asyncio.run），与 test_pdf_native_preview_api 同模式。
"""
import asyncio
import shutil
from pathlib import Path

import pytest

from doclens.web_v2.api import preview as preview_api
from doclens.web_v2.api.errors import CortexAPIError

FIXTURES = Path(__file__).parent / "fixtures" / "e2e_search" / "语料"


@pytest.fixture()
def kb(tmp_path: Path) -> Path:
    kb = tmp_path / "kb"
    shutil.copytree(FIXTURES, kb)
    return kb


@pytest.fixture()
def idx(kb: Path, tmp_path: Path):
    from doclens.index_manager import IndexManager
    from doclens.config import CortexConfig
    from treesearch import TreeSearch, TreeSearchConfig, set_config
    import threading

    db = tmp_path / "idx" / "index.db"
    db.parent.mkdir()
    set_config(TreeSearchConfig())
    ts = TreeSearch(db_path=str(db))
    ts.index(str(kb), return_documents=False)

    mgr = IndexManager.__new__(IndexManager)
    mgr.search_path = str(kb)
    mgr.index_path = str(db)
    mgr._config = CortexConfig()
    mgr._ts = None
    mgr._needs_reload = False
    mgr._building = False
    mgr._build_cond = threading.Condition()
    mgr._pending_swap = None
    mgr._startup_audit_done = True
    mgr._last_failed_count = 0
    mgr._sync_image_version_expectation = lambda: None
    mgr._path_map = {}
    mgr._reindex_lock = threading.Lock()
    mgr.build_path_map()
    yield mgr


def _preview(idx, path, start_line=0, end_line=0):
    return asyncio.run(preview_api.preview(
        path=path, start_line=start_line, end_line=end_line, idx=idx,
    ))


class TestPreviewFormats:
    def test_c1_md(self, idx):
        r = _preview(idx, "杂记.md")
        assert r.language == "markdown"
        assert "麒麟" in r.content
        assert r.writable is True

    def test_c2_pdf_meta(self, idx):
        r = _preview(idx, "report.pdf")
        assert r.language == "pdf"
        assert r.content == ""
        assert r.page_starts == [1, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35]

    def test_c2b_pdf_pages_ge_10(self, idx):
        r = _preview(idx, "report.pdf")
        assert len(r.page_starts or []) >= 10

    def test_c3_docx(self, idx):
        r = _preview(idx, "纪要.docx")
        assert r.language == "markdown"
        assert "kirin" in r.content
        assert r.pages is None
        assert r.line_map

    def test_c3b_docx_line_map_shape(self, idx):
        r = _preview(idx, "纪要.docx")
        vals = list(r.line_map.values())
        assert vals == sorted(vals)

    def test_c4_epub(self, idx):
        """BUG-E1 已修：扁平树（anydoc 产同级根）也按根级章分页。"""
        r = _preview(idx, "书.epub")
        assert r.language == "markdown"
        assert "kirin" in r.content
        assert len(r.pages or []) >= 10, f"epub 12 章未分页（pages={r.pages}）"

    def test_c5_xlsx(self, idx):
        r = _preview(idx, "报表.xlsx")
        assert r.language == "markdown"
        assert "kirin" in r.content
        assert len(r.pages or []) == 10

    def test_c6_pptx(self, idx):
        r = _preview(idx, "幻灯.pptx")
        assert r.language == "markdown"
        assert len(r.pages or []) == 12

    def test_c7_code_tokens(self, idx):
        r = _preview(idx, "code/kirin_util.py")
        assert r.language == "python"
        assert r.tokens
        assert r.writable is True

    def test_c8_txt(self, idx):
        r = _preview(idx, "plain.txt")
        assert r.language == "text"
        assert "kirin" in r.content

    def test_c9_html(self, idx):
        r = _preview(idx, "web.html")
        assert r.language == "html"
        assert "kirin" in r.content

    def test_c11_line_range_slice(self, idx):
        r = _preview(idx, "plain.txt", start_line=190, end_line=195)
        assert r.line_range == (190, 195)
        assert "kirin" in r.content

    def test_c15_highlights_empty(self, idx):
        r = _preview(idx, "杂记.md")
        assert r.highlights == []

    def test_c16_synthesized_flag(self, idx):
        """synthesized 标志（全文件预览判定单源化）：DB 合成 md = True，
        磁盘直读（md/代码/txt/pdf 字节直读）= False。前端以此替代本地后缀清单。"""
        assert _preview(idx, "纪要.docx").synthesized is True
        assert _preview(idx, "报表.xlsx").synthesized is True
        assert _preview(idx, "幻灯.pptx").synthesized is True   # 历史漂移点：pptx 曾不在前端清单
        assert _preview(idx, "书.epub").synthesized is True
        assert _preview(idx, "杂记.md").synthesized is False
        assert _preview(idx, "code/kirin_util.py").synthesized is False
        assert _preview(idx, "plain.txt").synthesized is False
        assert _preview(idx, "report.pdf").synthesized is False  # pdf = 字节直读非合成

    def test_c14_line_map_keys_are_orig_lines(self, idx):
        r = _preview(idx, "报表.xlsx")
        keys = sorted(int(k) for k in r.line_map)
        assert keys[0] == 1
        assert len(keys) == 10


class TestPreviewErrors:
    def test_c10_not_indexed_binary(self, idx, kb):
        (kb / "未索引.docx").write_bytes(b"PK\x03\x04 fake")
        with pytest.raises(CortexAPIError) as ei:
            _preview(idx, "未索引.docx")
        assert ei.value.status == 404

    def test_c12_unknown_binary(self, idx, kb):
        (kb / "blob.bin").write_bytes(b"\x00\x01\x02\x03binary")
        with pytest.raises(CortexAPIError) as ei:
            _preview(idx, "blob.bin")
        assert ei.value.status == 415

    def test_file_not_found(self, idx):
        with pytest.raises(CortexAPIError) as ei:
            _preview(idx, "不存在.md")
        assert ei.value.status == 404


class TestSearchFallbackChain:
    def _search(self, idx, q):
        from doclens.web_v2.api import search as search_api
        from doclens.web_v2.models.search import SearchRequest

        return asyncio.run(search_api.search(SearchRequest(query=q, limit=20), idx))

    def test_like_source(self, idx):
        r = self._search(idx, "filler sentence")
        assert r.source in ("fts", "like", "ripgrep")
        assert r.groups

    def test_ripgrep_source(self, idx, kb):
        r = self._search(idx, "zzqq_no_such_token_xyz")
        assert r.groups == []
        assert r.error is None

    def test_f2_blank_query_rejected(self, idx):
        from pydantic import ValidationError
        from doclens.web_v2.models.search import SearchRequest

        with pytest.raises(ValidationError):
            SearchRequest(query=" ")


class TestPreviewLocateChain:
    def test_pdf_hit_line_to_page(self, idx):
        r = _preview(idx, "report.pdf")
        ps = r.page_starts

        def line_to_page(line):
            lo, hi = 0, len(ps) - 1
            while lo < hi:
                mid = (lo + hi + 1) >> 1
                if ps[mid] <= line:
                    lo = mid
                else:
                    hi = mid - 1
            return lo + 1

        assert line_to_page(2) == 1
        assert line_to_page(20) == 7
        assert line_to_page(32) == 11

    def test_docx_line_map_heading(self, idx):
        r = _preview(idx, "纪要.docx")
        assert r.line_map.get("9") == 15  # 第3章 heading 原始行 9 → md 15
