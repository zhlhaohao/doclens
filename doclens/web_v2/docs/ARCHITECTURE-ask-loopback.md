# ask 双向回环详解（SSE 单向的补丁）

> 生成日期：2026-08-31 · 基于仓库 `release` 分支实际代码
> 覆盖文件：`planify/tools/user_interaction.py`、`planify/streaming/waiter.py`、`doclens/web_v2/api/ask.py`、`doclens/web_v2/api/chat.py`、`doclens/web_v2/api/_chat_emitter.py`、`frontend/src/api/ask.ts`、`frontend/src/views/chat-view.ts`、`frontend/src/components/ask-card.ts`

## 一、要解决的问题

SSE 是纯单向流（服务端→客户端），而 `ask_user_question` 是**模型主动向用户提问并阻塞等待答案**的工具——存在反向数据流。Web 模式的方案是：正向问题搭 SSE 顺风车，反向答案走独立 HTTP 端点，两条通道在进程内的 `GlobalResponseWaiter` 单例汇合。

## 二、参与者清单

| 层 | 组件 | 职责 |
|---|---|---|
| planify 工具层 | `handle_ask_user_question`（`planify/tools/user_interaction.py:417`） | 校验入参、登记等待、发事件、**挂起**、包装答案为 tool_result |
| 等待器 | `GlobalResponseWaiter`（`planify/streaming/waiter.py:32`） | 进程级字典：request_id → `PendingRequest(event, response)` |
| SSE 正向 | `ChatEventEmitter.pending_asks` + `_feed` | 收集悬置问题，50ms 轮询搬运为 SSE `ask` 事件 |
| Web 反向 | `POST /api/ask/respond`（`doclens/web_v2/api/ask.py:25`） | 接收答案，调 `waiter.submit_response` |
| 前端 | `chat-view.ts:426` + `ask-card.ts` | 解析问题、渲染交互卡片、提交答案 |

## 三、完整时序

```
生成线程 loop                          ASGI 主 loop                        浏览器
══════════════                         ═════════════                       ═══════
① 模型返回 tool_use: ask_user_question
② handler 校验 questions（1-4 问×2-4 选项）
   违规 → 直接返回错误字符串（模型自纠重试）
③ request_id = req_{uuid8}            user_interaction.py:437
   waiter.create_request(id)          → _pending 字典登记 PendingRequest
④ emitter.emit_ask_user(
     input_type="questions",          ← 复用旧协议，question 字段携带 JSON
     question=json.dumps(questions))  → ChatEventEmitter.pending_asks 收集
⑤ await waiter.wait_for_response(id, 300s)
   ── handler 挂起，agent loop 整体暂停 ──
                                        ⑥ _feed tick 发现 pending_asks 新增
                                           → SSE "ask" 事件 ──────────────► ⑦ chatStream yield {type:"ask"}
                                                                           parseAskQuestions 校验
                                                                           setChatState({pendingAsk})
                                                                           ask-card 渲染 radio/checkbox
                                                                           用户作答 → _submit()
                                                                        ◄── ⑧ POST /api/ask/respond
                                        ⑨ ask_respond → waiter.submit_response(id, {answers})
                                           pending.response = 响应
                                           pending.event.set()   ← 跨线程唤醒生成线程
⑩ wait_for_response 被唤醒
   持锁 pop(id)  ← 一次性消费
⑪ 返回 JSON: {"answers":[...], "request_id": id}
⑫ StreamingAgent 把它打包为 tool_result
   user 消息 → 下一轮 LLM 调用带上答案 → 对话继续
```

关键点：⑤挂起时 `run_stream` 协程暂停，但 `_feed` 是 `asyncio.gather` 里的**独立协程**，仍在轮询——所以④发出的问题依然能经⑥⑦到达前端。挂起不堵运输。

## 四、逐环节细节

### 1. 发起侧（`user_interaction.py:417-480`）

- **入参校验前置**（`:429-435`）：`validate_ask_questions` 不通过就直接返回错误字符串作为 tool_result——模型看到错误描述可自行修正参数重试，不占用等待通道。
- **request_id 生成**：`req_` + uuid 前 8 位（`:437`），由 handler 侧生成而非前端，保证两端持有同一个 id。
- **复用旧协议**（`:440-447`）：`ask_user_question` 不新增 EventEmitter 方法，蹭 `emit_ask_user` 通道——`input_type="questions"` 作判别标记，`question` 字段装 JSON 序列化的 questions 数组。`ChatEventEmitter.emit_ask_user` 只认这个类型收进 `pending_asks`（`_chat_emitter.py:160-165`），旧形态到达只记告警不吞细节（`:167`）。
- **挂起**（`:455-457`）：`await waiter.wait_for_response(request_id, timeout=300.0)`（`ASK_TIMEOUT_SECONDS`，`:26`）。

### 2. 正向运输（SSE ask 事件）

`_feed` 每 50ms tick 用 `delivered_asks` 索引集合 diff `pending_asks`，新增即推 `{"type":"ask", "request_id", "questions_json"}`（`chat.py:131-138`）→ `_put` → `call_soon_threadsafe` → 主 loop queue → `event_stream` 转成 SSE 命名事件 `ask`（`chat.py:276-280`）。

### 3. 前端（`chat-view.ts:426` + `ask-card.ts`）

- **双端校验**：后端 handler 校验过一次，前端 `parseAskQuestions`（`ask.ts:40`）再校验一遍（questions 数组、每问 question/header/options≥2）——解析失败直接作废事件，不渲染残缺卡片。
- **卡片状态机**（`ask-card.ts:170`）：`pending → answered | expired`。`willUpdate` 在新问题时重置内部状态（`:174-181`）。
- **提交门槛**：`_canSubmit` 要求每问至少一个选择（选项或 Other 文本，`:189-198`）。
- **提交**（`_submit`，`:220-248`）：组 `AskAnswer[]`（question / selected / other）→ `respondAsk` POST，带 **10s 超时**（`ask.ts:11`）把「永久提交中」变成明确报错；`_submitting` 标志防重复点击，`done` 标志保证 `ask-done` 事件只派发一次（`:243-247` 注释明确防 catch/finally 重入）。
- **提交结果三分支**：`submitted=true` → answered；`submitted=false`（request_id 已失效）→ expired；网络异常 → 同样 expired。三种情况卡片都定格、派 `ask-done` 冒泡事件让视图清理 `_activeAsk`。

### 4. 反向端点（`ask.py:25-57`）

三条明确的设计决策写在模块 docstring（`:7-12`）：

1. **request_id 即能力凭证**：uuid 截断、一次性、全局唯一，不做 session 强校验——追加校验无安全增益；
2. **不存在即失效**：查不到 id 说明已超时/已答，返回 `{ok:false, submitted:false}`，前端据此置卡片失效态；
3. **答案不过滤**：selected 里的未知 label、other 自由文本原样回传——静默过滤会丢用户真实意图，模型需要完整信息。

### 5. 唤醒机制——跨线程 `event.set()`（全链路最微妙的一步）

`submit_response` 是**同步方法**（`waiter.py:119`），运行在 ASGI 主 loop 线程；而被 set 的 `asyncio.Event` 属于**生成线程的私有 loop**（`wait_for_response` 正 await 它）。它不做 `call_soon_threadsafe`，直接 `pending.event.set()`（`:139`）：

- `asyncio.Event.set()` 内部对等待 future 调 `set_result` → 触发 `loop.call_soon` 排回调 + 写 self-pipe 唤醒 selector；
- 严格按官方口径，从非属主线程调 `call_soon` 不是线程安全的（正确姿势是 `call_soon_threadsafe`）；
- 但 CPython 中 GIL 使 deque append 和 socket write 各自原子，实践中可靠——这正是 `:123-124` 注释「**不使用 _data_lock，因为此方法需要被同步上下文（CLI）调用，且 dict.get + 属性赋值在 CPython GIL 下是原子的**」的设计语境。`_data_lock`（asyncio.Lock）只保护 async 侧的字典操作，且它本身也不能跨 loop 使用，所以同步侧只能靠 GIL。
- 工具顺序执行的同轮约束顺带保证了：同一时刻最多一个悬置 ask（第二个 ask 的 handler 要等第一个答完才进入）。

### 6. 一次性消费与超时回收

- **消费即摘除**：`wait_for_response` 被唤醒后持锁 `pop(request_id)`（`:110-111`）——答案取走即失效，重复提交自然失败；
- **超时三重回收**：
  - handler 侧 300s 超时 → 返回 `{"error":"timeout", "request_id"}` 给模型（`user_interaction.py:470-476`），同时 waiter 清理 pending（`waiter.py:104-105`）；
  - `cleanup_expired(max_age=600)` 兜底清扫陈旧条目（`:163`）；
  - 前端 10s respond 超时只管 HTTP 请求本身，不影响后端等待。

## 五、边界情况与缺口

| 场景 | 行为 | 评估 |
|---|---|---|
| **挂起期间用户点「停止」** | `interrupt_event` 的唯一检查点在 LLM 流式调用循环（`streaming/runner.py:512`），**工具执行/ask 挂起期间没有检查点** → 中断不生效，生成线程要等作答或 300s 超时才收尾 | 真实缺口：前端 abort 后 SSE 已断、界面已收尾，但后端线程仍挂着（最多 5 分钟），期间 token 不再产生但线程占用 |
| **页面刷新** | `pendingAsk` 是前端内存态，刷新后卡片消失、request_id 丢失，用户无法作答 | 靠 300s 超时自然回收；历史回看时 `resolvedAnswers` 预填 answered 态（`ask-card.ts:166`） |
| **跨线程 `event.set()`** | 见 4.5 节 | 理论竞态，GIL 实践兜底，未观察到问题 |
| **用户不想回答** | 卡片没有「跳过/取消」按钮，`_canSubmit` 强制每问至少一个选择 | UX 缺口：只能干等超时，或选一个并非本意的选项 |
| **模型同轮连发两个 ask** | 工具顺序执行，第二个 ask 在第一个答完后才登记 | 安全，但同时只有一个悬置也是**能力上限**（无法并行提问） |

## 六、一句话总结

这是一个用「全局字典 + 跨线程 Event + 一次性 request_id」实现的进程内 RPC——SSE 负责把问题送出去，一个普通 POST 负责把答案带回来，waiter 是两者的会合点，协议靠 request_id 的唯一性与一次性保证安全。
