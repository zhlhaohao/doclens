# -*- coding: utf-8 -*-
"""生成图标的**光学度量表**：每个图标的墨迹包围盒（24 视框单位）。

为什么需要：
  FigCraft 把 path **拉伸填满** width×height，忽略路径自身宽高比。
  实测：自然 40×20 的矩形放进 40×40 节点 → 渲染成 42×41（正方形）。
  于是 chevron-right（自然 24×12）被拉成正方形，视觉上比 folder 大一圈
  —— 这正是「目录树图标太大、没对齐」的根源。

  对策：按每个图标的真实墨迹比例设置 width/height，并按墨迹中心对齐。

数据来源：直接解析 Lucide 的 path（figcraft_kit.path_bbox），
  圆弧按 SVG 规范 F.6.5 离散采样，边界准确。

输出 icon_metrics.json：
  {icon: {"x0","y0","x1","y1",   墨迹范围（24 视框单位）
          "w","h"}}               墨迹宽高

用法：python build_icon_metrics.py <icons.txt> <out.json>
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from figcraft_kit import lucide_path, path_bbox  # noqa: E402

icons = [l.strip() for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
result = {}

for nm in icons:
    try:
        x0, y0, x1, y1 = path_bbox(lucide_path(nm))
    except SystemExit:
        print(f"解析失败: {nm}")
        continue
    result[nm] = {
        "x0": round(x0, 2), "y0": round(y0, 2),
        "x1": round(x1, 2), "y1": round(y1, 2),
        "w": round(x1 - x0, 2), "h": round(y1 - y0, 2),
    }

with open(sys.argv[2], "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=1)
print(f"wrote {sys.argv[2]} ({len(result)} icons)")

# 报告：哪些图标偏离「方正」最多（拉伸变形最严重）
print("\n--- 墨迹宽高比（FigCraft 会拉伸成正方形，故需按比例还原）---")
for nm, v in sorted(result.items(), key=lambda kv: kv[1]["w"] / max(kv[1]["h"], 0.01)):
    r = v["w"] / max(v["h"], 0.01)
    flag = " ← 最扁" if abs(r - 1) > 0.4 else ""
    print(f"  {nm:20s} {v['w']:5.1f}×{v['h']:5.1f}  比 {r:.2f}{flag}")
