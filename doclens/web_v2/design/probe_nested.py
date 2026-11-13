# -*- coding: utf-8 -*-
"""实验：嵌套 frame 的子节点坐标系语义 + clip 行为。

要回答：
  Q1. frame A 内的 frame B，其子节点 x/y 相对 B 还是相对页面？
  Q2. frame 是否裁剪越界子节点？

结论（实测）：
  Q1. **相对父 frame**。父 frame(100,100) 内 frame(50,50) 的子节点
      (10,20) 渲染在页面 (160,170) = 100+50+10, 100+50+20。
      故分组内坐标需减去分组原点（figcraft_kit 的 _rel() 已处理）。
  Q2. **会裁剪**。frame 的 clip 默认 true，越界子节点被切在内框边缘。

用法：python probe_nested.py
"""
import json
import os
import subprocess
import zipfile

CLI = r"C:\Users\lianghao\AppData\Local\Programs\ArtCraft\FigCraft\figcraft-cli.exe"
TMP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_probe_out")
os.makedirs(TMP, exist_ok=True)


def step(params, as_=None):
    s = {"command": "node.create", "params": params}
    if as_:
        s["as"] = as_
    return s


root = step({
    "type": "frame", "name": "root", "x": 100, "y": 100,
    "width": 400, "height": 300, "props": {"fill": "#FFFFFF"}}, "root")

inner = step({
    "type": "frame", "name": "inner", "parent": {"$ref": "root"},
    "x": 50, "y": 50, "width": 200, "height": 200,
    "props": {"fill": "#F1F4F7"}}, "inner")

leaf = step({
    "type": "rectangle", "name": "leaf", "parent": {"$ref": "inner"},
    "x": 10, "y": 20, "width": 30, "height": 40,
    "props": {"fill": "#0064E0"}})

over = step({
    "type": "rectangle", "name": "overflow", "parent": {"$ref": "inner"},
    "x": 180, "y": 180, "width": 60, "height": 60,
    "props": {"fill": "#E41E3F"}})

script = [root, inner, leaf, over]

sp = os.path.join(TMP, "n.json")
fp = os.path.join(TMP, "n.figcraft")
with open(sp, "w", encoding="utf-8") as f:
    json.dump(script, f, indent=1)
r = subprocess.run([CLI, "run", sp, "--out", fp], capture_output=True, text=True)
if r.returncode:
    print(r.stdout[-500:])
    raise SystemExit(1)

with zipfile.ZipFile(fp) as z:
    d = json.loads(z.read("document.json"))

print("--- 存储坐标（相对父 frame）---")
for n in d["nodes"].values():
    t = n.get("transform")
    print(f"{n.get('name'):10s} type={n.get('type'):9s} parent={n.get('parent')} "
          f"x={t[4] if t else '-':7} y={t[5] if t else '-':7} "
          f"w={n.get('width')} h={n.get('height')} clip={n.get('clip')}")

# 渲染并量像素
png = os.path.join(TMP, "n.png")
subprocess.run([CLI, "render", fp, "-o", png, "--scale", "1"], capture_output=True)
try:
    from PIL import Image
    im = Image.open(png).convert("RGB")
    W, H = im.size

    def find(rgb):
        pts = [(x, y) for y in range(H) for x in range(W) if im.getpixel((x, y)) == rgb]
        if not pts:
            return None
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        return (min(xs), min(ys), max(xs), max(ys))

    print("\n--- 渲染实测 ---")
    print("leaf 蓝块（期望 160,170）:", find((0, 100, 224)))
    print("overflow 红块（期望 230,230 但被裁到内框）:", find((228, 30, 63)))
    print("inner 灰底（期望 150,150）:", find((241, 244, 247)))
except ImportError:
    print("(需 Pillow 才能量像素)")
