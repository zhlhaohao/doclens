"""参考图提色：一张图 → 一套主题 JSON（含对比度校准）。

为什么需要工具：让 agent 用眼睛判断 hex 色值不可靠。这里用确定性算法：
1. 缩图 → 去噪 → K-means/中位切分取主色
2. 按色相/亮度分配角色（背景=最高占比的亮/暗极、主色=最有彩度的簇、强调=次彩度）
3. 对比度校准：text/bg ≥ 4.5、primary|accent/bg ≥ 3，不达标就自动调亮度
4. 输出可直接用的 themes/<名>.json

无 numpy 时退化为纯 PIL 量化（够用）。numpy 在则用更稳的算法。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None


# ---------------------------------------------------------------- 色彩工具

def _hex(rgb: tuple[int, int, int]) -> str:
    return "#%02X%02X%02X" % rgb


def _rgb(h: str) -> tuple[int, int, int]:
    h = h.strip().lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def _lum(h_or_rgb) -> float:
    r, g, b = _rgb(h_or_rgb) if isinstance(h_or_rgb, str) else h_or_rgb
    f = lambda c: (c / 255) / 12.92 if c / 255 <= 0.03928 else (((c / 255) + 0.055) / 1.055) ** 2.4  # noqa: E731
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def contrast(a, b) -> float:
    la, lb = _lum(a), _lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def _saturation(rgb: tuple[int, int, int]) -> float:
    r, g, b = (c / 255 for c in rgb)
    mx, mn = max(r, g, b), min(r, g, b)
    if mx == 0:
        return 0.0
    return (mx - mn) / mx


def _mix(a: str, b: str, t: float) -> str:
    ra, rb = _rgb(a), _rgb(b)
    return _hex(tuple(round(ra[i] * (1 - t) + rb[i] * t) for i in range(3)))  # type: ignore[arg-type]


def _shift_toward(h: str, target: str, step: float = 0.12, max_iter: int = 20) -> str:
    """把颜色朝 target（黑或白）方向调，直到达成目标（调用方判断）。"""
    cur = h
    for _ in range(max_iter):
        cur = _mix(cur, target, step)
    return cur


def _ensure(fg: str, bg: str, need: float) -> str:
    """调整 fg 亮度直到与 bg 对比度达标；往反差更大的方向调。"""
    if contrast(fg, bg) >= need:
        return fg
    target = "#000000" if _lum(bg) > 0.4 else "#FFFFFF"
    cur = fg
    for step in (0.06, 0.1, 0.15, 0.2):
        for _ in range(12):
            cur = _mix(cur, target, step)
            if contrast(cur, bg) >= need:
                return cur
    return target


# ---------------------------------------------------------------- 主色提取

def dominant_colors(path: Path, k: int = 8) -> list[tuple[tuple[int, int, int], float]]:
    """返回 [(rgb, 占比)]，按占比降序。"""
    from PIL import Image

    im = Image.open(path).convert("RGB")
    # 缩到 160px 宽，降噪 + 提速
    w = 160
    im = im.resize((w, max(1, int(im.height * w / im.width))), Image.LANCZOS)

    if np is not None:
        arr = np.asarray(im).reshape(-1, 3).astype(np.float32)
        return _kmeans(arr, k)
    # 退化路径：PIL 自带量化
    q = im.quantize(colors=k, method=Image.MEDIANCUT)
    pal = q.getpalette()[: k * 3]
    total = im.width * im.height
    hist = sorted(q.getcolors() or [], reverse=True)[:k]
    out = []
    for cnt, idx in hist:
        out.append((tuple(pal[idx * 3: idx * 3 + 3]), cnt / total))
    return out


def _kmeans(arr, k: int):
    """极简 k-means（样本已缩到 ~2 万点，足够快）。"""
    assert np is not None
    # 用分位数初始化，避免全黑/全白主导
    rng = np.random.default_rng(42)
    idx = rng.choice(len(arr), size=min(k * 40, len(arr)), replace=False)
    sample = arr[idx]

    # k-means++ 简化版：随机选 k 个种子
    centers = sample[rng.choice(len(sample), size=k, replace=False)]
    for _ in range(12):
        d = ((sample[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        labels = d.argmin(axis=1)
        new = centers.copy()
        for j in range(k):
            m = labels == j
            if m.any():
                new[j] = sample[m].mean(axis=0)
        if np.allclose(new, centers, atol=0.5):
            centers = new
            break
        centers = new

    d = ((arr[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
    labels = d.argmin(axis=1)
    out = []
    for j in range(k):
        cnt = int((labels == j).sum())
        if cnt == 0:
            continue
        c = tuple(int(round(v)) for v in centers[j])
        out.append((c, cnt / len(arr)))
    out.sort(key=lambda x: -x[1])
    return out


# ---------------------------------------------------------------- 角色分配

@dataclass
class Palette:
    bg: str
    bg_alt: str
    primary: str
    accent: str
    text: str
    text_muted: str
    table_header: str
    code_bg: str
    stage_bg: str
    series: list[str]


def is_photo_like(colors: list[tuple[tuple[int, int, int], float]]) -> bool:
    """判据：是否存在「单个大面积纯色极端簇」。

    设计稿/截图一定有一个占 30%+ 的纯色底（白或黑，落在同一簇里）；
    照片的暗部/亮部会分散在多个簇，单个簇占比都上不去。
    实测：暖光木雕照片最大暗簇 0.147，截图白底簇 0.532。
    """
    if not colors:
        return False
    top_extreme = max((sh for rgb, sh in colors
                       if _lum(rgb) > 0.88 or _lum(rgb) < 0.06), default=0.0)
    return top_extreme < 0.30


def build_palette(colors: list[tuple[tuple[int, int, int], float]],
                  bg_override: str = "") -> Palette:
    """按占比 + 饱和度 + 亮度分配角色，并做对比度校准。

    bg_override 非空时强制用该底色（照片类参考图推荐显式指定）。
    """
    if not colors:
        colors = [((255, 255, 255), 1.0)]

    photo = is_photo_like(colors)

    if bg_override:
        bg = bg_override if bg_override.startswith("#") else "#" + bg_override
        bg_c = (_rgb(bg), 1.0)
    elif photo:
        # 照片没有纯色底：取整体明暗决定白底/深底
        avg_lum = sum(_lum(rgb) * sh for rgb, sh in colors)
        bg_c = ((255, 255, 255), 1.0) if avg_lum >= 0.35 else ((18, 20, 24), 1.0)
        bg = _hex(bg_c[0])
    else:
        # 背景：占比最高且很亮（>0.72）或很暗（<0.14）的簇
        bg_c = max(colors, key=lambda x: x[1] * (1.0 if (_lum(x[0]) > 0.72 or _lum(x[0]) < 0.14) else 0.35))
        bg = _hex(bg_c[0])
    dark = _lum(bg) < 0.35

    # 主色：排除背景后饱和度最高的（暗底则要求足够亮才可见）
    bg_rgb = _rgb(bg)

    def score_primary(item):
        rgb, share = item
        sat = _saturation(rgb)
        # 与背景的对比度也参与，避免选到看不见的色
        c = contrast(rgb, bg_rgb)
        return sat * 2 + min(c, 6) / 6 + share * 0.5

    others = [c for c in colors if contrast(c[0], bg_rgb) > 1.6] or colors
    ranked = sorted(others, key=score_primary, reverse=True)

    primary = _hex(ranked[0][0]) if ranked else ("#FFFFFF" if dark else "#222222")
    # 强调色：与主色色相/亮度差异最大的第二候选
    accent = None
    for rgb, _sh in ranked[1:]:
        if _color_dist(rgb, ranked[0][0]) > 70:
            accent = _hex(rgb)
            break
    if accent is None:
        accent = _mix(primary, "#FF7A00" if not dark else "#FFB020", 0.55)

    # 文字：与背景反差最大的方向
    text = "#F5F7FA" if dark else "#1A1A1A"
    text = _ensure(text, bg, 7.0)
    text_muted = _mix(text, bg, 0.42)
    text_muted = _ensure(text_muted, bg, 3.2)

    primary = _ensure(primary, bg, 3.0)
    accent = _ensure(accent, bg, 3.0)

    bg_alt = _mix(bg, "#FFFFFF" if dark else "#000000", 0.06 if dark else 0.04)
    table_header = _ensure(primary, bg, 3.0)
    code_bg = "#0F1115" if not dark else _mix(bg, "#000000", 0.5)
    stage_bg = _mix(bg, "#000000", 0.72) if not dark else bg

    # 图表配色：主色/强调 + 派生
    series = [primary, accent,
              _mix(primary, "#FFFFFF", 0.35), _mix(accent, "#000000", 0.28),
              _mix(primary, bg, 0.45), _mix(accent, "#FFFFFF", 0.4)]

    return Palette(bg=bg, bg_alt=bg_alt, primary=primary, accent=accent,
                   text=text, text_muted=text_muted, table_header=table_header,
                   code_bg=code_bg, stage_bg=stage_bg, series=series)


def _color_dist(a, b) -> float:
    return sum((a[i] - b[i]) ** 2 for i in range(3)) ** 0.5


# ---------------------------------------------------------------- 主流程

def extract(path: Path, name: str = "", theme_dir: Path | None = None,
            write: bool = True, bg_override: str = "") -> dict:
    """参考图 → 主题 dict（并可选写入 themes/<name>.json）。"""
    colors = dominant_colors(path)
    photo = is_photo_like(colors)
    pal = build_palette(colors, bg_override=bg_override)
    slug = name or _slugify(path.stem)
    data = {
        "name": slug,
        "colors": {
            "primary": pal.primary,
            "accent": pal.accent,
            "bg": pal.bg,
            "bg-alt": pal.bg_alt,
            "text": pal.text,
            "text-muted": pal.text_muted,
            "table-header": pal.table_header,
            "code-bg": pal.code_bg,
            "stage-bg": pal.stage_bg,
        },
        "fonts": {"family": "微软雅黑", "mono": "Consolas"},
        "sizes": {"h1": 42, "h2": 30, "h3": 24, "h4": 20, "body": 22, "caption": 14},
        "chart_series": pal.series,
        "source_image": str(path),
    }
    if write and theme_dir is not None:
        theme_dir.mkdir(parents=True, exist_ok=True)
        (theme_dir / f"{slug}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    data["_checks"] = _report_contrast(pal)
    data["_mode"] = "photo" if photo else "design"
    if photo and not bg_override:
        data["_note"] = ("参考图没有纯色背景（判为照片），已自动选白/深底。"
                         "想要准确底色请用 --bg '#RRGGBB' 指定")
    return data


def _report_contrast(pal: Palette) -> dict:
    return {
        "text/bg": round(contrast(pal.text, pal.bg), 2),
        "text-muted/bg": round(contrast(pal.text_muted, pal.bg), 2),
        "primary/bg": round(contrast(pal.primary, pal.bg), 2),
        "accent/bg": round(contrast(pal.accent, pal.bg), 2),
    }


def _slugify(s: str) -> str:
    s = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", s).strip("-").lower()
    return s or "custom"


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    ap = argparse.ArgumentParser(prog="slides-gen-extract-style",
                                 description="参考图 → 主题 JSON（自动对比度校准）")
    ap.add_argument("image", type=Path, help="参考图路径")
    ap.add_argument("--name", default="", help="主题名（默认取图片文件名）")
    ap.add_argument("--theme-dir", type=Path, default=None,
                    help="写入目录（默认本技能 themes/）")
    ap.add_argument("--dry-run", action="store_true", help="只打印不写文件")
    ap.add_argument("--bg", default="", help="强制底色，如 '#FFFFFF'（照片类参考图推荐）")
    args = ap.parse_args(argv)

    if not args.image.exists():
        print(f"错误：图片不存在 {args.image}", file=sys.stderr)
        return 2
    theme_dir = args.theme_dir or (Path(__file__).resolve().parent.parent / "themes")
    try:
        data = extract(args.image, args.name, theme_dir, write=not args.dry_run,
                       bg_override=args.bg)
    except Exception as e:  # noqa: BLE001
        print(f"错误：提色失败 {e}", file=sys.stderr)
        return 1

    print(json.dumps(data, ensure_ascii=False, indent=2))
    print()
    c = data["_checks"]
    ok = c["text/bg"] >= 4.5 and c["primary/bg"] >= 3 and c["accent/bg"] >= 3
    print(f"对比度：text/bg {c['text/bg']} · primary/bg {c['primary/bg']} · "
          f"accent/bg {c['accent/bg']} → {'通过' if ok else '未达标（已尽力校准）'}")
    print(f"参考图类型：{'照片（已降级取白/深底）' if data.get('_mode') == 'photo' else '设计稿'}")
    if data.get("_note"):
        print(f"提示：{data['_note']}")
    if not args.dry_run:
        print(f"已写入 {theme_dir / (data['name'] + '.json')}")
        print(f"用法：frontmatter 写 theme: {data['name']}")
    return 0


if __name__ == "__main__":
    import sys as _s
    _s.exit(main())
