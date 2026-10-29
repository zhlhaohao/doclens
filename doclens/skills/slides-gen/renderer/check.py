"""写稿期预检：不渲染、不调视觉模型，秒级返回。

产出：
- stdout：问题清单（error 优先）+ 幽灵稿（纯标题）
- `<name>-outline.md`：幽灵稿文件，供用户确认叙事线
- `<name>-check.json`：结构化结果

检查面：
1. 容量（每版式的 data-cap：要点数/单条字数/总字数/表格行列）
2. 大纲（标题是否结论式、长度、缺失、封面/结尾）
3. 结构（连续三页同版式、同版式刷屏、缺章节页）
4. 密度（字数过少/过多）
5. 主题色板对比度（WCAG）
6. 图标名有效性（若用到）
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from .capacity import CapacityIssue, check_slide, clen, read_cap
from .parser import parse_markdown

# 话题式标题的典型词（这类标题不含结论，是目录标签）
TOPIC_WORDS = (
    "背景", "概述", "介绍", "简介", "总结", "回顾", "前言", "导语",
    "目录", "议程", "说明", "总览", "概览", "现状", "问题", "方案",
)

MIN_TITLE, MAX_TITLE = 4, 22
DENSITY_LOW, DENSITY_HIGH = 60, 260       # 单页正文阅读单元


@dataclass
class Finding:
    level: str          # error | warn | info
    page: int
    kind: str
    detail: str
    hint: str = ""

    def line(self) -> str:
        tag = f"P{self.page}" if self.page else "--"
        head = f"[{self.level.upper()}] {tag} {self.kind}"
        return f"{head}：{self.detail}" + (f"\n        → {self.hint}" if self.hint else "")


@dataclass
class CheckResult:
    md: str = ""
    slides: int = 0
    findings: list[Finding] = field(default_factory=list)
    outline: list[dict] = field(default_factory=list)

    @property
    def errors(self) -> list[Finding]:
        return [f for f in self.findings if f.level == "error"]

    @property
    def warns(self) -> list[Finding]:
        return [f for f in self.findings if f.level == "warn"]

    @property
    def passed(self) -> bool:
        return not self.errors


class _WarnSink:
    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, msg: str) -> None:
        self.items.append(msg)


def _looks_like_topic(title: str) -> bool:
    t = title.strip()
    return any(w in t for w in TOPIC_WORDS) and len(t) <= 12


def check(md_path: Path, layout_dir: Path, theme_dir: Path) -> CheckResult:
    text = md_path.read_text(encoding="utf-8")
    sink = _WarnSink()
    deck = parse_markdown(text, sink)
    res = CheckResult(md=str(md_path), slides=len(deck.slides))

    # 解析阶段的降级警告 → info
    for w in sink.items:
        res.findings.append(Finding("info", 0, "parse", w))

    caps: dict[str, object] = {}

    def cap_of(name: str):
        if name not in caps:
            caps[name] = read_cap(layout_dir / f"{name}.html")
        return caps[name]

    layouts_used: list[str] = []
    title_slide_seen = False
    section_seen = False

    for i, slide in enumerate(deck.slides, 1):
        layout = slide.directive.get("layout", "title-content")
        layouts_used.append(layout)
        if layout == "title":
            title_slide_seen = True
        if layout == "section":
            section_seen = True

        cap = cap_of(layout)
        for ci in check_slide(slide, i, cap):  # type: CapacityIssue
            res.findings.append(Finding("warn", ci.page, f"cap/{ci.field}",
                                        ci.detail, ci.hint))

        # 标题检查
        h1 = next((b for b in slide.blocks if b.kind == "heading" and b.level == 1), None)
        title_text = ""
        if h1 is not None:
            title_text = "".join(r.text for r in h1.runs).strip()
        elif layout in ("title-content", "two-col", "image-left", "image-right"):
            res.findings.append(Finding(
                "warn", i, "outline/无标题",
                f"{layout} 版式缺少一级标题（# 标题）",
                "给每页一个结论式标题，便于读者快速抓要点"))
        if title_text:
            n = clen(title_text)
            if n < MIN_TITLE:
                res.findings.append(Finding(
                    "warn", i, "outline/标题过短",
                    f"标题仅 {n} 字：「{title_text}」",
                    f"标题写成 {MIN_TITLE}-{MAX_TITLE} 字的结论句"))
            elif n > MAX_TITLE:
                res.findings.append(Finding(
                    "warn", i, "outline/标题过长",
                    f"标题 {n} 字，超过 {MAX_TITLE} 字：「{title_text[:30]}…」",
                    "把标题压成短结论，细节移到正文"))
            if _looks_like_topic(title_text):
                res.findings.append(Finding(
                    "warn", i, "outline/话题式标题",
                    f"「{title_text}」像目录标签而非结论",
                    "标题写出这一页的结论（如「自建 vs 采购：怎么选」→「数据主权是硬约束」）"))
        # 幽灵稿覆盖每一页（无标题页也列出，标明版式，便于用户发现结构问题）
        res.outline.append({"page": i, "layout": layout, "title": title_text,
                            "notes": (slide.notes or "")[:60]})

        # 密度
        total = 0
        for b in slide.blocks:
            if b.kind == "list":
                total += sum(clen("".join(r.text for r in runs)) for _, runs, _ in b.list_items)
            elif b.kind in ("para", "quote"):
                total += clen("".join(r.text for r in b.runs) if b.runs else "\n".join(b.lines))
            elif b.kind == "heading" and b.level > 1:
                total += clen("".join(r.text for r in b.runs))
        if layout not in ("title", "section", "quote") and 0 < total < DENSITY_LOW:
            res.findings.append(Finding(
                "warn", i, "density/过稀",
                f"正文仅 {total} 个阅读单元，页面会显空",
                "补充支撑要点、数据或配图"))
        if total > DENSITY_HIGH:
            res.findings.append(Finding(
                "warn", i, "density/过密",
                f"正文 {total} 个阅读单元，超过 {DENSITY_HIGH}",
                "拆页，或把细节移入 notes 讲稿"))

    # 结构检查
    if deck.slides and not title_slide_seen:
        res.findings.append(Finding(
            "warn", 1, "structure/缺封面",
            "首屏不是 title 版式",
            "第一页用 `<!-- slide: layout=title -->` 做封面"))
    if len(deck.slides) > 12 and not section_seen:
        res.findings.append(Finding(
            "info", 0, "structure/缺章节页",
            f"{len(deck.slides)} 页但没有 section 过渡页",
            "每 5-7 页插一页 section，帮助听众定位"))
    run = 1
    for i in range(1, len(layouts_used)):
        if layouts_used[i] == layouts_used[i - 1]:
            run += 1
            if run >= 3:
                res.findings.append(Finding(
                    "warn", i + 1, "structure/版式重复",
                    f"连续 {run} 页使用 {layouts_used[i]} 版式",
                    "换一个版式（如 two-col / image-right）打破单调"))
        else:
            run = 1

    # ---- 主题合法性（拼错会在渲染时静默回退 clean-white）----
    theme_name = str(deck.meta.get("theme", "clean-white"))
    if not (theme_dir / f"{theme_name}.json").exists():
        available = sorted(p.stem for p in theme_dir.glob("*.json"))
        res.findings.append(Finding(
            "error", 0, "theme/未知主题",
            f"theme \"{theme_name}\" 不存在（渲染会回退 clean-white）",
            f"可用主题：{', '.join(available[:8])}"
            + (f" 等 {len(available)} 套" if len(available) > 8 else "")))

    # ---- 版式合法性（拼错会在渲染时降级 title-content）----
    layouts_dir = layout_dir
    available_layouts = {p.stem for p in layouts_dir.glob("*.html")}
    if available_layouts:
        for i, slide in enumerate(deck.slides, 1):
            lay = slide.directive.get("layout", "title-content")
            if lay and lay not in available_layouts:
                res.findings.append(Finding(
                    "error", i, "layout/未知版式",
                    f"版式 \"{lay}\" 不存在（渲染会降级为 title-content）",
                    f"可用：{', '.join(sorted(available_layouts))}"))

    # ---- 图片存在性（路径写错 → 渲染成占位框）----
    md_dir = md_path.parent
    for i, slide in enumerate(deck.slides, 1):
        for b in slide.blocks:
            if b.kind != "image":
                continue
            raw = (b.image_path or "").strip()
            if not raw:
                res.findings.append(Finding(
                    "error", i, "image/空路径",
                    "图片块没有路径", "写成 ![P{页}-图{序号} 用途](相对路径)"))
                continue
            fp = Path(raw)
            full = fp if fp.is_absolute() else (md_dir / fp)
            if not full.exists():
                res.findings.append(Finding(
                    "error", i, "image/文件不存在",
                    f"图片找不到：{raw}（渲染会变虚线占位框）",
                    "检查相对路径（相对 md 文件所在目录），或用即梦重新生成"))
            elif b.alt and not re.match(r"^P\d+-图\d+", b.alt.strip()):
                res.findings.append(Finding(
                    "info", i, "image/缺图位编号",
                    f"图片 alt \"{b.alt[:20]}\" 缺图位编号",
                    "alt 写成 `P{页}-图{序号} 用途`，重绘时才能精确指代"))

    # ---- 主题对比度 ----
    res.findings.extend(_check_theme_contrast(theme_name, theme_dir))

    return res


def _check_theme_contrast(theme_name: str, theme_dir: Path) -> list[Finding]:
    """WCAG 对比度预算：正文/背景 ≥ 4.5，大字/强调 ≥ 3.0。"""
    from .theme import load_theme

    palette: dict = {}

    def sink(msg: str) -> None:
        palette["warn"] = msg

    th = load_theme(theme_name, theme_dir, sink)
    if "warn" in palette:
        return [Finding("warn", 0, "theme/未知", palette["warn"], "检查 frontmatter theme 名")]

    out: list[Finding] = []
    pairs = [
        ("text", "bg", 4.5, "正文/背景"),
        ("text", "bg-alt", 4.5, "正文/浅底"),
        ("text-muted", "bg", 3.0, "次要文字/背景"),
        ("primary", "bg", 3.0, "主色/背景"),
        ("accent", "bg", 3.0, "强调色/背景"),
    ]
    for fg, bg, need, label in pairs:
        c1, c2 = th.colors.get(fg), th.colors.get(bg)
        if not c1 or not c2:
            continue
        ratio = _contrast(c1, c2)
        if ratio is None:
            continue
        if ratio < need:
            out.append(Finding(
                "warn", 0, "theme/对比度不足",
                f"主题 {theme_name} 的{label}对比度 {ratio:.2f}:1，低于 {need}:1",
                f"调深 {fg} 或调浅 {bg}（当前 {c1} / {c2}）"))
    return out


def _contrast(hex1: str, hex2: str) -> float | None:
    def lum(h: str) -> float | None:
        h = h.strip().lstrip("#")
        if len(h) != 6:
            return None
        try:
            r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
        except ValueError:
            return None
        f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4  # noqa: E731
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

    l1, l2 = lum(hex1), lum(hex2)
    if l1 is None or l2 is None:
        return None
    hi, lo = max(l1, l2), min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


# ---------------------------------------------------------------- 幽灵稿

def render_outline(res: CheckResult, meta: dict) -> str:
    """幽灵稿：只有标题与结构，供用户在投入设计前确认叙事线。"""
    title = meta.get("title") or "（未命名）"
    lines = [f"# {title} — 大纲确认", ""]
    lines.append(f"共 {res.slides} 页。**只读标题**：连起来读应是一段完整叙事，"
                 f"若读不通顺说明页面顺序或标题需要调整。")
    lines.append("")
    for item in res.outline:
        pad = "　" * (4 - len(str(item["page"])))
        t = item['title'] or f"（无标题 · {item['layout']}）"
        lines.append(f"{pad}P{item['page']:<3} {t}")
    if not res.outline:
        lines.append("（本 deck 没有可提取的标题）")
    lines.append("")
    note_count = sum(1 for i in res.outline if i["notes"])
    lines.append(f"---\n\n附带演讲备注的页：{note_count} / {res.slides} 页")
    return "\n".join(lines)


def format_findings(res: CheckResult, limit: int = 40) -> str:
    if not res.findings:
        return "检查通过：无问题。"
    order = {"error": 0, "warn": 1, "info": 2}
    items = sorted(res.findings, key=lambda f: (order.get(f.level, 3), f.page))
    out = []
    for f in items[:limit]:
        out.append(f.line())
    if len(items) > limit:
        out.append(f"... 还有 {len(items) - limit} 条（见 JSON 报告）")
    e, w = len(res.errors), len(res.warns)
    out.append("")
    out.append(f"合计：error {e} · warn {w} · info {len(res.findings) - e - w}")
    return "\n".join(out)


def save(res: CheckResult, md_path: Path, meta: dict) -> tuple[Path, Path]:
    stem = md_path.with_suffix("")
    outline_path = Path(f"{stem}-outline.md")
    outline_path.write_text(render_outline(res, meta), encoding="utf-8")
    json_path = Path(f"{stem}-check.json")
    json_path.write_text(json.dumps({
        "md": res.md,
        "slides": res.slides,
        "passed": res.passed,
        "findings": [asdict(f) for f in res.findings],
        "outline": res.outline,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    return outline_path, json_path
