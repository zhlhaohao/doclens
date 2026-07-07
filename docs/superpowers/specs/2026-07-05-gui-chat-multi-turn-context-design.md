# GUI AI 对话多轮上下文 — 设计文档

- 日期：2026-07-05
- 状态：已批准（待实现）
- 范围：doclens Web GUI（`doclens/web_v2`）

## 1. 背景与问题

GUI AI 对话当前**无多轮上下文**：同一会话内，AI 记不住前几轮说过的话；点开历史会话续聊，AI 也不记得该会话的历史内容。

### 代码证据

- `doclens/web_v2/api/chat.py:87`：`sa.run_stream([], message, session.session_id)` —— messages 参数硬编码为空 `[]`
- `chat.py:111`：`_stream_agent_response(req.message, req.session_id)` —— `ChatRequest.history` 字段定义了但从未被读取
- `doclens/web_v2/frontend/src/views/chat-view.ts`：调 `chatStream({message, session_id})` 从不传 history
- `planify/streaming/runner.py:116-220`：`run_stream` 只使用传入的 messages，不读取 `session._messages`（session 只在 compact 时被回写，从不被读）

### 实测证据（2026-07-05）

直调 `_stream_agent_response`，同一 agent 单例连续两轮：

- R1「记住暗号 BANANA-7」→「已记住，您的密码代码是 BANANA-7。」
- R2「我刚才告诉你的暗号是什么？」→「You haven't told me a secret code yet.」

## 2. 目标与范围

**B 档**：同会话内多轮上下文 + 点开历史会话可续聊（AI 记得该会话之前的内容）。

**不做（YAGNI）**：

- 跨会话长期记忆（C 档，类似 ChatGPT Memory）
- 后端内存缓存 per-session messages
- 手动滑窗 / 自定义压缩策略

## 3. 方案选择

| 方案 | 描述 | 结论 |
|------|------|------|
| **① 后端按 session_id 查 SQLite 重建 history** | SQLite 为唯一真源；agent 单例不动；history 每次按 session_id 重建传入 | ✅ 选定 |
| ② 前端随请求传 history | 改动最小，但刷新后续聊历史会话丢上下文 | ❌ 违背 B 档 |
| ③ 内存缓存 per-session + 写穿 SQLite | 最快，但要管缓存生命周期/一致性 | ❌ 过度工程 |

**上下文长度控制**：全量历史 + 复用 planify `auto_compact`（`runner.py:210-220`，token 超阈值时自动摘要旧消息），不引入新逻辑。

**历史消息形态**：SQLite 只存 `message_user` / `message_ai` 的纯文本（`appendSession` 写入），不含工具调用中间态——重建的历史天然是干净的 user/assistant 交替，与 planify `_cleanup_messages` 行为一致。

## 4. 架构与数据流

SQLite 是会话历史唯一 source of truth。`/api/chat` 收到请求后，按 `session_id` 从 `sessions_store` 重建 `[{role, content}]`，连同本次 `message` 传给 `run_stream`。

```
前端 chat-view 提交 {message, session_id}
  → POST /api/chat
  → chat.py._stream_agent_response:
      1. sessions_store.get_chat_history(session_id) → [{role, content}]
      2. sa.run_stream(history, message, session_id)
      3. SSE 流式返回
  → 前端追加 assistant 回复到 store（仅显示）
  → 流结束 → appendSession 把本轮 user/ai 写回 SQLite（既有逻辑，不变）
```

**关键策略**：

- `CortexAgent` / `session` 保持全局单例 —— 只承载 `client/tools/skills`，**不存对话历史**
- `history` 每次从 SQLite 重建 → 天然多会话隔离，**无需 agent 实例池**
- `session._messages` 的 compact 回写无害（下次请求从 SQLite 重建，不读它）
- 前端 `store.chat.messages` 仅用于显示，不再传 history

## 5. 组件改动

| 文件 | 改动 |
|------|------|
| `doclens/web_v2/sessions_store.py` | 新增 `get_chat_history(session_id) -> List[Dict]`：基于现成 `get_detail`（返回有序 items），映射为 `[{role:"user"\|"assistant", content}]`；跳过非 `message_*` kind 与 `payload` 解析失败项；空内容跳过 |
| `doclens/web_v2/deps.py` | 新增 `get_sessions_store()` 单例（对齐 `get_agent`/`get_index_manager` 模式）；`sessions.py` 私有 `_get_store()` 改用它 —— 小重构，统一单例管理 |
| `doclens/web_v2/api/chat.py` | `_stream_agent_response` 开头按 `session_id` 调 `get_sessions_store().get_chat_history(session_id)`（包 try/except 降级）；`sa.run_stream([], message, session.session_id)` → `sa.run_stream(history, message, session_id)`（用前端传入的 `session_id`） |
| `doclens/web_v2/models/chat.py` | 删除从未被读取的 `history` 字段（清理半成品） |
| `doclens/web_v2/frontend/src/api/chat.ts` | 清理 `chatStream` 签名里同样未用的 `history?` 参数 |
| `doclens/web_v2/frontend/src/views/chat-view.ts` | **零改动**（已传 `session_id`） |

## 6. 边界与错误处理

- `session_id` 为 `None` / 空字符串 → `history=[]`（新会话首句）
- `session_id` 在 SQLite 不存在 → `get_detail` 返回空 → `history=[]`，AI 当首轮处理
- 查库抛异常 → `except` 降级为 `history=[]` + 记日志，**不阻断本次对话**（用户至少拿到本轮回复）
- token 超限 → planify `auto_compact` 兜底
- 并发同会话 → SQLite WAL 并发读 + 流式时 `input-box` disabled，天然规避

## 7. 测试方案

### 单元测试（`tests/web_v2/`）

- `get_chat_history`：正常映射 / 跳过非 message kind / `payload` 解析失败 / 空会话 → `[]`
- `chat` 降级：`session_id=None` → `[]`；不存在的 id → `[]`；查库异常 → `[]` 且不抛

### E2E 测试（直调 `_stream_agent_response` 或 HTTP）

1. **同会话两轮**：R1 告知暗号 → R2 追问 → 预期命中
2. **历史会话续聊**：建会话聊一轮（持久化）→ 新 store 重新打开该会话 → 追问暗号 → 预期命中
3. **多会话隔离**：会话 A 告知暗号 → 会话 B（不同 `session_id`）追问 → 预期 **B 不知道**
4. **回归**：现有 AI 单轮用例行为不变

## 8. 参考

- `doclens/web_v2/api/chat.py:24-118`（POST /api/chat 端点）
- `doclens/web_v2/sessions_store.py:47-235`（schema + `get_detail`）
- `doclens/web_v2/api/sessions.py:27-42`（`_get_store` 单例）
- `doclens/web_v2/frontend/src/views/chat-view.ts:109-192`（`_submit` + `appendSession` + `_loadSession`）
- `planify/streaming/runner.py:116-220`（`run_stream` + `auto_compact`）
