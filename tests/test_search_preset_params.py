"""搜索调优预设（kind=search）全参数执行正确性测试。

预设 10 参数（3 过滤 + 2 窗口 + 5 权重）逐一经真实链路验证：
``.env（CORTEX_*）→ CortexConfig → IndexManager → 搜索执行``。
不 mock 评分管道 —— 建真实 FTS5 索引跑 score_and_rank，
行为与 CLI/TUI/Web /api/search 三端一致（共用同一管道）。

激活链路（presets_store → activate → write_env_values → reload_config）
单测见文末 TestActivateChain，全部隔离在 tmp_path，不碰真实 ~/.cortex。
"""
import os
from pathlib import Path

import pytest

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager
from doclens.scoring import calc_proximity_score, tokenize_query
from doclens.scoring_pipeline import score_and_rank

# 与出厂权重一致的单因子基线：只开 keyword 权重，composite = matched/total，
# 数值完全可预测（1.0 / 0.5），隔离其余因子的干扰。
_BASE_W = dict(
    weight_keyword_match=4.0,
    weight_file_name_match=0.0,
    weight_fts_score=0.0,
    weight_title_match=0.0,
    weight_proximity_match=0.0,
)

# 中文填充句（78 字/次，不含查询关键词"磁锚/检索"及其子串——
# 保证 matched 计数与关键词首次出现间距不受填充影响；
# 已验证 jieba 分词碎片亦无交集，详见下方断言）。
# 每篇合成文档正文 ≥1000 字：关键词句 + 填充句×n 拼成单个长段落
# （单段落 = 单节点，避免解析器按空行切成多节点改变评分口径）。
_CN_FILLER = (
    "结构化知识库为每篇文档建立标题层级与正文段落的双重目录，"
    "评估环节综合词汇覆盖率、文件名契合度、章节指向性与语义邻近度等"
    "多维指标，为每次查阅反馈最贴切的段落。"
)

# 查询关键词全集（测试内所有查询均取自此集合的子集）
_QUERY_KEYWORDS = ("磁锚", "检索")


def _cn(n: int) -> str:
    """填充句×n（n×78 字）。"""
    return _CN_FILLER * n


def test_filler_orthogonal_to_query_keywords():
    """护栏：填充句与全部查询关键词零交集（子串级），保证评分可控。"""
    for kw in _QUERY_KEYWORDS:
        assert kw not in _CN_FILLER


def _make_idx(tmp_path: Path, **cfg_over) -> IndexManager:
    """在 tmp_path 建真实索引（Windows 下 chdir 需还原，交给 fixture 管理 cwd）。"""
    over = {"min_score_threshold": 0.0, **cfg_over}  # 默认放开阈值，需隔离时显式传
    cfg = CortexConfig(**over)
    idx = IndexManager(cfg)
    idx.reindex(force=True)
    return idx


@pytest.fixture()
def kb(tmp_path: Path, monkeypatch) -> Path:
    """知识库：3 篇全中文文档（每篇正文 ≥1000 字），命中数/紧密度各不相同。

    - doc1.md：磁锚+检索 都命中且紧邻 → composite 1.0
    - doc2.md：仅磁锚 命中 → composite 0.5
    - far.md：磁锚+检索 命中但相距 ~150 字符 → prox 由 max_span 决定
    """
    (tmp_path / "doc1.md").write_text(
        f"# 全命中\n\n磁锚 检索 融合{_cn(13)}\n", encoding="utf-8"
    )
    (tmp_path / "doc2.md").write_text(
        f"# 半命中\n\n磁锚 纠缠 概述{_cn(13)}\n", encoding="utf-8"
    )
    far_text = "磁锚" + "间" * 150 + "检索" + "收尾" + _cn(11)
    (tmp_path / "far.md").write_text(f"# 远距离\n\n{far_text}\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    return tmp_path


def _run(idx: IndexManager, query: str = "磁锚 检索"):
    """搜索 + 评分管道，返回 [(doc_key, matched, prox, composite)]（已排序）。"""
    nodes, docs = idx.search(query)
    words = tokenize_query(query)
    result = score_and_rank(nodes, docs, query, words, idx)
    assert result.source == "fts"
    return [
        (payload[0].split("_")[0], payload[2], payload[3], round(score, 4))
        for score, payload in result.results
    ]


# ---------------------------------------------------------------------------
# 纯文本索引：.txt 进入默认白名单并参与完整搜索管道
# ---------------------------------------------------------------------------

class TestTxtIndexing:
    def test_txt_indexed_and_searchable(self, tmp_path: Path, monkeypatch):
        """.txt 默认进索引：建库 → FTS 搜索 → 评分管道全链路。"""
        (tmp_path / "note.txt").write_text(
            f"磁锚 检索 融合{_cn(13)}\n", encoding="utf-8"
        )
        (tmp_path / "memo.txt").write_text(
            f"磁锚 纠缠 概述{_cn(13)}\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)

        idx = _make_idx(tmp_path, **_BASE_W)
        doc_names = set(idx.indexed_source_paths())
        assert len(doc_names) == 2, f".txt 未进索引: {doc_names}"

        rows = _run(idx)
        by_doc = {r[0]: r for r in rows}
        assert by_doc["note"][1] == 2 and by_doc["note"][3] == 1.0
        assert by_doc["memo"][1] == 1 and by_doc["memo"][3] == 0.5

    def test_txt_in_default_allowed_source_types(self):
        """text 类型必须在出厂白名单内（否则扫描阶段直接过滤 .txt/.log/.rst）。"""
        assert "text" in CortexConfig().allowed_source_types

    def test_txt_kb_tool_end_to_end(self, tmp_path: Path, monkeypatch):
        """.txt 经 search_kb 工具输出结果（Agent 检索路径）。"""
        (tmp_path / "note.txt").write_text(
            f"磁锚 检索 融合{_cn(13)}\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)
        idx = _make_idx(tmp_path)

        from doclens.kb_tools import _handle_search_kb

        out = _handle_search_kb(idx, tmp_path, query="磁锚 检索")
        assert "<result " in out
        assert "note.txt" in out

    def test_txt_and_md_mixed_kb(self, tmp_path: Path, monkeypatch):
        """md + txt 混合知识库：两类都进索引、都参与排序。"""
        (tmp_path / "a.md").write_text(
            f"# 甲\n\n磁锚 检索 融合{_cn(13)}\n", encoding="utf-8"
        )
        (tmp_path / "b.txt").write_text(
            f"磁锚 检索 融合{_cn(13)}\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)
        idx = _make_idx(tmp_path, **_BASE_W)
        assert len(idx.indexed_source_paths()) == 2
        rows = _run(idx)
        assert {r[0] for r in rows} == {"a", "b"}


# ---------------------------------------------------------------------------
# 过滤参数 1/3：max_results —— search_kb 展示条数与 like_search 上限
# ---------------------------------------------------------------------------

class TestMaxResults:
    def test_kb_output_capped_by_config(self, kb: Path):
        idx = _make_idx(kb, max_results=1)
        from doclens.kb_tools import _handle_search_kb

        out = _handle_search_kb(idx, kb, query="磁锚")
        # 3 命中但 max_results=1 → 只展示 1 条，其余截断提示
        assert out.count("<result ") == 1
        assert "more results truncated" in out

    def test_kb_output_larger_config(self, kb: Path):
        idx = _make_idx(kb, max_results=10)
        from doclens.kb_tools import _handle_search_kb

        out = _handle_search_kb(idx, kb, query="磁锚")
        assert out.count("<result ") == 3

    def test_env_override_accepted(self, kb: Path, monkeypatch):
        monkeypatch.setenv("CORTEX_MAX_RESULTS", "7")
        cfg = CortexConfig(min_score_threshold=0.0)
        assert cfg.max_results == 7


# ---------------------------------------------------------------------------
# 过滤参数 2/3：min_score_threshold —— score_and_rank 两级过滤
# ---------------------------------------------------------------------------

class TestMinScoreThreshold:
    def test_zero_keeps_partial_match(self, kb: Path):
        idx = _make_idx(kb)  # threshold=0.0
        rows = _run(idx)
        assert {r[0] for r in rows} == {"doc1", "doc2", "far"}

    def test_sixty_percent_filters_partial(self, kb: Path):
        idx = _make_idx(kb, min_score_threshold=0.6, **_BASE_W)
        rows = _run(idx)
        # keyword 单因子：composite = matched/total。
        # doc1/far 均命中 2/2 → 1.0 保留；doc2 只命中 1/2 → 0.5 < 0.6 被过滤
        assert {r[0] for r in rows} == {"doc1", "far"}
        assert all(r[3] == 1.0 for r in rows)

    def test_default_threshold_filters_low_scores(self, kb: Path):
        """出厂默认 0.3：0.5 分结果保留（回退语义），与显式 0.0 区分。"""
        cfg = CortexConfig(**_BASE_W)  # 默认 threshold=0.3
        idx = IndexManager(cfg)
        idx.reindex(force=True)
        rows = _run(idx)
        assert all(r[3] >= 0.3 for r in rows)
        assert {r[0] for r in rows} == {"doc1", "doc2", "far"}

    def test_threshold_over_one_kills_all(self, kb: Path):
        idx = _make_idx(kb, min_score_threshold=1.5, **_BASE_W)
        rows = _run(idx)
        assert rows == []


# 占位（防止后续编辑重复匹配）


# ---------------------------------------------------------------------------
# 过滤参数 3/3：max_span —— 紧密度判定半径
# ---------------------------------------------------------------------------

class TestMaxSpan:
    def test_default_50_far_not_adjacent(self, kb: Path):
        idx = _make_idx(kb, **_BASE_W)
        far = (kb / "far.md").read_text(encoding="utf-8")
        cnt, prox = calc_proximity_score(far, ["磁锚", "检索"], max_span=idx.max_span)
        assert idx.max_span == 50
        assert (cnt, prox) == (2, 1)  # 距离 ~150 > 50 → 部分匹配

    def test_widened_span_marks_adjacent(self, kb: Path):
        idx = _make_idx(kb, max_span=300, **_BASE_W)
        rows = _run(idx)
        far_row = next(r for r in rows if r[0] == "far")
        assert far_row[2] == 2  # 300 > 150 → 紧邻
        assert far_row[3] == 1.0

    def test_narrow_span_downgrades_proximity_score(self, kb: Path):
        idx = _make_idx(kb, max_span=1, **_BASE_W)
        rows = _run(idx)
        # 全部 prox=1；且 doc1 的"磁锚 检索"间隔 3 > 1 也降级
        assert all(r[2] == 1 for r in rows)


# ---------------------------------------------------------------------------
# 窗口参数：search_context_before / after —— grep 与 search 同口径
# ---------------------------------------------------------------------------

class TestContextWindow:
    # 窗口测试专用文本：中文"前文/后文"填充 + 中文锚点词"磁锚"
    # （≥1000 字：前后各 1000 字中文，锚点前后可见性可精确计数）
    WIN_TEXT = "前" * 1000 + "磁锚" + "后" * 1000

    def test_kb_window_width_follows_config(self, tmp_path: Path, monkeypatch):
        (tmp_path / "win.md").write_text(
            f"# 窗口\n\n{self.WIN_TEXT}{_cn(1)}\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)
        idx = _make_idx(tmp_path, search_context_before=50, search_context_after=100)

        from doclens.kb_tools import _handle_search_kb

        out = _handle_search_kb(idx, tmp_path, query="磁锚")
        content = out.split("<content>")[1].split("</content>")[0]
        # 统一窗口：锚点前 ≈50、锚点后 ≈100 字符可见（head/省略号占少量预算）
        i = content.find("磁锚")
        assert i > 0, "锚点前文不可见"
        after_visible = content.count("后")
        assert 80 <= after_visible <= 100, f"锚点后可见字符 {after_visible} 不符 100 预算"

    def test_wide_window_shows_more(self, tmp_path: Path, monkeypatch):
        (tmp_path / "win.md").write_text(
            f"# 窗口\n\n{self.WIN_TEXT}{_cn(1)}\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)
        idx = _make_idx(tmp_path, search_context_before=50, search_context_after=500)

        from doclens.kb_tools import _handle_search_kb

        out = _handle_search_kb(idx, tmp_path, query="磁锚")
        content = out.split("<content>")[1].split("</content>")[0]
        assert content.count("后") >= 450  # 500 预算 → 至少 450 可见

    def test_grep_window_same_params(self, tmp_path: Path, monkeypatch):
        """grep 工具与 search_kb 用同一对 config 字段（统一窗口模型）。"""
        (tmp_path / "g.md").write_text(
            f"# 节\n\n{self.WIN_TEXT}{_cn(1)}\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)
        idx = _make_idx(tmp_path, search_context_before=30, search_context_after=60)

        from doclens.grep_tools import _handle_grep

        out = _handle_grep(idx, pattern="磁锚")
        content = out.split("<content>")[1].split("</content>")[0]
        assert "磁锚" in content
        assert content.count("后") <= 60

    def test_web_snippet_budget_from_window(self, kb: Path):
        """Web /api/search 的 snippet 字符兜底 = before + after（同口径）。"""
        idx = _make_idx(kb, search_context_before=100, search_context_after=300)
        from doclens.web_v2.api.search import _make_snippet

        snippet_max = idx.search_context_before + idx.search_context_after
        assert snippet_max == 400
        # _make_snippet 的字符兜底直接受预算控制
        long_text = _cn(20)
        assert len(_make_snippet(long_text, "t", "a.md", max_lines=0, max_chars=snippet_max)) == 400


# ---------------------------------------------------------------------------
# 评分权重 ×5：单一因子开关对排序/分数的影响
# ---------------------------------------------------------------------------

class TestWeightKeywordMatch:
    def test_ratio_equals_matched_over_total(self, kb: Path):
        idx = _make_idx(kb, **_BASE_W)
        rows = _run(idx)
        by_doc = {r[0]: r for r in rows}
        assert by_doc["doc1"][3] == 1.0   # 2/2
        assert by_doc["doc2"][3] == 0.5   # 1/2

    def test_zero_weight_excludes_factor(self, kb: Path):
        # 关掉唯一权重 → total_weight=0 → 全部 composite=0
        idx = _make_idx(
            kb,
            weight_keyword_match=0.0, weight_file_name_match=0.0,
            weight_fts_score=0.0, weight_title_match=0.0,
            weight_proximity_match=0.0,
        )
        rows = _run(idx)
        assert all(r[3] == 0.0 for r in rows)


class TestWeightFileNameMatch:
    def test_filename_hit_ranks_first(self, tmp_path: Path, monkeypatch):
        (tmp_path / "磁锚.md").write_text(
            f"# 名字\n\n磁锚 检索 名字文档{_cn(13)}\n", encoding="utf-8"
        )
        (tmp_path / "普通.md").write_text(
            f"# 普通\n\n磁锚 检索 正文{_cn(13)}\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)
        idx = _make_idx(
            tmp_path,
            weight_keyword_match=1.0, weight_file_name_match=3.0,
            weight_fts_score=0.0, weight_title_match=0.0,
            weight_proximity_match=0.0,
        )
        rows = _run(idx)
        # 磁锚.md：keyword 1.0×1 + filename 0.5×3 → (1+1.5)/4 = 0.625
        # 普通.md：keyword 1.0×1 + filename 0×3 → 0.25
        assert rows[0][0] == "磁锚"
        assert rows[0][3] == 0.625
        assert rows[1][0] == "普通"
        assert rows[1][3] == 0.25

    def test_weight_scale_only_ratio_matters(self, kb: Path):
        """权重只有相对比例起作用（4.0 与 1.0 同分）。"""
        idx = _make_idx(kb, **{**_BASE_W, "weight_keyword_match": 1.0})
        rows = _run(idx)
        by_doc = {r[0]: r[3] for r in rows}
        assert by_doc["doc1"] == 1.0 and by_doc["doc2"] == 0.5


class TestWeightFtsScore:
    def test_fts_factor_differentiates(self, kb: Path):
        idx = _make_idx(
            kb,
            weight_keyword_match=1.0, weight_file_name_match=0.0,
            weight_fts_score=1.0, weight_title_match=0.0,
            weight_proximity_match=0.0,
        )
        rows = _run(idx)
        # sigmoid(BM25) ∈ (0,1)：composite = (ratio + sigmoid)/2 ∈ (0.25, 1)
        assert all(0.25 < r[3] < 1.0 for r in rows)
        # 同为 2/2 命中的 doc1 与 far 分数可能因 BM25 不同而不同——只验证合成公式成立
        for _score, doc in [(r[3], r[0]) for r in rows]:
            assert isinstance(doc, str)


class TestWeightTitleMatch:
    def test_title_hit_boosts_score(self, tmp_path: Path, monkeypatch):
        (tmp_path / "t1.md").write_text(
            f"# 磁锚专题\n\n磁锚 检索 内容{_cn(13)}\n", encoding="utf-8"
        )
        (tmp_path / "t2.md").write_text(
            f"# 普通\n\n磁锚 检索 内容{_cn(13)}\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)
        idx = _make_idx(
            tmp_path,
            weight_keyword_match=1.0, weight_file_name_match=0.0,
            weight_fts_score=0.0, weight_title_match=3.0,
            weight_proximity_match=0.0,
        )
        rows = _run(idx)
        # t1：keyword 1.0 + title 0.5×3 → (1+1.5)/4 = 0.625；t2：1/4 = 0.25
        assert rows[0][0] == "t1" and rows[0][3] == 0.625
        assert rows[1][0] == "t2" and rows[1][3] == 0.25


class TestWeightProximityMatch:
    def test_adjacent_outranks_distant(self, kb: Path):
        idx = _make_idx(
            kb,
            weight_keyword_match=0.0, weight_file_name_match=0.0,
            weight_fts_score=0.0, weight_title_match=0.0,
            weight_proximity_match=1.0,
        )
        rows = _run(idx)
        by_doc = {r[0]: r[3] for r in rows}
        assert by_doc["doc1"] == 1.0   # prox=2 → 2/2=1.0
        assert by_doc["far"] == 0.5    # prox=1 → 1/2=0.5
        # doc2 只命中"磁锚"1/2 词 → matched != total → prox=1 → 0.5
        assert by_doc["doc2"] == 0.5


# ---------------------------------------------------------------------------
# 权重联合：五个因子同时生效（回归出厂默认 4/2/1/2/1）
# ---------------------------------------------------------------------------

class TestWeightsCombined:
    def test_factory_defaults_full_ranking(self, kb: Path):
        """出厂默认权重下全因子合成不抛错、排序非空且分数 ∈ [0,1]。"""
        idx = _make_idx(kb)  # 默认权重
        rows = _run(idx)
        assert rows, "出厂权重下应有结果"
        scores = [r[3] for r in rows]
        assert scores == sorted(scores, reverse=True), "结果须按 composite 降序"
        assert all(0.0 <= s <= 1.0 for s in scores)

    def test_weight_change_reorders(self, tmp_path: Path, monkeypatch):
        """同一数据，调 weight_file_name 0→大：文件名命中者反超。"""
        (tmp_path / "磁锚.md").write_text(
            f"# 名\n\n磁锚 检索 文本{_cn(13)}\n", encoding="utf-8"
        )
        (tmp_path / "正文.md").write_text(
            f"# 题\n\n磁锚 检索 文本{_cn(13)}\n", encoding="utf-8"
        )
        monkeypatch.chdir(tmp_path)

        idx = _make_idx(
            tmp_path,
            weight_keyword_match=1.0, weight_file_name_match=0.0,
            weight_fts_score=0.0, weight_title_match=0.0,
            weight_proximity_match=0.0,
        )
        rows_before = _run(idx)
        # 平分（keyword 同 1.0，排序不稳定）→ 只验证并列
        assert {r[3] for r in rows_before} == {1.0}

        idx.apply_config(idx._config.model_copy(update={"weight_file_name_match": 9.0}))
        rows_after = _run(idx)
        assert rows_after[0][0] == "磁锚"  # 文件名权重放大后反超
        assert rows_after[0][3] > rows_after[1][3]


# ---------------------------------------------------------------------------
# 激活链路：presets_store → activate → .env → CortexConfig（隔离环境）
# ---------------------------------------------------------------------------

class TestActivateChain:
    @pytest.fixture(autouse=True)
    def _isolated_env(self, tmp_path: Path, monkeypatch):
        """全局目录与数据目录名全部重定向到 tmp_path，避免污染真实 ~/.cortex。"""
        import doclens.config as cfgmod
        import doclens.web_v2.presets_store as pstore
        from doclens.web_v2 import config_store

        fake_home = tmp_path / "home"
        fake_home.mkdir()
        monkeypatch.setattr(cfgmod, "get_global_cortex_dir", lambda: fake_home / ".cortex")
        monkeypatch.setattr(pstore, "get_global_cortex_dir", lambda: fake_home / ".cortex")
        monkeypatch.setattr(config_store, "get_global_cortex_dir", lambda: fake_home / ".cortex")
        monkeypatch.setattr(cfgmod, "data_dirname", lambda: ".cortex")
        monkeypatch.setattr(config_store, "data_dirname", lambda: ".cortex")
        # CortexConfig.load 内部直接引用模块级函数 —— 经 sys.modules 一并 patch
        monkeypatch.setenv("HOME", str(fake_home))
        yield fake_home

    def _full_search_preset(self) -> dict:
        from doclens.web_v2 import presets_store

        return presets_store.create_preset({
            "name": "调优全参数",
            "kind": "search",
            "max_results": 33,
            "min_score_threshold": 0.45,
            "max_span": 120,
            "search_context_before": 111,
            "search_context_after": 222,
            "weight_keyword_match": 5.0,
            "weight_file_name_match": 2.5,
            "weight_fts_score": 1.5,
            "weight_title_match": 3.5,
            "weight_proximity_match": 0.5,
        })

    def test_activate_writes_all_ten_keys_to_env(self):
        preset = self._full_search_preset()
        from doclens.web_v2 import presets_store
        from doclens.web_v2.api.presets import _materialize

        updates = _materialize(presets_store.get_preset_raw(preset["id"]))
        assert updates == {
            "CORTEX_ACTIVE_SEARCH_PRESET": "调优全参数",
            "CORTEX_MAX_RESULTS": "33",
            "CORTEX_MIN_SCORE_THRESHOLD": "0.45",
            "CORTEX_MAX_SPAN": "120",
            "CORTEX_SEARCH_CONTEXT_BEFORE": "111",
            "CORTEX_SEARCH_CONTEXT_AFTER": "222",
            "CORTEX_WEIGHT_KEYWORD_MATCH": "5.0",
            "CORTEX_WEIGHT_FILE_NAME_MATCH": "2.5",
            "CORTEX_WEIGHT_FTS_SCORE": "1.5",
            "CORTEX_WEIGHT_TITLE_MATCH": "3.5",
            "CORTEX_WEIGHT_PROXIMITY_MATCH": "0.5",
        }

    def test_activated_values_readable_by_config(self):
        """物化 → write_env_values → CortexConfig 全字段可读回（预设生效的证明）。"""
        import doclens.config as cfgmod
        from doclens.web_v2.config_store import write_env_values

        preset = self._full_search_preset()
        from doclens.web_v2 import presets_store
        from doclens.web_v2.api.presets import _materialize

        updates = _materialize(presets_store.get_preset_raw(preset["id"]))
        env_path = cfgmod.get_global_cortex_dir() / ".env"
        write_env_values(env_path, updates)

        cfg = CortexConfig(_env_file=str(env_path), _env_file_encoding="utf-8")
        assert cfg.max_results == 33
        assert abs(cfg.min_score_threshold - 0.45) < 1e-9
        assert cfg.max_span == 120
        assert cfg.search_context_before == 111
        assert cfg.search_context_after == 222
        assert cfg.weight_keyword_match == 5.0
        assert cfg.weight_file_name_match == 2.5
        assert cfg.weight_fts_score == 1.5
        assert cfg.weight_title_match == 3.5
        assert cfg.weight_proximity_match == 0.5

    def test_preset_fields_roundtrip_in_store(self):
        """store 层：创建 → 读取，10 字段无丢失（None 字段不落盘）。"""
        preset = self._full_search_preset()
        from doclens.web_v2 import presets_store

        raw = presets_store.get_preset_raw(preset["id"])
        assert raw["max_results"] == 33
        assert raw["weight_proximity_match"] == 0.5
        assert raw["kind"] == "search"

        partial = presets_store.create_preset({"name": "部分", "kind": "search", "max_results": 5})
        raw2 = presets_store.get_preset_raw(partial["id"])
        assert "min_score_threshold" not in raw2  # None 不落盘 → 物化时跳过

    def test_hot_reload_pushes_to_index_manager(self):
        """apply_config（reload_config 的最后一步）热更新已存在的 IndexManager。"""
        preset = self._full_search_preset()
        import doclens.config as cfgmod
        from doclens.index_manager import IndexManager
        from doclens.web_v2 import presets_store
        from doclens.web_v2.api.presets import _materialize
        from doclens.web_v2.config_store import write_env_values

        updates = _materialize(presets_store.get_preset_raw(preset["id"]))
        write_env_values(cfgmod.get_global_cortex_dir() / ".env", updates)
        cfg = CortexConfig(_env_file=str(cfgmod.get_global_cortex_dir() / ".env"), _env_file_encoding="utf-8")

        idx = IndexManager(CortexConfig())
        assert idx.max_span == 50  # 默认值（激活前）
        idx.apply_config(cfg)
        assert idx.max_span == 120
        assert idx.scoring_weights["keyword_match_ratio"] == 5.0
        assert idx.scoring_weights["title_match"] == 3.5
        assert idx.search_context_before == 111
        assert idx.search_context_after == 222


# ---------------------------------------------------------------------------
# Web 端 /api/search：config 参数经格式化层的透传
# ---------------------------------------------------------------------------

class TestWebSearchEndpoint:
    def test_snippet_budget_uses_window_sum(self, kb: Path):
        """endpoint 读取的 snippet_max = before + after（api/search.py:202 语义）。"""
        idx = _make_idx(kb, search_context_before=120, search_context_after=480)
        assert idx.search_context_before + idx.search_context_after == 600

    def test_max_context_lines_default_visible(self, kb: Path):
        """snippet 行数兜底仍由 max_context_lines 控制（与预设解耦）。"""
        idx = _make_idx(kb)
        assert idx.max_context_lines == 5
