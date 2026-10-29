"""形状提取：把 MD 的表格/列表还原成结构化数据，供高语义版式使用。

设计原则（对应 SCHEMA 的「档 2 约定」）：
不同版式对「表头名」有不同期待，但都接受「看形状就懂」的通约——
- stats     2 列表格：值 | 标签（或标签 | 值，按首列是否像数字自动判）
- timeline  2-3 列表格：日期 | 事件 [| 说明]
- matrix    2×2 表格（首行首列作轴标签）
- compare   两栏（--- 切分）+ 各自的小标题
- big_number 页指令 number= 或首个段落/一级标题

若形状不符，退回通用渲染并给警告（永不中断）。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .parser import Block

NUM_RE = re.compile(r"^[\d\s.,%+\-万亿千百十]+\s*[万亿千百十]?$")
DATE_RE = re.compile(r"^(\d{4}[-/年.]?\d{0,2}|\d{1,2}\s*月|Q\d|第[一二三四五六七八九十\d]+[阶段期周天月年]|[A-Z][a-z]{2}\s*\d{0,4})$")


@dataclass
class Row:
    cells: list[str] = field(default_factory=list)

    @property
    def is_numeric_first(self) -> bool:
        return bool(self.cells) and _looks_numeric(self.cells[0])


def _looks_numeric(s: str) -> bool:
    t = s.replace("*", "").strip()
    if not t:
        return False
    # 「73 万」「64万」「99.9%」「1,200」这类
    return bool(re.fullmatch(r"[\d.,]+\s*[%％]?\s*[万亿千百十]?", t))


def _looks_date(s: str) -> bool:
    return bool(DATE_RE.match(s.replace("*", "").strip()))


def cells_of(b: Block) -> list[list[str]]:
    """表格块 → 二维单元（去分隔行）。"""
    from .charts import parse_table

    if b.kind != "table":
        return []
    t = parse_table(b.lines)
    if t is None:
        return []
    return [t.header] + t.rows


def list_items_of(b: Block) -> list[str]:
    """列表块 → 纯文本项（保留 **加粗** 标记，供行内渲染）。"""
    if b.kind != "list":
        return []
    out = []
    for _lvl, runs, _ordered in b.list_items:
        out.append("".join(r.text for r in runs))
    return out


# ---------------------------------------------------------------------------
# stats：2 列表格 → 数据卡
# ---------------------------------------------------------------------------

def stats_cards(rows: list[list[str]]) -> list[dict]:
    """返回 [{value, label}]。

    表头若有意义（如「数值」「说明」）会被识别但丢弃；
    首列像数字 → (值, 标签)，否则 → (标签, 值)。
    """
    if not rows:
        return []
    body = rows[1:] if len(rows) > 1 and not _looks_numeric(rows[0][0]) else rows
    out = []
    for r in body:
        if len(r) < 2:
            if r:
                out.append({"value": "", "label": r[0]})
            continue
        a, b = r[0].strip(), r[1].strip()
        if _looks_numeric(a):
            out.append({"value": a, "label": b})
        elif _looks_numeric(b):
            out.append({"value": b, "label": a})
        else:
            out.append({"value": a, "label": b})
    return out


# ---------------------------------------------------------------------------
# timeline：2-3 列表格 或 列表 → 时间线节点
# ---------------------------------------------------------------------------

def timeline_nodes(rows: list[list[str]], items: list[str]) -> list[dict]:
    """返回 [{date, title, text}]。"""
    out: list[dict] = []
    if rows:
        body = rows[1:] if len(rows) > 1 and not _looks_date(rows[0][0]) else rows
        for r in body:
            if len(r) >= 3:
                out.append({"date": r[0], "title": r[1], "text": r[2]})
            elif len(r) == 2:
                out.append({"date": r[0], "title": r[1], "text": ""})
            elif r:
                out.append({"date": "", "title": r[0], "text": ""})
    elif items:
        # 列表项形如「2025-03 立项：三人小团队」→ 拆日期/标题/说明
        for it in items:
            m = re.match(r"^([^：:\s]{2,12})\s*[：:\-—]?\s*(.*)$", it.strip())
            if m and _looks_date(m.group(1)):
                rest = m.group(2)
                if "：" in rest or ":" in rest:
                    tt, _, tx = re.split(r"([：:])", rest, maxsplit=1)[0], None, rest
                    parts = re.split(r"[：:]", rest, maxsplit=1)
                    out.append({"date": m.group(1), "title": parts[0], "text": parts[1] if len(parts) > 1 else ""})
                else:
                    out.append({"date": m.group(1), "title": rest, "text": ""})
            else:
                out.append({"date": "", "title": it, "text": ""})
    return out


# ---------------------------------------------------------------------------
# matrix：2×2 表格 → 四象限
# ---------------------------------------------------------------------------

def matrix_quadrants(rows: list[list[str]]) -> dict:
    """返回 {x_axis, y_axis, quads:[{title,items}]}（左上/右上/左下/右下序）。

    期待形状：3×3（首行首列为轴标签），或 3×2 / 2×2 的退化形态。
    """
    if not rows:
        return {}
    # 去掉纯表头的首行（若首格为空且其余是轴标签）
    first = rows[0]
    y_labels: list[str] = []
    x_labels: list[str] = []
    grid: list[list[str]] = []

    if len(rows) >= 3 and len(first) >= 3:
        x_labels = [c.strip() for c in first[1:3]]
        for r in rows[1:3]:
            if len(r) >= 3:
                y_labels.append(r[0].strip())
                grid.append([c.strip() for c in r[1:3]])
    elif len(rows) == 2 and len(first) == 2:
        y_labels = [r[0].strip() for r in rows]
        grid = [[r[1].strip()] for r in rows]
        x_labels = ["", ""]
    else:
        # 兜底：取前 2 行各前 2 列
        for r in rows[:2]:
            y_labels.append((r[0] if r else "").strip())
            grid.append([(c.strip() if i < len(r) else "") for i, c in enumerate(r[1:3])])

    quads = []
    order = [(0, 0), (0, 1), (1, 0), (1, 1)]
    name = ["左上", "右上", "左下", "右下"]
    for idx, (ri, ci) in enumerate(order):
        cell = grid[ri][ci] if ri < len(grid) and ci < len(grid[ri]) else ""
        quads.append({"name": name[idx], "text": cell})
    return {"x_axis": x_labels, "y_axis": y_labels, "quads": quads}


# ---------------------------------------------------------------------------
# compare：两栏 + 小标题
# ---------------------------------------------------------------------------

def compare_sides(blocks: list[Block]) -> tuple[dict, dict]:
    """首个 hr 切两半；每半的首个加粗段落或 h2/h3 作小标题。"""
    split = next((i for i, b in enumerate(blocks) if b.kind == "hr"), None)
    if split is None:
        half = len(blocks) // 2
        left_blocks, right_blocks = blocks[:half], blocks[half:]
    else:
        left_blocks, right_blocks = blocks[:split], blocks[split + 1:]

    def pack(bs: list[Block]) -> dict:
        title = ""
        rest = bs
        if bs:
            b0 = bs[0]
            if b0.kind in ("heading",) and b0.level >= 2:
                title = "".join(r.text for r in b0.runs)
                rest = bs[1:]
            elif b0.kind == "para" and b0.runs and all(r.bold for r in b0.runs if r.text.strip()):
                title = "".join(r.text for r in b0.runs)
                rest = bs[1:]
        return {"title": title, "blocks": rest}

    return pack(left_blocks), pack(right_blocks)


# ---------------------------------------------------------------------------
# big_number：页指令 number= 或正文首行
# ---------------------------------------------------------------------------

def big_number(slide_directive: dict, blocks: list[Block]) -> tuple[str, list[Block]]:
    """返回 (数字, 剩余块)。"""
    n = str(slide_directive.get("number", "")).strip()
    if n:
        return n, blocks
    # 首个段落若整行像一个数字/短数字串，取它
    for i, b in enumerate(blocks):
        if b.kind == "para" and b.runs:
            text = "".join(r.text for r in b.runs).strip()
            if text and len(text) <= 12 and re.search(r"\d", text):
                return text, blocks[:i] + blocks[i + 1:]
    return "", blocks


# ---------------------------------------------------------------------------
# grid：表格或列表 → 卡片（2 列表格：标题|说明；或列表项"标题 —— 说明"）
# ---------------------------------------------------------------------------

def grid_cards(rows: list[list[str]], items: list[str]) -> list[dict]:
    """返回 [{head, desc}]，最多 4 张（2x2）/6 张（2x3）。"""
    out: list[dict] = []
    if rows:
        body = rows[1:] if len(rows) > 1 else rows
        for r in body[:6]:
            if len(r) >= 2:
                out.append({"head": r[0].strip(), "desc": r[1].strip()})
            elif r:
                out.append({"head": r[0].strip(), "desc": ""})
    elif items:
        for it in items[:6]:
            m = re.match(r"^(.+?)\s*[—–-]{1,2}\s*(.+)$", it.strip())
            if m:
                out.append({"head": m.group(1).strip(), "desc": m.group(2).strip()})
            else:
                out.append({"head": it.strip(), "desc": ""})
    return out


# ---------------------------------------------------------------------------
# agenda：表格或列表 → 目录项
# ---------------------------------------------------------------------------

def agenda_items(rows: list[list[str]], items: list[str]) -> list[dict]:
    """返回 [{name, note}]。2 列表格（章节|说明）或列表。"""
    out: list[dict] = []
    if rows:
        body = rows[1:] if len(rows) > 1 else rows
        for r in body[:7]:
            if len(r) >= 2:
                out.append({"name": r[0].strip(), "note": r[1].strip()})
            elif r:
                out.append({"name": r[0].strip(), "note": ""})
    else:
        for it in items[:7]:
            m = re.match(r"^(.+?)\s*[：:]\s*(.+)$", it.strip())
            if m:
                out.append({"name": m.group(1).strip(), "note": m.group(2).strip()})
            else:
                out.append({"name": it.strip(), "note": ""})
    return out


# ---------------------------------------------------------------------------
# pyramid：表格 → 层（首行为顶层）
# ---------------------------------------------------------------------------

def pyramid_levels(rows: list[list[str]]) -> list[dict]:
    """返回 [{name, desc}]，从顶到底，最多 4 层。"""
    out = []
    if rows:
        body = rows[1:] if len(rows) > 1 else rows
        for r in body[:4]:
            if len(r) >= 2:
                out.append({"name": r[0].strip(), "desc": r[1].strip()})
            elif r:
                out.append({"name": r[0].strip(), "desc": ""})
    return out


# ---------------------------------------------------------------------------
# funnel：表格 → 漏斗段（阶段|数值，首行为入口）
# ---------------------------------------------------------------------------

def funnel_stages(rows: list[list[str]]) -> list[dict]:
    """返回 [{name, value, rate}]，rate 为相对上一段的转化率（%），首段无。"""
    out: list[dict] = []
    if not rows:
        return out
    body = rows[1:] if len(rows) > 1 else rows
    prev: float | None = None
    for r in body[:5]:
        name = r[0].strip() if r else ""
        val_txt = r[1].strip().replace(",", "") if len(r) > 1 else ""
        try:
            v = float(val_txt.rstrip("%％"))
        except ValueError:
            v = 0.0
        rate = ""
        if prev and prev > 0 and v >= 0:
            rate = f"{v / prev * 100:.0f}%"
        out.append({"name": name, "value": val_txt or f"{v:g}", "rate": rate})
        prev = v
    return out


# ---------------------------------------------------------------------------
# cycle：列表或表格 → 环节点
# ---------------------------------------------------------------------------

def cycle_nodes(rows: list[list[str]], items: list[str]) -> list[dict]:
    """返回 [{name, desc}]，3-5 节点。"""
    out: list[dict] = []
    if rows:
        body = rows[1:] if len(rows) > 1 else rows
        for r in body[:5]:
            if len(r) >= 2:
                out.append({"name": r[0].strip(), "desc": r[1].strip()})
            elif r:
                out.append({"name": r[0].strip(), "desc": ""})
    else:
        for it in items[:5]:
            m = re.match(r"^(.+?)\s*[：:]\s*(.+)$", it.strip())
            if m:
                out.append({"name": m.group(1).strip(), "desc": m.group(2).strip()})
            else:
                out.append({"name": it.strip(), "desc": ""})
    return out
