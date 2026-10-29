"""主题：JSON → CSS 自定义属性。主题角色名是中间格式里颜色的唯一词汇。"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

DEFAULT_THEME = "clean-white"

# 主题 JSON 的 colors 键 → CSS 变量名（新增角色只需在此登记）
_COLOR_MAP = {
    "primary": "--c-primary",
    "accent": "--c-accent",
    "bg": "--c-bg",
    "bg-alt": "--c-bg-alt",
    "text": "--c-text",
    "text-muted": "--c-text-muted",
    "table-header": "--c-table-header",
    "code-bg": "--c-code-bg",
    "stage-bg": "--c-stage-bg",
    "border": "--c-border",
}

_FALLBACK_COLORS = {
    "primary": "#1B4F8A", "accent": "#E8622D", "bg": "#FFFFFF",
    "bg-alt": "#F2F5F9", "text": "#1A1A1A", "text-muted": "#6B7280",
    "table-header": "#1B4F8A", "code-bg": "#101418", "stage-bg": "#1B1D21",
}


@dataclass
class Theme:
    name: str
    colors: dict[str, str] = field(default_factory=dict)
    fonts: dict[str, str] = field(default_factory=dict)
    sizes: dict[str, float] = field(default_factory=dict)
    chart_series: list[str] = field(default_factory=list)
    shape: dict = field(default_factory=dict)
    background: dict = field(default_factory=dict)

    @property
    def series(self) -> list[str]:
        return self.chart_series or [self.color("primary"), self.color("accent"),
                                     "#2E9E6B", "#8A5CB8", "#C0392B"]

    def color(self, role_or_hex: str, fallback: str = "text") -> str:
        """角色名 → 色值；#RRGGBB 直通；未知名回退 fallback 角色。"""
        v = role_or_hex.strip()
        if v.startswith("#") and len(v) in (4, 7):
            return v
        if v in self.colors:
            return self.colors[v]
        return self.colors.get(fallback, _FALLBACK_COLORS.get(fallback, "#1A1A1A"))

    def css_vars(self) -> str:
        lines: list[str] = []
        for role, var in _COLOR_MAP.items():
            val = self.colors.get(role) or _FALLBACK_COLORS.get(role)
            if role == "stage-bg" and not self.colors.get(role):
                # 浅色主题给深色舞台底，深色主题沿用其 bg
                bg = (self.colors.get("bg") or "#FFFFFF").lstrip("#")
                lum = _luminance(bg)
                val = "#1B1D21" if lum > 0.5 else self.colors.get("bg", "#0F172A")
            if val:
                lines.append(f"  {var}: {val};")
        # 字体回退链：主题可给 stack（有序候选），否则用 family + 通用兜底。
        # 中文环境必须列出多个候选——用户机器不一定装了首选字体。
        stack = self.fonts.get("stack")
        if isinstance(stack, list) and stack:
            fam_css = ", ".join(f'"{f}"' if not f.startswith("_") else f[1:] for f in stack)
        else:
            fam = self.fonts.get("family") or "微软雅黑"
            fam_css = (f'"{fam}", "PingFang SC", "Microsoft YaHei", '
                       f'"Source Han Sans SC", system-ui, sans-serif')
        mono = self.fonts.get("mono") or "Consolas"
        lines.append(f"  --font-family: {fam_css};")
        lines.append(f'  --font-mono: "{mono}", "Cascadia Code", "JetBrains Mono", monospace;')
        for k, default in (("h1", 42), ("h2", 30), ("h3", 24), ("h4", 20),
                           ("body", 22), ("caption", 14)):
            v = self.sizes.get(k, default)
            lines.append(f"  --fs-{k}: {v}px;")

        # ---- 形状语言 ----
        sh = self.shape or {}
        radius = float(sh.get("radius", 10))          # 卡片圆角 px
        lines.append(f"  --radius: {radius:g}px;")
        lines.append(f"  --radius-sm: {max(0, radius * 0.6):g}px;")
        lines.append(f"  --radius-pill: {999 if radius >= 8 else max(2, radius):g}px;")

        shadow = sh.get("shadow", "soft")             # none | soft | strong
        _shadows = {
            "none": "none",
            "soft": "0 6px 20px rgba(0,0,0,.07)",
            "strong": "0 14px 40px rgba(0,0,0,.18)",
        }
        lines.append(f"  --shadow: {_shadows.get(shadow, _shadows['soft'])};")
        lines.append(f"  --shadow-line: {_shadows.get(shadow, _shadows['soft'])};")

        card_alpha = float(sh.get("card_alpha", 0.06))  # 卡片底色不透明度
        lines.append(f"  --card-alpha: {card_alpha:g};")

        depth = sh.get("depth", "flat")                # flat | ring | whisper
        _borders = {
            "flat": "none",
            "ring": "1px solid color-mix(in srgb, var(--c-primary) 18%, transparent)",
            "whisper": "1px solid color-mix(in srgb, var(--c-text) 8%, transparent)",
        }
        lines.append(f"  --card-border: {_borders.get(depth, 'none')};")

        # ---- 背景母题 ----
        lines.extend(self._bg_vars())
        return "\n".join(lines)

    def _bg_vars(self) -> list[str]:
        """背景母题一律用 CSS 渐变实现（零外部资源，打印也可控）。"""
        bg = self.background or {}
        motif = str(bg.get("decor", "none") or "none")
        cover_motif = str(bg.get("cover_decor", motif) or motif)
        p_, a_ = self.color("primary"), self.color("accent")

        base = "none"
        cover = "none"
        if motif == "gradient":
            base = (f"linear-gradient(160deg, color-mix(in srgb, {p_} 5%, transparent) 0%, "
                    f"transparent 62%)")
        elif motif == "grid":
            base = (f"linear-gradient({a_}22 1px, transparent 1px) 0 0/48px 48px, "
                    f"linear-gradient(90deg, {a_}22 1px, transparent 1px) 0 0/48px 48px")
        elif motif == "dots":
            base = f"radial-gradient({p_}1f 1.4px, transparent 1.4px) 0 0/26px 26px"
        elif motif == "arcs":
            base = (f"radial-gradient(circle at 92% 8%, {a_}1f 0, {a_}1f 190px, transparent 191px), "
                    f"radial-gradient(circle at 92% 8%, {p_}14 0, {p_}14 300px, transparent 301px)")
        elif motif == "blobs":
            base = (f"radial-gradient(circle at 12% 88%, {a_}1a 0, transparent 46%), "
                    f"radial-gradient(circle at 88% 12%, {p_}14 0, transparent 42%)")
        elif motif == "band":
            base = f"linear-gradient(180deg, color-mix(in srgb, {p_} 4%, transparent) 0 34%, transparent 34%)"

        if cover_motif != motif:
            cover = base if cover_motif == "same" else base

        vals = [f"  --bg-motif: {base};", f"  --bg-motif-cover: {cover or base};"]
        band = bg.get("band_color", "")
        if band:
            vals.append(f"  --band-color: {self.color(band)};")
        return vals


def _luminance(hex6: str) -> float:
    try:
        r, g, b = (int(hex6[i:i + 2], 16) / 255 for i in (0, 2, 4))
    except (ValueError, IndexError):
        return 1.0
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def load_theme(name: str, theme_dir: Path, warn) -> Theme:
    path = theme_dir / f"{name}.json"
    if not path.exists():
        warn(f"未知主题 {name}，回退 {DEFAULT_THEME}")
        path = theme_dir / f"{DEFAULT_THEME}.json"
        if not path.exists():
            warn(f"内置主题 {DEFAULT_THEME} 缺失（资产损坏），使用内建兜底色板")
            return Theme(DEFAULT_THEME, dict(_FALLBACK_COLORS))
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        warn(f"主题 {path.name} JSON 解析失败（{e}），使用内建兜底色板")
        return Theme(DEFAULT_THEME, dict(_FALLBACK_COLORS))
    return Theme(
        name=data.get("name", name),
        colors=data.get("colors", {}),
        fonts=data.get("fonts", {}),
        sizes=data.get("sizes", {}),
        chart_series=data.get("chart_series", []),
        shape=data.get("shape", {}),
        background=data.get("background", {}),
    )
