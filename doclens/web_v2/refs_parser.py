"""从 AI 正文解析「## 参考资料」章节，产出路径列表 + 格式诊断。

与 doclens/skills/knowledge_base/SKILL.md 的「机器解析契约」逐字一致。
解析结果供 refs_retry 校验：不合规 → chat.py 静默重答。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# 章节标题：恰好「## 参考资料」（两个 #、空白、"参考资料"、行尾）
_SECTION_HEADER_RE = re.compile(r"^##\s+参考资料\s*$", re.MULTILINE)
# 任意一级/二级标题（界定章节体边界）
_NEXT_HEADING_RE = re.compile(r"^#{1,2}\s+\S", re.MULTILINE)
# 合规列表项：「数字. 」或「数字、」前缀
_LIST_ITEM_RE = re.compile(r"^\s*(\d+)[.、]\s*(.+?)\s*$")
# 被禁的 [N] 前缀
_BRACKET_PREFIX_RE = re.compile(r"^\s*\[\d+\]\s*(.+?)\s*$")

_MARKDOWN_LINK_RE = re.compile(r"\]\(")
_FILE_SCHEME_RE = re.compile(r"file://")
_LINE_SUFFIX_RE = re.compile(r":\d+\s*$")
_ANGLE_RE = re.compile(r"[<>]")


@dataclass(frozen=True)
class ParsedRefs:
    has_section: bool
    paths: list[str] = field(default_factory=list)
    diagnostics: list[str] = field(default_factory=list)

    def is_compliant(self) -> bool:
        return self.has_section and not self.diagnostics


def _diagnose_path(raw: str) -> tuple[str | None, str | None]:
    """返回 (清洗后的路径, 诊断)；路径合规时诊断为 None。"""
    path = raw.strip()
    if _MARKDOWN_LINK_RE.search(path):
        return None, f"路径含 markdown 链接，禁止 [t](u)：{path}"
    if _FILE_SCHEME_RE.search(path):
        return None, f"路径含 file://，禁止绝对 URL：{path}"
    if _LINE_SUFFIX_RE.search(path):
        return None, f"路径含行号后缀，禁止 :数字：{path}"
    if _ANGLE_RE.search(path):
        return None, f"路径含 < 或 >，禁止 <hierarchy> 残留：{path}"
    return path, None


def parse_references_section(markdown: str) -> ParsedRefs:
    """解析正文，返回 ParsedRefs。"""
    header = _SECTION_HEADER_RE.search(markdown)
    if header is None:
        return ParsedRefs(
            has_section=False,
            paths=[],
            diagnostics=["缺少「## 参考资料」章节"],
        )

    body_start = header.end()
    nxt = _NEXT_HEADING_RE.search(markdown, pos=body_start)
    body = markdown[body_start : (nxt.start() if nxt else len(markdown))]

    paths: list[str] = []
    diagnostics: list[str] = []
    saw_list_item = False

    for line in body.splitlines():
        if not line.strip():
            continue
        m = _LIST_ITEM_RE.match(line)
        if m:
            saw_list_item = True
            path, diag = _diagnose_path(m.group(2))
            if diag:
                diagnostics.append(diag)
            elif path:
                paths.append(path)
            continue
        bm = _BRACKET_PREFIX_RE.match(line)
        if bm:
            diagnostics.append(f"列表前缀应为「数字. 」而非 [N]：{line.strip()}")
            continue
        # 其它非空行（说明性文字等）忽略

    if not saw_list_item:
        diagnostics.append("「## 参考资料」章节未找到「数字. 路径」列表项")

    return ParsedRefs(has_section=True, paths=paths, diagnostics=diagnostics)
