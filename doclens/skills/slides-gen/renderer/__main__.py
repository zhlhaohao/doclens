"""CLI：slides-gen 写稿预检、渲染与验收。

  doctor                     环境自检（playwright/视觉 API/字体/资产完整性）
  analyze  <素材>            素材结构分析（字数/小节/数据点 → 建议页数）
  extract-style <图>         参考图 → 主题 JSON（自动对比度校准）
  check    deck.md           写稿期预检（秒级，不渲染）：容量/大纲/结构/密度/主题对比度
  capacity [--layout 名]     打印各版式容量表
  images   deck.md           列图位清单（编号/来源/路径），重绘替换前用
  preview  deck.md           出三套主题样张（用你自己的封面+内容页），供用户挑风格
  pdf      deck.html         导出 PDF（headless Chromium 打印）
  render   deck.md [-o out.html] [--theme X] [--no-embed]
  qa       deck.html [--pages 1,3] [--outdir DIR] [--no-vision]
  build    deck.md [-o out.html] [--pages ...] [--no-vision]  = render + qa

退出码：0 = 通过；1 = 有问题/未通过页；2 = 输入/环境错误。

推荐顺序：check（ERROR 清零）→ build（视觉验收全过）→ 交付。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import capacity as cap_mod
from . import check as check_mod
from . import images as images_mod
from .html_renderer import LAYOUT_DIR, THEME_DIR, Renderer
from .parser import parse_markdown
from .qa import qa_deck


def _default_html(md: Path) -> Path:
    return md.with_suffix(".html")


def cmd_doctor(args: argparse.Namespace) -> int:
    from .doctor import check as doc_check
    from .doctor import render as doc_render

    rep = doc_check(need_vision=not getattr(args, "no_vision", False))
    if getattr(args, "json", False):
        import json
        print(json.dumps({"ready": rep.ready, "full": rep.full,
                          "items": [vars(i) for i in rep.items]},
                         ensure_ascii=False, indent=2))
    else:
        print(doc_render(rep))
    return 0 if rep.ready else 1


def cmd_analyze(args: argparse.Namespace) -> int:
    from .analyze import analyze_text, read_source, render as an_render

    if not args.path and not args.topic:
        print("错误：给一个素材文件，或用 --topic \"题目\"", file=sys.stderr)
        return 2
    try:
        text = read_source(args.path) if args.path else args.topic
    except Exception as e:  # noqa: BLE001
        print(f"错误：{e}", file=sys.stderr)
        return 1
    a = analyze_text(text, source=str(args.path or ""))
    if getattr(args, "json", False):
        import json
        print(json.dumps(a.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(an_render(a))
    if args.path:
        out = Path(str(args.path.with_suffix("")) + "-analysis.json")
        out.write_text(__import__("json").dumps(a.to_dict(), ensure_ascii=False, indent=2),
                       encoding="utf-8")
        if not getattr(args, "json", False):
            print(f"已写 {out}")
    return 0


def cmd_extract_style(args: argparse.Namespace) -> int:
    from .extract_style import extract

    img: Path = args.image
    if not img.exists():
        print(f"错误：图片不存在 {img}", file=sys.stderr)
        return 2
    tdir = args.theme_dir or THEME_DIR
    try:
        data = extract(img, args.name, tdir, write=not args.dry_run,
                       bg_override=args.bg)
    except Exception as e:  # noqa: BLE001
        print(f"错误：提色失败 {e}", file=sys.stderr)
        return 1
    import json
    print(json.dumps({k: v for k, v in data.items() if not k.startswith("_")},
                     ensure_ascii=False, indent=2))
    c = data["_checks"]
    ok = c["text/bg"] >= 4.5 and c["primary/bg"] >= 3 and c["accent/bg"] >= 3
    print()
    print(f"对比度：text/bg {c['text/bg']} · primary/bg {c['primary/bg']} · "
          f"accent/bg {c['accent/bg']} → {'通过' if ok else '未达标（已尽力校准）'}")
    print(f"参考图类型：{'照片（已自动取白/深底）' if data.get('_mode') == 'photo' else '设计稿'}")
    if data.get("_note"):
        print(f"提示：{data['_note']}")
    if not args.dry_run:
        print(f"已写入 {tdir / (data['name'] + '.json')}")
        print(f"用法：frontmatter 写 theme: {data['name']}")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    md: Path = args.input
    if not md.exists():
        print(f"错误：输入文件不存在 {md}", file=sys.stderr)
        return 2
    res = check_mod.check(md, args.layout_dir, args.theme_dir)
    sink_meta = {"title": ""}
    try:
        from .parser import parse_markdown as _pm
        class _S:
            items: list = []
            def add(self, m): pass
        deck = _pm(md.read_text(encoding="utf-8"), _S())
        sink_meta = deck.meta
    except Exception:  # noqa: BLE001
        pass
    outline_path, json_path = check_mod.save(res, md, sink_meta)
    print(check_mod.format_findings(res))
    print()
    print(check_mod.render_outline(res, sink_meta))
    print()
    print(f"幽灵稿：{outline_path}")
    print(f"结构化：{json_path}")
    if not res.passed:
        print(f"\n有 {len(res.errors)} 个 ERROR，先修完再 build。")
        return 1
    return 0


def cmd_capacity(args: argparse.Namespace) -> int:
    rows = cap_mod.summary(args.layout_dir)
    if getattr(args, "layout", ""):
        rows = [r for r in rows if r["layout"] == args.layout]
        if not rows:
            print(f"没有版式 {args.layout}", file=sys.stderr)
            return 2
    head = ("版式", "要点", "单条字", "总字数", "表行", "表列", "图占比")
    widths = (16, 6, 8, 8, 6, 6, 8)
    print("".join(h.ljust(w) for h, w in zip(head, widths)))
    print("-" * sum(widths))
    for r in rows:
        vals = (r["layout"], r["bullets"], r["bullet_chars"], r["total_chars"],
                r["table_rows"], r["table_cols"], f'{r["image_min_ratio"]:.2f}')
        print("".join(str(v).ljust(w) for v, w in zip(vals, widths)))
    print("\n容量单位：阅读单元（1 汉字 = 1，1 个英文词 = 1）。写稿时按此控制每页信息量。")
    return 0


def cmd_images(args: argparse.Namespace) -> int:
    md: Path = args.input
    if not md.exists():
        print(f"错误：输入文件不存在 {md}", file=sys.stderr)
        return 2
    slots, warns = images_mod.collect(md)
    print(images_mod.render(slots, md))
    for w in warns:
        print(f"  · {w}")
    if slots:
        print(f"\n已写 {images_mod.save_json(slots, md)}")
    return 0


def cmd_preview(args: argparse.Namespace) -> int:
    from .preview import render_previews

    md: Path = args.input
    if not md.exists():
        print(f"错误：输入文件不存在 {md}", file=sys.stderr)
        return 2
    themes = [t.strip() for t in args.themes.split(",") if t.strip()] if args.themes else None
    out_dir = args.out or Path(str(md.with_suffix("")) + "-previews")
    try:
        res = render_previews(md, out_dir, themes,
                              theme_dir=args.theme_dir, layout_dir=args.layout_dir)
    except Exception as e:  # noqa: BLE001
        print(f"错误：样张渲染失败 {e}", file=sys.stderr)
        return 1
    print(f"OK {res.out}")
    print(f"主题：{', '.join(res.themes)}   取自第 {', '.join('P%d' % p for p in res.pages)} 页")
    if res.skipped:
        print(f"跳过不存在的主题：{', '.join(res.skipped)}")
    print("把这图发给用户，说明每套适合什么场合；选定后改 frontmatter 的 theme。")
    return 0


def cmd_pdf(args: argparse.Namespace) -> int:
    from .pdf import export_pdf

    html: Path = args.input
    if not html.exists():
        print(f"错误：HTML 不存在 {html}", file=sys.stderr)
        return 2
    out = args.output or html.with_suffix(".pdf")
    try:
        export_pdf(html, out, annotations=getattr(args, "annotations", False))
    except Exception as e:  # noqa: BLE001
        print(f"错误：PDF 导出失败 {e}", file=sys.stderr)
        return 1
    print(f"OK {out}（{out.stat().st_size / 1024:.0f} KB）")
    return 0


def _maybe_open(path: Path) -> None:
    """--open：用系统默认程序打开产物（失败不影响结果）。"""
    import subprocess
    import sys as _sys

    try:
        if _sys.platform.startswith("win"):
            subprocess.Popen(["cmd", "/c", "start", "", str(path)], shell=False)
        elif _sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])
    except Exception as e:  # noqa: BLE001
        print(f"（提示：自动打开失败 {e}，请手动打开 {path}）", file=sys.stderr)


def cmd_render(args: argparse.Namespace) -> int:
    md: Path = args.input
    if not md.exists():
        print(f"错误：输入文件不存在 {md}", file=sys.stderr)
        return 2
    out = args.output or _default_html(md)
    r = Renderer(layout_dir=args.layout_dir, theme_dir=args.theme_dir)
    try:
        stats = r.render(md, out, theme_override=args.theme,
                         embed_images=not args.no_embed)
    except Exception as e:  # noqa: BLE001
        print(f"错误：渲染失败 {e}", file=sys.stderr)
        return 2
    print(f"OK {out} — {stats['slides']} 页 · {stats['bytes'] / 1024:.0f} KB · "
          f"主题 {stats['theme']} · 画布 {stats['canvas']}")
    if getattr(args, "open", False):
        _maybe_open(out)
    if stats["warnings"]:
        print(f"降级警告 {len(stats['warnings'])} 条：")
        for w in stats["warnings"]:
            print(f"  - {w}")
        if getattr(args, "strict", False):
            print("\n--strict：存在降级警告，按失败处理。")
            return 1
    return 0


def _parse_pages(s: str) -> list[int] | None:
    if not s:
        return None
    out: list[int] = []
    for part in s.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return sorted(set(out))


def _run_qa(html: Path, args: argparse.Namespace) -> int:
    if not html.exists():
        print(f"错误：HTML 不存在 {html}", file=sys.stderr)
        return 2
    outdir = args.outdir or html.with_suffix("")
    res = qa_deck(html, Path(str(outdir) + "-qa"),
                  pages=_parse_pages(getattr(args, "pages", "") or ""),
                  use_vision=not getattr(args, "no_vision", False))
    vision_on = bool(res.get("vision"))
    reason = res.get("degraded_reason") or ""
    explicit_off = "显式关闭" in reason

    if vision_on:
        print(f"验收：{res['passed']}/{res['total']} 页通过（视觉模型已启用）")
    elif explicit_off:
        # 主动关闭 = 正常迭代流程（内容稿阶段），不是问题，给一句话轻提示即可
        print(f"几何检查：{res['passed']}/{res['total']} 页通过"
              f"（内容稿模式，未做审美检查）")
    else:
        # 真降级：模型该配却配不上，必须说清「只查了一半」
        print("=" * 64)
        print("⚠  视觉验收未执行 —— " + (reason or "视觉模型不可用"))
        print("   已检查：元素重叠 / 内容裁切 / 安全边距 / 最小字号 / 信息密度 /")
        print("           强调色预算 / 图片变形（均为确定性规则）")
        print("   未检查：留白失衡 / 层次不清 / 对比度不足 / 配色协调 / 整体观感")
        print("   → 这份结论**不能**等同于「视觉质量已验收」")
        print("   配置方式：全局 .env 写 VISION_API_KEY 等四项，或设置页「模型」tab")
        print("=" * 64)
        print(f"几何检查：{res['passed']}/{res['total']} 页通过")

    print(f"报告：{Path(str(outdir) + '-qa') / 'report.md'}")
    print(f"截图：{Path(str(outdir) + '-qa')}")

    if res["failed_pages"]:
        print("未通过页：" + ", ".join(f"P{p}" for p in res["failed_pages"]))
        for pg in res["pages"]:
            if pg["pass"]:
                continue
            for it in pg["issues"]:
                if it["severity"] == "high":
                    print(f"  P{pg['page']} [{it['type']}] {it['detail']}")
        return 1

    if vision_on:
        print("全部页面通过（几何 + 视觉）。")
    elif explicit_off:
        print("几何检查全部通过。内容确认后跑完整验收即可出交付稿。")
    else:
        print("几何检查全部通过 —— 但审美问题未检查，建议配好视觉模型后重跑。")
    return 0


def cmd_qa(args: argparse.Namespace) -> int:
    return _run_qa(args.input, args)


def cmd_build(args: argparse.Namespace) -> int:
    rc = cmd_render(args)
    if rc != 0:
        return rc
    return _run_qa(args.output or _default_html(args.input), args)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="slides-gen",
                                 description="PPT 中间格式 md → 单文件 HTML 演示稿（含视觉验收）")
    sub = ap.add_subparsers(dest="cmd", required=True)

    def common(p: argparse.ArgumentParser) -> None:
        p.add_argument("input", type=Path, help="输入 md（render/build）或 html（qa）")
        p.add_argument("-o", "--output", type=Path, default=None, help="输出 html 路径")
        p.add_argument("--theme", default="", help="临时覆盖 frontmatter 主题")
        p.add_argument("--layout-dir", type=Path, default=LAYOUT_DIR)
        p.add_argument("--theme-dir", type=Path, default=THEME_DIR)
        p.add_argument("--no-embed", action="store_true", help="图片不内嵌（保留外链相对路径）")
        p.add_argument("--outdir", default="", help="验收输出目录（默认 <name>-qa）")
        p.add_argument("--pages", default="", help="只验收指定页，如 1,3-5")
        p.add_argument("--no-vision", action="store_true", help="只跑几何自检，不调视觉模型")
        p.add_argument("--open", action="store_true", help="渲染完用默认程序打开产物")
        p.add_argument("--strict", action="store_true",
                       help="有降级警告即视为失败（自动化/CI 用）")

    p_doc = sub.add_parser("doctor", help="环境自检")
    p_doc.add_argument("--no-vision", action="store_true", help="不检查视觉模型")
    p_doc.add_argument("--json", action="store_true", help="输出 JSON")
    p_doc.set_defaults(func=cmd_doctor)

    p_an = sub.add_parser("analyze", help="素材结构分析（建议页数）")
    p_an.add_argument("path", nargs="?", type=Path, default=None, help="素材文件")
    p_an.add_argument("--topic", default="", help="只有题目时直接用字符串")
    p_an.add_argument("--json", action="store_true", help="输出 JSON")
    p_an.set_defaults(func=cmd_analyze)

    p_es = sub.add_parser("extract-style", help="参考图 → 主题 JSON")
    p_es.add_argument("image", type=Path, help="参考图路径")
    p_es.add_argument("--name", default="", help="主题名（默认取图片名）")
    p_es.add_argument("--theme-dir", type=Path, default=None)
    p_es.add_argument("--bg", default="", help="强制底色，如 '#FFFFFF'")
    p_es.add_argument("--dry-run", action="store_true", help="只打印不写文件")
    p_es.set_defaults(func=cmd_extract_style)

    p_check = sub.add_parser("check", help="写稿期预检（容量/大纲/结构/密度/对比度）")
    p_check.add_argument("input", type=Path, help="deck md 文件")
    p_check.add_argument("--layout-dir", type=Path, default=LAYOUT_DIR)
    p_check.add_argument("--theme-dir", type=Path, default=THEME_DIR)
    p_check.add_argument("--strict", action="store_true", help="warn 也视为失败")
    p_check.set_defaults(func=cmd_check)

    p_cap = sub.add_parser("capacity", help="打印各版式容量表")
    p_cap.add_argument("--layout", default="", help="只看某个版式")
    p_cap.add_argument("--layout-dir", type=Path, default=LAYOUT_DIR)
    p_cap.set_defaults(func=cmd_capacity)

    p_images = sub.add_parser("images", help="列图位清单（重绘/替换图片前用）")
    p_images.add_argument("input", type=Path, help="deck md 文件")
    p_images.set_defaults(func=cmd_images)

    p_preview = sub.add_parser("preview", help="出三套主题样张供用户挑风格")
    p_preview.add_argument("input", type=Path, help="deck md 文件")
    p_preview.add_argument("--themes", default="", help="逗号分隔的主题名（默认稳妥三套）")
    p_preview.add_argument("--out", type=Path, default=None, help="输出目录")
    p_preview.add_argument("--layout-dir", type=Path, default=LAYOUT_DIR)
    p_preview.add_argument("--theme-dir", type=Path, default=THEME_DIR)
    p_preview.set_defaults(func=cmd_preview)

    p_pdf = sub.add_parser("pdf", help="HTML deck → PDF")
    p_pdf.add_argument("input", type=Path, help="deck html 文件")
    p_pdf.add_argument("-o", "--output", type=Path, default=None, help="输出 PDF 路径")
    p_pdf.add_argument("--annotations", action="store_true", help="页下附带演讲备注")
    p_pdf.set_defaults(func=cmd_pdf)

    p_render = sub.add_parser("render", help="md → HTML")
    common(p_render)
    p_render.set_defaults(func=cmd_render)

    p_qa = sub.add_parser("qa", help="对已生成的 HTML 做视觉验收")
    common(p_qa)
    p_qa.set_defaults(func=cmd_qa)

    p_build = sub.add_parser("build", help="render + qa 一轮（推荐入口）")
    common(p_build)
    p_build.set_defaults(func=cmd_build)

    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
