"""技能会话的提取式引文：从 AI 回答正文提取真实文件路径构建参考资料。

与声明式引文（refs_curator：AI 写 [N] + 「## 参考资料」后机器校验）相对。
技能会话（消息以「[调用技能: …]」标记开头的会话）里用户已显式指定文件，
AI 无需声明引用——直接从正文中提取路径模式串，校验存在后重建章节。

流程：
1. 剥掉 AI 自写的「## 参考资料」章节（若有，避免重复）
2. 正则提取正文中的路径模式串（非空白字符 + 已知扩展名）
3. 逐个校验 workdir 下真实存在，不存在的丢弃
4. 去重、保持首次出现顺序
5. 无有效路径 → 原样返回（剥除后）；有 → 重建标准章节追加
"""
from __future__ import annotations

import logging
import re
from pathlib import Path, PurePosixPath

from doclens.web_v2.refs_parser import split_references_section

logger = logging.getLogger(__name__)

# 技能会话标记（首条用户消息以此开头）。格式：[调用技能: <name>]
SKILL_MARK_RE = re.compile(r"^\s*\[调用技能[:：]\s*([^\]]+)\]")

# 路径模式：一段含至少一个 / 或直接是文件名的非空白串，以已知扩展名结尾。
# 边界由前后空白/行首行尾/中文字符等自然界定；中文可出现在路径段内部。
# 必须以扩展名结尾，避免把普通词误判为路径。
_PATH_RE = re.compile(
    r"""(?<![\w./\\-])          # 左边界：前接字母数字/点/斜杠/横杠时不匹配（URL、标识符内不提取）
    [^\s<>()[\]{}"'`|*?,:;！？，。；：、""''（）【】《》…—]+  # 路径主体：非空白非成对符号
    \.(?:md|markdown|txt|pdf|docx?|pptx?|xlsx?|csv|html?|epub|mobi|rtf)  # 已知文档扩展名
    (?![\w-])                   # 右边界：后接字母数字/横杠时不匹配（标识符内不提取）
    """,
    re.VERBOSE,
)


def is_skill_message(text: str) -> bool:
    """判断一条用户消息是否为技能调用消息（以「[调用技能: …]」开头）。"""
    return bool(SKILL_MARK_RE.match(text or ""))


def extract_skill_paths(text: str, workdir: Path) -> list[str]:
    """从正文提取有效路径：workdir 下存在、去重、保持首现顺序。"""
    seen: set[str] = set()
    result: list[str] = []
    for m in _PATH_RE.finditer(text):
        raw = m.group(0)
        # 统一分隔符（Windows 反斜杠 → 正斜杠）
        rel = raw.replace("\\", "/")
        # 剥除可能包裹的 markdown 行内代码标记（`path`）残留
        rel = rel.strip("`")
        if not rel or rel in seen:
            continue
        if not _safe_exists(workdir, rel):
            continue
        seen.add(rel)
        result.append(rel)
    return result


def _safe_exists(workdir: Path, rel: str) -> bool:
    """校验 rel（相对 workdir）是存在的文件；拒绝绝对路径与穿越。"""
    if not rel or rel.startswith(("/", "\\")) or len(rel) >= 3 and rel[1] == ":":
        return False
    pure = PurePosixPath(rel)
    if pure.is_absolute() or ".." in pure.parts:
        return False
    p = workdir.joinpath(*pure.parts)
    try:
        return p.is_file()
    except OSError:
        return False


def curate_skill_references(text: str, workdir: Path) -> str:
    """技能会话引文策展：剥 AI 自写章节 → 提取正文路径 → 重建章节。

    无有效路径时返回剥除后的正文（可能是原文，也可能剥掉了 AI 多写的章节）。
    """
    body, _ = split_references_section(text)
    paths = extract_skill_paths(body, workdir)
    if not paths:
        return body
    section = "## 参考资料\n" + "".join(
        f"{i + 1}. {p}\n" for i, p in enumerate(paths)
    )
    logger.info("skill refs extracted: %d paths", len(paths))
    return body.rstrip() + "\n\n" + section
