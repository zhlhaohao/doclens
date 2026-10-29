"""导出 PDF：headless Chromium 打印，一页一张幻灯片。

依赖 playwright（视觉验收已依赖），无需 LibreOffice。
打印样式由 base.css 的 @media print 提供：所有 .slide 强制 display:flex、
每页 break-after、隐藏演示 UI 与动画。
"""

from __future__ import annotations

import sys
from pathlib import Path


def export_pdf(html_path: Path, out_path: Path, canvas: tuple[int, int] = (1280, 720),
               annotations: bool = False) -> Path:
    """把 deck.html 打印成 PDF。

    annotations=False 时不打印备注（视觉与演示态一致）；
    True 时在每页下方追加备注区（适合内部复盘稿）。
    """
    from playwright.sync_api import sync_playwright

    out_path.parent.mkdir(parents=True, exist_ok=True)
    url = html_path.resolve().as_uri() + ("?qa=1" if not annotations else "")

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": canvas[0], "height": canvas[1]})
        page.goto(url)
        # 等字体与图片就绪（qa 模式下有 data-qa-ready 标记；普通模式兜底等待）
        try:
            page.wait_for_function("document.body.getAttribute('data-qa-ready') === '1'",
                                   timeout=20000)
        except Exception:  # noqa: BLE001
            page.wait_for_timeout(1500)
        if annotations:
            page.add_style_tag(content=_ANNOT_CSS)
        page.emulate_media(media="print")
        page.pdf(
            path=str(out_path),
            width=f"{canvas[0]}px",
            height=f"{canvas[1]}px",
            print_background=True,
            margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            prefer_css_page_size=True,
        )
        browser.close()
    return out_path


# 备注版：每页底部加一条浅色备注带（仅导出 PDF 时注入，不改 HTML 本身）
_ANNOT_CSS = """
@media print {
  .slide { position: relative !important; }
  .slide .notes {
    display: block !important;
    position: absolute !important;
    left: 0; right: 0; bottom: 0;
    max-height: 22%;
    overflow: hidden;
    padding: 10px 20px !important;
    background: #F5F5F5 !important;
    color: #444 !important;
    font-size: 13px !important;
    line-height: 1.45 !important;
    border-top: 1px solid #DDD !important;
  }
}
"""


def main(argv: list[str] | None = None) -> int:
    import argparse

    ap = argparse.ArgumentParser(prog="slides-gen-pdf", description="HTML deck → PDF")
    ap.add_argument("input", type=Path, help="deck.html")
    ap.add_argument("-o", "--output", type=Path, default=None, help="输出 PDF 路径")
    ap.add_argument("--annotations", action="store_true", help="页下附带演讲备注")
    args = ap.parse_args(argv)

    if not args.input.exists():
        print(f"错误：HTML 不存在 {args.input}", file=sys.stderr)
        return 2
    out = args.output or args.input.with_suffix(".pdf")
    try:
        export_pdf(args.input, out, annotations=args.annotations)
    except Exception as e:  # noqa: BLE001
        print(f"错误：PDF 导出失败 {e}", file=sys.stderr)
        return 1
    kb = out.stat().st_size / 1024
    print(f"OK {out}（{kb:.0f} KB）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
