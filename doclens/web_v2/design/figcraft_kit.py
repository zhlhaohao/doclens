# -*- coding: utf-8 -*-
"""FigCraft 复刻共用工具：设计 token + 图层构造助手。

供 gen_files_page.py（桌面）与 gen_mobile_page.py（移动端）共用。
"""
import json
import os
import re

# 脚本位于 <仓库根>/.doclens/tools/figcraft/，上溯两级即仓库根
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
# ── SVG 资源目录 ──
# 设计稿的 SVG 资源集中在 svg/（与代码仓库同源：由 sync_svgs.py
# 从前端 node_modules/lucide-static@1.26.0 同步，版本一致）。
SVG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "svg")
# 兜底：本地缺某个图标时，直接读前端 node_modules（保证不中断）
LUCIDE = os.path.join(ROOT, "doclens", "web_v2", "frontend", "node_modules",
                      "lucide-static", "icons")
# 设计稿产物随仓库入库（designs/），.json 中间产物 + .png 校验图 gitignore
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "designs")

# ── Cortex 设计 token：唯一真源 = tokens.css ──────────────────
# 本模块不再手抄色值——由 tokens_source 解析
# doclens/web_v2/frontend/src/styles/tokens.css（light/dark/paper 三主题 +
# 非颜色 token），前端改 token 后重跑生成器即同步，零手工。
# 字号注：tokens.css 的 fs-xs/sm/base/md/lg = 12/13/14/15/17 是**移动端**
# 基线；桌面 breakpoints.css 缩 ~1px。生成器沿用桌面稿的历史值
# （11/12/13/14/15）以保持已验收版面，见 FS_* 常量与 DESIGN_TOKEN_NOTE。
from tokens_source import TOKENS, theme as _theme, base_token as _base_token

_L = _theme("light")


def _c(name):
    """取 light 主题色并转 #RRGGBB 大写（CSS 源为小写）。"""
    v = _L.get(name)
    if not v:
        raise KeyError(f"tokens.css 缺少 {name}（light）")
    v = v.strip()
    if not v.startswith("#"):
        raise ValueError(f"{name} = {v} 不是十六进制色")
    return v[:7].upper()


BG         = _c("--cortex-bg")
SURFACE    = _c("--cortex-surface")
MUTED_BG   = _c("--cortex-surface-muted")
BORDER     = _c("--cortex-border")
BORDER_MU  = _c("--cortex-border-muted")
TEXT       = _c("--cortex-text")
TEXT_MU    = _c("--cortex-text-muted")
TEXT_SUB   = _c("--cortex-text-subtle")    # 图形/装饰（图形对比阈值 3:1）
TEXT_CAP   = _c("--cortex-text-caption")   # caption（≥4.5:1，WCAG AA）
PRIMARY    = _c("--cortex-primary")
PRIMARY_S  = _c("--cortex-primary-soft")
FB_BLUE    = _c("--cortex-fb-blue")
PRIMARY_HOVER = _c("--cortex-primary-hover")
NAV_ACT    = _c("--cortex-nav-active")
DANGER     = _c("--cortex-danger")
SUCCESS    = _c("--cortex-success")
SUCCESS_INK = _c("--cortex-success-ink")
ON_PRIMARY = _c("--cortex-on-primary")

# 深浅主题全量色表（供深色稿/评审器校验「用色是否在 token 集合内」）
PALETTES = {name: _theme(name) for name in ("light", "dark", "paper")}

# ── 设计扩展色（不在 tokens.css，但为设计稿必要）──────────────
# 白名单：评审器 G-私造色检查放行这些色。每条注明用途与来源。
# 原则：能用 token 就用 token；扩展色必须是「token 无法表达」的场景。
DESIGN_EXTENSIONS = {
    # 文件类型徽标底（utils/file-type.ts 的 KNOWN_TYPES 映射，
    # 为白字 ≥4.5:1 而加深；前端实现时应对齐此映射）
    "#7E22A8": "md 徽标（紫，白字 7.0:1）",
    "#227A3C": "xls/xlsx/csv 徽标（绿，白字 5.5:1）",
    "#C2183A": "pdf 徽标（红，白字 6.6:1）",
    "#B3420A": "ppt/pptx 徽标（橙，白字 5.4:1）",
    "#5B21B6": "png/jpg/webp 徽标（紫罗兰，白字 8.0:1）",
    "#0057C2": "doc/docx 徽标（蓝，白字 6.9:1）",
    "#4A5763": "txt 徽标（灰蓝，白字 6.9:1）",
    # 代码块（预览栏示意，GitHub dark 风格；前端用 highlight.js 主题）
    "#14161A": "浮层阴影基色（--cortex-shadow-md 的 rgba(20,22,26,*) 基色）",
    "#0F1419": "代码块底（GitHub dark canvas）",
    "#1A2029": "代码块标题条",
    "#7EE787": "代码语法绿（GitHub dark fg.success）",
    "#8B949E": "代码注释灰（GitHub dark fg.muted）",
    "#E6EDF3": "代码正文（GitHub dark fg.default）",
}

# 字体：tokens.css 的首选（Optimistic VF 私有）本机没有，回退第二顺位。
# 等宽 JetBrains Mono 同理回退 Liberation Mono。
SANS = "Microsoft YaHei"
MONO = "Liberation Mono"

# 桌面稿字号（历史验收值；tokens.css 移动基线为 12/13/14/15/17）
FS_XS, FS_SM, FS_BASE, FS_MD, FS_LG = 11, 12, 13, 14, 15


# ── 图标原点校准表（由 calibrate_icons.py 实测生成）─────────────
# FigCraft 建 vector 节点时把 x/y 平移到「路径自身包围盒左上角」，
# 各 Lucide 图标起点不同 → 偏移量 2~9px 不等 → 图标视觉位置错乱、
# 大小不一、突出按钮边框（视觉评审实测到的缺陷）。
# 此表记录每个图标的偏移量，icon() 摆放时反向补偿。
_CALIB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "icon_calibration.json")
try:
    with open(_CALIB_PATH, encoding="utf-8") as _f:
        ICON_ORIGIN = json.load(_f)
except (OSError, ValueError):
    ICON_ORIGIN = {}


# ── 图标度量表（由 measure_icons.py 实测生成）───────────────────
# FigCraft 把 path **等比缩放填满** width×height，忽略路径自身宽高比：
#     chevron-right（自然 24×12）→ 被拉成 20×20，视觉上比 folder 大一圈
#     arrow-right（自然 24×16）  → 同样变形
# 于是同一 size 下各图标**视觉尺寸与基线**都不同 —— 目录树里
# 「图标太大、没对齐」的根源。
#
# 此表记录每个图标的墨迹宽高（24 视框单位），icon() 据此：
#   1. 按墨迹比例算 width/height，避免拉伸变形
#   2. 按墨迹中心对齐，保证视觉基线一致
_METRICS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                             "icon_metrics.json")
try:
    with open(_METRICS_PATH, encoding="utf-8") as _f:
        ICON_METRICS = json.load(_f)
except (OSError, ValueError):
    ICON_METRICS = {}

if not ICON_METRICS:
    print("[warn] 未找到 icon_metrics.json —— 图标将退化为方形拉伸"
          "（大小/对齐会失真）。请运行："
          "python build_icon_metrics.py <icons.txt> icon_metrics.json")


# ── 图标尺寸等级（相当于 CSS 的 icon-size scale）───────────────
# icon() 的 size = **墨迹对角线**的目标大小（归一化后视觉重量一致）。
# 全局只用这 5 档，避免「同一图标在不同场景大小不一」。
#   XS  = 11  徽标内 / 内联小图标
#   SM  = 13  常规（列表行、状态栏、chips、菜单）
#   MD  = 15  按钮内 / 面包屑 / 树节点
#   LG  = 18  栏目标题级
#   XL  = 22  活动栏主导航
ICON_XS, ICON_SM, ICON_MD, ICON_LG, ICON_XL = 12, 13, 15, 18, 22
# （XS=12：归一化后 clock/tag 等墨迹 ≥8px，可辨性达标；原本 11 会让小墨迹图标落到 7.6~7.8px 低于评审阈值）


class Doc:
    """收集命令 + 探针，输出 figcraft-cli run 脚本与探针 JSON。"""

    def __init__(self):
        self.cmds = []
        self.probes = []
        # 各分组的绝对原点（页面坐标）——用于把页面坐标换算成相对父 frame 的坐标
        self._abs = {}

    def cmd(self, command, params, as_=None):
        c = {"command": command, "params": params}
        if as_:
            c["as"] = as_
        self.cmds.append(c)
        return c

    # ── 构造器 ──────────────────────────────────────────────
    def rect(self, name, x, y, w, h, fill=None, radius=None, stroke=None, sw=1, parent="page"):
        p = {"fill": fill or "#00000000", "cornerRadius": radius or 0}
        if stroke:
            p["stroke"] = stroke
            p["strokeWeight"] = sw
            p["strokeAlign"] = "inside"
        rx, ry = self._rel(x, y, parent)
        return self.cmd("node.create", {
            "type": "rectangle", "name": name, "x": rx, "y": ry,
            "width": w, "height": h, "props": p, "parent": {"$ref": parent}})

    def text(self, name, x, y, s, size=FS_SM, color=TEXT, bold=False, family=SANS,
             w=None, align="left", parent="page", line_h=None, spacing=None):
        p = {"fontSize": size, "fontFamily": family, "fill": color}
        if bold:
            p["fontStyle"] = "Bold"
        if align != "left":
            p["textAlign"] = align
        if spacing is not None:
            p["letterSpacing"] = spacing
        h = line_h if line_h else round(size * 1.45)
        rx, ry = self._rel(x, y, parent)
        return self.cmd("node.create", {
            "type": "text", "name": name, "x": rx, "y": ry,
            "width": w if w else 400, "height": h,
            "text": s, "props": p, "parent": {"$ref": parent}})

    def icon(self, name, x, y, size=16, color=TEXT_MU, weight=2, parent="page",
             tag=None, box="ink", optical=1.0, normalize=True):
        """在 (x, y) 处画一个图标。

        size      = 图标的**视框边长**（相当于 CSS 的 font-size）。
        box       = "ink"（默认）按墨迹包围盒定位；"viewbox" 按 24 视框定位。
        optical   = 光学补偿系数（>1 放大），用于个别视觉偏轻的图标。
        normalize = 是否按**墨迹对角线**归一化（默认 True）。

        两处关键处理（均基于实测）：

        1. **FigCraft 把 path 拉伸填满 width×height，忽略路径自身宽高比。**
           实测：自然 40×20 的矩形放进 40×40 节点 → 渲染成 42×41（正方形）。
           故 width/height 必须按路径**自身墨迹比例**给出，否则
           chevron-right（横向箭头）会被拉成正方形、比 folder 大一圈
           —— 这正是「图标太大、没对齐」的根源。

        2. **统一 viewBox 缩放仍会显出大小差异。**
           Lucide 的 user 墨迹 14×18、palette 20×20，同一缩放下前者明显小。
           故按**墨迹对角线**归一化：所有图标的墨迹外接圆一样大，
           视觉重量才一致（这也是主流图标库的做法）。
           归一化后 size 表示「墨迹对角线」的目标大小。

        坐标：FigCraft 把墨迹缩放填满节点框 → 墨迹左上角 = 节点左上角，
        故按墨迹比例定 w/h 后，节点左上角即墨迹左上角。
        """
        d = lucide_path(name)
        m = ICON_METRICS.get(name)

        if m and box == "ink" and m.get("h", 0) > 0:
            mw, mh = m["w"], m["h"]
            if normalize:
                # 墨迹对角线归一：所有图标的墨迹外接圆一致
                diag = (mw * mw + mh * mh) ** 0.5
                k = (size * optical) / diag
            else:
                k = (size / 24.0) * optical
            w = mw * k
            h = mh * k
            nx = x - m["x0"] * k          # 让墨迹左上角落在 x
            ny = y - m["y0"] * k
        else:
            w = h = size
            nx, ny = x, y

        p = {"fill": "#00000000", "stroke": color, "strokeWeight": weight,
             "strokeAlign": "center", "strokeJoin": "round", "strokeCap": "round"}
        rx, ry = self._rel(nx, ny, parent)
        cmd = {"command": "node.create", "params": {
            "type": "vector", "name": tag or f"ic-{name}",
            "x": rx, "y": ry,
            "width": w, "height": h, "path": d,
            "props": p, "parent": {"$ref": parent}}}
        self.cmds.append(cmd)
        return cmd

    def gradient(self, name, x, y, w, h, stops, radius=0, parent="page"):
        rx, ry = self._rel(x, y, parent)
        return self.cmd("node.create", {
            "type": "rectangle", "name": name, "x": rx, "y": ry,
            "width": w, "height": h, "parent": {"$ref": parent},
            "props": {"cornerRadius": radius,
                      "fills": [{"type": "linearGradient", "stops": stops}]}})

    def frame(self, name, x, y, w, h, fill=BG, radius=0, as_="page", parent=None):
        p = {"type": "frame", "name": name, "x": x, "y": y, "width": w, "height": h,
             "props": {"fill": fill, "cornerRadius": radius}}
        if parent is not None:
            p["parent"] = {"$ref": parent}
        return self.cmd("node.create", p, as_=as_)

    def group(self, name, x, y, w, h, as_=None, parent=None, fill=None, radius=0):
        """建一个**语义分组容器** frame，把同类图层收进去。

        坐标语义（实测，见 probe_nested.py）：frame 的子节点 x/y
        **相对该 frame**——父 frame(100,100) 内 frame(50,50) 的子节点
        (10,20) 渲染在页面 (160,170)。

        因此本方法的 (x, y) 采用**页面坐标**（与其它构造器一致），
        内部换算成相对父 frame 的偏移；分组内元素也可用页面坐标书写，
        由 _abs 记录各分组的绝对原点，绘制时自动减去。

        as_ 给分组命名后，后续用 group("name", ...) 的返回值作 parent 即可。
        """
        # 绝对原点 → 相对父 frame
        if parent is None:
            rx, ry = x, y
        else:
            px, py = self._abs.get(parent, (0, 0))
            rx, ry = x - px, y - py
        self._abs[as_ or name] = (x, y)
        return self.frame(name, rx, ry, w, h, fill=fill or "#00000000", radius=radius,
                          as_=as_, parent=parent)

    def _rel(self, x, y, parent):
        """页面坐标 → 相对父 frame 的坐标。"""
        if parent is None:
            return x, y
        px, py = self._abs.get(parent, (0, 0))
        return x - px, y - py

    # ── 探针 ────────────────────────────────────────────────
    def probe(self, name, x, y, exp, tol=14):
        self.probes.append({"name": name, "x": int(x), "y": int(y),
                            "expect": exp, "tol": tol})

    def probe_region(self, name, x0, y0, x1, y1, exp, tol=14):
        """区域探针：区域内必须出现期望色（描边线稿是空心，单点取不到色）。"""
        self.probes.append({"name": name, "region": True,
                            "x": int(x0), "y": int(y0), "x2": int(x1), "y2": int(y1),
                            "expect": exp, "tol": tol})

    # ── 输出 ────────────────────────────────────────────────
    def save(self, stem):
        os.makedirs(OUT_DIR, exist_ok=True)
        path = os.path.join(OUT_DIR, f"{stem}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.cmds, f, ensure_ascii=False, indent=1)
        ppath = os.path.join(OUT_DIR, f"{stem}.probes.json")
        with open(ppath, "w", encoding="utf-8") as f:
            json.dump(self.probes, f, ensure_ascii=False, indent=1)
        print(f"wrote {path} ({len(self.cmds)} cmds) + {len(self.probes)} probes")
        return path


# ── lucide 图标 → 单一 SVG path data（24 视框）────────────────
def _num(v):
    return f"{float(v):g}"


_ICON_CACHE = {}

# ── SVG path 包围盒 & 平移 ────────────────────────────────────
_TOKEN_RE = re.compile(r"[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?")


def _arc_points(x0, y0, rx, ry, phi_deg, laf, sweep, x1, y1, n=16):
    """按 SVG 规范（F.6.5）把椭圆弧离散采样，返回点列表。

    圆弧的包围盒不能用「端点 ± 半径」估计——那会严重过估
    （Lucide 的 folder 用该法算出 x∈[0,24]，真实是 [2,22]）。
    """
    import math
    if rx == 0 or ry == 0 or (x0 == x1 and y0 == y1):
        return [(x1, y1)]
    phi = math.radians(phi_deg)
    cp, sp = math.cos(phi), math.sin(phi)
    dx2, dy2 = (x0 - x1) / 2.0, (y0 - y1) / 2.0
    x1p = cp * dx2 + sp * dy2
    y1p = -sp * dx2 + cp * dy2
    rx, ry = abs(rx), abs(ry)
    lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lam > 1:
        s = math.sqrt(lam)
        rx *= s
        ry *= s
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    co = math.sqrt(max(0.0, num / den)) if den else 0.0
    if laf == sweep:
        co = -co
    cxp = co * rx * y1p / ry
    cyp = -co * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x0 + x1) / 2.0
    cy = sp * cxp + cp * cyp + (y0 + y1) / 2.0

    def ang(ux, uy, vx, vy):
        dot = ux * vx + uy * vy
        n1 = math.hypot(ux, uy) * math.hypot(vx, vy)
        a = math.acos(max(-1.0, min(1.0, dot / n1))) if n1 else 0.0
        if ux * vy - uy * vx < 0:
            a = -a
        return a

    theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    dtheta = ang((x1p - cxp) / rx, (y1p - cyp) / ry,
                 (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if not sweep and dtheta > 0:
        dtheta -= 2 * math.pi
    elif sweep and dtheta < 0:
        dtheta += 2 * math.pi
    pts = []
    for i in range(n + 1):
        t = theta1 + dtheta * i / n
        px = cx + rx * math.cos(t) * cp - ry * math.sin(t) * sp
        py = cy + rx * math.cos(t) * sp + ry * math.sin(t) * cp
        pts.append((px, py))
    return pts


def absolutize(d):
    """把 path data 全部转成绝对坐标指令。

    拼接多个 <path> 时必须先各自绝对化：相对指令（m/l/h/v/a）的基准
    是「当前点」，若直接用空格拼接，"M5 12h14" + "m12 5 7 7-7 7" 里的
    `m` 会以 (19,12) 为基准 —— 而正确基准是每段自己的起点。
    实测 git-fork / book-open / copy 三个图标因此算错包围盒。
    """
    toks = _TOKEN_RE.findall(d)
    out = []
    i = 0
    cmd = None
    cx = cy = sx = sy = 0.0
    # 各指令的参数个数
    ARITY = {"M": 2, "L": 2, "H": 1, "V": 1, "A": 7, "C": 6, "S": 4, "Q": 4, "T": 2, "Z": 0}

    def take(n):
        nonlocal i
        if i + n > len(toks):
            return None
        try:
            vals = [float(v) for v in toks[i:i + n]]
        except ValueError:
            return None
        i += n
        return vals

    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in ("Z", "z"):
                out.append("Z")
                cx, cy = sx, sy
            continue
        if cmd is None:
            i += 1
            continue
        c = cmd.upper()
        rel = cmd.islower()
        n = ARITY.get(c)
        if n is None:
            break

        if c in ("M", "L"):
            # 坐标对列表，逐对消费。
            # ⚠ 必须在「下一个 token 是命令字母」时停下——
            #   M20 19A2 2 0 0 22 17 里，A 的参数不能被当成 M 的后续坐标对
            #   （否则整段弧线被吃掉，book-open 实测只剩 "M20.001 19"）
            first = True
            while True:
                if i >= len(toks) or toks[i].isalpha():
                    break
                v = take(2)
                if v is None:
                    break
                dx, dy = v
                if rel:
                    cx, cy = cx + dx, cy + dy
                else:
                    cx, cy = dx, dy
                out.append(("M" if (c == "M" and first) else "L") + f"{_num(cx)} {_num(cy)}")
                if c == "M" and first:
                    sx, sy = cx, cy
                    first = False
            continue
        if c == "H":
            v = take(1)
            if v is None:
                break
            cx = cx + v[0] if rel else v[0]
            out.append(f"H{_num(cx)}")
            continue
        if c == "V":
            v = take(1)
            if v is None:
                break
            cy = cy + v[0] if rel else v[0]
            out.append(f"V{_num(cy)}")
            continue
        if c == "A":
            v = take(7)
            if v is None:
                break
            rx, ry, rot, laf, sf = v[0], v[1], v[2], v[3], v[4]
            ex, ey = v[5], v[6]
            if rel:
                ex, ey = cx + ex, cy + ey
            out.append(f"A{_num(rx)} {_num(ry)} {_num(rot)} {_num(laf)} {_num(sf)} "
                       f"{_num(ex)} {_num(ey)}")
            cx, cy = ex, ey
            continue
        if c in ("C", "S", "Q", "T"):
            v = take(n)
            if v is None:
                break
            pts = []
            for k in range(0, n, 2):
                px, py = v[k], v[k + 1]
                if rel:
                    px, py = cx + px, cy + py
                pts.append((px, py))
            out.append(f"{c} " + " ".join(f"{_num(a)} {_num(b)}" for a, b in pts))
            cx, cy = pts[-1]
            continue
        break

    return " ".join(out)


def path_bbox(d):
    """path data 的包围盒。

    优先用 svgpathtools（权威 SVG 实现，正确处理弧线与贝塞尔）；
    不可用时退回自研解析器（仅覆盖常见情形）。
    """
    try:
        from svgpathtools import parse_path
        b = parse_path(d).bbox()
        # svgpathtools 的 bbox 返回 (xmin, xmax, ymin, ymax)
        return (float(b[0]), float(b[2]), float(b[1]), float(b[3]))
    except Exception:
        pass
    return _path_bbox_fallback(d)


def _path_bbox_fallback(d):
    """自研包围盒解析（svgpathtools 不可用时的兜底）。

    注意：曲线只取端点与控制点，弧线按 SVG 规范 F.6.5 离散采样。
    """
    toks = _TOKEN_RE.findall(d)
    xs, ys = [], []
    cx = cy = sx = sy = 0.0
    i = 0
    cmd = None

    def take(n):
        nonlocal i
        if i + n > len(toks):
            return None
        try:
            vals = [float(v) for v in toks[i:i + n]]
        except ValueError:
            return None
        i += n
        return vals

    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in ("Z", "z"):
                cx, cy = sx, sy
            continue
        if cmd is None:
            i += 1
            continue
        c = cmd.upper()
        rel = cmd.islower()

        if c in ("M", "L"):
            first = True
            while True:
                if i >= len(toks) or toks[i].isalpha():
                    break
                v = take(2)
                if v is None:
                    break
                dx, dy = v
                cx = cx + dx if rel else dx
                cy = cy + dy if rel else dy
                xs.append(cx)
                ys.append(cy)
                if c == "M" and first:
                    sx, sy = cx, cy
                    first = False
                    cmd = "l" if rel else "L"
            continue
        if c == "H":
            v = take(1)
            if v is None:
                break
            cx = cx + v[0] if rel else v[0]
            xs.append(cx)
            ys.append(cy)
            continue
        if c == "V":
            v = take(1)
            if v is None:
                break
            cy = cy + v[0] if rel else v[0]
            xs.append(cx)
            ys.append(cy)
            continue
        if c == "A":
            v = take(7)
            if v is None:
                break
            rx, ry, rot = v[0], v[1], v[2]
            laf, sf = int(v[3]), int(v[4])
            ex, ey = v[5], v[6]
            if rel:
                ex, ey = cx + ex, cy + ey
            for px, py in _arc_points(cx, cy, rx, ry, rot, laf, sf, ex, ey):
                xs.append(px)
                ys.append(py)
            cx, cy = ex, ey
            continue
        if c in ("C", "S", "Q", "T"):
            n = 6 if c in ("C", "S", "Q") else 4
            v = take(n)
            if v is None:
                break
            for k in range(0, n, 2):
                px, py = v[k], v[k + 1]
                xs.append(cx + px if rel else px)
                ys.append(cy + py if rel else py)
            cx = cx + v[n - 2] if rel else v[n - 2]
            cy = cy + v[n - 1] if rel else v[n - 1]
            continue
        break

    if not xs:
        return (0.0, 0.0, 24.0, 24.0)
    return (min(xs), min(ys), max(xs), max(ys))


def _translate_path(d, dx, dy):
    """把 path data 的坐标整体平移 (dx, dy)。

    相对指令的数值是增量，不能直接加 dx/dy——需先把整条路径
    转成绝对坐标再平移，最后保持指令序列不变（相对语义已变）。
    为简单可靠：把每个坐标参数按「绝对指令加偏移、相对指令不改」
    处理后，再把相对指令的累积量折叠进去——对 Lucide 图标
    （多为绝对 + 少量相对弧）误差可接受。
    """
    toks = _TOKEN_RE.findall(d)
    ARITY = {"M": 2, "L": 2, "H": 1, "V": 1, "A": 7, "C": 6, "S": 4, "Q": 4, "T": 2}
    out, i, cmd = [], 0, None
    cx = cy = 0.0
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            out.append(t)
            i += 1
            continue
        c, rel = (cmd or "M").upper(), (cmd or "M").islower()
        n = ARITY.get(c, 0)
        if not n:
            i += 1
            continue
        vals = toks[i:i + n]
        if len(vals) < n:
            out.extend(vals)
            break
        nums = [float(v) for v in vals]
        if rel:
            # 相对量：先换算成绝对，再平移
            if c == "H":
                cx = cx + nums[0]; nums[0] = cx + dx
            elif c == "V":
                cy = cy + nums[0]; nums[0] = cy + dy
            elif c == "A":
                cx = cx + nums[5]; cy = cy + nums[6]
                nums[5] = cx + dx; nums[6] = cy + dy
            else:
                for k in range(0, n, 2):
                    cx = cx + nums[k]; cy = cy + nums[k + 1]
                    nums[k] = cx + dx; nums[k + 1] = cy + dy
        else:
            if c == "H":
                nums[0] = nums[0] + dx
            elif c == "V":
                nums[0] = nums[0] + dy
            elif c == "A":
                nums[5] = nums[5] + dx; nums[6] = nums[6] + dy
            else:
                for k in range(0, n, 2):
                    nums[k] = nums[k] + dx; nums[k + 1] = nums[k + 1] + dy
        out.extend(_num(v) for v in nums)
        i += n
    return " ".join(out)



def _absolutize_seg(d):
    """用 svgpathtools 把一段 path 转成绝对坐标的 path data。

    自研分词不可靠：Lucide 的 d 属性含无分隔符参数
    （"A2 2 0 0022 17" → 0022 会被误读成 22），会吞掉整段弧线。
    svgpathtools 是权威 SVG 实现，解析后按图元重建绝对路径。
    """
    try:
        from svgpathtools import parse_path
    except ImportError:
        # 无 svgpathtools 时退回自研绝对化（仍能正确处理大部分图标）
        return absolutize(d)
    try:
        path = parse_path(d)
    except Exception:
        return absolutize(d)
    out = []
    segs = list(path)
    # 首段若不是 Move，补一条 MoveTo(起点)——否则包围盒起点被当成 (0,0)
    if segs and segs[0].__class__.__name__ != "Move":
        st = segs[0].start
        out.append(f"M{_num(st.real)} {_num(st.imag)}")
    for seg in segs:
        t = seg.__class__.__name__
        try:
            if t == "Move":
                out.append(f"M{_num(seg.end.real)} {_num(seg.end.imag)}")
            elif t == "Line":
                out.append(f"L{_num(seg.end.real)} {_num(seg.end.imag)}")
            elif t == "CubicBezier":
                c1, c2, e = seg.control1, seg.control2, seg.end
                out.append(f"C{_num(c1.real)} {_num(c1.imag)} {_num(c2.real)} {_num(c2.imag)} "
                           f"{_num(e.real)} {_num(e.imag)}")
            elif t == "QuadraticBezier":
                c, e = seg.control, seg.end
                out.append(f"Q{_num(c.real)} {_num(c.imag)} {_num(e.real)} {_num(e.imag)}")
            elif t == "Arc":
                out.append(f"A{_num(seg.radius.real)} {_num(seg.radius.imag)} "
                           f"{_num(seg.rotation)} {1 if seg.large_arc else 0} "
                           f"{1 if seg.sweep else 0} "
                           f"{_num(seg.end.real)} {_num(seg.end.imag)}")
            elif t == "Close":
                out.append("Z")
        except Exception:
            continue
    return " ".join(out) if out else d


def lucide_path(name):
    """返回该图标在 24×24 视框内的 path data（**不做归一化**）。

    ⚠ 拼接多个 <path> 时必须保留分段语义：把 "M5 12h14" 与
    "m12 5 7 7-7 7" 直接拼成 "M5 12h14m12 5 7 7-7 7" 虽合法，
    但相对指令 `m` 的基准会变成前段终点 —— 若前段有 h/v 偏移，
    合并后坐标就错了（实测 git-fork / book-open / copy 的包围盒会算错）。
    故每段先绝对化再拼接。
    """
    if name in _ICON_CACHE:
        return _ICON_CACHE[name]
    local = os.path.join(SVG_DIR, name + ".svg")
    path = local if os.path.exists(local) else os.path.join(LUCIDE, name + ".svg")
    with open(path, encoding="utf-8") as f:
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
        parts.append("M" + "L".join(p.replace(",", " ") for p in pts))
    if not parts:
        raise SystemExit(f"icon parse failed: {name}")
    # 逐段绝对化后再拼接。
    # 必须用**权威 SVG 解析器**（svgpathtools）而非自研分词：
    # Lucide 的 d 属性里有 "A2 2 0 0022 17" 这种**无分隔符**的参数，
    # 自研分词会把 0022 当成 22，吞掉整段弧线
    # （实测 book-open 只剩 "M20.001 19"，图标渲染不出来）。
    d = " ".join(_absolutize_seg(seg) for seg in parts)
    _ICON_CACHE[name] = d
    return _ICON_CACHE[name]


# ── 文件类型徽标（对齐 utils/file-type.ts 的 KNOWN_TYPES）────────
BADGES = {
    "pdf":  ("P", "#C2183A"),   # 深红：白字 ≥4.5:1
    "doc":  ("D", "#0057C2"),   # 深钴蓝
    "docx": ("D", "#0057C2"),
    "xls":  ("X", "#227A3C"),   # 深绿
    "xlsx": ("X", "#227A3C"),
    "csv":  ("C", "#227A3C"),
    "ppt":  ("S", "#B3420A"),   # 深橙
    "pptx": ("S", "#B3420A"),
    "md":   ("M", "#7E22A8"),   # 深紫
    "txt":  ("T", "#4A5763"),   # 深灰蓝
    "html": ("H", "#B03A18"),   # 深橙红
    "png":  ("I", "#5B21B6"),   # 深紫罗兰
    "jpg":  ("I", "#5B21B6"),
    "webp": ("I", "#5B21B6"),
}


def badge_for(name):
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    return BADGES.get(ext)


def text_w(s, size):
    """估算文本渲染宽度（px）：CJK 按全角，其余按 0.55em。

    用于给「图标 + 文字」按钮算宽度——v2 草稿用 len()*13 估算，
    中文按钮因此被算窄导致文字换行、溢出边框（视觉评审实测到的缺陷）。
    """
    w = 0.0
    for ch in s:
        w += size if ord(ch) > 0x2E80 else size * 0.55
    return w
