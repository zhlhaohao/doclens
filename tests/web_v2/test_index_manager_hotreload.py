"""Tests for IndexManager config hot-reload via apply_config()."""
from unittest.mock import MagicMock
from doclens.index_manager import IndexManager


def _make_config(**overrides):
    """Create a mock CortexConfig with sensible defaults."""
    c = MagicMock()
    c.search_path = "/tmp/test"
    c.index_path = None
    c.max_results = 20
    c.max_nodes_per_doc = 3
    c.top_k_docs = 100
    c.max_span = 20
    c.min_keywords_per_line = 2
    c.min_score_threshold = 0.0
    c.cjk_tokenizer = "jieba"
    c.max_index_fail_count = 3
    c.treesearch_enable_shadow_md = True
    c.treesearch_xlsx_max_rows_per_sheet = 10000
    c.treesearch_xlsx_max_consecutive_empty_rows = 100
    c.allowed_source_types = []
    c.title_width = 55
    c.line_width = 78
    c.max_context_lines = 5
    c.max_anchor_lines = 3
    c.context_expand_range = 5
    c.max_context_chars_per_result = 800
    c.max_total_chars = 10000
    c.max_read_chars = 6000
    c.read_doc_show_toc = False
    c.rg_context_before = 6
    c.rg_context_after = 5
    c.grep_score_threshold = 0.0
    c.grep_max_results = 50
    c.weight_keyword_match = 3.0
    c.weight_file_name_match = 2.0
    c.weight_fts_score = 2.0
    c.weight_title_match = 1.5
    c.weight_proximity_match = 1.0
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


def test_apply_config_updates_max_results():
    mgr = IndexManager(_make_config(max_results=20))
    assert mgr.max_results == 20
    mgr.apply_config(_make_config(max_results=99))
    assert mgr.max_results == 99


def test_apply_config_updates_scoring_weights():
    mgr = IndexManager(_make_config(weight_keyword_match=3.0))
    assert mgr.scoring_weights["keyword_match_ratio"] == 3.0
    mgr.apply_config(_make_config(weight_keyword_match=9.5))
    assert mgr.scoring_weights["keyword_match_ratio"] == 9.5


def test_apply_config_preserves_search_path():
    mgr = IndexManager(_make_config(search_path="/tmp/aaa"))
    assert mgr.search_path == "/tmp/aaa"
    mgr.apply_config(_make_config(search_path="/tmp/bbb"))
    assert mgr.search_path == "/tmp/aaa"  # NOT updated — stays from init


def test_apply_config_preserves_ts_instance():
    """Internal _ts state must survive apply_config."""
    mgr = IndexManager(_make_config())
    mgr._ts = "fake_ts"
    mgr._path_map = {"key": "val"}
    mgr.apply_config(_make_config())
    assert mgr._ts == "fake_ts"
    assert mgr._path_map == {"key": "val"}
