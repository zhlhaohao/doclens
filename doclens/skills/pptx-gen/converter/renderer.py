"""渲染器：页树 + 主题 + 版式 → PPTX（python-pptx）。

一切降级规则在此收口（与 SCHEMA.md §9 一致）。
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

from . import anims
from .layouts import SlotRect, evaluate_layout
from .parser import Block, Deck, Run, Slide, Warnings, parse_inline, parse_markdown

SKILL_DIR = Path(__file__).resolve().parent.parent
DEFAULT_LAYOUT_DIR = SKILL_DIR / "layouts"
DEFAULT_THEME_DIR = SKILL_DIR / "themes"
DEFAULT_THEME = "clean-white"
DEFAULT_LAYOUT = "title-content"

SLIDE_SIZES: dict[str, tuple[float, float]] = {
    "16:9": (13.333, 7.5),
    "4:3": (10.0, 7.5),
    "a4": (7.5, 10.0),   # 竖版 A4
}

ALIGN_MAP = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}
ROLE_SIZE = {"title": "h1", "section-title": "h1", "sub": "caption", "h1": "h1",
             "h2": "h2", "h3": "h3", "quote": "h2", "body": "body"}


@dataclass
class Theme:
    name: str
    colors: dict[str, str]
    fonts: dict[str, str]
    sizes: dict[str, float]
    chart_series: list[str]
    decor: dict[str, Any]

    @classmethod
    def load(cls, name: str, theme_dir: Path, warn: Warnings) -> "Theme":
        path = theme_dir / f"{name}.json"
        if not path.exists():
            warn.add(f"未知主题 {name}，回退 {DEFAULT_THEME}")
            path = theme_dir / f"{DEFAULT_THEME}.json"
            if not path.exists():
                warn.add(f"内置主题 {DEFAULT_THEME} 也不存在（资产损坏）")
                return cls(DEFAULT_THEME, {}, {}, {}, [], {})
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(
            name=data.get("name", name),
            colors=data.get("colors", {}),
            fonts=data.get("fonts", {"family": "微软雅黑", "mono": "Consolas"}),
            sizes=data.get("sizes", {"h1": 40, "h2": 30, "h3": 22, "body": 18, "caption": 14}),
            chart_series=data.get("chart_series", []),
            decor=data.get("decor", {}),
        )

    def color(self, role_or_hex: str, fallback_role: str = "text") -> RGBColor | None:
        c = self.colors.get(role_or_hex)
        if c is None and re.fullmatch(r"#?[0-9A-Fa-f]{6}", role_or_hex):
            c = role_or_hex if role_or_hex.startswith("#") else f"#{role_or_hex}"
        if c is None:
            c = self.colors.get(fallback_role, "#222222")
        return RGBColor.from_string(c.lstrip("#").upper())

    def font_size(self, role: str) -> float:
        key = ROLE_SIZE.get(role, "body")
        return float(self.sizes.get(key, 18))

    def role_font(self, role: str) -> str:
        if role == "code":
            return self.fonts.get("mono", "Consolas")
        return self.fonts.get("family", "微软雅黑")


class Converter:
    def __init__(self, layout_dir: Path = DEFAULT_LAYOUT_DIR,
                 theme_dir: Path = DEFAULT_THEME_DIR, strict: bool = False) -> None:
        self.layout_dir = Path(layout_dir)
        self.theme_dir = Path(theme_dir)
        self.strict = strict
        self.warn = Warnings()
        self._layout_cache: dict[str, list[SlotRect]] = {}
        self._theme: Theme | None = None
        self._meta: dict[str, Any] = {}
        self._md_dir = Path(".")

    # ------------------------------------------------------------------ 公共

    def convert(self, md_path: Path, out_path: Path, theme_override: str = "") -> Path:
        text = md_path.read_text(encoding="utf-8")
        self._md_dir = md_path.parent
        deck = parse_markdown(text, self.warn)
        self._meta = deck.meta

        theme_name = theme_override or str(deck.meta.get("theme", DEFAULT_THEME))
        self._theme = Theme.load(theme_name, self.theme_dir, self.warn)
        # font 覆盖（frontmatter）
        foverride = deck.meta.get("font") or {}
        if isinstance(foverride, dict):
            for k in ("family", "mono"):
                if foverride.get(k):
                    self._theme.fonts[k] = str(foverride[k])

        size_key = str(deck.meta.get("size", "16:9")).lower()
        if size_key not in SLIDE_SIZES:
            self.warn.add(f"未知尺寸 {size_key}，回退 16:9")
            size_key = "16:9"
        w_in, h_in = SLIDE_SIZES[size_key]

        prs = Presentation()
        prs.slide_width = Inches(w_in)
        prs.slide_height = Inches(h_in)
        self._blank_layout = prs.slide_layouts[6]

        for slide in deck.slides:
            self._render_slide(prs, slide)

        out_path.parent.mkdir(parents=True, exist_ok=True)
        prs.save(str(out_path))
        return out_path

    # ------------------------------------------------------------------ 单页

    def _render_slide(self, prs: Presentation, slide: Slide) -> None:
        d = dict(slide.directive)
        layout_name = d.pop("layout", DEFAULT_LAYOUT)
        layout_path = self.layout_dir / f"{layout_name}.html"
        if not layout_path.exists():
            self.warn.add(f"未知版式 {layout_name}，降级 {DEFAULT_LAYOUT}")
            layout_name = DEFAULT_LAYOUT
            layout_path = self.layout_dir / f"{layout_name}.html"
        slots = self._layout_cache.get(layout_name)
        if slots is None:
            slots = evaluate_layout(layout_path)
            self._layout_cache[layout_name] = slots

        s = prs.slides.add_slide(self._blank_layout)
        W, H = prs.slide_width, prs.slide_height
        theme = self._theme

        # 背景
        bg = d.pop("bg", "")
        if bg and theme:
            s.background.fill.solid()
            s.background.fill.fore_color.rgb = theme.color(bg, "bg-alt") or theme.color("bg")

        # 切换
        transition = d.pop("transition", "") or str(self._meta.get("transition", ""))
        anims.apply_transition(s, transition)

        # 装饰（主题 decor：title-rule/section-bar 按 key 匹配版式名惯例）
        theme and self._render_decor(s, layout_name, W, H)

        # 内容落位
        self._place_blocks(s, slide, slots, layout_name, W, H)

        # 备注
        if slide.notes:
            s.notes_slide.notes_text_frame.text = slide.notes

    def _render_decor(self, s, layout_name: str, W: int, H: int) -> None:
        theme = self._theme
        assert theme is not None
        key_map = {"title": "title-rule", "title-content": "title-rule",
                   "two-col": "title-rule", "image-left": "title-rule",
                   "image-right": "title-rule", "section": "section-bar"}
        key = key_map.get(layout_name, "")
        spec = theme.decor.get(key) if key else None
        if not spec:
            return
        if spec.get("type") == "rect":
            shape = s.shapes.add_shape(
                MSO_AUTO_SHAPE_TYPE.RECTANGLE,
                Emu(int(W * float(spec["x"].rstrip("%")) / 100)),
                Emu(int(H * float(spec["y"].rstrip("%")) / 100)),
                Emu(int(W * float(spec["w"].rstrip("%")) / 100)),
                Emu(int(H * float(spec["h"].rstrip("%")) / 100)),
            )
            shape.fill.solid()
            shape.fill.fore_color.rgb = theme.color(spec.get("color", "accent"), "accent")
            shape.line.fill.background()
            shape.shadow.inherit = False

    # ------------------------------------------------------------------ 落位

    def _place_blocks(self, s, slide: Slide, slots: list[SlotRect],
                      layout_name: str, W: int, H: int) -> None:
        theme = self._theme
        assert theme is not None
        blocks = list(slide.blocks)
        page_anim = slide.directive.get("anim", "") or str(self._meta.get("anim", ""))
        timing = anims.TimingBuilder()
        delay_step = 300

        # two-col：按第一个 hr 切左右
        if layout_name == "two-col":
            left_slots = [x for x in slots if x.name in ("title", "left")]
            right = next((x for x in slots if x.name == "right"), None)
            split = next((i for i, b in enumerate(blocks) if b.kind == "hr"), None)
            if split is not None:
                left_blocks = [b for b in blocks[:split] if b.kind != "hr"]
                right_blocks = [b for b in blocks[split + 1:] if b.kind != "hr"]
                self._fill_slots(s, left_blocks, [x for x in slots if x.name in ("title", "left")],
                                 page_anim, timing, 0, W, H)
                self._fill_slots(s, right_blocks, [right] if right else [],
                                 page_anim, timing, 0, W, H)
                self._apply_timing(s, timing)
                return

        # image-left / image-right：主图落 image slot，其余落 content
        if layout_name in ("image-left", "image-right"):
            img_blocks = [b for b in blocks if b.kind == "image"]
            other = [b for b in blocks if b.kind != "image"]
            title_slots = [x for x in slots if x.name == "title"]
            content_slot = [x for x in slots if x.name == "content"]
            image_slot = [x for x in slots if x.name == "image"]
            order: list[SlotRect] = title_slots + image_slot + content_slot
            self._fill_slots(s, other + (img_blocks[:1] or []), order,
                             page_anim, timing, 0, W, H, main_image=img_blocks[0] if img_blocks else None)
            # 多余图片并入文本流（content 已消费则追加到 content slot）
            for extra in img_blocks[1:]:
                self._render_image_block(s, extra, content_slot[-1] if content_slot else slots[-1])
            self._apply_timing(s, timing)
            return

        # blank：坐标块
        if layout_name == "blank":
            idx = 0
            for b in blocks:
                dx, dy, dw, dh = (b.directive.get(k, "") for k in ("x", "y", "w", "h"))
                if b.kind == "hr":
                    continue
                if not (dx and dy and dw and dh):
                    self.warn.add("blank 版式的块缺坐标指令（x/y/w/h），该块用默认网格落位")
                    col = idx % 2
                    row = idx // 2
                    dx, dy, dw, dh = (f"{5 + col * 48}%", f"{5 + row * 48}%", "44%", "42%")
                rect = self._rect_from_pct(dx, dy, dw, dh, W, H)
                self._render_block(s, b, rect, "body", timing, page_anim,
                                   delay_idx=idx)
                idx += 1
            self._apply_timing(s, timing)
            return

        # 通用：heading → title slot；其余按序填 content 类 slot
        self._fill_slots(s, blocks, slots, page_anim, timing, 0, W, H)
        self._apply_timing(s, timing)

    def _fill_slots(self, s, blocks: list[Block], slots: list[SlotRect],
                    page_anim: str, timing, start_delay: int, W: int, H: int,
                    main_image: Optional[Block] = None) -> None:
        theme = self._theme
        assert theme is not None
        if not slots:
            for i, b in enumerate(blocks):  # 无 slot 兜底：全页一个大框
                rect = (Emu(0), Emu(0), W, H)
                self._render_block(s, b, rect, "body", timing, page_anim, delay_idx=i)
            return
        title_slot = next((x for x in slots if x.name == "title"), None)
        content_slots = [x for x in slots if x is not title_slot] or [title_slot]
        delay_i = 0

        # 标题块
        for b in blocks:
            if b.kind == "heading" and title_slot is not None:
                self._render_block(s, b, title_slot.to_emu(W, H),
                                   title_slot.role or "h1", timing, page_anim,
                                   delay_idx=0, align=title_slot.align)
                break

        # 图片主块落位（image 版式已由调用方处理；这里兜底 title/content 版式中的图）
        content_blocks = [b for b in blocks
                          if not (b.kind == "heading" and b is next(
                              (x for x in blocks if x.kind == "heading"), None))]
        if main_image is not None:
            img_slot = next((x for x in slots if x.name == "image"), None)
            if img_slot is not None:
                self._render_image_block(s, main_image, img_slot)
                content_blocks = [b for b in content_blocks if b is not main_image]

        # 内容块：全部塞进第一个 content slot（多 slot 版式：超出往下排）
        ci = 0
        for slot in content_slots:
            if ci >= len(content_blocks):
                break
            take = content_blocks[ci:]
            merged_rect = slot.to_emu(W, H)
            for j, b in enumerate(take):
                self._render_block(s, b, merged_rect, slot.role or "body",
                                   timing, page_anim, delay_idx=delay_i,
                                   align=slot.align, stack=(j, len(take)))
                delay_i += 1
            ci += len(take)

    def _rect_from_pct(self, x: str, y: str, w: str, h: str,
                       W: int, H: int) -> tuple[Emu, Emu, Emu, Emu]:
        fx = float(re.sub(r"%$", "", x)) / 100
        fy = float(re.sub(r"%$", "", y)) / 100
        fw = float(re.sub(r"%$", "", w)) / 100
        fh = float(re.sub(r"%$", "", h)) / 100
        return (Emu(int(W * fx)), Emu(int(H * fy)), Emu(int(W * fw)), Emu(int(H * fh)))

    def _apply_timing(self, s, timing: anims.TimingBuilder) -> None:
        try:
            timing.apply(s)
        except Exception as e:  # noqa: BLE001 —— 动画失败不阻断产出
            self.warn.add(f"动画注入失败（页保留无动画）：{e}")

    # ------------------------------------------------------------------ 块渲染

    def _stack_offset(self, rect, idx: int, total: int, H: int):
        """同 slot 多块纵排：均分高度。"""
        if total <= 1 or idx == 0:
            return rect
        x, y, w, h = rect
        seg = h // total
        return (x, y + seg * idx, w, seg)

    def _render_block(self, s, b: Block, rect, role: str, timing,
                      page_anim: str, delay_idx: int = 0,
                      align: str = "", stack: tuple[int, int] | None = None) -> None:
        theme = self._theme
        assert theme is not None
        if stack:
            rect = self._stack_offset(rect, stack[0], stack[1], rect[3])
        x, y, w, h = rect
        align = align or b.directive.get("align", "")
        color_role = b.directive.get("color", "")
        shape = None

        if b.kind == "heading":
            tb = s.shapes.add_textbox(x, y, w, h)
            tf = tb.text_frame
            tf.word_wrap = True
            self._write_runs(tf.paragraphs[0], b.runs, role,
                             color_role=color_role, align=align)
            shape = tb
        elif b.kind == "para":
            tb = s.shapes.add_textbox(x, y, w, h)
            tf = tb.text_frame
            tf.word_wrap = True
            self._write_runs(tf.paragraphs[0], b.runs, role,
                             color_role=color_role, align=align)
            shape = tb
        elif b.kind == "list":
            tb = s.shapes.add_textbox(x, y, w, h)
            tf = tb.text_frame
            tf.word_wrap = True
            first = True
            for lvl, runs, _ordered in b.list_items:
                p = tf.paragraphs[0] if first else tf.add_paragraph()
                first = False
                p.level = lvl
                self._write_runs(p, runs, role, color_role=color_role, align=align)
            shape = tb
            # bullets 策略的动画目标：整框即可（逐项拆分 v2）
        elif b.kind == "quote":
            tb = s.shapes.add_textbox(x, y, w, h)
            tf = tb.text_frame
            tf.word_wrap = True
            for i, line in enumerate(b.lines):
                p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                self._write_runs(p, parse_inline(line), "quote",
                                 italic=True, color_role=color_role, align=align)
            shape = tb
        elif b.kind == "table":
            chart_type = b.directive.get("chart", "")
            if chart_type:
                shape = self._render_chart(s, b, rect, chart_type)
            else:
                shape = self._render_table(s, b, rect)
        elif b.kind == "code":
            if b.lang == "mermaid":
                shape = self._render_mermaid(s, b, rect)
            else:
                tb = s.shapes.add_textbox(x, y, w, h)
                tf = tb.text_frame
                tf.word_wrap = False
                fill = tb.fill
                fill.solid()
                fill.fore_color.rgb = theme.color("code-bg", "text")
                code_role = "code"  # 语义说明：代码块字体走 mono（见 role_font）
                _ = code_role
                for i, line in enumerate(b.lines):
                    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                    r = p.add_run()
                    r.text = line
                    f = r.font
                    f.name = theme.role_font("code")
                    f.size = Pt(theme.font_size("body") - 4)
                    code_bg = theme.colors.get("code-bg", "#111").upper().lstrip("#")
                    f.color.rgb = (theme.color("text")
                                   if code_bg == "FFFFFF"
                                   else RGBColor(0xE8, 0xE8, 0xE8))
                shape = tb
        elif b.kind == "image":
            shape = self._render_image_block(s, b, None, rect=rect)
        elif b.kind == "hr":
            # two-col 已消化；其他版式画细线
            line = s.shapes.add_shape(
                MSO_AUTO_SHAPE_TYPE.RECTANGLE, x, y + h // 2, w, Emu(12700))  # ~1pt
            line.fill.solid()
            line.fill.fore_color.rgb = theme.color("text-muted", "text")
            line.line.fill.background()
            line.shadow.inherit = False
            shape = line

        # 动画挂接
        if shape is not None:
            token, direction, trigger = self._resolve_anim(b, page_anim)
            if token and token != "none":
                if not anims.is_valid_token(token):
                    self.warn.add(f"未知动画词 {token}，降级 fade")
                    token = "enter.fade"
                timing.add(shape.shape_id, token, direction, trigger,
                           delay_ms=delay_idx * 300)

    def _resolve_anim(self, b: Block, page_anim: str) -> tuple[str, str, str]:
        """块指令 anim > 页级策略 > 空。返回 (token, direction, trigger)。"""
        raw = b.directive.get("anim", "")
        direction = b.directive.get("direction", "")
        trigger = b.directive.get("trigger", "after")
        if raw:
            tok = raw
        elif page_anim:
            if page_anim == "none":
                return "", "", trigger
            if ":" in page_anim:
                pol, tok = page_anim.split(":", 1)
                applicable = (pol == "all") or (pol == "bullets" and b.kind == "list")
                return (tok, direction, trigger) if applicable else ("", "", trigger)
            tok = page_anim
        else:
            return "", "", trigger
        return tok, direction, trigger

    def _write_runs(self, p, runs: list[Run], role: str, italic: bool = False,
                    color_role: str = "", align: str = "") -> None:
        theme = self._theme
        assert theme is not None
        if align in ALIGN_MAP:
            p.alignment = ALIGN_MAP[align]
        base_size = theme.font_size(role)
        for run in runs:
            if run.text == "\n":
                r = p.add_run()
                r.text = ""
                continue
            r = p.add_run()
            r.text = run.text
            f = r.font
            f.name = theme.role_font("code" if run.code else role)
            f.size = Pt(base_size)
            f.bold = run.bold or role in ("h1", "title", "section-title")
            f.italic = run.italic or italic
            f.underline = bool(run.link)
            if run.link:
                f.color.rgb = theme.color("primary", "text")
            elif run.mark:
                f.color.rgb = theme.color("text")
            elif run.color_role:
                f.color.rgb = theme.color(run.color_role, "text")
            elif color_role:
                f.color.rgb = theme.color(color_role, "text")
            else:
                f.color.rgb = theme.color(
                    "text-muted" if role == "sub" else "text")
            if run.strike:
                # python-pptx 无 strike 公开 API：字面忽略（警告可加）
                pass

    # ------------------------------------------------------------------ 表格/图表/图

    def _render_table(self, s, b: Block, rect) -> Any:
        theme = self._theme
        assert theme is not None
        rows = [[c.strip() for c in line.strip().strip("|").split("|")]
                for line in b.lines]
        if not rows:
            return None
        ncols = max(len(r) for r in rows)
        x, y, w, h = rect
        gt = s.shapes.add_table(len(rows), ncols, x, y, w, h)
        tbl = gt.table
        header_bg = theme.color("table-header", "primary")
        for ri, row in enumerate(rows):
            for ci in range(ncols):
                cell = tbl.cell(ri, ci)
                cell.text = row[ci] if ci < len(row) else ""
                para = cell.text_frame.paragraphs[0]
                for r in para.runs:
                    r.font.size = Pt(theme.font_size("body") - 2)
                    r.font.name = theme.role_font("body")
                    r.font.bold = ri == 0
                    r.font.color.rgb = (RGBColor(0xFF, 0xFF, 0xFF)
                                        if ri == 0 else theme.color("text"))
        return gt

    def _render_chart(self, s, b: Block, rect, chart_type: str) -> Any:
        theme = self._theme
        assert theme is not None
        ct = {"bar": XL_CHART_TYPE.COLUMN_CLUSTERED, "line": XL_CHART_TYPE.LINE,
              "pie": XL_CHART_TYPE.PIE}.get(chart_type)
        if ct is None:
            self.warn.add(f"未知图表类型 {chart_type}，按 bar 处理")
            ct = XL_CHART_TYPE.COLUMN_CLUSTERED
        rows = [[c.strip() for c in line.strip().strip("|").split("|")]
                for line in b.lines]
        if len(rows) < 2:
            self.warn.add("chart 块的数据表格行数不足，跳过图表")
            return None
        header, data = rows[0], rows[1:]
        cd = CategoryChartData()
        cd.categories = [r[0] for r in data]
        series_names = header[1:] or ["series"]
        for si, name in enumerate(series_names):
            cd.add_series(name, [float(r[si + 1]) if si + 1 < len(r) and r[si + 1] else 0.0
                                 for r in data])
        x, y, w, h = rect
        gframe = s.shapes.add_chart(ct, x, y, w, h, cd)
        chart = gframe.chart
        try:
            for i, series in enumerate(chart.series):
                if theme.chart_series:
                    series.format.fill.solid()
                    series.format.fill.fore_color.rgb = RGBColor.from_string(
                        theme.chart_series[i % len(theme.chart_series)].lstrip("#"))
        except Exception:  # noqa: BLE001
            pass
        return gframe

    def _render_mermaid(self, s, b: Block, rect) -> Any:
        mmdc = shutil.which("mmdc") or shutil.which("mmdc.cmd")
        x, y, w, h = rect
        if mmdc is None:
            npx = shutil.which("npx.cmd") or shutil.which("npx")
            if npx:
                mmdc = npx  # 有 node 无全局 mmdc：npx 临时拉起（慢但可用）
        if mmdc is None:
            self.warn.add("mermaid 渲染器 (mmdc/npx) 不在 PATH，降级为代码块样式")
            return None
        with tempfile.TemporaryDirectory(prefix="pptxgen-mmd-") as td:
            tdp = Path(td)
            src = tdp / "g.mmd"
            out = tdp / "g.png"
            src.write_text("\n".join(b.lines), encoding="utf-8")
            cmd = [mmdc]
            if mmdc.endswith(("npx", "npx.cmd")):
                cmd += ["--yes", "@mermaid-js/mermaid-cli"]
            cmd += ["-i", str(src), "-o", str(out), "-b", "white"]
            try:
                subprocess.run(cmd, check=True, capture_output=True, timeout=120,
                               shell=False)
            except Exception as e:  # noqa: BLE001
                self.warn.add(f"mermaid 渲染失败（{e}），降级为代码块样式")
                return None
            if out.exists():
                return s.shapes.add_picture(str(out), x, y, w, h)
        return None

    def _render_image_block(self, s, b: Block, slot: Optional[SlotRect],
                            rect=None) -> Any:
        theme = self._theme
        assert theme is not None
        if slot is not None:
            pres = s.part.package.presentation_part.presentation
            x, y, w, h = slot.to_emu(pres.slide_width, pres.slide_height)
            fit = b.directive.get("fit", slot.fit)
        elif rect is not None:
            x, y, w, h = rect
            fit = b.directive.get("fit", "cover")
        else:
            return None
        path = (self._md_dir / b.image_path) if not Path(b.image_path).is_absolute() \
            else Path(b.image_path)
        if not path.exists():
            self.warn.add(f"图片缺失：{b.image_path}（渲染占位框）")
            ph = s.shapes.add_shape(MSO_AUTO_SHAPE_TYPE.RECTANGLE, x, y, w, h)
            ph.fill.solid()
            ph.fill.fore_color.rgb = theme.color("bg-alt", "bg")
            ph.line.color.rgb = theme.color("text-muted", "text")
            tf = ph.text_frame
            tf.word_wrap = True
            tf.paragraphs[0].text = f"[缺图] {b.alt or b.image_path}"
            for r in tf.paragraphs[0].runs:
                r.font.size = Pt(12)
                r.font.color.rgb = theme.color("text-muted", "text")
            return ph
        style = b.directive.get("style", "")
        try:
            pic = s.shapes.add_picture(str(path), x, y, w, h)
        except Exception as e:  # noqa: BLE001
            self.warn.add(f"图片插入失败 {b.image_path}：{e}")
            return None
        if "circle" in style:
            from pptx.oxml.ns import qn as _qn
            sp = pic._element  # noqa: SLF001
            g = sp.find(_qn("a:spPr"))
            for tag in ("a:prstGeom",):
                old = g.find(_qn(tag)) if g is not None else None
                if old is not None:
                    g.remove(old)
        return pic
