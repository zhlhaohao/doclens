# -*- coding: utf-8 -*-
"""生成 FigCraft 复刻：doclens/doclens 文件管理页（桌面布局 1440x900）。

输出：designs/files_page.json（figcraft-cli run 的命令脚本）
"""
import json
import os
import re

# 脚本位于 <仓库根>/.doclens/tools/figcraft/，上溯两级即仓库根
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
LUCIDE = os.path.join(ROOT, "doclens", "web_v2", "frontend", "node_modules", "lucide-static", "icons")
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "designs")

# ── 设计 token（Cortex light 主题，desktop 断点字号）──────────────
BG        = "#FFFFFF"
SURFACE   = "#FFFFFF"
MUTED_BG  = "#F1F4F7"
BORDER    = "#CED0D4"
BORDER_MU = "#DEE3E9"
TEXT      = "#0A1317"
TEXT_MU   = "#4B4C4F"
TEXT_SUB  = "#8595A4"
PRIMARY   = "#0064E0"
PRIMARY_S = "#E8F0FE"
NAV_ACT   = "#B91C1C"
DANGER    = "#E41E3F"

SANS = "Microsoft YaHei"
MONO = "Liberation Mono"

FS_XS, FS_SM, FS_BASE, FS_MD, FS_LG = 11, 12, 13, 14, 15

cmds = []
_ids = {}
probes = []  # (名称, x, y, 期望色)


def probe(name, x, y, exp, tol=14):
    probes.append((name, int(x), int(y), exp, tol))


def _next_name(prefix):
    _ids[prefix] = _ids.get(prefix, 0) + 1
    return f"{prefix}-{_ids[prefix]}"


def rect(name, x, y, w, h, fill=None, radius=None, stroke=None, sw=1, parent="page"):
    p = {"fill": fill if fill else "#00000000", "cornerRadius": radius if radius else 0}
    if stroke:
        p["stroke"] = stroke
        p["strokeWeight"] = sw
        p["strokeAlign"] = "inside"
    cmd = {"command": "node.create", "params": {
        "type": "rectangle", "name": name, "x": x, "y": y,
        "width": w, "height": h, "props": p}}
    if parent is not None:
        cmd["params"]["parent"] = {"$ref": parent}
    cmds.append(cmd)
    return cmd


def text(name, x, y, s, size=FS_SM, color=TEXT, bold=False, family=SANS,
         w=None, align="left", parent="page", line_h=None, spacing=None):
    p = {"fontSize": size, "fontFamily": family, "fill": color}
    if bold:
        p["fontStyle"] = "Bold"
    if align != "left":
        p["textAlign"] = align
    if spacing is not None:
        p["letterSpacing"] = spacing
    h = line_h if line_h else round(size * 1.45)
    cmd = {"command": "node.create", "params": {
        "type": "text", "name": name, "x": x, "y": y,
        "width": w if w else 400, "height": h,
        "text": s, "props": p}}
    if parent is not None:
        cmd["params"]["parent"] = {"$ref": parent}
    cmds.append(cmd)
    return cmd


# ── lucide 图标 → 单一 SVG path data ────────────────────────────
def _num(v):
    return f"{float(v):g}"


def lucide_path(name):
    """把 lucide-static svg 内的所有图元合并成一条 path data（24 视框）。"""
    with open(os.path.join(LUCIDE, name + ".svg"), encoding="utf-8") as f:
        svg = f.read()
    parts = []
    for m in re.finditer(r"<path[^>]*\sd=\"([^\"]+)\"", svg):
        parts.append(m.group(1))
    for m in re.finditer(r"<circle[^>]*\scx=\"([\d.]+)\"[^>]*\scy=\"([\d.]+)\"[^>]*\sr=\"([\d.]+)\"", svg):
        cx, cy, r = map(float, m.groups())
        parts.append(
            f"M{_num(cx - r)},{_num(cy)}A{_num(r)},{_num(r)} 0 1 0 {_num(cx + r)},{_num(cy)}"
            f"A{_num(r)},{_num(r)} 0 1 0 {_num(cx - r)},{_num(cy)}")
    for m in re.finditer(r"<line[^>]*\sx1=\"([\d.]+)\"[^>]*\sy1=\"([\d.]+)\"[^>]*\sx2=\"([\d.]+)\"[^>]*\sy2=\"([\d.]+)\"", svg):
        x1, y1, x2, y2 = map(float, m.groups())
        parts.append(f"M{_num(x1)},{_num(y1)}L{_num(x2)},{_num(y2)}")
    for m in re.finditer(r"<rect[^>]*\sx=\"([\d.]+)\"[^>]*\sy=\"([\d.]+)\"[^>]*\swidth=\"([\d.]+)\"[^>]*\sheight=\"([\d.]+)\"", svg):
        x, y, w, h = map(float, m.groups())
        parts.append(f"M{_num(x)},{_num(y)}H{_num(x + w)}V{_num(y + h)}H{_num(x)}Z")
    for m in re.finditer(r"<polyline[^>]*\spoints=\"([^\"]+)\"", svg):
        pts = [p for p in m.group(1).split() if "," in p]
        d = "M" + "L".join(p.replace(",", " ") for p in pts)
        parts.append(d)
    if not parts:
        raise SystemExit(f"icon parse failed: {name}")
    return " ".join(parts)


_ICON_CACHE = {}


def icon(name, x, y, size=16, color=TEXT_MU, weight=2, parent="page", tag=None):
    if name not in _ICON_CACHE:
        _ICON_CACHE[name] = lucide_path(name)
    p = {"fill": "#00000000", "stroke": color, "strokeWeight": weight,
         "strokeAlign": "center", "strokeJoin": "round", "strokeCap": "round"}
    cmd = {"command": "node.create", "params": {
        "type": "vector", "name": tag or f"ic-{name}", "x": x, "y": y,
        "width": size, "height": size, "path": _ICON_CACHE[name], "props": p}}
    if parent is not None:
        cmd["params"]["parent"] = {"$ref": parent}
    cmds.append(cmd)
    return cmd


# ═══════════════════════════════════════════════════════════════
# 页面骨架
# ═══════════════════════════════════════════════════════════════
W, H = 1440, 900

cmds.append({"command": "node.create", "params": {
    "type": "frame", "name": "文件管理页", "x": 0, "y": 0, "width": W, "height": H,
    "props": {"fill": BG, "cornerRadius": 0}}, "as": "page"})

# ── 顶栏 app-bar（56px）────────────────────────────────────────
rect("appbar-bg", 0, 0, W, 56, SURFACE)
rect("appbar-line", 0, 55, W, 1, BORDER)
rect("logo", 12, 14, 28, 28, radius=8)
# logo 渐变覆盖
cmds.append({"command": "node.create", "params": {
    "type": "rectangle", "name": "logo-fill", "x": 12, "y": 14, "width": 28, "height": 28,
    "parent": {"$ref": "page"},
    "props": {"cornerRadius": 8,
              "fills": [{"type": "linearGradient", "stops": ["#ECF3FF", "#62ABFF"]}]}}})
probe("logo 渐变左上", 15, 17, "#ECF3FF", tol=40)
probe("logo 渐变右下", 36, 38, "#62ABFF", tol=60)

# 居中标题：cortex@7860（mono 粗体，@ 蓝色）
text("wb-title-1", 668, 19, "cortex", FS_MD, TEXT, True, MONO, w=54, align="right")
text("wb-title-at", 722, 19, "@", FS_MD, "#1876F2", True, MONO, w=10)
text("wb-title-2", 732, 19, "7860", FS_MD, TEXT, True, MONO, w=42)

# 右侧簇：主题钮 / 同步徽标 / 监控徽标 / 头像
rect("theme-btn", 1208, 12, 32, 32, SURFACE, radius=16, stroke=BORDER)
icon("palette", 1217, 20, 15, TEXT_MU, 2)

rect("sync-badge", 1248, 16, 80, 24, MUTED_BG, radius=12, stroke=BORDER)
icon("git-fork", 1256, 22, 12, TEXT_MU, 2)
text("sync-text", 1272, 21, "已同步", FS_XS, TEXT_MU, w=52)

rect("watch-badge", 1336, 16, 52, 24, MUTED_BG, radius=12, stroke=BORDER)
icon("eye", 1344, 22, 12, TEXT_MU, 2)
text("watch-text", 1359, 21, "监控", FS_XS, TEXT_MU, w=26)

rect("avatar-btn", 1394, 12, 32, 32, SURFACE, radius=16, stroke="transparent")
rect("avatar", 1398, 16, 24, 24, PRIMARY, radius=12)
icon("user", 1404, 21, 13, "#FFFFFF", 2)

# ── 左侧活动栏 activity-bar ───────────────────────────────────
AB_W = 110
rect("activity-bg", 0, 56, AB_W, H - 56, SURFACE)
rect("activity-line", AB_W - 1, 56, 1, H - 56, BORDER_MU)

NAV = [
    ("search", "全库搜索", False),
    ("bot", "个人助手", False),
    ("book-open", "岁月微笺", False),
    ("folder", "文件管理", True),
]
ay = 72
for iname, label, active in NAV:
    color = NAV_ACT if active else TEXT_MU
    icon(iname, 8, ay + 2, 22, color, 2.4 if active else 2)
    text(f"nav-{iname}", 42, ay + 6, label, FS_SM, color, active)
    ay += 44

# ── 三栏骨架 ──────────────────────────────────────────────────
TREE_X, TREE_W = AB_W, 240
LIST_X, LIST_W = TREE_X + TREE_W + 4, 520
PREV_X, PREV_W = LIST_X + LIST_W + 4, W - (LIST_X + LIST_W + 4)

rect("tree-bg", TREE_X, 56, TREE_W, H - 56, SURFACE)
rect("tree-line", TREE_X + TREE_W - 1, 56, 1, H - 56, BORDER)
rect("list-bg", LIST_X, 56, LIST_W, H - 56, SURFACE)
rect("preview-bg", PREV_X, 56, PREV_W, H - 56, SURFACE)
rect("preview-line", PREV_X, 56, 1, H - 56, BORDER)
rect("splitter-1", TREE_X + TREE_W, 56, 4, H - 56, BORDER_MU)
rect("splitter-2", PREV_X - 4, 56, 4, H - 56, BORDER_MU)

# ═══════════════ 目录树栏 ═══════════════
# 搜索框
rect("tree-search-box", TREE_X + 12, 64, TREE_W - 24, 34, SURFACE, radius=8, stroke=BORDER)
icon("search", TREE_X + 24, 73, 16, TEXT_SUB, 2)
text("tree-search-ph", TREE_X + 46, 72, "按文件名搜索…", FS_SM, TEXT_SUB)

# 面板标题
text("tree-header", TREE_X + 12, 112, "文件", FS_XS, TEXT_MU, True, spacing=0.5)

TREE = [
    # (depth, kind, name, expanded, selected)
    (0, "dir", "cortex", True, False),
    (1, "dir", "doclens", True, False),
    (2, "dir", "web_v2", True, False),
    (3, "dir", "frontend", True, False),
    (4, "dir", "src", True, True),
    (4, "dir", "static", False, False),
    (3, "dir", "skills", False, False),
    (2, "dir", "api", False, False),
    (1, "dir", ".doclens", False, False),
    (0, "dir", "treesearch", False, False),
]
ty = 130
for depth, kind, name, expanded, selected in TREE:
    row_y = ty
    if selected:
        rect(f"tree-sel-{name}", TREE_X, row_y, TREE_W - 1, 30, PRIMARY_S, radius=4)
        probe(f"选中树节点底({name})", TREE_X + 4, row_y + 15, PRIMARY_S)
    x = TREE_X + 12 + depth * 16
    if expanded:
        icon("chevron-down", x, row_y + 7, 16, TEXT_SUB, 2)
    elif kind == "dir":
        icon("chevron-right", x, row_y + 7, 16, TEXT_SUB, 2)
    icon("folder", x + 24, row_y + 7, 16, TEXT_MU if not selected else PRIMARY, 2)
    text(f"tree-{name}", x + 48, row_y + 7, name, FS_SM,
         PRIMARY if selected else TEXT, False, MONO, w=200)
    ty += 30

# ═══════════════ 中间文件列表 ═══════════════
# 面包屑行
def crumb_btn(name, x, w, ic, title):
    rect(name, x, 64, w, 22, SURFACE, radius=11, stroke=BORDER)
    icon(ic, x + (w - 14) / 2, 68, 14, TEXT, 2)

crumb_btn("bc-up", LIST_X + 16, 26, "arrow-up", "返回上一级")
crumb_btn("bc-drive", LIST_X + 48, 26, "hard-drive", "回到工作目录")
crumb_btn("bc-home", LIST_X + 80, 26, "home", "家目录")
text("bc-1", LIST_X + 118, 68, "根目录", FS_SM, TEXT_MU, family=MONO, w=52)
text("bc-sep-1", LIST_X + 172, 68, "›", FS_SM, TEXT_SUB, family=MONO, w=10)
text("bc-2", LIST_X + 184, 68, "doclens", FS_SM, TEXT_MU, family=MONO, w=60)
text("bc-sep-2", LIST_X + 246, 68, "›", FS_SM, TEXT_SUB, family=MONO, w=10)
text("bc-3", LIST_X + 258, 68, "web_v2", FS_SM, TEXT_MU, family=MONO, w=60)
text("bc-sep-3", LIST_X + 320, 68, "›", FS_SM, TEXT_SUB, family=MONO, w=10)
text("bc-cur", LIST_X + 332, 68, "frontend", FS_SM, TEXT, family=MONO, w=70)

rect("set-workdir-btn", LIST_X + LIST_W - 100, 64, 84, 24, SURFACE, radius=12, stroke=PRIMARY)
icon("home", LIST_X + LIST_W - 94, 69, 12, PRIMARY, 2)
text("set-workdir-text", LIST_X + LIST_W - 78, 69, "设为工作目录", FS_XS, PRIMARY)
probe("设为工作目录描边", LIST_X + LIST_W - 100, 76, PRIMARY)

# 工具条（图标 pill）
TB = ["refresh-cw", "git-fork", "book-open", "file-plus", "folder-plus",
      "upload", "pencil", "download", "arrow-right", "copy", "sparkles", "trash-2"]
tx = LIST_X + 16
for i, ic in enumerate(TB):
    color = DANGER if ic == "trash-2" else TEXT
    rect(f"tb-btn-{ic}", tx, 96, 30, 28, SURFACE, radius=8, stroke=BORDER)
    icon(ic, tx + 7, 102, 16, color, 2)
    tx += 34

# 表头行
rect("list-header-bg", LIST_X, 128, LIST_W, 27, MUTED_BG)
COL = {"cb": LIST_X + 12, "ic": LIST_X + 48, "name": LIST_X + 84,
       "size": LIST_X + 332, "time": LIST_X + 400}
rect("hdr-cb", COL["cb"], 134, 14, 14, SURFACE, radius=3, stroke=BORDER)
text("hdr-name", COL["name"], 133, "名称", FS_XS, TEXT_MU)
text("hdr-size", COL["size"], 133, "大小", FS_XS, TEXT_MU, w=60, align="center")
text("hdr-time", COL["time"], 133, "修改", FS_XS, TEXT_MU, w=108, align="center")

ROWS = [
    ("dir", "doclens", None, None, None),
    ("dir", "frontend", None, None, None),
    ("dir", "static", None, None, None),
    ("md", "CLAUDE.md", "M", "#A121CE", ("18.4 KB", "2025/11/13 10:22")),
    ("md", "README.md", "M", "#A121CE", ("6.1 KB", "2025/11/12 19:05")),
    ("txt", "requirements.txt", "T", "#5D6C7B", ("1.2 KB", "2025/11/10 08:41")),
    ("pdf", "架构设计.pdf", "P", "#E41E3F", ("2.4 MB", "2025/11/08 16:30")),
    ("xlsx", "周报-2025.xlsx", "X", "#31A24C", ("84.5 KB", "2025/11/07 09:12")),
    ("png", "封面.png", "I", "#7C3AED", ("512.0 KB", "2025/11/03 21:57")),
    ("html", "index.html", "H", "#E34F26", ("3.8 KB", "2025/11/01 14:18")),
]
ry = 155
for idx, (kind, name, letter, lcolor, meta) in enumerate(ROWS):
    if idx == 3:  # active 行（当前预览文件）
        rect("row-active", LIST_X, ry, LIST_W, 30, PRIMARY_S)
        probe("active 行高亮底", LIST_X + LIST_W - 40, ry + 15, PRIMARY_S)
    rect(f"row-cb-{name}", COL["cb"], ry + 8, 14, 14, SURFACE, radius=3, stroke=BORDER)
    if kind == "dir":
        icon("folder", COL["ic"], ry + 7, 16, TEXT_MU, 2)
    else:
        rect(f"row-badge-{name}", COL["ic"], ry + 6, 18, 18, lcolor, radius=4)
        text(f"row-letter-{name}", COL["ic"], ry + 9, letter, 10, "#FFFFFF", True, MONO, w=18, align="center")
        probe(f"类型徽标底({name})", COL["ic"] + 2, ry + 8, lcolor)
    nm_color = TEXT if idx == 3 else TEXT
    text(f"row-name-{name}", COL["name"], ry + 8, name, FS_SM, nm_color, w=240)
    if meta:
        text(f"row-size-{name}", COL["size"], ry + 9, meta[0], FS_XS, TEXT_MU, family=MONO, w=60, align="center")
        text(f"row-time-{name}", COL["time"], ry + 9, meta[1], FS_XS, TEXT_MU, family=MONO, w=108, align="center")
    ry += 30

# ═══════════════ 右侧预览栏 ═══════════════
rect("prev-header-bg", PREV_X, 56, PREV_W, 44, SURFACE)
rect("prev-header-line", PREV_X, 99, PREV_W, 1, BORDER)
rect("prev-badge", PREV_X + 16, 70, 16, 16, "#A121CE", radius=4)
text("prev-badge-letter", PREV_X + 16, 72, "M", 10, "#FFFFFF", True, MONO, w=16, align="center")
text("prev-dir", PREV_X + 38, 71, "web_v2/frontend/src", FS_SM, TEXT_MU, family=MONO, w=180)
text("prev-name", PREV_X + 220, 71, "CLAUDE.md", FS_SM, TEXT, family=MONO, w=140)

PB = [("pencil", "编辑"), ("sparkles", "工具箱"), ("copy", "拷贝路径"), ("download", "下载")]
px = PREV_X + PREV_W - 16 - 4 * 34
for ic, label in PB:
    rect(f"prev-btn-{ic}", px, 66, 30, 24, SURFACE, radius=12, stroke=BORDER)
    icon(ic, px + 7, 70, 14, TEXT_MU, 2)
    px += 34

text("prev-title", PREV_X + 24, 124, "前端开发指南", 20, TEXT, True)
text("prev-sub", PREV_X + 24, 156, "Cortex Web UI · Lit + Vite", FS_BASE, TEXT_MU)

BODY = [
    "文件管理页提供工作目录内文件的浏览、预览与编辑能力，",
    "左侧目录树展示层级结构，中间列表按名称、大小、修改时间列出条目，",
    "右侧预览栏渲染所选文件内容，并支持 Markdown 文本直接编辑保存。",
]
by = 190
for line in BODY:
    text("prev-p", PREV_X + 24, by, line, FS_BASE, TEXT_MU, w=PREV_W - 48)
    by += 22

BULLETS = [
    "上传 / 新建 / 重命名 / 移动 / 删除",
    "拖拽文件到当前目录即可上传",
    "工作目录之外的目录为只读浏览模式",
]
by += 8
for b in BULLETS:
    rect("prev-bullet", PREV_X + 26, by + 6, 4, 4, TEXT_SUB, radius=2)
    text("prev-bullet-t", PREV_X + 40, by, b, FS_BASE, TEXT_MU, w=PREV_W - 64)
    by += 22

rect("prev-code-bg", PREV_X + 24, by + 10, PREV_W - 48, 74, MUTED_BG, radius=8)
text("prev-code", PREV_X + 40, by + 26, "npm run build   # tsc --noEmit && vite build", FS_SM, "#0A1317", family=MONO, w=PREV_W - 80)
probe("代码块底色", PREV_X + 30, by + 14, MUTED_BG)
probe("预览正文区", PREV_X + PREV_W - 30, 200, "#FFFFFF")
probe("顶栏右簇白底", 1180, 30, "#FFFFFF")
probe("树栏白底", 300, 500, "#FFFFFF")
probe("列表分隔线", PREV_X, 400, BORDER)
probe("预览头部分隔线", PREV_X + 120, 99, BORDER)
probe("表头底色", LIST_X + 300, 140, MUTED_BG)
probe("面包屑区白底", LIST_X + 300, 70, "#FFFFFF")
probe("顶栏分隔线", 700, 55, BORDER)
probe("活动栏分隔线", AB_W - 1, 400, BORDER_MU)
probe("树栏分隔线", TREE_X + TREE_W - 1, 400, BORDER)

# ═══════════════ 输出 ═══════════════
os.makedirs(OUT_DIR, exist_ok=True)
path = os.path.join(OUT_DIR, "files_page.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(cmds, f, ensure_ascii=False, indent=1)
probe_path = os.path.join(OUT_DIR, "files_page.probes.json")
with open(probe_path, "w", encoding="utf-8") as f:
    json.dump([{"name": n, "x": x, "y": y, "expect": e, "tol": t} for n, x, y, e, t in probes],
              f, ensure_ascii=False, indent=1)
print(f"wrote {path} ({len(cmds)} commands) + {len(probes)} probes")
