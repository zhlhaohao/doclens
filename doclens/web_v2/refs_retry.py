"""参考资料合规判定（A 方案：不重试 LLM）。

chat.py 在 AI 完成后调用 evaluate_round 判定「## 参考资料」是否合规
（有章节 + 格式合规 + 路径存在）；不合规时由 chat.py toast 告警。
AI 正文里的幻觉路径由 chat.py 用工具检索结果重写覆盖，不在此处处理。
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from doclens.web_v2.refs_parser import parse_references_section
from doclens.web_v2.references import RETRIEVAL_TOOLS, validate_paths

FALLBACK_TOAST = (
    "AI 多次回答的参考资料均不合规，已改用检索结果兜底，建议重建索引确保路径有效。"
)


@dataclass(frozen=True)
class RoundResult:
    """一轮对话的收集结果。"""
    text: str
    tool_calls: list[dict]


def evaluate_round(result: RoundResult, workdir: Path) -> tuple[bool, list[str], list[dict]]:
    """评估一轮结果是否合规。

    Returns:
        (compliant, diagnostics, references)。compliant=True 时 references 是
        正文解析的合规路径（豁免时为 []）；不合规时 references=[]。
    """
    used_retrieval = any(
        tc.get("name") in RETRIEVAL_TOOLS and not tc.get("is_error")
        for tc in result.tool_calls
    )
    if not used_retrieval:
        return True, [], []  # 流程性回复豁免

    parsed = parse_references_section(result.text)
    if not parsed.is_compliant():
        return False, list(parsed.diagnostics), []

    invalid = validate_paths(parsed.paths, workdir)
    if invalid:
        return False, ["路径不存在: " + ", ".join(invalid)], []
    return True, [], [{"path": p} for p in parsed.paths]
