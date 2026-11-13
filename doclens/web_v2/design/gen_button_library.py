# -*- coding: utf-8 -*-
"""试点：把 Lit 按钮组件转换为 FigCraft 组件（变体集），并在页面稿中放实例。

产出：designs/button_library.figcraft
  - 「按钮」组件集：4 variant（primary/ink/outline/danger）× 3 state
    （default/hover/disabled），规格取自 input-box.ts + tokens.css
  - 4 个实例各切不同 variant
  - 组件属性清单（component.properties 输出）
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from figcraft_kit import Doc, MUTED_BG, SURFACE, TEXT, TEXT_CAP  # noqa: E402
from components_figcraft import build_button_library, place_button  # noqa: E402

W, H = 900, 560
d = Doc()
d.frame("按钮组件库试点", 0, 0, W, H, fill=SURFACE, as_="page")

# ── 组件区（左侧，主组件 + 变体矩阵）──
d.group("组件库", 0, 0, 460, H, as_="libzone")
d.text("lib-title", 24, 24, "按钮 · 组件集", 20, TEXT, True, w=200, parent="libzone")
d.text("lib-sub", 24, 52, "规格源：input-box.ts + tokens.css（pill/33px/pad-x 14）",
       12, TEXT_CAP, w=420, parent="libzone")

# 变体矩阵主组件（component.create 后成为组件）
SET_REF = build_button_library(d, x=24, y=84)

# ── 实例区（右侧）：instance.create + setProperties 切换变体 ──
d.group("实例区", 480, 0, W - 480, H, as_="usezone")
d.text("use-title", 480 + 24, 24, "实例（instance.create → setProperties）",
       20, TEXT, True, w=380, parent="usezone")

USES = [
    ("primary", "发送（input-box）"),
    ("ink", "确认（对话框）"),
    ("outline", "编辑（工具条）"),
    ("danger", "删除（确认框）"),
]
uy = 84
for i, (variant, desc) in enumerate(USES):
    d.group(f"用例 {i + 1}·{variant}", 480 + 24, uy, W - 480 - 48, 56,
             as_=f"u{i}", parent="usezone")
    d.rect(f"u{i}-bg", 480 + 24, uy, W - 480 - 48, 56, MUTED_BG, radius=8,
           parent=f"u{i}")
    d.text(f"u{i}-desc", 480 + 40, uy + 19, desc, 13, TEXT_CAP, w=220, parent=f"u{i}")
    # 实例：先 create（默认变体），再 setProperties 切换
    d.cmd("instance.create", {
        "component": {"$ref": SET_REF}, "x": 480 + 260, "y": uy + 11}, as_=f"ui{i}")
    d.cmd("instance.setProperties", {
        "id": {"$ref": f"ui{i}"},
        "properties": {"variant": f"{variant} state=default"}})
    uy += 68

# ── 组件属性清单输出（component.properties 的断言留到门禁）──
d.cmd("component.properties", {"id": {"$ref": SET_REF}}, as_="props_dump")

d.save("button_library")
