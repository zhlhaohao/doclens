---
status: accepted
date: 2026-11-24
---

# 计划卡直调 DAG 操作 + 团队视图：DAG 的用户面不再经 lead 转手

## 背景

ADR-0059 §4 把计划确认的载体定为「lead 用 `ask_user_question` 发计划卡（开始 / 修改）」，真机验证（2026-11-24）走的却是对话式——lead 用文字复述计划、用户打字「确认」、lead 调 `group_plan_start`。两种形态都让 **lead 站在用户与 DAG 之间**：lead 不在跑时用户没法开始/暂停/恢复 DAG；计划是结构化数据却以自然语言抵达用户；`ask_user_question` 在移动端断线场景不可存活（ADR-0033 的动机）。同时 Bot 与 DAG 没有任何 GUI 承载，用户看不见 Bot 在做什么。

## 决定

### 1. 计划卡是消息流内的持久条目，按钮直接作用于 DAG

- lead 调 `group_plan` / `group_plan_replan` / `group_plan_revise` 时，后端把 plan JSON 以专用事件 `plan_card` 推给前端，并落独立条目 `kind="plan_card"`（不塞进 `tool_calls` 的 output——那里混着 `repairs` / `pending` 等与卡片无关的字段）。刷新 / 断线回来卡片仍在。
- **发射点**：`make_plan_tools` 增加可选参数 `event_sink: Callable[[dict], None]`；`group_plan` / `group_plan_replan` / `group_plan_revise` 在返回前调 `event_sink({"type": "plan_card", "dag_id", "plan", "status"})`。handler 是同步函数、在工具循环里跑，拿不到 SSE 队列——不经 sink 就没有「专用事件」。**sink 必须运行期间接寻址，不能装配期绑实例**：`make_plan_tools` 在 `agent_integration.py:578` 是一次性装配，而 `ChatEventEmitter` 在 `chat.py:182` **每请求新建**——装配期传入 emitter 实例必然拿到 None 或已关闭的旧实例。正确形态：宿主新建 contextvar `_current_emitter`（`chat.py` 建 emitter 后 set、finally reset），`event_sink = lambda ev: (e := _current_emitter.get()) and e.emit_custom(ev)`。`plan_card` 进 `KNOWN_EVENT_TYPES`；emitter 缺席（Bot 侧 / 测试 / 非流式路径）时跳过。
- 卡片按钮（开始 / 暂停 / 继续 / 取消 / 重试 / 重规划）**直接调 DAG 操作端点**（`POST /api/team/dags/{id}/{start|pause|resume|cancel|retry}`），后端复用 `plan_tools` 的 handler，**lead 不在确认环里**。「修改」按钮预填 chat 输入框引导用户用对话改（`group_plan_revise` 仍是 lead 的工具——草稿修改是自然语言活）。
- **所有 plan_tools handler 的 API 复用一律 `asyncio.to_thread` 包裹**——handler 是同步函数（文件 IO + `hub.scope()` 可能同步跑 `recover_scope` + `scheduler.ensure_started()`），在 async handler 里直接调用会卡住 ASGI 事件循环。contextvar 经 `copy_context` 穿透 `to_thread`，scope 在调用前设。
- 卡片随 DAG 状态失效：执行态起「开始」禁用并显示当前状态徽标；前端拿 `dag_id` 对照 DAG 列表合并状态。
- 修订 ADR-0059 §4 第 3 条：确认载体 = 卡片按钮，不再是交互式提问。

### 2. 团队视图 = DAG 层级分组 + Bot 对话覆盖层

- Web UI 新增第五个主视图「团队」（`ViewId="team"`），主体是**当前会话**的 DAG：步骤按依赖深度分层（并行步骤同层），**无连线**——依赖关系写在步骤卡片上。连线布局是独立子项目。
- 步骤的 owner 即 Bot 的入口：点击 → 全屏 `<dialog>` 覆盖层渲染该 Bot 的会话（复用 chat-view 渲染 + 输入框），关闭即断流，重开重连。
- 页面底部「团队 Bot」横条：本会话租借的 Bot + 全局空闲实体——无任务的 Bot 由此可达。
- DAG 状态 5s 轮询（仅 tab 可见时），**不监听文件事件**（§11g）。
- 调度器发 lead 收件箱的**四个发送点**（`_advance_dag` done 分支 `:186` / `_stall` `:388` / `bump_llm_calls` `:303` / `_verify_task` step_done `:352`）同时发 scope 级 `dag_status` 事件 → 宿主经 watch SSE 广播（`immediate=True`）→ 前端 toast（done 绿 / stalled 红 / 预算 paused 黄；step_done 不弹、只驱动进度），非当前会话的也弹，点击切会话跳团队 tab。

### 3. Bot 会话：可对话、按父会话隔离、实时流

**会话模型**

- `SessionType.BOT`：sessions 表加三列（可空）`bot_name` / `parent_session_id` / `task_id` + 索引。不进 chat 历史列表、计数、校验；「清空对话」级联删其 bot 子会话。
- **一个 task = 一个 Bot 会话**（按 `(bot_name, task_id)` 复用，跨线程复活续写，复活插入 `bot_notice(redispatched)` 分隔行）；无 task 的纯对话按 `(bot_name, parent_session_id, task_id IS NULL)` 取最新——**专用 SQL，不复用 `find_or_create`**（它按 `(type, title, mode)` 匹配，task_id 进不了 mode）。会话行由 runner 读到 assignment 时经 sink 懒创建——调度器零感知。
- **隔离**：读 Bot 会话、发消息、停止都校验 `bot.leased_by == 当前 session_id`，否则 409。校验收口在 `api/team.py`；Bot 会话 detail 走专用端点 `GET /api/team/bots/{name}/session?session_id=`，**响应须含与 lead detail 等价的恢复协议字段**：`generating`（= `runner.is_alive(scope, bot)`）+ `items` + `last_persisted_seq`（sink 每落一条更新）——前端靠它判定「回页时 Bot 是否在工作」和「detail 与 snapshot 的去重水位」。
- 复活不注入会话不变（ADR-0058）。

**用户输入**

- Bot 线程活着 → 写收件箱（`from="user"`, `type="user_message"`），WORK 循环顶消费、不打断在飞调用；线程 shutdown → `runner.start(prompt=用户消息)` 复活（不重 spawn、不碰租约）。
- runner **在 `runner.py:176-184` 现有的 assignment 分支旁再加 `user_message` 分支**（现状非 assignment 消息一律 `json.dumps(msg)`）：`type=="user_message"` 组装为带 `[用户直接消息]` 标记的 user 明文；`send_message(to="user")` 拦截落 Bot 会话，不进 lead 收件箱。
- 用户的 `message_user` 条目由 **API 线程在 send 时落**（与 lead 一致），Bot 线程不落用户消息——避免双写。

**流式**

- Bot LLM 调用恒定走 `provider.stream()`（有无人观看都一样——单一代码路径）。**同步聚合器是本 ADR 的前置工程**：lead 的 `_stream_collect` 是 async 方法、绑定 `emitter`/`_tool_call_states`/中断事件，不可复用；须提取**纯同步函数** `aggregate_stream(events, on_text_delta, on_tool_call) -> (stop_reason, blocks, usage)`，lead 侧 async 路径改为包装它（单一聚合真相源）。stop_reason 兜底：`message_delta` 缺失时按「是否存在 tool_use 块」推导。`tests/test_team_spike.py` 的 `FakeProvider` 改为产 `StreamEvent` 序列走同一聚合器。
- 事件经 `planify/team/events.py` 的 `TeamEventBus` 推给 SSE。**手法**复用 `call_soon_threadsafe`（lead chat / WatchBroker 先例），**语义全新**（WatchBroker 是无分组无上限的广播）：per-bot 订阅者集合，每订阅者 `asyncio.Queue(maxsize=256)` 满则丢最旧；runner 只见 `publish(event)`。loop 引用由宿主 lifespan `bind()`。
- **text_delta 50ms 合并由 TeamEventBus 内部的 asyncio 常驻 task 驱动**：`publish` 在 Bot 线程只往 per-bot 内存 buffer 追加（锁保护）并标记待 flush；asyncio 侧每 50ms 轮询 buffer 入队。定时器天然在 asyncio 侧，runner 不感知。
- 订阅时先发 `snapshot{text_so_far, last_persisted_seq}`——runner 为每 Bot 线程维护 `current_text`（轮末清空）；前端 detail 只取 `seq <= last_persisted_seq`，在飞文本以 snapshot 为唯一源。

**落库**

- sink 在 Bot 线程直接 `append_item`（store 每次 `_conn()` 新建连接 + 进程内 RLock，跨线程安全）——每个工具调用完成落一条 `tool_calls`，轮末一条 `message_ai`，系统条目落 `kind="bot_notice"`（assignment / fix_required / redispatched / shutdown）。先存后发。**父会话已删则静默丢弃**：`append_item` 包 `try/except sqlite3.IntegrityError`——drop_scope 的 join 有上限，LLM 调用中的线程可能在删行后才返回并落库，留痕随会话消亡是正确语义，不得炸进 Bot 线程。
- **jsonl 留痕下线**：删除 `runner.py:279` 的 `self._persist_session(name, messages)` **调用**与 `_persist_session` 定义；`registry.sessions_dir` 定义与全部调用方一并删除（它有 `mkdir` 副作用，留着会持续创建空目录）。`bots/<name>/sessions/*.jsonl` 历史文件不读不迁（ADR-0058 原定义即「仅供审计」，无消费者）。

### 4. 停止 = 该 Bot 所属的 DAG 暂停（含在飞验收处置与重启不复活）

- Bot 会话页的按钮文案是**「暂停」**（语义 = 可续跑的暂停，与 chat 的「停止 = 停全部」同义——两者都是 paused 态，不是终止）。**`pause_scope` 签名扩展为 `(scope_id, dag_ids: Optional[list] = None)`**：`None` = 全部（`chat.py:724` 的 `/chat/stop` 调用方显式传 `None`，会话级「停全部」语义不变）；`dag_ids` 给定时只处理列表内 DAG，**shutdown_request 只发给这些 DAG 涉及步骤的 assignee**（现 `:409-410` 是发给 scope 内全部 Bot——照搬会把正在跑 DAG#2 的 Bot 误停）。暂停**不停调度器**——其他 active DAG 照常推进，`wake()` 照发。无任务的 Bot 暂停只 shutdown 线程。
- **paused DAG 重启后不得复活**（既有 bug，`recover_scope:460` 把 `DAG_PAUSED` 纳入处理且 `:472-475` 对 ready 步骤无条件重投递 assignment + 复活 Bot）：修法 = `recover_scope` 对 paused DAG **只做** `in_progress/verifying → ready`（线程全灭后的状态归位），**不重投递、不唤醒**；重投递循环加 `dag["status"] == DAG_ACTIVE` 前置。`interrupted` 标记（`pause_scope` 置位）供 UI 显示「被中断」，resume 时清除。
- **在飞验收与暂停的竞争**（既有洞）：`pause_scope` 把 `verifying → ready` 后，线程池里的 `_verify_task` 仍会写回。修法两层：**DAG mutator 三处**（`_mut_ok` / `_mut_fail` / `_mut_back`）加「DAG 仍为 active 且 step 仍为 verifying」前置条件，否则丢弃；**task 写入三处全部**（`:351` completed / `:362` failed / `:370` in_progress——三处都是，不只是打回那处）前置检查 task 仍为 verifying；`fix_required` 发送前同样检查。顺手删 `:327` 未使用的 `key` 构造。
- **同一 Bot 跨 DAG 双派**（既有窗口）：`recover_scope` 重投递不经 `_pick_assignee`，两个 active DAG 同轮 recover 可给同一 Bot 发两条 assignment；runner 同一轮消费时 `held_task` 被第二条覆盖。Bot 侧最后一道锁：runner 读到 assignment 时若已持有未完成 task → **复用 `_release_held_task(sc, 被拒 task_id)`**（它同时回退 task 为 pending **和** DAG step 为 ready——裸写 task 状态会让 step 卡在 in_progress，`_advance_dag` 的 ready 重派分支永远选不中它）+ `scheduler.wake()`，不覆盖 `held_task`。回归：双 assignment 被拒后该 step 回到 ready 可被重派。

### 5. Bot 实体生命周期与会话解耦（含删除时序）

- 删父会话 → 级联删其 bot 子会话 + `hub.drop_scope(sid)`。**实体与记忆保留**，成为无主空闲实体，任何会话可租借。
- **删除时序必须「先停、等收尾、再删行」**：Bot 线程 sink 持续向 bot 会话 `append_item`，行先删则 FK 违约——与 lead 的 `_stop_orphan_agent` 同一教训。**`drop_scope` 的调用点在 API 层，不在 store 层**：`delete_session` 在加星检查（409）**之后**、`store.delete` **之前**调它；`clear_sessions` 只对 `delete_by_type` 返回的 `deleted_ids`——**但 deleted_ids 是删行后才返回的**，故 `clear_sessions` 改为两步：先 `store.list_ids_by_type(type, exclude_starred=True)` 拿候选 id → 逐个 `drop_scope`（发 shutdown_request → join Bot 线程，上限 5s）→ 再 `store.delete_by_type`。store 层保持纯 DB 操作；加星父会话的 scope 不 drop。join 超时的线程由 sink 的 IntegrityError 兜底（§3）。
- 删实体（`POST /api/team/bots/{name}/delete`，仅持有者）→ 实体 + 记忆 + **本会话**的 bot 会话行。其他会话里的该 Bot 会话行**数据保留但不可读**——校验规则是 `leased_by == 当前 session_id`，原父会话删除后 Bot 无主（`leased_by=None`）或已被新会话租借（`leased_by` ≠ 原 parent），两种状态下旧会话都打不开。这是有意的：隔离规则不在「跨会话读历史」上开口子，留痕只为审计与数据完整性，不为浏览。
- **Bot 名校验落点 = `BotRegistry.spawn` 入口**（唯一起线程前的关卡）：保留字 `{user, lead, system}` + 字符集 `^[\w\-]{1,32}$`；API 层只透传 `BotRegistryError`。

### 6. 工作目录热切换：团队装配随 hub 同生同灭

- `bootstrap_team` 现状直接覆盖模块级 `_hub`，**不停旧 Scheduler**（旧线程继续扫旧目录 scopes）；宿主重置序列够不到 planify 包内单例。修法：新增 `planify.team.shutdown_team()`，**顺序严格**：① `Scheduler.stop` → ② 全部 scope 的 Bot 发 shutdown_request → ③ join Bot 线程（上限 5s，含超时兜底）→ ④ **最后**才 `events.unbind()`（清订阅者、停合并 task）——unbind 提前会让 Bot 线程 finally 阶段的末轮落库事件打到已清空的订阅者，破坏「先存后发」。`bootstrap_team` 替换前先调它；宿主**两处**重置序列都显式调它：`reset_singletons`（`deps.py:361`，测试 / 惰性重建共用）与 `swap_workdir` 的内联重置段（`deps.py:478-490`，它不走 `reset_singletons`）——与 `stop_watcher` 等并列。热切换语义对齐 ADR-0059 §2「在跑 Bot 线程按孤儿后台任务规则跑完」——join 超时的线程随 daemon 消亡。

## 后果

- `plan_tools` handler 多了一个调用方（API 层），须 `asyncio.to_thread` 包裹（§1）。
- 同步聚合器提取触及 `planify/streaming/runner.py` 的 `_stream_collect`——须跑 planify LLM/流式回归组（`test_stream_usage` / `test_thinking_stream` / `test_anthropic_provider`）。
- `tests/test_team_spike.py` 的 `FakeProvider` 重写为产 `StreamEvent`；`test_sessions_store` 加 bot type；`test_gui_tool_filter.py` 不动。
- `session-memory.ts` 的 `MainView` 与 `nav.ts` 注释同步为五视图；icon.ts 补 `team`。
- ADR-0059 §4 第 3 条作废；§11d「停止 = 停全部」在 Bot 级收窄为「该 Bot 所属 DAG 暂停」——`pause_scope` 签名变更，**`chat.py:724` 的 `/chat/stop` 调用方须显式适配**（传 `dag_ids=None` 保持停全部）。
- `ChatEventEmitter` 加 `emit_custom(dict)`；宿主新增 contextvar `_current_emitter`（`chat.py` 建 emitter 后 set、finally reset）供 `event_sink` 间接寻址。
- 新增回归：`recover_scope` 对 paused DAG 不重投递（P0 修复）、`pause_scope(dag_ids=…)` 不误停其他 DAG 的 Bot 且 `/chat/stop` 停全部不变、`_verify_task` 与 `pause_scope` 的竞争、同一 Bot 双 assignment 时 runner 拒绝第二条且 step 回 ready、删会话期间 Bot 落库（IntegrityError 静默）、`shutdown_team` 后旧 Scheduler 不再 tick 且 unbind 在 join 之后、`swap_workdir` 后旧 hub 的 Scheduler 已停、`event_sink` 在无 emitter 上下文时跳过不报错。

## 考虑过的替代方案

- **按需流式（有订阅者才 `stream()`）**：运行时开销差异为零（Bot 一次任务几十次调用），代价是两条 LLM 调用路径 + 两套测试面。**诚实计价**：恒定流式的真实一次性成本 = 新写同步聚合器 + 验证两家 Provider（Anthropic 原生 / OpenAI 兼容）的 `StreamEvent` 完整性（`chat()` 内部已有同构聚合可作参考实现，但不可直接调用）；接受这笔成本换运行时单一路径。
- **每 Bot 一个 `threading.Queue` + `run_in_executor` 阻塞读**：每观看连接占一个 executor 线程，且 `threading.Queue` 是竞争消费，多订阅者要再写分发层。否决，用 `call_soon_threadsafe`。
- **三栏布局（Bot 列表 / DAG / 会话）**：Bot 会话是带输入框的 chat view，中栏宽度不够；两种注意力模式无需同屏。否决。
- **DAG 连线图**：布局算法是独立子项目；步骤数通常 ≤ 10。本期不做。
- **删父会话时连带删 Bot 实体**：「清空全部对话」= 抹掉所有 Bot 记忆。否决。
- **隔离靠 UI 层不校验**：写路径全在新端点，校验成本极低。否决。
- **计划卡状态从 `tool_calls` output 重建**：output 含 `repairs` / `pending` 等无关字段。否决，用独立 kind。
- **保留 jsonl 作第二留痕**：与 DB 粒度不同（整次上班 vs 逐条）、删实体时连带消失、无消费者。否决，下线。
