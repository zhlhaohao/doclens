# -*- coding: utf-8 -*-
"""codeConnect：FigCraft 组件 ↔ 仓库 Lit 组件 的正式关联。

对每个 FigCraft 组件挂上：
  - language: react（最接近 Lit 的声明式写法；lit 未内置）
  - importPath: 仓库内真实文件路径（相对 frontend/src）
  - template: 与 Lit 组件用法一致的调用片段

产出：figcraft.connect.json（figcraft_kit 同目录），
用 codeConnect.import 挂到组件库文档上。
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# FigCraft 组件名（变体集内主组件按命名约定自动命名）→ 仓库 Lit 组件
# 组件名取「变体集内 default 主组件」的规范名（见 components_figcraft.py）。
LINKS = [
    {
        "component": "variant=primary state=default",
        "language": "react",
        "importPath": "./components/input-box",
        "name": "SendButton",
        "template": "<button class=\"send\" ?disabled={disabled}>发送</button>",
    },
    {
        "component": "variant=ink state=default",
        "language": "react",
        "importPath": "./components/delete-dialog",
        "name": "ConfirmButton",
        "template": "<button class=\"confirm\">{label}</button>",
    },
    {
        "component": "variant=outline state=default",
        "language": "react",
        "importPath": "./components/file-list",
        "name": "ToolbarButton",
        "template": "<button class=\"tb-btn\" data-action=\"{action}\">{label}</button>",
    },
    {
        "component": "variant=danger state=default",
        "language": "react",
        "importPath": "./components/delete-dialog",
        "name": "DangerButton",
        "template": "<button class=\"danger\">{label}</button>",
    },
    {
        "component": "type=md state=default",
        "language": "react",
        "importPath": "./utils/file-type",
        "name": "FileTypeBadge",
        "template": "<span class=\"badge\" style=\"background:{bg}\">{letter}</span>",
    },
    {
        "component": "state=default",
        "language": "react",
        "importPath": "./components/file-search-box",
        "name": "FileSearchBox",
        "template": "<file-search-box ?disabled={disabled}></file-search-box>",
    },
]

out = {"version": 1, "links": LINKS}
path = os.path.join(HERE, "figcraft.connect.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print(f"wrote {path} ({len(LINKS)} links)")

# ── apply_connect.json：门禁重建文档后的一键恢复脚本 ──────────
# （figcraft-cli run 重建 .figcraft 会丢 codeConnect/devResource）
LIB = os.path.join(HERE, "designs", "component_library.figcraft")
BASE = "https://github.com/zhlhaohao/doclens/blob/main/doclens/web_v2/frontend/src"
SET_IDS = {"Button": 42, "FileBadge": 65, "SearchInput": 80, "Chip": 98}
COMP_MAP = [
    (6, "Lit: input-box.ts（primary 发送按钮）", "components/input-box.ts"),
    (15, "Lit: delete-dialog.ts（ink 确认按钮）", "components/delete-dialog.ts"),
    (24, "Lit: file-list.ts（outline 工具条按钮）", "components/file-list.ts"),
    (33, "Lit: delete-dialog.ts（danger 危险按钮）", "components/delete-dialog.ts"),
    (44, "Lit: utils/file-type.ts（md 徽标）", "utils/file-type.ts"),
    (47, "Lit: utils/file-type.ts（pdf 徽标）", "utils/file-type.ts"),
    (50, "Lit: utils/file-type.ts（xlsx 徽标）", "utils/file-type.ts"),
    (53, "Lit: utils/file-type.ts（pptx 徽标）", "utils/file-type.ts"),
    (56, "Lit: utils/file-type.ts（png 徽标）", "utils/file-type.ts"),
    (59, "Lit: utils/file-type.ts（docx 徽标）", "utils/file-type.ts"),
    (62, "Lit: utils/file-type.ts（txt 徽标）", "utils/file-type.ts"),
    (67, "Lit: file-search-box.ts（default）", "components/file-search-box.ts"),
    (71, "Lit: file-search-box.ts（focus）", "components/file-search-box.ts"),
    (76, "Lit: file-search-box.ts（disabled）", "components/file-search-box.ts"),
]
steps = [{"command": "file.open", "params": {"path": LIB}}]
for sid, nm in SET_IDS.items():
    steps.append({"command": "node.set", "params": {"ids": [sid], "name": nm}})
steps.append({"command": "codeConnect.import",
              "params": {"json": {"version": 1, "links": LINKS}}})
for cid, name, rel in COMP_MAP:
    steps.append({"command": "devResource.add",
                  "params": {"id": cid, "url": f"{BASE}/{rel}", "name": name}})
steps.append({"command": "codeConnect.export",
              "params": {"path": os.path.join(HERE, "figcraft.connect.json")}})
steps.append({"command": "file.save", "params": {}})
apath = os.path.join(HERE, "apply_connect.json")
with open(apath, "w", encoding="utf-8") as f:
    json.dump(steps, f, ensure_ascii=False, indent=1)
print(f"wrote {apath} ({len(steps)} steps)")
