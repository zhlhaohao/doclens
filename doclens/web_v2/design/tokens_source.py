# -*- coding: utf-8 -*-
"""tokens.css 解析器：设计稿的**唯一真源**。

doclens/web_v2/frontend/src/styles/tokens.css 的结构：
    :root { 非颜色 token（间距/圆角/字号/字体，全主题共享） }
    :root { light 主题颜色 }          ← 两个 :root 块，后者是颜色
    [data-theme="dark"] { dark 主题 }
    [data-theme="paper"] { paper 主题 }

本模块把它解析成：
    TOKENS["base"]    非颜色（fs/space/radius/font…）
    TOKENS["light"]   light 颜色（:root 基线）
    TOKENS["dark"]    dark 颜色
    TOKENS["paper"]   paper 颜色

用法（figcraft_kit 顶部）：
    from tokens_source import TOKENS, theme, fs
    PRIMARY = theme("light")["--cortex-primary"]

漂移防护：TOKENS 来源是 CSS 文件本身，前端改 token 后
重跑生成器即同步，零手工。
"""
import os
import re

_HERE = os.path.dirname(os.path.abspath(__file__))
TOKENS_CSS = os.path.join(_HERE, "..", "frontend", "src", "styles", "tokens.css")

# 主题块头：:root 或 [data-theme="x"]
_BLOCK_RE = re.compile(r'(?:^|\n)\s*((?::root)|\[data-theme="([a-z]+)"\])\s*\{([^{}]*)\}',
                       re.IGNORECASE)
_VAR_RE = re.compile(r'(--[a-z0-9-]+)\s*:\s*([^;]+);', re.IGNORECASE)

# :root 块出现顺序：第一个 = 非颜色 token（base），第二个 = light 颜色
_root_seen = [0]


def parse_tokens(css_path=TOKENS_CSS):
    """解析 tokens.css → {block_name: {var: value}}。

    block_name ∈ {"base", "light", "dark", "paper"}；
    同名变量后块覆盖前块（CSS 层叠语义）。
    """
    css = open(css_path, encoding="utf-8").read()
    # 去注释，避免注释里的示例值干扰
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out = {"base": {}, "light": {}, "dark": {}, "paper": {}}
    root_n = 0
    for m in _BLOCK_RE.finditer(css):
        header, theme_name, body = m.group(1), m.group(2), m.group(3)
        if header.strip() == ":root":
            root_n += 1
            key = "base" if root_n == 1 else "light"
        else:
            key = (theme_name or "light").lower()
        for vm in _VAR_RE.finditer(body):
            out[key][vm.group(1)] = vm.group(2).strip()
    return out


TOKENS = parse_tokens()


def px(value):
    """token 值 → 数字（"8px" → 8；"calc(...)" 返回 None）。"""
    m = re.match(r"^([\d.]+)px$", value.strip())
    return float(m.group(1)) if m else None


def theme(name="light"):
    """某主题的颜色 token（base 之外的变量回退 light）。"""
    base = TOKENS["base"]
    colors = dict(TOKENS.get(name, {}))
    if name != "light":
        for k, v in TOKENS["light"].items():
            colors.setdefault(k, v)
    # 非颜色 token 不进颜色表
    return {k: v for k, v in {**base, **colors}.items()
            if not k.startswith(("--cortex-space", "--cortex-radius", "--cortex-fs"))}


def base_token(name):
    """非颜色 token 原始值（如 "--cortex-fs-sm" → "13px"）。"""
    return TOKENS["base"].get(name)
