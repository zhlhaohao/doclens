"""参考资料校验 + 重试循环核心逻辑（纯函数，可单测）。

不直接跑 StreamingAgent —— run_round 由调用方注入（生产=chat.py 跑 StreamingAgent，
测试=fake）。判定规则：用了检索工具的回答必须有合规章节 + 路径存在；不合规静默重答，
重试用尽用工具结果兜底 + 告警。
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from doclens.web_v2.refs_parser import parse_references_section
from doclens.web_v2.references import extract_references, validate_paths

# 检索类工具（与 references.py 保持一致；manage_kb 等非检索豁免）
_RETRIEVAL_TOOLS = frozenset({"search_kb", "grep", "read_document"})

FALLBACK_TOAST = (
    "AI 多次回答的参考资料均不合规，已改用检索结果兜底，建议重建索引确保路径有效。"
)

# 与 SKILL.md「机器解析契约」逐字一致（Task 4 校验）
REFERENCES_CONTRACT = """## 参考资料（系统强制解析契约）
1. 章节标题必须正好是「## 参考资料」（两个#、空格、"参考资料"四字）
2. 每行「数字. 路径」（如「1. 量子计算/第一章.md」），数字后一个点一个空格
3. 路径 = 纯相对路径，禁止 [t](u) / file:// / 行号 / <...>
4. 系统按此格式机器解析并校验路径是否存在；不合规将被自动打回重答。"""

DEADLINE_SECONDS = 60
MAX_RETRIES = 3


@dataclass(frozen=True)
class RoundResult:
    """一轮对话的收集结果。"""
    text: str
    tool_calls: list[dict]


@dataclass(frozen=True)
class ResolvedAnswer:
    """重试循环的最终采用结果。

    references 空 list 表示不发 references 事件；toast None 表示不告警。
    """
    text: str
    tool_calls: list[dict]
    references: list[dict]
    toast: str | None


def evaluate_round(result: RoundResult, workdir: Path) -> tuple[bool, list[str], list[dict]]:
    """评估一轮结果。

    Returns:
        (compliant, diagnostics, references)。compliant=True 时 references 是
        要下发的卡片数据（合规=parsed.paths，豁免=[]）；不合规时 references=[]。
    """
    used_retrieval = any(
        tc.get("name") in _RETRIEVAL_TOOLS and not tc.get("is_error")
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


def render_feedback(diagnostics: list[str]) -> str:
    """生成重试时追加给 AI 的反馈消息。"""
    issues = "\n".join(f"- {d}" for d in diagnostics)
    return (
        "你上一条回答的参考资料不合规：\n"
        f"{issues}\n"
        "请重新完整回答用户原问题，并严格遵循下方契约"
        "（再次不合规会被继续打回）：\n"
        f"{REFERENCES_CONTRACT}"
    )


def resolve_answer_with_retry(
    run_round: Callable[[list[dict], str], RoundResult],
    user_message: str,
    history: list[dict],
    workdir: Path,
    max_retries: int = MAX_RETRIES,
    deadline_monotonic: float | None = None,
) -> ResolvedAnswer:
    """重试循环。不 mutate 调用方 history。

    每轮：跑 run_round → evaluate → 合规/豁免则采用；不合规且未刹车则追加反馈重试。
    刹车（次数用尽或超时）→ 工具结果兜底 + toast。
    """
    local_history = list(history)
    deadline = deadline_monotonic if deadline_monotonic is not None else time.monotonic() + DEADLINE_SECONDS
    feedback: str | None = None
    last: RoundResult | None = None
    attempt = 0

    while True:
        query = feedback if feedback is not None else user_message
        last = run_round(local_history, query)
        local_history.append({
            "role": "assistant",
            "content": last.text,
            "tool_calls": last.tool_calls,
        })

        compliant, diagnostics, refs = evaluate_round(last, workdir)
        if compliant:
            return ResolvedAnswer(last.text, list(last.tool_calls), refs, None)

        if attempt >= max_retries or time.monotonic() > deadline:
            fallback = extract_references(last.tool_calls)
            return ResolvedAnswer(last.text, list(last.tool_calls), fallback, FALLBACK_TOAST)

        feedback = render_feedback(diagnostics)
        local_history.append({"role": "user", "content": feedback})
        attempt += 1
