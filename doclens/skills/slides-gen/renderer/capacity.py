"""版式容量：从版式 HTML 的 data-cap 读取，供写稿期预检与渲染期换版式。

容量单位「阅读单元 (unit)」：1 个汉字 = 1，1 个英文/数字词 = 1。
与 luobo-ppt 的 capacity 口径一致，便于横向对照经验值。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

# 每个版式的兜底容量（版式文件未声明 data-cap 时使用）
DEFAULT_CAP = {
    "bullets": 6,
    "bullet_chars": 40,
    "total_chars": 240,
    "table_rows": 8,
    "table_cols": 4,
    "image_min_ratio": 0.0,
}

_CAP_RE = re.compile(r'data-cap\s*=\s*([\'"])(?P<json>.*?)\1', re.S)


@dataclass
class Capacity:
    bullets: int = 6            # 单页要点条数上限
    bullet_chars: int = 40      # 单条要点字数上限
    total_chars: int = 240      # 单页正文总字数上限
    table_rows: int = 8         # 表格行数上限（含表头）
    table_cols: int = 4         # 表格列数上限
    image_min_ratio: float = 0.0  # 图文版式中图片应占的最小面积比

    @classmethod
    def from_dict(cls, d: dict) -> "Capacity":
        merged = {**DEFAULT_CAP, **{k: v for k, v in d.items() if k in DEFAULT_CAP}}
        return cls(**merged)

    def to_dict(self) -> dict:
        return {k: getattr(self, k) for k in DEFAULT_CAP}


def read_cap(path: Path) -> Capacity:
    """从版式 HTML 读 data-cap；缺失或损坏时回退默认值。"""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return Capacity()
    m = _CAP_RE.search(text)
    if not m:
        return Capacity()
    try:
        return Capacity.from_dict(json.loads(m.group("json")))
    except (json.JSONDecodeError, TypeError, ValueError):
        return Capacity()


def clen(text: str) -> int:
    """阅读单元计数：CJK 每字 1，连续拉丁/数字串每个算 1，标点计 0。"""
    if not text:
        return 0
    text = re.sub(r"\*\*|__|`|~~", "", text)          # 去行内标记
    n = 0
    latin_run = False
    for ch in text:
        o = ord(ch)
        if 0x2E80 <= o <= 0x9FFF or 0xF900 <= o <= 0xFAFF or 0xAC00 <= o <= 0xD7AF:
            n += 1
            latin_run = False
        elif ch.isalnum():
            if not latin_run:
                n += 1
                latin_run = True
        else:
            latin_run = False
    return n


@dataclass
class CapacityIssue:
    page: int
    field: str
    detail: str
    hint: str
    level: str = "warn"        # warn | error


def check_slide(slide, page_no: int, cap: Capacity) -> list[CapacityIssue]:
    """按容量表检查一页。slide 为 parser.Slide。"""
    out: list[CapacityIssue] = []
    total = 0
    for b in slide.blocks:
        if b.kind == "list":
            n = len(b.list_items)
            if n > cap.bullets:
                out.append(CapacityIssue(
                    page_no, "bullets",
                    f"要点 {n} 条，超过 {cap.bullets} 条上限",
                    f"拆成两页，或删到 {cap.bullets} 条以内"))
            for _lvl, runs, _o in b.list_items:
                c = clen("".join(r.text for r in runs))
                total += c
                if c > cap.bullet_chars:
                    txt = "".join(r.text for r in runs)[:24]
                    out.append(CapacityIssue(
                        page_no, "bullet_chars",
                        f"单条要点 {c} 字，超过 {cap.bullet_chars} 字上限：「{txt}…」",
                        "这条太长：拆成两条，或把细节移入 notes"))
        elif b.kind in ("para", "quote"):
            c = clen("".join(r.text for r in b.runs) if b.runs
                     else "\n".join(b.lines))
            total += c
        elif b.kind == "heading":
            c = clen("".join(r.text for r in b.runs))
            total += c
            if b.level == 1 and c > 30:
                out.append(CapacityIssue(
                    page_no, "title",
                    f"标题 {c} 字偏长（建议 ≤ 22 字）：「{''.join(r.text for r in b.runs)[:28]}…」",
                    "标题写成结论式短句，细节放正文或 notes"))
        elif b.kind == "table":
            rows = [ln for ln in b.lines if ln.strip()]
            ncols = max((len([c for c in ln.strip().strip("|").split("|")]) for ln in rows),
                        default=0)
            if len(rows) > cap.table_rows:
                out.append(CapacityIssue(
                    page_no, "table_rows",
                    f"表格 {len(rows)} 行，超过 {cap.table_rows} 行上限",
                    f"精简到 {cap.table_rows} 行内，或拆页；也可改用要点列表"))
            if ncols > cap.table_cols:
                out.append(CapacityIssue(
                    page_no, "table_cols",
                    f"表格 {ncols} 列，超过 {cap.table_cols} 列上限",
                    f"列压到 {cap.table_cols} 列内（合并同类项），否则字号会被压到不可读"))

    if total > cap.total_chars:
        out.append(CapacityIssue(
            page_no, "total_chars",
            f"本页正文共 {total} 字，超过 {cap.total_chars} 字上限",
            "一页一个论点：删减 20-30%，或拆成两页"))
    return out


def summary(layout_dir: Path) -> list[dict]:
    """汇总所有版式的容量（供 `capacity` 子命令打印）。"""
    out = []
    for p in sorted(layout_dir.glob("*.html")):
        c = read_cap(p)
        out.append({"layout": p.stem, **c.to_dict()})
    return out
