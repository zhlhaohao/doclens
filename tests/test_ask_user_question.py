"""ask_user_question 工具链路测试。

覆盖三层：
1. planify 工具层：schema 定义、入参校验（合法/违规矩阵）、handler 的
   JSON 回填契约（答案回传 / 超时形态）
2. waiter：create → wait → submit 唤醒、超时清理
3. doclens respond 端点：命中 / request_id 失效、Pydantic 校验
"""
import asyncio
import json

import pytest

from planify.streaming.waiter import GlobalResponseWaiter
from planify.tools.user_interaction import (
    ASK_TIMEOUT_SECONDS,
    get_ask_user_question_tool,
    get_user_interaction_tools,
    validate_ask_questions,
)


def _valid_question(**overrides):
    q = {
        "question": "选哪个方案?",
        "header": "方案",
        "multiSelect": False,
        "options": [
            {"label": "A（推荐）", "description": "首选"},
            {"label": "B", "description": "备选"},
        ],
    }
    q.update(overrides)
    return q


# ---------- 工具定义 ----------

def test_tool_schema_shape():
    tool = get_ask_user_question_tool()
    assert tool["name"] == "ask_user_question"
    props = tool["input_schema"]["properties"]
    assert "questions" in props
    assert props["questions"]["maxItems"] == 4
    opt_items = props["questions"]["items"]["properties"]["options"]["items"]
    assert set(opt_items["required"]) == {"label", "description"}


def test_default_registry_excludes_new_tool():
    tools = get_user_interaction_tools()
    assert all(t["name"] != "ask_user_question" for t in tools)


def test_gui_registry_includes_new_tool():
    tools = get_user_interaction_tools(include_ask_question=True)
    assert any(t["name"] == "ask_user_question" for t in tools)


# ---------- 入参校验 ----------

def test_validate_ok_single():
    cleaned = validate_ask_questions([_valid_question()])
    assert cleaned[0]["options"][0]["label"] == "A（推荐）"
    assert cleaned[0]["multiSelect"] is False


def test_validate_ok_multi_questions():
    cleaned = validate_ask_questions([
        _valid_question(),
        _valid_question(question="第二个?", header="h2", multiSelect=True),
    ])
    assert len(cleaned) == 2
    assert cleaned[1]["multiSelect"] is True


@pytest.mark.parametrize("bad,reason", [
    ([], "空列表"),
    ([_valid_question()] * 5, "超过 4 问"),
    ("not-a-list", "非列表"),
    ([{"question": "q", "header": "h", "options": "x"}], "options 非列表"),
    ([_valid_question(options=[{"label": "A", "description": "a"}])], "仅 1 选项"),
    (
        [_valid_question(options=[{"label": f"L{i}", "description": "d"} for i in range(5)])],
        "超过 4 选项",
    ),
    ([_valid_question(question="   ")], "空问题"),
    ([_valid_question(header="x" * 13)], "header 超长"),
    ([_valid_question(options=[{"label": "", "description": "d"}, {"label": "B", "description": "d"}])], "空 label"),
    ([_valid_question(options=[{"label": "A", "description": ""}, {"label": "B", "description": "d"}])], "空 description"),
])
def test_validate_rejects(bad, reason):
    with pytest.raises(ValueError):
        validate_ask_questions(bad)


# ---------- handler 契约（bind + waiter 链路） ----------

class _StubEmitter:
    """记录 emit_ask_user 调用的桩 emitter。"""

    def __init__(self):
        self.calls = []

    async def emit_ask_user(self, request_id, question, input_type="text",
                            options=None, default=None):
        self.calls.append({
            "request_id": request_id,
            "question": question,
            "input_type": input_type,
        })


def _fresh_waiter():
    """强制重建单例（跨测试隔离）。"""
    GlobalResponseWaiter._instance = None
    return GlobalResponseWaiter.get_instance()


@pytest.mark.asyncio
async def test_handler_returns_json_answer():
    from planify.tools.user_interaction import bind_ask_user_question_handler

    waiter = _fresh_waiter()
    emitter = _StubEmitter()
    handlers = {}
    bind_ask_user_question_handler(handlers, emitter, waiter)

    async def _answer_later():
        await asyncio.sleep(0.05)
        # 桩 emitter 捕获的 request_id 模拟前端 respond
        rid = emitter.calls[0]["request_id"]
        waiter.submit_response(rid, {
            "answers": [{"question": "选哪个方案?", "selected": ["A（推荐）"], "other": None}]
        })

    task = asyncio.ensure_future(_answer_later())
    result = await handlers["ask_user_question"](questions=[_valid_question()])
    await task

    payload = json.loads(result)
    assert payload["answers"][0]["selected"] == ["A（推荐）"]
    # emit 走旧协议：input_type 判别 + question 携带 JSON
    assert emitter.calls[0]["input_type"] == "questions"
    assert json.loads(emitter.calls[0]["question"])["questions"][0]["header"] == "方案"


@pytest.mark.asyncio
async def test_handler_invalid_input_returns_error_string():
    from planify.tools.user_interaction import bind_ask_user_question_handler

    waiter = _fresh_waiter()
    handlers = {}
    bind_ask_user_question_handler(handlers, _StubEmitter(), waiter)

    result = await handlers["ask_user_question"](questions=[])
    assert result.startswith("Error: invalid ask_user_question input")


@pytest.mark.asyncio
async def test_handler_timeout_shape(monkeypatch):
    from planify.tools.user_interaction import bind_ask_user_question_handler

    waiter = _fresh_waiter()
    handlers = {}
    bind_ask_user_question_handler(handlers, _StubEmitter(), waiter)

    monkeypatch.setattr(
        "planify.tools.user_interaction.ASK_TIMEOUT_SECONDS", 0.1
    )
    result = await handlers["ask_user_question"](questions=[_valid_question()])
    payload = json.loads(result)
    assert payload["error"] == "timeout"
    assert payload["request_id"]


# ---------- respond 端点 ----------

@pytest.mark.asyncio
async def test_respond_endpoint_roundtrip():
    from doclens.web_v2.api.ask import ask_respond
    from doclens.web_v2.models.ask import AskAnswer, AskRespondRequest

    waiter = _fresh_waiter()
    rid = await waiter.create_request("req_rt1")

    r = await ask_respond(AskRespondRequest(
        request_id="req_rt1",
        answers=[AskAnswer(question="q?", selected=["A", "B"], other="备注")],
        session_id="s1",
    ))
    assert r == {"ok": True, "submitted": True}

    resp = await waiter.wait_for_response("req_rt1", timeout=1)
    assert resp["answers"][0] == {
        "question": "q?", "selected": ["A", "B"], "other": "备注",
    }


@pytest.mark.asyncio
async def test_respond_unknown_request_id():
    from doclens.web_v2.api.ask import ask_respond
    from doclens.web_v2.models.ask import AskRespondRequest

    _fresh_waiter()
    r = await ask_respond(AskRespondRequest(request_id="req_missing", answers=[]))
    assert r == {"ok": False, "submitted": False}


def test_respond_pydantic_rejects_empty_request_id():
    from pydantic import ValidationError

    from doclens.web_v2.models.ask import AskRespondRequest

    with pytest.raises(ValidationError):
        AskRespondRequest(request_id="", answers=[])


@pytest.mark.asyncio
async def test_waiter_timeout_cleanup():
    waiter = _fresh_waiter()
    await waiter.create_request("req_to1")
    with pytest.raises(TimeoutError):
        await waiter.wait_for_response("req_to1", timeout=0.05)
    # 超时后请求被清理：再次提交应失败
    assert waiter.submit_response("req_to1", {}) is False
