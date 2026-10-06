"""ask_user_question 工具链路测试。

覆盖四层：
1. planify 工具层：schema 定义、入参校验（合法/违规矩阵）、handler 的
   JSON 回填契约（答案回传 / 超时形态）
2. waiter：create → wait → submit 唤醒、超时清理
3. doclens respond 端点：命中 / request_id 失效、Pydantic 校验
4. 对话式提问（ADR-0033，PLANIFY_ASK_MODE=chat）：模式解析、handler
   正文送达 + 哨兵结果、runner 哨兵检测断回合
"""
import asyncio
import json
from types import SimpleNamespace

import pytest

from planify.core.config import ASK_MODE_CHAT, ASK_MODE_INTERACTIVE, get_ask_mode
from planify.core.llm.types import StreamEvent
from planify.streaming.waiter import GlobalResponseWaiter
from planify.tools.user_interaction import (
    ASK_TIMEOUT_SECONDS,
    CHAT_ASK_RESULT_PREFIX,
    format_chat_questions,
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
    """记录 emit_ask_questions 调用的桩 emitter（一等协议）。"""

    def __init__(self):
        self.calls = []

    async def emit_ask_questions(self, request_id, questions):
        self.calls.append({
            "request_id": request_id,
            "questions": questions,
        })


class _LegacyStubEmitter:
    """只实现旧协议 emit_ask_user 的桩 emitter（验证回退路径）。"""

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
    # emit 走一等协议：结构化 questions 数组直传（非 JSON 字符串）
    assert emitter.calls[0]["questions"][0]["header"] == "方案"


@pytest.mark.asyncio
async def test_handler_legacy_emitter_fallback():
    """emitter 未实现 emit_ask_questions 时回退旧协议（兼容第三方实现）。"""
    from planify.tools.user_interaction import bind_ask_user_question_handler

    waiter = _fresh_waiter()
    emitter = _LegacyStubEmitter()
    handlers = {}
    bind_ask_user_question_handler(handlers, emitter, waiter)

    async def _answer_later():
        await asyncio.sleep(0.05)
        rid = emitter.calls[0]["request_id"]
        waiter.submit_response(rid, {"answers": []})

    task = asyncio.ensure_future(_answer_later())
    result = await handlers["ask_user_question"](questions=[_valid_question()])
    await task

    assert json.loads(result)["answers"] == []
    # 回退路径：input_type 判别 + question 携带 JSON
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


# ---------- 对话式提问（ADR-0033，PLANIFY_ASK_MODE=chat） ----------

def test_get_ask_mode_env_matrix(monkeypatch):
    """模式解析：缺省/interactive → interactive；chat → chat；非法值告警回退。"""
    monkeypatch.delenv("PLANIFY_ASK_MODE", raising=False)
    assert get_ask_mode() == ASK_MODE_INTERACTIVE

    monkeypatch.setenv("PLANIFY_ASK_MODE", "interactive")
    assert get_ask_mode() == ASK_MODE_INTERACTIVE

    monkeypatch.setenv("PLANIFY_ASK_MODE", " Chat ")  # 容忍空白与大小写
    assert get_ask_mode() == ASK_MODE_CHAT

    monkeypatch.setenv("PLANIFY_ASK_MODE", "cht")  # 拼错 → fail-safe 回退
    assert get_ask_mode() == ASK_MODE_INTERACTIVE


def test_format_chat_questions_markdown_shape():
    text = format_chat_questions([
        _valid_question(),
        _valid_question(question="还要哪些?", header="h2", multiSelect=True),
    ])
    assert text.startswith("需要你的输入：")
    assert "**1. 选哪个方案?**" in text
    assert "**2. 还要哪些?**（可多选）" in text
    assert "- **A（推荐）** — 首选" in text


class _TextStubEmitter:
    """chat 模式桩 emitter：记录 emit_text 正文送达（不走 ask 通道）。"""

    def __init__(self):
        self.texts = []
        self.ask_calls = []

    async def emit_text(self, content, is_end=False):
        self.texts.append(content)

    async def emit_ask_questions(self, request_id, questions):
        self.ask_calls.append(request_id)


@pytest.mark.asyncio
async def test_handler_chat_mode_delivers_via_text_and_returns_sentinel(monkeypatch):
    """chat 模式：问题经正文通道送达 + 哨兵结果；不建 waiter 请求、不阻塞。"""
    from planify.tools.user_interaction import bind_ask_user_question_handler

    monkeypatch.setenv("PLANIFY_ASK_MODE", "chat")
    waiter = _fresh_waiter()
    emitter = _TextStubEmitter()
    handlers = {}
    bind_ask_user_question_handler(handlers, emitter, waiter)

    result = await asyncio.wait_for(
        handlers["ask_user_question"](questions=[_valid_question()]), timeout=2
    )

    # 哨兵前缀 + 续接说明（随 tool_result 入历史，供下轮模型读到）
    assert result.startswith(CHAT_ASK_RESULT_PREFIX)
    # 问题以正文送达且含结构化内容（降维为 Markdown）
    assert len(emitter.texts) == 1
    assert "选哪个方案?" in emitter.texts[0]
    assert "A（推荐）" in emitter.texts[0]
    # 无交互问答通道、无挂起等待（chat 模式的核心承诺：不阻塞回合）
    assert emitter.ask_calls == []
    assert waiter.get_pending_count() == 0


@pytest.mark.asyncio
async def test_handler_interactive_mode_still_waits(monkeypatch):
    """interactive 模式（缺省）行为不变：仍走 waiter 阻塞等待。"""
    from planify.tools.user_interaction import bind_ask_user_question_handler

    monkeypatch.delenv("PLANIFY_ASK_MODE", raising=False)
    waiter = _fresh_waiter()
    emitter = _TextStubEmitter()
    handlers = {}
    bind_ask_user_question_handler(handlers, emitter, waiter)

    async def _answer_later():
        await asyncio.sleep(0.05)
        rid = emitter.ask_calls[0]
        waiter.submit_response(rid, {"answers": []})

    task = asyncio.ensure_future(_answer_later())
    result = await handlers["ask_user_question"](questions=[_valid_question()])
    await task

    # 交互链路：ask 通道收到请求，返回 JSON 答案（非哨兵）
    assert emitter.ask_calls
    assert not result.startswith(CHAT_ASK_RESULT_PREFIX)
    assert json.loads(result)["answers"] == []


def test_run_stream_chat_ask_ends_turn(monkeypatch, tmp_path):
    """runner 级断回合：chat 模式 ask 工具执行后，回合确定性终止——
    只发生一次 LLM 调用（无第二次循环），emit_done 带 waiting_user。"""
    from planify.streaming.runner import StreamingAgent
    from planify.streaming.types import StreamingConfig
    from planify.tools.user_interaction import bind_ask_user_question_handler

    monkeypatch.setenv("PLANIFY_ASK_MODE", "chat")

    astream_calls = {"n": 0}

    def _ev(**kw):
        # 真实 StreamEvent（单一真相源）——手抄字段清单会随契约加字段而漂移
        return StreamEvent(**kw)

    class _Provider:
        async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
            astream_calls["n"] += 1
            if astream_calls["n"] > 1:
                raise AssertionError("chat 模式断回合后不应有第二次 LLM 调用")
            yield _ev(type="message_start")
            yield _ev(type="content_block_start", block_index=0, block_type="tool_use",
                      tool_use_id="tu1", tool_name="ask_user_question")
            yield _ev(type="content_block_delta", block_index=0,
                      input_json_delta=json.dumps(
                          {"questions": [_valid_question()]}, ensure_ascii=False))
            yield _ev(type="content_block_stop", block_index=0)
            yield _ev(type="message_delta", stop_reason="tool_use")
            yield _ev(type="message_stop")

    class _Emitter:
        def __init__(self):
            self.done = []  # [(session_id, reason)]
            self.tool_results = []

        async def emit_text(self, content, is_end=False):
            pass

        async def emit_tool_call(self, tool_use_id, name, input_data, is_complete=False):
            pass

        async def emit_tool_result(self, tool_use_id, name, output, is_error=False):
            self.tool_results.append((name, output))

        async def emit_done(self, session_id, summary=None, reason=None):
            self.done.append((session_id, reason))

        async def emit_error(self, error, code=None):
            raise AssertionError(error)

        async def emit_usage(self, usage):
            pass

    waiter = _fresh_waiter()
    emitter = _Emitter()
    handlers = {}
    bind_ask_user_question_handler(handlers, emitter, waiter)

    sa = StreamingAgent(
        client=_Provider(),
        model="mock",
        tools=[get_ask_user_question_tool()],
        tool_handlers=handlers,
        emitter=emitter,
        config=StreamingConfig(compact_threshold=10**9),
        skills_loader=None,
        runtime=SimpleNamespace(
            config=SimpleNamespace(workdir=tmp_path, assets_dir=tmp_path / "none"),
            skill_access_state=None,
        ),
    )

    cleaned = asyncio.run(sa.run_stream([], "问题", "sid"))

    # 断回合核心断言：单次 LLM 调用 + done(reason=waiting_user)
    assert astream_calls["n"] == 1
    assert emitter.done == [("sid", "waiting_user")]
    # 工具结果即哨兵（经 emit_tool_result 直达 SSE / 落库）
    assert emitter.tool_results[0][0] == "ask_user_question"
    assert emitter.tool_results[0][1].startswith(CHAT_ASK_RESULT_PREFIX)
    # 清理后的返回值不含 tool 链（CLI/TUI 下一轮输入）
    assert all(
        not (isinstance(m.get("content"), list)) for m in cleaned
    )


# ---------- 设置页契约（ADR-0033：PLANIFY_ASK_MODE 可视化配置） ----------

def test_ask_mode_settings_contract():
    """KNOWN_KEYS 带上提问模式键；校验规则接受合法值（含大小写/空串）、拒绝非法值。"""
    from doclens.web_v2.config_store import KNOWN_KEYS
    from doclens.web_v2.config_validator import validate_values

    assert "PLANIFY_ASK_MODE" in KNOWN_KEYS
    for ok in ("", "interactive", "chat", "CHAT", " Chat "):
        assert not validate_values({"PLANIFY_ASK_MODE": ok}).fields, ok
    errs = validate_values({"PLANIFY_ASK_MODE": "cht"}).fields
    assert errs and errs[0].field == "PLANIFY_ASK_MODE"
    assert "interactive" in errs[0].error


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


@pytest.mark.asyncio
async def test_waiter_interrupt_session_scoped():
    """interrupt_session 只中断指定会话的 pending，其他会话不受影响。"""
    waiter = _fresh_waiter()
    await waiter.create_request("req_s1a", session_id="s1")
    await waiter.create_request("req_s1b", session_id="s1")
    await waiter.create_request("req_s2", session_id="s2")

    assert waiter.interrupt_session("s1") == 2

    # s1 的两个请求收到 interrupted
    assert (await waiter.wait_for_response("req_s1a", timeout=1))["interrupted"] is True
    assert (await waiter.wait_for_response("req_s1b", timeout=1))["interrupted"] is True
    # s2 未被波及：仍可正常提交
    assert waiter.submit_response("req_s2", {"answers": []}) is True
    assert await waiter.wait_for_response("req_s2", timeout=1) == {"answers": []}
    # 空 session_id 安全 no-op；重复中断返回 0
    assert waiter.interrupt_session("") == 0
    assert waiter.interrupt_session("s1") == 0
