# -*- coding: utf-8 -*-
"""同步 SVG 资源：设计稿目录（svg/）↔ 代码仓库（lucide-static）。

保证两者**一致**：
  - 设计用的图标从代码仓库同一版本的 lucide-static 同步过来
  - 检测「设计有而代码没有」「代码版本变化导致内容漂移」两种失配

用法：
  python sync_svgs.py              # 检查一致性（不做修改），退出码非 0 表示失配
  python sync_svgs.py --sync      # 从代码仓库同步缺失/过期的图标到 svg/
  python sync_svgs.py --prune     # 删除 svg/ 里设计已不再使用的图标
"""
import glob
import hashlib
import os
import re
import json
import subprocess
import sys
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from figcraft_kit import OUT_DIR as OUT_DIR_RESOLVED  # noqa: E402
SVG_DIR = os.path.join(HERE, "svg")
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
REPO_SVG = os.path.join(ROOT, "doclens", "web_v2", "frontend",
                        "node_modules", "lucide-static", "icons")
FRONTEND_SRC = os.path.join(ROOT, "doclens", "web_v2", "frontend", "src")

# 设计生成器实际引用的图标（从 d.icon("...") / d.gradient 等调用提取）
DESIGN_FILES = ["gen_files_page_v3.py", "gen_mobile_page.py",
                "gen_files_page_v2.py", "gen_files_page.py"]


# 真值源：生成的命令 JSON 里 type=vector、name=ic-<图标名> 的节点。
# 比扫源码可靠——条件调用（d.icon("a" if x else "b")）、表驱动
# （ACT_ICON[key]）都已被求值。
COMMAND_JSON = ["files_page_v3.json", "files_page_mobile.json",
                "files_page_v2.json", "files_page.json",
                "component_library.json", "button_library.json"]


def design_icons():
    """从生成产物（figcraft 命令 JSON）提取设计实际使用的图标名。"""
    names = set()
    for f in COMMAND_JSON:
        p = os.path.join(OUT_DIR_RESOLVED, f)
        if not os.path.exists(p):
            continue
        for c in json.load(open(p, encoding="utf-8")):
            params = c.get("params", {})
            nm = params.get("name", "")
            if params.get("type") == "vector" and nm.startswith("ic-"):
                names.add(nm[3:])
    return names


def file_hash(p):
    return hashlib.sha1(open(p, "rb").read()).hexdigest()[:12]


def lucide_version():
    pj = os.path.join(ROOT, "doclens", "web_v2", "frontend", "package.json")
    m = re.search(r'"lucide-static":\s*"([^"]+)"', open(pj, encoding="utf-8").read())
    return m.group(1) if m else "?"


def repo_icons():
    return {os.path.splitext(os.path.basename(p))[0]: p
            for p in glob.glob(os.path.join(REPO_SVG, "*.svg"))}


def frontend_imports():
    """前端 icon.ts 实际 import 的图标（用于交叉核对）。"""
    out = set()
    for root, _, files in os.walk(FRONTEND_SRC):
        for f in files:
            if not f.endswith(".ts"):
                continue
            src = open(os.path.join(root, f), encoding="utf-8").read()
            for m in re.finditer(r"lucide-static/icons/([a-z0-9-]+)\.svg", src):
                out.add(m.group(1))
    return out


def main():
    do_sync = "--sync" in sys.argv
    do_prune = "--prune" in sys.argv
    version = lucide_version()
    print(f"代码仓库 lucide-static 版本: {version}")
    print(f"设计 SVG 目录: {os.path.relpath(SVG_DIR, ROOT)}")

    design = design_icons()
    repo = repo_icons()
    fe = frontend_imports()

    local = {os.path.splitext(os.path.basename(p))[0]: p
             for p in glob.glob(os.path.join(SVG_DIR, "*.svg"))}

    missing = sorted(design - set(local))
    extra = sorted(set(local) - design)
    stale = [n for n in local if n in repo
             and file_hash(local[n]) != file_hash(repo[n])]

    print(f"\n设计引用 {len(design)} 个图标；本地 svg/ 有 {len(local)} 个；"
          f"前端 icon.ts 用 {len(fe)} 个")

    if missing:
        print(f"\n缺失（设计引用但 svg/ 没有）：{' '.join(missing)}")
        if do_sync:
            for n in missing:
                shutil.copy(repo[n], os.path.join(SVG_DIR, n + ".svg"))
            print(f"  → 已从仓库同步 {len(missing)} 个")
    if stale:
        print(f"\n过期（与仓库当前版本内容不一致）：{' '.join(sorted(stale))}")
        if do_sync:
            for n in stale:
                shutil.copy(repo[n], os.path.join(SVG_DIR, n + ".svg"))
            print(f"  → 已更新 {len(stale)} 个")
    if extra:
        print(f"\n多余（svg/ 有但设计未引用）：{' '.join(extra)}")
        if do_prune:
            for n in extra:
                os.remove(os.path.join(SVG_DIR, n + ".svg"))
            print(f"  → 已删除 {len(extra)} 个")

    # 交叉核对：设计用的图标，前端是否也用？（不同不必算失败，但值得知道）
    fe_missing = sorted(design - fe)
    if fe_missing:
        print(f"\n[提示] 设计使用但前端 icon.ts 未 import（设计扩展了图标集）："
              f"{' '.join(fe_missing)}")

    if not (missing or stale or extra):
        print("\n✓ 一致：svg/ 与代码仓库同源且无冗余")
        return 0
    if do_sync or do_prune:
        return 0
    print("\n✗ 存在失配 —— 运行 `python sync_svgs.py --sync` 同步"
          + ("（加 --prune 清理多余）" if extra else ""))
    return 1


if __name__ == "__main__":
    sys.exit(main())
