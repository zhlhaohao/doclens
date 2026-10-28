"""受限布局引擎：版式 HTML → 矩形占位框（slot 树）。

四原语：div.row / div.col / slot + data-grow/gap/x/y/w/h。
求值结果 = 每个 slot 拿到幻灯片百分比坐标系下的矩形。
标准库 xml.etree 解析（版式是受信任资产，无 XXE 顾虑；仍禁实体解析）。
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class SlotRect:
    name: str
    x: float          # 百分比 0-100
    y: float
    w: float
    h: float
    align: str = ""   # left/center/right（空 = 默认左）
    role: str = ""    # title / sub / h1 / body / quote —— 主题字号/样式挂钩
    fit: str = "cover"

    def to_emu(self, width_emu: int, height_emu: int) -> tuple[int, int, int, int]:
        return (
            int(self.x / 100 * width_emu),
            int(self.y / 100 * height_emu),
            int(self.w / 100 * width_emu),
            int(self.h / 100 * height_emu),
        )


def _pct(val: str | None, default: float | None = None) -> float | None:
    """'12%' / '12' → 12.0；None 传入返回 default。"""
    if val is None:
        return default
    m = re.match(r"^([\d.]+)%?$", val.strip())
    if not m:
        return default
    return float(m.group(1))


def load_layout(path: Path) -> ET.Element:
    """读版式 HTML（容忍非严格 XML：先包一层根、剥掉 HTML 注释）。"""
    text = path.read_text(encoding="utf-8")
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    # div/slot 无命名空间；包根保证单根
    return ET.fromstring(f"<__root__>{text}</__root__>")


def evaluate_layout(path: Path) -> list[SlotRect]:
    """求值版式文件 → slot 矩形清单（文档序）。"""
    root = load_layout(path)
    top = next((c for c in root if c.tag in ("div", "slot")), None)
    slots: list[SlotRect] = []
    if top is None:
        return slots
    # 根容器默认占满 (0,0,100,100)
    _solve(top, 0.0, 0.0, 100.0, 100.0, slots)
    return slots


def _axis(tag: str, cls: str) -> str:
    if "row" in cls.split():
        return "x"
    if "col" in cls.split():
        return "y"
    return "row" if tag == "div" else ""


def _solve(el: ET.Element, x: float, y: float, w: float, h: float,
           slots: list[SlotRect]) -> None:
    """递归求值：el 已知可用矩形，把子元素分派下去。"""
    # 显式坐标覆盖（data-x/y/w/h 百分比）
    ex, ey = _pct(el.get("data-x")), _pct(el.get("data-y"))
    ew, eh = _pct(el.get("data-w"), 100.0), _pct(el.get("data-h"), 100.0)
    if ex is not None or ey is not None or el.get("data-w") or el.get("data-h"):
        # 相对父容器的百分比（越界自动夹取）
        if ex is not None:
            x = max(0.0, min(100.0, x + ex / 100 * w if w else ex))
        if ey is not None:
            y = max(0.0, min(100.0, y + ey / 100 * h if h else ey))
        if el.get("data-w"):
            w = min(w or 100.0, ew / 100 * (w or 100.0)) if ew is not None else w
        if el.get("data-h"):
            h = min(h or 100.0, eh / 100 * (h or 100.0)) if eh is not None else h

    if el.tag == "slot":
        slots.append(SlotRect(
            name=el.get("name", f"slot{len(slots) + 1}"),
            x=x, y=y, w=w, h=h,
            align=el.get("data-align", ""),
            role=el.get("data-role", ""),
            fit=el.get("data-fit", "cover"),
        ))
        return

    axis = _axis(el.tag, el.get("class", ""))
    children = [c for c in el if c.tag in ("div", "slot")]
    if not children:
        return

    # 分配：显式 data-h/w 优先用，其余按 grow 权重分剩余
    gap = _pct(el.get("data-gap"), 0.0) or 0.0
    total_gap = gap * (len(children) - 1)

    def child_fixed(c: ET.Element) -> float | None:
        if axis == "y":
            return _pct(c.get("data-h"))
        return None  # 主轴上仅 y 方向支持 data-h 百分比声明（横向分栏按 grow）

    fixed = {i: child_fixed(c) for i, c in enumerate(children)}
    fixed_sum = sum(v for v in fixed.values() if v is not None) or 0.0
    grows = [max(0.0, _pct(c.get("data-grow"), 1.0) or 1.0) for c in children]
    grow_total = sum(grows) or 1.0
    flexible = max(0.0, (100.0 - total_gap - fixed_sum) if axis == "y" else (100.0 - total_gap))

    cursor = 0.0
    for i, c in enumerate(children):
        size = fixed[i] if fixed[i] is not None else flexible * grows[i] / grow_total
        if axis == "y":
            _solve(c, x, y + cursor / 100 * h, w, size / 100 * h, slots)
        else:
            # 横向：row 内子元素按 grow 均分宽
            cw = flexible * grows[i] / grow_total
            _solve(c, x + cursor / 100 * w, y, cw / 100 * w, h, slots)
        cursor += size + gap
