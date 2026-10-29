"""环境自检：动手前先确认工具链齐不齐，而不是让用户撞 Python traceback。

检查分级：
  required    缺失则核心功能不可用（起不来）
  recommended 缺失则质量下降（如视觉验收降级为纯几何）
  optional    锦上添花（如参考图提色）

每条都给中文修复建议，可直接抄给用户。
"""

from __future__ import annotations

import importlib.util
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent


@dataclass
class Item:
    name: str
    level: str          # required | recommended | optional
    ok: bool
    detail: str = ""
    fix: str = ""


@dataclass
class Report:
    items: list[Item]
    python: str
    platform: str

    @property
    def ready(self) -> bool:
        return all(i.ok for i in self.items if i.level == "required")

    @property
    def full(self) -> bool:
        return all(i.ok for i in self.items if i.level in ("required", "recommended"))

    def missing(self, level: str | None = None) -> list[Item]:
        return [i for i in self.items
                if not i.ok and (level is None or i.level == level)]


def _has(mod: str) -> bool:
    try:
        return importlib.util.find_spec(mod) is not None
    except (ImportError, ValueError):
        return False


def check(need_vision: bool = True) -> Report:
    items: list[Item] = []

    def add(name: str, level: str, ok: bool, detail: str = "", fix: str = "") -> None:
        items.append(Item(name, level, bool(ok), detail, fix))

    # ---- Python ----
    add("Python >= 3.9", "required", sys.version_info >= (3, 9),
        sys.version.split()[0], "安装 Python 3.9 以上版本")

    # ---- 必需库 ----
    add("Pillow（图片处理）", "required", _has("PIL"), "",
        f"{sys.executable} -m pip install Pillow")
    add("PyYAML（frontmatter）", "required", _has("yaml"), "",
        f"{sys.executable} -m pip install PyYAML")

    # ---- 渲染/验收链路 ----
    pw_ok = _has("playwright")
    add("playwright（截图与 PDF）", "recommended", pw_ok, "",
        f"{sys.executable} -m pip install playwright && "
        f"{sys.executable} -m playwright install chromium --only-shell")

    browser_ok = False
    browser_detail = ""
    if pw_ok:
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as p:
                b = p.chromium.launch()
                browser_ok = True
                browser_detail = b.version
                b.close()
        except Exception as e:  # noqa: BLE001
            browser_detail = str(e).splitlines()[0][:120]
        add("Chromium 浏览器内核", "recommended", browser_ok, browser_detail,
            f"{sys.executable} -m playwright install chromium --only-shell")

    # ---- 视觉模型（决定验收能力上限）----
    if need_vision:
        from .qa import _load_vision_conf
        conf = _load_vision_conf()
        if conf:
            add("视觉模型配置", "recommended", True,
                f"{conf.get('model', '?')} @ {conf.get('base_url', '?')[:48]}")
        else:
            add("视觉模型配置", "recommended", False,
                "未配置：验收将降级为纯几何检查（查不出留白/层次/对比度等审美问题）",
                "在设置页「模型」tab 配置视觉预设，或全局 .env 写 "
                "VISION_PROTOCOL / VISION_BASE_URL / VISION_MODEL / VISION_API_KEY")

    # ---- 字体 ----
    font_ok, font_detail = _check_cjk_font()
    add("中文字体", "required", font_ok, font_detail,
        "Windows/macOS 一般自带；Linux 执行 apt-get install fonts-noto-cjk")

    # ---- 可选 ----
    add("numpy（参考图提色更准）", "optional", _has("numpy"), "",
        f"{sys.executable} -m pip install numpy")
    mmdc = shutil.which("mmdc") or shutil.which("mmdc.cmd")
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    add("mermaid 渲染（代码块转图）", "optional", bool(mmdc or npx),
        mmdc or (npx + "（经 npx 临时拉起，较慢）" if npx else "未安装"),
        "npm i -g @mermaid-js/mermaid-cli")

    # ---- 技能资产完整性 ----
    for sub, label in (("layouts", "版式资产"), ("themes", "主题资产"),
                       ("assets", "静态资源")):
        d = SKILL_DIR / sub
        n = len(list(d.glob("*"))) if d.exists() else 0
        add(label, "required", n > 0, f"{n} 个文件", f"技能安装不完整，请重新安装：{d}")
    icons = SKILL_DIR / "assets" / "icons.json"
    add("图标集", "recommended", icons.exists(),
        "81 个内置图标" if icons.exists() else "缺失（图标语法会静默失效）",
        "重新安装技能，或运行 python -m renderer.icons 重新生成")

    return Report(items=items, python=sys.executable,
                  platform=f"{sys.platform}")


def _check_cjk_font() -> tuple[bool, str]:
    """检查是否有可用的中文字体（用 PIL 实际加载验证）。"""
    try:
        from PIL import ImageFont
    except ImportError:
        return False, "Pillow 未安装，无法验证字体"
    cands = [
        "C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    ]
    for c in cands:
        if Path(c).exists():
            try:
                ImageFont.truetype(c, 20)
                return True, Path(c).name
            except OSError:
                continue
    return False, "未找到可用中文字体"


def render(rep: Report) -> str:
    icon = {"required": "必需", "recommended": "推荐", "optional": "可选"}
    lines = [f"# 环境自检", ""]
    lines.append(f"- Python：`{rep.python}`")
    lines.append(f"- 平台：{rep.platform}")
    verdict = "全部就绪" if rep.full else ("核心可用（有降级）" if rep.ready else "缺少必需组件")
    lines.append(f"- 结论：**{verdict}**")
    lines.append("")
    for level in ("required", "recommended", "optional"):
        group = [i for i in rep.items if i.level == level]
        if not group:
            continue
        lines.append(f"## {icon[level]}")
        for i in group:
            mark = "✓" if i.ok else "✗"
            line = f"- {mark} **{i.name}**"
            if i.detail:
                line += f" — {i.detail}"
            lines.append(line)
            if not i.ok and i.fix:
                lines.append(f"  - 修复：`{i.fix}`")
        lines.append("")
    if not rep.ready:
        lines.append("> 缺必需组件，无法生成 deck。按上面「修复」列处理后重跑自检。")
    elif not rep.full:
        lines.append("> 核心功能可用。缺的推荐项会降级对应能力（见上），不影响出 deck。")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    import argparse

    ap = argparse.ArgumentParser(prog="slides-gen-doctor", description="环境自检")
    ap.add_argument("--no-vision", action="store_true", help="不检查视觉模型配置")
    ap.add_argument("--json", action="store_true", help="输出 JSON")
    args = ap.parse_args(argv)

    rep = check(need_vision=not args.no_vision)
    if args.json:
        import json
        print(json.dumps({
            "ready": rep.ready, "full": rep.full,
            "items": [vars(i) for i in rep.items],
        }, ensure_ascii=False, indent=2))
    else:
        print(render(rep))
    return 0 if rep.ready else 1


if __name__ == "__main__":
    sys.exit(main())
