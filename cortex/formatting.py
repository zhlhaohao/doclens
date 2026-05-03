"""纯显示工具模块 - ANSI 高亮、路径缩短、VSCode 超链接"""

import os
import re

# 高亮
HL_START = "\033[1;31m"
HL_END = "\033[0m"

# 匹配所有 ANSI 转义序列
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07")


def strip_ansi(text):
    """移除所有 ANSI 转义序列，返回纯文本"""
    return _ANSI_RE.sub("", text)


def truncate_ansi_safe(text, max_visible, keywords=None):
    """安全截断含 ANSI 转义码的字符串，保留完整的转义序列。

    按可见字符数截断，不会被 ANSI 序列中间切断，
    并在截断时追加 HL_END 确保终端状态正确关闭。

    如果提供 keywords，会尝试以第一个关键词为中心截断，
    确保关键词（含高亮标记）在可见范围内。
    """
    plain = strip_ansi(text)
    if len(plain) <= max_visible:
        return text

    target = max_visible - 3  # 留 3 字符给 "..."

    # 确定截断的可见字符起始偏移（默认从 0 开始）
    skip_visible = 0

    if keywords:
        for kw in keywords:
            if not kw:
                continue
            kw_lower = kw.lower()
            pos = plain.lower().find(kw_lower)
            if pos < 0:
                continue
            kw_end = pos + len(kw)
            # 关键词在可见范围内，从头截断即可
            if kw_end <= target:
                break
            # 关键词超出范围，从中间偏前处开始截断
            skip_visible = max(0, pos - target // 3)
            break

    # 在原始 text（含 ANSI）上按可见字符截取
    visible = 0
    result = []
    i = 0
    while i < len(text):
        m = _ANSI_RE.match(text, i)
        if m:
            # ANSI 序列无条件保留
            if visible >= skip_visible:
                result.append(m.group())
            i = m.end()
        else:
            if visible < skip_visible:
                # 跳过前面的可见字符
                visible += 1
            elif visible < skip_visible + target:
                result.append(text[i])
                visible += 1
            else:
                break
            i += 1

    prefix = "..." if skip_visible > 0 else ""
    return prefix + "".join(result) + "..." + HL_END


# 超链接（ANSI escape code）
# 格式: \033]8;;URL\007显示文本\033]8;;\007
LINK_START = "\033]8;;"
LINK_SEP = "\007"       # 分隔 URL 和显示文本
LINK_END = "\033]8;;\007" # 结束链接


def hl(text, keywords):
    """高亮关键词（支持多个分词后的关键词）"""
    if not keywords or not text:
        return text
    result = text
    for kw in keywords:
        if kw:
            pattern = re.compile(re.escape(kw), re.IGNORECASE)
            result = pattern.sub(lambda m: f"{HL_START}{m.group()}{HL_END}", result)
    return result


def short_path(path):
    """缩短路径"""
    return path.replace("E:\\github\\notebook\\", "").replace("E:/github/notebook/", "")


def make_vscode_link(path, line=None):
    """生成 VSCode 可点击超链接

    Args:
        path: 文件绝对路径
        line: 可选，行号
    Returns:
        ANSI 超链接格式的字符串
    """
    import urllib.parse

    # 转义反斜杠（Windows 路径）
    abs_path = os.path.abspath(path) if not os.path.isabs(path) else path
    # 替换反斜杠为正斜杠（URL 标准）
    abs_path = abs_path.replace('\\', '/')

    # 只对空格编码，其他字符保留原样
    encoded_path = abs_path.replace(' ', '%20')

    # 显示文本（包含行号）
    display_text = f"{abs_path}:{line}" if line is not None else abs_path

    if line is not None:
        url = f"vscode://file/{encoded_path}:{line}"
    else:
        url = f"vscode://file/{encoded_path}"

    # 构建 ANSI 超链接，显示完整路径
    return f"{LINK_START}{url}{LINK_SEP}{display_text}{LINK_END}"
