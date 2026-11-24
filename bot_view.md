doclens GUI「团队」tab（Bot / DAG 可视化 + 可对话的 Bot 会话）

> **2026-11-24 /plan 采访后修订**：本文是采访前的提案，决策已落于 ADR-0060 + CONTEXT.md「团队视图 / 计划卡 / Bot 会话」条目。以下各节与 ADR-0060 冲突处以 ADR 为准——主要差异：① 布局改为「DAG 层级页面 + 点 owner 弹 Bot 会话覆盖层」（非左右两栏）；② 流式恒定开启（非按需）；③ Bot 级停止 = 所属 DAG 暂停；④ 计划卡按钮直调端点（非交互式提问）；⑤ 「SSE 参考 watch-stream.ts」应为参考 `api/chat.py` 的 per-request 队列模型；⑥ 新增 view 实际改 5 处（漏了 `utils/session-memory.ts` 的 `MainView`）；⑦ icon.ts 无 `users`/`team`，需新增。

## 背景（必读，不要重新发明）

ADR-0058（Bot 实体）/ ADR-0059（DAG 派活）已落地于 planify/team/，真机验证三轮
跑通（docs/adr/0059 §11、记忆 team-dag-spike-status）。现状纯命令行式，没有任何
GUI 承载 Bot 与 DAG。本次新增一个**与搜索/对话/日记/文件并列的独立 tab**。

## 用户已定的决策（不要再问）

- 团队是一个独立 tab，与 search / chat / diary / files 并列——不是 chat 侧栏。
- 点某个 Bot 可以查看它的会话，用 chat view 渲染。
- **Bot 会话允许用户输入**——它是真正的对话，不是只读日志。
- **Bot 会话实时流**（SSE），不是轮询。
- **对话历史按 parent 会话隔离，记忆跨会话**：会话 B 的用户点开 remy 看不到会话
  A 在 remy 里说过的话；但 remy 的 memory.md 是它自己的，跨会话积累。这与「协调
  状态隔离、身份共享」（ADR-0059 §1）同一分界线。
- 计划卡仍留在 chat 里（lead 调 group_plan 时内联渲染）。

## 已核实的事实（直接用，不要重新探索）

前端（doclens/web_v2/frontend/src/）：
- 导航单一真相源：utils/nav.ts NAV_ITEMS（AP-31）；新增 view 改 4 处——
  state/types.ts 的 ViewId、utils/nav.ts NAV_ITEMS、app.ts:272 _renderView
  （keep-alive：`${this._mountedViews.has("team") ? html`<team-view ?hidden=…>` : null}`）、
  activity-bar.ts / tab-bar.ts 读 navItems() 无需改。
- **命名冲突**：NAV_ITEMS 里 icon "bot" 已被「个人助手」（lead）占用，团队 tab
  用 "users" 或 "team"（icon.ts 查，没有就加）。
- diary-view（433 行）是最近的参考模板；chat-view 1725 行已拆 3 个 controller。
- 弹窗原生 <dialog>+showModal()；图标 icon.ts；样式只用 tokens.css；z-index 五档；
  组件 >1000 行拆 utils/*-controller.ts。
- SSE 参考 watch-stream.ts；chat-stream.ts 是 lead 流式渲染；ask-card.ts 是
  chat 内结构化卡片范例。
- chat-view 读历史：api/sessions.ts fetchSessionDetail + /api/chat/trace。
- history-list.ts:137 `type?: "search" | "chat"` 联合类型。

后端：
- planify/team/：TeamHub（scope = session_id）、BotRegistry（bots/<name>.json 含
  role/status/leased_by/created_by；memory.md；sessions/<ts>.jsonl）、
  dags/<id>.json、lead 工具 group_plan* / spawn_teammate / list_teammates /
  shutdown_teammate、POST /api/chat/stop 已接 scheduler.pause_scope（常驻入口，
  不挂请求级 hook——§11d）。
- runner._loop：Bot 线程 WORK 循环每轮先 read_inbox（读清空），识别 assignment /
  shutdown_request；messages 是 Anthropic content blocks；会话只在退出时落盘。
- sessions_store.SessionType 只有 SEARCH / CHAT；sessions.py 按 type 过滤多处
  （:82 list、:123 计数、:335 校验、:581 delete_by_type）。
- **planify 不得 import doclens**（test_architecture.py 守护，含动态 import）。
- Bot 线程是 threading.Thread；SSE 是 asyncio——两套世界，真机验证已暴露过此类坑。

**Bot 会话现状的三个缺口**：只在退出时落盘（在跑时看不到）；格式不是 SessionItem
（chat-view 渲染不了）；每次 idle/复活新建 jsonl（一次任务切成多段）。

## 要做的面（按价值排序，逐个采访）

1. **Bot 会话 → 可对话的 chat view**（核心）。
   - 新增 SessionType.BOT（"bot"），SessionSummary 加 bot_name / parent_session_id /
     task_id。
   - runner 落库改为逐条 append（经 bootstrap_team 注入的 session_sink 回调）；
     **一个 task = 一个 Bot 会话**（按 task_id 复用），无 task 的纯对话按
     (bot, parent) 复用最新一个。
   - **实时流**：GET /api/team/bots/{name}/stream?session_id=（SSE），事件对齐
     /api/chat（text_delta / tool_call / tool_result / done），复用 chat-stream 渲染。
   - **用户输入**：POST /api/team/bots/{name}/send（session_id, text）→ 写 Bot
     收件箱 + 落 Bot 会话 message_user + 线程不在则复活（无 task 的纯对话也走
     runner.start）。
   - **停止**：Bot 会话页停止 = 该 Bot 持有的 task 回 ready + Bot shutdown +
     关联 DAG 转 paused（单 Bot 范围的「停全部」），走常驻入口模式。
   - **隔离**：读 Bot 会话、发消息都校验 parent_session_id == 当前 session；
     Bot 被其他会话租借时 → 409「被会话 <标题> 占用」。
   - 采访点：① runner 的 WORK 循环里用户消息与 assignment 混在同一收件箱——
     prompt 里要不要区分「用户说」和「系统派」？② 跨线程推送桥接（见最后一节）。
2. **团队 tab 主视图**（team-view）：左 Bot 列表（全部实体，标注租约；角色/状态/
   当前任务/记忆摘要；点击 → 右侧该 Bot 的 chat view）；右 DAG 列表（当前会话，
   展开步骤/验收/产物/操作 resume·cancel·retry·replan-跳 chat）。DAG 图可视化
   本期不做。
3. **chat 内联计划卡**：group_plan 时渲染结构化卡片（步骤表 + 确认/修改按钮），
   确认 ≡ 发「确认」，修改 → 预填输入框。复用 ask-card 模式。
4. **后台通知**：lead 不在跑时 dag_done / dag_stalled / dag_paused 推 toast，
   点 toast 跳团队 tab。

## 需要新建的后端 API

- GET  /api/team/bots?session_id=                 实体列表（全局，标注 leased_by）
- GET  /api/team/bots/{name}/stream?session_id=   Bot 会话实时流（SSE）
- POST /api/team/bots/{name}/send                 用户对 Bot 说话
- POST /api/team/bots/{name}/stop                 停这个 Bot（单 Bot 范围停全部）
- POST /api/team/bots/{name}/delete?session_id=
- GET  /api/team/dags?session_id=                 当前 scope 的 DAG + 步骤 + 验收
- POST /api/team/dags/{id}/{resume|cancel|retry}
- 产物预览走现有 /api/preview；Bot 会话历史走现有 /api/sessions + /api/chat/trace

## 约束

- 只做 Web GUI。会话身份 = session_id，无兜底。
- 团队工具在 planify.team.plan_tools，不要再暴露一份给前端——API 直接调
  TeamHub/Scheduler（读）或复用 plan_tools handler（写）。
- DAG 只看当前 session；Bot 实体全局可见但标注租约；**Bot 会话读写按 parent 隔离**。
- 新增 SessionType.BOT 同步：sessions.py :82 list 排除 bot、:123 计数排除、:335
  校验、:581 delete_by_type 级联策略（删用户会话时其 Bot 会话怎么办——采访）、
  history-list.ts 类型。
- **runner / scheduler 不得感知 asyncio**——线程世界与事件循环的边界在 TeamHub
  桥接层。
- 索引风暴（§11g）：产物列表走轮询 DAG 状态，不监听文件事件。
- 先端到端最小闭环：团队 tab 只读 Bot 列表 + 点 Bot 看实时会话 + 发一句话 Bot
    回一句，再铺 DAG 操作/计划卡/toast。

## 第一个问题从哪开始

面 1 的**跨线程推送桥接**：Bot 线程产生事件 → SSE 推给页面。我倾向 TeamHub 持
per-bot 订阅者（threading.Queue 列表），runner 经 session_sink 同时落库 + 入队；
asyncio 侧每个 SSE 连接用 `run_in_executor` 阻塞读 Queue 再 yield——最简单，但
每个订阅占一个 executor 线程（默认池大小有限）。备选：单后台线程 fan-out 到
asyncio.Queue（`loop.call_soon_threadsafe`）。你挑战这个取舍。

## 不要做的事

- 不重写 planify/team/ 逻辑；不碰旧 TeammateManager。
- 不做 DAG 图可视化；不复刻 group_plan_revise 编辑器；不另写 Bot 会话渲染组件。
- 不让 Bot 会话出现在 chat tab 的历史列表。