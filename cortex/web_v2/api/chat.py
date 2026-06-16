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

from cortex.web_v2.deps import get_agent
from cortex.web_v2.models.chat import ChatRequest

logger = logging.getLogger(__name__)
router = APIRouter()


async def _stream_agent_response(message: str, session_id: Optional[str]) -> AsyncIterator[str]:
    """默认实现：用 CortexAgent 流式产生文本块。

    设计要点：
    - 在独立线程运行同步 StreamingAgent
    - 用 GradioEventEmitter 改造的轻量 emitter 把 text 写入 asyncio.Queue
    - 主协程从 queue yield，做到 SSE 增量输出
    """
    agent = get_agent()
    session = agent.session

    # 复用旧 emitter 的 buffer 思路，但直接接 asyncio.Queue
    queue: asyncio.Queue = asyncio.Queue()
    done_event = threading.Event()

    # 复用旧 chat_tab 的线程模式
    def _run_in_thread():
        try:
            from cortex.web.emitter import GradioEventEmitter  # 复用旧实现
            from planify.streaming.runner import StreamingAgent
            from planify.streaming.types import StreamingConfig
            from planify.streaming.waiter import get_global_waiter
            from planify.tools import bind_user_interaction_handlers

            emitter = GradioEventEmitter()
            interrupt = threading.Event()

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def _feed():
                # 把 emitter 的 text_parts 增量投递到 queue
                last_seen = 0
                while not done_event.is_set() or last_seen < len(emitter.text_parts):
                    cur = emitter.get_full_text()
                    if len(cur) > last_seen:
                        await queue.put(cur[last_seen:])
                        last_seen = len(cur)
                    await asyncio.sleep(0.05)
                    if emitter.done:
                        break
                await queue.put(None)  # sentinel

            sa = StreamingAgent(
                client=session.client,
                model=session.model,
                tools=session.tools,
                tool_handlers=session.tool_handlers,
                emitter=emitter,
                config=StreamingConfig(),
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

            # 跑两件事：agent.run_stream + _feed
            loop.run_until_complete(asyncio.gather(
                sa.run_stream([], message, session.session_id),
                _feed(),
            ))
        except Exception as e:
            logger.exception("chat thread error: %s", e)
            asyncio.run(queue.put(f"\n\n**错误:** {e}"))
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
            async for chunk in _stream_agent_response(req.message, req.session_id):
                yield {"event": "token", "data": json.dumps({"text": chunk})}
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            logger.exception("chat stream error: %s", e)
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_stream())
