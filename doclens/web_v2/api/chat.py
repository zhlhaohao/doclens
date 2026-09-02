"""POST /api/chat —— AI 对话（SSE 流）。

设计：
1. 复用 CortexAgent.session（含 tools / tool_handlers）
2. StreamingAgent 直接跑在本 ASGI 事件循环上（provider.astream 不阻塞
   loop，无需生成线程/双 loop 桥接）：事件在发生处经 ChatEventEmitter
   直推 asyncio.Queue，本生成器按序转 SSE——工具 trace 实时可见
3. 完成后由 refs_curator 策展「## 参考资料」：AI 章节合规 → 保留精选列表
  （清洗+重编号对齐 [N]）；不合规 → 工具结果分级兜底 + toast（不重试 LLM）
4. 停止/断开：request_stop set Event（agent 在流式检查点退出）+ 中断
   hook 唤醒挂起的 ask 等待 + 取消 agent 任务——三层兜底，覆盖旧版
   「ask 挂起期间停止无效」缺口
"""

import asyncio
import json
import logging
import re
import threading
from typing import AsyncIterator, Optional

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from doclens.web_v2.chat_interrupt import (
    register_interrupt,
    register_interrupt_hook,
    request_stop,
    unregister_interrupt,
    unregister_interrupt_hook,
)
from doclens.web_v2.deps import get_agent
from doclens.web_v2.models.chat import ChatRequest, ChatStopRequest
from doclens.web_v2.api._chat_events import KNOWN_EVENT_TYPES

logger = logging.getLogger(__name__)
router = APIRouter()

_LOADED_SKILL_RE = re.compile(r'<loaded-skill name="([^"]+)">')


def _extract_injected_skill_contexts(history: list[dict]) -> list[tuple[str, str]]:
    """从 run_stream 原地修改后的 history 提取注入的 skill body（按出现顺序去重）。

    Returns:
        [(skill_name, 完整消息内容), ...]，与 runner 注入顺序一致。
    """
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for m in history:
        content = m.get("content")
        if m.get("role") != "user" or not isinstance(content, str):
            continue
        match = _LOADED_SKILL_RE.search(content)
        if match and match.group(1) not in seen:
            seen.add(match.group(1))
            out.append((match.group(1), content))
    return out


async def _stream_agent_response(
    message: str, session_id: Optional[str]
) -> AsyncIterator[dict]:
    """流式跑 StreamingAgent + 完成后策展参考资料。

    工具调用实时推送（思考过程可见）。AI 完成后一次性策展「## 参考资料」：
    - 技能会话（首条用户消息含「[调用技能: …]」标记）→ 提取式：从正文提取
      真实路径重建章节，不用 [N] 策展
    - 普通会话 → 声明式策展：合规 → 保留 AI 精选列表（剔除不存在/未被引用
      条目，重编号对齐 [N]）；不合规 → 工具检索结果分级兜底 + toast 告警
    """
    from doclens.web_v2.refs_retry import FALLBACK_TOAST
    from doclens.web_v2.skill_refs import curate_skill_references, is_skill_message

    agent = get_agent()
    session = agent.session

    history: list[dict] = []
    skill_session = is_skill_message(message)
    if session_id:
        try:
            from doclens.web_v2.deps import get_sessions_store

            store = get_sessions_store()
            # 技能会话身份：会话级显式声明（sessions.mode == 'skill'，由前端
            # 创建技能会话时写入），与消息内容无关、不受历史压缩影响。
            summary = store.get(session_id)
            if summary is not None and summary.mode == "skill":
                skill_session = True
            history = store.get_chat_history(session_id)
            # 前端在发送时已把本轮 message_user 落库（会出现在 history 末尾），
            # run_stream 内部还会再追加一次 user_message —— 弹出避免重复。
            # （appendSession 失败时前端不会发起本请求，故末尾必是本轮消息）
            if (
                history
                and history[-1].get("role") == "user"
                and history[-1].get("content") == message
            ):
                history.pop()
        except Exception as e:  # noqa: BLE001
            logger.warning("load chat history failed for %s: %s", session_id, e)

    from doclens.web_v2.api._chat_emitter import ChatEventEmitter

    queue: asyncio.Queue = asyncio.Queue()
    emitter = ChatEventEmitter(queue)

    # 在消费开始前登记中断（杜绝「stop 早于 register」竞态）。
    # session_id 为 None 时不登记（无法被 /chat/stop 寻址；前端总会传 DB session id）。
    session_key = session_id or None
    interrupt = register_interrupt(session_key) if session_key else threading.Event()

    from planify.streaming.runner import StreamingAgent
    from planify.streaming.types import StreamingConfig
    from planify.streaming.waiter import get_global_waiter
    from planify.tools import (
        bind_ask_user_question_handler,
        bind_user_interaction_handlers,
    )
    from doclens.agent_prompt import KB_SYSTEM_PROMPT_EXTRA
    from doclens.web_v2.api._chat_events import error_event, toast_event, token_event

    waiter = get_global_waiter()

    def _interrupt_pending_asks() -> None:
        """中断 hook：唤醒该会话挂起的 ask 等待（Event 检查点覆盖不到工具挂起期）。

        会话维度的 pending 索引由 waiter 自持（interrupt_session），
        不再依赖 emitter 侧的 pending_asks 影子表。
        """
        if session_key:
            waiter.interrupt_session(session_key)

    if session_key:
        register_interrupt_hook(session_key, _interrupt_pending_asks)

    # 用户交互工具的 handler 捕获本请求的 emitter——必须绑在每请求浅拷贝上，
    # 不能写回共享单例 session.tool_handlers（同 session 并发两流会互相覆盖绑定）。
    tool_handlers = {**session.tool_handlers}
    bind_user_interaction_handlers(tool_handlers, emitter, waiter)
    # ask_user_question：GUI 结构化问答（旧 ask_user/user_confirm 已在
    # session 工具集过滤，此处无需绑定）
    bind_ask_user_question_handler(tool_handlers, emitter, waiter)

    sa = StreamingAgent(
        client=session.client,
        model=session.model,
        tools=session.tools,
        tool_handlers=tool_handlers,
        emitter=emitter,
        config=StreamingConfig(
            compact_threshold=int(round(session.config.planify_context_window * 0.8)),
            max_tokens=session.config.planify_max_tokens,
        ),
        waiter=waiter,
        todo_manager=session.todo_mgr,
        bg_manager=session.bg_mgr,
        bus=session.bus,
        skills_loader=session.skills,
        logger_instance=session.logger,
        session=session,
        interrupt_event=interrupt,
        system_prompt_extra=KB_SYSTEM_PROMPT_EXTRA,
    )

    async def _run_and_finalize() -> None:
        """跑 agent + 完成后策展推送 + 落库（断开/取消时落库仍执行，与旧行为一致）。"""
        # 本轮开始前 history 长度（pop 本轮 user 消息后）：run_stream 原地追加
        # 的本轮消息从该下标起，供 raw_messages 落库提取
        round_start = len(history)
        try:
            await sa.run_stream(history, message, session_id or session.session_id)

            # done：策展参考资料章节。
            # 技能会话 → 即选择文件再点右键选择技能执行，例如总结文件技能，提取式（正文提路径+存在性校验重建章节，无 toast）；
            # 普通会话 → 声明式（合规则保留精选列表清洗+重编号，
            # 不合规则工具结果分级兜底，不再无条件全量重写，避免引文膨胀与 [N] 错位）
            try:
                if skill_session:
                    curated_text = curate_skill_references(
                        emitter.get_full_text(), session.session_workdir
                    )
                    logger.info(
                        "chat done(skill): tools=%d error=%s",
                        len(emitter.tool_calls),
                        bool(emitter.error),
                    )
                    curated_fallback = False
                else:
                    from doclens.web_v2.refs_curator import curate_references

                    curation = curate_references(
                        emitter.get_full_text(),
                        list(emitter.tool_calls),
                        session.session_workdir,
                    )
                    curated_text = curation.text
                    curated_fallback = curation.fallback
                    logger.info(
                        "chat done: tools=%d fallback=%s refs=%d error=%s",
                        len(emitter.tool_calls),
                        curation.fallback,
                        len(curation.paths),
                        bool(emitter.error),
                    )
            except Exception as e:  # noqa: BLE001
                # 策展失败降级为原文（不阻断 token 推送）
                logger.exception("curate references failed: %s", e)
                curated_text = emitter.get_full_text()
                curated_fallback = False

            # run_stream 在内部捕获 LLM 异常 → emit_error → emitter.error + done=True。
            # 此处错误未抛出到本协程，需手动透传给前端，
            # 否则 SSE 只产空 token + done（用户看到"无返回结果"）。
            if emitter.error:
                queue.put_nowait(error_event(emitter.error))
            queue.put_nowait(token_event(curated_text))
            if curated_fallback:
                queue.put_nowait(toast_event("error", FALLBACK_TOAST))
        finally:
            # 持久化 run_stream 注入的 skill body（按 name 幂等）：
            # 回放时出现在首次注入位置，跨轮请求保持纯尾部追加
            # （prompt 前缀缓存友好）。必须在 append_chat_turn_raw 之前——
            # 新条目要插到本轮 message_user 之前，复现内存中的注入位置。
            if session_key:
                try:
                    from doclens.web_v2.deps import get_sessions_store

                    injected = _extract_injected_skill_contexts(history)
                    if injected:
                        get_sessions_store().upsert_skill_contexts(
                            session_key, injected
                        )
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        "persist skill contexts failed for %s: %s", session_key, e
                    )
            # 持久化本轮原始消息序列（assistant/tool_result 按 runner 真实累积
            # 结构）：tool_trace 拆对回放与真实结构不等价，多工具/文本交错轮
            # 前缀会从该轮首条 assistant 起分叉；raw_messages 回放逐字节一致。
            if session_key:
                try:
                    from doclens.web_v2.api._chat_raw import (
                        extract_round_raw_messages,
                    )
                    from doclens.web_v2.deps import get_sessions_store

                    raw_msgs = extract_round_raw_messages(
                        history, round_start, message
                    )
                    if raw_msgs:
                        get_sessions_store().append_raw_messages(
                            session_key, raw_msgs
                        )
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        "persist raw messages failed for %s: %s", session_key, e
                    )
            # 持久化原始轮次（tool 链 + 模型原始输出），供下一轮 LLM 上下文回放。
            # 与展示层分离：前端另写 message_user/message_ai（策展文本），
            # get_chat_history 回放时优先 message_ai_raw。
            if session_key:
                try:
                    from doclens.web_v2.deps import get_sessions_store

                    traces = [
                        {
                            "tool_use_id": tc.get("tool_use_id", ""),
                            "name": tc.get("name", ""),
                            "input": tc.get("input", {}),
                            "output": tc.get("output", ""),
                            "is_error": tc.get("is_error", False),
                        }
                        for tc in emitter.tool_calls
                        if "output"
                        in tc  # 只落库已完成的调用对（中断残留不配对的丢弃）
                    ]
                    get_sessions_store().append_chat_turn_raw(
                        session_key, traces, emitter.get_full_text()
                    )
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        "persist raw chat turn failed for %s: %s", session_key, e
                    )
            queue.put_nowait(None)  # 哨兵：SSE 生成器终结（无论成败）

    agent_task = asyncio.create_task(_run_and_finalize())

    try:
        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            yield chunk
        # 哨兵已到：agent 收尾（落库/策展）完成或异常，透传未捕获异常
        if agent_task.done() and not agent_task.cancelled():
            exc = agent_task.exception()
            if exc is not None:
                logger.exception("chat task error: %s", exc)
                yield {"type": "error", "detail": str(exc)}
    finally:
        if session_key:
            unregister_interrupt(session_key, interrupt)
            unregister_interrupt_hook(session_key, _interrupt_pending_asks)
        if not agent_task.done():
            # 消费端早退（断开/异常）：三层兜底停止 agent
            # 1) Event → agent 在流式检查点退出
            # 2) hook → 唤醒挂起的 ask 等待
            # 3) cancel → CancelledError 沿 await 链传播（astream/工具 await）
            if session_key:
                request_stop(session_key)
            agent_task.cancel()
        try:
            await agent_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass


@router.post("/chat")
async def chat(req: ChatRequest):
    async def event_stream() -> AsyncIterator[dict]:
        try:
            # 队列事件与线格式同构（_chat_events 单一真相源）：剥掉 type 作
            # event 名，其余字段整体透传；未知类型记 warning（不静默丢弃）。
            async for ev in _stream_agent_response(req.message, req.session_id):
                t = ev.get("type")
                if t not in KNOWN_EVENT_TYPES:
                    logger.warning("chat stream: 未知队列事件类型 %r，丢弃: %s", t, ev)
                    continue
                yield {
                    "event": t,
                    "data": json.dumps(
                        {k: v for k, v in ev.items() if k != "type"},
                        ensure_ascii=False,
                    ),
                }
            yield {"event": "done", "data": "{}"}
        except asyncio.CancelledError:
            # 客户端断开（关页 / 切走 / 断网 / 主动 abort）→ 通知生成线程停，
            # 堵住「前端不读了，后端继续烧 token」的泄漏。重抛以正常收尾 SSE。
            if req.session_id:
                request_stop(req.session_id)
            raise
        except Exception as e:
            logger.exception("chat stream error: %s", e)
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}

    return EventSourceResponse(event_stream())


@router.post("/chat/stop")
async def chat_stop(req: ChatStopRequest):
    """请求中断指定 session 的 AI 生成。

    命中（已发出中断信号）或未命中（流已结束 / 不存在）都返回 ``ok=True``，
    让前端可以 fire-and-forget 而无需关心时序。``stopped`` 仅作诊断用。
    """
    stopped = request_stop(req.session_id)
    return {"ok": True, "stopped": stopped}
