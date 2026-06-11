"""AI 对话 Tab — 流式 AI Agent 对话"""

import asyncio
import logging
import threading
import time
from typing import Any, Dict, List, Optional

import gradio as gr

logger = logging.getLogger(__name__)


def _run_agent_in_thread(
    query: str,
    history: list[dict],
    emitter,  # GradioEventEmitter
    session,  # Session
    tools: list,
    tool_handlers: dict,
    done_event: threading.Event,
):
    """在独立线程中运行 StreamingAgent，写入 emitter 缓冲区"""
    try:
        from planify.streaming.runner import StreamingAgent
        from planify.streaming.types import StreamingConfig
        from planify.tools import bind_user_interaction_handlers
        from planify.streaming.waiter import get_global_waiter

        _interrupt_event = threading.Event()

        agent = StreamingAgent(
            client=session.client,
            model=session.model,
            tools=tools,
            tool_handlers=tool_handlers,
            emitter=emitter,
            config=StreamingConfig(),
            waiter=get_global_waiter(),
            todo_manager=session.todo_mgr,
            bg_manager=session.bg_mgr,
            bus=session.bus,
            skills_loader=session.skills,
            logger_instance=session.logger,
            session=session,
            interrupt_event=_interrupt_event,
        )

        bind_user_interaction_handlers(tool_handlers, emitter, get_global_waiter())

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                agent.run_stream(history, query, session.session_id)
            )
        finally:
            loop.close()

    except Exception as e:
        logger.exception("Agent thread error: %s", e)
        emitter.text_parts.append(f"\n\n**错误:** {e}")
    finally:
        done_event.set()


def chat_respond(message: str, chat_history: list):
    """Gradio Chatbot 的流式响应函数（generator）

    Gradio 6.x chat_history 格式: list of ChatMessage dicts
    {"role": "user"|"assistant", "content": "..."}
    """
    if not message or not message.strip():
        yield chat_history
        return

    from cortex.web.deps import get_agent
    from cortex.web.emitter import GradioEventEmitter

    # 先添加用户消息和等待提示
    chat_history.append({"role": "user", "content": message})
    chat_history.append({"role": "assistant", "content": "正在初始化 Agent..."})
    yield chat_history

    try:
        agent = get_agent()
        session = agent.session
    except Exception as e:
        logger.exception("Agent init failed: %s", e)
        chat_history[-1]["content"] = f"**Agent 初始化失败:** {e}"
        yield chat_history
        return

    # 从 chat_history 重建 agent history
    agent_history = []
    for msg in chat_history[:-2]:  # 排除刚添加的用户消息和助手回复
        role = msg.get("role") if isinstance(msg, dict) else None
        content = msg.get("content") if isinstance(msg, dict) else None
        if role and content:
            agent_history.append({"role": role, "content": content})

    emitter = GradioEventEmitter()
    done_event = threading.Event()

    # 在新线程中启动 agent
    t = threading.Thread(
        target=_run_agent_in_thread,
        args=(message, agent_history, emitter, session, session.tools, session.tool_handlers, done_event),
        daemon=True,
    )
    t.start()

    chat_history[-1]["content"] = "正在思考..."
    yield chat_history

    # 逐步 yield 更新
    last_text = ""
    while not done_event.is_set():
        time.sleep(0.15)
        current_text = emitter.get_display_text()
        if current_text != last_text:
            last_text = current_text
            chat_history[-1]["content"] = current_text
            yield chat_history

    # 最终更新
    if emitter.error:
        chat_history[-1]["content"] = (chat_history[-1]["content"] or "") + f"\n\n**错误:** {emitter.error}"
    else:
        final_text = emitter.get_display_text()
        if final_text:
            chat_history[-1]["content"] = final_text

    yield chat_history


def clear_chat():
    """清空对话历史"""
    return [], gr.Textbox(value="")


def build_chat_tab():
    """构建 AI 对话 Tab UI"""
    chatbot = gr.Chatbot(
        height=500,
        elem_classes=["chatbot-container"],
    )

    with gr.Row():
        msg_input = gr.Textbox(
            placeholder="输入消息，与 AI Agent 对话...",
            show_label=False,
            scale=5,
        )
        send_btn = gr.Button("发送", variant="primary", scale=1)
        clear_btn = gr.Button("清空", scale=1)

    # 绑定事件
    msg_input.submit(
        fn=chat_respond,
        inputs=[msg_input, chatbot],
        outputs=[chatbot],
    ).then(
        fn=lambda: "",
        inputs=[],
        outputs=[msg_input],
    )

    send_btn.click(
        fn=chat_respond,
        inputs=[msg_input, chatbot],
        outputs=[chatbot],
    ).then(
        fn=lambda: "",
        inputs=[],
        outputs=[msg_input],
    )

    clear_btn.click(
        fn=clear_chat,
        inputs=[],
        outputs=[chatbot, msg_input],
    )
