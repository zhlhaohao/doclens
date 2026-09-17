#!/usr/bin/env python3
"""从 LLM trace md 推算前缀缓存命中率，与 GUI 会话信息弹窗口径对照。

口径（与前端 session-info-dialog 完全一致）：

    命中率 = Σ cache_read ÷ Σ (input + cache_read + cache_creation)

数据源：md 里每个「## 轮 N · 答」节的原生响应 JSON 的 usage 字段。
两种后端字段名均兼容：
  - Anthropic 原生：input_tokens / cache_read_input_tokens /
    cache_creation_input_tokens / output_tokens
  - OpenAI-compat：prompt_tokens / prompt_cache_hit_tokens /
    prompt_cache_miss_tokens / completion_tokens（流式为聚合还原形态）

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

ANSWER_HEADER_RE = re.compile(r"^## 轮 (\d+) · 答")
FENCE_OPEN_RE = re.compile(r"^(`{3,})json\s*$")


@dataclass(frozen=True)
class TurnUsage:
    turn: int
    input_tokens: int
    cache_read: int
    cache_creation: int
    output_tokens: int


def _usage_fields(usage: dict) -> tuple[int, int, int, int] | None:
    """原生 usage dict → (input, cache_read, cache_creation, output)；缺关键字段返回 None。"""
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
        return (
            int(usage.get("prompt_tokens") or 0),
            int(usage.get("prompt_cache_hit_tokens") or 0),
            int(usage.get("prompt_cache_miss_tokens") or 0),
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
