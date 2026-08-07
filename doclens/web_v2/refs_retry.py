"""参考资料合规判定工具（A 方案：不重试 LLM）。

FALLBACK_TOAST 供 chat.py 在 refs_curator 走兜底分支时告警用。
evaluate_round 为早期合规判定实现，现由 refs_curator.curate_references 取代
（保留兼容，新代码请用 refs_curator）。
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
