# -*- coding: utf-8 -*-
"""断开续跑（ADR-0028）测试。

覆盖：
- chat_runner registry：原子注册 / done 注销 / is_running；
- store.append_display_ai_if_absent：判重防双写；
- 集成（直接驱动 _stream_agent_response 异步生成器 + aclose 模拟消费端
  断开）：
  * 断开放生 → agent 续跑完 → 补写展示层 message_ai；
  * 主动停止（先 request_stop 再断开）→ 立刻停；半截照常落库
    （2026-09-22 语义：停止保留已生成部分）；
  * 正常耗尽 → 不补写（前端写）、registry 注销；
  * 开关关闭（chat_disconnect_continue=False）→ 旧行为断开即停；
  * 会话生成中 → POST /chat 409。
"""
import asyncio
import json
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from doclens.web_v2 import chat_runner
from doclens.web_v2.api import chat as chat_api
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.sessions_store import (
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
)

_NOW = datetime.now(timezone.utc)


@pytest.fixture(autouse=True)
def _clean_runner():
    chat_runner.clear_all()
    yield
    chat_runner.clear_all()


@pytest.fixture()
def store(tmp_path):
    return SessionsStore(tmp_path / "s.db")


def _seed(store, sid="s1", message="hello"):
    store.create(SessionSummary(
        id=sid, type=SessionType.CHAT, title="t", preview="",
        created_at=_NOW, updated_at=_NOW, message_count=0,
    ))
    store.append_item(SessionItem(
        session_id=sid, seq=0, kind="message_user",
        payload=json.dumps({"content": message}), created_at=_NOW,
    ))


# ---------- chat_runner registry ----------

def test_runner_register_atomic_and_lifecycle():
    async def main():
        t1 = asyncio.create_task(asyncio.sleep(0.05))
        t2 = asyncio.create_task(asyncio.sleep(0.05))
        assert chat_runner.try_register("s", t1) is True
        assert chat_runner.try_register("s", t2) is False  # 原子拒并发
        assert chat_runner.is_running("s") is True
        await t1
        await asyncio.sleep(0)  # 让 done_callback 跑一拍
        assert chat_runner.is_running("s") is False        # 自动注销
        t2.cancel()
    asyncio.run(main())


# ---------- store 统一落库（ADR-0028） ----------

def test_ensure_message_user_idempotent(store):
    _seed(store)  # 老前端形态：已前置写入
    assert store.ensure_message_user("s1", "hello") is False   # 幂等跳过
    assert store.ensure_message_user("s1", "hello2") is True   # 新消息写入
    assert store.ensure_message_user("s1", "hello2") is False
    users = [
        json.loads(i.payload)["content"]
        for i in store.get_detail("s1") if i.kind == "message_user"
    ]
    assert users == ["hello", "hello2"]


def test_append_message_ai_shape(store):
    _seed(store)
    store.append_message_ai("s1", "回答A", [
        {"tool_use_id": "t1", "name": "bash", "input": {}, "output": "ok",
         "is_error": False, "duration_ms": 123},
    ])
    ai = [i for i in store.get_detail("s1") if i.kind == "message_ai"]
    assert len(ai) == 1
    p = json.loads(ai[0].payload)
    assert p["content"] == "回答A"
    assert p["tool_calls"][0]["duration_ms"] == 123
    assert p["references"] == []


# ---------- 集成：断开续跑 ----------

class _FakeAgent:
    """替身 StreamingAgent：慢速产出全文（保证消费端断开时仍未完成）。

    stop_mode=True 时模拟「检查点退出」：interrupt set 即返回（半截）。
    """

    def __init__(self, **kwargs):
        self.emitter = kwargs.get("emitter")
        self.interrupt_event = kwargs.get("interrupt_event")
        self.round_start_index = None
        self.full_text = "这是完整的回答内容。"

    async def run_stream(self, history, message, session_key):
        try:
            await asyncio.sleep(0.2)  # 生成期（消费端在此窗口内断开）
        except asyncio.CancelledError:
            # 停止路径第 3 层兜底是 cancel——真实 agent 此刻已流出的文本
            # 早在 emitter 里；替身补写半截以模拟该语义
            self.emitter.text_parts.append("半截")
            return
        if self.interrupt_event is not None and self.interrupt_event.is_set():
            self.emitter.text_parts.append("半截")
            return
        self.emitter.text_parts.append(self.full_text)


def _patch_env(monkeypatch, store, tmp_path, *, disconnect_continue=True):
    """注入伪 agent / 伪 config / 真存储 + 策展桩。"""
    runtime = SimpleNamespace(
        config=SimpleNamespace(
            planify_context_window=100_000,
            planify_max_tokens=4000,
            workdir=str(tmp_path),
        ),
        client=None,
        model="fake-model",
        tools=[],
        tool_handlers={},
        skills=None,
        todo_mgr=None, bg_mgr=None, bus=None, logger=None,
        runtime_id="rt",
    )
    fake_agent = SimpleNamespace(runtime=runtime, workdir=str(tmp_path))
    monkeypatch.setattr(chat_api, "get_agent", lambda: fake_agent)
    monkeypatch.setattr(
        chat_api, "get_config",
        lambda: SimpleNamespace(chat_disconnect_continue=disconnect_continue),
    )
    monkeypatch.setattr(
        "doclens.web_v2.deps.get_sessions_store", lambda: store
    )
    monkeypatch.setattr(
        "doclens.web_v2.deps.get_rewind_tracker",
        lambda: SimpleNamespace(
            begin_turn=lambda *a, **k: None,
            track_structured=lambda *a, **k: None,
            track_shell=lambda *a, **k: None,
        ),
    )
    monkeypatch.setattr(
        "planify.streaming.runner.StreamingAgent", _FakeAgent
    )
    monkeypatch.setattr(
        "doclens.web_v2.refs_curator.curate_references",
        lambda text, tools, workdir: SimpleNamespace(
            text="[策展] " + text, fallback=False, paths=[],
        ),
    )


def _item_contents(store, sid, kind):
    return [
        json.loads(i.payload).get("content")
        for i in store.get_detail(sid) if i.kind == kind
    ]


def test_disconnect_keeps_generating_and_persists_display_ai(
    store, tmp_path, monkeypatch
):
    """断开（aclose）→ agent 续跑完 → message_ai 由后端补写；
    放生同时唤醒挂起 ask（按拒绝继续，不等 300s 超时）。"""
    _patch_env(monkeypatch, store, tmp_path)
    _seed(store)
    interrupted: list = []
    monkeypatch.setattr(
        "planify.streaming.waiter.get_global_waiter",
        lambda: SimpleNamespace(interrupt_session=lambda sid: interrupted.append(sid)),
    )

    async def _consume_once_then_close(agen):
        # 消费端在生成窗口内断开：aclose 模拟 SSE 层的取消（GeneratorExit/
        # CancelledError 注入 queue.get 等待点）
        try:
            await asyncio.wait_for(agen.__anext__(), timeout=0.05)
        except (asyncio.TimeoutError, StopAsyncIteration):
            pass
        finally:
            await agen.aclose()

    async def main():
        agen = chat_api._stream_agent_response("hello", "s1")
        await _consume_once_then_close(agen)
        # 放生的 agent task 由 registry 持有——等它跑完
        runner = chat_runner.get_task("s1")
        assert runner is not None
        await asyncio.wait_for(asyncio.shield(runner), timeout=5.0)
        assert chat_runner.is_running("s1") is False

    asyncio.run(main())
    # 放生时唤醒了挂起 ask 的会话等待（不等 300s 超时）
    assert interrupted == ["s1"]
    # 续跑完成：raw 轮 + 展示层补写均落库
    raw = _item_contents(store, "s1", "message_ai_raw")
    assert raw == ["这是完整的回答内容。"]
    display = _item_contents(store, "s1", "message_ai")
    assert display == ["[策展] 这是完整的回答内容。"]
    assert store.count_live_messages("s1") == 2


async def _drain(agen):
    async for _ev in agen:
        pass


def test_stop_signal_then_disconnect_cancels_immediately(
    store, tmp_path, monkeypatch
):
    """主动停止（stop 按钮先落信号再断流）→ 断开分支命中 interrupt →
    立刻停；半截照常落库（2026-09-22 语义变更：停止保留已生成部分，
    原「主动停止不落库」废弃）。"""
    _patch_env(monkeypatch, store, tmp_path)
    _seed(store)

    async def main():
        from doclens.web_v2.chat_interrupt import request_stop

        agen = chat_api._stream_agent_response("hello", "s1")
        # 时序 = 前端 _stop：先把生成器跑起来（注册 interrupt + agent
        # task，body 到 queue.get 等待）→ request_stop 落停止信号 → 断开
        consumer = asyncio.ensure_future(_drain(agen))
        await asyncio.sleep(0.05)
        assert request_stop("s1") is True     # stop 按钮的 POST /chat/stop
        consumer.cancel()                     # 前端 abort 触发的连接断开
        await asyncio.gather(consumer, return_exceptions=True)
        # 停止路径：生成器 finally 内已 await agent_task 收尾并自动注销
        assert chat_runner.is_running("s1") is False

    asyncio.run(main())
    # 停止路径：半截经策展后照常落库展示层（用户回来可见）
    assert _item_contents(store, "s1", "message_ai") == ["[策展] 半截"]
    # raw 落库与取消/检查点竞态相关：cancel 先到 → 空文本不落；检查点先到
    # → 半截。与展示层独立，宽松断言。
    raw = _item_contents(store, "s1", "message_ai_raw")
    assert raw in ([], ["半截"])


def test_normal_completion_no_backend_display_ai(
    store, tmp_path, monkeypatch
):
    """正常耗尽（SSE 消费到底）→ 统一后端落库：message_ai 由后端写
    （前端不再写 DB）；且新前端形态（不预写 message_user）由入口 ensure 落。"""
    _patch_env(monkeypatch, store, tmp_path)
    # 不 _seed：新前端形态——message_user 也由后端入口 ensure 落库
    store.create(SessionSummary(
        id="s1", type=SessionType.CHAT, title="t", preview="",
        created_at=_NOW, updated_at=_NOW, message_count=0,
    ))

    async def main():
        agen = chat_api._stream_agent_response("hello", "s1")
        async for _ev in agen:
            pass  # 消费到哨兵
        assert chat_runner.is_running("s1") is False

    asyncio.run(main())
    assert _item_contents(store, "s1", "message_user") == ["hello"]
    assert _item_contents(store, "s1", "message_ai") == ["[策展] 这是完整的回答内容。"]
    assert _item_contents(store, "s1", "message_ai_raw") == ["这是完整的回答内容。"]
    assert store.count_live_messages("s1") == 2


def test_disconnect_with_switch_off_stops_immediately(
    store, tmp_path, monkeypatch
):
    """开关关闭（CORTEX_CHAT_DISCONNECT_CONTINUE=false）→ 旧行为：断开即停。"""
    _patch_env(monkeypatch, store, tmp_path, disconnect_continue=False)
    _seed(store)

    async def main():
        agen = chat_api._stream_agent_response("hello", "s1")
        # 跑起来后断开（无停止信号）：开关关闭 → 旧行为断开即停
        consumer = asyncio.ensure_future(_drain(agen))
        await asyncio.sleep(0.05)
        consumer.cancel()
        await asyncio.gather(consumer, return_exceptions=True)
        # 旧行为：生成器 finally 内 cancel + await 收尾并自动注销
        assert chat_runner.is_running("s1") is False

    asyncio.run(main())
    # 断开即停（cancel 注入）——2026-09-22 语义：已流出的半截照常落库
    # 展示层（替身在 cancel 时补写 text_parts 模拟已流出文本）
    assert _item_contents(store, "s1", "message_ai") == ["[策展] 半截"]


def test_chat_endpoint_409_when_generating(store, tmp_path, monkeypatch):
    """会话生成中再收新请求 → 409 SESSION_BUSY。"""
    _patch_env(monkeypatch, store, tmp_path)

    async def main():
        t = asyncio.create_task(asyncio.sleep(0.1))
        assert chat_runner.try_register("s1", t) is True
        from doclens.web_v2.models.chat import ChatRequest

        with pytest.raises(CortexAPIError) as ei:
            await chat_api.chat(ChatRequest(message="x", session_id="s1"))
        assert ei.value.status == 409
        t.cancel()
    asyncio.run(main())
