# doclens TUI vs Web GUI AI 对话功能对比

## 一、核心结论速览

两者**共享同一套 Agent 内核**（`CortexAgent` + planify `StreamingAgent` + `kb_tools`），差异全部集中在**传输层、上下文管理、持久化和前端渲染**。最关键的反差是：

> **TUI 有多轮对话记忆但无持久化；GUI 有持久化但无多轮对话记忆。**

- TUI 把 `_agent_history` 列表每轮回传给 LLM，AI 记得本会话内说过什么——但一退出就丢了。
- GUI 把每条问答完整写入 SQLite，前端能列出/恢复历史——但后端每次请求 `messages=[]`，AI **在同一会话里也记不住上一轮问答**。

---

## 二、完整调用链对比

### TUI 调用链

```
InputBox 提交 (input_box.py:175)
  → on_input_box_submitted (app.py:265)
  → parse_input: "/ai xxx" 或自然语言 → ("ai", ...)  (commands.py:161-177)
  → _cmd_ai (app.py:732) → run_worker(_do_ai_query, thread=True)
  → CortexAgent.run_query(query, history, callbacks)  (agent_integration.py:299)
  → StreamingAgent.run_stream(history, query, session_id)  (runner.py:116)
      ↻ 注入 skills+agent.md → microcompact → client.messages.stream()
        → 工具循环 (search_kb/read_document/grep) → auto_compact
  → TUIEventEmitter 回调 → content.write_streaming (缓冲)
  → on_done → content.finish_streaming() 一次性写入
```

### GUI 调用链

```
chat-view._submit (chat-view.ts:109)
  → chatStream({message, session_id}) (api/chat.ts)
  → streamSSE: POST /api/chat + ReadableStream 解析  (api/client.ts:34)
  → FastAPI chat() (chat.py:107)
  → _stream_agent_response: 新 daemon 线程跑同步 agent  (chat.py:24)
      → GradioEventEmitter 缓冲 text_parts  (_chat_emitter.py:14)
      → StreamingAgent.run_stream([], message, session_id)  ⚠️ messages=[]
      → _feed() 每 50ms 取增量 → asyncio.Queue → 主协程 yield
  → EventSourceResponse SSE: token / done / error  (chat.py:108)
  → 前端 for await 实时更新最后一条 assistant 消息
  → 完成后 appendSession → SQLite 持久化  (chat-view.ts:156)
```

---

## 三、详细对比表格

### 1. 入口与触发

| 维度 | TUI | GUI |
|------|-----|-----|
| 触发方式 | `/ai`、`/llm`、`/agent` 斜杠命令 + **自然语言直通**（非 `/` 开头且 ≥3 字符） | 聊天视图输入框，`Enter`（单行）或 `Ctrl/Cmd+Enter`（多行） |
| 命令解析 | `parse_input` (`commands.py:161-177`) | 无命令系统，纯消息流 |
| 自然语言路由 | ✅ 默认进 AI | ❌ 必须在 chat 视图 |

### 2. Agent 实现（高度共享）

| 维度 | TUI | GUI |
|------|-----|-----|
| Agent 类 | `CortexAgent` (`agent_integration.py:113`) | **同一类**，通过 `deps.get_agent()` 单例注入 (`deps.py:65`) |
| LLM 调用 | planify `StreamingAgent.run_stream` (`runner.py:116`) | **完全相同** |
| 底层 SDK | Anthropic `messages.stream()` (`runner.py:405`) | **完全相同** |
| 系统提示词 | `SystemPromptBuilder` (`prompts.py:182`) | **完全相同** |
| 工具集 | `kb_tools` + `grep_tools` + basic_tools (`agent_integration.py:217-233`) | **完全相同**（复用单例） |

### 3. 流式输出（关键差异）

| 维度 | TUI | GUI |
|------|-----|-----|
| 底层传输 | 进程内回调 (`TUIEventEmitter`) | HTTP SSE (`EventSourceResponse`) |
| 文本显示 | **伪流式**：token 流入 `_streaming_buffer`，全部完成后 `finish_streaming()` 一次性写出 (`content_area.py:99-111`) | **真流式**：每个 token SSE 事件实时追加到气泡 (`chat-view.ts:143-152`) |
| 工具调用显示 | 实时折叠摘要 `⚙ name(args) → result` (`content_area.py:113-127`) | ❌ 不展示工具调用过程，只看到最终文本 |
| 思考反馈 | 盲文旋转帧 `⠋⠙⠹...` 动画 (`thinking_indicator.py:22`) | 气泡内显示"思考中..."占位 (`chat-message.ts:47`) |
| Emitter 实现 | `TUIEventEmitter`（回调驱动） (`emitter.py:556`) | `GradioEventEmitter`（缓冲收集） (`_chat_emitter.py:14`) |

### 4. 上下文管理 ⭐（最关键差异）

| 维度 | TUI | GUI |
|------|-----|-----|
| 多轮上下文 | ✅ `_agent_history: list[dict]` 每轮回传 LLM (`app.py:89,807`) | ❌ 后端 `sa.run_stream([], message, ...)` **messages 恒为空** (`chat.py:87`) |
| `history` 字段 | 直接使用 | `ChatRequest.history` 定义了但**前端不发、后端不读** (`models/chat.py:10`) |
| `session_id` | 每次启动随机 `uuid[:8]` (`agent_integration.py:273`) | 前端传了，但后端用的是**全局单例** `agent.session.session_id`，前端值被忽略 (`chat.py:24,87`) |
| RAG 方式 | **隐式工具调用 RAG**：LLM 自主决定调用 `search_kb`/`read_document`/`grep` | **完全相同**（共享工具） |
| Compact 压缩 | `/compact` 手动 + token>100k 自动压缩 (`compact.py:65`) | 后端 StreamingAgent 内部仍有 microcompact/auto_compact，但因单轮调用实际几乎不触发跨轮压缩 |
| 实际效果 | 同会话内 AI 记得之前的对话 | **AI 每条消息都是独立单轮，不记得本会话内任何历史** |

### 5. 历史对话持久化 ⭐（另一关键差异）

| 维度 | TUI | GUI |
|------|-----|-----|
| 存储介质 | **纯内存**（退出即丢） | **SQLite** `.cortex/sessions.db` (`sessions_store.py`) |
| Schema | `list[dict]` | `sessions` + `session_items`（WAL + FK CASCADE）(`sessions_store.py:47-70`) |
| 历史列表 UI | ❌ 无 | ✅ `<history-list>` + `<history-item>` |
| 恢复历史会话 | ❌ 不可能 | ✅ 点击加载，反序列化到 store (`chat-view.ts:173`) |
| 转存审计 | 仅 `/compact` 时把原文存 `.cortex/transcripts/transcript_*.jsonl`（不恢复） | 每轮自动持久化 (`chat-view.ts:156`) |
| 输入历史 | 仅命令字符串存 `~/.cortex/cli_history/history.json` (`input_box.py:58`) | 不单独持久化输入 |
| 清空 | `/clear` 清内存 | "清空"按钮 → `DELETE /api/sessions?type=chat` |
| 单条删除/重命名 | N/A | 后端有 `deleteSession` API，但**前端 chat 视图未调用**，只支持全清 |

### 6. 界面渲染

| 维度 | TUI | GUI |
|------|-----|-----|
| 渲染框架 | Textual `RichLog` + Rich (`content_area.py:10`) | Lit Web Components (`chat-message.ts`) |
| Markdown | 基础 Rich `highlight=True`（数字/字符串高亮，非完整 md） | ❌ **纯文本 `pre-wrap`，无任何 Markdown 渲染** |
| 代码高亮 | Rich 基础高亮 | ❌ 无 |
| 代码块复制 | ❌ 无 | ❌ 无 |
| AI 文本配色 | 统一 `#c0caf5` 淡蓝白 | 灰色气泡，左对齐 |
| 工具详情展开 | ✅ **F2** 弹 `ToolDetailScreen` 模态窗 (`tool_detail_screen.py`) | ❌ 无 |

### 7. 中断与控制

| 维度 | TUI | GUI |
|------|-----|-----|
| 中断生成 | ✅ **ESC 双重中断**：`ctypes.PyThreadState_SetAsyncExc` 强杀线程 + `_interrupt_event` 优雅停 (`app.py:1060,1094`) | ❌ **无法中断**：前端无 `AbortController`，后端无中断端点，streaming 时 input 被 disabled (`chat-view.ts:239`) |
| 取消后行为 | 问题回填输入框，UI 复位 | N/A |
| 清屏 | `Ctrl+L` | N/A |

### 8. 其他交互能力

| 维度 | TUI | GUI |
|------|-----|-----|
| Agent 子命令 | `/compact` `/clear` `/tasks` `/team` `/inbox` `/failed` `/clearfailed` (`agent_integration.py:364`) | ❌ 无对应 UI |
| 交互式追问 | 支持 `ask_user`（planify 内置） | ❌ `_chat_emitter.py` 明确注释 **SSE 模式不支持 ask_user** |
| 多行输入 | ✅（取决于终端） | ✅ `<input-box>` multiline 模式 |
| 鼠标选择文字 | `F9` 切换鼠标模式后可选中复制 | 原生浏览器选择 |

---

## 四、关键观察与建议

**1. GUI 的"假多轮"问题**（最值得关注）
GUI 有完整的历史持久化，但 `chat.py:87` 把 `messages` 硬编码为 `[]`，且全局单例 `agent.session.session_id` 与前端 `session_id` 完全脱钩。这导致：
- 用户在同一个会话里问"刚才那个再说一遍" → AI 完全不知道。
- 历史只对**用户**有意义（可回看），对 **AI** 没有意义。

修复方向：把前端 `store.chat.messages` 序列化为 `history` 传到后端，后端用前端 `session_id` 维护 per-session 的 `CortexAgent`（或 messages 缓存），调用 `run_stream(history, message, ...)`。`ChatRequest` 已预留 `history` 字段，是一处未接通的半成品。

**2. TUI 的"假流式"问题**
底层是 token-by-token 流式接收，但 `write_streaming` 只缓冲不写，最终 `finish_streaming()` 一次性吐出。如果想要逐字效果，需要改成 Rich 的追加式写入（但要小心 Textual 的 in-place 修改约束，这正是当前缓冲设计的规避原因）。

**3. 两边 RAG 完全等价**
不存在预注入式 RAG，统一是 LLM 主动调 `search_kb` / `read_document` / `grep` 的 tool-use 模式，工具定义和返回的 XML 结构完全共享。这是两边最一致的部分。

**4. 渲染都不完整**
TUI 有基础高亮、GUI 干脆纯文本——奇怪的是 GUI 的 `md-viewer` 组件（用在搜索预览）已经具备 Markdown 能力，却没有接到 `chat-message` 上。把 `chat-message.ts:47` 的 `${this.message.content}` 换成 `<md-viewer>` 即可低成本升级。

**5. 共享内核、差异外层**
所有 AI 能力（工具、提示词、压缩、Session）都在 `doclens/agent_integration.py` + planify 一层，TUI 与 GUI 的差别本质上只是「谁来驱动 Emitter / 怎么传上下文 / 怎么存历史」这三件事。
