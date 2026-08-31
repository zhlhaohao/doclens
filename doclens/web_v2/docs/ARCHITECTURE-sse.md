# Web SSE 实现逻辑分析

> 生成日期：2026-08-31 · 基于仓库 `release` 分支实际代码
> 覆盖文件：`doclens/web_v2/api/chat.py`、`api/_chat_emitter.py`、`chat_interrupt.py`、`frontend/src/api/chat.ts`、`frontend/src/api/client.ts`、`frontend/src/api/ask.ts`

## 一、链路总览

```
浏览器                          FastAPI 主进程                          生成线程（daemon）
──────                          ──────────────                          ─────────────────
fetch POST /api/chat ──────────► chat() (chat.py:248)
  (body: message/session_id)      │
                                  ├─ _stream_agent_response (chat.py:30)
                                  │    ├─ 读 DB 历史 + 弹出前端已落库的本轮消息 (:54)
                                  │    ├─ register_interrupt(session_id) (:81) ←线程启动前，防竞态
                                  │    ├─ asyncio.Queue + main_loop 引用 (:75-76)
                                  │    └─ 启动线程 ──────────────────────────────► _run_in_thread (:87)
                                  │                                             ├─ 新建私有 event loop (:100)
await queue.get() ◄───────────────┤                                             ├─ ChatEventEmitter 收集器
  yield chunk                     │                                             ├─ asyncio.gather(
  │                               │                                             │    sa.run_stream(...),  ← LLM 逐事件写 emitter 缓冲
  ▼                               │                                             │    _feed()             ← 50ms 轮询缓冲 diff
EventSourceResponse               │                                             │  ) (:201-204)
格式化 SSE 命名事件                 │                                             ├─ done 后策展参考资料 (:146-176)
(token/tool_call/...)             │                                             ├─ append_chat_turn_raw 落库 (:208-228)
                                  │    queue.put(None) 哨兵 ◄────────────────────┤ finally (:236)
  流结束 ◄── chunk is None ───────┘
```

核心是**三线程两 loop**模型：ASGI 主 loop（HTTP/SSE 出口）+ 生成线程私有 loop（跑 StreamingAgent），中间靠 `asyncio.Queue` + `call_soon_threadsafe` 桥接。

## 二、后端三层拆解

### 1. 入口层（`chat.py:248-294`）

- `POST /api/chat` → `event_stream()` 异步生成器 → `EventSourceResponse`（sse-starlette）。
- 内部事件 dict 映射为 **7 种 SSE 命名事件**：`token` / `tool_call` / `tool_result` / `ask` / `toast` / `error` / `done`，data 均为 JSON。
- **客户端断开兜底**（`:284-289`）：`asyncio.CancelledError` → `request_stop(session_id)` 通知生成线程停，堵住「前端不读了，后端继续烧 token」的泄漏。

### 2. 桥接层（`_put` + queue）

`_put(ev)`（`chat.py:83`）用 `main_loop.call_soon_threadsafe(queue.put_nowait, ev)` 把事件从生成线程搬进主 loop 的队列——queue 属主是主 loop，跨线程写入必须走 threadsafe 调度。主协程 `while True: chunk = await queue.get()`（`:241-245`），`None` 哨兵终结（`:236`）。

### 3. 生成层（`_run_in_thread`，`chat.py:87-236`）

- 子线程内 `asyncio.new_event_loop()`（`:100`），`asyncio.gather(sa.run_stream(...), _feed())` 双协程并发（`:201`）——**一个产（LLM 流写 emitter 缓冲），一个运（轮询搬运到 SSE）**。
- 完成后顺序：策展参考资料 → 透传 `emitter.error` → 推 curated token → 兜底 toast（`:146-176`）→ 持久化原始轮次（`:208-228`）→ `finally` 摘中断 + 投哨兵。

## 三、关键机制

### 1. ChatEventEmitter：缓冲收集器而非流转发（`_chat_emitter.py:15`）

**不推流，只累积**：`text_parts`（正文增量）、`tool_calls`（调用+结果配对回填）、`pending_asks`、`done/error` 标志。配对逻辑三级降级：tool_use_id 匹配 → name 匹配 → 孤儿单独记录（`:83-100`），并计算 `duration_ms`。

为什么不用 planify 自带的 `SSEEmitter`（自带 asyncio.Queue）：那个 queue 属于子线程 loop，主 ASGI loop 无法 `await` 它；`ChatEventEmitter` 把「事件收集」与「事件运输」解耦，运输由 `_feed` 统一做。

### 2. `_feed`：50ms 轮询 + 索引 diff（`chat.py:103-141`）

三个 `delivered_*` 集合记录已投递索引，每 tick 只推新增：

- **tool_call / tool_result 实时推**——思考过程的工具 trace 即时可见；
- **ask 实时推**——悬置问题即时渲染成交互卡片；
- **正文 token 不实时推**（循环里没有推 token 的分支），缓冲到 done。

### 3. 正文整体推送 + 参考资料策展（最重要的取舍）

done 后才 `_put({"type": "token", "text": curated_text})`（`:174`），因为正文要过策展重写：

- **技能会话**（首条用户消息含 `[调用技能: …]`）→ 提取式：从正文提取真实路径重建章节（`:147`）；
- **普通会话** → 声明式：AI 的「## 参考资料」合规则清洗+重编号对齐 `[N]`；不合规则按工具检索结果分级兜底 + toast（`:156-163`）。

若边流边推正文，策展重写会造成内容跳变/重复，故选择牺牲打字机效果换策展完整性。**代价：长回答的正文要等全部生成+策展完才一次性出现**。

### 4. 中断机制（`chat_interrupt.py`）

按 `session_id` 登记 `threading.Event` 的注册表，三处细节防竞态：

- register 在线程启动**前**完成（`chat.py:78-81` 注释：杜绝「stop 早于 register」）；
- unregister 仅当表里是**同一个** event 才删（`:34-38`：防「停→迅速重发」时旧线程误删新流的事件）；
- `request_stop` 未命中即 no-op（`:41-52`：前端 fire-and-forget 无需关心时序）。

触发源两个：`POST /chat/stop`（`:297`）和 SSE 客户端断开。Event set 后由 `StreamingAgent` 的流式检查点（`planify/streaming/runner.py:512`）实际中断。

### 5. ask 双向回环（SSE 单向的补丁）

SSE 只能服务端→客户端，用户应答走独立回路：

```
handler 阻塞 waiter.wait_for_response ◄── POST /api/ask/respond ◄── 前端卡片提交
     ▲                                                            │
     └── emitter.pending_asks ── SSE "ask" 事件 ── chatStream ────┘
```

前端 `respondAsk` 带 10s 超时（`ask.ts:11`），`submitted=false` 表示 request_id 已失效（超时/已答），卡片置失效态。

> 完整时序、跨线程唤醒细节与边界情况，见 [ARCHITECTURE-ask-loopback.md](./ARCHITECTURE-ask-loopback.md)。

### 6. 持久化时序（展示层与回放层分离）

1. **发送前**：前端 `appendSession` 落库 `message_user`（若失败则不发起 SSE 请求——这是 `chat.py:53` 弹出重复消息的前提约定）；
2. **done 后（后端）**：`append_chat_turn_raw` 落库 tool 链 + 模型**原始**输出（`:222`，只落库已配对的调用，中断残留丢弃）；
3. **done 后（前端）**：另写 `message_ai`（策展后文本）。

下轮回放 `get_chat_history` 优先 `message_ai_raw`——LLM 上下文用原始版，前端展示用策展版。

## 四、前端消费端

- **为什么不用 `EventSource` API**：它只支持 GET；这里要 POST JSON body，所以 `streamSSE`（`client.ts:41`）用 `fetch` + `res.body.getReader()` + `TextDecoder` 手工解析。
- 解析器遵循 SSE 规范的三种事件分隔符 `\r\n\r\n` / `\r\r` / `\n\n`（`client.ts:65`），跨 chunk 残留进 buffer 续拼。
- `chatStream`（`chat.ts:13`）把 SSE 事件转回类型化 `ChatStreamEvent` 联合类型，JSON parse 失败静默跳过（不中断流）。
- `stopChat` fire-and-forget：网络/鉴权失败静默（`chat.ts:68-70`），不阻塞前端把对话收尾。

## 五、设计取舍与风险点

| # | 观察 | 影响 |
|---|---|---|
| 1 | **正文非真流式**（token 缓冲到 done 整体推） | 长回答无打字机效果，用户等全程；工具 trace 实时可见部分弥补 |
| 2 | 50ms 轮询 diff 而非事件驱动 | 平均 25ms 事件延迟（可接受）；每 tick 全量扫描 emitter 列表，量小无碍 |
| 3 | 复用全局单例 `agent.session` + 每次 `bind_user_interaction_handlers` 重绑（`:197-200`） | 隐含「单会话单流」假设（`chat_interrupt.py` 注释明示）；同 session 并发两流会互相覆盖 handler 绑定 |
| 4 | `history[-1]` 弹出防重复依赖前端落库约定（`:53-59`） | 约定破坏（如手动 curl 带 session_id）会双写本轮消息 |
| 5 | `queue` 无界 + 断开后 `_put` 仍短暂运行 | 泄漏量以 done 为界，有限；EventSourceResponse 自带 ping 保活，无需应用层心跳 |
| 6 | `_feed` 中断后仍会走完策展 | 中断的半截文本也会被 curate + 推送（`emitter.error` 会先推 error 事件，前端可据此弃用该 token） |
