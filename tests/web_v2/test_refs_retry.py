"""重试循环核心逻辑单测（纯函数，注入 fake run_round）。"""
import time
from doclens.web_v2.refs_retry import resolve_answer_with_retry, RoundResult


def _round(text, tool_calls):
    return RoundResult(text=text, tool_calls=tool_calls)


def test_exempt_when_no_retrieval_tool(tmp_path):
    """没调检索工具 → 豁免，直接采用，无 references、无 toast。"""
    calls = []
    def run_round(history, query):
        calls.append(query)
        return _round("已为你重建索引。", [{"name": "manage_kb", "output": "ok"}])
    res = resolve_answer_with_retry(run_round, "重建索引", [], tmp_path)
    assert len(calls) == 1
    assert res.text == "已为你重建索引。"
    assert res.references == []
    assert res.toast is None


def test_compliant_first_try(tmp_path):
    """正文合规章节 + 路径存在 → 一次通过，references=parsed.paths。"""
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "b.md").write_text("x", encoding="utf-8")
    md = "回答 [1]。\n\n## 参考资料\n1. a/b.md\n"
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    res = resolve_answer_with_retry(lambda h, q: _round(md, tc), "问题", [], tmp_path)
    assert res.references == [{"path": "a/b.md"}]
    assert res.toast is None


def test_retry_then_compliant(tmp_path):
    """第 1 轮缺章节 → 重试 → 第 2 轮合规；反馈消息含契约。"""
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "b.md").write_text("x", encoding="utf-8")
    md_bad = "回答 [1]。"  # 无 ## 参考资料
    md_good = "回答 [1]。\n\n## 参考资料\n1. a/b.md\n"
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    seq = iter([_round(md_bad, tc), _round(md_good, tc)])
    queries = []
    def run_round(h, q):
        queries.append(q)
        return next(seq)
    res = resolve_answer_with_retry(run_round, "问题", [], tmp_path)
    assert len(queries) == 2
    assert "参考资料不合规" in queries[1]
    assert "机器解析契约" in queries[1] or "## 参考资料" in queries[1]
    assert res.references == [{"path": "a/b.md"}]
    assert res.toast is None


def test_brake_falls_back_to_tool_results(tmp_path):
    """重试用尽 → 用工具结果兜底 + toast。"""
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    md_bad = "回答 [1]。"
    res = resolve_answer_with_retry(
        lambda h, q: _round(md_bad, tc), "问题", [], tmp_path, max_retries=2,
    )
    assert res.toast is not None
    assert res.references == [{"path": "a/b.md"}]


def test_brake_empty_tool_results_still_toast(tmp_path):
    """刹车时工具结果为空 → references 空，但仍 toast。"""
    tc = [{"name": "search_kb", "output": "无结果", "is_error": False}]
    md_bad = "回答 [1]。"
    res = resolve_answer_with_retry(
        lambda h, q: _round(md_bad, tc), "问题", [], tmp_path, max_retries=1,
    )
    assert res.toast is not None
    assert res.references == []


def test_timeout_brakes(tmp_path):
    """deadline 已过 → 跑完第 1 轮即刹车兜底。"""
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    md_bad = "回答 [1]。"
    n = {"count": 0}
    def run_round(h, q):
        n["count"] += 1
        return _round(md_bad, tc)
    res = resolve_answer_with_retry(
        run_round, "问题", [], tmp_path,
        max_retries=5, deadline_monotonic=time.monotonic() - 1,
    )
    assert n["count"] == 1
    assert res.toast is not None


def test_history_not_mutated(tmp_path):
    """调用方 history 不被 mutate。"""
    md_bad = "回答 [1]。"
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    history = []
    resolve_answer_with_retry(lambda h, q: _round(md_bad, tc), "问题", history, tmp_path, max_retries=1)
    assert history == []
