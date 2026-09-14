"""grep 大语料旁路（方案 C）测试：百万节点级跳过 SQLite REGEXP 直通 rg。

背景：like_search(use_regex=True) 的 REGEXP 是逐行 Python UDF，nodes 表
百万行级（51 万文档实测 118.8 万节点）全表扫是分钟~十分钟级，单次 grep
即可卡死对话流（2026-09-14 实测）；rg 递归扫同规模目录 10-30s。
"""
import sqlite3
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from doclens.ripgrep import (
    _nodes_count_bypass,
    _rg_search_root_hits,
    rg_fallback_search,
)


@pytest.fixture(autouse=True)
def _clear_cache():
    from doclens import ripgrep

    ripgrep._nodes_count_cache.clear()
    yield
    ripgrep._nodes_count_cache.clear()


def _fake_idx(tmp_path: Path, rows: int) -> SimpleNamespace:
    """带 nodes 表的假索引（rows 行，COUNT 真实返回）。"""
    db = tmp_path / "index.db"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE nodes (node_id TEXT)")
    con.executemany("INSERT INTO nodes VALUES (?)", [("",)] * rows)
    con.commit()
    con.close()
    return SimpleNamespace(index_path=db, search_path=tmp_path)


class TestNodesCountBypass:
    def test_over_threshold_bypasses(self, tmp_path):
        # 阈值缩小到 5（测试规模）；生产用 REGEXP_SKIP_NODES_THRESHOLD（百万级）
        idx = _fake_idx(tmp_path, rows=10)
        assert _nodes_count_bypass(idx, threshold=5) is True

    def test_under_threshold_keeps_old_path(self, tmp_path):
        idx = _fake_idx(tmp_path, rows=3)
        assert _nodes_count_bypass(idx, threshold=5) is False

    def test_count_cached_within_ttl(self, tmp_path):
        idx = _fake_idx(tmp_path, rows=10)
        with patch("doclens.ripgrep.logger") as mock_logger:
            _nodes_count_bypass(idx, threshold=5)
            _nodes_count_bypass(idx, threshold=5)  # 第二次走缓存
        assert mock_logger.info.call_count == 1  # 只有一条跳过日志

    def test_count_failure_treated_as_small(self, tmp_path):
        idx = SimpleNamespace(index_path=tmp_path / "missing.db")
        assert _nodes_count_bypass(idx) is False


class TestRgSearchRootHits:
    def test_directory_scan_finds_matches(self, tmp_path):
        (tmp_path / "a.txt").write_text("hello alpha\nbye", encoding="utf-8")
        (tmp_path / "sub").mkdir()
        (tmp_path / "sub" / "b.txt").write_text(
            "nope\nhello beta", encoding="utf-8"
        )
        hits = _rg_search_root_hits("hello", str(tmp_path), use_regex=False)
        files = {Path(p).name for p in hits}
        assert files == {"a.txt", "b.txt"}
        # 行号 1-based
        assert hits[str(tmp_path / "sub" / "b.txt")] == [2]

    def test_data_dirs_excluded(self, tmp_path):
        (tmp_path / ".cortex").mkdir()
        (tmp_path / ".cortex" / "index.db").write_text(
            "hello-secret", encoding="utf-8"
        )
        (tmp_path / "ok.txt").write_text("hello-public", encoding="utf-8")
        hits = _rg_search_root_hits("hello", str(tmp_path), use_regex=False)
        assert list(hits) == [str(tmp_path / "ok.txt")]

    def test_regex_mode(self, tmp_path):
        (tmp_path / "r.txt").write_text("foo123bar\nfoo45bar", encoding="utf-8")
        hits = _rg_search_root_hits(r"foo\d{3}", str(tmp_path), use_regex=True)
        assert list(hits) == [str(tmp_path / "r.txt")]
        assert hits[str(tmp_path / "r.txt")] == [1]


class TestRgFallbackWithPreHits:
    def test_pre_hits_bypasses_per_file_scan(self, tmp_path):
        """pre_hits 模式：不构建逐文件 rg_paths，直接消费目录扫描结果。"""
        doc = tmp_path / "d1.txt"
        doc.write_text("l1\nneedle here\nl3", encoding="utf-8")
        path_map = {"dsid_x": str(doc)}

        with patch(
            "doclens.ripgrep.build_rg_paths",
            side_effect=AssertionError("逐文件路径构建不应被调用"),
        ), patch("treesearch.ripgrep.rg_search") as mock_rg:
            results = rg_fallback_search(
                "needle", path_map, {}, ["needle"],
                context_before=1, context_after=1, use_regex=False,
                pre_hits={str(doc): [2]},
            )
        mock_rg.assert_not_called()
        assert len(results) == 1
        doc_id, node, matched, _, _ = results[0]
        assert doc_id == "dsid_x"  # normpath 反查命中 doc_id
        assert node["line_start"] == 2
        assert "needle here" in node["text"]
        assert matched == 1

    def test_unknown_path_synthesizes_by_basename(self, tmp_path):
        """path_map 外的命中文件（未索引）按 basename 合成 doc_id。"""
        doc = tmp_path / "wild.txt"
        doc.write_text("needle", encoding="utf-8")
        results = rg_fallback_search(
            "needle", {}, {}, ["needle"], use_regex=False,
            pre_hits={str(doc): [1]},
        )
        assert results[0][0] == "wild"  # basename（无扩展名）兜底
