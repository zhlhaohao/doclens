"""Gradio Web UI 应用入口"""

import gradio as gr

from cortex.web.theme import get_bento_theme, CSS


def create_app() -> gr.Blocks:
    """创建 Cortex Gradio 应用"""
    from cortex.web.search_tab import build_search_tab
    from cortex.web.chat_tab import build_chat_tab

    with gr.Blocks(title="Cortex") as app:
        with gr.Tabs():
            with gr.Tab("搜索"):
                build_search_tab()
            with gr.Tab("AI 对话"):
                build_chat_tab()

    return app


def launch_app(port: int = 7860, host: str = "127.0.0.1", share: bool = False):
    """启动 Gradio Server"""
    app = create_app()
    app.launch(
        server_name=host,
        server_port=port,
        inbrowser=True,
        share=share,
        theme=get_bento_theme(),
        css=CSS,
    )
