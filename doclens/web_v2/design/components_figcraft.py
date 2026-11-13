# -*- coding: utf-8 -*-
"""Lit 自绘组件 → FigCraft 组件的翻译层（试点：按钮）。

对应仓库组件（样式取自源码，色值经 tokens_source 从 tokens.css 取）：
  - 主色 pill   input-box.ts 的发送按钮（--cortex-primary）
  - 黑色 pill   对话框确认（--cortex-btn-primary-*，marketing primary）
  - 描边 pill   工具条/次操作（1px --cortex-border 描边）
  - 危险 pill   删除确认（--cortex-danger）

变体属性（Figma 语义）：
    variant = primary | ink | outline | danger
    state   = default | hover | disabled

用法（生成器内）：
    from components_figcraft import build_button_library
    build_button_library(d, x, y)     # 建组件集（主组件们）
    ...
    place_button(d, x, y, variant="primary")   # 放实例

注意：FigCraft 的 instance.create 用变体集时会取默认变体；
切换变体用 instance.setProperties {"variant": "ink"}（实测）。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figcraft_kit import (  # noqa: E402
    BORDER, DANGER, FS_SM, FS_XS, ICON_MD, ICON_XS, MONO, MUTED_BG,
    ON_PRIMARY,
    PRIMARY, PRIMARY_HOVER, SANS, SURFACE, TEXT, TEXT_CAP, TEXT_MU,
    TEXT_SUB, text_w,
)
from tokens_source import TOKENS  # noqa: E402

# ── 按钮 token（与 input-box.ts / tokens.css 对齐）──────────────
PILL_R = 100                     # --cortex-radius-pill
PAD_L, PAD_R, GAP_I = 11, 11, 7  # 按钮内边距与图标-文字间距（v3 实测）
PAD_X = 14                       # --cortex-btn-pad-x
H_SM = 33                        # --cortex-btn-h-sm（≈ fs-md*1.4+12）
INK_BG = TOKENS["light"]["--cortex-btn-primary-bg"].upper()        # #0A1317
INK_PRESSED = TOKENS["light"]["--cortex-btn-primary-pressed"].upper()
INK_DISABLED = TOKENS["light"]["--cortex-btn-primary-disabled"].upper()

# 变体定义：key → (底色, 文字色, 描边 or None, hover 底色, disabled 底色)
VARIANTS = {
    "primary": (PRIMARY, ON_PRIMARY, None, PRIMARY_HOVER, PRIMARY),
    "ink":     (INK_BG, ON_PRIMARY, None, INK_PRESSED, INK_DISABLED),
    "outline": (SURFACE, TEXT, BORDER, MUTED_BG, SURFACE),
    "danger":  (DANGER, ON_PRIMARY, None, DANGER, DANGER),
}


def _btn_frame(d, name, x, y, w, h, bg, fg, label, stroke=None, state="default"):
    """画一个按钮 frame（含文字），返回顶层 frame 的命令引用名。"""
    tag = f"{name}-{x}-{y}".replace(".", "_")
    d.group(name, x, y, w, h, as_=tag)
    p = {"fill": bg, "cornerRadius": PILL_R}
    if stroke:
        p["stroke"] = stroke
        p["strokeWeight"] = 1
        p["strokeAlign"] = "inside"
    d.rect(f"{tag}-bg", x, y, w, h, parent=tag, radius=None)
    # 直接用 set_properties 的方式更可靠：重画底板
    return tag


# outline 变体族：无图标「编辑」+ v3 主操作三形态（上传/新建/新目录）。
# 每个形态是独立变体（variant 值 = outline / outline-upload / ...）。
OUTLINE_FORMS = [
    ("outline", "编辑", None),
    ("outline-upload", "上传", "upload"),
    ("outline-new-file", "新建", "file-plus"),
    ("outline-new-dir", "新目录", "folder-plus"),
]


def build_button_library(d, x=0, y=0):
    """在 (x, y) 处建「按钮」组件集：4 variant × 3 state 的主组件 + 变体集。

    outline 变体带图标（upload/file-plus/folder-plus，对应 v3 主操作）。
    返回组件集的 as 名（供 instance.create 引用）。
    """
    refs = []
    ry = y
    # outline 族展开为多形态（无图标「编辑」+ v3 主操作三形态带图标），
    # 每个形态是独立变体（variant 值 = outline / outline-upload / ...）
    outline_forms = OUTLINE_FORMS
    for vi, (vkey, (bg, fg, stroke, hbg, dbg)) in enumerate(VARIANTS.items()):
        label0 = {"primary": "发送", "ink": "确认",
                  "outline": "编辑", "danger": "删除"}[vkey]
        forms = (outline_forms if vkey == "outline"
                 else [(vkey, label0, None)])
        for ovkey, label, ic in forms:
            for si, (skey, use_bg) in enumerate([("default", bg),
                                                 ("hover", hbg),
                                                 ("disabled", dbg)]):
                iw = (PAD_L + 15 + GAP_I) if ic else 0
                w = PAD_X + iw + text_w(label, FS_SM) + PAD_R
                as_ = f"btn-{ovkey}-{skey}"
                d.group(f"variant={ovkey} state={skey}", x, ry, w, H_SM, as_=as_)
                p = {"fill": use_bg, "cornerRadius": PILL_R}
                if stroke and skey != "hover":
                    p["stroke"] = stroke
                    p["strokeWeight"] = 1
                d.cmd("node.create", {
                    "type": "rectangle", "name": f"{as_}-bg", "x": x, "y": ry,
                    "width": w, "height": H_SM,
                    "props": {**p, "strokeAlign": "inside"},
                    "parent": {"$ref": as_}})
                tx = x + PAD_X
                if ic:
                    d.icon(ic, tx, ry + (H_SM - 15) / 2, ICON_MD, TEXT, 2, parent=as_)
                    tx += 15 + GAP_I
                fg_use = fg if skey != "disabled" else "#BCC0C4"
                d.text(f"{as_}-label", tx, ry + (H_SM - FS_SM * 1.45) / 2,
                       label, FS_SM, fg_use, False, SANS, w=w, parent=as_)
                refs.append((as_, ovkey, skey))
                ry += H_SM + 12

    # 合成变体集。FigCraft 的变体命名约定：组件名 = "属性=值 属性=值"，
    # combineVariants 按名字解析出 variant/state 两个属性。
    set_ref = "btn-set"
    for as_, vkey, skey in refs:
        d.cmd("node.set", {"ids": [{"$ref": as_}],
                           "name": f"variant={vkey} state={skey}"})
    d.cmd("component.create", {"ids": [{"$ref": refs[0][0]}]}, as_="c0")
    for as_, _, _ in refs[1:]:
        d.cmd("component.create", {"ids": [{"$ref": as_}]}, as_="cx_" + as_)
    d.cmd("component.combineVariants", {
        "ids": [{"$ref": "c0"}] + [{"$ref": "cx_" + a} for a, _, _ in refs[1:]]},
        as_=set_ref)
    return set_ref


def place_button(d, x, y, label, variant="primary", w=None):
    """放一个按钮实例，并把变体切到 variant（instance.setProperties）。

    label 仅用于生成器侧标注宽度（FigCraft 实例宽随主组件）。
    """
    ref = d.cmd("instance.create", {
        "component": {"$ref": "btn-set"}, "x": x, "y": y}, as_=f"btn-inst-{x}-{y}")
    # FigCraft 变体属性值 = 复合串（错误信息列出的合法值格式），
    # 默认 state=default
    d.cmd("instance.setProperties", {
        "id": {"$ref": f"btn-inst-{x}-{y}"},
        "properties": {"variant": f"{variant} state=default"}})
    return ref


# ══════════════════════════════════════════════════════════════
# 文件类型徽标 FileBadge（对齐 utils/file-type.ts KNOWN_TYPES）
# ══════════════════════════════════════════════════════════════
# 前端原色（KNOWN_TYPES）为观赏色；设计稿用加深版（白字 ≥4.5:1）。
# 变体名 = 文件类型；每类一个主组件，combineVariants 成集。
BADGE_SPEC = [
    ("md",   "M", "#7E22A8"),
    ("pdf",  "P", "#C2183A"),
    ("xlsx", "X", "#227A3C"),
    ("pptx", "S", "#B3420A"),
    ("png",  "I", "#5B21B6"),
    ("docx", "D", "#0057C2"),
    ("txt",  "T", "#4A5763"),
]
BADGE_SIZE = 18          # file-row.ts 的徽标尺寸
BADGE_R = 5


def build_badge_library(d, x, y):
    """文件类型徽标组件集。返回组件集引用名。"""
    refs = []
    cx = x
    for ext, letter, color in BADGE_SPEC:
        as_ = f"badge-{ext}"
        d.group(f"type={ext}", cx, y, BADGE_SIZE, BADGE_SIZE, as_=as_)
        d.rect(f"{as_}-bg", cx, y, BADGE_SIZE, BADGE_SIZE, color,
               radius=BADGE_R, parent=as_)
        d.text(f"{as_}-letter", cx, y + 3, letter, 10, ON_PRIMARY, True,
               MONO, w=BADGE_SIZE, align="center", parent=as_)
        refs.append(as_)
        cx += BADGE_SIZE + 12
    set_ref = "badge-set"
    for i, as_ in enumerate(refs):
        d.cmd("component.create", {"ids": [{"$ref": as_}]},
              as_=f"c_badge_{i}")
    d.cmd("component.combineVariants", {
        "ids": [{"$ref": f"c_badge_{i}"} for i in range(len(refs))]},
        as_=set_ref)
    return set_ref


def place_badge(d, x, y, ext):
    ref = d.cmd("instance.create", {
        "component": {"$ref": "badge-set"}, "x": x, "y": y},
              as_=f"badge-inst-{x}-{y}")
    d.cmd("instance.setProperties", {
        "id": {"$ref": f"badge-inst-{x}-{y}"}, "properties": {"type": ext}})
    return ref


# ══════════════════════════════════════════════════════════════
# 搜索框 SearchInput（对齐 file-search-box.ts 三态）
# ══════════════════════════════════════════════════════════════
# .box：1px border + radius-md + surface；focus：border=primary；
# disabled：surface-muted 底。
SEARCH_W = 240
SEARCH_H = 34
SEARCH_R = 8             # --cortex-radius-md
FOCUS_RING = "#E8F0FE"   # 聚焦环用 primary-soft 底模拟（--cortex-focus-ring）


def build_search_library(d, x, y):
    """搜索框组件集：state = default | focus | disabled。返回集引用名。"""
    states = [
        ("default",  SURFACE,  BORDER),
        ("focus",    SURFACE,  PRIMARY),
        ("disabled", MUTED_BG, BORDER),
    ]
    refs = []
    ry = y
    for skey, bg, border in states:
        as_ = f"search-{skey}"
        d.group(f"state={skey}", x, ry, SEARCH_W, SEARCH_H, as_=as_)
        p = {"fill": bg, "cornerRadius": SEARCH_R}
        if skey == "focus":
            # 聚焦环：外扩 2px 的 primary-soft 底环（模拟 box-shadow）
            d.rect(f"{as_}-ring", x - 2, ry - 2, SEARCH_W + 4, SEARCH_H + 4,
                   FOCUS_RING, radius=SEARCH_R + 2, parent=as_)
        d.rect(f"{as_}-box", x, ry, SEARCH_W, SEARCH_H, fill=bg,
               radius=SEARCH_R, stroke=border, parent=as_)
        d.icon("search", x + 12, ry + (SEARCH_H - 15) / 2, ICON_MD,
               TEXT_CAP, 2, parent=as_)
        ph = "筛选当前目录…" if skey != "disabled" else "已禁用"
        ph_color = TEXT_SUB if skey != "disabled" else TEXT_CAP
        d.text(f"{as_}-ph", x + 36, ry + (SEARCH_H - FS_SM * 1.45) / 2, ph,
               FS_SM, ph_color, w=180, parent=as_)
        refs.append(as_)
        ry += SEARCH_H + 16
    set_ref = "search-set"
    for i, as_ in enumerate(refs):
        d.cmd("component.create", {"ids": [{"$ref": as_}]}, as_=f"c_search_{i}")
    d.cmd("component.combineVariants", {
        "ids": [{"$ref": f"c_search_{i}"} for i in range(len(refs))]},
        as_=set_ref)
    return set_ref


def place_search(d, x, y, state="default"):
    ref = d.cmd("instance.create", {
        "component": {"$ref": "search-set"}, "x": x, "y": y}, as_=f"search-inst-{x}")
    d.cmd("instance.setProperties", {
        "id": {"$ref": f"search-inst-{x}"}, "properties": {"state": state}})
    return ref


# ══════════════════════════════════════════════════════════════
# 元信息 Chip（对齐预览栏信息卡 chips）
# ══════════════════════════════════════════════════════════════
CHIP_H = 26
CHIP_R = 13              # pill


def build_chip_library(d, x, y):
    """chip 组件集：type = text | indexed（有无对勾图标）。"""
    chips = [
        ("text", "Markdown", TEXT_MU, None),
        ("time", "11/13 10:22", TEXT_MU, "clock"),
        ("size", "24.8 KB", TEXT_MU, "database"),
        ("indexed", "已索引", "#1A7F37", "circle-check"),
    ]
    refs = []
    cx = x
    for ckey, label, color, ic in chips:
        tw = text_w(label, FS_XS) * 1.3 + 6
        cw = tw + 38
        as_ = f"chip-{ckey}"
        d.group(f"type={ckey}", cx, y, cw, CHIP_H, as_=as_)
        d.rect(f"{as_}-bg", cx, y, cw, CHIP_H, SURFACE, radius=CHIP_R,
               stroke=BORDER, parent=as_)
        icon_name = ic or "tag"
        d.icon(icon_name, cx + 9, y + (CHIP_H - 12) / 2, ICON_XS, color, 2,
               parent=as_)
        d.text(f"{as_}-label", cx + 28, y + (CHIP_H - FS_XS * 1.45) / 2, label,
               FS_XS, color, w=tw, parent=as_)
        refs.append(as_)
        cx += cw + 8
    set_ref = "chip-set"
    for i, as_ in enumerate(refs):
        d.cmd("component.create", {"ids": [{"$ref": as_}]}, as_=f"c_chip_{i}")
    d.cmd("component.combineVariants", {
        "ids": [{"$ref": f"c_chip_{i}"} for i in range(len(refs))]},
        as_=set_ref)
    return set_ref


def place_chip(d, x, y, ckey):
    ref = d.cmd("instance.create", {
        "component": {"$ref": "chip-set"}, "x": x, "y": y}, as_=f"chip-inst-{x}")
    d.cmd("instance.setProperties", {
        "id": {"$ref": f"chip-inst-{x}"}, "properties": {"type": ckey}})
    return ref
