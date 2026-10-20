"""离线命中率脚本（scripts/trace_hit_rate.py）的字段归一测试。

回归 2026-10-20 事故的两处解析缺口：
1. 轮次标题正则过期（trace 标题 2026-09-18 起是「· 收」，脚本仍找「· 答」
   → 解析不到任何轮次，脚本报「未解析到任何带 usage 的答节」）；
2. OpenAI 口径字段未归一（MiniMax 只报 prompt_tokens_details.cached_tokens；
   且 prompt_tokens 是「命中 + 未命中」总数，input 必须减去命中数才能
   与 Anthropic 侧同口径相加）。
"""
import importlib.util
import sys
from pathlib import Path

_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "trace_hit_rate.py"


def _load():
    spec = importlib.util.spec_from_file_location("trace_hit_rate", _SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["trace_hit_rate"] = module
    spec.loader.exec_module(module)
    return module


def test_anthropic_usage_fields_pass_through():
    mod = _load()
    assert mod._usage_fields({
        "input_tokens": 100,
        "cache_read_input_tokens": 9400,
        "cache_creation_input_tokens": 500,
        "output_tokens": 42,
    }) == (100, 9400, 500, 42)


def test_minimax_cached_tokens_details_normalized():
    """MiniMax 口径：命中数在 prompt_tokens_details.cached_tokens。

    input 必须是「总数 - 命中」，否则命中部分被重复计入总输入，
    命中率被稀释、上下文占用虚高。
    """
    mod = _load()
    assert mod._usage_fields({
        "prompt_tokens": 20489,
        "completion_tokens": 64,
        "prompt_tokens_details": {"cached_tokens": 12438},
    }) == (20489 - 12438, 12438, 0, 64)


def test_deepseek_prompt_cache_hit_fields_normalized():
    mod = _load()
    assert mod._usage_fields({
        "prompt_tokens": 5000,
        "prompt_cache_hit_tokens": 4800,
        "prompt_cache_miss_tokens": 200,
        "completion_tokens": 200,
    }) == (200, 4800, 0, 200)


def test_no_cache_endpoint_keeps_full_input():
    mod = _load()
    assert mod._usage_fields({
        "prompt_tokens": 500,
        "completion_tokens": 20,
    }) == (500, 0, 0, 20)


def test_usage_fields_rejects_non_dict():
    mod = _load()
    assert mod._usage_fields(None) is None
    assert mod._usage_fields("nope") is None


def test_parses_current_trace_header_format(tmp_path):
    """trace 标题现为「## 轮 N · 收 · 时间」——脚本必须能解析。

    回归 2026-09-18 术语统一（问→发、答→收）后脚本正则未同步、
    一直解析不出任何轮次的缺口。
    """
    mod = _load()
    trace = tmp_path / "20261020-s.md"
    trace.write_text(
        "# LLM Trace\n\n"
        "## 轮 1 · 发 · 09:00:00\n"
        "```json\n{\"model\": \"m\"}\n```\n\n"
        "## 轮 1 · 收 · 09:00:01\n"
        "```json\n"
        "{\"usage\": {\"prompt_tokens\": 20489, \"completion_tokens\": 64, "
        "\"prompt_tokens_details\": {\"cached_tokens\": 12438}}}\n"
        "```\n\n"
        "## 轮 2 · 收 · 09:00:02\n"
        "```json\n"
        "{\"usage\": {\"input_tokens\": 825, \"cache_read_input_tokens\": 4450, "
        "\"cache_creation_input_tokens\": 0, \"output_tokens\": 16}}\n"
        "```\n",
        encoding="utf-8",
    )
    turns = mod.parse_trace(trace)
    assert len(turns) == 2
    assert turns[0].cache_read == 12438
    assert turns[0].input_tokens == 20489 - 12438
    assert turns[1].cache_read == 4450

    # 累计命中率 = Σcache_read ÷ Σ总输入
    read_sum = sum(t.cache_read for t in turns)
    in_sum = sum(
        t.input_tokens + t.cache_read + t.cache_creation for t in turns
    )
    assert read_sum == 12438 + 4450
    assert in_sum == 20489 + 5275
