"""风格样张：用用户自己的封面 + 首页内容，渲染 3 套主题，拼成对比图。

为什么要这个：文字报主题名（corporate-blue / swiss-grid）用户听不懂，
让他看自己内容的三个版本，一秒钟就能挑。

实现：取 deck 的前两页（通常是封面 + 最内容密集页），
对每套主题渲染完整 HTML → 截图 → 拼成三行对比图。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from .html_renderer import CANVAS, Renderer
from .parser import parse_markdown
from .theme import DEFAULT_THEME, load_theme

# 三套必须「一眼能看出不同」——同是白底的主题放一起等于没比。
# 默认三件套：商务浅色 / 深色 / 杂志暖色，明暗与色相都拉开。
DEFAULT_TRIO = ["corporate-blue", "dark-tech", "ink-magazine"]

# 备选组合（--themes 可指定任意三套）
TRIO_SAFE = ["corporate-blue", "swiss-grid", "dark-tech"]
TRIO_BOLD = ["dark-tech", "warm-orange", "mint-fresh"]
TRIO_ART = ["ink-magazine", "warm-paper", "swiss-grid"]

# 与给定主题配对时用的候选池（按视觉差异从大到小）
_ALTERNATES = {
    "corporate-blue": ["dark-tech", "ink-magazine", "warm-orange"],
    "clean-white": ["dark-tech", "ink-magazine", "warm-orange"],
    "swiss-grid": ["dark-tech", "ink-magazine", "mint-fresh"],
    "dark-tech": ["corporate-blue", "ink-magazine", "warm-orange"],
    "ink-magazine": ["corporate-blue", "dark-tech", "mint-fresh"],
    "mint-fresh": ["dark-tech", "ink-magazine", "corporate-blue"],
    "warm-orange": ["dark-tech", "corporate-blue", "ink-magazine"],
    "warm-paper": ["dark-tech", "corporate-blue", "swiss-grid"],
}


def pick_trio(current: str = "") -> list[str]:
    """优先「当前主题 + 两套反差最大的」，否则用默认三件套。"""
    if current and current in _ALTERNATES:
        return [current] + _ALTERNATES[current][:2]
    return list(DEFAULT_TRIO)


LABELS = {
    "corporate-blue": "商务蓝 · 稳重，适合汇报",
    "clean-white": "白净 · 极简，适合通用",
    "swiss-grid": "瑞士网格 · 严谨，适合技术",
    "dark-tech": "深色科技 · 有冲击力，适合发布",
    "warm-orange": "暖橙 · 有温度，适合品牌",
    "mint-fresh": "薄荷 · 清新，适合产品",
    "ink-magazine": "墨水杂志 · 编辑感，适合故事",
    "warm-paper": "暖纸 · 阅读舒适，适合长文",
}


@dataclass
class PreviewResult:
    out: Path
    themes: list[str]
    pages: list[int]
    skipped: list[str]


def _pick_pages(md_path: Path) -> tuple[list[int], dict]:
    """选讲故事的页：优先封面(title) + 内容最多的一页。"""
    class _S:
        items: list = []
        def add(self, m): pass

    deck = parse_markdown(md_path.read_text(encoding="utf-8"), _S())
    if not deck.slides:
        return [], deck.meta

    def density(sl) -> int:
        n = 0
        for b in sl.blocks:
            if b.kind == "list":
                n += len(b.list_items) * 12
            elif b.kind in ("para", "quote"):
                n += sum(len(r.text) for r in (b.runs or []))
            elif b.kind == "heading":
                n += 8
        return n

    cover = next((i for i, sl in enumerate(deck.slides)
                  if sl.directive.get("layout") == "title"), 0)
    body = max(
        (i for i in range(len(deck.slides)) if i != cover), key=lambda i: density(deck.slides[i]),
        default=cover,
    )
    # 转成 1-based（presenter.js 的 deck.go 用 1-based）
    return sorted({cover + 1, body + 1}), deck.meta


def render_previews(md_path: Path, out_dir: Path, themes: list[str] | None = None,
                    theme_dir: Path | None = None, layout_dir: Path | None = None) -> PreviewResult:
    from playwright.sync_api import sync_playwright

    pages, meta = _pick_pages(md_path)
    if not pages:
        raise ValueError(f"{md_path.name} 里没有可预览的页")

    # 主题选择：默认 = deck 当前主题 + 两套反差大的（让用户看到"现在长这样，还能那样"）
    if not themes:
        themes = pick_trio(str(meta.get("theme", "") or ""))

    # 过滤掉不存在的主题
    td = theme_dir or (Path(__file__).resolve().parent.parent / "themes")
    valid: list[str] = []
    skipped: list[str] = []
    for t in themes:
        if (td / f"{t}.json").exists():
            valid.append(t)
        else:
            skipped.append(t)
    if not valid:
        # 用户指定/默认的主题全都不存在：明确告知，而不是静默只渲一套
        available = sorted(x.stem for x in td.glob("*.json"))
        raise ValueError(
            f"要渲染的主题都不存在：{', '.join(themes)}。"
            f"可用主题：{', '.join(available) or '（themes 目录为空）'}")

    out_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir = out_dir / "_tmp"
    tmp_dir.mkdir(exist_ok=True)
    shots: list[tuple[str, list[Path]]] = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": CANVAS["16:9"][0],
                                          "height": CANVAS["16:9"][1]},
                                device_scale_factor=1)
        for tname in valid:
            r = Renderer(layout_dir=layout_dir or (Path(__file__).resolve().parent.parent / "layouts"),
                         theme_dir=td)
            html = tmp_dir / f"{tname}.html"
            r.render(md_path, html, theme_override=tname)
            page.goto(html.resolve().as_uri() + "?qa=1")
            try:
                page.wait_for_function(
                    "document.body.getAttribute('data-qa-ready') === '1'", timeout=15000)
            except Exception:  # noqa: BLE001
                page.wait_for_timeout(800)
            page_imgs: list[Path] = []
            for n in pages:
                page.evaluate(f"window.deck.go({n})")
                page.wait_for_timeout(120)
                # 只截幻灯片本体，去掉舞台留白
                shot = tmp_dir / f"{tname}-p{n}.png"
                page.locator("#stage").screenshot(path=str(shot))
                page_imgs.append(shot)
            shots.append((tname, page_imgs))
        browser.close()

    res = _compose(shots, out_dir / "sheet.png")
    res.pages = pages
    res.skipped = skipped
    _cleanup(tmp_dir)
    return res


def _compose(shots: list[tuple[str, list[Path]]], out: Path) -> PreviewResult:
    from PIL import Image, ImageDraw, ImageFont

    rows = []
    thumb_w = 520
    gap = 16
    label_h = 34
    for tname, imgs in shots:
        row_imgs = []
        for p in imgs:
            im = Image.open(p).convert("RGB")
            h = int(im.height * thumb_w / im.width)
            row_imgs.append(im.resize((thumb_w, h), Image.LANCZOS))
        rows.append((tname, row_imgs))

    row_h = max((sum(i.height for i in imgs) + gap * (len(imgs) - 1))
                for _, imgs in rows) if rows else 300
    total_h = label_h * len(rows) + (row_h + gap) * len(rows) + gap
    total_w = thumb_w + gap * 2

    canvas = Image.new("RGB", (total_w, total_h), (28, 30, 34))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 20)
    except Exception:  # noqa: BLE001
        font = ImageFont.load_default()

    y = gap
    for tname, imgs in rows:
        label = LABELS.get(tname, tname)
        draw.text((gap, y), f"{tname} — {label}", fill=(240, 240, 240), font=font)
        y += label_h
        for im in imgs:
            canvas.paste(im, (gap, y))
            y += im.height + gap
        y += gap

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, optimize=True)
    return PreviewResult(out=out, themes=[t for t, _ in rows], pages=[], skipped=[])


def _cleanup(tmp_dir: Path) -> None:
    """删中间产物（HTML 与单页截图），只留 sheet.png。"""
    import shutil

    try:
        shutil.rmtree(tmp_dir)
    except OSError:
        pass


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    ap = argparse.ArgumentParser(prog="slides-gen-preview",
                                 description="渲染 3 套主题样张，供用户看图选风格")
    ap.add_argument("input", type=Path, help="deck md 文件")
    ap.add_argument("--themes", default="", help="逗号分隔的三个主题名（默认稳妥三套）")
    ap.add_argument("--out", type=Path, default=None, help="输出目录（默认 <md名>-previews）")
    args = ap.parse_args(argv)

    if not args.input.exists():
        print(f"错误：输入文件不存在 {args.input}", file=sys.stderr)
        return 2
    themes = [t.strip() for t in args.themes.split(",") if t.strip()] if args.themes else None
    out_dir = args.out or Path(str(args.input.with_suffix("")) + "-previews")
    try:
        res = render_previews(args.input, out_dir, themes)
    except Exception as e:  # noqa: BLE001
        print(f"错误：样张渲染失败 {e}", file=sys.stderr)
        return 1
    print(f"OK {res.out}（{', '.join(res.themes)}）")
    print("发给用户，说明每套适合什么场合，选定后改 frontmatter 的 theme。")
    return 0


if __name__ == "__main__":
    import sys as _s
    _s.exit(main())
