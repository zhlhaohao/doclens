"""HTML 渲染器：中间格式 md → 单文件自包含 HTML deck。

产物语义：
- 单文件（CSS/JS 内联，图片默认 base64 内嵌）—— 双击即看、可直接转发
- 演示运行时支持点击翻页 / 动画 / 备注 / 全屏 / 打印导出 PDF
- 每页内容走 CSS 流式布局，天然不会出现文本框重叠
"""

from __future__ import annotations

import base64
import html
import mimetypes
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import charts
from . import icons as iconlib
from . import shapes
from .layouts import DEFAULT_LAYOUT, Layout, fill, load_all
from .parser import Block, Deck, Run, Slide, parse_inline, parse_markdown
from .theme import DEFAULT_THEME, Theme, load_theme

SKILL_DIR = Path(__file__).resolve().parent.parent
ASSET_DIR = SKILL_DIR / "assets"
LAYOUT_DIR = SKILL_DIR / "layouts"
THEME_DIR = SKILL_DIR / "themes"

CANVAS = {"16:9": (1280, 720), "4:3": (960, 720), "a4": (794, 1123)}

_ANIM_TOKENS = {
    "enter.appear", "enter.fade", "enter.fly-in", "enter.zoom", "enter.wipe",
    "exit.fade", "exit.fly-out",
    "emphasize.pulse", "emphasize.grow",
}
_DIRS = {"left", "right", "up", "down"}


_BAD_ICONS: set[str] = set()


def warn_icon(name: str) -> None:
    _BAD_ICONS.add(name)


def bad_icons() -> list[str]:
    return sorted(_BAD_ICONS)


@dataclass
class Warnings:
    items: list[str] = field(default_factory=list)

    def add(self, msg: str) -> None:
        self.items.append(msg)


# ---------------------------------------------------------------------------
# 行内
# ---------------------------------------------------------------------------

def _esc(s: str) -> str:
    return html.escape(s, quote=False)


_SRC_PREFIXES = ("来源", "数据来源", "资料来源", "Source", "source")


def _has_source_prefix(text: str) -> bool:
    t = text.strip()
    return any(t.startswith(p) for p in _SRC_PREFIXES)


def runs_html(runs: list[Run], theme: Theme, mark_highlight: bool = True) -> str:
    out: list[str] = []
    for r in runs:
        if r.icon:
            if r.icon in iconlib.ICONS:
                out.append(f'<span class="ico">{iconlib.svg(r.icon)}</span>')
            else:
                warn_icon(r.icon)
            continue
        if r.text == "\n":
            out.append("<br>")
            continue
        t = _esc(r.text)
        if r.code:
            t = f"<code>{t}</code>"
        if r.bold:
            t = f"<strong>{t}</strong>"
        if r.italic:
            t = f"<em>{t}</em>"
        if r.strike:
            t = f"<del>{t}</del>"
        if r.link:
            t = f'<a href="{html.escape(r.link, quote=True)}">{t}</a>'
        if r.mark and mark_highlight:
            t = f"<mark>{t}</mark>"
        elif r.color_role:
            c = theme.color(r.color_role)
            t = f'<span style="color:{c}">{t}</span>'
        out.append(t)
    return "".join(out)


# ---------------------------------------------------------------------------
# 块
# ---------------------------------------------------------------------------

def _attrs(block: Block, page_anim: str, theme: Theme, page_level: bool) -> tuple[str, str]:
    """返回 (需要挂到元素上的属性串, 该块解析出的动画词)。"""
    d = block.directive
    parts: list[str] = []
    style: list[str] = []

    align = d.get("align", "")
    if align in ("left", "center", "right"):
        style.append(f"text-align:{align}")

    color = d.get("color", "")
    if color:
        style.append(f"color:{theme.color(color)}")

    # bg=主题角色名：该块文字的不透明背景（全屏图上覆盖文字的可读性保障）
    bg = d.get("bg", "")
    if bg:
        style.append(f"background:{theme.color(bg)}")
        style.append("padding:.35em .7em")
        style.append("border-radius:8px")
        style.append("width:fit-content")

    token, direction, trigger, delay = _resolve_anim(d, page_anim, block, page_level)
    if token:
        parts.append(f'data-anim="{token}"')
        if direction in _DIRS:
            parts.append(f'data-anim-dir="{direction}"')
        if trigger == "click":
            parts.append('data-anim-trigger="click"')
        if delay > 0:
            parts.append(f'data-anim-delay="{delay}"')

    if style:
        parts.append(f'style="{";".join(style)}"')
    return " ".join(parts), token


def _resolve_anim(d: dict, page_anim: str, block: Block,
                  page_level: bool) -> tuple[str, str, str, float]:
    raw = d.get("anim", "")
    direction = d.get("direction", "")
    trigger = d.get("trigger", "after")
    delay = 0.0
    try:
        delay = max(0.0, float(d.get("delay", 0) or 0))
    except (TypeError, ValueError):
        delay = 0.0
    if raw:
        return raw, direction, trigger, delay
    if not page_anim or page_anim == "none":
        return "", direction, trigger, delay
    if ":" in page_anim:
        policy, token = page_anim.split(":", 1)
        if policy == "bullets":
            return (token, direction, trigger, delay) if block.kind == "list" else ("", direction, trigger, delay)
        return token, direction, trigger, delay
    return page_anim, direction, trigger, delay


def _list_html(b: Block, theme: Theme, page_anim: str, page_level: bool) -> str:
    """列表：bullets 策略时给每个 li 挂动画（逐条出现）。"""
    bullet_token = ""
    if page_anim and ":" in page_anim and page_anim.split(":", 1)[0] == "bullets":
        bullet_token = page_anim.split(":", 1)[1]
    if b.directive.get("anim"):
        bullet_token = b.directive["anim"]
    direction = b.directive.get("direction", "")
    trigger = b.directive.get("trigger", "after")

    items = b.list_items
    ordered = any(o for _, _, o in items)
    tag = "ol" if ordered else "ul"
    out: list[str] = [f"<{tag}>"]
    li_i = 0
    for depth, runs, _o in items:
        indent = "  " * depth
        attrs = ""
        if bullet_token:
            attrs = f' data-anim="{bullet_token}"'
            if direction in _DIRS:
                attrs += f' data-anim-dir="{direction}"'
            if trigger == "click":
                attrs += ' data-anim-trigger="click"'
        out.append(f"{indent}<li{attrs}>{runs_html(runs, theme)}</li>")
        li_i += 1
    out.append(f"</{tag}>")
    return "\n".join(out)


def _table_html(b: Block, theme: Theme, warn: Warnings) -> str:
    t = charts.parse_table(b.lines)
    if t is None:
        warn.add("表格行数不足，跳过")
        return ""
    head = "".join(f"<th>{_esc(c)}</th>" for c in t.header)
    body = []
    for row in t.rows:
        cells = "".join(
            f"<td>{runs_html(parse_inline(c), theme)}</td>"
            for c in row
        )
        body.append(f"<tr>{cells}</tr>")
    return f"<table><thead><tr>{head}</tr></thead><tbody>{''.join(body)}</tbody></table>"


def _schema_attrs(b: Block, page_anim: str, page_level: bool) -> str:
    d = b.directive
    parts = []
    align = d.get("align", "")
    if align in ("left", "center", "right"):
        parts.append(f'style="text-align:{align}"')
    token, direction, trigger, delay = _resolve_anim(d, page_anim, b, page_level)
    if token:
        parts.append(f'data-anim="{token}"')
        if direction in _DIRS:
            parts.append(f'data-anim-dir="{direction}"')
        if trigger == "click":
            parts.append('data-anim-trigger="click"')
        if delay > 0:
            parts.append(f'data-anim-delay="{delay}"')
    return (" " + " ".join(parts)) if parts else ""


class Renderer:
    def __init__(self, layout_dir: Path = LAYOUT_DIR, theme_dir: Path = THEME_DIR,
                 strict: bool = False) -> None:
        self.layout_dir = Path(layout_dir)
        self.theme_dir = Path(theme_dir)
        self.strict = strict
        self.warn = Warnings()
        self.layouts: dict[str, Layout] = {}
        self.theme: Theme | None = None
        self.md_dir = Path(".")
        self.meta: dict[str, Any] = {}
        self.slide_count = 0
        self.embed_images = True
        self._draft = False

    # ------------------------------------------------------------------ 主流程

    def render(self, md_path: Path, out_path: Path, *,
               theme_override: str = "", embed_images: bool = True,
               draft: bool = False) -> dict[str, Any]:
        text = md_path.read_text(encoding="utf-8")
        self.md_dir = md_path.parent
        self.embed_images = embed_images
        deck = parse_markdown(text, _WarnAdapter(self.warn))
        self.meta = deck.meta

        self.layouts = load_all(self.layout_dir, self.warn.add)
        theme_name = theme_override or str(deck.meta.get("theme", DEFAULT_THEME))
        self.theme = load_theme(theme_name, self.theme_dir, self.warn.add)
        fo = deck.meta.get("font") or {}
        if isinstance(fo, dict):
            for k in ("family", "mono"):
                if fo.get(k):
                    self.theme.fonts[k] = str(fo[k])

        size_key = str(deck.meta.get("size", "16:9")).lower()
        if size_key not in CANVAS:
            self.warn.add(f"未知尺寸 {size_key}，回退 16:9")
            size_key = "16:9"
        cw, ch = CANVAS[size_key]

        slides_html: list[str] = []
        for i, slide in enumerate(deck.slides, 1):
            slides_html.append(self._slide_html(slide, i))
        self.slide_count = len(deck.slides)
        self._draft = draft

        doc = self._document(slides_html, cw, ch)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(doc, encoding="utf-8")
        for bad in bad_icons():
            self.warn.add(f"未知图标名 {bad}（已忽略）；可用图标见 assets/icons.json")
        _BAD_ICONS.clear()
        return {
            "slides": len(deck.slides),
            "bytes": out_path.stat().st_size,
            "theme": theme_name,
            "canvas": f"{cw}x{ch}",
            "warnings": list(self.warn.items),
        }

    # ------------------------------------------------------------------ 单页

    def _slide_html(self, slide: Slide, idx: int) -> str:
        theme = self.theme
        assert theme is not None
        d = slide.directive
        layout_name = d.get("layout", DEFAULT_LAYOUT)
        layout = self.layouts.get(layout_name)
        if layout is None:
            self.warn.add(f"未知版式 {layout_name}，降级 {DEFAULT_LAYOUT}")
            layout_name = DEFAULT_LAYOUT
            layout = self.layouts.get(layout_name)
        if layout is None:  # 资产全丢时的最后兜底
            layout = Layout(layout_name, '<div class="slide-inner">{{content}}</div>', "")

        page_anim = d.get("anim", "") or str(self.meta.get("anim", ""))
        transition = d.get("transition", "") or str(self.meta.get("transition", ""))

        blocks = list(slide.blocks)
        slots = self._arrange(layout_name, blocks, page_anim, d)

        bg = d.get("bg", "")
        style = ""
        if bg:
            style = f' style="background:{theme.color(bg, "bg-alt")}"'

        trans_attr = f' data-transition="{transition}"' if transition and transition != "none" else ""
        notes = f'\n  <aside class="notes">{html.escape(slide.notes)}</aside>' if slide.notes else ""

        # 四个语义槽位（页面固定位置，与版式无关）
        kicker = _esc(str(d.get("kicker", ""))).strip()
        takeaway = str(d.get("takeaway", "")).strip()
        source = str(d.get("source", "")).strip()
        footnote = str(d.get("footnote", "")).strip()

        src_text = ""
        if source:
            prefix = "" if _has_source_prefix(source) else "来源："
            src_text = f"{prefix}{_esc(source)}"

        chrome: list[str] = []
        if kicker:
            chrome.append(f'    <div class="kicker">{kicker}</div>')
        if takeaway:
            # takeaway 允许 **加粗**；source 作为胶囊右侧灰色小字（不另占一行）
            src_span = f'<span class="tk-src">{src_text}</span>' if src_text else ""
            chrome.append('    <div class="takeaway"><span class="tk-body">'
                          '<span class="tk-icon">◆</span>'
                          + runs_html(parse_inline(takeaway), theme)
                          + f"</span>{src_span}</div>")
        elif src_text or footnote:
            bits = [f'<span class="src">{src_text}</span>'] if src_text else []
            if footnote:
                bits.append(f'<span class="fnote">{_esc(footnote)}</span>')
            chrome.append('    <div class="foot-meta">' + " · ".join(bits) + "</div>")
        elif footnote:
            chrome.append(f'    <div class="foot-meta"><span class="fnote">{_esc(footnote)}</span></div>')
        if source and footnote and takeaway:
            # 胶囊已占用底行，脚注单独放其下方一行
            chrome.append(f'    <div class="foot-meta footmeta-below"><span class="fnote">{_esc(footnote)}</span></div>')

        chrome_html = ("\n" + "\n".join(chrome)) if chrome else ""
        mods = []
        if kicker:
            mods.append("has-kicker")
        if takeaway:
            mods.append("has-takeaway")
        if source or footnote:
            mods.append("has-footmeta")
        mod_attr = (" " + " ".join(mods)) if mods else ""

        return f"""  <section class="slide layout-{layout_name}{mod_attr}" data-index="{idx}"{trans_attr}{style}>
{fill(layout, slots)}{chrome_html}
    <div class="pageno"></div>{notes}
  </section>"""

    def _arrange(self, layout_name: str, blocks: list[Block],
                 page_anim: str, d: dict | None = None) -> dict[str, str]:
        theme = self.theme
        assert theme is not None
        d = d or {}
        title_b = next((b for b in blocks if b.kind == "heading" and b.level == 1), None)

        # 自由画布：绝对定位。块指令的作用域延续到下一个带坐标的块指令——
        # 一个坐标块内可放多个段落/列表/图片，符合「画框里排版」的直觉。
        if layout_name == "blank":
            parts: list[str] = []
            state = {"pos": "", "acc": []}

            def flush() -> None:
                if state["acc"]:
                    if state["pos"]:
                        parts.append(f'    <div class="abs-block"{state["pos"]}>'
                                     + "".join(state["acc"]) + "</div>")
                    else:
                        self.warn.add("blank 版式存在未指定坐标的块，已放到默认整页位置")
                        parts.append('    <div class="abs-block" '
                                     'style="left:6%;top:6%;width:88%;height:86%">'
                                     + "".join(state["acc"]) + "</div>")
                state["acc"] = []

            for b in blocks:
                if b.kind == "hr":
                    continue
                dd = b.directive
                coords = [dd.get(k, "") for k in ("x", "y", "w", "h")]
                if all(coords):
                    flush()
                    state["pos"] = (f' style="left:{coords[0]};top:{coords[1]};'
                                    f'width:{coords[2]};height:{coords[3]}"')
                state["acc"].append(self._block_html(b, page_anim, page_level=True))
            flush()
            return {"content": "\n".join(parts)}

        # 引述页：末尾段落作署名
        if layout_name == "quote":
            body = blocks
            title = ""
            if title_b is not None:
                title = self._heading_html(title_b, page_anim, is_title=True)
                body = [b for b in blocks if b is not title_b]
            elif len(blocks) >= 2 and blocks[-1].kind == "para":
                title = "<p>" + runs_html(blocks[-1].runs, theme) + "</p>"
                body = blocks[:-1]
            return {"title": title,
                    "content": self._blocks_html(body, page_anim)}

        # 图文版式：首图进 image slot
        if layout_name in ("image-left", "image-right"):
            img = next((b for b in blocks if b.kind == "image"), None)
            body = [b for b in blocks if b is not title_b and b is not img]
            return {
                "title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                "image": self._image_html(img, page_anim, in_slot=True) if img else "",
                "content": self._blocks_html(body, page_anim),
            }

        # 双栏：首个 hr 切分
        if layout_name == "two-col":
            body = [b for b in blocks if b is not title_b]
            split = next((i for i, b in enumerate(body) if b.kind == "hr"), None)
            if split is None:
                left, right = body, []
            else:
                left, right = body[:split], body[split + 1:]
            return {
                "title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                "left": self._blocks_html(left, page_anim),
                "right": self._blocks_html(right, page_anim),
            }

        # ---- stats：表格 → 数据卡 ----
        if layout_name == "stats":
            tbl = next((b for b in blocks if b.kind == "table"), None)
            cards = shapes.stats_cards(shapes.cells_of(tbl)) if tbl else []
            if not cards:
                items = shapes.list_items_of(
                    next((b for b in blocks if b.kind == "list"), None) or Block(kind="x"))
                cards = [{"value": "", "label": it} for it in items]
            if not cards:
                self.warn.add("stats 版式需要 2 列表格（值 | 标签）或列表，已降级为普通内容")
                return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                        "content": self._blocks_html([b for b in blocks if b is not title_b], page_anim)}
            body = [b for b in blocks if b is not title_b and b is not tbl]
            html_cards = []
            for c in cards[:4]:          # 超过 4 个挤不下，多的进正文
                val = runs_html(parse_inline(c["value"]), theme) if c["value"] else ""
                lab = runs_html(parse_inline(c["label"]), theme) if c["label"] else ""
                html_cards.append(f'<div class="stat-card">'
                                  f'<div class="stat-value">{val}</div>'
                                  f'<div class="stat-label">{lab}</div></div>')
            if len(cards) > 4:
                self.warn.add(f"stats 版式最多放 4 个数据卡（当前 {len(cards)} 个），多余已移入正文")
                body += [Block(kind="para", runs=[]) ]
            return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                    "content": "\n".join(html_cards) + (
                        ("\n" + self._blocks_html(body, page_anim)) if body else "")}

        # ---- timeline：表格/列表 → 时间线 ----
        if layout_name == "timeline":
            tbl = next((b for b in blocks if b.kind == "table"), None)
            lst = next((b for b in blocks if b.kind == "list"), None)
            nodes = shapes.timeline_nodes(
                shapes.cells_of(tbl) if tbl else [],
                shapes.list_items_of(lst) if lst else [])
            if not nodes:
                self.warn.add("timeline 版式需要表格（日期|事件|说明）或列表，已降级")
                return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                        "content": self._blocks_html([b for b in blocks if b is not title_b], page_anim)}
            html_nodes = []
            for n in nodes[:6]:
                date = runs_html(parse_inline(n["date"]), theme) if n["date"] else ""
                title = runs_html(parse_inline(n["title"]), theme) if n["title"] else ""
                text = runs_html(parse_inline(n["text"]), theme) if n["text"] else ""
                html_nodes.append(
                    f'<div class="tl-node"><div class="tl-dot"></div>'
                    f'<div class="tl-date">{date}</div>'
                    f'<div class="tl-body"><div class="tl-title">{title}</div>'
                    + (f'<div class="tl-text">{text}</div>' if text else "")
                    + '</div></div>')
            if len(nodes) > 6:
                self.warn.add(f"timeline 最多 6 个节点（当前 {len(nodes)}），多余已截断——建议拆页")
            return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                    "content": '<div class="tl-track">' + "".join(html_nodes) + "</div>"}

        # ---- matrix：3×3 表格 → 四象限 ----
        if layout_name == "matrix":
            tbl = next((b for b in blocks if b.kind == "table"), None)
            mx = shapes.matrix_quadrants(shapes.cells_of(tbl)) if tbl else {}
            if not mx:
                self.warn.add("matrix 版式需要 3×3 表格（首行首列为轴标签），已降级")
                return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                        "content": self._blocks_html([b for b in blocks if b is not title_b], page_anim)}
            # 页指令可覆盖轴名
            xl = [str(d.get("x_low", "")), str(d.get("x_high", ""))] if (d.get("x_low") or d.get("x_high")) else mx["x_axis"]
            yl = [str(d.get("y_high", "")), str(d.get("y_low", ""))] if (d.get("y_high") or d.get("y_low")) else mx["y_axis"]
            xlab = str(d.get("x_axis", "")).strip()
            ylab = str(d.get("y_axis", "")).strip()
            cells = []
            cells.append('<div class="mx-corner"></div>')
            cells.append(f'<div class="mx-xaxis">{_esc(xl[0])}</div>')
            cells.append(f'<div class="mx-xaxis">{_esc(xl[1])}</div>')
            for ri in (0, 1):
                ylabel = yl[ri] if ri < len(yl) else ""
                cells.append(f'<div class="mx-yaxis">{_esc(ylabel)}</div>')
                for ci in (0, 1):
                    qd = mx["quads"][ri * 2 + ci]
                    cls = "q-tl" if (ri == 0 and ci == 0) else ""
                    txt = runs_html(parse_inline(qd["text"]), theme) if qd["text"] else ""
                    cells.append(f'<div class="mx-quad {cls}">'
                                 f'<div class="mx-quad-name">{_esc(qd["name"])}</div>'
                                 f'<div class="mx-quad-text">{txt}</div></div>')
            hint = ""
            if xlab or ylab:
                hint = f'<div class="mx-hint">{_esc(ylab)} ↑ / {_esc(xlab)} →</div>'
            return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                    "content": '<div class="mx-grid">' + "".join(cells) + "</div>" + hint}

        # ---- compare：hr 切两栏 + 各自小标题 ----
        if layout_name == "compare":
            body = [b for b in blocks if b is not title_b]
            left, right = shapes.compare_sides(body)
            vs = str(d.get("vs_label", "VS")).strip()

            def side_html(pack: dict, extra_cls: str = "") -> str:
                t = (f'<div class="cp-side-title">{runs_html(parse_inline(pack["title"]), theme)}</div>'
                     if pack["title"] else "")
                return f'<div class="cp-side{extra_cls}">{t}{self._blocks_html(pack["blocks"], page_anim)}</div>'

            return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                    "left": side_html(left),
                    "right": side_html(right, " cp-right"),
                    "vs": f'<span>{_esc(vs)}</span>' if vs else ""}

        # ---- big-number：页指令 number= 或正文首行 ----
        if layout_name == "big-number":
            num, rest = shapes.big_number(d, [b for b in blocks if b is not title_b])
            if not num:
                self.warn.add("big-number 版式建议用 number=\"73 万\" 指定大数字，已用标题代替")
            title_txt = ""
            lines = ""
            body_blocks: list[Block] = rest
            if rest and rest[0].kind == "heading":
                lines = runs_html(rest[0].runs, theme)
                body_blocks = rest[1:]
            elif rest and rest[0].kind == "para":
                lines = runs_html(rest[0].runs, theme)
                body_blocks = rest[1:]
            title_txt = (runs_html(title_b.runs, theme) if title_b else "")
            parts = []
            if num:
                parts.append(f'<div class="bn-number">{runs_html(parse_inline(num), theme)}</div>')
            if title_txt:
                parts.append(f'<div class="bn-lines">{title_txt}</div>')
            if lines:
                parts.append(f'<div class="bn-title">{lines}</div>')
            if body_blocks:
                parts.append(f'<div class="bn-body">{self._blocks_html(body_blocks, page_anim)}</div>')
            return {"content": "\n".join(parts)}

        # ---- 图表 + insights：表格(chart=) 后紧跟的列表作为右侧结论 ----
        chart_i = next((i for i, b in enumerate(blocks)
                        if b.kind == "table" and b.directive.get("chart")), None)
        if chart_i is not None and chart_i + 1 < len(blocks) \
                and blocks[chart_i + 1].kind == "list":
            tbl, ins = blocks[chart_i], blocks[chart_i + 1]
            rest = [b for b in blocks if b is not title_b and b is not tbl and b is not ins]
            charth = self._block_html(tbl, page_anim)
            ins_items = shapes.list_items_of(ins)
            ins_html = "".join(
                f'<li>{runs_html(parse_inline(it), theme)}</li>' for it in ins_items[:4])
            return {
                "title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                "content": ('<div class="chart-insights">'
                            f'<div class="ci-chart">{charth}</div>'
                            f'<div class="ci-side"><div class="ci-h">关键结论</div>'
                            f'<ul class="ci-list">{ins_html}</ul></div>'
                            '</div>'
                            + (self._blocks_html(rest, page_anim) if rest else "")),
            }

        # ---- grid：表格/列表 → 卡片网格 ----
        if layout_name == "grid":
            tbl = next((b for b in blocks if b.kind == "table"), None)
            lst = next((b for b in blocks if b.kind == "list"), None)
            cards = shapes.grid_cards(shapes.cells_of(tbl) if tbl else [],
                                      shapes.list_items_of(lst) if lst else [])
            if not cards:
                self.warn.add("grid 版式需要 2 列表格（标题|说明）或列表，已降级")
                return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                        "content": self._blocks_html([b for b in blocks if b is not title_b], page_anim)}
            if len(cards) > 4:
                # 5-6 张改 2 列布局
                pass
            html_cards = []
            for i, c in enumerate(cards[:6], 1):
                html_cards.append(
                    f'<div class="gd-card">'
                    f'<div class="gd-num">{i:02d}</div>'
                    f'<div class="gd-head">{runs_html(parse_inline(c["head"]), theme)}</div>'
                    + (f'<div class="gd-desc">{runs_html(parse_inline(c["desc"]), theme)}</div>'
                       if c["desc"] else "")
                    + "</div>")
            style_cols = ' style="grid-template-columns:repeat(2,1fr)"' if len(cards) > 4 else ""
            return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                    "content": f'<div class="gd-grid"{style_cols}>' + "".join(html_cards) + "</div>"}

        # ---- agenda：表格/列表 → 目录 ----
        if layout_name == "agenda":
            tbl = next((b for b in blocks if b.kind == "table"), None)
            lst = next((b for b in blocks if b.kind == "list"), None)
            items = shapes.agenda_items(shapes.cells_of(tbl) if tbl else [],
                                        shapes.list_items_of(lst) if lst else [])
            if not items:
                self.warn.add("agenda 版式需要表格（章节|说明）或列表，已降级")
                return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                        "content": self._blocks_html([b for b in blocks if b is not title_b], page_anim)}
            html_items = []
            for i, it in enumerate(items[:7], 1):
                html_items.append(
                    f'<div class="ag-item"><span class="ag-num">{i:02d}</span>'
                    f'<span class="ag-name">{runs_html(parse_inline(it["name"]), theme)}</span>'
                    + (f'<span class="ag-note">{runs_html(parse_inline(it["note"]), theme)}</span>'
                       if it["note"] else "")
                    + "</div>")
            return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                    "content": '<div class="ag-list">' + "".join(html_items) + "</div>"}

        # ---- pyramid：表格 → 金字塔层 ----
        if layout_name == "pyramid":
            tbl = next((b for b in blocks if b.kind == "table"), None)
            levels = shapes.pyramid_levels(shapes.cells_of(tbl) if tbl else [])
            if not levels:
                self.warn.add("pyramid 版式需要 2 列表格（层名|说明），首行为顶层，已降级")
                return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                        "content": self._blocks_html([b for b in blocks if b is not title_b], page_anim)}
            if len(levels) > 4:
                self.warn.add(f"pyramid 最多 4 层（当前 {len(levels)}），超出已截断")
            html_levels = []
            for lv in levels[:4]:
                html_levels.append(
                    f'<div class="py-level"><span class="py-name">{_esc(lv["name"])}</span>'
                    + (f'<span class="py-desc">{runs_html(parse_inline(lv["desc"]), theme)}</span>'
                       if lv["desc"] else "")
                    + "</div>")
            return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                    "content": '<div class="py-wrap">' + "".join(html_levels) + "</div>"}

        # ---- funnel：表格 → 漏斗 ----
        if layout_name == "funnel":
            tbl = next((b for b in blocks if b.kind == "table"), None)
            stages = shapes.funnel_stages(shapes.cells_of(tbl) if tbl else [])
            if not stages:
                self.warn.add("funnel 版式需要 2 列表格（阶段|数值），首行为入口，已降级")
                return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                        "content": self._blocks_html([b for b in blocks if b is not title_b], page_anim)}
            try:
                vmax = max(float(st["value"].replace(",", "").rstrip("%")) for st in stages) or 1.0
            except ValueError:
                vmax = 1.0
            html_stages = []
            for st in stages[:5]:
                try:
                    v = float(st["value"].replace(",", "").rstrip("%"))
                except ValueError:
                    v = 0.0
                w = max(34, min(92, v / vmax * 92))
                html_stages.append(
                    f'<div class="fn-stage" style="width:{w:.0f}%">'
                    f'<span><span class="fn-name">{_esc(st["name"])}</span> '
                    f'<span class="fn-value">{_esc(st["value"])}</span></span>'
                    + (f'<span class="fn-rate">↓ {st["rate"]}</span>' if st["rate"] else "")
                    + "</div>")
            return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                    "content": '<div class="fn-wrap">' + "".join(html_stages) + "</div>"}

        # ---- cycle：列表/表格 → 循环节点 ----
        if layout_name == "cycle":
            tbl = next((b for b in blocks if b.kind == "table"), None)
            lst = next((b for b in blocks if b.kind == "list"), None)
            nodes = shapes.cycle_nodes(shapes.cells_of(tbl) if tbl else [],
                                       shapes.list_items_of(lst) if lst else [])
            if len(nodes) < 2:
                self.warn.add("cycle 版式需要列表或表格（3-5 节点），已降级")
                return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                        "content": self._blocks_html([b for b in blocks if b is not title_b], page_anim)}
            html_nodes = []
            for i, nd in enumerate(nodes[:5], 1):
                if i > 1:
                    html_nodes.append('<span class="cy-arrow">→</span>')
                html_nodes.append(
                    f'<div class="cy-node"><span class="cy-step">{i}</span>'
                    f'<span class="cy-name">{runs_html(parse_inline(nd["name"]), theme)}</span>'
                    + (f'<span class="cy-desc">{runs_html(parse_inline(nd["desc"]), theme)}</span>'
                       if nd["desc"] else "")
                    + "</div>")
            return {"title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
                    "content": '<div class="cy-wrap"><div class="cy-flow">' + "".join(html_nodes)
                               + '<span class="cy-loopback">↻</span></div></div>'}

        # ---- closing：标题=决定请求，正文=下一步列表 ----
        if layout_name == "closing":
            body = [b for b in blocks if b is not title_b]
            ask = runs_html(title_b.runs, theme) if title_b else ""
            steps_html = self._blocks_html(body, page_anim)
            return {"title": ask, "content": steps_html}

        # 通用：标题 + 单栏
        body = [b for b in blocks if b is not title_b]
        return {
            "title": self._heading_html(title_b, page_anim, is_title=True) if title_b else "",
            "content": self._blocks_html(body, page_anim),
        }

    # ------------------------------------------------------------------ 块渲染

    def _blocks_html(self, blocks: list[Block], page_anim: str) -> str:
        return "\n".join(self._block_html(b, page_anim, page_level=True) for b in blocks)

    def _heading_html(self, b: Block | None, page_anim: str, is_title: bool) -> str:
        if b is None:
            return ""
        theme = self.theme
        assert theme is not None
        if is_title:
            attrs, _ = _attrs(b, page_anim, theme, page_level=True)
            return f"<h1{(' ' + attrs) if attrs else ''}>{runs_html(b.runs, theme)}</h1>"
        return self._block_html(b, page_anim, page_level=True)

    def _block_html(self, b: Block, page_anim: str, page_level: bool = True) -> str:
        theme = self.theme
        assert theme is not None
        attrs, _ = _attrs(b, page_anim, theme, page_level)

        if b.kind == "heading":
            lvl = min(max(b.level, 2), 4)
            return f"<h{lvl}{(' ' + attrs) if attrs else ''}>{runs_html(b.runs, theme)}</h{lvl}>"

        if b.kind == "para":
            return f"<p{(' ' + attrs) if attrs else ''}>{runs_html(b.runs, theme)}</p>"

        if b.kind == "list":
            n = len(b.list_items)
            chars = sum(len(r.text) for _, runs, _ in b.list_items for r in runs)
            if n > 8 or chars > 260:
                self.warn.add(
                    f"列表过长（{n} 条 / {chars} 字）建议拆页：单页要点控制在 6-8 条、"
                    f"每条 40 字内，否则会触发自动缩放导致字号偏小")
            return _list_html(b, theme, page_anim, page_level)

        if b.kind == "quote":
            inner = "".join(f"<p>{runs_html(parse_inline(line), theme)}</p>" for line in b.lines)
            return f"<blockquote{(' ' + attrs) if attrs else ''}>{inner}</blockquote>"

        if b.kind == "table":
            chart_type = b.directive.get("chart", "")
            if chart_type:
                t = charts.parse_table(b.lines)
                if t is None:
                    self.warn.add("chart 块数据不足，降级为表格")
                    return _table_html(b, theme, self.warn)
                if chart_type not in charts.CHART_KINDS:
                    self.warn.add(f"未知图表类型 {chart_type}，按 bar 处理；"
                                  f"可选 {'/'.join(charts.CHART_KINDS)}")
                    chart_type = "bar"
                try:
                    hl = int(b.directive.get("highlight", -1))
                except (TypeError, ValueError):
                    hl = -1
                    self.warn.add("highlight 需为类目序号（0 基整数），已忽略")
                svg = charts.render_chart(
                    chart_type, t, theme.series,
                    theme.color("text"), theme.color("text-muted"),
                    theme.color("border", "bg-alt"),
                    highlight=hl,
                    unit=str(b.directive.get("unit", "")),
                    number_format=str(b.directive.get("format", "")
                                      or b.directive.get("number_format", "")),
                )
                return f'<div class="chart"{(" " + attrs) if attrs else ""}>{svg}</div>'
            rows = len(b.lines)
            if rows > 9:
                self.warn.add(f"表格行数偏多（{rows} 行含表头）建议拆页或精简到 8 行内")
            return _table_html(b, theme, self.warn)

        if b.kind == "code":
            if b.lang == "mermaid":
                return self._mermaid_html(b, attrs)
            body = html.escape("\n".join(b.lines))
            return f'<pre{(" " + attrs) if attrs else ""}><code>{body}</code></pre>'

        if b.kind == "image":
            return self._image_html(b, page_anim)

        if b.kind == "hr":
            return "<hr>"
        return ""

    def _mermaid_html(self, b: Block, attrs: str) -> str:
        src = "\n".join(b.lines)
        png = _render_mermaid(src)
        if png is None:
            self.warn.add("mermaid 渲染不可用，降级为代码块")
            return f'<pre{(" " + attrs) if attrs else ""}><code>{html.escape(src)}</code></pre>'
        b64 = base64.b64encode(png).decode("ascii")
        return (f'<figure{(" " + attrs) if attrs else ""}>'
                f'<img src="data:image/png;base64,{b64}" alt="mermaid diagram"></figure>')

    def _image_html(self, b: Block | None, page_anim: str, in_slot: bool = False) -> str:
        if b is None:
            return ""
        theme = self.theme
        assert theme is not None
        attrs, _ = _attrs(b, page_anim, theme, page_level=True)
        fit = b.directive.get("fit", "cover")
        style_cls = b.directive.get("style", "")
        classes = " ".join(f"style-{s.strip()}" for s in style_cls.split(",") if s.strip())

        path = Path(b.image_path)
        if not path.is_absolute():
            path = (self.md_dir / path).resolve()
        if not path.exists():
            self.warn.add(f"图片缺失：{b.image_path}（渲染占位）")
            return (f'<div class="img-missing"{(" " + attrs) if attrs else ""}>'
                    f'缺图：{html.escape(b.alt or b.image_path)}</div>')

        src = _image_src(path, self.embed_images, self.md_dir)
        cls = f' class="{classes}"' if classes else ""
        return (f'<figure{cls}{(" " + attrs) if attrs else ""} '
                f'style="--fit:{fit}"><img src="{src}" alt="{html.escape(b.alt, quote=True)}"></figure>')

    def _plain(self, b: Block) -> str:
        if b.runs:
            return "".join(r.text for r in b.runs)
        return "\n".join(b.lines)

    # ------------------------------------------------------------------ 文档

    def _document(self, slides: list[str], cw: int, ch: int) -> str:
        theme = self.theme
        assert theme is not None
        base_css = (ASSET_DIR / "base.css").read_text(encoding="utf-8")
        presenter_js = (ASSET_DIR / "presenter.js").read_text(encoding="utf-8")
        layout_css = "\n\n".join(lay.css for lay in self.layouts.values() if lay.css)
        title = html.escape(str(self.meta.get("title", "")) or "")
        author = html.escape(str(self.meta.get("author", "")) or "")

        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title or "Slides"}</title>
<style>
:root {{
  --slide-w: {cw}px;
  --slide-h: {ch}px;
{theme.css_vars()}
}}
{base_css}
{layout_css}
</style>
</head>
<body class="{'draft' if getattr(self, '_draft', False) else ''}">
<div id="stage">
{chr(10).join(slides)}
</div>
<div class="progress"></div>
<div class="hint">← → 翻页 · N 备注 · F 全屏 · P 打印</div>
<div class="draft-badge">内容稿 · 未做最终验收</div>
<script>
{presenter_js}
</script>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# 辅助
# ---------------------------------------------------------------------------

class _WarnAdapter:
    """parser 的 Warnings 接口适配（parser 期望 .add）。"""

    def __init__(self, w: Warnings) -> None:
        self._w = w

    def add(self, msg: str) -> None:
        self._w.add(msg)


def _image_src(path: Path, embed: bool, md_dir: Path) -> str:
    if not embed:
        try:
            rel = path.relative_to(md_dir)
            return rel.as_posix()
        except ValueError:
            return path.as_uri()
    mime = mimetypes.guess_type(path.name)[0] or "image/png"
    data = path.read_bytes()
    return f"data:{mime};base64," + base64.b64encode(data).decode("ascii")


def _render_mermaid(src: str) -> bytes | None:
    mmdc = shutil.which("mmdc") or shutil.which("mmdc.cmd")
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not mmdc and not npx:
        return None
    with tempfile.TemporaryDirectory(prefix="slidesgen-mmd-") as td:
        tdp = Path(td)
        src_f, out_f = tdp / "g.mmd", tdp / "g.png"
        src_f.write_text(src, encoding="utf-8")
        cmd = [mmdc] if mmdc else [npx, "--yes", "@mermaid-js/mermaid-cli"]
        cmd += ["-i", str(src_f), "-o", str(out_f), "-b", "white", "-s", "2"]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=180)
        except (subprocess.SubprocessError, OSError):
            return None
        return out_f.read_bytes() if out_f.exists() else None
