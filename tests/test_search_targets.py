"""搜索目标（paths 参数）测试：resolve_search_targets + search_kb/grep 过滤。

覆盖：目录目标命中子树、文件目标精确命中、未命中/非法目标提示、
search_kb 与 grep handler 的目标过滤行为。
"""
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.search_targets import (
    format_missed_note,
    normalize_target,
    resolve_search_targets,
)


@pytest.fixture()
def kb(tmp_path: Path) -> Path:
    """知识库目录树：科技/a.md、科技/sub/b.md、生活/c.md、根目录 root.md。"""
    (tmp_path / "科技" / "sub").mkdir(parents=True)
    (tmp_path / "生活").mkdir()
    for rel in ("科技/a.md", "科技/sub/b.md", "生活/c.md", "root.md"):
        (tmp_path / rel).write_text("量子 计算 内容", encoding="utf-8")
    return tmp_path


@pytest.fixture()
def path_map(kb: Path) -> dict[str, str]:
    return {
        "d1": str(kb / "科技" / "a.md"),
        "d2": str(kb / "科技" / "sub" / "b.md"),
        "d3": str(kb / "生活" / "c.md"),
        "d4": str(kb / "root.md"),
    }


class TestNormalizeTarget:
    def test_relative_ok(self, kb: Path):
        assert normalize_target(kb, "科技") == (kb.resolve() / "科技")

    def test_rejects_absolute(self, kb: Path):
        with pytest.raises(ValueError):
            normalize_target(kb, str(kb / "科技"))

    def test_rejects_traversal(self, kb: Path):
        with pytest.raises(ValueError):
            normalize_target(kb, "../outside")

    def test_rejects_empty(self, kb: Path):
        with pytest.raises(ValueError):
            normalize_target(kb, "  ")


class TestResolveSearchTargets:
    def test_dir_target_hits_subtree(self, kb: Path, path_map: dict):
        allowed, missed = resolve_search_targets(kb, ["科技"], path_map)
        assert allowed == {"d1", "d2"}
        assert missed == []

    def test_file_target_exact_match(self, kb: Path, path_map: dict):
        allowed, missed = resolve_search_targets(kb, ["科技/a.md"], path_map)
        assert allowed == {"d1"}
        assert missed == []

    def test_root_file_not_confused_with_dir(self, kb: Path, path_map: dict):
        # 文件目标 root.md 不应命中同名前缀目录
        allowed, _ = resolve_search_targets(kb, ["root.md"], path_map)
        assert allowed == {"d4"}

    def test_missed_target_reported(self, kb: Path, path_map: dict):
        allowed, missed = resolve_search_targets(kb, ["不存在目录"], path_map)
        assert allowed == set()
        assert missed == ["不存在目录"]

    def test_invalid_target_reported_not_raised(self, kb: Path, path_map: dict):
        allowed, missed = resolve_search_targets(kb, ["../x", "科技"], path_map)
        assert allowed == {"d1", "d2"}
        assert missed == ["../x"]

    def test_mixed_targets_union(self, kb: Path, path_map: dict):
        allowed, missed = resolve_search_targets(kb, ["生活", "root.md"], path_map)
        assert allowed == {"d3", "d4"}
        assert missed == []


class TestFormatMissedNote:
    def test_empty(self):
        assert format_missed_note([]) == ""

    def test_lists_targets(self):
        note = format_missed_note(["甲", "乙"])
        assert "甲" in note and "乙" in note and "未命中" in note


# ---------------------------------------------------------------------------
# handler 级过滤（轻量 fake IndexManager）
# ---------------------------------------------------------------------------

def _fake_idx(kb: Path, path_map: dict[str, str]):
    """最小 IndexManager 替身：like_search 返回全库两条，path_map 真实。"""
    return SimpleNamespace(
        search_path=str(kb),
        path_map=path_map,
        rg_context_before=2,
        rg_context_after=2,
        grep_score_threshold=0.0,
        grep_max_results=50,
        like_search=lambda query, max_results=50, use_regex=True: [
            {"doc_id": "d1", "title": "a", "summary": "量子 计算", "fts_score": 1.0},
            {"doc_id": "d3", "title": "c", "summary": "量子 计算", "fts_score": 1.0},
        ],
        resolve_doc_path=lambda d: d,
    )


class TestGrepHandlePaths:
    def test_filters_to_dir_target(self, kb: Path, path_map: dict):
        from doclens.grep_tools import _handle_grep
        out = _handle_grep(_fake_idx(kb, path_map), pattern="量子", paths=["科技"])
        assert "a.md" in out
        assert "c.md" not in out

    def test_no_paths_returns_all(self, kb: Path, path_map: dict):
        from doclens.grep_tools import _handle_grep
        out = _handle_grep(_fake_idx(kb, path_map), pattern="量子")
        assert "a.md" in out and "c.md" in out

    def test_all_missed_short_circuits(self, kb: Path, path_map: dict):
        from doclens.grep_tools import _handle_grep
        out = _handle_grep(_fake_idx(kb, path_map), pattern="量子", paths=["不存在"])
        assert "未命中" in out
        assert "a.md" not in out


class TestSearchKbHandlePaths:
    def _fake_kb_idx(self, kb: Path, path_map: dict):
        doc1 = SimpleNamespace(doc_id="d1", structure=[])
        doc2 = SimpleNamespace(doc_id="d3", structure=[])
        return SimpleNamespace(
            ts=object(),
            documents=[doc1, doc2],
            max_results=10,
            max_nodes_per_doc=3,
            max_span=50,
            scoring_weights={"keyword_match_ratio": 1.0},
            min_score_threshold=0.0,
            max_context_chars_per_result=500,
            max_total_chars=8000,
            path_map=path_map,
            search=lambda query, max_results: (
                [{"doc_id": "d1", "score": 1.0}, {"doc_id": "d3", "score": 1.0}],
                [
                    {"doc_id": "d1", "doc_name": "a", "nodes": [{"title": "t", "text": "量子 计算 内容"}]},
                    {"doc_id": "d3", "doc_name": "c", "nodes": [{"title": "t", "text": "量子 计算 内容"}]},
                ],
            ),
            resolve_doc_path=lambda d: d,
        )

    def test_filters_to_dir_target(self, kb: Path, path_map: dict):
        from doclens.kb_tools import _handle_search_kb
        out = _handle_search_kb(self._fake_kb_idx(kb, path_map), kb, query="量子", paths=["科技"])
        assert "a.md" in out
        assert "c.md" not in out

    def test_file_target(self, kb: Path, path_map: dict):
        from doclens.kb_tools import _handle_search_kb
        out = _handle_search_kb(self._fake_kb_idx(kb, path_map), kb, query="量子", paths=["生活/c.md"])
        assert "c.md" in out
        assert "a.md" not in out

    def test_missed_note_in_output(self, kb: Path, path_map: dict):
        from doclens.kb_tools import _handle_search_kb
        out = _handle_search_kb(
            self._fake_kb_idx(kb, path_map), kb, query="量子", paths=["科技", "不存在目录"]
        )
        assert "未命中" in out and "不存在目录" in out
        assert "a.md" in out
