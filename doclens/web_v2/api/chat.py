"""POST /api/chat —— AI 对话（SSE 流）。

设计：
1. 复用 CortexAgent.session（含 tools / tool_handlers）
2. 在独立线程运行 StreamingAgent.run_stream，emitter 写入 asyncio.Queue
3. FastAPI handler 把 queue 转成 SSE 流
"""
import asyncio
import json
import logging
import threading
from typing import AsyncIterator, Optional

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse

from doclens.web_v2.deps import get_agent
from doclens.web_v2.models.chat import ChatRequest

logger = logging.getLogger(__name__)
router = APIRouter()


async def _stream_agent_response(message: str, session_id: Optional[str]) -> AsyncIterator[dict]:
    """流式产生结构化事件 dict 供 SSE 消费。

    事件类型：
    - {"type":"token","text":...}
    - {"type":"tool_call","tool_use_id":...,"name":...,"input":...}
    - {"type":"tool_result","tool_use_id":...,"name":...,"output":...,"is_error":...,"duration_ms":...}
    - {"type":"error","detail":...}
    """
    agent = get_agent()
    session = agent.session

    history: list[dict] = []
    if session_id:
        try:
            from doclens.web_v2.deps import get_sessions_store
            history = get_sessions_store().get_chat_history(session_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("load chat history failed for %s: %s", session_id, e)

    queue: asyncio.Queue = asyncio.Queue()
    done_event = threading.Event()

    def _run_in_thread():
        try:
            from doclens.web_v2.api._chat_emitter import GradioEventEmitter
            from planify.streaming.runner import StreamingAgent
            from planify.streaming.types import StreamingConfig
            from planify.streaming.waiter import get_global_waiter
            from planify.tools import bind_user_interaction_handlers

            emitter = GradioEventEmitter()
            interrupt = threading.Event()

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def _feed():
                last_seen_text = 0
                delivered_calls: set[int] = set()
                delivered_results: set[int] = set()
                while True:
                    # 文本增量
                    cur = emitter.get_full_text()
                    if len(cur) > last_seen_text:
                        await queue.put({"type": "token", "text": cur[last_seen_text:]})
                        last_seen_text = len(cur)
                    # 工具事件（用游标检测新增 / 新回填）
                    for i, tc in enumerate(emitter.tool_calls):
                        if i not in delivered_calls:
                            await queue.put({
                                "type": "tool_call",
                                "tool_use_id": tc.get("tool_use_id", ""),
                                "name": tc.get("name", ""),
                                "input": tc.get("input", {}),
                            })
                            delivered_calls.add(i)
                        if "output" in tc and i not in delivered_results:
                            await queue.put({
                                "type": "tool_result",
                                "tool_use_id": tc.get("tool_use_id", ""),
                                "name": tc.get("name", ""),
                                "output": tc.get("output", ""),
                                "is_error": tc.get("is_error", False),
                                "duration_ms": tc.get("duration_ms"),
                            })
                            delivered_results.add(i)
                    if emitter.done:
                        break
                    await asyncio.sleep(0.05)
                await queue.put(None)  # sentinel

            sa = StreamingAgent(
                client=session.client,
                model=session.model,
                tools=session.tools,
                tool_handlers=session.tool_handlers,
                emitter=emitter,
                config=StreamingConfig(
                    compact_threshold=int(round(session.config.planify_context_window * 0.8))
                ),
                waiter=get_global_waiter(),
                todo_manager=session.todo_mgr,
                bg_manager=session.bg_mgr,
                bus=session.bus,
                skills_loader=session.skills,
                logger_instance=session.logger,
                session=session,
                interrupt_event=interrupt,
            )
            bind_user_interaction_handlers(session.tool_handlers, emitter, get_global_waiter())

            loop.run_until_complete(asyncio.gather(
                sa.run_stream(history, message, session_id or session.session_id),
                _feed(),
            ))
        except Exception as e:
            logger.exception("chat thread error: %s", e)
            asyncio.run(queue.put({"type": "error", "detail": str(e)}))
            asyncio.run(queue.put(None))
        finally:
            done_event.set()

    t = threading.Thread(target=_run_in_thread, daemon=True)
    t.start()

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        yield chunk


@router.post("/chat")
async def chat(req: ChatRequest):
    async def event_stream() -> AsyncIterator[dict]:
        try:
            async for ev in _stream_agent_response(req.message, req.session_id):
                t = ev.get("type")
                if t == "token":
                    yield {"event": "token", "data": json.dumps({"text": ev["text"]}, ensure_ascii=False)}
                elif t == "tool_call":
                    yield {"event": "tool_call", "data": json.dumps({
                        "tool_use_id": ev["tool_use_id"],
                        "name": ev["name"],
                        "input": ev["input"],
                        "is_complete": True,
                    }, ensure_ascii=False)}
                elif t == "tool_result":
                    yield {"event": "tool_result", "data": json.dumps({
                        "tool_use_id": ev["tool_use_id"],
                        "name": ev["name"],
                        "output": ev["output"],
                        "is_error": ev.get("is_error", False),
                        "duration_ms": ev.get("duration_ms"),
                    }, ensure_ascii=False)}
                elif t == "error":
                    yield {"event": "error", "data": json.dumps({"detail": ev.get("detail", "")})}
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            logger.exception("chat stream error: %s", e)
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_stream())
