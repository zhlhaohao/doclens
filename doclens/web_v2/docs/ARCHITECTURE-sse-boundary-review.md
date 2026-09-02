# SSE 流式对话：边界与接口的工程原则审查

> 生成日期：2026-09-02 · 基于 commit `85f82ee5`（边界修复）之后的代码
> 覆盖文件：`doclens/web_v2/api/chat.py`、`api/_chat_emitter.py`、`api/ask.py`、`chat_interrupt.py`、`frontend/src/api/chat.ts`、`planify/streaming/types.py`、`streaming/runner.py`、`streaming/waiter.py`、`tools/user_interaction.py`
> 姊妹篇：[ARCHITECTURE-sse.md](./ARCHITECTURE-sse.md)（链路总览）、[ARCHITECTURE-event-flow.md](./ARCHITECTURE-event-flow.md)（emitter 与 queue）、[ARCHITECTURE-ask-loopback.md](./ARCHITECTURE-ask-loopback.md)（ask 回环）、[ARCHITECTURE-planify-boundary.md](./ARCHITECTURE-planify-boundary.md)（整体责任边界）

本文回答：doclens ↔ planify 在 **SSE 流式对话**这条链路上的接口划分，有哪些不符合软件工程原则的地方。

## 一、接口地图（现状）

```
planify 拥有                          doclens 拥有
─────────────────────────────        ─────────────────────────────
EventEmitter 协议 (types.py)    ◄──   ChatEventEmitter (_chat_emitter.py)
  └ 7 方法 emit_text/tool_call/       实现协议 + 积累器 + 直推 queue
    tool_result/ask_user/done/error
StreamEvent / StreamEventType   ──►   ChatEventEmitter import 之（类型复用）
GlobalResponseWaiter 单例       ◄──   ask.py submit / chat.py interrupt hook
interrupt_event (threading.Event)◄──  chat_interrupt.py 注册表生产
run_stream(messages, query, sid)──►   chat.py 调用；返回值被丢弃
                                     内部事件 dict 契约（7 种 type）──► 前端 ChatStreamEvent 联合类型
```

## 二、不符合工程原则的点（按严重度）

### 🔴 1. `EventEmitter` 协议是「胖协议」，且 ask 通道复用旧协议传新语义

`types.py:123-141` 的 `emit_ask_user(request_id, question, input_type, options, default)` 本是**旧 ask_user 工具**的签名；`ask_user_question`（结构化问答）不新增协议方法，而是蹭这个通道——`question` 字段塞 JSON 序列化的 questions 数组、`input_type="questions"` 作判别标记（`user_interaction.py:451-457`，注释自述「复用旧协议」）。

后果：

- 协议签名对调用方**说谎**——`question: str` 实际可能是 JSON 数组字符串，类型系统无法表达；
- 每个 emitter 实现都要自己实现这个判别分支（`ChatEventEmitter`，`_chat_emitter.py:188-201` 认 questions、其余记告警）——**协议不变式被下放给每个实现者**；
- 前端又要把 `questions_json` 字符串二次 `JSON.parse` + 校验（`ask.ts`）——同一份数据经历「dict → JSON str → SSE JSON → 前端 parse」三层序列化。

**原则违反**：接口应精确表达语义（Parse, don't pass raw strings）。修法：`EventEmitter` 增加 `emit_ask_questions(request_id, questions: List[Dict])` 一等方法，旧 `emit_ask_user` 标 deprecated。

### 🔴 2. 内部事件契约三层平行定义、字符串匹配、无 schema

同一套事件在三个地方各定义一遍，靠字符串字面量对齐：

| 层 | 位置 | 形式 |
|---|---|---|
| 生产 | `_chat_emitter.py` `_push({"type": "tool_call", ...})` | 裸 dict 字面量 |
| 转发 | `chat.py:254-313` `if t == "token" / elif ...` | 字符串 if/elif 链 |
| 消费 | `frontend/src/api/chat.ts:3-11` | TS 联合类型（手工对齐） |

没有任何单一真相源：加一个事件类型要改 3 处，改字段名靠记忆。`chat.py` 缺 `else` 分支——未知类型**静默丢弃**，契约漂移时前端表现为「事件凭空消失」，无任何告警。

**原则违反**：DRY + 契约应集中定义。至少后端两层应共享一个类型化事件定义（dataclass/TypedDict；或复用 planify 现成的 `StreamEvent.to_sse_dict()`——但 ChatEventEmitter 绕开了它，见下）。

### 🟠 3. `ChatEventEmitter` 绕过 `StreamEvent` 自建第二套事件表示

runner 调 `emit_tool_call(...)` → emitter 包成 `StreamEvent` → `emit()` 里又拆包 `event.data.get(...)` → `_push` 时**重新拼一个字段名不同的裸 dict**（`input_data`→`input` 等）。`StreamEvent.to_sse_dict()`（`types.py:47-56`）存在且就是干这个的，但没人用。

后果：一次事件四种表示（方法参数 → StreamEvent → data dict → 裸 push dict），每层字段名微调；积累器（tool_calls）与推送内容的字段集也不一致（积累含 `_t0`，推送含 `duration_ms`）。

**原则违反**：一个概念应有一种表示。`emit()` 里应直接 `self._push(event.to_sse_dict())` 加类型特例，或在协议便捷方法里一次成形。

### 🟠 4. 中断是「通道外信号」，不是事件流的一等公民

中断链路：`threading.Event`（planify runner 轮询检查点，`runner.py:517`）+ doclens 的 `chat_interrupt.py` 模块级全局注册表 + hook 集合——**三套机制拼一个语义**：

- Event 归 runner 轮询（粒度 = 每个 astream 事件一次）；
- hook 归 doclens 注册表（补 ask 挂起缺口）；
- `agent_task.cancel()` 归 chat.py 消费端 finally。

且 `threading.Event` 是同步原物混进全 async 链路（为兼容 CLI/TUI），注册表是模块级全局可变状态（`chat_interrupt.py:34-36`），靠「UI 单会话单流」假设保安全（`register_interrupt` 注释自述 last-write-wins）。

**原则违反**：控制流应与数据流同构。理想形态是 planify 层提供 `InterruptToken`/取消回调注册接口（runner 构造参数已有一半——`interrupt_event`），把 hook 机制内化为框架能力（ask 挂起唤醒本属 waiter 的职责，现在却由宿主 hook 反向调 `waiter.interrupt`）。当前属「能跑但拼接感强」。

### 🟠 5. 中断 hook 依赖 emitter 内部状态（`pending_asks` 影子表）

`chat.py:100-105` 的 hook 遍历 `emitter.pending_asks` 拿 request_id 去 `waiter.interrupt()`。pending_asks 是 emitter 的**附带积累物**（ask-loopback 文档称「影子」），hook 消费它意味着：中断语义依赖「emitter 恰好记了这份影子」这一实现细节。若某 emitter 实现不记 pending_asks（如 CLIEventEmitter），同一套 hook 模式就失效——**会话作用域的 ask 索引本是 waiter 的职责**（waiter 是全局单例，恰好缺 session 维度索引）。

**原则违反**：依赖实现细节而非接口；职责错置（waiter 应支持按 session 枚举 pending）。

### 🟡 6. `run_stream` 返回值语义在 Web 路径被丢弃，接口契约模糊

`run_stream` 返回「清洗后历史」（`runner.py:357`），CLI 路径用它滚动历史，Web 路径完全丢弃（event-flow 文档 §八说明原因）。同一方法两种语义消费方式，返回值对 Web 调用方是噪音。另外 `_cleanup_messages` 的「清洗」也是为 Web 持久化服务的，框架在为特定宿主做裁剪。

### 🔴 7. 中止时的半截 assistant 消息可能协议非法 —— ✅ 已实测（2026-09-02），真凶另有其人

**实测方法**：fake provider 模拟两种中断时序跑 `run_stream`（脚本一次性，已删）：

1. **原假设不成立**：中断在 tool_use 块流式中途（`content_block_start` 后、`stop` 前）时，半截块**不会**进入 messages——tool_use 只在 `content_block_stop`（`runner.py:578-583`）以完整 input（`ToolCallState.get_complete_input()`）append。Web 路径免疫（弃返回值，DB 重建时 `append_chat_turn_raw` 只落成对工具调用）。
2. **发现真正的协议非法源（比原假设严重，且不限于中断场景）**：`_cleanup_messages` 用 `getattr(block, "type", None) == "tool_use"` 检测 tool_use 块——该检测**只对 Pydantic 模型 block 有效**，而 runner 自己 append 的是 dict（`:578-583`），dict 无 `.type` 属性，检测永远落空。后果：cleaned history 保留孤儿 `assistant [tool_use]`，而配对的 `user [tool_result]` 被（按设计）跳过——CLI/TUI 路径（`cortex_cli.py:390`、`tui/app.py:877` 以 cleaned 为下一轮输入）下轮回放**必然触发 Anthropic 400（tool_use 无配对 tool_result）**。每一轮带工具调用的对话都会产生，只是 CLI/TUI 非主力交互面而未被暴露。
3. **中断派生小问题**：中断后 `:607` 无条件 append 可能产生 `content=[]` 的空 assistant 消息（中断落在工具执行后、下一轮流式首事件时），cleanup 对空 list 同样保留——垃圾数据 + 相邻同 role 消息。

**修法（极小）**：`_cleanup_messages` 的 tool_use 检测兼容 dict（`isinstance(block, dict) and block.get("type") == "tool_use"`），并顺带跳过空 content 的 assistant 消息。

### 🟡 8. SSE 事件与前端解析的容错取向不一致

后端 `chat.py` 对未知事件静默丢弃；前端 `chat.ts` 对 JSON parse 失败静默 skip（注释自述「不中断流」）。两端都选了「吞掉」，叠加 #2 的无 schema，契约错误会双向隐形。

## 三、做得好的地方（应予保留）

- **queue 分界 + None 哨兵终止协议**（finally 双端兜底）——生产者/消费者教科书式解耦；
- **waiter Future 化 + consumed 一次性标记**——跨线程 resolve 干净，竞态已修复且有注释论证；
- **绑定改浅拷贝后**（2026-09-02 边界修复）——emitter 生命周期与请求对齐；
- **request_id 即能力凭证 + 双端校验**——ask 回环的安全模型清晰且文档化。

## 四、修复优先级建议

| # | 问题 | 建议修法 | 成本 | 状态 |
|---|---|---|---|---|
| 1 | ask 蹭旧协议 | EventEmitter 加 `emit_ask_questions` 一等方法 | 小，向后兼容可留旧路径 | ✅ 已修复（2026-09-02，见下节） |
| 2 | 三层平行契约 | 后端两层共享 TypedDict/dataclass 事件定义 + `else` 分支记 warning | 小 | ✅ 已修复 |
| 3 | 事件四种表示 | `_push(event.to_sse_dict())` 统一 | 小 | ✅ 已修复 |
| 4+5 | 中断拼接 + 影子表依赖 | waiter 加 session 维度 pending 索引 + `interrupt_session(sid)`；hook 表留在 doclens 但改调该 API | 中 | ✅ 已修复 |
| 7 | 半截 tool_use 块（实测后改写：`_cleanup_messages` 的 tool_use 检测对 dict block 失效 → 孤儿 tool_use 进 cleaned history） | cleanup 检测兼容 dict + 跳过空 content assistant | 极小 | ✅ 已修复（含单测 `tests/test_cleanup_messages.py`） |
| 6 | run_stream 返回值 | 文档化「Web 路径丢弃返回值」或拆方法 | 极小 | ✅ 已修复（docstring 双语义声明） |
| 8 | 双端静默吞错 | 未知事件/解析失败至少记 warn | 极小 | ✅ 已修复 |

## 五、已修复明细（2026-09-02）

| # | 方案 | 涉及文件 |
|---|---|---|
| 1 | `EventEmitter` 协议新增 `emit_ask_questions(request_id, questions)` 一等方法（结构化数组直传）；`handle_ask_user_question` 改调新方法，emitter 未实现时回退旧通道并记告警（`ASK_INPUT_TYPE_QUESTIONS` 仅余回退用途）；planify 各 emitter（SSE/CLI/TUI）与 `ChatEventEmitter` 全部实现新方法（CLI 为逐问编号作答的兜底交互，TUI 路由 `on_ask_questions` 回调；后续精简中便捷方法默认实现上移到协议，QueueEmitter 随零使用方被删除）；SSE ask 事件线格式 `questions_json` 字符串 → `questions` 结构化数组，前端 `parseAskQuestions`（JSON 字符串解析）→ `validateAskQuestions`（结构校验），三层序列化减为一层 | `planify/streaming/types.py`、`planify/streaming/emitter.py`、`planify/tools/user_interaction.py`、`doclens/web_v2/api/_chat_emitter.py`、`frontend/src/api/chat.ts`、`api/ask.ts`、`views/chat-view.ts` |
| 2+3 | 新建 `_chat_events.py`：7 种队列事件的 TypedDict + 构造函数 + `KNOWN_EVENT_TYPES`——生产侧（emitter/_run_and_finalize）与消费侧（event_stream）共享单一真相源；`event_stream` 的 if/elif 映射链改为「剥 type 整体透传」（队列事件与线格式同构），未知类型记 warning | `doclens/web_v2/api/_chat_events.py`（新建）、`_chat_emitter.py`、`chat.py` |
| 4+5 | `PendingRequest` 新增 `session_id` 字段，`create_request(..., session_id=)` 透传（handler 经 contextvar `get_current_session_id()` 取）；waiter 新增 `interrupt_session(sid)` 按会话中断全部 pending；chat.py 中断 hook 改调该 API，`ChatEventEmitter.pending_asks` 影子表整体删除 | `planify/streaming/waiter.py`、`planify/tools/user_interaction.py`、`chat.py`、`_chat_emitter.py` |
| 7 | `_cleanup_messages` tool_use 检测兼容 dict block（`isinstance + .get("type")` 与 `getattr` 双通道），并跳过 `content=[]` 空 assistant（中断残留）；新增 4 项单测锁定 | `planify/streaming/runner.py`、`tests/test_cleanup_messages.py`（新建） |
| 6 | `run_stream` docstring 声明就地 mutate 入参 + 返回值两种消费语义（CLI 滚动 / Web 丢弃走 DB 重建） | `planify/streaming/runner.py` |
| 8 | 后端未知队列事件记 warning；前端 `chat.ts` 全部 parse 分支经 `parseData()` 失败记 `console.warn`，未知事件类型同样 warn | `chat.py`、`frontend/src/api/chat.ts` |

**验证**：Python 278 项测试全绿（含新增 cleanup 4 项 + ask 协议/回退/interrupt_session 3 项）；前端 `npm run build` 成功（tsc 通过），ask/chat-view 相关 44 项 vitest 全绿（其余 22 个失败文件为 DESIGN.md 视觉改造的存量色值断言漂移与需起服务的 e2e，与本次改动无关）。
