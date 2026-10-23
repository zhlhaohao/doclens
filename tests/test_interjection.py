# -*- coding: utf-8 -*-
"""插话（User Interjection，ADR-0048）测试。

三层覆盖：
1. 槽位纯逻辑：单槽位互斥 / take 清空 / drop 丢弃（planify.interjection）；
2. runner 集成：循环顶检查点消费插话——注入模板消息 → suppress_tools
   调用（tools=[]）产汇报 → 循环继续原任务（回合不结束）→ 轮次预算不计
   插话轮（沿 test_tool_round_budget 的 ScriptedProvider 模式直驱
   StreamingAgent）；
3. ChatEventEmitter 双事件：interject_ack / interject_report 推送、
   汇报文本不进正文 text_parts、合成条目（user_interject）随 tool_calls。
"""
import asyncio
import copy
import json
from types import SimpleNamespace

import pytest

from planify.core.llm.types import StreamEvent
from planify.streaming.interjection import (
    INTERJECTION_TAG,
    InterjectionSlot,
    drop_interjection_slot,
    get_interjection_slot,
    interjection_message,
)
from planify.streaming.types import StreamingConfig


# ---------- 槽位纯逻辑 ----------

class TestSlot:
    def test_single_slot_mutex(self):
        slot = InterjectionSlot()
        assert slot.submit("问1") is True
        assert slot.submit("问2") is False  # 单槽位：占用即拒（不排队）
        assert slot.has_pending() is True
        assert slot.take() == "问1"
        assert slot.take() is None  # 取走即清空
        assert slot.submit("问3") is True  # 清空后可再提交

    def test_registry_drop(self):
        get_interjection_slot("s_x").submit("残留")
        assert drop_interjection_slot("s_x") == "残留"
        assert drop_interjection_slot("s_x") is None  # 无残留 no-op
        assert drop_interjection_slot("never") is None

    def test_message_template(self):
        msg = interjection_message("进度如何")
        assert msg.startswith(f"<{INTERJECTION_TAG}>")
        assert "进度如何" in msg
        assert "不要调用任何工具" in msg
        assert "不要结束任务" in msg


# ---------- runner 集成 ----------

def _ev(type_, **kw):
    return StreamEvent(type=type_, **kw)


class ScriptedProvider:
    """脚本驱动：tools 轮产工具调用；text 轮产终答；record 记录每次请求的
    messages 与 tools（断言插话轮 tools==[]）。"""

    def __init__(self, script):
        self.script = script
        self.records = []
        self._call = 0

    async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
        def _name(t):
            return t["name"] if isinstance(t, dict) else getattr(t, "name", str(t))
        self.records.append({
            "messages": copy.deepcopy(messages),
            "tools": [_name(t) for t in tools],
        })
        step = self.script[min(self._call, len(self.script) - 1)]
        self._call += 1
        if "tools" in step:
            for i, (name, inp) in enumerate(step["tools"]):
                tid = f"tu_{self._call}_{i}"
                yield _ev("content_block_start", block_index=i, block_type="tool_use",
                          tool_use_id=tid, tool_name=name)
                yield _ev("content_block_delta", block_index=i,
                          input_json_delta=json.dumps(inp))
                yield _ev("content_block_stop", block_index=i)
            yield _ev("message_delta", stop_reason="tool_use")
            yield _ev("message_stop")
        else:
            yield _ev("content_block_start", block_index=0, block_type="text")
            yield _ev("content_block_delta", block_index=0, text_delta=step["text"])
            yield _ev("content_block_stop", block_index=0)
            yield _ev("message_delta", stop_reason="end_turn")
            yield _ev("message_stop")


class StubEmitter:
    def __init__(self):
        self.texts = []
        self.dones = []

    async def emit_text(self, content, is_end=False):
        self.texts.append(content)

    async def emit_tool_call(self, tool_use_id, name, input_data, is_complete=False):
        pass

    async def emit_tool_result(self, tool_use_id, name, output, is_error=False):
        pass

    async def emit_notice(self, message):
        pass

    async def emit_done(self, session_id, summary=None, reason=None):
        self.dones.append(reason)

    async def emit_error(self, error, code=None):
        raise AssertionError(f"agent 运行出错: {error}")


def _make_agent(provider, tmp_path, **cfg):
    from planify.streaming.runner import StreamingAgent

    handlers = {"grep": lambda **kw: "grep result"}
    tools = [
        {"name": "grep", "description": "test",
         "input_schema": {"type": "object", "properties": {}, "required": []}}
    ]
    runtime = SimpleNamespace(
        config=SimpleNamespace(workdir=tmp_path, compact_transcript_dir=None,
                               assets_dir=tmp_path / "assets"),
        replace_messages_in_place=lambda msgs: None,
    )
    return StreamingAgent(
        client=provider, model="mock", tools=tools, tool_handlers=handlers,
        emitter=StubEmitter(), runtime=runtime,
        config=StreamingConfig(
            compact_threshold=10**9, poll_backoff_initial_s=0.0, **cfg
        ),
    )


class TestRunnerInterjection:
    def test_interject_consumed_then_loop_continues(self, tmp_path):
        """插话在循环顶消费：注入模板消息 + suppress_tools 汇报（tools=[]）
        + 循环继续原任务（回合不结束）。首个检查点在第一次 LLM 调用前——
        提前提交的插话让轮 1 即汇报轮。"""
        from planify.streaming.interjection import get_interjection_slot

        sid = "sess_ij1"
        provider = ScriptedProvider([
            {"text": "当前进度：已完成检索"},   # 轮1 = 插话汇报（suppress_tools）
            {"tools": [("grep", {"q": "a"})]},  # 轮2 = 恢复任务
            {"text": "任务完成"},               # 轮3 = 终答
        ])
        agent = _make_agent(provider, tmp_path)
        get_interjection_slot(sid).submit("现在进度汇报一下")

        async def run():
            return await agent.run_stream([], "开始任务", sid)

        result = asyncio.run(run())
        assert result is not None
        drop_interjection_slot(sid)  # 清理注册表

        recs = provider.records
        # 轮1：插话轮——注入消息在位 + 工具表置空
        last_user = [m for m in recs[0]["messages"] if m["role"] == "user"][-1]
        assert INTERJECTION_TAG in last_user["content"]
        assert "现在进度汇报一下" in last_user["content"]
        assert recs[0]["tools"] == []
        # 轮2：恢复任务——工具表回来 + 插话问答已在历史
        assert "grep" in recs[1]["tools"]
        assert any(
            INTERJECTION_TAG in m.get("content", "")
            for m in recs[1]["messages"] if isinstance(m.get("content"), str)
        )
        # 汇报 assistant 消息在历史（轮2 请求里可见）
        assert any(
            m["role"] == "assistant" and "当前进度" in str(m["content"])
            for m in recs[1]["messages"]
        )
        # 汇报文本经 emitter 正常推送（CLI/TUI 可见；宿主在插话通道改道）
        assert "当前进度：已完成检索" in "".join(agent.emitter.texts)

    def test_interject_mid_round_consumption(self, tmp_path):
        """工具循环中途到达的插话：轮 1 工具轮正常跑完（不打断），轮 2
        检查点消费插话（suppress_tools），轮 3 恢复任务。"""
        from planify.streaming.interjection import get_interjection_slot

        sid = "sess_ij1b"
        provider = ScriptedProvider([
            {"tools": [("grep", {"q": "a"})]},  # 轮1 = 任务工具轮
            {"text": "汇报内容"},               # 轮2 = 插话汇报
            {"tools": [("grep", {"q": "b"})]},  # 轮3 = 恢复任务
            {"text": "终答"},                   # 轮4
        ])
        agent = _make_agent(provider, tmp_path)
        # 轮 1 的工具执行 handler 内才提交插话（模拟「当前步骤跑着时用户插话」）
        orig_grep = agent.tool_handlers["grep"]

        def grep_then_submit(**kw):
            get_interjection_slot(sid).submit("中途插话")
            return orig_grep(**kw)

        agent.tool_handlers["grep"] = grep_then_submit

        async def run():
            return await agent.run_stream([], "开始任务", sid)

        asyncio.run(run())
        drop_interjection_slot(sid)
        recs = provider.records
        assert "grep" in recs[0]["tools"]          # 轮1 正常带工具
        assert recs[1]["tools"] == []              # 轮2 汇报轮
        assert "grep" in recs[2]["tools"]          # 轮3 恢复任务
        # 插话消息位于轮 1 工具结果之后（不打断在飞步骤，检查点才注入）
        r1_users = [m for m in recs[1]["messages"] if m["role"] == "user"]
        assert INTERJECTION_TAG in r1_users[-1]["content"]

    def test_interject_not_counted_in_tool_rounds(self, tmp_path):
        """轮次预算不计插话轮：max_tool_rounds=2 下，插话汇报轮（轮1）+
        2 次工具轮（轮2/轮4）后终答——插话不计入才不会在第 2 工具轮后
        触发软阈值提醒（若无豁免，计数满 2 即注入 reminder）。"""
        from planify.streaming.runner import CONTEXT_MARKER
        from planify.streaming.interjection import get_interjection_slot

        sid = "sess_ij2"
        provider = ScriptedProvider([
            {"text": "汇报"},                       # 轮1 = 插话汇报（不计）
            {"tools": [("grep", {"q": "1"})]},      # 轮2 = 工具轮（计数 1）
            {"text": "汇报后小段"},                  # 轮3：脚本占位（不实际到达）
            {"tools": [("grep", {"q": "2"})]},
            {"text": "终答"},
        ])
        agent = _make_agent(provider, tmp_path, max_tool_rounds=2)
        get_interjection_slot(sid).submit("进度？")

        async def run():
            return await agent.run_stream([], "任务", sid)

        asyncio.run(run())
        drop_interjection_slot(sid)

        # 终答发生（无强制 suppress 终答轮——force_answer_rounds=None 时
        # 硬阈值不触发；软阈值 reminder 也不该出现：计数只有 2）
        for rec in provider.records:
            for m in rec["messages"]:
                content = m.get("content")
                if (m["role"] == "user" and isinstance(content, str)
                        and "<system-reminder>" in content
                        and CONTEXT_MARKER not in content):
                    pytest.fail(f"不应出现预算提醒: {content[:80]}")

    def test_no_interjection_zero_impact(self, tmp_path):
        """无插话时行为与旧路径逐字节一致：无注入消息、全部调用带工具表。"""
        sid = "sess_ij3"
        provider = ScriptedProvider([
            {"tools": [("grep", {"q": "1"})]},
            {"text": "done"},
        ])
        agent = _make_agent(provider, tmp_path)
        asyncio.run(agent.run_stream([], "任务", sid))
        for rec in provider.records:
            assert "grep" in rec["tools"]
            assert not any(
                INTERJECTION_TAG in str(m.get("content", ""))
                for m in rec["messages"]
            )
        drop_interjection_slot(sid)


# ---------- ChatEventEmitter 双事件 ----------

class TestEmitterEvents:
    def _make_emitter(self):
        from doclens.web_v2.api._chat_emitter import ChatEventEmitter

        q = asyncio.Queue()
        return ChatEventEmitter(q), q

    def test_begin_end_interjection_flow(self):
        em, q = self._make_emitter()

        async def run():
            await em.emit_text("正文前半", is_end=False)
            await em.begin_interjection("进度如何")
            await em.emit_text("汇报文本", is_end=False)
            await em.end_interjection()
            await em.emit_text("正文后半", is_end=False)

        asyncio.run(run())

        # 正文 text_parts 不含汇报（防污染策展文本）
        assert em.get_full_text() == "正文前半正文后半"
        # tool_calls 合成条目：user_interject + question + output 回填
        entry = next(t for t in em.tool_calls if t.get("name") == "user_interject")
        assert entry["input"] == {"question": "进度如何"}
        assert entry["output"] == "汇报文本"
        assert entry["is_error"] is False
        assert "duration_ms" in entry
        # SSE 队列：ack + report 双事件（顺序 ack 先于 report）
        events = []
        while not q.empty():
            events.append(q.get_nowait())
        ack = [e for e in events if e["type"] == "interject_ack"]
        rpt = [e for e in events if e["type"] == "interject_report"]
        assert len(ack) == 1 and ack[0]["question"] == "进度如何"
        assert ack[0]["tool_use_id"].startswith("interject_")
        assert len(rpt) == 1 and rpt[0]["text"] == "汇报文本"
        assert rpt[0]["tool_use_id"] == ack[0]["tool_use_id"]

    def test_interject_entry_persists_in_tool_calls_for_db(self):
        """落库口径：合成条目含 output（'output' in tc 过滤通过），
        随 append_message_ai 展示层与 append_chat_turn_raw 原始层一起回放。"""
        em, _q = self._make_emitter()

        async def run():
            await em.begin_interjection("q1")
            await em.emit_text("a1", is_end=False)
            await em.end_interjection()

        asyncio.run(run())
        display = [tc for tc in em.tool_calls if "output" in tc]
        assert any(tc["name"] == "user_interject" for tc in display)


# ---------- /api/chat/interject 端点 ----------

class TestInterjectEndpoint:
    def test_not_running_409(self):
        """会话不在生成中（无 interrupt 登记）→ 409 SESSION_NOT_RUNNING。"""
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from doclens.web_v2.api.chat import router
        from doclens.web_v2.api.errors import register_error_handlers

        app = FastAPI()
        register_error_handlers(app)
        app.include_router(router, prefix="/api")
        client = TestClient(app, raise_server_exceptions=False)
        try:
            r = client.post(
                "/api/chat/interject",
                json={"session_id": "no_run", "text": "进度？"},
            )
            assert r.status_code == 409
            assert r.json()["code"] == "SESSION_NOT_RUNNING"
        finally:
            drop_interjection_slot("no_run")  # 防御清理

    def test_slot_semantics_via_registry(self):
        """生成中（interrupt 登记）语义：提交 ok → 槽位占用（再提交 409
        INTERJECT_PENDING）→ stop 收尾路径 drop 清空。直接验证槽位与
        is_streaming 联动（HTTP 层薄，语义在槽位 + interrupt registry）。"""
        from doclens.web_v2.chat_interrupt import (
            register_interrupt,
            unregister_interrupt,
        )

        sid = "sess_ep1"
        ev = register_interrupt(sid)
        try:
            slot = get_interjection_slot(sid)
            assert slot.submit("第一问") is True
            assert slot.submit("第二问") is False  # 单槽位
            # 收尾丢弃（chat.py finally 语义）：残留返回 → toast 依据
            assert drop_interjection_slot(sid) == "第一问"
            assert drop_interjection_slot(sid) is None
        finally:
            unregister_interrupt(sid, ev)
