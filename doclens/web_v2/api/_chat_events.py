"""Chat SSE 内部队列事件的单一真相源。

生产侧（``_chat_emitter.ChatEventEmitter`` / ``chat.py._run_and_finalize``）
与消费侧（``chat.py.event_stream`` 的 if/elif 链）共享本模块的 TypedDict
定义与构造函数——字段名只在此定义一次，加事件类型改一处。

队列事件全集（另加 None 哨兵终止）：
token / tool_call / tool_result / ask / toast / error

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


class ErrorEvent(TypedDict):
    type: str  # "error"
    detail: str


ChatQueueEvent = Union[
    TokenEvent, ToolCallEvent, ToolResultEvent, AskEvent, ToastEvent, ErrorEvent
]

#: 消费侧已知的全部事件类型（未知类型应记 warning，不得静默丢弃）
KNOWN_EVENT_TYPES = frozenset(
    {"token", "tool_call", "tool_result", "ask", "toast", "error"}
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


def error_event(detail: str) -> ErrorEvent:
    return {"type": "error", "detail": detail}
