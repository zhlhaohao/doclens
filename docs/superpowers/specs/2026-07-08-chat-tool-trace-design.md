# AI 对话「工具调用过程」展示设计

> 日期：2026-07-08
> 范围：doclens Web GUI（`doclens/web_v2`）AI 对话页面
> 状态：已与用户确认设计方向，待编写实现计划

## 1. 背景与目标

doclens GUI 的 AI 对话页面当前只流式输出最终回答文本，**看不到 agent 的中间过程**——调用了哪些工具、传了什么参数、每个工具返回了什么结果。用户无法判断「AI 是怎么得出这个结论的」，也感知不到 AI 正在做什么（卡住还是在工作）。

**目标**：在助手消息里展示 agent 的工具调用步骤，满足三条硬约束：

- 不干扰用户注意力
- 不占据过多屏幕空间
- 不影响正常问答内容的展现

**「思考过程」的定义**：指 agent 的**工具调用步骤透明度**（工具名 / 参数 / 结果 / 状态），而非 LLM 的 chain-of-thought 推理文本。后者需改动 planify 启用 Anthropic extended thinking，成本高且噪声大，不在本次范围。

## 2. 现状分析（问题定位）

数据流链路：

```
StreamingAgent → GradioEventEmitter → chat.py SSE → chat.ts → chat-view → chat-message
```

**根因**：数据其实在源头已经采集，但在 `chat.py` 被丢弃。

- `planify/streaming/runner.py` 的 `StreamingAgent` 在 agent 循环中通过 emitter 发出三类结构化事件：`TEXT`（文本增量）、`TOOL_CALL`（含参数）、`TOOL_RESULT`（含输出）。
- `doclens/web_v2/api/_chat_emitter.py` 的 `GradioEventEmitter` 把工具调用收集进 `self.tool_calls`，还提供 `get_display_text()` 能拼成 markdown。
- **但** `doclens/web_v2/api/chat.py` 的 `_feed()` 协程只轮询 `emitter.get_full_text()`（纯文本增量），SSE 只发 `event: token`。工具事件在这里被全部丢弃，前端永远收不到。

前端同理：`api/chat.ts` 只处理 `token`/`done`/`error`；`ChatMessage` 类型只有 `{ role, content }`；`chat-message.ts` 的 `.thinking` 样式只是空内容的「思考中...」占位。

## 3. 设计决策（均已与用户确认）

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 思考过程指什么 | Agent 工具步骤透明度 | 数据后端已齐，投入产出比最高 |
| 2 | 展示形态 | 流式逐条内联 → 完成后自动折叠汇总 | 流式中看得见进度，完成后收起不干扰 |
| 3 | 历史会话回看 | 持久化工具步骤 | 复盘「AI 查了哪些文档」有真实价值 |
| 4 | 全局开关 | 不加，固定行为 | 默认折叠本身即控制，YAGNI |
| 5 | 折叠块位置 | 嵌在助手气泡内顶部（虚线分隔正文） | 视觉最整体，工具步骤天然属于该消息 |
| 6 | 进行中视觉强度 | 主色 spinner + 淡青背景 +「正在...」文案 | 信息量最大，让用户清楚感知进度 |

## 4. 详细设计

### 4.1 后端

#### 4.1.1 SSE 事件协议扩展（`doclens/web_v2/api/chat.py`）

现状只有 `event: token`。新增两种事件：

| SSE event | data 字段 | 触发时机 |
|-----------|-----------|----------|
| `token` | `{text}` | 文本增量（保持不变） |
| `tool_call` | `{tool_use_id, name, input, is_complete}` | 工具参数解析完成 |
| `tool_result` | `{tool_use_id, name, output, is_error}` | 工具执行返回 |
| `done` | `{}` | 结束（保持不变） |
| `error` | `{detail}` | 异常（保持不变） |

**实现方式（最小改动）**：扩展 `_feed()` 协程的轮询逻辑——除读文本增量外，用游标 `tool_cursor` 检测 `emitter.tool_calls` 列表的新增项：

- 新出现的 `is_complete=True` 调用 → 投递一条 `tool_call` 事件
- 该调用被回填 `output` 后 → 投递一条 `tool_result` 事件

**不改动现有的线程 + 独立 event loop 架构**，规避跨 loop 使用 `asyncio.Queue` 的潜在不安全问题。`GradioEventEmitter` 本身无需改动（它已经在正确收集 `tool_calls`）。

`event_stream()` 内部按事件类型分发 SSE event 名：

```python
async for ev in _stream_agent_response(req.message, req.session_id):
    if ev.type == "token":
        yield {"event": "token", "data": json.dumps({"text": ev.text})}
    elif ev.type == "tool_call":
        yield {"event": "tool_call", "data": json.dumps(ev.payload)}
    elif ev.type == "tool_result":
        yield {"event": "tool_result", "data": json.dumps(ev.payload)}
yield {"event": "done", "data": "{}"}
```

（`_stream_agent_response` 的 yield 由纯字符串改为带类型的小结构体，内部承载 `{type, text?, payload?}`。）

#### 4.1.2 工具结果截断

- StreamingAgent 已截断工具输出到 5000 字符（`StreamingConfig.truncate_tool_output`），保留。
- 前端再做行级二次截断（默认显示前 5 行 + 「展开全部」）。

#### 4.1.3 持久化存储格式扩展（`doclens/web_v2/sessions_store.py` + 前端 `appendSession`）

`message_ai` 的 payload 从 `{content}` 扩展为：

```json
{
  "content": "回答正文 markdown",
  "tool_calls": [
    {
      "tool_use_id": "toolu_...",
      "name": "search",
      "input": { "query": "python 异步" },
      "output": "找到 3 个文档...",
      "is_error": false,
      "duration_ms": 1200
    }
  ]
}
```

**向后兼容**：`sessions_store` 读取时 `tool_calls` 不存在则视为空数组；前端加载历史会话时同样降级为只显示 `content`。老会话不崩、不丢内容。

> 注意：`duration_ms` 需要后端在 emitter/runner 层补采集（记录 `tool_call` 到 `tool_result` 的时间差）。若实现成本偏高，可作为 v1.1 延后，前端对缺失值降级显示（不显示耗时）。

### 4.2 前端

#### 4.2.1 数据模型（`doclens/web_v2/frontend/src/state/types.ts`）

```ts
export interface ToolStep {
  tool_use_id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;          // 结果返回前为 undefined（进行中）
  is_error?: boolean;
  duration_ms?: number;
  status: "running" | "done" | "error";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tool_steps?: ToolStep[];  // 新增，仅 assistant 消息有
}
```

#### 4.2.2 SSE client（`doclens/web_v2/frontend/src/api/chat.ts`）

在原有 `token`/`done`/`error` 基础上新增两种 yield：

```ts
yield { type: "tool_call", tool_use_id, name, input, is_complete };
yield { type: "tool_result", tool_use_id, name, output, is_error };
```

#### 4.2.3 chat-view.ts 流程（`_submit`）

流式事件处理（**不可变更新**，遵循全局 immutability 规范）：

- `tool_call`（`is_complete=true`）→ 用 spread 给当前 assistant 消息追加一个 `status: "running"` 的 `ToolStep`
- `tool_result` → 用 spread 更新对应 `tool_use_id` 的步骤为 `done`/`error`，写入 `output`/`is_error`
- `token` → 照旧拼接到 `content`
- **思考过程块的展开/折叠状态**：
  - 进入 focus、添加 assistant 占位时：思考过程块**默认展开**（用户看得见进度）
  - 收到第一个 `token`（回答文本开始流式）时：**自动折叠**为摘要行
- 流式结束后：`tool_steps` 随 `content` 一起调用 `appendSession` 持久化
- 加载历史会话（`_loadSession`）：把 payload 里的 `tool_calls` 映射成 `tool_steps`（`status` 一律置为 `done`/`error`）

#### 4.2.4 chat-message.ts + 新子组件 `<chat-tool-trace>`

为避免 `chat-message.ts`（当前 ~125 行）膨胀，把「思考过程块」**拆成独立子组件** `doclens/web_v2/frontend/src/components/chat-tool-trace.ts`（符合 many-small-files 规范）。

`chat-message.ts` 的助手气泡改为：

```html
<div class="bubble">
  ${msg.tool_steps?.length ? html`<chat-tool-trace .steps=${msg.tool_steps}></chat-tool-trace>` : null}
  ${msg.tool_steps?.length ? html`<div class="sep"></div>` : null}
  ${this.renderBubble(msg.content)}
</div>
```

`<chat-tool-trace>` 渲染规则：

- **折叠态**：`▸ 🧠 思考过程 · N 步 · 用时 Xs`（一行，`N` 为步骤数；进行中时显示「· 进行中」）
- **展开态**：`▾ 🧠 ...` + 步骤列表
- **单步排版**：
  - 头部：`图标 · 工具名 · 耗时 · 状态`（图标按工具名映射，如 search→🔍、read_document→📄，未映射的用 🔧）
  - 参数摘要：`key: value` 灰色等宽小字（过长截断）
  - 结果区：默认显示前 5 行 + 「展开全部 (N 行) ⌄」二次折叠
- **进行中步骤**（`status: "running"`）：主色填充 spinner（CSS `@keyframes spin`）+ 淡青背景（`--cortex-primary-soft` `#F0FDFA`）+ 主色边框 + 「正在 {动作}...」文案。{动作} 按工具名映射（如 `search`→「正在搜索」、`read_document`→「正在读取」），未映射的降级为「正在调用...」
- **错误步骤**（`status: "error"`）：红色边框（`--cortex-danger` `#DC2626`）+ danger 色状态标签，仍展示 output
- **完成步骤**：`✓` 用 `--cortex-success` `#10B981`

无障碍：spinner 动画用 `@media (prefers-reduced-motion: reduce)` 降级为静态图标。

### 4.3 数据契约汇总

**SSE 事件序列示例**（一次带 2 个工具的对话）：

```
event: tool_call   data: {"tool_use_id":"t1","name":"search","input":{"query":"python 异步"},"is_complete":true}
event: tool_result data: {"tool_use_id":"t1","name":"search","output":"找到 3 个文档...","is_error":false}
event: tool_call   data: {"tool_use_id":"t2","name":"read_document","input":{"path":"docs/async.md"},"is_complete":true}
event: tool_result data: {"tool_use_id":"t2","name":"read_document","output":"# Python 异步...","is_error":false}
event: token       data: {"text":"根据"}
event: token       data: {"text":"知识库"}
...
event: done        data: {}
```

前端按 `tool_use_id` 关联 call 与 result；按到达顺序维护步骤列表。多轮 agent 循环中事件按真实时序交错到达（工具→结果→文本→工具→结果→文本…），上例仅展示最常见的「先工具后文本」单段。

## 5. 边界与错误处理

| 场景 | 处理 |
|------|------|
| 工具执行出错（`is_error`） | 步骤标红，仍展示 output（错误信息），AI 通常基于错误重试 |
| 工具结果为空字符串 | 显示「（无输出）」 |
| 流式中断（连接断开） | 已收到的步骤保留；`running` 步骤标记为中断态 |
| 老会话（payload 无 `tool_calls`） | 降级为不渲染思考过程块，只显示 content |
| `ask_user` 事件 | SSE 模式暂不支持（emitter 已记 warning 日志），**不在本次范围** |
| 工具图标未映射 | 降级为通用 🔧 |

## 6. 测试计划

- **后端单测**（pytest）：mock `StreamingAgent`，向 emitter 注入 TEXT/TOOL_CALL/TOOL_RESULT 事件序列，断言 `chat.py` 产出正确的 `token`/`tool_call`/`tool_result` SSE 事件（顺序、字段、`is_complete`/`is_error` 正确）。
- **前端单测**（Vitest）：
  - `<chat-tool-trace>` 渲染：折叠/展开切换、进行中 spinner、错误标红、空结果、老会话兼容（无 tool_steps）
  - `chat-view._submit` 事件处理：不可变更新步骤列表、自动折叠时机
- **E2E**（playwright-cli，遵循用户规则）：发起一个会触发工具的对话 → 验证思考过程块出现、进行中可见、可展开看参数与结果、完成后自动折叠、刷新后历史会话仍可展开查看

## 7. 不在范围内

- LLM chain-of-thought 推理文本展示（需 planify 启用 extended thinking）
- SSE 模式下的 `ask_user` 交互
- 全局「显示/隐藏思考过程」开关（已决策为不需要）
- 跨 loop `asyncio.Queue` 安全性的彻底重构（本次绕开，不引入）

## 8. 涉及文件清单

**后端**：
- `doclens/web_v2/api/chat.py`（SSE 事件透传）
- `doclens/web_v2/sessions_store.py`（payload 透传存储，预期无需改动——它不解析 payload 内部结构，新字段自动透传）
- `doclens/web_v2/api/_chat_emitter.py`（确认：当前已正确收集 `tool_calls`，预期无需改动；实现时复核 `is_complete` / `output` 回填逻辑）

**前端**：
- `doclens/web_v2/frontend/src/state/types.ts`（`ToolStep` / `ChatMessage` 扩展）
- `doclens/web_v2/frontend/src/api/chat.ts`（新增事件类型）
- `doclens/web_v2/frontend/src/api/sessions.ts`（`appendSession` 带 tool_calls）
- `doclens/web_v2/frontend/src/views/chat-view.ts`（流式事件处理 + 自动折叠）
- `doclens/web_v2/frontend/src/components/chat-message.ts`（挂载子组件）
- `doclens/web_v2/frontend/src/components/chat-tool-trace.ts`（**新增**）
