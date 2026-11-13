# -*- coding: utf-8 -*-
"""几何校验：核对渲染 PNG 的关键位置颜色是否符合复刻设计。

探针（名称/坐标/期望色）由生成器 gen_*.py 一并输出，
避免手写坐标与实际布局脱节。

用法：python check_render.py <png> <probes.json>
"""
import json
import sys
from PIL import Image

png, probe_file = sys.argv[1], sys.argv[2]
im = Image.open(png).convert("RGB")
W, H = im.size
print(f"size: {W}x{H}")


def px(x, y):
    return im.getpixel((int(x), int(y)))


def near(c, hexs, tol=14):
    r, g, b = int(hexs[1:3], 16), int(hexs[3:5], 16), int(hexs[5:7], 16)
    return all(abs(c[i] - (r, g, b)[i]) <= tol for i in range(3))


probes = json.load(open(probe_file, encoding="utf-8"))
fails = 0
for p in probes:
    if p.get("region"):
        # 区域探针：区域内必须出现期望色（描边图标是空心线稿，单点取不到）
        x0, y0, x1, y1 = p["x"], p["y"], p["x2"], p["y2"]
        found = any(near(px(x, y), p["expect"], p.get("tol", 14))
                    for x in range(int(x0), int(x1))
                    for y in range(int(y0), int(y1)))
        print(f"{'OK  ' if found else 'FAIL'} {p['name']:22s} 区域({x0},{y0})-({x1},{y1}) "
              f"期望色存在={found}")
        if not found:
            fails += 1
        continue
    c = px(p["x"], p["y"])
    ok = near(c, p["expect"], p.get("tol", 14))
    if not ok:
        fails += 1
    print(f"{'OK  ' if ok else 'FAIL'} {p['name']:22s} @({p['x']},{p['y']}) 实际={c} 期望≈{p['expect']}")


def has_ink(x0, y0, x1, y1, thresh=120):
    cnt = 0
    for yy in range(int(y0), int(y1)):
        for xx in range(int(x0), int(x1)):
            r, g, b = px(xx, yy)
            if (r + g + b) / 3 < thresh:
                cnt += 1
    return cnt


TEXTS = [
    ("顶栏标题",   660, 12, 790, 40),
    ("活动栏标签", 40,  70,  140, 240),
    ("面包屑",     360, 58, 700, 90),
    ("树目录",     120, 125, 340, 430),
    ("文件名列表", 430, 150, 700, 460),
    ("预览头部",   900, 60, 1430, 100),
    ("预览正文",   900, 115, 1430, 320),
    ("代码块",     900, 340, 1420, 410),
]
if W < 600:  # 移动端画布用另一组区域
    TEXTS = [
        ("顶栏标题",   140, 12, 260, 40),
        ("面包屑",     40,  108, 330, 140),
        ("文件名列表", 40,  145, 380, 460),
        ("tab 栏",     0,   788, 390, 844),
    ]
if "component_library" in probe_file:  # 组件库总成画布
    TEXTS = [
        ("库标题",   28, 20, 500, 50),
        ("分区标题", 32, 88, 700, 110),
        ("组件标签", 30, 120, 900, 600),
        ("演示区",   30, 640, 900, 740),
    ]
elif "button_library" in probe_file:  # 按钮组件库画布
    TEXTS = [
        ("组件区标题", 20, 16, 240, 48),
        ("变体标签",   24, 84, 200, 480),
        ("实例描述",   504, 84, 760, 320),
    ]
elif "v2" in probe_file:  # v2 画布另设区域
    TEXTS = [
        ("页面标题",   40,  8,   200, 48),
        ("全局搜索",   470, 10,  780, 46),
        ("快速访问",   90,  110, 340, 200),
        ("目录树",     90,  250, 340, 480),
        ("面包屑",     340, 60,  780, 90),
        ("主操作按钮", 780, 62,  1000, 100),
        ("更多菜单",   950, 110, 1120, 320),
        ("文件列表",   340, 150, 900, 470),
        ("状态栏",     340, 866, 900, 900),
        ("预览信息卡", 960, 60,  1400, 180),
        ("预览正文",   960, 200, 1400, 420),
        ("预览动作条", 960, 850, 1400, 900),
    ]
for name, x0, y0, x1, y1 in TEXTS:
    if x1 > W or y1 > H:
        continue
    cnt = has_ink(x0, y0, x1, y1)
    ok = cnt > 20
    if not ok:
        fails += 1
    print(f"{'OK  ' if ok else 'FAIL'} 文本墨点 {name:12s} 计数={cnt}")

print("\nFAILED" if fails else "\nALL PASS")
sys.exit(1 if fails else 0)
