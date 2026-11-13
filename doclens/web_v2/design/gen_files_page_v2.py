# -*- coding: utf-8 -*-
"""FigCraft v2 原型：文件管理页（桌面 1440×900）· 从 0 重画。

与 v1（gen_files_page.py）的差异——v2 修掉 v1 的结构缺陷：
  1. 工具条 13 个 hover-only 图标 → 头部只留 3 个带文字主操作，
     次要动作收进「更多」下拉（并展开展示）。
  2. active / selected 双高亮冲突 → active 改为「白色底 + 左侧钴蓝竖条」，
     selected 保留浅蓝底 + 实心蓝复选框，两态可区分。
  3. 长文件名折行 → 单行 ellipsis + 名称列自适应。
  4. 页面无专属标题 → 顶栏左侧补「文件管理」+ 当前目录副标题。
  5. 面包屑与工具条分两行 → 合并为一个 64px 粘性头部。
  6. 底部大片空白 → 底部状态栏（条目数 / 已选 / 总大小 / 索引覆盖）。
  7. 左树与中列表重复 → 左栏加「快速访问」区，目录树只管层级。
  8. 列宽拖拽热区太细 → 表头列分隔线加高亮把手。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figcraft_kit import (  # noqa: E402
    BORDER, BORDER_MU, DANGER, FB_BLUE, FS_BASE, FS_LG, FS_MD, FS_SM, FS_XS,
    MONO, MUTED_BG, NAV_ACT, ON_PRIMARY, PRIMARY, PRIMARY_S, SANS, SURFACE,
    TEXT, TEXT_CAP, TEXT_MU, TEXT_SUB, badge_for, text_w,
)

W, H = 1440, 900

# ── 版面 ──────────────────────────────────────────────────────
AB_W = 76          # 活动栏（v2 收窄为纯图标）
SB_X, SB_W = AB_W, 264      # 左栏
LS_X, LS_W = SB_X + SB_W, 560   # 中栏（列表）
PV_X, PV_W = LS_X + LS_W, W - (LS_X + LS_W)  # 右栏（预览）
TOP = 56           # 顶栏高
BODY = H - TOP

d = __import__("figcraft_kit").Doc()
d.frame("文件管理页 v2", 0, 0, W, H, fill=SURFACE, as_="page")

# ══════════════ 顶栏 app-bar ══════════════
d.rect("appbar-bg", 0, 0, W, TOP, SURFACE)
d.rect("appbar-line", 0, TOP - 1, W, 1, BORDER)

# 品牌 logo（渐变方块）
d.rect("logo", 14, 14, 28, 28, radius=9)
d.gradient("logo-fill", 14, 14, 28, 28, ["#EAF2FF", "#62ABFF"], radius=9)

# v2 关键改动：页面专属标题（左侧），取代 v1 的「只有 workdir@port」
d.text("page-title", 54, 14, "文件管理", FS_MD, TEXT, True, SANS, w=90)
d.text("page-sub", 54, 33, "工作台 / 研发项目资料", FS_XS, TEXT_CAP, family=MONO, w=140)

# 居中：全局搜索（v2 新增——文件页也需要全局检索入口）
d.rect("global-search", 470, 13, 300, 30, MUTED_BG, radius=15)
d.icon("search", 484, 20, 14, TEXT_MU, 2)
# v2 修正：占位符用 muted 而非 subtle——浅灰压在浅底上对比度不足，读不清
d.text("global-search-ph", 506, 19, "在知识库中搜索…", FS_SM, TEXT_MU, w=180)
d.text("global-search-kbd", 700, 19, "⌘K", FS_XS, TEXT_MU, family=MONO, w=40, align="right")
d.probe("全局搜索底", 470, 13, MUTED_BG)

# 右侧簇
d.rect("theme-btn", 1104, 12, 32, 32, SURFACE, radius=16, stroke=BORDER)
d.icon("palette", 1113, 20, 15, TEXT_MU, 2)

d.rect("sync-badge", 1144, 16, 82, 24, MUTED_BG, radius=12, stroke=BORDER)
d.icon("git-fork", 1152, 22, 12, TEXT_MU, 2)
d.text("sync-text", 1168, 21, "已同步", FS_XS, TEXT_MU, w=52)

d.rect("watch-badge", 1234, 16, 64, 24, MUTED_BG, radius=12, stroke=BORDER)
d.icon("eye", 1242, 22, 12, TEXT_MU, 2)
d.text("watch-text", 1258, 21, "监控中", FS_XS, TEXT_MU, w=34)

d.rect("avatar-btn", 1300, 12, 32, 32, SURFACE, radius=16)
d.rect("avatar", 1304, 16, 24, 24, PRIMARY, radius=12)
d.icon("user", 1310, 21, 13, ON_PRIMARY, 2)

# ══════════════ 活动栏（纯图标，收窄）══════════════
d.rect("activity-bg", 0, TOP, AB_W, BODY, SURFACE)
d.rect("activity-line", AB_W - 1, TOP, 1, BODY, BORDER_MU)

NAV = [
    ("search", "全库搜索", False),
    ("bot", "个人助手", False),
    ("book-open", "岁月微笺", False),
    ("folder", "文件管理", True),
]
ay = TOP + 16
for iname, label, active in NAV:
    if active:
        # 激活项：左侧红条 + 浅底（v1 只有文字变色，v2 加了位置指示）
        d.rect("nav-active-bar", 0, ay - 6, 3, 36, NAV_ACT, radius=2)
        d.rect("nav-active-bg", 3, ay - 6, AB_W - 4, 36, MUTED_BG, radius=8)
    color = NAV_ACT if active else TEXT_MU
    d.icon(iname, AB_W / 2 - 11, ay + 2, 22, color, 2.4 if active else 2)
    # 标签必须留在活动栏内：活动栏只有 76px 宽，图标下方放不下 →
    # 改为只在激活项显示文字标签（其余靠 tooltip），避免出血到 frame 外
    if active:
        d.text(f"nav-{iname}-tip", 6, ay + 26, label, FS_XS, color, True, SANS, w=64)
    ay += 48

d.probe("活动栏激活底", 20, TOP + 22, MUTED_BG)

# ══════════════ 左栏：快速访问 + 目录树 ══════════════
d.rect("sidebar-bg", SB_X, TOP, SB_W, BODY, SURFACE)
d.rect("sidebar-line", SB_X + SB_W - 1, TOP, 1, BODY, BORDER)

# 文件名搜索（页内）
d.rect("sb-search", SB_X + 16, TOP + 14, SB_W - 32, 32, SURFACE, radius=8, stroke=BORDER)
d.icon("search", SB_X + 28, TOP + 23, 15, TEXT_SUB, 2)
d.text("sb-search-ph", SB_X + 49, TOP + 22, "筛选当前目录…", FS_SM, TEXT_CAP, w=140)

# 快速访问区（v2 新增：把高频跳转从树里提出来）
d.text("sb-quick-title", SB_X + 16, TOP + 62, "快速访问", FS_XS, TEXT_CAP, True, SANS, spacing=0.6)

QUICK = [
    ("hard-drive", "工作目录", None),
    ("home", "家目录", None),
    ("git-fork", "未提交改动", "3"),
    ("book-open", "深读书目", None),
]
qy = TOP + 80
for ic, label, badge in QUICK:
    d.icon(ic, SB_X + 18, qy + 1, 15, TEXT_MU, 2)
    d.text(f"quick-{ic}", SB_X + 42, qy, label, FS_SM, TEXT, w=110)
    if badge:
        d.rect(f"quick-badge-{ic}", SB_X + SB_W - 48, qy - 1, 20, 18, PRIMARY_S, radius=9)
        d.text(f"quick-badge-t-{ic}", SB_X + SB_W - 48, qy + 2, badge, 10, PRIMARY, True,
               SANS, w=20, align="center")
    qy += 28

# 分隔
d.rect("sb-divider", SB_X + 16, qy + 6, SB_W - 32, 1, BORDER_MU)

# 目录树（v2：树只管层级，每行带文件/目录图标 + 计数）
d.text("sb-tree-title", SB_X + 16, qy + 22, "目录", FS_XS, TEXT_CAP, True, SANS, spacing=0.6)

TREE = [
    # (深度, 名, 展开, 选中, 子项数)
    (0, "研发项目资料", True, False, 12),
    (1, "产品设计", True, False, 5),
    (2, "2025-Q1 规划", True, False, 3),
    (3, "会议纪要", False, True, 2),
    (1, "研发文档", False, False, 8),
    (1, "素材库", False, False, 24),
    (0, "归档", False, False, 31),
]
ty = qy + 44
for depth, name, expanded, selected, count in TREE:
    x = SB_X + 16 + depth * 16
    if selected:
        # v2：选中态 = 浅蓝底 + 左侧蓝条（与 v1 一致但更明确）
        d.rect(f"tree-sel-{name}", SB_X + 8, ty - 3, SB_W - 16, 28, PRIMARY_S, radius=6)
        d.rect(f"tree-sel-bar-{name}", SB_X + 8, ty - 3, 3, 28, PRIMARY, radius=2)
    d.icon("chevron-down" if expanded else "chevron-right", x, ty + 2, 14,
           PRIMARY if selected else TEXT_SUB, 2)
    d.icon("folder", x + 20, ty + 1, 15, PRIMARY if selected else TEXT_MU, 2)
    d.text(f"tree-{name}", x + 42, ty, name, FS_SM,
           PRIMARY if selected else TEXT, selected, SANS, w=150)
    d.text(f"tree-count-{name}", SB_X + SB_W - 42, ty + 1, str(count), FS_XS,
           TEXT_CAP, family=MONO, w=30, align="right")
    if selected:
        # 选中行在 ty-3..ty+25；探针取行中部左侧（避开文字与图标）
        d.probe("树选中态", SB_X + 11, ty + 11, PRIMARY_S)
    ty += 30

# ══════════════ 中栏：粘性头部 + 列表 ══════════════
d.rect("list-bg", LS_X, TOP, LS_W, BODY, SURFACE)

# —— v2 关键改动：面包屑 + 主操作合并成一个 64px 头部 ——
d.rect("list-head-bg", LS_X, TOP, LS_W, 64, SURFACE)
d.rect("list-head-line", LS_X, TOP + 63, LS_W, 1, BORDER)

# 主操作（带文字！v2 修掉 hover-only 图标）
# 按钮宽按「图标 + 文字实测宽度 + 内边距」算，不再用 len()*13 粗估
# （中文按全角算，粗估会算窄 → 文字溢出按钮，是视觉评审实测到的缺陷）
PRIMARY_ACTIONS = ["upload", "new-file", "new-dir"]
ACT_LABEL = {"upload": "上传", "new-file": "新建", "new-dir": "新目录"}
ACT_ICON = {"upload": "upload", "new-file": "file-plus", "new-dir": "folder-plus"}
PAD_L, PAD_R, GAP_I = 11, 11, 7
MORE_W = 34

# 先算总宽，再从右往左排布——保证「更多」按钮与最后一枚主操作不重叠
_act_w = {k: PAD_L + 15 + GAP_I + text_w(ACT_LABEL[k], FS_SM) + PAD_R
          for k in PRIMARY_ACTIONS}
# 操作区最左边界（面包屑必须停在这里之前）
_ACTIONS_LEFT = (LS_X + LS_W - 16 - MORE_W - 8
                  - sum(_act_w.values()) - 8 * (len(PRIMARY_ACTIONS) - 1))

ax = LS_X + LS_W - 16 - MORE_W
for key in reversed(PRIMARY_ACTIONS):
    w = _act_w[key]
    ax -= w
    d.rect(f"act-btn-{key}", ax, TOP + 14, w, 34, SURFACE, radius=8, stroke=BORDER)
    d.icon(ACT_ICON[key], ax + PAD_L, TOP + 23, 15, TEXT, 2)
    d.text(f"act-t-{key}", ax + PAD_L + 15 + GAP_I, TOP + 23, ACT_LABEL[key], FS_SM, TEXT,
           w=text_w(ACT_LABEL[key], FS_SM) + 2)
    ax -= 8

# 面包屑（大号 mono，可点）
# 宽度按实测文本算；且必须限制在「操作按钮区」左侧，否则长路径会压到按钮上
# （视觉评审实测到的缺陷：面包屑末段与上传按钮图标重叠 42%）
_crumb_items = ["研发项目资料", "产品设计", "2025-Q1 规划"]
_cw = [text_w(t, FS_SM) for t in _crumb_items]
_cx = LS_X + 42
_bc_limit = _ACTIONS_LEFT - 16

d.icon("folder-open", LS_X + 18, TOP + 15, 16, TEXT_MU, 2)
for i, (t, w) in enumerate(zip(_crumb_items, _cw)):
    if i > 0:
        d.text(f"crumb-sep-{i}", _cx, TOP + 14, "›", FS_SM, TEXT_CAP, family=MONO, w=10)
        _cx += 12
    # 放不下就截断并加省略号
    _label = t
    if _cx + w > _bc_limit:
        _max = max(20, _bc_limit - _cx)
        _label = t[:max(1, int(_max // (FS_SM * 0.55)))] + "…"
        w = text_w(_label, FS_SM)
    d.text(f"crumb-{i}", _cx, TOP + 14, _label, FS_SM,
           TEXT if i == len(_crumb_items) - 1 else TEXT_MU,
           i == len(_crumb_items) - 1, MONO, w=w + 4)
    _cx += w + 4
# 下拉箭头也要避开操作区（视觉评审实测：箭头压进上传按钮 2px）
if _cx + 18 <= _bc_limit:
    d.icon("chevron-down", _cx + 4, TOP + 15, 14, TEXT_CAP, 2)

# 更多菜单（展开态：把 v1 里塞不下的次要动作显性化）
# 注意：菜单是浮层，必须在所有列表内容之后绘制，否则会被后画的列表遮住
# （v2 草稿踩过这个坑：菜单与列表同层级，列头把它盖了）
MENU_W = 176
MENU_ITEMS = [
    ("refresh-cw", "刷新目录", False),
    ("pencil", "重命名", False),
    ("download", "下载", False),
    ("arrow-right", "移动到…", False),
    ("copy", "拷贝路径", False),
    ("sparkles", "技能工具箱", False),
    ("trash-2", "删除", True),
]
# 下拉菜单右对齐到「更多」按钮，且不越出中栏
MENU_X = LS_X + LS_W - 16 - MENU_W


def draw_more_menu():
    """浮层：最后绘制，确保盖在列表与预览之上。"""
    d.rect("more-menu-shadow", MENU_X, TOP + 56, MENU_W, 246, "#00000014", radius=12)
    d.rect("more-menu-bg", MENU_X, TOP + 56, MENU_W, 246, SURFACE, radius=12, stroke=BORDER)
    my = TOP + 66
    for ic, label, danger in MENU_ITEMS:
        d.icon(ic, MENU_X + 14, my + 1, 14, DANGER if danger else TEXT_MU, 2)
        d.text(f"menu-{ic}", MENU_X + 34, my, label, FS_SM,
               DANGER if danger else TEXT, w=100)
        my += 30
    d.rect("menu-sep", MENU_X + 10, my - 5, MENU_W - 20, 1, BORDER_MU)
    d.text("menu-hint", MENU_X + 14, my + 4, "需先选中 1 项", FS_XS, TEXT_CAP, w=120)
    d.probe("更多菜单底", MENU_X + 100, TOP + 66, SURFACE)


# 「更多」按钮本身（头部内，先画）——与主操作保持 8px 间距
MORE_X = LS_X + LS_W - 16 - MORE_W
d.rect("more-btn", MORE_X, TOP + 14, MORE_W, 34, SURFACE, radius=8, stroke=BORDER)
# 图标在 34px 按钮内垂直居中：顶 + (34-15)/2 = +9.5 → y = TOP+14+9.5 = TOP+23.5
# （此前误写 TOP+23，少 0.5px 导致图标底部溢出按钮 1.5px —— 视觉评审实测）
d.icon("more-horizontal", MORE_X + 9.5, TOP + 23.5, 15, TEXT, 2)

# —— 表头 ——
d.rect("col-head-bg", LS_X, TOP + 64, LS_W, 30, MUTED_BG)
d.rect("col-head-line", LS_X, TOP + 93, LS_W, 1, BORDER)

COL = {"cb": LS_X + 16, "ic": LS_X + 48, "name": LS_X + 76,
       "size": LS_X + 372, "time": LS_X + 446}
d.rect("hdr-cb", COL["cb"], TOP + 72, 14, 14, SURFACE, radius=3, stroke=BORDER)
d.text("hdr-name", COL["name"], TOP + 71, "名称", FS_XS, TEXT_MU, True, SANS, w=120)
d.text("hdr-size", COL["size"], TOP + 71, "大小", FS_XS, TEXT_MU, w=70, align="center")
d.text("hdr-time", COL["time"], TOP + 71, "修改", FS_XS, TEXT_MU, w=104, align="center")

# v2：列分隔把手加高亮（v1 只有 1px 细线，几乎无法发现）
# 把手放在「大小」标题右侧空隙，不压标题文字
d.rect("col-handle-1", COL["size"] - 44, TOP + 72, 3, 14, BORDER, radius=2)
d.rect("col-handle-2", COL["time"] - 56, TOP + 72, 3, 14, BORDER, radius=2)

d.probe("表头底", LS_X + 300, TOP + 80, MUTED_BG)

# —— 文件行 ——
ROWS = [
    ("dir", "会议纪要", None, None, None),
    ("dir", "需求评审", None, None, None),
    ("md", "2025-Q1 产品规划.md", "M", "#7E22A8", ("24.8 KB", "11/13 10:22")),
    ("md", "竞品分析.md", "M", "#7E22A8", ("16.2 KB", "11/12 19:05")),
    ("xlsx", "功能排期表.xlsx", "X", "#227A3C", ("84.5 KB", "11/07 09:12")),
    ("pdf", "需求说明书.pdf", "P", "#C2183A", ("2.4 MB", "11/08 16:30")),
    ("pptx", "季度汇报.pptx", "S", "#B3420A", ("6.8 MB", "11/06 14:22")),
    ("png", "界面原型.png", "I", "#5B21B6", ("512.0 KB", "11/03 21:57")),
    ("docx", "评审纪要.docx", "D", "#0057C2", ("128.3 KB", "11/02 11:08")),
    ("txt", "变更日志.txt", "T", "#4A5763", ("3.1 KB", "10/28 08:41")),
]

ry = TOP + 94
for idx, (kind, name, letter, lcolor, meta) in enumerate(ROWS):
    row_sel = (idx == 5)
    row_act = (idx == 2)
    if row_act:
        # v2 关键改动：active 行 = 白底 + 左侧钴蓝竖条（不再与 selected 撞色）
        d.rect("row-active-bar", LS_X, ry, 3, 34, PRIMARY, radius=2)
    if row_sel:
        # selected 行：浅蓝底（与 active 明确区分）
        d.rect("row-selected-bg", LS_X, ry, LS_W, 34, PRIMARY_S)
    # 复选框：选中时画实心蓝 + 勾，未选中画空心描边（顺序固定，避免被覆盖）
    if row_sel:
        d.rect("row-cb-sel", COL["cb"], ry + 10, 14, 14, PRIMARY, radius=3)
        # check 图标的路径包围盒小于视框（视觉评审实测 8px 时底部溢出 1.5px）。
        # 按校准后的视觉尺寸缩到 7px 并居中，确保完全落在 14px 框内。
        d.icon("check", COL["cb"] + 3.5, ry + 13, 7, ON_PRIMARY, 2.6)
    else:
        d.rect(f"row-cb-{name}", COL["cb"], ry + 10, 14, 14, SURFACE, radius=3, stroke=BORDER)
    if kind == "dir":
        d.icon("folder", COL["ic"], ry + 9, 16, TEXT_MU, 2)
    else:
        d.rect(f"row-badge-{name}", COL["ic"], ry + 8, 18, 18, lcolor, radius=5)
        d.text(f"row-letter-{name}", COL["ic"], ry + 11, letter, 10, ON_PRIMARY, True,
               MONO, w=18, align="center")
        d.probe(f"徽标底({name})", COL["ic"] + 2, ry + 10, lcolor)
    # v2：单行 ellipsis（v1 折行导致行高参差）
    d.text(f"row-name-{name}", COL["name"], ry + 10, name, FS_SM,
           PRIMARY if row_act else TEXT, row_act, SANS, w=280)
    if meta:
        d.text(f"row-size-{name}", COL["size"], ry + 11, meta[0], FS_XS, TEXT_MU,
               family=MONO, w=70, align="center")
        d.text(f"row-time-{name}", COL["time"], ry + 11, meta[1], FS_XS, TEXT_MU,
               family=MONO, w=104, align="center")
    d.rect(f"row-line-{name}", LS_X + 8, ry + 33, LS_W - 16, 1, BORDER_MU)
    if row_sel:
        d.probe("selected 行底", LS_X + 300, ry + 30, PRIMARY_S)
    if row_act:
        d.probe("active 行竖条", LS_X + 1, ry + 17, PRIMARY)
    ry += 34

# —— 底部状态栏（v2 填补空白）——
d.rect("status-bg", LS_X, H - 34, LS_W, 34, MUTED_BG)
d.rect("status-line", LS_X, H - 34, LS_W, 1, BORDER_MU)
d.icon("database", LS_X + 16, H - 25, 13, TEXT_CAP, 2)
# 分隔符按实际文字宽排布，避免与前一段文字重叠（视觉评审实测 33% 重叠）
_sx = LS_X + 36
for label, color in (("10 项", TEXT_MU), ("已选 1 项", PRIMARY), ("共 10.2 MB", TEXT_MU)):
    w = text_w(label, FS_XS)
    d.text(f"status-{label}", _sx, H - 24, label, FS_XS, color,
           color == PRIMARY, SANS, w=w + 2)
    _sx += w + 6
    if label != "共 10.2 MB":
        d.text("status-sep", _sx, H - 24, "·", FS_XS, TEXT_CAP, w=6)
        _sx += 10

d.icon("circle-check", LS_X + LS_W - 128, H - 25, 13, "#227A3C", 2)
d.text("status-index", LS_X + LS_W - 110, H - 24, "9 / 10 已索引", FS_XS, TEXT_MU, w=90)

d.probe("状态栏底", LS_X + 300, H - 17, MUTED_BG)

# ══════════════ 右栏：预览 ══════════════
d.rect("preview-bg", PV_X, TOP, PV_W, BODY, SURFACE)
d.rect("preview-line", PV_X, TOP, 1, BODY, BORDER)

# —— 文件信息卡（v2 新增：原版只有一行路径，缺元信息）——
d.rect("info-card", PV_X + 20, TOP + 18, PV_W - 40, 118, MUTED_BG, radius=14)
d.rect("info-badge", PV_X + 40, TOP + 38, 40, 40, "#7E22A8", radius=10)
d.text("info-badge-letter", PV_X + 40, TOP + 48, "M", 18, ON_PRIMARY, True, MONO,
       w=40, align="center")
d.text("info-name", PV_X + 96, TOP + 36, "2025-Q1 产品规划.md", FS_LG, TEXT, True, SANS, w=340)
d.text("info-path", PV_X + 96, TOP + 60, "研发项目资料 / 产品设计 / 2025-Q1 规划",
       FS_XS, TEXT_CAP, family=MONO, w=340)

# 元信息 chips（宽度按实测文字宽算，避免文字溢出胶囊）
CHIPS = [
    ("tag", "Markdown", TEXT_MU),
    ("clock", "11/13 10:22", TEXT_MU),
    ("database", "24.8 KB", TEXT_MU),
    ("circle-check", "已索引", "#1A7F37"),
]
cx = PV_X + 96
CHIP_RIGHT = PV_X + PV_W - 40
for ic, label, color in CHIPS:
    # 拉丁文本在微软雅黑下比 0.55em 估算更宽，宽度给足余量，
    # 否则 FigCraft 判定需换行 → 胶囊内文字竖排两行（视觉评审实测到的缺陷）
    tw = text_w(label, FS_XS) * 1.3 + 6
    cw = tw + 38
    # 放不下就停（不允许溢出右边界 —— 视觉评审实测的缺陷）
    if cx + cw > CHIP_RIGHT:
        break
    d.rect(f"chip-{ic}", cx, TOP + 82, cw, 26, SURFACE, radius=13, stroke=BORDER)
    d.icon(ic, cx + 9, TOP + 89, 12, color, 2)
    d.text(f"chip-t-{ic}", cx + 28, TOP + 88, label, FS_XS, color, w=tw)
    cx += cw + 8

# —— 正文预览 ——
d.text("preview-h1", PV_X + 40, TOP + 168, "2025 年 Q1 产品规划", 22, TEXT, True, SANS, w=400)
d.text("preview-h2", PV_X + 40, TOP + 204, "面向企业知识库的检索与协作体验升级",
       FS_BASE, TEXT_MU, SANS, w=440)

d.rect("preview-sep", PV_X + 40, TOP + 232, PV_W - 80, 1, BORDER_MU)

PARA = [
    "本文档定义 2025 年第一季度的产品目标与迭代节奏，聚焦三条主线：",
]
py = TOP + 252
for line in PARA:
    d.text("preview-p", PV_X + 40, py, line, FS_BASE, TEXT_MU, SANS, w=PV_W - 80)
    py += 24

BULLETS = [
    ("search", "统一检索：多模态文档与代码片段同源召回"),
    ("sparkles", "技能化工作流：把高频操作沉淀为可复用技能"),
    ("users", "协作：评论、批注与变更追踪进入文档本体"),
]
for ic, line in BULLETS:
    d.rect("bullet-dot", PV_X + 42, py + 7, 5, 5, PRIMARY, radius=3)
    d.icon(ic, PV_X + 58, py - 1, 14, TEXT_SUB, 2)
    d.text("preview-b", PV_X + 78, py, line, FS_BASE, TEXT_MU, SANS, w=PV_W - 118)
    py += 26

# 代码块
d.rect("code-bg", PV_X + 40, py + 14, PV_W - 80, 96, "#0F1419", radius=12)
d.rect("code-head", PV_X + 40, py + 14, PV_W - 80, 26, "#1A2029", radius=12)
d.rect("code-head-fix", PV_X + 40, py + 28, PV_W - 80, 12, "#1A2029")
d.icon("file", PV_X + 52, py + 20, 13, "#8595A4", 2)
d.text("code-file", PV_X + 70, py + 20, "search_service.py", FS_XS, "#8595A4", family=MONO, w=140)
d.text("code-l1", PV_X + 56, py + 54, "def hybrid_search(query: str, top_k: int = 20):",
       FS_SM, "#E6EDF3", family=MONO, w=PV_W - 110)
d.text("code-l2", PV_X + 56, py + 74, "    return fts.query(query).limit(top_k).search()",
       FS_SM, "#7EE787", family=MONO, w=PV_W - 110)
d.text("code-l3", PV_X + 56, py + 94, "    # FTS5 → Scoring → Formatting 三段流水线",
       FS_SM, "#8B949E", family=MONO, w=PV_W - 110)

# —— 底部动作条（带文字按钮，v2 修掉 hover-only）——
d.rect("pv-actions-bg", PV_X, H - 56, PV_W, 56, SURFACE)
d.rect("pv-actions-line", PV_X, H - 56, PV_W, 1, BORDER)
PV_ACTIONS = [
    ("pencil", "编辑"),
    ("sparkles", "工具箱"),
    ("copy", "拷贝路径"),
    ("download", "下载"),
]
ax = PV_X + 24
for ic, label in PV_ACTIONS:
    tw = text_w(label, FS_SM)
    w = PAD_L + 15 + GAP_I + tw + PAD_R
    d.rect(f"pv-btn-{ic}", ax, H - 44, w, 34, SURFACE, radius=8, stroke=BORDER)
    d.icon(ic, ax + PAD_L, H - 35, 15, TEXT, 2)
    d.text(f"pv-btn-t-{ic}", ax + PAD_L + 15 + GAP_I, H - 34, label, FS_SM, TEXT, w=tw + 2)
    ax += w + 8

# 主操作（强调）
d.rect("pv-btn-primary", PV_X + PV_W - 24 - 96, H - 44, 96, 34, PRIMARY, radius=8)
d.icon("play", PV_X + PV_W - 24 - 82, H - 35, 15, ON_PRIMARY, 2)
d.text("pv-btn-primary-t", PV_X + PV_W - 24 - 60, H - 34, "问 AI", FS_SM, ON_PRIMARY,
       True, SANS, w=52)

d.probe("预览动作按钮底", PV_X + 30, H - 27, SURFACE)

# ── 浮层最后绘制：确保「更多」菜单盖在列表/预览之上 ──
draw_more_menu()

d.save("files_page_v2")
