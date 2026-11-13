# -*- coding: utf-8 -*-
"""把桌面 + 移动两张复刻合并进一个 .figcraft 文件（两个并列 frame）。

用法：python merge_pages.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figcraft_kit import OUT_DIR  # noqa: E402

# 桌面帧宽 1440，移动帧宽 390 —— 横向并排放不下，移动帧叠放在桌面帧右侧 60px 处
DESKTOP_W, DESKTOP_H = 1440, 900
MOBILE_W, MOBILE_H = 390, 844
GAP = 80

desktop = json.load(open(os.path.join(OUT_DIR, "files_page.json"), encoding="utf-8"))
mobile = json.load(open(os.path.join(OUT_DIR, "files_page_mobile.json"), encoding="utf-8"))

cmds = []
# 两个 frame 先建，名字不同 → 后续 parent 引用各自 frame id
cmds.append({"command": "node.create", "params": {
    "type": "frame", "name": "文件管理页-桌面", "x": 0, "y": 0,
    "width": DESKTOP_W, "height": DESKTOP_H,
    "props": {"fill": "#FFFFFF", "cornerRadius": 0}}, "as": "desk"})
cmds.append({"command": "node.create", "params": {
    "type": "frame", "name": "文件管理页-移动", "x": DESKTOP_W + GAP, "y": 28,
    "width": MOBILE_W, "height": MOBILE_H,
    "props": {"fill": "#FFFFFF", "cornerRadius": 0}}, "as": "mob"})


def retarget(steps, parent_ref):
    """把生成器产出的 parent=page 引用改指到具体 frame。"""
    out = []
    for s in steps:
        s = json.loads(json.dumps(s))
        p = s["params"].get("parent")
        if p == {"$ref": "page"}:
            s["params"]["parent"] = {"$ref": parent_ref}
        out.append(s)
    return out


# 桌面脚本：第一个命令就是建 frame（已由上面替代），其余 parent 指向 desk
cmds += retarget(desktop[1:], "desk")
cmds += retarget(mobile[1:], "mob")

path = os.path.join(OUT_DIR, "files_page_all.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(cmds, f, ensure_ascii=False, indent=1)
print(f"wrote {path} ({len(cmds)} cmds)")
