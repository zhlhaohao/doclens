#!/usr/bin/env python3
"""从 LLM trace md 推算前缀缓存命中率，与 GUI 会话信息弹窗口径对照。

口径（与前端 session-info-dialog 完全一致）：

    命中率 = Σ cache_read ÷ Σ (input + cache_read + cache_creation)

数据源：md 里每个「## 轮 N · 收」节的原生响应 JSON 的 usage 字段。
三种后端字段名均兼容：
  - Anthropic 原生：input_tokens / cache_read_input_tokens /
    cache_creation_input_tokens / output_tokens
  - OpenAI-compat（DeepSeek）：prompt_tokens / prompt_cache_hit_tokens /
    prompt_cache_miss_tokens / completion_tokens（流式为聚合还原形态）
  - OpenAI-compat（MiniMax / OpenAI 官方）：prompt_tokens /
    prompt_tokens_details.cached_tokens / completion_tokens

用法：
    python scripts/trace_hit_rate.py <trace.md>          # 汇总
    python scripts/trace_hit_rate.py <trace.md> -v       # 附每轮明细
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ANSWER_HEADER_RE = re.compile(r"^## 轮 (\d+) · 收")
FENCE_OPEN_RE = re.compile(r"^(`{3,})json\s*$")


@dataclass(frozen=True)
class TurnUsage:
    turn: int
    input_tokens: int
    cache_read: int
    cache_creation: int
    output_tokens: int


def _usage_fields(usage: dict) -> tuple[int, int, int, int] | None:
    """原生 usage dict → (input, cache_read, cache_creation, output)；缺关键字段返回 None。

    三套字段名都兼容（各家网关口径不同）：

    - Anthropic 原生：``input_tokens`` / ``cache_read_input_tokens`` /
      ``cache_creation_input_tokens`` / ``output_tokens``——``input_tokens``
      已是「仅新增」，与 ``cache_read`` 不重叠，直接相加即总输入。
    - OpenAI-compat（DeepSeek 系）：``prompt_tokens`` / ``prompt_cache_hit_tokens`` /
      ``prompt_cache_miss_tokens`` / ``completion_tokens``。
    - OpenAI-compat（MiniMax / 阿里云 / OpenAI 官方）：
      ``prompt_tokens`` / ``prompt_tokens_details.cached_tokens`` /
      ``completion_tokens``。

    **口径对齐**：OpenAI 系的 ``prompt_tokens`` 是「命中 + 未命中」总数，
    而 Anthropic 的 ``input_tokens`` 仅是新增部分。故 OpenAI 侧返回的
    ``input`` 必须先减去命中数（``prompt_tokens - cached_tokens``），
    才能与 Anthropic 侧同口径相加——否则命中部分被重复计一次，
    命中率被稀释、上下文占用虚高。

    OpenAI 侧无「写缓存」计数（``cache_creation`` 恒 0）：未命中的 token
    已计入 ``input``，再计一次会与 input 重复。
    """
    if not isinstance(usage, dict):
        return None
    if "input_tokens" in usage or "cache_read_input_tokens" in usage:
        return (
            int(usage.get("input_tokens") or 0),
            int(usage.get("cache_read_input_tokens") or 0),
            int(usage.get("cache_creation_input_tokens") or 0),
            int(usage.get("output_tokens") or 0),
        )
    if "prompt_tokens" in usage:  # OpenAI-compat 原生 / 流聚合形态
        hit = int(usage.get("prompt_cache_hit_tokens") or 0)
        if not hit:
            details = usage.get("prompt_tokens_details") or {}
            if isinstance(details, dict):
                hit = int(details.get("cached_tokens") or 0)
        prompt_total = int(usage.get("prompt_tokens") or 0)
        return (
            max(0, prompt_total - hit),  # 新增 = 总数 - 命中（与 Anthropic 同口径）
            hit,
            0,
            int(usage.get("completion_tokens") or 0),
        )
    return None


def parse_trace(path: Path) -> list[TurnUsage]:
    """扫描答节后的首个 json 代码块，提取 usage（流式读，支持超大文件）。"""
    turns: list[TurnUsage] = []
    current_turn: int | None = None
    fence: str | None = None
    block_lines: list[str] = []

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if fence is None:
                m = ANSWER_HEADER_RE.match(line)
                if m:
                    current_turn = int(m.group(1))
                    continue
                m = FENCE_OPEN_RE.match(line)
                if m and current_turn is not None:
                    fence = m.group(1)
                    block_lines = []
                continue
            # 代码块内：等长闭合 fence
            if line.rstrip("\r\n") == fence:
                block = "\n".join(block_lines)
                fence = None
                if current_turn is not None:
                    try:
                        payload = json.loads(block)
                    except json.JSONDecodeError:
                        print(f"  [warn] 轮 {current_turn} 响应 JSON 解析失败，跳过", file=sys.stderr)
                        current_turn = None
                        continue
                    fields = _usage_fields(payload.get("usage"))
                    if fields is None:
                        print(f"  [warn] 轮 {current_turn} usage 字段缺失，跳过", file=sys.stderr)
                    else:
                        turns.append(TurnUsage(current_turn, *fields))
                    current_turn = None
                continue
            block_lines.append(line.rstrip("\r\n"))
    return turns


def main() -> int:
    parser = argparse.ArgumentParser(description="LLM trace 缓存命中率推算（弹窗同口径）")
    parser.add_argument("trace", type=Path, help="llm_trace md 文件路径")
    parser.add_argument("-v", "--verbose", action="store_true", help="附每轮明细")
    args = parser.parse_args()

    if not args.trace.is_file():
        print(f"文件不存在: {args.trace}", file=sys.stderr)
        return 1

    turns = parse_trace(args.trace)
    if not turns:
        print("未解析到任何带 usage 的答节", file=sys.stderr)
        return 2

    if args.verbose:
        print(f"{'轮':>4} {'input':>9} {'cache_read':>11} {'creation':>9} {'output':>8}  单轮命中率")
        for t in turns:
            total = t.input_tokens + t.cache_read + t.cache_creation
            pct = t.cache_read * 100 // total if total else 0
            print(f"{t.turn:>4} {t.input_tokens:>9,} {t.cache_read:>11,} "
                  f"{t.cache_creation:>9,} {t.output_tokens:>8,}  {pct:>3}%")
        print()

    read_sum = sum(t.cache_read for t in turns)
    in_sum = sum(t.input_tokens + t.cache_read + t.cache_creation for t in turns)
    out_sum = sum(t.output_tokens for t in turns)
    hit = read_sum * 100 / in_sum if in_sum else 0.0

    print(f"文件: {args.trace.name}")
    print(f"调用轮数: {len(turns)}")
    print(f"Σ 总输入 = Σ(input + cache_read + cache_creation) = {in_sum:,}")
    print(f"Σ cache_read（命中）: {read_sum:,}")
    print(f"Σ output: {out_sum:,}")
    print(f"全会话累计命中率 = {read_sum:,} / {in_sum:,} = {hit:.2f}%"
          f"（与弹窗同口径，精确到小数点后两位）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
