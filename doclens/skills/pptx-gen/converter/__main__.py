"""CLI 入口：python -m converter deck.md -o deck.pptx [--theme x --layout-dir D --theme-dir D --strict]"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .renderer import Converter, DEFAULT_LAYOUT_DIR, DEFAULT_THEME_DIR


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="pptx-gen-converter",
                                 description="PPT 中间格式 (md) → PPTX")
    ap.add_argument("input", type=Path, help="中间格式 md 文件")
    ap.add_argument("-o", "--output", type=Path, default=None,
                    help="输出 pptx 路径（缺省 = 输入同名 .pptx）")
    ap.add_argument("--theme", default="", help="临时覆盖 frontmatter 主题")
    ap.add_argument("--layout-dir", type=Path, default=DEFAULT_LAYOUT_DIR)
    ap.add_argument("--theme-dir", type=Path, default=DEFAULT_THEME_DIR)
    ap.add_argument("--strict", action="store_true", help="有警告即报错（调试用）")
    args = ap.parse_args(argv)

    src = args.input
    if not src.exists():
        print(f"错误：输入文件不存在 {src}", file=sys.stderr)
        return 2
    out = args.output or src.with_suffix(".pptx")

    cvt = Converter(layout_dir=args.layout_dir, theme_dir=args.theme_dir,
                    strict=args.strict)
    try:
        cvt.convert(src, out, theme_override=args.theme)
    except Exception as e:  # noqa: BLE001
        print(f"错误：转换失败 {e}", file=sys.stderr)
        return 1
    print(f"OK {out}（{len(cvt.warn.items)} 条降级警告）")
    if cvt.warn.items:
        for w in cvt.warn.items:
            print(f"  - {w}")
    if args.strict and cvt.warn.items:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
