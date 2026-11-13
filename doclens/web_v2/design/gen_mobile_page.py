# -*- coding: utf-8 -*-
"""生成 FigCraft 复刻：doclens 文件管理页 · 移动端布局（390×844）。

对应源码：doclens/web_v2/frontend/src/views/files-view.ts（.mobile-layout）
        doclens/web_v2/frontend/src/components/file-list.ts（_renderMobileHeader）
        doclens/web_v2/frontend/src/components/tab-bar.ts
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figcraft_kit import (  # noqa: E402
    BORDER, BORDER_MU, DANGER, FB_BLUE, FS_BASE, FS_MD, FS_SM, FS_XS,
    ICON_MD, ICON_SM, ICON_XL, ICON_XS, MONO,
    MUTED_BG, NAV_ACT, ON_PRIMARY, PRIMARY, PRIMARY_HOVER, PRIMARY_S, SANS, SURFACE,
    TEXT, TEXT_CAP, TEXT_MU, TEXT_SUB, Doc, badge_for,
)

W, H = 390, 844
d = Doc()
d.frame("文件管理页-移动端", 0, 0, W, H, fill=SURFACE, as_="page")

# ── 顶栏 app-bar（56px）────────────────────────────────────────
d.rect("appbar-bg", 0, 0, W, 56, SURFACE)
d.rect("appbar-line", 0, 55, W, 1, BORDER)
d.rect("logo", 12, 14, 28, 28, radius=8)
d.gradient("logo-fill", 12, 14, 28, 28, ["#ECF3FF", "#62ABFF"], radius=8)
d.probe("logo 渐变左上", 15, 17, "#ECF3FF", tol=40)

# 居中标题：cortex@7860（mono 粗体，@ 蓝色）
d.text("wb-title-1", 152, 20, "cortex", FS_MD, TEXT, True, MONO, w=52, align="right")
d.text("wb-title-at", 204, 20, "@", FS_MD, PRIMARY_HOVER, True, MONO, w=10)
d.text("wb-title-2", 214, 20, "7860", FS_MD, TEXT, True, MONO, w=42)
d.probe("顶栏标题区", 100, 30, SURFACE)

# 右侧：同步/监控徽标在移动端隐藏，只留头像
d.rect("avatar", 342, 16, 24, 24, PRIMARY, radius=12)
d.icon("user", 348, 21, 13, ON_PRIMARY, 2)

# ── 文件名搜索框（files-view 树栏顶部）─────────────────────────
d.rect("search-box", 12, 64, W - 24, 34, SURFACE, radius=8, stroke=BORDER)
d.icon("search", 24, 73, ICON_MD, TEXT_CAP, 2)
d.text("search-ph", 46, 72, "按文件名搜索…", FS_SM, TEXT_CAP, w=200)
d.probe("搜索框描边", 12, 81, BORDER)

# ── file-list 移动端头部（返回 / 面包屑 / more）───────────────
d.rect("list-header-bg", 0, 106, W, 40, SURFACE)
d.rect("list-header-line", 0, 145, W, 1, BORDER)
d.rect("mobile-back", 8, 112, 30, 30, SURFACE, radius=15)
d.icon("arrow-left", 15, 119, ICON_SM, TEXT, 2)
d.text("crumb-1", 50, 119, "根目录", FS_SM, TEXT_MU, family=MONO, w=52)
d.text("crumb-sep", 104, 119, "›", FS_SM, TEXT_CAP, family=MONO, w=10)
d.text("crumb-2", 116, 119, "doclens", FS_SM, TEXT_MU, family=MONO, w=60)
d.text("crumb-sep2", 178, 119, "›", FS_SM, TEXT_CAP, family=MONO, w=10)
d.text("crumb-cur", 190, 119, "frontend", FS_SM, TEXT, family=MONO, w=70)
d.rect("mobile-more", 344, 112, 30, 30, SURFACE, radius=15)
d.icon("more-horizontal", 351, 119, ICON_MD, TEXT, 2)

# ── 列表表头（复选 / 名称 / 大小 / 修改）──────────────────────
d.rect("list-col-header", 0, 146, W, 27, MUTED_BG)
d.rect("hdr-cb", 12, 152, 14, 14, SURFACE, radius=3, stroke=BORDER)
d.text("hdr-name", 40, 152, "名称", FS_XS, TEXT_MU, w=140)
d.text("hdr-size", 210, 152, "大小", FS_XS, TEXT_MU, w=60, align="center")
d.text("hdr-time", 280, 152, "修改", FS_XS, TEXT_MU, w=100, align="center")
d.probe("表头底色", 190, 160, MUTED_BG)

# ── 文件行 ───────────────────────────────────────────────────
ROWS = [
    ("dir", "doclens", None, None),
    ("dir", "frontend", None, None),
    ("dir", "static", None, None),
    ("md", "CLAUDE.md", "18.4 KB", "2025/11/13 10:22"),
    ("md", "README.md", "6.1 KB", "2025/11/12 19:05"),
    ("txt", "requirements.txt", "1.2 KB", "2025/11/10 08:41"),
    ("pdf", "架构设计.pdf", "2.4 MB", "2025/11/08 16:30"),
    ("xlsx", "周报-2025.xlsx", "84.5 KB", "2025/11/07 09:12"),
    ("png", "封面.png", "512.0 KB", "2025/11/03 21:57"),
]

ry = 173
for idx, (kind, name, size, mtime) in enumerate(ROWS):
    if idx == 3:
        d.rect("row-active", 0, ry, W, 30, PRIMARY_S)
        d.probe("active 行高亮", 340, ry + 27, PRIMARY_S)
    d.rect(f"row-cb-{name}", 12, ry + 8, 14, 14, SURFACE, radius=3, stroke=BORDER)
    if kind == "dir":
        d.icon("folder", 36, ry + 7, ICON_MD, TEXT_MU, 2)
    else:
        letter, color = badge_for(name)
        d.rect(f"row-badge-{name}", 36, ry + 6, 18, 18, color, radius=4)
        d.text(f"row-letter-{name}", 36, ry + 9, letter, 10, ON_PRIMARY, True, MONO,
               w=18, align="center")
        d.probe(f"徽标底({name})", 38, ry + 8, color)
    d.text(f"row-name-{name}", 64, ry + 8, name, FS_SM, TEXT, w=140)
    if size:
        d.text(f"row-size-{name}", 210, ry + 9, size, FS_XS, TEXT_MU, family=MONO,
               w=60, align="center")
        d.text(f"row-time-{name}", 280, ry + 8, mtime, FS_XS, TEXT_MU, family=MONO,
               w=100, align="center")
    ry += 30

# ── 底部 tab-bar（56px，4 项，移动端专属）─────────────────────
d.rect("tabbar-bg", 0, H - 56, W, 56, SURFACE)
d.rect("tabbar-line", 0, H - 56, W, 1, BORDER)
TABS = [
    ("search", "全库搜索", False),
    ("bot", "个人助手", False),
    ("book-open", "岁月微笺", False),
    ("folder", "文件管理", True),
]
for i, (ic, label, active) in enumerate(TABS):
    cx = i * (W / 4) + (W / 8)
    color = NAV_ACT if active else TEXT_MU
    d.icon(ic, cx - 11, H - 42, ICON_XL, color, 2.4 if active else 2)
    d.text(f"tab-{ic}", cx - 40, H - 20, label, FS_XS, color, active, w=80, align="center")
# 激活 tab（索引 3）的图标/文字均用深红描边——线稿是空心，改为区域内搜色
act_cx = 3 * (W / 4) + (W / 8)
d.probe_region("tab 激活色", act_cx - 14, H - 44, act_cx + 14, H - 34, NAV_ACT)
d.probe("tabbar 顶线", W / 2, H - 56, BORDER)

d.save("files_page_mobile")
