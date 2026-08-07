"""POST /api/chat —— AI 对话（SSE 流）。

设计：
1. 复用 CortexAgent.session（含 tools / tool_handlers）
2. 独立线程流式跑 StreamingAgent（token/tool 实时推 SSE，「思考过程」可见）
3. 完成后由 refs_curator 策展「## 参考资料」：AI 章节合规 → 保留精选列表
  （清洗+重编号对齐 [N]）；不合规 → 工具结果分级兜底 + toast（不重试 LLM）
"""
import asyncio
import json
import logging
import threading
from typing import AsyncIterator, Optional

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from doclens.web_v2.deps import get_agent
from doclens.web_v2.models.chat import ChatRequest

logger = logging.getLogger(__name__)
router = APIRouter()


async def _stream_agent_response(message: str, session_id: Optional[str]) -> AsyncIterator[dict]:
    """流式跑 StreamingAgent + 完成后策展参考资料。

    工具调用实时推送（思考过程可见）。AI 完成后一次性策展「## 参考资料」：
    - 合规 → 保留 AI 精选列表（剔除不存在/未被引用条目，重编号对齐 [N]）
    - 不合规 → 工具检索结果分级兜底（read_document 优先，封顶上限）+ toast 告警
    """
    from doclens.web_v2.refs_retry import FALLBACK_TOAST

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
    main_loop = asyncio.get_running_loop()

    def _put(ev: dict) -> None:
        """线程安全的 queue 入队（_feed 在子线程 loop 内，queue 属主是主 loop）。"""
        main_loop.call_soon_threadsafe(queue.put_nowait, ev)

    def _run_in_thread() -> None:
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
                delivered_calls: set[int] = set()
                delivered_results: set[int] = set()
                while True:
                    # 工具事件实时推送（思考过程的工具调用 trace 可见）；
                    # 正文 token 缓冲（不实时推），done 后用工具结果重写「## 参考资料」再整体推
                    for i, tc in enumerate(emitter.tool_calls):
                        if i not in delivered_calls:
                            _put({
                                "type": "tool_call",
                                "tool_use_id": tc.get("tool_use_id", ""),
                                "name": tc.get("name", ""),
                                "input": tc.get("input", {}),
                            })
                            delivered_calls.add(i)
                        if "output" in tc and i not in delivered_results:
                            _put({
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
                # done：策展参考资料章节——AI 章节合规则保留精选列表（清洗+重编号），
                # 不合规则工具结果分级兜底（不再无条件全量重写，避免引文膨胀与 [N] 错位）
                from doclens.web_v2.refs_curator import curate_references
                curation = curate_references(
                    emitter.get_full_text(),
                    list(emitter.tool_calls),
                    session.session_workdir,
                )
                logger.info(
                    "chat done: tools=%d fallback=%s refs=%d error=%s",
                    len(emitter.tool_calls), curation.fallback, len(curation.paths),
                    bool(emitter.error),
                )
                # run_stream 在内部捕获 LLM 异常 → emit_error → emitter.error + done=True。
                # 此处错误未抛出到 _run_in_thread 的 except，需手动透传给前端，
                # 否则 SSE 只产空 token + done（用户看到"无返回结果"）。
                if emitter.error:
                    _put({"type": "error", "detail": emitter.error})
                _put({"type": "token", "text": curation.text})
                if curation.fallback:
                    _put({"type": "toast", "level": "error", "detail": FALLBACK_TOAST})

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
        except Exception as e:  # noqa: BLE001
            logger.exception("chat thread error: %s", e)
            _put({"type": "error", "detail": str(e)})
        finally:
            _put(None)  # sentinel

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
                elif t == "toast":
                    yield {"event": "toast", "data": json.dumps({
                        "level": ev.get("level", "error"),
                        "detail": ev.get("detail", ""),
                    }, ensure_ascii=False)}
                elif t == "error":
                    yield {"event": "error", "data": json.dumps({"detail": ev.get("detail", "")})}
            yield {"event": "done", "data": "{}"}
        except Exception as e:
            logger.exception("chat stream error: %s", e)
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_stream())
