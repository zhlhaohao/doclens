# Gradio Web UI 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Gradio 实现 Cortex Web UI，提供浏览器端的搜索和 AI Agent 对话功能。

**Architecture:** 新建 `cortex/web/` 子包，通过 `deps.py` 管理 IndexManager/CortexAgent 单例。搜索 Tab 复用 `score_and_rank` + Markdown 渲染；AI Tab 复用 `CortexAgent.run_query` + 自定义 `GradioEventEmitter` 收集流式文本并 yield 给 `gr.Chatbot`。CLI 添加 `web` 子命令启动 Gradio Server。

**Tech Stack:** Gradio >= 4.0 (gr.Blocks, gr.Chatbot, gr.Markdown, gr.Textbox, gr.Tabs)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `cortex/web/__init__.py` | 包标识 |
| `cortex/web/deps.py` | IndexManager / CortexAgent 单例管理 |
| `cortex/web/search_tab.py` | 搜索 Tab UI 和搜索逻辑 |
| `cortex/web/chat_tab.py` | AI 对话 Tab UI 和流式对话逻辑 |
| `cortex/web/emitter.py` | Gradio 专用的 EventEmitter 实现 |
| `cortex/web/app.py` | Gradio Blocks 应用入口、create_app() |
| `cortex/cortex_cli.py` | 添加 `web` 子命令 |
| `pyproject.toml` | 添加 gradio 依赖 |

---

### Task 1: 添加 gradio 依赖

**Files:**
- Modify: `pyproject.toml:73`

- [ ] **Step 1: 添加 gradio 到 cortex 可选依赖组**

在 `pyproject.toml` 的 `[project.optional-dependencies]` 部分，将 `cortex` 组改为：

```toml
cortex = ["trafilatura>=2.0.0", "gradio>=4.0"]
```

- [ ] **Step 2: 安装 gradio**

Run: `cd D:/github/cortex && .venv/Scripts/pip.exe install "gradio>=4.0"`

- [ ] **Step 3: 验证 gradio 可导入**

Run: `cd D:/github/cortex && .venv/Scripts/python.exe -c "import gradio; print(gradio.__version__)"`

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml
git commit -m "chore: add gradio dependency for web UI"
```

---

### Task 2: 创建 cortex/web/__init__.py 和 deps.py

**Files:**
- Create: `cortex/web/__init__.py`
- Create: `cortex/web/deps.py`

- [ ] **Step 1: 创建 __init__.py**

创建空文件 `cortex/web/__init__.py`。

- [ ] **Step 2: 创建 deps.py**

```python
"""共享依赖管理 — IndexManager 和 CortexAgent 单例"""

import logging
import threading
from pathlib import Path
from typing import Optional

from cortex.config import CortexConfig
from cortex.index_manager import IndexManager

logger = logging.getLogger(__name__)

_idx_manager: Optional[IndexManager] = None
_agent: Optional[object] = None  # CortexAgent，延迟导入避免循环依赖
_lock = threading.Lock()


def get_config() -> CortexConfig:
    """加载 CortexConfig"""
    return CortexConfig.load()


def get_index_manager() -> IndexManager:
    """获取 IndexManager 单例（懒加载 + 线程安全）"""
    global _idx_manager
    if _idx_manager is None:
        with _lock:
            if _idx_manager is None:
                config = get_config()
                _idx_manager = IndexManager(config)
                _idx_manager.load_or_build_index()
                logger.info("IndexManager initialized: %d documents", len(_idx_manager.documents))
    return _idx_manager


def get_agent():
    """获取 CortexAgent 单例（懒加载 + 线程安全）"""
    global _agent
    if _agent is None:
        with _lock:
            if _agent is None:
                from cortex.agent_integration import CortexAgent
                idx = get_index_manager()
                workdir = Path(idx.search_path)
                _agent = CortexAgent(workdir).initialize()
                logger.info("CortexAgent initialized")
    return _agent
```

- [ ] **Step 3: 验证模块可导入**

Run: `cd D:/github/cortex && .venv/Scripts/python.exe -c "from cortex.web.deps import get_config; print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add cortex/web/__init__.py cortex/web/deps.py
git commit -m "feat(web): add shared dependency management module"
```

---

### Task 3: 创建 GradioEventEmitter

**Files:**
- Create: `cortex/web/emitter.py`

Gradio 的 `gr.Chatbot` 流式模式需要一个生成器函数逐步 yield 更新后的历史记录。我们创建一个自定义 EventEmitter，将流式文本和工具调用信息收集到一个可读取的缓冲区中。

- [ ] **Step 1: 创建 emitter.py**

```python
"""Gradio 专用的 EventEmitter — 收集流式文本供 Chatbot generator 消费"""

import json
import logging
from typing import Any, Dict, List, Optional

from planify.streaming.types import StreamEvent, StreamEventType

logger = logging.getLogger(__name__)


class GradioEventEmitter:
    """
    收集流式事件到缓冲区，供 Gradio Chatbot generator 读取。

    不直接打印，而是将文本增量和工具信息追加到内部缓冲区。
    chat_tab 的生成器函数定时读取缓冲区内容来更新 UI。
    """

    def __init__(self):
        self.text_parts: list[str] = []
        self.tool_calls: list[dict] = []
        self.done: bool = False
        self.error: Optional[str] = None

    def get_full_text(self) -> str:
        """获取当前累积的全部文本"""
        return "".join(self.text_parts)

    def get_display_text(self) -> str:
        """获取带工具调用标注的完整显示文本"""
        parts = []
        text = self.get_full_text()
        if text:
            parts.append(text)
        for tc in self.tool_calls:
            name = tc.get("name", "")
            if tc.get("output"):
                output = tc["output"]
                if len(output) > 300:
                    output = output[:300] + "..."
                parts.append(f"\n\n**🔧 {name}**\n```\n{output}\n```")
        return "".join(parts)

    async def emit(self, event: StreamEvent) -> None:
        if event.event_type == StreamEventType.TEXT:
            content = event.data.get("content", "")
            if content:
                self.text_parts.append(content)

        elif event.event_type == StreamEventType.TOOL_CALL:
            if event.data.get("is_complete", False):
                self.tool_calls.append({
                    "name": event.data.get("name", ""),
                    "input": event.data.get("input", {}),
                })

        elif event.event_type == StreamEventType.TOOL_RESULT:
            name = event.data.get("name", "")
            output = event.data.get("output", "")
            is_error = event.data.get("is_error", False)
            # 更新最后一个同名工具调用的输出
            for tc in reversed(self.tool_calls):
                if tc["name"] == name and "output" not in tc:
                    tc["output"] = output
                    break
            else:
                # 没找到对应工具调用，单独记录
                self.tool_calls.append({"name": name, "output": output, "is_error": is_error})

        elif event.event_type == StreamEventType.DONE:
            self.done = True

        elif event.event_type == StreamEventType.ERROR:
            self.error = event.data.get("error", "未知错误")
            self.done = True

    # ---- EventEmitter 协议便捷方法 ----

    async def emit_text(self, content: str, is_end: bool = False) -> None:
        await self.emit(StreamEvent(
            event_type=StreamEventType.TEXT,
            data={"content": content, "is_end": is_end},
        ))

    async def emit_tool_call(
        self,
        tool_use_id: str,
        name: str,
        input_data: Dict[str, Any],
        is_complete: bool = False,
    ) -> None:
        await self.emit(StreamEvent(
            event_type=StreamEventType.TOOL_CALL,
            data={
                "tool_use_id": tool_use_id,
                "name": name,
                "input": input_data,
                "is_complete": is_complete,
            },
        ))

    async def emit_tool_result(
        self,
        tool_use_id: str,
        name: str,
        output: str,
        is_error: bool = False,
    ) -> None:
        await self.emit(StreamEvent(
            event_type=StreamEventType.TOOL_RESULT,
            data={
                "tool_use_id": tool_use_id,
                "name": name,
                "output": output,
                "is_error": is_error,
            },
        ))

    async def emit_ask_user(
        self,
        request_id: str,
        question: str,
        input_type: str = "text",
        options: Optional[List[Dict[str, str]]] = None,
        default: Optional[str] = None,
    ) -> None:
        # Gradio 模式暂不支持 ask_user，记录日志
        logger.warning("ask_user not supported in Gradio mode: %s", question)

    async def emit_done(self, session_id: str, summary: Optional[str] = None) -> None:
        await self.emit(StreamEvent(event_type=StreamEventType.DONE, data={"session_id": session_id}))

    async def emit_error(self, error: str, code: Optional[str] = None) -> None:
        await self.emit(StreamEvent(event_type=StreamEventType.ERROR, data={"error": error, "code": code}))
```

- [ ] **Step 2: 验证可导入**

Run: `cd D:/github/cortex && .venv/Scripts/python.exe -c "from cortex.web.emitter import GradioEventEmitter; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add cortex/web/emitter.py
git commit -m "feat(web): add GradioEventEmitter for streaming AI responses"
```

---

### Task 4: 创建搜索 Tab

**Files:**
- Create: `cortex/web/search_tab.py`

搜索 Tab 使用 `gr.Textbox` + `gr.Button` + `gr.Markdown` 实现搜索功能，复用 `score_and_rank` 进行评分排序。

- [ ] **Step 1: 创建 search_tab.py**

```python
"""搜索 Tab — FTS5/关键词/正则搜索文档，Markdown 渲染结果"""

import gradio as gr

from cortex.scoring import tokenize_query
from cortex.scoring_pipeline import score_and_rank


def _highlight_markdown(text: str, keywords: list[str]) -> str:
    """在文本中高亮关键词（Markdown 加粗）"""
    if not keywords or not text:
        return text
    result = text
    for kw in keywords:
        if not kw:
            continue
        # 大小写不敏感替换，用加粗标记
        import re
        pattern = re.compile(re.escape(kw), re.IGNORECASE)
        result = pattern.sub(lambda m: f"**{m.group()}**", result)
    return result


def _truncate_text(text: str, max_len: int = 300) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."


def _format_score_bar(score: float) -> str:
    """格式化评分条"""
    pct = int(score * 100)
    filled = int(score * 10)
    bar = "█" * filled + "░" * (10 - filled)
    return f"{bar} {pct}%"


def _render_markdown_results(
    results: list[tuple],
    query: str,
    query_words: list[str],
    path_map: dict[str, str],
    max_results: int = 20,
    source: str = "fts",
) -> str:
    """将搜索结果格式化为 Markdown"""
    if not results:
        return f"### 未找到包含 '{query}' 的结果"

    source_label = " (LIKE)" if source == "like" else " (ripgrep)" if source == "ripgrep" else ""
    lines = [f"### 搜索结果: \"{query}\" ({len(results)} 条{source_label})", ""]

    display_items = results[:max_results]
    for i, item in enumerate(display_items, 1):
        if source == "like":
            doc_id = item["doc_id"]
            node = {"title": item.get("title", ""), "text": item.get("summary", "")}
            matched = 1
            composite = item.get("fts_score", 0.0)
        elif source == "ripgrep":
            doc_id, node, matched, prox, fts = item
            composite = 0.0
        else:
            composite, (doc_id, node, matched, prox, fts) = item

        path = path_map.get(doc_id, "")
        path_display = path.replace("\\", "/")
        line_start = node.get("line_start")
        if line_start is not None:
            path_display += f":{line_start}"

        # 标题行
        lines.append(f"**{i}. {path_display}**")
        lines.append("")

        # 内容片段
        display_text = node.get("text", "") or ""
        if display_text:
            snippet = _select_context_lines(display_text, query_words)
            snippet = _truncate_text(snippet)
            snippet = _highlight_markdown(snippet, query_words)
            lines.append(f"> {snippet}")
            lines.append("")

        # 评分行
        if source == "fts":
            lines.append(f"评分: {_format_score_bar(composite)}  |  匹配: {matched}/{len(query_words)} 词")
        else:
            lines.append(f"匹配: {matched}/{len(query_words)} 词")

        lines.append("---")

    return "\n".join(lines)


def _select_context_lines(text: str, query_words: list[str], max_lines: int = 5) -> str:
    """智能选择包含关键词的上下文行"""
    lines = text.split("\n")
    kw_lower = [kw.lower() for kw in query_words if kw]

    # 计算每行的关键词命中数
    line_scores = []
    for j, line in enumerate(lines):
        line_lower = line.lower()
        cnt = sum(1 for w in kw_lower if w in line_lower)
        if cnt > 0:
            line_scores.append((cnt, j, line))

    if not line_scores:
        # 无匹配行，取前几个非空行
        selected = []
        for line in lines:
            if line.strip():
                selected.append(line.strip())
            if len(selected) >= max_lines:
                break
        return "\n".join(selected)

    # 按命中数排序取最佳锚点
    line_scores.sort(key=lambda x: -x[0])
    best_indices = sorted(set(j for _, j, _ in line_scores[:max_lines]))
    return "\n".join(lines[j].strip() for j in best_indices if lines[j].strip())


def do_search(query: str) -> str:
    """执行搜索并返回 Markdown 结果"""
    if not query or not query.strip():
        return "请输入搜索关键词"

    query = query.strip()

    from cortex.web.deps import get_index_manager
    idx = get_index_manager()

    # 分词
    query_words = tokenize_query(query)
    if not query_words:
        query_words = [w.strip() for w in query.split() if w.strip()]

    # FTS 搜索
    nodes, docs = idx.search(query)

    # 评分排序
    result = score_and_rank(nodes, docs, query, query_words, idx)

    if result.source == "like":
        return _render_markdown_results(
            result.like_raw, query, query_words, idx.path_map,
            max_results=idx.max_results, source="like",
        )
    elif result.source == "ripgrep":
        return _render_markdown_results(
            result.results, query, query_words, idx.path_map,
            max_results=idx.max_results, source="ripgrep",
        )
    else:
        return _render_markdown_results(
            result.results, query, query_words, idx.path_map,
            max_results=idx.max_results, source="fts",
        )


def build_search_tab():
    """构建搜索 Tab UI"""
    with gr.Row():
        search_input = gr.Textbox(
            placeholder="输入搜索关键词...",
            show_label=False,
            scale=4,
        )
        search_btn = gr.Button("搜索", variant="primary", scale=1)

    search_output = gr.Markdown(
        value="输入关键词开始搜索",
        elem_id="search-results",
    )

    # 绑定事件：回车或按钮点击都触发搜索
    search_input.submit(
        fn=do_search,
        inputs=[search_input],
        outputs=[search_output],
    )
    search_btn.click(
        fn=do_search,
        inputs=[search_input],
        outputs=[search_output],
    )
```

- [ ] **Step 2: 验证可导入**

Run: `cd D:/github/cortex && .venv/Scripts/python.exe -c "from cortex.web.search_tab import build_search_tab; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add cortex/web/search_tab.py
git commit -m "feat(web): add search tab with Markdown result rendering"
```

---

### Task 5: 创建 AI 对话 Tab

**Files:**
- Create: `cortex/web/chat_tab.py`

AI 对话 Tab 使用 `gr.Chatbot` 的流式模式。核心挑战是将 `CortexAgent.run_query` 的同步阻塞调用包装为 Gradio 兼容的生成器。

`CortexAgent.run_query` 内部创建新 event loop 并运行 `agent.run_stream`。我们需要传入 `GradioEventEmitter` 替代 CLI/TUI emitter。但 `run_query` 的 `emitter_callbacks` 参数只接受 TUI 回调格式。

解决方案：直接使用 `StreamingAgent` + `GradioEventEmitter` 在新线程中运行，生成器从 emitter 缓冲区读取更新。

- [ ] **Step 1: 创建 chat_tab.py**

```python
"""AI 对话 Tab — 流式 AI Agent 对话"""

import asyncio
import json
import logging
import threading
import uuid
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

    Gradio 的 gr.Chatbot 流式模式要求此函数 yield 更新后的 chat_history。
    chat_history 格式: list of [user_msg, assistant_msg] pairs（或 None）
    """
    if not message or not message.strip():
        yield chat_history
        return

    from cortex.web.deps import get_agent
    from cortex.web.emitter import GradioEventEmitter

    agent = get_agent()
    session = agent.session

    # 准备历史（复制一份，agent 会修改）
    history = list(session.messages) if hasattr(session, 'messages') else []
    # 从 chat_history 重建 history
    agent_history = []
    for pair in chat_history:
        if pair[0] is not None:
            agent_history.append({"role": "user", "content": pair[0]})
        if pair[1] is not None:
            agent_history.append({"role": "assistant", "content": pair[1]})

    emitter = GradioEventEmitter()
    done_event = threading.Event()

    # 在新线程中启动 agent
    t = threading.Thread(
        target=_run_agent_in_thread,
        args=(message, agent_history, emitter, session, session.tools, session.tool_handlers, done_event),
        daemon=True,
    )
    t.start()

    # 先添加用户消息和空的 assistant 回复
    chat_history.append([message, ""])

    # 逐步 yield 更新
    import time
    last_text = ""
    while not done_event.is_set():
        time.sleep(0.15)
        current_text = emitter.get_display_text()
        if current_text != last_text:
            last_text = current_text
            chat_history[-1][1] = current_text
            yield chat_history

    # 最终更新
    if emitter.error:
        chat_history[-1][1] = (chat_history[-1][1] or "") + f"\n\n**错误:** {emitter.error}"
    else:
        final_text = emitter.get_display_text()
        if final_text:
            chat_history[-1][1] = final_text

    yield chat_history


def clear_chat():
    """清空对话历史"""
    return [], ""


def build_chat_tab():
    """构建 AI 对话 Tab UI"""
    chatbot = gr.Chatbot(
        height=500,
        show_copy_button=True,
        type="messages",
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
```

- [ ] **Step 2: 验证可导入**

Run: `cd D:/github/cortex && .venv/Scripts/python.exe -c "from cortex.web.chat_tab import build_chat_tab; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add cortex/web/chat_tab.py
git commit -m "feat(web): add AI chat tab with streaming support"
```

---

### Task 6: 创建 Gradio 应用入口

**Files:**
- Create: `cortex/web/app.py`

- [ ] **Step 1: 创建 app.py**

```python
"""Gradio Web UI 应用入口"""

import gradio as gr


def create_app() -> gr.Blocks:
    """创建 Cortex Gradio 应用"""
    from cortex.web.search_tab import build_search_tab
    from cortex.web.chat_tab import build_chat_tab

    with gr.Blocks(
        title="Cortex",
        theme=gr.themes.Soft(),
        css="""
        #search-results { min-height: 400px; }
        """,
    ) as app:
        gr.Markdown("# Cortex 文档检索")
        with gr.Tabs():
            with gr.Tab("🔍 搜索"):
                build_search_tab()
            with gr.Tab("🤖 AI 对话"):
                build_chat_tab()

    return app


def launch_app(port: int = 7860, host: str = "127.0.0.1", share: bool = False):
    """启动 Gradio Server"""
    app = create_app()
    app.launch(server_name=host, server_port=port, share=share)
```

- [ ] **Step 2: 验证可导入**

Run: `cd D:/github/cortex && .venv/Scripts/python.exe -c "from cortex.web.app import create_app; print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add cortex/web/app.py
git commit -m "feat(web): add Gradio app entry point"
```

---

### Task 7: 添加 `web` CLI 子命令

**Files:**
- Modify: `cortex/cortex_cli.py:751-881` (_build_parser 函数)
- Modify: `cortex/cortex_cli.py:1109-1187` (main 函数)

- [ ] **Step 1: 在 `_build_parser` 中添加 web 子命令**

在 `cortex/cortex_cli.py` 的 `_build_parser()` 函数中，在 `grep_parser.set_defaults(func=_cli_grep)` 之后、`return parser` 之前，添加：

```python
    # cortex web [--port PORT] [--host HOST] [--share]
    web_parser = sub.add_parser(
        "web", help="Launch Gradio Web UI"
    )
    web_parser.add_argument(
        "--port", type=int, default=7860,
        help="Server port (default: 7860)",
    )
    web_parser.add_argument(
        "--host", type=str, default="127.0.0.1",
        help="Server host (default: 127.0.0.1)",
    )
    web_parser.add_argument(
        "--share", action="store_true",
        help="Create a public Gradio share link",
    )
    web_parser.set_defaults(func=_cli_web)
```

- [ ] **Step 2: 添加 `_cli_web` 处理函数**

在 `_cli_webfetch` 函数之后添加：

```python
def _cli_web(args, config, idx):
    """Handle `cortex web` — launch Gradio Web UI."""
    from planify.core.logging_config import setup_logging
    setup_logging()

    from cortex.web.app import launch_app
    launch_app(port=args.port, host=args.host, share=args.share)
```

- [ ] **Step 3: 验证子命令注册**

Run: `cd D:/github/cortex && .venv/Scripts/python.exe -m cortex web --help`

- [ ] **Step 4: Commit**

```bash
git add cortex/cortex_cli.py
git commit -m "feat(web): add 'cortex web' CLI subcommand"
```

---

### Task 8: 端到端测试 — 搜索 Tab

**Files:**
- No new files

- [ ] **Step 1: 准备测试数据**

确保 `test_work_dir/` 下有已索引的文档（如果之前已建过索引则跳过）。

Run: `cd D:/github/cortex/test_work_dir && ../.venv/Scripts/python.exe -m cortex index`

- [ ] **Step 2: 启动 Gradio Web UI**

Run: `cd D:/github/cortex/test_work_dir && ../.venv/Scripts/python.exe -m cortex web --port 7860`

- [ ] **Step 3: 浏览器测试搜索**

打开 `http://127.0.0.1:7860`，在搜索 Tab 输入关键词并验证：
- 搜索结果以 Markdown 格式显示
- 文件路径、行号正确
- 关键词高亮（加粗）
- 评分条显示

- [ ] **Step 4: 修复发现的问题（如有）**

---

### Task 9: 端到端测试 — AI 对话 Tab

**Files:**
- No new files

- [ ] **Step 1: 测试 AI 对话**

在同一个 Gradio 实例中，切换到 AI 对话 Tab：
- 输入简单问题验证流式输出
- 验证 Agent 能调用知识库工具
- 验证清空对话功能

- [ ] **Step 2: 修复发现的问题（如有）**

- [ ] **Step 3: 最终 Commit**

如果有修复：
```bash
git add cortex/web/
git commit -m "fix(web): fix issues found during e2e testing"
```
