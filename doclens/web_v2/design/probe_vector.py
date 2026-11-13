# -*- coding: utf-8 -*-
"""实验：FigCraft vector 节点的 x/y 与视觉位置的关系。

问题背景：more-horizontal 图标在按钮内溢出 1.5px，需确认 FigCraft
对 vector 的 x/y 到底是「视框原点」还是「路径自身原点」。

用法：python probe_vector.py
"""
import json
import os
import subprocess
import sys
import zipfile

CLI = r"C:\Users\lianghao\AppData\Local\Programs\ArtCraft\FigCraft\figcraft-cli.exe"
TMP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_probe_out")
os.makedirs(TMP, exist_ok=True)

# more-horizontal 的真实 path（3 个圆，起点 x=4，视觉中心 x=12）
PATH_MH = ("M11,12A1,1 0 1 0 13,12A1,1 0 1 0 11,12 "
           "M18,12A1,1 0 1 0 20,12A1,1 0 1 0 18,12 "
           "M4,12A1,1 0 1 0 6,12A1,1 0 1 0 4,12")
# folder 的真实 path（起点 x=2，视觉占 2..22）
PATH_FOLDER = "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"

CASES = [
    ("mh@10,10", PATH_MH, 10, 10),
    ("mh@100,100", PATH_MH, 100, 100),
    ("folder@10,10", PATH_FOLDER, 10, 10),
    ("folder@100,100", PATH_FOLDER, 100, 100),
]

for name, path, x, y in CASES:
    script = [
        {"command": "node.create", "params": {
            "type": "frame", "name": "p", "x": 0, "y": 0, "width": 200, "height": 200,
            "props": {"fill": "#FFFFFF"}}, "as": "p"},
        {"command": "node.create", "params": {
            "type": "vector", "name": "ic", "parent": {"$ref": "p"},
            "x": x, "y": y, "width": 24, "height": 24, "path": path,
            "props": {"fill": "#00000000", "stroke": "#000000", "strokeWeight": 2}}},
    ]
    sp = os.path.join(TMP, "s.json")
    fp = os.path.join(TMP, "s.figcraft")
    with open(sp, "w", encoding="utf-8") as f:
        json.dump(script, f)
    subprocess.run([CLI, "run", sp, "--out", fp], capture_output=True)
    if not os.path.exists(fp):
        print(f"{name}: RUN FAILED")
        continue
    with zipfile.ZipFile(fp) as z:
        d = json.loads(z.read("document.json"))
    for n in d["nodes"].values():
        if n.get("name") == "ic":
            t = n["transform"]
            print(f"{name:16s} -> stored x={t[4]:7.2f} y={t[5]:7.2f} "
                  f"w={n['width']:.2f} h={n['height']:.2f}")
            break
    os.remove(fp)
