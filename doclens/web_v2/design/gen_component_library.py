# -*- coding: utf-8 -*-
"""组件库总成：按钮 / 文件徽标 / 搜索框 / chip 四族组件集 + 演示页。

产出：designs/component_library.figcraft
  Page 1「组件库」：四族主组件（变体集）
  同页「演示」：每族放实例（instance.create + setProperties 切换变体）
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from figcraft_kit import Doc, MUTED_BG, SURFACE, TEXT, TEXT_CAP  # noqa: E402
from components_figcraft import (  # noqa: E402
    build_button_library, build_badge_library, build_search_library,
    build_chip_library, place_button, place_badge, place_search, place_chip,
    BADGE_SPEC,
)

W, H = 1000, 760
d = Doc()
d.frame("Cortex 组件库", 0, 0, W, H, fill=SURFACE, as_="page")

d.text("lib-title", 32, 28, "Cortex 组件库（Lit 自绘组件 → FigCraft）",
       20, TEXT, True, w=500)
d.text("lib-sub", 32, 58, "规格源：tokens.css + input-box.ts / file-search-box.ts / file-type.ts",
       12, TEXT_CAP, w=620)

# ── 按钮 ──
d.text("sec-btn", 32, 96, "按钮 Button", 15, TEXT, True, w=200)
BTN_SET = build_button_library(d, x=32, y=122)

# ── 文件徽标 ──
d.text("sec-badge", 480, 96, "文件徽标 FileBadge", 15, TEXT, True, w=200)
BADGE_SET = build_badge_library(d, x=480, y=122)

# ── 搜索框 ──
d.text("sec-search", 480, 260, "搜索框 SearchInput", 15, TEXT, True, w=200)
SEARCH_SET = build_search_library(d, x=480, y=260)

# ── chip ──
d.text("sec-chip", 480, 470, "元信息 Chip", 15, TEXT, True, w=200)
CHIP_SET = build_chip_library(d, x=480, y=496)

# ══════════════ 演示区（实例）══════════════
d.rect("demo-line", 32, 640, W - 64, 1, MUTED_BG)
d.text("demo-title", 32, 652, "实例（instance.create → setProperties）",
       15, TEXT, True, w=400)

# 按钮实例
UY = 684
for i, v in enumerate(["primary", "ink", "outline", "danger"]):
    place_button(d, 32 + i * 120, UY, "", variant=v)
# 徽标实例
for i, (ext, _, _) in enumerate(BADGE_SPEC):
    place_badge(d, 560 + i * 30, UY + 2, ext)
# 搜索框实例（focus 态）
place_search(d, 32, UY + 50, state="focus")
# chip 实例
for i, ck in enumerate(["text", "time", "size", "indexed"]):
    place_chip(d, 300 + i * 160, UY + 58, ck)

d.save("component_library")
