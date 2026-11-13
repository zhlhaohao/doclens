# -*- coding: utf-8 -*-
"""视觉评审 + 像素校验的门禁脚本。

对指定 .figcraft 跑两类检查：
  1. 几何 lint（review_visual.py）：图标溢出 / 组件重叠 / 文字越界 /
     对比度不足 / 元素过小 / 出血
  2. 像素探针（check_render.py）：渲染 PNG 逐点比对颜色 + 文本墨点

用法：python gate_visual.py <name1> [<name2> ...]
      （name 指 designs/<name>，自动找同名 .figcraft/.probes.json）
"""
import os
import subprocess
import sys

# 脚本位于 <仓库根>/.doclens/tools/figcraft/，上溯两级即仓库根
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."))
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "designs")
CLI = r"C:\Users\lianghao\AppData\Local\Programs\ArtCraft\FigCraft\figcraft-cli.exe"

fails = 0

# ── 前置检查：SVG 资源一致性（设计 ↔ 代码仓库同源）──
r = subprocess.run([sys.executable, os.path.join(HERE, "sync_svgs.py")],
                   capture_output=True, text=True)
print(r.stdout.strip())
if r.returncode != 0:
    fails += 1
    print("→ SVG 资源失配（运行 sync_svgs.py --sync --prune 修复）")
print()

for name in sys.argv[1:]:
    fig = os.path.join(OUT, f"{name}.figcraft")
    js = os.path.join(OUT, f"{name}.json")
    png = os.path.join(OUT, f"{name}.png")
    probes = os.path.join(OUT, f"{name}.probes.json")
    if not os.path.exists(fig):
        print(f"[SKIP] {name}: 缺 {fig}")
        continue

    # 先跑生成器（py → json），保证 token/css 改动同步进来；
    # 再 figcraft-cli run（json → figcraft）。链路完整才叫「门禁」。
    GEN = {"files_page_v3": "gen_files_page_v3.py",
           "files_page_v2": "gen_files_page_v2.py",
           "files_page_v2_old": "gen_files_page.py",
           "files_page_mobile": "gen_mobile_page.py",
           "button_library": "gen_button_library.py",
           "component_library": "gen_component_library.py"}
    gen = GEN.get(name)
    if gen and os.path.exists(os.path.join(HERE, gen)):
        r = subprocess.run([sys.executable, os.path.join(HERE, gen)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            print(f"[FAIL] {gen}: {r.stderr[-400:]}")
            fails += 1
            continue
    if os.path.exists(js):
        subprocess.run([CLI, "run", js, "--out", fig], capture_output=True)
    # 组件库文档：重挂 codeConnect + devResource（run 重建文档会丢链接）
    if name == "component_library" and os.path.exists(
            os.path.join(HERE, "gen_code_connect.py")):
        subprocess.run([sys.executable, os.path.join(HERE, "gen_code_connect.py")],
                       capture_output=True)
        cc = os.path.join(HERE, "figcraft.connect.json")
        cc2 = os.path.join(HERE, "apply_connect.json")
        if os.path.exists(cc) and os.path.exists(cc2):
            subprocess.run([CLI, "run", cc2], capture_output=True)

    print(f"\n{'=' * 60}\n{name}\n{'=' * 60}")

    r = subprocess.run([sys.executable, os.path.join(HERE, "review_visual.py"), fig],
                       capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        fails += 1
        print("→ 几何 lint 未通过")

    if os.path.exists(probes):
        subprocess.run([CLI, "render", fig, "-o", png, "--scale", "1"],
                       capture_output=True)
        r2 = subprocess.run([sys.executable, os.path.join(HERE, "check_render.py"),
                             png, probes], capture_output=True, text=True)
        tail = r2.stdout.strip().splitlines()
        print("→ 像素校验：" + (tail[-1] if tail else "?"))
        if r2.returncode != 0:
            fails += 1
            print(r2.stdout)

print(f"\n{'=' * 60}")
print(f"门禁结果：{'通过' if fails == 0 else f'{fails} 项未通过'}")
sys.exit(1 if fails else 0)
