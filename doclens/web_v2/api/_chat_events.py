"""Chat SSE 内部队列事件的单一真相源。

生产侧（``_chat_emitter.ChatEventEmitter`` / ``chat.py._run_and_finalize``）
与消费侧（``chat.py.event_stream`` 的 if/elif 链）共享本模块的 TypedDict
定义与构造函数——字段名只在此定义一次，加事件类型改一处。

队列事件全集（另加 None 哨兵终止）：
token / tool_call / tool_result / ask / toast / compact / error / usage / done

线格式（SSE data JSON）与队列事件同构，chat.py 透传字段不做改名。
"""
from typing import Any, Dict, List, Optional, TypedDict, Union


class TokenEvent(TypedDict):
    type: str  # "token"
    text: str


class ToolCallEvent(TypedDict):
    type: str  # "tool_call"
    tool_use_id: str
    name: str
    input: Dict[str, Any]
    is_complete: bool


class ToolResultEvent(TypedDict):
    type: str  # "tool_result"
    tool_use_id: str
    name: str
    output: str
    is_error: bool
    duration_ms: Optional[int]


class AskEvent(TypedDict):
    type: str  # "ask"
    request_id: str
    # 结构化 questions 数组（ask_user_question 校验后形态），直传不再 JSON 字符串化
    questions: List[Dict[str, Any]]


class ToastEvent(TypedDict):
    type: str  # "toast"
    level: str  # "error" | "info" | "success"
    detail: str


class CompactEvent(TypedDict, total=False):
    """回合末自动压缩进度（ADR-0044）——前端转不可关闭模态进度框。"""
    type: str  # "compact"
    phase: str  # "start" | "done"
    detail: str
    pre_tokens: int
    post_tokens: int


class ThinkingEvent(TypedDict):
    """思考流增量（2026-10-05）：模型内部推理文字的实时推送——仅被动
    接收（reasoning_content / thinking 块），不落库不积累，前端流式
    期间双行滑窗展示，正文首 token 到达即撤。"""
    type: str  # "thinking"
    delta: str


class ErrorEvent(TypedDict):
    type: str  # "error"
    detail: str


class UsageEvent(TypedDict):
    """token 用量（2026-09-17）：每次 LLM 调用后发，最后一条即该轮上下文
    峰值占用；前端会话信息弹窗据此展示 input/context_window 占比。"""
    type: str  # "usage"
    input_tokens: int
    output_tokens: int
    cache_creation_input_tokens: int
    cache_read_input_tokens: int
    context_window: int


class DoneEvent(TypedDict):
    """带原因的收尾事件（2026-10-01，ADR-0033 对话式提问）：仅终止原因
    存在时由 emitter 推送（reason="waiting_user" = 回合因提问等待用户
    下一条消息而终止）；正常完成不推，终端 done 仍由 chat.py 兜底。"""
    type: str  # "done"
    reason: str  # 终止原因标记


class InterjectAckEvent(TypedDict):
    """插话送达确认（ADR-0048）：检查点消费插话时发——前端建插话卡
    （含用户原话），「插话」按钮转已送达态。"""
    type: str  # "interject_ack"
    question: str
    tool_use_id: str


class InterjectReportEvent(TypedDict):
    """插话汇报全文（ADR-0048）：suppress_tools 调用产出后一次性推送
    （非逐 token——旁路短文不再造流式状态机）；text 不进正文
    text_parts（防污染策展文本）。"""
    type: str  # "interject_report"
    tool_use_id: str
    text: str


ChatQueueEvent = Union[
    TokenEvent, ToolCallEvent, ToolResultEvent, AskEvent, ToastEvent, ErrorEvent,
    UsageEvent, DoneEvent, ThinkingEvent, InterjectAckEvent, InterjectReportEvent,
]

#: 消费侧已知的全部事件类型（未知类型应记 warning，不得静默丢弃）
KNOWN_EVENT_TYPES = frozenset(
    {"token", "tool_call", "tool_result", "ask", "toast", "compact", "error", "usage",
     "done", "thinking", "interject_ack", "interject_report"}
)


def token_event(text: str) -> TokenEvent:
    return {"type": "token", "text": text}


def tool_call_event(
    tool_use_id: str, name: str, input_data: Dict[str, Any], is_complete: bool = True
) -> ToolCallEvent:
    return {
        "type": "tool_call",
        "tool_use_id": tool_use_id,
        "name": name,
        "input": input_data,
        "is_complete": is_complete,
    }


def tool_result_event(
    tool_use_id: str,
    name: str,
    output: str,
    is_error: bool = False,
    duration_ms: Optional[int] = None,
) -> ToolResultEvent:
    return {
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "name": name,
        "output": output,
        "is_error": is_error,
        "duration_ms": duration_ms,
    }


def ask_event(request_id: str, questions: List[Dict[str, Any]]) -> AskEvent:
    return {"type": "ask", "request_id": request_id, "questions": questions}


def toast_event(level: str, detail: str) -> ToastEvent:
    return {"type": "toast", "level": level, "detail": detail}


def compact_event(
    phase: str,
    detail: str = "",
    pre_tokens: Optional[int] = None,
    post_tokens: Optional[int] = None,
) -> CompactEvent:
    """回合末自动压缩进度（ADR-0044）：phase="start" | "done"。

    前端据此弹不可关闭的模态进度框（start → running spinner；
    done → 压缩结果 + 用户点「完成」关闭）。"""
    ev: CompactEvent = {"type": "compact", "phase": phase, "detail": detail}
    if pre_tokens is not None:
        ev["pre_tokens"] = pre_tokens
    if post_tokens is not None:
        ev["post_tokens"] = post_tokens
    return ev


def thinking_event(delta: str) -> ThinkingEvent:
    return {"type": "thinking", "delta": delta}


def done_event(reason: str) -> DoneEvent:
    return {"type": "done", "reason": reason}


def interject_ack_event(question: str, tool_use_id: str) -> InterjectAckEvent:
    """插话送达确认（ADR-0048）：question 回显供前端建卡。"""
    return {
        "type": "interject_ack",
        "question": question,
        "tool_use_id": tool_use_id,
    }


def interject_report_event(tool_use_id: str, text: str) -> InterjectReportEvent:
    """插话汇报全文（ADR-0048）：一次性推送。"""
    return {"type": "interject_report", "tool_use_id": tool_use_id, "text": text}


def error_event(detail: str) -> ErrorEvent:
    return {"type": "error", "detail": detail}


def usage_event(usage: Dict[str, Any], context_window: int) -> UsageEvent:
    """usage 四字段（runner 透传）+ 宿主侧补充的 context_window。"""
    return {
        "type": "usage",
        "input_tokens": int(usage.get("input_tokens", 0)),
        "output_tokens": int(usage.get("output_tokens", 0)),
        "cache_creation_input_tokens": int(usage.get("cache_creation_input_tokens", 0)),
        "cache_read_input_tokens": int(usage.get("cache_read_input_tokens", 0)),
        "context_window": int(context_window),
    }
