"""素材分析：把用户给的长文/大纲/题目，先做结构统计，再决定分页策略。

为什么需要：一篇文章 8000 字直接让 LLM「提炼要点」，容易漏掉关键论点、
也不知道该拆几页。先做确定性统计（字数/段落/标题结构/可拆解单元），
就能给出「建议 8-12 页」这类可执行结论，而不是拍脑袋。

输出：分析报告（stdout）+ `<名>-analysis.json`，供后续写 deck.md 时参考。
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

CJK_RE = re.compile(r"[\u4e00-\u9fff]")
MD_HEAD_RE = re.compile(r"^(#{1,6})\s+(.+)$")
NUM_HEAD_RE = re.compile(r"^\s*(?:第[一二三四五六七八九十百]+[章节部分]|[一二三四五六七八九十]+[、.]|\d+[.、)])\s*(.+)$")
BULLET_RE = re.compile(r"^\s*[-*+]\s+(.+)$")

# 每页承载的经验值（与 capacity 的阅读单元口径一致）
UNITS_PER_SLIDE = 200        # 高密度页
UNITS_PER_SLIDE_LOW = 120    # 低密度（演讲）页


@dataclass
class Section:
    level: int
    title: str
    chars: int = 0


@dataclass
class Analysis:
    source: str = ""
    kind: str = "topic"          # topic | outline | article
    total_chars: int = 0
    cjk_chars: int = 0
    paragraphs: int = 0
    sections: list[dict] = field(default_factory=list)
    bullets: int = 0
    numbers: int = 0             # 出现的数据点（可能做成图表）
    suggested_slides: dict[str, int] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _units(text: str) -> int:
    """阅读单元：CJK 每字 1，拉丁词每词 1。"""
    n = len(CJK_RE.findall(text))
    latin = re.sub(r"[\u4e00-\u9fff]", " ", text)
    n += len(re.findall(r"[A-Za-z][A-Za-z0-9'-]*", latin))
    return n


def analyze_text(text: str, source: str = "") -> Analysis:
    a = Analysis(source=source)
    lines = text.splitlines()
    a.total_chars = len(re.sub(r"\s", "", text))
    a.cjk_chars = len(CJK_RE.findall(text))
    a.paragraphs = sum(1 for ln in lines if ln.strip() and not ln.strip().startswith("#"))

    cur: Section | None = None
    for ln in lines:
        m = MD_HEAD_RE.match(ln)
        if m:
            cur = Section(level=len(m.group(1)), title=m.group(2).strip())
            a.sections.append(cur)
            continue
        m2 = NUM_HEAD_RE.match(ln)
        if m2 and len(ln.strip()) < 40:
            cur = Section(level=2, title=m2.group(1).strip())
            a.sections.append(cur)
            continue
        if BULLET_RE.match(ln):
            a.bullets += 1
        if cur is not None:
            cur.chars += _units(ln)

    a.numbers = len(re.findall(r"\d+(?:\.\d+)?%?", text))
    a.sections = [asdict(s) for s in a.sections]

    # 判定素材类型
    units = _units(text)
    if units < 60:
        a.kind = "topic"
    elif a.sections and units < 900:
        a.kind = "outline"
    else:
        a.kind = "article"

    # 建议页数
    hi = max(1, round(units / UNITS_PER_SLIDE) + 2)
    lo = max(1, round(units / UNITS_PER_SLIDE_LOW) + 2)
    a.suggested_slides = {
        "演讲版（低密度，含封面/章节/结尾）": min(lo, hi),
        "阅读版（高密度，含封面/章节/结尾）": hi,
    }

    # 提示
    if a.kind == "topic":
        a.notes.append("只有题目：需先确认受众与场合，内容要自己补（查不到的不写）")
    if a.kind == "article" and units > 2000:
        a.notes.append(f"长文（{units} 单元）：先提炼 5-8 个论点再分页，不要逐段搬运")
    if a.sections and len(a.sections) > 12:
        a.notes.append(f"已有 {len(a.sections)} 个小节：注意合并，避免一页一节")
    if a.numbers >= 8:
        a.notes.append(f"含 {a.numbers} 处数据：考虑用图表块（chart=bar/line/pie）替代罗列")
    if a.bullets >= 20:
        a.notes.append(f"含 {a.bullets} 条列表项：需按主题分组，每组进一页")
    if not a.sections and a.kind == "article":
        a.notes.append("原文没有标题结构：先自己划分论点层级，再写 deck")
    return a


def read_source(path: Path) -> str:
    """读素材（md/txt 直读；其他交给 doclens 的解析能力）。"""
    suf = path.suffix.lower()
    if suf in (".md", ".markdown", ".txt", ""):
        return path.read_text(encoding="utf-8", errors="ignore")
    try:  # 富文档交给 treesearch 解析器（若可用）
        from treesearch.parsers.anydoc_parser import parse_anydoc  # type: ignore
        return parse_anydoc(str(path))
    except Exception:  # noqa: BLE001
        raise RuntimeError(
            f"不支持直接读 {suf}，请先转成 md/txt，或用 doclens 的 read_document 读取后粘贴")


def render(a: Analysis) -> str:
    kind_cn = {"topic": "题目", "outline": "大纲", "article": "文章"}[a.kind]
    lines = ["# 素材分析", ""]
    lines.append(f"- 类型：**{kind_cn}**")
    lines.append(f"- 正文字数：{a.total_chars}（中文 {a.cjk_chars} 字）· 段落 {a.paragraphs} · "
                 f"小节 {len(a.sections)} · 列表项 {a.bullets} · 数据点 {a.numbers}")
    lines.append("")
    lines.append("## 建议页数")
    for k, v in a.suggested_slides.items():
        lines.append(f"- {k}：约 **{v} 页**")
    lines.append("")
    if a.sections:
        lines.append("## 结构")
        for s in a.sections[:40]:
            indent = "  " * max(0, s["level"] - 1)
            lines.append(f"{indent}- {s['title']}（{s['chars']} 单元）")
        if len(a.sections) > 40:
            lines.append(f"  … 另有 {len(a.sections) - 40} 个小节")
        lines.append("")
    if a.notes:
        lines.append("## 写稿提示")
        for n in a.notes:
            lines.append(f"- {n}")
        lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    ap = argparse.ArgumentParser(prog="slides-gen-analyze",
                                 description="素材结构分析（决定分页策略）")
    ap.add_argument("path", nargs="?", type=Path, default=None, help="素材文件")
    ap.add_argument("--topic", default="", help="只有题目时直接用字符串")
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    args = ap.parse_args(argv)

    if not args.path and not args.topic:
        print("错误：给一个素材文件，或用 --topic \"题目\"", file=sys.stderr)
        return 2
    try:
        text = read_source(args.path) if args.path else args.topic
    except Exception as e:  # noqa: BLE001
        print(f"错误：{e}", file=sys.stderr)
        return 1

    a = analyze_text(text, source=str(args.path or ""))
    if args.json:
        print(json.dumps(a.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(render(a))
    if args.path:
        out = Path(str(args.path.with_suffix("")) + "-analysis.json")
        out.write_text(json.dumps(a.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
        if not args.json:
            print(f"已写 {out}")
    return 0


if __name__ == "__main__":
    import sys as _s
    _s.exit(main())
