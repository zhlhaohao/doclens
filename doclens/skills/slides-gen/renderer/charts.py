"""图表：MD 表格 → 内联 SVG（bar / line / pie），零外部依赖。

输出是静态 SVG 字符串，直接嵌进 HTML —— 打印、截图、离线都可靠。
"""

from __future__ import annotations

import html
from dataclasses import dataclass

W, H = 1000, 520
PAD_L, PAD_R, PAD_T, PAD_B = 84, 40, 40, 74


@dataclass
class Table:
    header: list[str]
    rows: list[list[str]]


def parse_table(lines: list[str]) -> Table | None:
    rows = []
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if cells:
            rows.append(cells)
    if len(rows) < 2:
        return None
    return Table(header=rows[0], rows=rows[1:])


def _f(v: str) -> float:
    try:
        return float(v.replace(",", "").replace("%", "").strip())
    except (ValueError, AttributeError):
        return 0.0


def _esc(s: str) -> str:
    return html.escape(s, quote=True)


CHART_KINDS = ("bar", "line", "pie", "doughnut", "stacked")


def render_chart(kind: str, table: Table, series_colors: list[str],
                 text_color: str, muted: str, grid: str,
                 highlight: int = -1, unit: str = "",
                 number_format: str = "") -> str:
    """kind: bar | line | pie | doughnut | stacked。

    highlight  —— 要突出的类目序号（0 基，单系列柱/条与饼图生效）
    unit       —— 数值后缀（如 "%"），饼图标签带百分号
    number_format —— "0" | "0.0" | "#,##0" 形式的数字格式
    """
    ctx = dict(colors=series_colors, text=text_color, muted=muted, grid=grid,
               highlight=highlight, unit=unit, fmt=number_format)
    if kind in ("pie", "doughnut"):
        return _pie(table, series_colors, text_color, muted,
                    donut=(kind == "doughnut"), unit=unit)
    if kind == "line":
        return _line(table, series_colors, text_color, muted, grid,
                     highlight=highlight, unit=unit, fmt=number_format)
    return _bar(table, series_colors, text_color, muted, grid,
                stacked=(kind == "stacked"), highlight=highlight,
                unit=unit, fmt=number_format)


def fmt_num(v: float, pattern: str = "") -> str:
    """按 "0" / "0.0" / "#,##0" / "0%" 格式化。"""
    if not pattern:
        return f"{v:g}"
    decimals = 0
    if "." in pattern:
        decimals = len(pattern.split(".")[1].rstrip("%"))
    thousands = "," in pattern
    suffix = "%" if pattern.rstrip().endswith("%") else ""
    txt = f"{v:,.{decimals}f}" if thousands else f"{v:.{decimals}f}"
    return txt + suffix


def _series(table: Table) -> list[tuple[str, list[float]]]:
    """表头第 2 列起为数值列；第 1 列作类目。"""
    out = []
    for ci in range(1, len(table.header)):
        vals = [_f(r[ci]) if ci < len(r) else 0.0 for r in table.rows]
        out.append((table.header[ci] or f"series{ci}", vals))
    return out


def _cats(table: Table) -> list[str]:
    return [r[0] if r else "" for r in table.rows]


def _nice_max(v: float) -> float:
    if v <= 0:
        return 1.0
    import math
    mag = 10 ** math.floor(math.log10(v))
    for m in (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10):
        if v <= mag * m:
            return mag * m
    return mag * 10


def _legend(names: list[str], colors: list[str], y: int) -> str:
    parts = []
    x = PAD_L
    for i, name in enumerate(names):
        c = colors[i % len(colors)]
        parts.append(
            f'<rect x="{x}" y="{y - 10}" width="14" height="14" rx="3" fill="{c}"/>'
            f'<text class="axis-text" x="{x + 20}" y="{y + 2}" fill="{_hextext()}">{_esc(name)}</text>'
        )
        x += 28 + len(name) * 13
    return "".join(parts)


def _hextext() -> str:
    return "currentColor"


def _bar(table: Table, colors: list[str], text: str, muted: str, grid: str,
         stacked: bool = False, highlight: int = -1, unit: str = "",
         fmt: str = "") -> str:
    cats = _cats(table)
    series = _series(table)
    if not series:
        return _empty()
    vmax = _nice_max(max(max(s[1]) for s in series))
    plot_w = W - PAD_L - PAD_R
    plot_h = H - PAD_T - PAD_B
    group_w = plot_w / max(1, len(cats))
    bar_w = min(56, (group_w * 0.66) / max(1, len(series)))

    g = [f'<svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img">']
    # 网格线与 y 轴刻度
    for i in range(5):
        val = vmax * i / 4
        y = PAD_T + plot_h - plot_h * i / 4
        g.append(f'<line x1="{PAD_L}" y1="{y:.1f}" x2="{W - PAD_R}" y2="{y:.1f}" stroke="{grid}" stroke-width="1"/>')
        g.append(f'<text class="axis-text" x="{PAD_L - 12}" y="{y + 4:.1f}" text-anchor="end">{val:g}</text>')
    # 柱（stacked 时同组累加；highlight 类目用 accent 强调）
    for gi, cat in enumerate(cats):
        gx = PAD_L + group_w * gi + group_w / 2
        if stacked:
            total = bar_w
            acc = 0.0
            for si, (name, vals) in enumerate(series):
                v = vals[gi] if gi < len(vals) else 0.0
                h = plot_h * (v / vmax) if vmax else 0
                x = gx - total / 2
                y = PAD_T + plot_h - h - plot_h * (acc / vmax if vmax else 0)
                c = colors[si % len(colors)]
                g.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{total * 0.86:.1f}" '
                         f'height="{h:.1f}" fill="{c}"/>')
                acc += v
            top = PAD_T + plot_h - plot_h * (acc / vmax if vmax else 0)
            if acc:
                g.append(f'<text class="value-text" x="{gx:.1f}" y="{top - 8:.1f}" '
                         f'text-anchor="middle">{fmt_num(acc, fmt)}{unit}</text>')
        else:
            total = bar_w * len(series)
            for si, (name, vals) in enumerate(series):
                v = vals[gi] if gi < len(vals) else 0.0
                h = plot_h * (v / vmax) if vmax else 0
                x = gx - total / 2 + si * bar_w
                y = PAD_T + plot_h - h
                c = colors[si % len(colors)]
                if highlight == gi:
                    c = colors[(si + 1) % len(colors)]
                g.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w * 0.86:.1f}" '
                         f'height="{h:.1f}" rx="4" fill="{c}"'
                         + (' opacity="0.45"' if highlight >= 0 and highlight != gi else '')
                         + '/>')
                if v:
                    g.append(f'<text class="value-text" x="{x + bar_w * 0.43:.1f}" y="{y - 8:.1f}" '
                             f'text-anchor="middle">{fmt_num(v, fmt)}{unit}</text>')
        g.append(f'<text class="axis-text" x="{gx:.1f}" y="{H - PAD_B + 26}" text-anchor="middle">{_esc(cat)}</text>')
    g.append(_legend([s[0] for s in series], colors, PAD_T - 22))
    g.append("</svg>")
    return "".join(g)


def _line(table: Table, colors: list[str], text: str, muted: str, grid: str,
          highlight: int = -1, unit: str = "", fmt: str = "") -> str:
    cats = _cats(table)
    series = _series(table)
    if not series:
        return _empty()
    vmax = _nice_max(max(max(s[1]) for s in series))
    plot_w = W - PAD_L - PAD_R
    plot_h = H - PAD_T - PAD_B
    step = plot_w / max(1, len(cats) - 1) if len(cats) > 1 else plot_w

    g = [f'<svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img">']
    for i in range(5):
        val = vmax * i / 4
        y = PAD_T + plot_h - plot_h * i / 4
        g.append(f'<line x1="{PAD_L}" y1="{y:.1f}" x2="{W - PAD_R}" y2="{y:.1f}" stroke="{grid}" stroke-width="1"/>')
        g.append(f'<text class="axis-text" x="{PAD_L - 12}" y="{y + 4:.1f}" text-anchor="end">{val:g}</text>')
    for si, (name, vals) in enumerate(series):
        pts = []
        for i, v in enumerate(vals):
            x = PAD_L + step * i
            y = PAD_T + plot_h - plot_h * (v / vmax if vmax else 0)
            pts.append((x, y, v))
        c = colors[si % len(colors)]
        path = " ".join(f"{'M' if i == 0 else 'L'}{x:.1f},{y:.1f}" for i, (x, y, _) in enumerate(pts))
        g.append(f'<path d="{path}" fill="none" stroke="{c}" stroke-width="3.5" '
                 f'stroke-linejoin="round" stroke-linecap="round"/>')
        for idx, (x, y, v) in enumerate(pts):
            # 多系列只在末点标数（避免数字挤在一起）；单系列全标
            show_val = (len(series) == 1) or (idx == len(pts) - 1)
            r = 7 if highlight == idx else 6
            g.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="#fff" '
                     f'stroke="{c}" stroke-width="3"/>')
            if show_val and v:
                g.append(f'<text class="value-text" x="{x:.1f}" y="{y - 14:.1f}" '
                         f'text-anchor="middle">{fmt_num(v, fmt)}{unit}</text>')
    for i, cat in enumerate(cats):
        g.append(f'<text class="axis-text" x="{PAD_L + step * i:.1f}" y="{H - PAD_B + 26}" '
                 f'text-anchor="middle">{_esc(cat)}</text>')
    g.append(_legend([s[0] for s in series], colors, PAD_T - 22))
    g.append("</svg>")
    return "".join(g)


def _pie(table: Table, colors: list[str], text: str, muted: str,
         donut: bool = False, unit: str = "") -> str:
    import math
    rows = table.rows
    vals = [_f(r[1]) if len(r) > 1 else 0 for r in rows]
    total = sum(vals) or 1.0
    cx, cy, r = W / 2 - 80, H / 2 + 6, min(H - 90, 210)
    g = [f'<svg viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid meet" role="img">']
    a0 = -math.pi / 2
    for i, (row, v) in enumerate(zip(rows, vals)):
        frac = v / total
        a1 = a0 + frac * 2 * math.pi
        large = 1 if frac > 0.5 else 0
        x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
        x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
        c = colors[i % len(colors)]
        if donut:
            ri = r * 0.58
            xi0, yi0 = cx + ri * math.cos(a0), cy + ri * math.sin(a0)
            xi1, yi1 = cx + ri * math.cos(a1), cy + ri * math.sin(a1)
            g.append(f'<path d="M{x0:.1f},{y0:.1f} A{r},{r} 0 {large} 1 {x1:.1f},{y1:.1f} '
                     f'L{xi1:.1f},{yi1:.1f} A{ri},{ri} 0 {large} 0 {xi0:.1f},{yi0:.1f} Z" '
                     f'fill="{c}" stroke="#fff" stroke-width="2"/>')
        else:
            g.append(f'<path d="M{cx},{cy} L{x0:.1f},{y0:.1f} A{r},{r} 0 {large} 1 {x1:.1f},{y1:.1f} Z" '
                     f'fill="{c}" stroke="#fff" stroke-width="3"/>')
        # 外部标注
        am = (a0 + a1) / 2
        lx, ly = cx + (r + 34) * math.cos(am), cy + (r + 34) * math.sin(am)
        anchor = "start" if math.cos(am) >= 0 else "end"
        label = row[0] if row else ""
        pct = f'{frac * 100:.0f}%' if unit in ("%", "") else f'{frac * 100:.0f}%'
        g.append(f'<text class="value-text" x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}">'
                 f'{_esc(label)} {pct}</text>')
        a0 = a1
    if donut:
        total = sum(vals)
        g.append(f'<text x="{cx}" y="{cy - 4}" text-anchor="middle" '
                 f'style="font-size:30px;font-weight:700;fill:currentColor">{total:g}</text>')
        g.append(f'<text x="{cx}" y="{cy + 22}" text-anchor="middle" '
                 f'class="axis-text">合计</text>')
    g.append("</svg>")
    return "".join(g)


def _empty() -> str:
    return '<div class="img-missing">图表数据不足（需要表头 + 至少一行数据）</div>'
