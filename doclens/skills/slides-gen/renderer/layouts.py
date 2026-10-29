"""版式资产：HTML 模板 + 内联 <style> 抽取。

版式 = layouts/<名>.html 文件；新增版式 = 加一个文件，零代码改动。
模板占位符：{{title}} {{content}} {{left}} {{right}} {{image}}
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

DEFAULT_LAYOUT = "title-content"
BUILTIN = ("title", "section", "title-content", "two-col",
           "image-left", "image-right", "quote", "blank",
           "stats", "timeline", "matrix", "compare", "big-number",
           "grid", "agenda", "pyramid", "funnel", "cycle", "closing")

_STYLE_RE = re.compile(r"<style[^>]*>(.*?)</style>", re.S | re.I)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.S)


@dataclass
class Layout:
    name: str
    body: str      # 含 {{slot}} 的 HTML 片段
    css: str       # 该版式专属样式


def load_layout(path: Path, name: str) -> Layout:
    raw = path.read_text(encoding="utf-8")
    css_parts = _STYLE_RE.findall(raw)
    body = _STYLE_RE.sub("", raw)
    body = _COMMENT_RE.sub("", body).strip()
    return Layout(name=name, body=body, css="\n".join(css_parts).strip())


def load_all(layout_dir: Path, warn) -> dict[str, Layout]:
    out: dict[str, Layout] = {}
    if not layout_dir.exists():
        warn(f"版式目录不存在：{layout_dir}")
        return out
    for p in sorted(layout_dir.glob("*.html")):
        name = p.stem
        try:
            out[name] = load_layout(p, name)
        except OSError as e:
            warn(f"版式 {p.name} 读取失败（{e}），跳过")
    for name in BUILTIN:
        if name not in out:
            warn(f"内置版式 {name} 缺失（资产损坏）")
    return out


def fill(layout: Layout, slots: dict[str, str]) -> str:
    """把 slot 内容填进模板；模板里未提供的占位符清空。"""
    body = layout.body
    for key in ("title", "content", "left", "right", "image", "vs"):
        body = body.replace("{{%s}}" % key, slots.get(key, ""))
    return re.sub(r"\{\{\w+\}\}", "", body)
