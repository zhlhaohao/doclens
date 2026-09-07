# Q&A

## chat 的 session_id 是怎么来的？（2026-09-03）

chat 的 `session_id` 来自**后端 SQLite 会话表的主键，ULID 生成**，完整链路如下：

### 生成点（唯一源头）

`doclens/web_v2/api/sessions.py:40` —— `POST /api/sessions`：

```python
sid = str(_ulid.new())   # ULID（时间有序的唯一 ID）
```

写入 `.cortex/sessions.db` 的 `sessions` 表后返回给前端。

### 前端获取时机（chat-view.ts）

1. **新会话**：发首条消息前，`_ensureSession()`（chat-view.ts:378）调 `createSession()` 拿到 id，存进 `chat.currentSession.id`。此时还没有任何聊天内容，会话记录先行落库。
2. **技能会话**：同一入口，多带 `mode: "skill"`（chat-view.ts:372）。
3. **历史会话**：从历史列表点开的会话，`currentSession` 直接复用 DB 里已有的 id（chat-view.ts:533），不会新建。

### 发送时的传递

`_sendMessage`（chat-view.ts:404）取 `currentSession.id`，作为 `session_id` 随 `POST /api/chat` 发出（chat-view.ts:423）。

### 后端对 session_id 的消费（api/chat.py）

- `:57-67` 读 DB 历史（`get_chat_history`）、判技能会话（`summary.mode == "skill"`）
- `:87` 登记为中断 key（`register_interrupt`），`/chat/stop` 靠它寻址
- `:192-209` 完成后 `append_chat_turn_raw` 落库原始轮次

### 兜底分支

`chat.py:138`：`session_id or session.session_id` —— 若前端没传，`run_stream` 退而用 planify `SessionManager` 内部的 agent 会话 id。但代码注释明确「前端总会传 DB session id」（chat.py:86），这条兜底实际不会触发；且 `session_key = session_id or None`（:87），没传时连中断登记都跳过。

**一句话**：session_id = 前端发首条消息前先调 `POST /api/sessions` 创建的 DB 会话记录 id（ULID），之后整轮对话都以它为钥匙串起历史读取、中断控制和落库。

---

## planify 有 session，doclens 也有，这两个在实际应用中是如何配合的？（2026-09-03）

两者的关系是：**planify session 是进程级单例「运行时组件包」，doclens session 是业务级「对话身份 + 持久化」——多对一**。每次 chat 请求 = 用 doclens 的 DB session 重建历史，借用 planify session 的组件跑一轮 agent，DB session_id 穿透进 planify 内部当隔离键。

### 各自是什么

**planify session**（`planify/core/session.py` 组件包，`SessionManager` 装配）
- doclens 的 `CortexAgent` 构造时生成：`session.session_id = str(uuid.uuid4())[:8]`（`agent_integration.py:314`）——8 位 uuid，**一个后端进程只有一个**，是 deps 单例
- 本质是**组件容器**：client/model、tools/tool_handlers、todo_mgr、bg_mgr、message bus、skills loader、logger、session_workdir
- 不承载业务对话历史（Web 模式下历史每轮从 DB 重建传入）

**doclens session**（sessions.db，ULID）
- 业务会话：历史列表、每轮消息持久化（`session_items`）、`/chat/stop` 中断寻址的 key

### Web 模式下的配合链路（chat.py）

```
POST /api/chat (message + DB session_id)
  │
  ├─ agent = get_agent(); session = agent.session     ← 全局唯一 planify session
  ├─ history = store.get_chat_history(session_id)     ← 用 doclens session 重建历史
  ├─ sa = StreamingAgent(client=session.client,       ← planify session 只出组件
  │        tools=session.tools, bg_mgr=session.bg_mgr, …, session=session)
  └─ sa.run_stream(history, message, session_id or session.session_id)
                                               ↑ DB session_id 优先，planify id 兜底
```

DB session_id 进入 planify 后被用作**隔离键**（`planify/streaming/runner.py`）：
- `:171` `set_current_session_id(session_id)` → 工具门禁、`load_skill` 按会话标记技能加载状态
- `:244-247` 跨轮重注入该会话已加载技能的 body
- `:220` 临时脚本目录 `<数据目录>/tmp/<session_id>/`（删会话时 `cleanup_session_tmp` 同步清理）
- `:347` `emit_done(session_id, …)` 事件归属

### 为什么这样设计

Web 模式多会话共用一个 planify session 是可以的，因为**有状态的部分全部外置**：历史在 sessions.db（每轮重建）、技能加载状态按 session_id 存在 `skill_state`、中断按 session_id 登记在 `chat_interrupt`。planify session 剩下的只是无会话语义的基础设施（LLM client、工具集、managers），天然可共享。

### TUI/CLI 模式对照

`CortexAgent.run_query`（`agent_integration.py:362-420`）直接用 `self.session.session_id`（planify 自己的 8 位 id），不经过 sessions.db——单用户单对话，doclens session 这层不参与。

**一句话**：doclens session 管「这段对话是谁、说了什么」，planify session 管「用什么组件跑」；Web 下 N 个前者共享 1 个后者，靠 DB session_id 穿透做运行时隔离。
