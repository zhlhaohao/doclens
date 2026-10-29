"""版式样板间（gallery）：19 个版式各渲染一页示例，拼成总览图 + 可翻页的单文件浏览页。

用途：用户说「看看有哪些版式」「版式都长什么样」时，比文字描述有效一百倍。
输出到 <名>-gallery/：
  sheet.png     全部版式的缩略总览（网格拼图，带版式名）
  gallery.html  可翻页的单文件浏览页（每页 = 一个版式的完整 1280×720 渲染）
"""

from __future__ import annotations

import pathlib
import tempfile

from .html_renderer import CANVAS, Renderer
from .html_renderer import LAYOUT_DIR as DEFAULT_LAYOUT_DIR, THEME_DIR as DEFAULT_THEME_DIR

# 每个版式的示例内容（形状必须与版式期待的数据一致）
SAMPLES: dict[str, str] = {
    "title": '''# 把方向盘拿回自己手里

自研 AI Coding Agent 汇报
研发部 · 2026-11''',

    "section": '''# 第二部分

看不见的差异''',

    "title-content": '''# Claude Code 有的，我们也有

- **主循环 / 子代理 / 任务跟踪** — 同名同语义，三层熔断防死循环
- **CLAUDE.md 项目记忆** — 原生读取，存量文件直接用
- **MCP 生态** — 三传输 + 反向暴露工具
- **后台任务 · 权限确认 · 压缩** — 全有''',

    "two-col": '''# 自建 vs 采购

**自建**

- 数据全留本地，合规可控
- 源码可读可改，贴着业务长

---

**采购**

- 部署即用，零研发投入
- 成熟度高，生态现成''',

    "image-left": '''# 一图看懂架构

![P2-图1 架构图示例](__GALLERY_IMG__)

- 接入层：统一入口
- 服务层：核心节点
- 存储层：数据底座''',

    "image-right": '''# 一图看懂架构

![P2-图1 架构图示例](__GALLERY_IMG__)

- 接入层：统一入口
- 服务层：核心节点
- 存储层：数据底座''',

    "quote": '''> 简单是可靠的先决条件。一个系统真正的复杂度，往往藏在那些
> 为了「以后可能用到」而提前加进来的部分。

—— Edsger W. Dijkstra''',

    "blank": '''<!-- block: x=6% y=8% w=42% h=16% -->
# 自由画布

<!-- block: x=6% y=32% w=42% h=30% -->
- 块位置用百分比坐标控制
- 适合海报式、时间轴、拼贴

<!-- block: x=54% y=8% w=40% h=84% align=center -->
### 右侧自由区域

任意块 + 任意坐标，
互不干扰、自动适配。''',

    "stats": '''# 三个数字看增长

| 数值 | 说明 |
|---|---|
| **3.2 倍** | 同比增长 |
| **86%** | 新用户来自口碑 |
| **12%** | 付费投放占比 |''',

    "timeline": '''# 一年三步走到今天

| 日期 | 事件 | 说明 |
|---|---|---|
| 2025-11 | 立项 | 三人小团队 |
| 2026-03 | 内测 | 首批 500 用户 |
| 2026-10 | 发布 | 首月 3.2 万用户 |''',

    "matrix": '''# 四个方向怎么排

|  | 低成本 | 高成本 |
|---|---|---|
| **高价值** | 快速试点 | 战略投入 |
| **低价值** | 顺手做 | 暂缓 |''',

    "compare": '''# 自建 vs 采购

**自建**

- 数据主权自持
- 每行源码可改

---

**采购**

- 即刻可用
- 生态成熟''',

    "big-number": '''### 同一个需求，从两天到半天

- 前提：任务边界清晰、验收可自动化
- 探索性任务提升有限''',

    "grid": '''# 四个核心特性

| 特性 | 说明 |
|---|---|
| 本地优先 | 数据不出内网 |
| 图形界面 | 浏览器即用 |
| 记忆系统 | 越用越懂团队 |
| 多模型 | 随时切换 |''',

    "agenda": '''# 议程

| 章节 | 说明 |
|---|---|
| 为什么自建 | 痛点与机会 |
| 做到了什么 | 五个核心能力 |
| 怎么落地 | 三步走计划 |''',

    "pyramid": '''# 技术决策的三层

| 层 | 说明 |
|---|---|
| 战略 | 数据主权自持 |
| 战术 | 三层自研可控 |
| 执行 | 单人可维护 |''',

    "funnel": '''# 从访问到付费

| 阶段 | 数值 |
|---|---|
| 访问 | 10000 |
| 注册 | 3200 |
| 激活 | 1800 |
| 付费 | 450 |''',

    "cycle": '''# 交付的循环

- 计划：拆任务、定验收
- 编码：agent 执行、人审查
- 验收：几何+视觉双检
- 沉淀：决策入记忆''',

    "closing": '''# 批准小范围试点：一个组、四周、可随时叫停

- **本周**：选定试点组，配好模型
- **第 2 周**：跑 3 个真实需求，记录对比
- **第 4 周**：出数据，决定扩大或停止''',
}

# big-number 需要页指令 number=
PAGE_DIRECTIVE_OVERRIDES: dict[str, str] = {
    "big-number": 'layout=big-number number="3 倍"',
    "stats": 'layout=stats kicker="01 · 数据" takeaway="增长主要来自口碑"',
    "matrix": 'layout=matrix x_axis="实施成本" y_axis="业务价值"',
    "funnel": 'layout=funnel source="示例数据"',
    "compare": 'layout=compare vs_label="VS"',
}

LAYOUT_ORDER = ["title", "section", "agenda", "title-content", "two-col", "grid",
                "stats", "big-number", "timeline", "pyramid", "funnel", "cycle",
                "matrix", "compare", "image-left", "image-right", "quote",
                "blank", "closing"]

LAYOUT_DESC: dict[str, str] = {
    "title": "封面", "section": "章节过渡", "agenda": "目录/议程",
    "title-content": "标题+要点（默认）", "two-col": "左右双栏",
    "grid": "卡片网格", "stats": "数据卡片", "big-number": "大数字主张",
    "timeline": "时间线", "pyramid": "金字塔层次", "funnel": "转化漏斗",
    "cycle": "循环流程", "matrix": "2×2 象限", "compare": "两方对比",
    "image-left": "图左文右", "image-right": "文左图右", "quote": "大引述",
    "blank": "自由画布（坐标）", "closing": "收尾行动页",
}


def _sample_md(theme: str, layouts: list[str], img_path: str) -> str:
    parts = [f'---\ntheme: {theme}\nsize: "16:9"\ntitle: 版式样板间\n---\n']
    for name in layouts:
        directive = PAGE_DIRECTIVE_OVERRIDES.get(name, f"layout={name}")
        body = SAMPLES[name].replace("__GALLERY_IMG__", img_path)
        parts.append(f'<!-- slide: {directive} -->\n\n{body}\n')
    return "\n".join(parts)


def build_gallery(theme: str, out_dir: pathlib.Path,
                  layouts: list[str] | None = None,
                  layout_dir=DEFAULT_LAYOUT_DIR, theme_dir=DEFAULT_THEME_DIR) -> dict:
    """渲染样板间：sheet.png（总览拼图）+ gallery.html（可翻页浏览页）。"""
    from playwright.sync_api import sync_playwright
    from PIL import Image, ImageDraw, ImageFont

    names = layouts or LAYOUT_ORDER
    missing = [n for n in names if not (layout_dir / f"{n}.html").exists()]
    if missing:
        raise ValueError(f"版式不存在：{', '.join(missing)}")
    if theme and not (theme_dir / f"{theme}.json").exists():
        from .theme import load_theme  # noqa: F401 — 让主题回退警告走 renderer
        # renderer 自己会回退并警告，这里不拦截

    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = out_dir / "_tmp"
    tmp.mkdir(exist_ok=True)

    # 图文版式需要一张示例图：用 PIL 画一张简单的占位架构图
    img_path = tmp / "arch.png"
    _make_sample_image(img_path)

    # Windows 反斜杠进 md 链接会解析失败：统一转 POSIX 绝对路径
    img_posix = img_path.resolve().as_posix()
    md = tmp / "gallery.md"
    md.write_text(_sample_md(theme or "corporate-blue", names, img_posix),
                  encoding="utf-8")

    r = Renderer(layout_dir=layout_dir, theme_dir=theme_dir)
    html = tmp / "gallery.html"
    stats = r.render(md, html, theme_override=theme or "")
    if stats["warnings"]:
        for w in stats["warnings"]:
            print(f"  · {w}")

    shots: list[tuple[str, pathlib.Path]] = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": CANVAS["16:9"][0],
                                          "height": CANVAS["16:9"][1]},
                                device_scale_factor=1)
        page.goto(html.resolve().as_uri() + "?qa=1")
        try:
            page.wait_for_function("document.body.getAttribute('data-qa-ready')==='1'",
                                   timeout=20000)
        except Exception:  # noqa: BLE001
            page.wait_for_timeout(1000)
        for i, name in enumerate(names, 1):
            page.evaluate(f"window.deck.go({i})")
            page.wait_for_timeout(120)
            shot = tmp / f"{name}.png"
            page.locator("#stage").screenshot(path=str(shot))
            shots.append((name, shot))
        browser.close()

    # 拼总览图：3 列网格，每格带版式名+中文说明
    cols = 3
    rows = (len(shots) + cols - 1) // cols
    tw, label_h, gap = 420, 34, 12
    th = int(tw * CANVAS["16:9"][1] / CANVAS["16:9"][0])
    W = cols * tw + (cols + 1) * gap
    H = rows * (th + label_h + gap) + gap + 46
    sheet = Image.new("RGB", (W, H), (28, 30, 34))
    draw = ImageDraw.Draw(sheet)
    try:
        f_head = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 20)
        f_title = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 15)
    except Exception:  # noqa: BLE001
        f_head = f_title = ImageFont.load_default()
    draw.text((gap + 4, 10), f"版式样板间 · {len(shots)} 个 · 主题 {theme or 'corporate-blue'}",
              fill=(240, 240, 240), font=f_head)

    for idx, (name, path) in enumerate(shots):
        r_, c_ = divmod(idx, cols)
        x = gap + c_ * (tw + gap)
        y = 46 + gap + r_ * (th + label_h + gap)
        im = Image.open(path).convert("RGB").resize((tw, th), Image.LANCZOS)
        sheet.paste(im, (x, y))
        desc = LAYOUT_DESC.get(name, "")
        draw.text((x + 2, y + th + 4), f"{name} — {desc}",
                  fill=(210, 214, 220), font=f_title)

    sheet_path = out_dir / "sheet.png"
    sheet.save(sheet_path, optimize=True)

    # gallery.html：把每页截图嵌进可翻页的浏览页（复用 presenter 运行时）
    import base64
    from .html_renderer import ASSET_DIR

    base_css = (ASSET_DIR / "base.css").read_text(encoding="utf-8")
    presenter_js = (ASSET_DIR / "presenter.js").read_text(encoding="utf-8")
    pages_html = []
    for i, (name, path) in enumerate(shots, 1):
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        desc = LAYOUT_DESC.get(name, "")
        pages_html.append(
            f'''  <section class="slide" data-index="{i}">
    <div class="gl-page"><img src="data:image/png;base64,{b64}" alt="{name}">
      <div class="gl-label"><code>{name}</code> {desc}</div></div>
  </section>''')
    gallery_html = f'''<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>版式样板间</title>
<style>
:root {{ --slide-w: 1280px; --slide-h: 720px; }}
{base_css}
.gl-page {{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; height:100%; }}
.gl-page img {{ max-width:92%; max-height:86%; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,.4); }}
.gl-label {{ font-size:20px; color:#e8ecf2; }}
.gl-label code {{ background:#2a2f38; padding:3px 10px; border-radius:6px; color:#7ec8ff; font-size:17px; }}
.slide {{ padding:0; }}
</style></head>
<body>
<div id="stage">
{chr(10).join(pages_html)}
</div>
<div class="progress"></div>
<div class="hint">← → 翻页浏览 {len(shots)} 个版式</div>
<script>
{presenter_js}
</script>
</body></html>'''
    gallery_path = out_dir / "gallery.html"
    gallery_path.write_text(gallery_html, encoding="utf-8")

    # 清理临时目录
    import shutil
    shutil.rmtree(tmp, ignore_errors=True)

    return {"sheet": str(sheet_path), "gallery": str(gallery_path),
            "layouts": names, "warnings": stats["warnings"]}


def _make_sample_image(path: pathlib.Path) -> None:
    """画一张简单的「架构图」占位（几何图形 + 文字），不依赖外部资源。"""
    from PIL import Image, ImageDraw, ImageFont

    W, H = 640, 480
    im = Image.new("RGB", (W, H), (246, 249, 252))
    d = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 22)
    except Exception:  # noqa: BLE001
        font = ImageFont.load_default()
    boxes = [("接入层", 60, 50), ("网关", 260, 50), ("服务 A", 440, 50),
             ("服务 B", 440, 210), ("存储层", 150, 350)]
    for label, x, y in boxes:
        d.rounded_rectangle([x, y, x + 140, y + 90], radius=12,
                            fill=(232, 240, 250), outline=(27, 79, 138), width=2)
        tw = d.textlength(label, font=font)
        d.text((x + 70 - tw / 2, y + 32), label, fill=(27, 79, 138), font=font)
    for (x1, y1), (x2, y2) in [((200, 95), (260, 95)), ((400, 95), (440, 95)),
                                ((510, 140), (510, 210)), ((440, 255), (290, 380)),
                                ((290, 380), (220, 380))]:
        d.line([x1, y1, x2, y2], fill=(232, 98, 45), width=3)
    im.save(path)


def main(argv: list[str] | None = None) -> int:
    import argparse
    import sys

    ap = argparse.ArgumentParser(prog="slides-gen-gallery",
                                 description="渲染全部版式的样板间（总览图 + 可翻页浏览页）")
    ap.add_argument("--theme", default="corporate-blue", help="渲染主题（默认 corporate-blue）")
    ap.add_argument("--layouts", default="", help="逗号分隔，只渲染指定版式")
    ap.add_argument("--out", type=pathlib.Path, default=None,
                    help="输出目录（默认 ./layouts-gallery）")
    ap.add_argument("--layout-dir", type=pathlib.Path, default=DEFAULT_LAYOUT_DIR)
    ap.add_argument("--theme-dir", type=pathlib.Path, default=DEFAULT_THEME_DIR)
    args = ap.parse_args(argv)

    layouts = [x.strip() for x in args.layouts.split(",") if x.strip()] or None
    out = args.out or pathlib.Path("layouts-gallery")
    try:
        res = build_gallery(args.theme, out, layouts,
                            layout_dir=args.layout_dir, theme_dir=args.theme_dir)
    except Exception as e:  # noqa: BLE001
        print(f"错误：样板间渲染失败 {e}", file=sys.stderr)
        return 1
    print(f"OK 总览 {res['sheet']}")
    print(f"   浏览 {res['gallery']}（双击打开，← → 翻页）")
    print(f"   {len(res['layouts'])} 个版式 · 主题 {args.theme}")
    return 0


if __name__ == "__main__":
    import sys as _s
    _s.exit(main())
