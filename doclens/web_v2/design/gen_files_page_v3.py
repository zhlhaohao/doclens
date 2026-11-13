# -*- coding: utf-8 -*-
"""FigCraft v3 原型：文件管理页（桌面 1440×900）· 分层结构版。

v2 的 262 个图层全平铺在一个 frame 下，图层树里无法按区域操作。
本版按**界面语义**重组为嵌套分组：

    文件管理页 v3
    ├── 顶栏 AppBar
    │   ├── 品牌区 / 全局搜索 / 状态区
    ├── 活动栏 ActivityBar
    │   └── 导航项 ×4
    ├── 侧栏 Sidebar
    │   ├── 搜索框 / 快速访问 / 目录树
    │   │   └── 树节点 ×7
    ├── 主区 Workspace
    │   ├── 列表头 → 面包屑 / 主操作区
    │   ├── 文件表格 → 表头 / 文件行 ×10
    │   └── 状态栏
    └── 预览区 Preview
        ├── 文件信息卡 → 元信息 chips
        ├── 正文预览 → 要点 ×3 / 代码块
        └── 动作条

**坐标约定**：本文件里所有绘制坐标都是**页面坐标**（绝对），
figcraft_kit 的 _rel() 会按父分组的绝对原点自动换算成「相对父 frame」的
坐标（FigCraft 的实际语义，见 probe_nested.py）。

分层后的副作用（已由 review_visual.py 复验）：
  - frame 默认 clip=true → 越界的行分隔线/文字会被裁掉，故分组尺寸留足余量
  - 分组原点即其子元素的裁剪框左上角
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from components_figcraft import (  # noqa: E402
    build_badge_library, build_button_library, place_badge, place_button,
)
from figcraft_kit import (  # noqa: E402
    BORDER, BORDER_MU, DANGER, FS_BASE, FS_LG, FS_MD, FS_SM, FS_XS,
    ICON_MD, ICON_SM, ICON_XL, ICON_XS, MONO,
    MUTED_BG, NAV_ACT, ON_PRIMARY, PRIMARY, PRIMARY_S, SANS, SURFACE, TEXT,
    TEXT_CAP, TEXT_MU, badge_for, text_w,
)

W, H = 1440, 900

# ── 版面 ──────────────────────────────────────────────────────
AB_W = 76                 # 活动栏
SB_W = 264                # 侧栏
LS_W = 560                # 主区列表
TOP = 56                  # 顶栏
SB_X = AB_W
LS_X = AB_W + SB_W
PV_X = LS_X + LS_W
PV_W = W - PV_X

d = __import__("figcraft_kit").Doc()
d.frame("文件管理页 v3", 0, 0, W, H, fill=SURFACE, as_="page")

# ═══════════════════════════════════════════════════════════════
# 1. 顶栏 AppBar
# ═══════════════════════════════════════════════════════════════
d.group("顶栏 AppBar", 0, 0, W, TOP, as_="appbar")
d.rect("appbar-bg", 0, 0, W, TOP, SURFACE, parent="appbar")
d.rect("appbar-line", 0, TOP - 1, W, 1, BORDER, parent="appbar")

d.group("品牌区", 0, 0, 460, TOP, as_="brand", parent="appbar")
d.rect("logo", 14, 14, 28, 28, radius=9, parent="brand")
d.gradient("logo-fill", 14, 14, 28, 28, ["#EAF2FF", "#62ABFF"], radius=9, parent="brand")
d.text("page-title", 54, 14, "文件管理", FS_MD, TEXT, True, SANS, w=90, parent="brand")
d.text("page-sub", 54, 33, "工作台 / 研发项目资料", FS_XS, TEXT_CAP, family=MONO,
       w=140, parent="brand")

d.group("全局搜索", 460, 0, 320, TOP, as_="gsearch", parent="appbar")
d.rect("global-search", 470, 13, 300, 30, MUTED_BG, radius=15, parent="gsearch")
d.icon("search", 484, 20, ICON_SM, TEXT_MU, 2, parent="gsearch")
d.text("global-search-ph", 506, 19, "在知识库中搜索…", FS_SM, TEXT_MU, w=180, parent="gsearch")
d.text("global-search-kbd", 700, 19, "⌘K", FS_XS, TEXT_MU, family=MONO, w=40,
       align="right", parent="gsearch")
d.probe("全局搜索底", 470, 13, MUTED_BG)

d.group("状态区", 1080, 0, W - 1080, TOP, as_="status", parent="appbar")
d.rect("theme-btn", 1104, 12, 32, 32, SURFACE, radius=16, stroke=BORDER, parent="status")
d.icon("palette", 1113, 20, ICON_MD, TEXT_MU, 2, parent="status")
d.rect("sync-badge", 1144, 16, 82, 24, MUTED_BG, radius=12, stroke=BORDER, parent="status")
d.icon("git-fork", 1152, 22, ICON_XS, TEXT_MU, 2, parent="status")
d.text("sync-text", 1168, 21, "已同步", FS_XS, TEXT_MU, w=52, parent="status")
d.rect("watch-badge", 1234, 16, 64, 24, MUTED_BG, radius=12, stroke=BORDER, parent="status")
d.icon("eye", 1242, 22, ICON_XS, TEXT_MU, 2, parent="status")
d.text("watch-text", 1258, 21, "监控中", FS_XS, TEXT_MU, w=34, parent="status")
d.rect("avatar-btn", 1300, 12, 32, 32, SURFACE, radius=16, parent="status")
d.rect("avatar", 1304, 16, 24, 24, PRIMARY, radius=12, parent="status")
d.icon("user", 1310, 21, ICON_SM, ON_PRIMARY, 2, parent="status")

# ═══════════════════════════════════════════════════════════════
# 2. 活动栏 ActivityBar
# ═══════════════════════════════════════════════════════════════
d.group("活动栏 ActivityBar", 0, TOP, AB_W, H - TOP, as_="activity")
d.rect("activity-bg", 0, TOP, AB_W, H - TOP, SURFACE, parent="activity")
d.rect("activity-line", AB_W - 1, TOP, 1, H - TOP, BORDER_MU, parent="activity")

NAV = [("search", "全库搜索", False), ("bot", "个人助手", False),
       ("book-open", "岁月微笺", False), ("folder", "文件管理", True)]
ay = TOP + 16
for i, (iname, label, active) in enumerate(NAV):
    d.group("导航项 " + str(i + 1) + "·" + label, 0, ay, AB_W, 58,
             as_=f"nav{i}", parent="activity")
    if active:
        d.rect("nav-active-bar", 0, ay + 6, 3, 36, NAV_ACT, radius=2, parent=f"nav{i}")
        d.rect("nav-active-bg", 3, ay + 6, AB_W - 4, 36, MUTED_BG, radius=8, parent=f"nav{i}")
    color = NAV_ACT if active else TEXT_MU
    d.icon(iname, AB_W / 2 - 11, ay + 18, ICON_XL, color, 2.4 if active else 2, parent=f"nav{i}")
    if active:
        d.text(f"nav-{iname}-label", 6, ay + 42, label, FS_XS, color, True, SANS,
               w=64, parent=f"nav{i}")
    ay += 48

d.probe("活动栏激活底", 20, TOP + 22, MUTED_BG)

# ═══════════════════════════════════════════════════════════════
# 3. 侧栏 Sidebar
# ═══════════════════════════════════════════════════════════════
d.group("侧栏 Sidebar", SB_X, TOP, SB_W, H - TOP, as_="sidebar")
d.rect("sidebar-bg", SB_X, TOP, SB_W, H - TOP, SURFACE, parent="sidebar")
d.rect("sidebar-line", SB_X + SB_W - 1, TOP, 1, H - TOP, BORDER, parent="sidebar")

d.group("搜索框", SB_X, TOP, SB_W, 60, as_="sbsearch", parent="sidebar")
d.rect("sb-search-box", SB_X + 16, TOP + 14, SB_W - 32, 32, SURFACE, radius=8,
       stroke=BORDER, parent="sbsearch")
d.icon("search", SB_X + 28, TOP + 23, ICON_MD, TEXT_CAP, 2, parent="sbsearch")
d.text("sb-search-ph", SB_X + 49, TOP + 22, "筛选当前目录…", FS_SM, TEXT_CAP,
       w=140, parent="sbsearch")

d.group("快速访问", SB_X, TOP + 60, SB_W, 140, as_="quick", parent="sidebar")
d.text("quick-title", SB_X + 16, TOP + 62, "快速访问", FS_XS, TEXT_CAP, True, SANS,
       spacing=0.6, w=80, parent="quick")
QUICK = [("hard-drive", "工作目录", None), ("home", "家目录", None),
         ("git-fork", "未提交改动", "3"), ("book-open", "深读书目", None)]
qy = TOP + 80
for i, (ic, label, badge) in enumerate(QUICK):
    # 分组要覆盖到徽标位置（徽标在侧栏右缘），否则被自身裁剪框裁掉
    d.group("快速访问项 " + str(i + 1) + "·" + label, SB_X, qy, SB_W, 28,
             as_=f"q{i}", parent="quick")
    d.icon(ic, SB_X + 18, qy + 1, ICON_MD, TEXT_MU, 2, parent=f"q{i}")
    d.text(f"q-label-{ic}", SB_X + 42, qy, label, FS_SM, TEXT, w=110, parent=f"q{i}")
    if badge:
        d.rect(f"q-badge-{ic}", SB_X + SB_W - 48, qy, 20, 18, PRIMARY_S, radius=9,
               parent=f"q{i}")
        d.text(f"q-badge-t-{ic}", SB_X + SB_W - 48, qy + 3, badge, 10, PRIMARY, True,
               SANS, w=20, align="center", parent=f"q{i}")
    qy += 28

d.group("目录树", SB_X, TOP + 200, SB_W, 420, as_="tree", parent="sidebar")
d.text("tree-title", SB_X + 16, TOP + 202, "目录", FS_XS, TEXT_CAP, True, SANS,
       spacing=0.6, w=60, parent="tree")
TREE = [
    (0, "研发项目资料", True, False, 12),
    (1, "产品设计", True, False, 5),
    (2, "2025-Q1 规划", True, False, 3),
    (3, "会议纪要", False, True, 2),
    (1, "研发文档", False, False, 8),
    (1, "素材库", False, False, 24),
    (0, "归档", False, False, 31),
]
# ── 目录树图标规格 ──
# FigCraft 会把 path 拉伸填满节点框（忽略自身宽高比），
# 故 icon() 统一用 **viewBox 缩放系数**（size/24）——所有图标同比例、
# 各自保留原生比例，不会出现「三角被拉成方块、比文件夹大」。
# icon() 的 size = **墨迹对角线**的目标大小（归一化后视觉重量一致）。
ICON_SIZE = ICON_MD   # 墨迹对角线（px）
# 折叠三角对角线仅 13.4（folder 是 26.2），归一化后会被放大 → 需反向补偿。
#   展开（横向 12×6）：optical 0.78
#   折叠（竖向 6×12）：optical 1.15（竖向视觉上更重）
TRI_OPT_EXPANDED = 0.78
TRI_OPT_COLLAPSED = 0.85
ROW_H = 30           # 行高
ty = TOP + 224
for i, (depth, name, expanded, selected, count) in enumerate(TREE):
    d.group(f"树节点 {i + 1}·{name}", SB_X + 8, ty, SB_W - 16, ROW_H,
             as_=f"t{i}", parent="tree")
    if selected:
        d.rect(f"tree-sel-{name}", SB_X + 8, ty, SB_W - 16, ROW_H, PRIMARY_S,
               radius=6, parent=f"t{i}")
        d.rect(f"tree-sel-bar-{name}", SB_X + 8, ty, 3, ROW_H, PRIMARY, radius=2,
               parent=f"t{i}")
    x = SB_X + 16 + depth * 16
    # 三角：按形态分别做光学补偿，垂直居中并上移 1px 与文件夹对齐
    opt = TRI_OPT_EXPANDED if expanded else TRI_OPT_COLLAPSED
    tri_h = (6 if expanded else 12) * (ICON_SIZE / 13.4) * opt
    d.icon("chevron-down" if expanded else "chevron-right",
           x, ty + (ROW_H - tri_h) / 2 - 1, ICON_SIZE, TEXT_CAP, 2,
           parent=f"t{i}", optical=opt)
    # 文件夹：墨迹 20×17
    d.icon("folder", x + 22, ty + (ROW_H - 17 * ICON_SIZE / 26.2) / 2 - 1, ICON_SIZE,
           PRIMARY if selected else TEXT_MU, 2, parent=f"t{i}")
    d.text(f"tree-{name}", x + 42, ty + 7, name, FS_SM, PRIMARY if selected else TEXT,
           selected, SANS, w=150, parent=f"t{i}")
    d.text(f"tree-count-{name}", SB_X + SB_W - 50, ty + 8, str(count), FS_XS,
           TEXT_CAP, family=MONO, w=30, align="right", parent=f"t{i}")
    if selected:
        d.probe("树选中态", SB_X + 11, ty + 11, PRIMARY_S)
    ty += ROW_H

# ═══════════════════════════════════════════════════════════════
# 4. 主区 Workspace
# ═══════════════════════════════════════════════════════════════
d.group("主区 Workspace", LS_X, TOP, LS_W, H - TOP, as_="work")

# —— 列表头 ——
d.group("列表头", LS_X, TOP, LS_W, 64, as_="lhead", parent="work")
d.rect("list-head-bg", LS_X, TOP, LS_W, 64, SURFACE, parent="lhead")
d.rect("list-head-line", LS_X, TOP + 63, LS_W, 1, BORDER, parent="lhead")

PRIMARY_ACTIONS = ["upload", "new-file", "new-dir"]
ACT_LABEL = {"upload": "上传", "new-file": "新建", "new-dir": "新目录"}
ACT_ICON = {"upload": "upload", "new-file": "file-plus", "new-dir": "folder-plus"}
PAD_L, PAD_R, GAP_I = 11, 11, 7
MORE_W = 34

_act_w = {k: PAD_L + 15 + GAP_I + text_w(ACT_LABEL[k], FS_SM) + PAD_R
          for k in PRIMARY_ACTIONS}
_ACTIONS_LEFT = LS_X + (LS_W - 16 - MORE_W - 8 - sum(_act_w.values())
                        - 8 * (len(PRIMARY_ACTIONS) - 1))

_crumb_items = ["研发项目资料", "产品设计", "2025-Q1 规划"]
_cw = [text_w(t, FS_SM) for t in _crumb_items]
_cx = LS_X + 42
# 面包屑的可用右界 = 操作区左缘 - 16
_bc_limit = _ACTIONS_LEFT - 16
# 分组宽度即裁剪框：面包屑整体必须落在 [_cx 起, _bc_limit] 内
_BC_W = _bc_limit - LS_X
d.group("面包屑", LS_X, TOP, _BC_W, 64, as_="crumbs", parent="lhead")
d.icon("folder-open", LS_X + 18, TOP + 15, ICON_MD, TEXT_MU, 2, parent="crumbs")

# 先算总需：图标 42 + 各段宽 + 分隔符 12×2
_need = 42 + sum(_cw) + 24
_over = _need - (_bc_limit - _cx)      # 超出量
for i, (t, w) in enumerate(zip(_crumb_items, _cw)):
    if i > 0:
        d.text(f"crumb-sep-{i}", _cx, TOP + 14, "›", FS_SM, TEXT_CAP, family=MONO,
               w=10, parent="crumbs")
        _cx += 12
    _label = t
    # 空间不足时**从最前的一段开始截断**（末段是当前目录，最重要，
    # 视觉评审实测：末段超出会被分组裁剪框裁掉）
    if _over > 0 and i < len(_crumb_items) - 1:
        _keep = max(24, w - _over)
        _label = t[:max(1, int(_keep // (FS_SM * 0.55)))] + "…"
        _over -= (w - text_w(_label, FS_SM))
        w = text_w(_label, FS_SM)
    d.text(f"crumb-{i}", _cx, TOP + 14, _label, FS_SM,
           TEXT if i == len(_crumb_items) - 1 else TEXT_MU,
           i == len(_crumb_items) - 1, MONO, w=w + 4, parent="crumbs")
    _cx += w + 4
if _cx + 18 <= _bc_limit:
    d.icon("crumb-more", _cx + 4, TOP + 15, ICON_SM, TEXT_CAP, 2, parent="crumbs")

d.group("主操作区", _ACTIONS_LEFT, TOP, LS_X + LS_W - _ACTIONS_LEFT, 64,
         as_="actions", parent="lhead")
# 按钮组件集建在主画布右侧空地（x≥1500，不得用负坐标——
# 负坐标会撑大渲染 bounds 使页面整体偏移，探针全失准，实测踩坑）。
# 实例经 setProperties 切换变体；改主组件即全稿联动。
_BTN_SET = build_button_library(d, x=1520, y=60)
_BADGE_SET = build_badge_library(d, x=1520, y=620)
ax = LS_X + LS_W - 16 - MORE_W
for key in reversed(PRIMARY_ACTIONS):
    w = _act_w[key]
    ax -= w
    place_button(d, ax, TOP + 14, ACT_LABEL[key], variant=f"outline-{key}")
    ax -= 8
d.rect("more-btn", LS_X + LS_W - 16 - MORE_W, TOP + 14, MORE_W, 34, SURFACE, radius=8,
       stroke=BORDER, parent="actions")
d.icon("more-horizontal", LS_X + LS_W - 16 - MORE_W + 9.5, TOP + 23.5, ICON_MD, TEXT, 2,
       parent="actions")

# —— 文件表格（顶端到状态栏之间）——
_TABLE_H = (H - 34) - (TOP + 64)     # 状态栏上沿 - 表头下沿
d.group("文件表格", LS_X, TOP + 64, LS_W, _TABLE_H, as_="table", parent="work")

d.group("表头", LS_X, TOP + 64, LS_W, 30, as_="thead", parent="table")
d.rect("col-head-bg", LS_X, TOP + 64, LS_W, 30, MUTED_BG, parent="thead")
d.rect("col-head-line", LS_X, TOP + 93, LS_W, 1, BORDER, parent="thead")
COL = {"cb": LS_X + 16, "ic": LS_X + 48, "name": LS_X + 76,
       "size": LS_X + 372, "time": LS_X + 446}
d.rect("hdr-cb", COL["cb"], TOP + 72, 14, 14, SURFACE, radius=3, stroke=BORDER, parent="thead")
d.text("hdr-name", COL["name"], TOP + 71, "名称", FS_XS, TEXT_MU, True, SANS, w=120, parent="thead")
d.text("hdr-size", COL["size"], TOP + 71, "大小", FS_XS, TEXT_MU, w=70, align="center", parent="thead")
d.text("hdr-time", COL["time"], TOP + 71, "修改", FS_XS, TEXT_MU, w=104, align="center", parent="thead")
d.rect("col-handle-1", COL["size"] - 44, TOP + 72, 3, 14, BORDER, radius=2, parent="thead")
d.rect("col-handle-2", COL["time"] - 56, TOP + 72, 3, 14, BORDER, radius=2, parent="thead")
d.probe("表头底", LS_X + 300, TOP + 80, MUTED_BG)

ROWS = [
    ("dir", "会议纪要", None, None),
    ("dir", "需求评审", None, None),
    ("md", "2025-Q1 产品规划.md", "M", ("24.8 KB", "11/13 10:22")),
    ("md", "竞品分析.md", "M", ("16.2 KB", "11/12 19:05")),
    ("xlsx", "功能排期表.xlsx", "X", ("84.5 KB", "11/07 09:12")),
    ("pdf", "需求说明书.pdf", "P", ("2.4 MB", "11/08 16:30")),
    ("pptx", "季度汇报.pptx", "S", ("6.8 MB", "11/06 14:22")),
    ("png", "界面原型.png", "I", ("512.0 KB", "11/03 21:57")),
    ("docx", "评审纪要.docx", "D", ("128.3 KB", "11/02 11:08")),
    ("txt", "变更日志.txt", "T", ("3.1 KB", "10/28 08:41")),
]
ry = TOP + 94
for idx, (kind, name, letter, meta) in enumerate(ROWS):
    row_sel = (idx == 5)
    row_act = (idx == 2)
    d.group(f"文件行 {idx + 1}·{name}", LS_X, ry, LS_W, 34,
             as_=f"r{idx}", parent="table")
    if row_act:
        d.rect("row-active-bar", LS_X, ry, 3, 34, PRIMARY, radius=2, parent=f"r{idx}")
    if row_sel:
        d.rect("row-selected-bg", LS_X, ry, LS_W, 34, PRIMARY_S, parent=f"r{idx}")
        d.rect("row-cb-sel", COL["cb"], ry + 10, 14, 14, PRIMARY, radius=3, parent=f"r{idx}")
        d.icon("check", COL["cb"] + 3.5, ry + 13, 7, ON_PRIMARY, 2.6, parent=f"r{idx}")
    else:
        d.rect(f"row-cb-{name}", COL["cb"], ry + 10, 14, 14, SURFACE, radius=3,
               stroke=BORDER, parent=f"r{idx}")
    if kind == "dir":
        d.icon("folder", COL["ic"], ry + 9, ICON_MD, TEXT_MU, 2, parent=f"r{idx}")
    else:
        ext = name.rsplit(".", 1)[-1].lower()
        place_badge(d, COL["ic"], ry + 8, ext)
        # 探针期望色 = 该扩展名的徽标色（实例切换变体后应渲染对应色）
        d.probe(f"徽标底({name})", COL["ic"] + 2, ry + 10, badge_for(name)[1])
    d.text(f"row-name-{name}", COL["name"], ry + 10, name, FS_SM,
           PRIMARY if row_act else TEXT, row_act, SANS, w=280, parent=f"r{idx}")
    if meta:
        d.text(f"row-size-{name}", COL["size"], ry + 11, meta[0], FS_XS, TEXT_MU,
               family=MONO, w=70, align="center", parent=f"r{idx}")
        d.text(f"row-time-{name}", COL["time"], ry + 11, meta[1], FS_XS, TEXT_MU,
               family=MONO, w=104, align="center", parent=f"r{idx}")
    d.rect(f"row-line-{name}", LS_X + 8, ry + 33, LS_W - 16, 1, BORDER_MU, parent=f"r{idx}")
    if row_sel:
        d.probe("selected 行底", LS_X + 300, ry + 30, PRIMARY_S)
    if row_act:
        d.probe("active 行竖条", LS_X + 1, ry + 17, PRIMARY)
    ry += 34

# —— 状态栏 ——
d.group("状态栏", LS_X, H - 34, LS_W, 34, as_="statusbar", parent="work")
d.rect("status-bg", LS_X, H - 34, LS_W, 34, MUTED_BG, parent="statusbar")
d.rect("status-line", LS_X, H - 34, LS_W, 1, BORDER_MU, parent="statusbar")
d.icon("database", LS_X + 16, H - 25, ICON_SM, TEXT_CAP, 2, parent="statusbar")
_sx = LS_X + 36
for label, color in (("10 项", TEXT_MU), ("已选 1 项", PRIMARY), ("共 10.2 MB", TEXT_MU)):
    w = text_w(label, FS_XS)
    d.text(f"status-{label}", _sx, H - 24, label, FS_XS, color, color == PRIMARY, SANS,
           w=w + 2, parent="statusbar")
    _sx += w + 6
    if label != "共 10.2 MB":
        d.text("status-sep", _sx, H - 24, "·", FS_XS, TEXT_CAP, w=6, parent="statusbar")
        _sx += 10
d.icon("circle-check", LS_X + LS_W - 128, H - 25, ICON_SM, "#1A7F37", 2, parent="statusbar")
d.text("status-index", LS_X + LS_W - 110, H - 24, "9 / 10 已索引", FS_XS, TEXT_MU,
       w=90, parent="statusbar")
d.probe("状态栏底", LS_X + 300, H - 17, MUTED_BG)

# ═══════════════════════════════════════════════════════════════
# 5. 预览区 Preview
# ═══════════════════════════════════════════════════════════════
d.group("预览区 Preview", PV_X, TOP, PV_W, H - TOP, as_="preview")
d.rect("preview-bg", PV_X, TOP, PV_W, H - TOP, SURFACE, parent="preview")
d.rect("preview-line", PV_X, TOP, 1, H - TOP, BORDER, parent="preview")

d.group("文件信息卡", PV_X + 20, TOP + 18, PV_W - 40, 118, as_="infocard",
         parent="preview")
d.rect("info-card-bg", PV_X + 20, TOP + 18, PV_W - 40, 118, MUTED_BG, radius=14,
       parent="infocard")
d.rect("info-badge", PV_X + 40, TOP + 38, 40, 40, "#7E22A8", radius=10, parent="infocard")
d.text("info-badge-letter", PV_X + 40, TOP + 48, "M", 18, ON_PRIMARY, True, MONO,
       w=40, align="center", parent="infocard")
d.text("info-name", PV_X + 96, TOP + 36, "2025-Q1 产品规划.md", FS_LG, TEXT, True,
       SANS, w=340, parent="infocard")
d.text("info-path", PV_X + 96, TOP + 60, "研发项目资料 / 产品设计 / 2025-Q1 规划",
       FS_XS, TEXT_CAP, family=MONO, w=340, parent="infocard")

d.group("元信息 chips", PV_X + 96, TOP + 82, PV_W - 136, 26, as_="chips",
         parent="infocard")
CHIPS = [("tag", "Markdown", TEXT_MU), ("clock", "11/13 10:22", TEXT_MU),
         ("database", "24.8 KB", TEXT_MU), ("circle-check", "已索引", "#1A7F37")]
cx = PV_X + 96
for i, (ic, label, color) in enumerate(CHIPS):
    tw = text_w(label, FS_XS) * 1.3 + 6
    cw = tw + 38
    if cx + cw > PV_X + PV_W - 40:
        break
    d.group(f"chip {i + 1}·{label}", cx, TOP + 82, cw, 26, as_=f"chip{i}",
             parent="chips")
    d.rect(f"chip-box-{ic}", cx, TOP + 82, cw, 26, SURFACE, radius=13, stroke=BORDER,
           parent=f"chip{i}")
    d.icon(ic, cx + 9, TOP + 89, ICON_XS, color, 2, parent=f"chip{i}")
    d.text(f"chip-t-{ic}", cx + 28, TOP + 88, label, FS_XS, color, w=tw, parent=f"chip{i}")
    cx += cw + 8

d.group("正文预览", PV_X + 40, TOP + 168, PV_W - 80, 320, as_="body", parent="preview")
d.text("preview-h1", PV_X + 40, TOP + 168, "2025 年 Q1 产品规划", 22, TEXT, True,
       SANS, w=400, parent="body")
d.text("preview-h2", PV_X + 40, TOP + 204, "面向企业知识库的检索与协作体验升级",
       FS_BASE, TEXT_MU, SANS, w=440, parent="body")
d.rect("preview-sep", PV_X + 40, TOP + 232, PV_W - 80, 1, BORDER_MU, parent="body")
d.text("preview-p", PV_X + 40, TOP + 252, "本文档定义 2025 年第一季度的产品目标与迭代节奏，聚焦三条主线：",
       FS_BASE, TEXT_MU, SANS, w=PV_W - 80, parent="body")
BULLETS = [("search", "统一检索：多模态文档与代码片段同源召回"),
           ("sparkles", "技能化工作流：把高频操作沉淀为可复用技能"),
           ("users", "协作：评论、批注与变更追踪进入文档本体")]
by = TOP + 284
for i, (ic, line) in enumerate(BULLETS):
    d.group(f"要点 {i + 1}", PV_X + 40, by, PV_W - 80, 26, as_=f"bul{i}",
             parent="body")
    d.rect("bullet-dot", PV_X + 42, by + 7, 5, 5, PRIMARY, radius=3, parent=f"bul{i}")
    d.icon(ic, PV_X + 58, by - 1, ICON_SM, TEXT_CAP, 2, parent=f"bul{i}")
    d.text(f"bullet-text", PV_X + 78, by, line, FS_BASE, TEXT_MU, SANS,
           w=PV_W - 118, parent=f"bul{i}")
    by += 26

d.group("代码块", PV_X + 40, by + 14, PV_W - 80, 96, as_="code", parent="body")
d.rect("code-bg", PV_X + 40, by + 14, PV_W - 80, 96, "#0F1419", radius=12, parent="code")
d.rect("code-head", PV_X + 40, by + 14, PV_W - 80, 26, "#1A2029", radius=12, parent="code")
d.rect("code-head-fix", PV_X + 40, by + 28, PV_W - 80, 12, "#1A2029", parent="code")
d.icon("file", PV_X + 52, by + 20, ICON_XS, "#8595A4", 2, parent="code")
d.text("code-file", PV_X + 70, by + 20, "search_service.py", FS_XS, "#8595A4",
       family=MONO, w=140, parent="code")
d.text("code-l1", PV_X + 56, by + 54, "def hybrid_search(query: str, top_k: int = 20):",
       FS_SM, "#E6EDF3", family=MONO, w=PV_W - 110, parent="code")
d.text("code-l2", PV_X + 56, by + 74, "    return fts.query(query).limit(top_k).search()",
       FS_SM, "#7EE787", family=MONO, w=PV_W - 110, parent="code")
d.text("code-l3", PV_X + 56, by + 94, "    # FTS5 → Scoring → Formatting 三段流水线",
       FS_SM, "#8B949E", family=MONO, w=PV_W - 110, parent="code")

d.group("动作条", PV_X, H - 56, PV_W, 56, as_="pvactions", parent="preview")
d.rect("pv-actions-bg", PV_X, H - 56, PV_W, 56, SURFACE, parent="pvactions")
d.rect("pv-actions-line", PV_X, H - 56, PV_W, 1, BORDER, parent="pvactions")
PV_ACTIONS = [("pencil", "编辑"), ("sparkles", "工具箱"),
              ("copy", "拷贝路径"), ("download", "下载")]
ax = PV_X + 24
for i, (ic, label) in enumerate(PV_ACTIONS):
    tw = text_w(label, FS_SM)
    w = PAD_L + 15 + GAP_I + tw + PAD_R
    d.group(f"动作 {i + 1}·{label}", ax, H - 44, w, 34, as_=f"pva{i}",
             parent="pvactions")
    d.rect(f"pv-btn-{ic}", ax, H - 44, w, 34, SURFACE, radius=8, stroke=BORDER,
           parent=f"pva{i}")
    d.icon(ic, ax + PAD_L, H - 35, ICON_MD, TEXT, 2, parent=f"pva{i}")
    d.text(f"pv-btn-t-{ic}", ax + PAD_L + 15 + GAP_I, H - 34, label, FS_SM, TEXT,
           w=tw + 2, parent=f"pva{i}")
    ax += w + 8
d.group("动作·问 AI", PV_X + PV_W - 24 - 96, H - 44, 96, 34, as_="pva_ai",
         parent="pvactions")
d.rect("pv-btn-primary", PV_X + PV_W - 24 - 96, H - 44, 96, 34, PRIMARY, radius=8,
       parent="pva_ai")
d.icon("play", PV_X + PV_W - 24 - 82, H - 35, ICON_MD, ON_PRIMARY, 2, parent="pva_ai")
d.text("pv-btn-primary-t", PV_X + PV_W - 24 - 60, H - 34, "问 AI", FS_SM, ON_PRIMARY,
       True, SANS, w=52, parent="pva_ai")
d.probe("预览动作按钮底", PV_X + 30, H - 27, SURFACE)

# ═══════════════════════════════════════════════════════════════
# 6. 「更多」下拉浮层（最后绘制，确保盖在列表与预览之上）
# ═══════════════════════════════════════════════════════════════
_MX = LS_X + LS_W - 16 - 176
d.group("更多菜单浮层", _MX, TOP + 56, 176, 246, as_="more-menu")
# 阴影用 --cortex-shadow-md 的基色（rgba(20,22,26,0.18) ≈ #14161A@18%），不私造纯黑
d.rect("more-menu-shadow", _MX, TOP + 56, 176, 246, "#14161A2E", radius=12, parent="more-menu")
d.rect("more-menu-bg", _MX, TOP + 56, 176, 246, SURFACE, radius=12, stroke=BORDER,
       parent="more-menu")
MENU_ITEMS = [("refresh-cw", "刷新目录", False), ("pencil", "重命名", False),
              ("download", "下载", False), ("arrow-right", "移动到…", False),
              ("copy", "拷贝路径", False), ("sparkles", "技能工具箱", False),
              ("trash-2", "删除", True)]
my = TOP + 66
for i, (ic, label, danger) in enumerate(MENU_ITEMS):
    d.group(f"菜单项 {i + 1}·{label}", _MX + 10, my, 156, 30, as_=f"mi{i}",
             parent="more-menu")
    d.icon(ic, _MX + 14, my + 8, ICON_SM, DANGER if danger else TEXT_MU, 2, parent=f"mi{i}")
    d.text(f"menu-{ic}", _MX + 34, my + 7, label, FS_SM, DANGER if danger else TEXT,
           w=100, parent=f"mi{i}")
    my += 30
d.rect("menu-sep", _MX + 10, my - 4, 156, 1, BORDER_MU, parent="more-menu")
d.text("menu-hint", _MX + 14, my + 6, "需先选中 1 项", FS_XS, TEXT_CAP, w=120,
       parent="more-menu")
d.probe("更多菜单底", _MX + 100, TOP + 66, SURFACE)

d.save("files_page_v3")
