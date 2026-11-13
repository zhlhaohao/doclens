# -*- coding: utf-8 -*-
"""视觉评审器：从 .figcraft 的 document.json 提取精确几何做自动 lint。

坐标语义（已实测确认）：
  - 位置存在 `transform: [a,b,c,d,tx,ty]`；无 transform 时 tx=ty=0
  - frame 的子节点坐标是**页面坐标**（不是相对父 frame），
    所以绝对坐标 = (tx, ty) + (w, h)
  - `parent` 字段给出层级

检测问题：
  A. 图标溢出：VECTOR 超出其所在按钮矩形
  B. 组件重叠：语义相关的图层（按钮/其文字/其图标）矩形相交
  C. 文字越界：TEXT 超出其所在卡片/栏位
  D. 对比度不足：文字色与底色对比低于 WCAG 阈值
  E. 元素过小：描边图标 < 10px
  F. 元素出血：图层越出 frame

用法：python review_visual.py <file.figcraft> [--out report.json]
"""
import json
import os
import re
import sys
import zipfile
from collections import defaultdict


# ── 颜色 ──────────────────────────────────────────────────────
def to_hex(c):
    if c is None:
        return None
    if isinstance(c, str):
        return c
    if c.get("a", 1) == 0:
        return None
    r, g, b = c.get("r", 0), c.get("g", 0), c.get("b", 0)
    return "#%02X%02X%02X" % (round(r * 255), round(g * 255), round(b * 255))


def _lin(c):
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hexs):
    hexs = hexs.lstrip("#")
    r, g, b = (_lin(int(hexs[i:i + 2], 16) / 255) for i in (0, 2, 4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(fg, bg):
    a, b = luminance(fg), luminance(bg)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


# ── 文档 ──────────────────────────────────────────────────────
def load(path):
    with zipfile.ZipFile(path) as z:
        doc = json.loads(z.read("document.json"))
    return doc, doc["nodes"]


def origin(n):
    """节点的 (tx, ty) —— 相对其父 frame 的偏移。"""
    t = n.get("transform")
    if t and len(t) == 6:
        return t[4], t[5]
    return 0.0, 0.0


def abs_box(n, nodes):
    """节点的**绝对**包围盒（页面坐标）。

    FigCraft 的子节点 x/y 相对**父 frame**，故需沿 parent 链累加原点。
    """
    x, y = origin(n)
    w = n.get("width", 0) or 0
    h = n.get("height", 0) or 0
    p = n.get("parent")
    seen = set()
    while p and p not in seen:
        seen.add(p)
        pn = nodes.get(str(p))
        if not pn:
            break
        px, py = origin(pn)
        x += px
        y += py
        p = pn.get("parent")
    return (x, y, x + w, y + h)


def box(n, nodes=None):
    if nodes is None:
        return abs_box(n, {})
    return abs_box(n, nodes)


def solid_hex(n):
    """返回该图层的实底色；透明/无填充/低透明度叠加层返回 None。

    注意：低透明度图层（阴影 more-menu-shadow、半透明叠加）不是
    文字的「背景底」——把它们当底会把对比度算成 1:1 之类的鬼值。
    阈值 0.9：低于此视为叠加效果层。
    """
    for f in n.get("fills", []) or []:
        if f.get("type") != "solid":
            continue
        op = f.get("opacity", 1)
        if op < 0.9:
            continue
        col = f.get("color") or {}
        if col.get("a", 1) < 0.9:
            continue
        return to_hex(col)
    return None


def gradient_hex(n):
    """渐变填充取第一个 stop 的颜色（近似）。"""
    for f in n.get("fills", []) or []:
        if f.get("type") == "gradient":
            stops = f.get("stops") or []
            if stops:
                return to_hex(stops[0].get("color"))
    return None


def overlap_ratio(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    if inter <= 0:
        return 0.0
    aa = max(1e-6, (a[2] - a[0]) * (a[3] - a[1]))
    ab = max(1e-6, (b[2] - b[0]) * (b[3] - b[1]))
    return inter / min(aa, ab)


def center_dist(a, b):
    ax, ay = (a[0] + a[2]) / 2, (a[1] + a[3]) / 2
    bx, by = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
    return ((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5


def _inside(inner, outer, tol=0.5):
    """inner 是否完全落在 outer 内。"""
    return (inner[0] >= outer[0] - tol and inner[1] >= outer[1] - tol and
            inner[2] <= outer[2] + tol and inner[3] <= outer[3] + tol)


def _is_small_badge(n, b):
    """小圆角块（头像圈 / 复选框 / 类型徽标）——其上叠图形或文字是设计意图。"""
    w, h = n.get("width", 0), n.get("height", 0)
    if not (8 <= w <= 40 and 8 <= h <= 40):
        return False
    # 有圆角（FigCraft 存 corners.radii）或名字像徽标
    if n.get("cornerRadius") or n.get("corners"):
        return True
    return any(k in n["name"].lower() for k in ("avatar", "cb", "badge", "circle"))


def _in_overlay_box(n, b, kids, nodes=None):
    """该图层是否落在某个浮层面板（如 more-menu-bg）内部。"""
    for k in kids:
        if not k.get("name", "").startswith("more-menu"):
            continue
        kb = abs_box(k, nodes or {})
        if _inside(b, kb):
            return True
    return False


def descendants(nodes, node_id, out=None):
    """收集某节点的全部后代（含嵌套 frame 内的图层）。"""
    if out is None:
        out = []
    n = nodes.get(str(node_id))
    if not n:
        return out
    for c in n.get("children", []) or []:
        cn = nodes.get(str(c))
        if not cn:
            continue
        out.append(cn)
        descendants(nodes, c, out)
    return out


def check_palette(fr_name, nodes):
    """G-私造色：设计稿用色必须都在 tokens.css 的色板集合内。

    唯一真源 = tokens.css（light/dark/paper 三主题并集）。
    渐变 stop、阴影色一并检查；抗锯齿灰阶不涉及（这是图层填充层）。
    """
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from tokens_source import TOKENS
        from figcraft_kit import DESIGN_EXTENSIONS
    except Exception:
        return []
    allowed = {k.lower() for k in DESIGN_EXTENSIONS}   # 设计扩展白名单
    for block in TOKENS.values():
        for v in block.values():
            v = v.strip().lower()
            if re.fullmatch(r"#[0-9a-f]{6}([0-9a-f]{2})?", v):
                allowed.add(v[:7])
            else:
                m = re.match(r"#([0-9a-f]{6})", v)
                if m:
                    allowed.add("#" + m.group(1))

    issues = []
    seen = set()
    for n in nodes.values():
        if n.get("type") not in ("rectangle", "text", "vector"):
            continue
        for f in n.get("fills", []) or []:
            c = f.get("color") or {}
            if not c or (c.get("a", 1) == 0) or f.get("opacity", 1) == 0:
                continue
            # 低透明度纯黑 = 阴影模拟（token: --cortex-shadow-*），放行
            if f.get("opacity", 1) < 0.9 and c.get("b", 0) < 0.05 and                     c.get("r", 0) < 0.05 and c.get("g", 0) < 0.05:
                continue
            h = "#%02x%02x%02x" % (round(c.get("r", 0) * 255),
                                   round(c.get("g", 0) * 255),
                                   round(c.get("b", 0) * 255))
            if h in seen or h in allowed:
                continue
            seen.add(h)
            issues.append(("G-私造色", fr_name, n["name"],
                           f"{h} 不在 tokens.css 色板"))
        for f in n.get("strokes", []) or []:
            c = f.get("color") or {}
            if not c:
                continue
            h = "#%02x%02x%02x" % (round(c.get("r", 0) * 255),
                                   round(c.get("g", 0) * 255),
                                   round(c.get("b", 0) * 255))
            if h in seen or h in allowed:
                continue
            seen.add(h)
            issues.append(("G-私造色", fr_name, n["name"],
                           f"{h} 不在 tokens.css 色板"))
    return issues


def main():
    path = sys.argv[1]
    doc, nodes = load(path)
    issues = []

    # 只评审顶层 frame（页面级），其后代含所有嵌套图层
    page_ids = [n["id"] for n in nodes.values() if n.get("type") == "page"]
    frames = []
    for pid in page_ids:
        for c in nodes[str(pid)].get("children", []) or []:
            cn = nodes.get(str(c))
            if cn and cn.get("type") == "frame":
                frames.append(cn)

    for fr in frames:
        kids = descendants(nodes, fr["id"])
        fb = abs_box(fr, nodes)

        # 容器（可作为「容器」的矩形）：非纯背景块
        containers = [(n, abs_box(n, nodes)) for n in kids if n.get("type") == "rectangle"]
        texts = [(n, abs_box(n, nodes)) for n in kids if n.get("type") == "text"]
        vectors = [(n, abs_box(n, nodes)) for n in kids if n.get("type") == "vector"]
        # 嵌套 frame 本身也当作容器（分组是合法的包含关系）
        containers += [(n, abs_box(n, nodes)) for n in kids if n.get("type") == "frame"]

        # ── F. 出血（子节点越出所属 frame）──
        for n in kids:
            b = abs_box(n, nodes)
            pid = n.get("parent")
            pn = nodes.get(str(pid)) if pid else None
            if not pn:
                continue
            if pn.get("type") != "frame":
                continue
            pb = abs_box(pn, nodes)
            if (b[0] < pb[0] - 0.5 or b[1] < pb[1] - 0.5 or
                    b[2] > pb[2] + 0.5 or b[3] > pb[3] + 0.5):
                issues.append(("F-出血", fr["name"], n["name"],
                               f"{tuple(round(v) for v in b)} 越出所属 {pn['name']}"
                               f"{tuple(round(v) for v in pb)}"))

        # ── A. 图标溢出所在按钮 ──
        # 按钮 = 18..130 宽、18..50 高的矩形（浅底或带描边都算按钮）
        buttons = []
        for n, b in containers:
            w, h = n.get("width", 0), n.get("height", 0)
            if not (18 <= w <= 130 and 18 <= h <= 50):
                continue
            if solid_hex(n) in (None, "#FFFFFF") and not n.get("strokes"):
                continue          # 无底无描边 = 纯分隔条，不是按钮
            buttons.append((n, b))
        # 图标若完全落在某个按钮内 → 是该按钮的图标，不算溢出
        for n, b in vectors:
            owner = None
            for bn, bb in buttons:
                if (b[0] >= bb[0] - 0.5 and b[1] >= bb[1] - 0.5 and
                        b[2] <= bb[2] + 0.5 and b[3] <= bb[3] + 0.5):
                    owner = bn
                    break
            if owner is not None:
                continue
            for bn, bb in buttons:
                if overlap_ratio(b, bb) < 0.15:
                    continue
                out = (b[0] < bb[0] - 0.5 or b[1] < bb[1] - 0.5 or
                       b[2] > bb[2] + 0.5 or b[3] > bb[3] + 0.5)
                if out:
                    issues.append(("A-图标溢出", fr["name"], n["name"],
                                   f"icon{tuple(round(v) for v in b)} 溢出按钮 {bn['name']}"
                                   f"{tuple(round(v) for v in bb)}"))
                break

        # ── B. 组件重叠 ──
        # 只在**同一父分组内**比较——不同分组的元素天然不重叠，
        # 跨组比较会把「品牌区 logo」和「状态区 ic-palette」误判为重叠。
        def same_parent(a, b):
            return a.get("parent") == b.get("parent")

        def base_of(name):
            # "act-btn-folder-plus" → "folder-plus"；"ic-folder-plus" → "folder-plus"
            for p in ("act-btn-", "act-t-", "ic-", "menu-", "pv-btn-", "pv-btn-t-",
                      "chip-", "chip-t-", "row-cb-", "row-badge-", "row-letter-",
                      "row-name-", "row-size-", "row-time-", "row-line-",
                      "tree-", "quick-", "quick-badge-", "quick-badge-t-", "nav-",
                      "col-handle-", "status-", "hdr-", "crumb-", "info-", "code-"):
                if name.startswith(p):
                    return name[len(p):]
            return name

        # 分隔线 / 描边 / 徽标底 等「装饰层」与底板叠放是设计意图
        DECOR = ("line", "handle", "bar", "badge", "bg", "fill", "card", "shadow")
        # 浮层（下拉菜单）会盖住下层内容 —— 属预期，单独放行
        OVERLAY = ("more-menu", "menu-")
        # 浮层内的图标/文字（菜单项）不算与下层重叠
        OVERLAY_ITEM = ("menu-",)

        def is_overlay(name):
            return any(name.startswith(p) for p in OVERLAY)

        def is_overlay_item(name):
            return any(name.startswith(p) for p in OVERLAY_ITEM)

        for i in range(len(kids)):
            for j in range(i + 1, len(kids)):
                n1, n2 = kids[i], kids[j]
                # 仅同组内比较
                if not same_parent(n1, n2):
                    continue
                b1, b2 = abs_box(n1, nodes), abs_box(n2, nodes)
                if center_dist(b1, b2) > 60:
                    continue
                ov = overlap_ratio(b1, b2)
                if ov <= 0.30:
                    continue
                t1, t2 = n1.get("type"), n2.get("type")
                # 浮层 vs 任何下层 → 预期
                if is_overlay(n1["name"]) or is_overlay(n2["name"]):
                    continue
                # 浮层内的菜单项图标/文字 vs 下层内容 → 预期（浮层覆盖）
                if is_overlay_item(n1["name"]) or is_overlay_item(n2["name"]):
                    continue
                # 图标落在某个浮层面板内 → 它压住下层内容是预期的
                if t1 == "vector" and _in_overlay_box(n1, b1, kids, nodes):
                    continue
                if t2 == "vector" and _in_overlay_box(n2, b2, kids, nodes):
                    continue
                if t1 == t2 == "text":
                    # 同组件内的两段文字（名称 + 计数）不重叠则忽略；
                    # 这里只报跨组件的文字互压
                    if base_of(n1["name"]) == base_of(n2["name"]):
                        continue
                    if n1["name"].startswith("tree-count-") or n2["name"].startswith("tree-count-"):
                        continue
                    issues.append(("B-组件重叠", fr["name"], f"{n1['name']}|{n2['name']}",
                                   f"文字×文字 重叠 {ov:.0%}"))
                    continue
                # 嵌套 frame 的包含关系（子分组在父分组内）→ 正常
                if t1 == "frame" or t2 == "frame":
                    continue
                # 同属一个组件（基名一致）→ 刻意叠放，跳过
                if base_of(n1["name"]) == base_of(n2["name"]):
                    continue
                # 图标落在按钮/卡片内 → 是该组件的图标，刻意叠放
                if t1 == "rectangle" and t2 == "vector":
                    if (b2[0] >= b1[0] - 0.5 and b2[1] >= b1[1] - 0.5 and
                            b2[2] <= b1[2] + 0.5 and b2[3] <= b1[3] + 0.5):
                        continue
                if t2 == "rectangle" and t1 == "vector":
                    if (b1[0] >= b2[0] - 0.5 and b1[1] >= b2[1] - 0.5 and
                            b1[2] <= b2[2] + 0.5 and b1[3] <= b2[3] + 0.5):
                        continue
                # 圆角小底板（头像圈、复选框、徽标）内含图形/文字 → 刻意叠放
                if t1 == "rectangle" and t2 in ("vector", "text"):
                    if _is_small_badge(n1, b1) and _inside(b2, b1):
                        continue
                if t2 == "rectangle" and t1 in ("vector", "text"):
                    if _is_small_badge(n2, b2) and _inside(b1, b2):
                        continue
                # 文本框（含下拉浮层里的文字）被图标压住：
                # 文本层宽度是「布局盒」而非墨迹范围，且浮层本就覆盖下层
                if t1 == "text" and t2 == "vector":
                    if is_overlay(n1["name"]) or is_overlay(n2["name"]):
                        continue
                if t2 == "text" and t1 == "vector":
                    if is_overlay(n1["name"]) or is_overlay(n2["name"]):
                        continue
                # 装饰层（分隔线/把手/竖条/徽标底）与底板 → 正常
                if any(k in n1["name"].lower() for k in DECOR) or \
                        any(k in n2["name"].lower() for k in DECOR):
                    continue
                # 底板 vs 其上的内容：底板是大面积纯色块 → 正常
                if t1 == "rectangle" and t2 in ("text", "vector"):
                    w, h = n1.get("width", 0), n1.get("height", 0)
                    if w * h > 1200:      # 面板/卡片类大底板
                        continue
                if t2 == "rectangle" and t1 in ("text", "vector"):
                    w, h = n2.get("width", 0), n2.get("height", 0)
                    if w * h > 1200:
                        continue
                if t1 == "rectangle" and t2 == "rectangle":
                    c1, c2 = solid_hex(n1), solid_hex(n2)
                    if c1 == c2 or not c1 or not c2:
                        continue
                    # 头像圈套头像（外圈透明底 + 内圈实色）→ 刻意叠放
                    if _is_small_badge(n1, b1) and _is_small_badge(n2, b2) and _inside(b2, b1):
                        continue
                issues.append(("B-组件重叠", fr["name"], f"{n1['name']}|{n2['name']}",
                               f"{t1}×{t2} 重叠 {ov:.0%} @({round((b1[0]+b1[2])/2)},"
                               f"{round((b1[1]+b1[3])/2)}) vs ({round((b2[0]+b2[2])/2)},"
                               f"{round((b2[1]+b2[3])/2)})"))

        # ── C. 文字越出容器 ──
        for n, b in texts:
            # 文本层的布局盒高度远大于实际墨迹（auto_resize=height 时按行高算，
            # 单行 12px 字的布局盒有 24px）。越界判定应按「墨迹范围」——
            # 用字号估算，否则全是误报。
            fs = n.get("style", {}).get("font_size", 14)
            ink_h = fs * 1.05
            ink_top = b[1] + (b[3] - b[1] - ink_h) / 2
            ink = (b[0], ink_top, b[2], ink_top + ink_h)
            for cn, cb in containers:
                if cn["name"] == n["name"]:
                    continue
                if overlap_ratio(ink, cb) < 0.5:
                    continue
                if (ink[0] >= cb[0] - 1 and ink[1] >= cb[1] - 1 and
                        ink[2] <= cb[2] + 1 and ink[3] <= cb[3] + 1):
                    continue
                cw, chh = cn.get("width", 0), cn.get("height", 0)
                if cw * chh > 40000:
                    continue     # 大面板不算容器
                # 细长的装饰件（列把手、分隔条、竖条）本就不是文字容器
                if min(cw, chh) <= 4:
                    continue
                # 浮层里的文字本就允许越出下层容器
                if is_overlay(n["name"]) or is_overlay(cn["name"]):
                    continue
                issues.append(("C-文字越界", fr["name"], n["name"],
                               f"墨迹{tuple(round(v) for v in ink)} 超出容器 {cn['name']}"
                               f"{tuple(round(v) for v in cb)}"))
                break

        # ── D. 对比度 ──
        solid_rects = [(n, abs_box(n, nodes), solid_hex(n)) for n in kids
                       if n.get("type") == "rectangle" and solid_hex(n)]
        for tn, tb in texts:
            n = tn
            fill = (n.get("fills") or [{}])
            fill = fill[0] if isinstance(fill, list) and fill else {}
            hexv = to_hex(fill.get("color") if isinstance(fill, dict) else None)
            if not hexv:
                continue
            bg = "#FFFFFF"
            # 候选底：包住文字的实底矩形。
            # 取「面积 ≥ 文字面积 0.9 倍」中最小的；若无，取所有候选中
            # 面积 ≥ 文字面积的最大者（行底/面板底）。
            cands = []
            ta = (tb[2] - tb[0]) * (tb[3] - tb[1])
            for cn, cb, ch in solid_rects:
                if (cb[0] - 1 <= tb[0] and cb[1] - 1 <= tb[1] and
                        cb[2] + 1 >= tb[2] and cb[3] + 1 >= tb[3]):
                    area = (cb[2] - cb[0]) * (cb[3] - cb[1])
                    cands.append((area, ch))
            big = [c for c in cands if c[0] >= ta * 0.9]
            if big:
                bg = min(big)[1]
            elif cands:
                # 文字比任何底都大 → 取覆盖它的最大底（页面/面板）
                bg = max(cands)[1]
            cr = contrast(hexv, bg)
            fs = n.get("style", {}).get("font_size", 14)
            need = 3.0 if fs >= 18 else 4.5
            if cr < need:
                issues.append(("D-对比度", fr["name"], n["name"],
                               f"{hexv} on {bg} = {cr:.2f}:1 (需 ≥{need}, {fs:.0f}px)"))

        # ── E. 过小图标 ──
        # 阈值：图标的**墨迹尺寸**不得低于 8px（描边线稿在 100% 缩放下
        # 低于此值几乎不可辨）。
        # 节点尺寸小 ≠ 看不清：more-horizontal 原生就是 16×2 的三个点，
        # 渲染出来本就是条细线；eye 原生 20×8，也属正常。
        # 故按「实际墨迹宽高」判断——FigCraft 把 path 拉伸填满节点框，
        # 故节点尺寸即墨迹尺寸。
        for n, b in vectors:
            w, h = n.get("width", 0), n.get("height", 0)
            nm = n.get("name", "")
            if "check" in nm:
                continue
            base = nm[3:] if nm.startswith("ic-") else nm
            try:
                sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
                from figcraft_kit import ICON_METRICS
            except Exception:
                ICON_METRICS = {}
            m = ICON_METRICS.get(base)
            if not m:
                continue
            # 光学补偿后的实际墨迹尺寸（节点尺寸即墨迹尺寸）
            if w < 8 and h < 8:
                issues.append(("E-过小", fr["name"], nm,
                               f"墨迹 {w:.1f}×{h:.1f}px"))

    issues += check_palette(fr["name"], nodes)

    by_kind = defaultdict(list)
    for kind, frame, name, detail in issues:
        by_kind[kind].append((frame, name, detail))

    print(f"文件：{path}")
    print(f"frame 数：{len(frames)}　问题数：{len(issues)}\n")
    for kind in sorted(by_kind):
        print(f"── {kind} ({len(by_kind[kind])}) ──")
        seen = set()
        for frame, name, detail in by_kind[kind]:
            if name in seen:
                continue
            seen.add(name)
            print(f"  [{frame}] {name}\n      {detail}")
        print()

    if "--out" in sys.argv:
        p = sys.argv[sys.argv.index("--out") + 1]
        with open(p, "w", encoding="utf-8") as f:
            json.dump([{"kind": k, "frame": fr, "name": n, "detail": d}
                       for k, fr, n, d in issues], f, ensure_ascii=False, indent=1)
        print(f"报告已写入 {p}")

    return len(issues)


if __name__ == "__main__":
    sys.exit(0 if main() == 0 else 1)
