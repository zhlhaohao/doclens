---
status: accepted
date: 2026-11-23
---

# DAG 派活：会话作用域团队 + 常驻调度器 + 程序验收

## 背景

ADR-0058 立了 Bot 实体，但 lead 侧仍是**裸 agent**：只有 `spawn_teammate` / `send_message` / `broadcast` / `read_inbox`，没有派活先验，任务靠 `task_create` 建便签 + Bot 空闲自动认领 + 模型说完成就完成。现状三个病根：

1. **回合制宿主容不下常驻协作**——lead 只在循环内读收件箱（`runner.py:723`），回合结束 DAG 推进就停；这是 2026-11-17 团队工具被 `GUI_FILTERED_TOOLS` 降级的根因②。
2. **多会话串线**——team 层（`TaskManager` / `MessageBus` / `TeammateManager`）是进程单例（doclens `CortexAgent` 进程级，`_stage_runtime` 每次新建一套指向同一 `{workdir}/.planify/team/`），多个 chat 会话共享同一张任务板和 `lead` 收件箱；`read_inbox("lead")` 原子读清，谁先读谁拿走。
3. **完成无裁判**——`task_update(completed)` 直接标完成（`task_manager.py:118-126`），依赖解除靠猜。

Pi Bot 的答案：程序持有 DAG，coordinator 提交计划后由引擎按拓扑派单，程序验收决定节点何时完成，失败自动打回。本 ADR 移植该控制面，不移植群聊产品形态。

## 决定

### 1. 团队作用域 = 聊天会话

- 作用域 id **只用 Web `session_id`**，无兜底（CLI/TUI 已废弃，不再为「无会话 ID」留分支）。
- 布局：`{workdir}/.planify/team/scopes/<session_id>/{tasks,inbox,dags}/`。任务板、收件箱、DAG、Bot 线程（`threads[(scope, name)]`）全在作用域内，**跨会话互不可见**——两个会话是两个独立团队。用户开两个窗口各看各的 DAG，不存在跨会话看 DAG（要看就切回那个会话）。
- 会话删除 → `scopes/<id>/` 整目录删、该 scope 活 Bot 收 shutdown_request、租约释放。Bot 实体与记忆保留。
- **Bot 租约**：Bot 实体是工作目录级共享的身份（0058），租约是同一时刻只属一个会话的独占使用权。被租借的 Bot 其他会话 spawn 被拒（资源占用，非隔离失败）；会话结束或进程重启释放（租约是运行态不持久，启动时 `leased_by` 非空一律清空）。后来者复活继承 Bot 全部记忆——记忆属于 Bot 不属于会话。
- 文件系统**不隔离**：Bot 改的是用户真实文件，作用域隔离的是协调状态。

否决：进程级团队（现状串线）、Bot 实体按会话隔离（违背 0058，记忆无法跨会话积累）、多会话同时租同一 Bot（收件箱与线程归属冲突）。

### 2. 调度器：进程单例常驻 daemon

- 一个 daemon 扫全部作用域，各推各的 DAG（无跨作用域的边）。
- 惰性启动：首个作用域建团队时起；**不用团队不起线程**。
- 退出条件：全部作用域无 `ready|in_progress` 任务且无活 Bot。`stalled` / `paused` DAG 的 pending 下游不计入（它们等人，不等调度器）；重规划 `group_plan_start` 或 `group_plan_resume` 重新唤醒。
- 节奏：`Event.wait(timeout)` 轮询兜底（定时更新进度）+ `task_update(completed)` / `idle` handler `Event.set()` 即时唤醒（零延迟派单）。
- 热切换：整个团队装配是目录相关单例，丢弃重建；在跑 Bot 线程按「孤儿后台任务」规则跑完。

否决：lead 拉动（回合结束 DAG 停摆——现状病根）、teammate 回调驱动（Bot 做完任务进 idle 轮询不退线程，回调点不稳定）、每会话一个调度线程（扫同一目录重复派单）。

### 3. DAG 数据模型

```
Plan{ name, output_dir?, steps[] }
Step{ step_id, subject, instructions,
      assignee?: str,            # 省略 = 按 role 开放认领
      role: str,                 # 内置角色 id，assignee.role 必须匹配
      depends_on: [step_id],
      inputs: [{step, deliverable_id}],   # 下游读上游哪个交付物
      deliverables: [{id, path, kind}],
      acceptance: [{check, ...}],
      max_fix_rounds?: int = 1,
      skill?: str }              # 引用角色 skill，自动带入 contract（只能收紧）
```

- 边引用 **step_id**（lead 提交时程序还没分配 task id），`inputs` 显式列出上游交付物——下游 Bot 知道读哪个文件，不靠"阻塞解除自己找"。
- 任务状态：`pending`（有未完成依赖）/ `ready`（可派）/ `in_progress` / `done` / `failed` / `blocked` / `superseded`。
- 一个作用域可同时有多个独立 DAG；DAG 间无边。同一 Bot 同时只做一个任务（租约在 Bot 粒度），两个 DAG 争同一 Bot 时排队。
- `output_dir`：DAG 级交付目录，计划卡显示，默认 `{workdir}/输出/<dag_id>-<slug>/`，用户确认前可改。所有 `path` 相对于它；Bot 指令自动注入「交付物写到 output_dir」；验收在那里查。用户在一处找到全部产物，Git 同步带走。

### 4. 提交与确认

- `group_plan(Plan)` → 校验 → DAG **草稿态**，返回 dag_id + 计划卡文本。
- 校验（只报**首个错** + 字段路径 + 合法示例——Pi Bot 教训：报一串模型会放弃）：step_id 唯一 / depends_on 无环且引用存在 / inputs 引用的 deliverable 存在于所依赖步骤 / assignee 存在且 role 匹配 / skill 存在于该角色 skills / acceptance check 类型与 deliverable kind 匹配。
- **用户确认**（否决自动开始）：lead 用现有 `ask_user_question` 发计划卡（开始 / 修改）；用户也可直接打字，lead 下一轮 `group_plan_revise(dag_id, Plan)`（完整替换草稿，非增量 patch——模型做 JSON 合并不可靠）。
- 草稿态可任意改；`group_plan_start(dag_id)` → **执行态不可变**，唤醒调度器。执行态变更只能重规划。

### 5. 程序验收

- `task_update(status="completed")` → handler **先跑验收**：全过 → `done` + 唤醒；不过 → `fix_rounds += 1`，未超限回 `in_progress` 并返回未达标项（Bot 本轮继续修），超限 → `failed` + 唤醒。
- 本期 7 种 check（本地可查、不调模型）：`exists` / `sections` / `min_citations` / `table_columns` / `verdict` / `tests_pass`（pytest exit 0，120s 超时）/ `manual`。
- `manual` 不阻断，DAG 末尾汇总由用户统一确认。
- `skill` 字段：从该角色 skill 的 SKILL.md frontmatter `contract` 读 deliverables/acceptance 合并，lead 显式写的优先、**只能收紧不能放松**。

### 6. 失败路径

- 步骤 `failed` → DAG **`stalled`**：failed 的下游链停，**其他分支继续推进**（用户派「周报 + 笔记 + PDF」，PDF 挂了不该判死已完成的周报）。
- 通知：调度器写 `{type:"dag_stalled", dag_id, failed_step, reason, fix_attempts}` 到 lead 收件箱；SSE toast 是 doclens 侧范围外依赖。
- lead 处置三选一：`group_plan_replan`（新计划只含新增与未完成步骤，不得含已 done 的 step id；可依赖已 done 步骤；被替换步骤标 `superseded`；需用户确认；**全程最多 2 次**）/ `group_plan_retry(reset_fix_rounds=True)`（偶发失败原样重试）/ `group_plan_cancel`（放弃，活 Bot 收 shutdown_request）。

否决：整 DAG 判 failed（一个分支拖死全部）、DAG 永远 active 跳过 failed（调度线程永不退）。

### 7. 并行：有意不隔离

- 同一 DAG 内无依赖步骤**并行跑**，共享 workdir，**不做隔离**——两个 Bot 写同一文件后写覆盖先写、静默。这是有意接受的风险（否决 `writes` 声明锁——模型漏声明比不声明更危险，假安全感；否决全串行——太慢；否决 git worktree——文档产出非代码合并，merge 语义对 md 无意义）。
- 两个补丁：①**交付物被改检测**——调度器派下游前检查上游 deliverable 仍存在且 mtime 不早于上游 done 时刻，否则不派、DAG 转 stalled、lead 收件箱收到「交付物被修改/删除，可能被并行步骤覆盖」（事后检测，把静默变有声）；②`team-dispatch` SKILL.md 明写「并行步骤交付物路径必须互不相同；要改同一文件就用 depends_on 串起来」。
- Bot 写入范围**不限制到 output_dir**——Bot 本就有知识库根读写权（0058 角色权限决定），DAG 只告诉它交付物放哪；限制会破坏合理场景（读源文件、改源码后把报告放 output_dir）。文件安全靠角色权限与「外部访问门禁」。

### 8. 工具面

- lead 新增 8 个：`group_plan` / `group_plan_revise` / `group_plan_start` / `group_plan_status`（lead 与 Bot 均可调，Bot 查自己任务上下文）/ `group_plan_replan` / `group_plan_retry` / `group_plan_cancel` / `group_plan_resume`（暂停恢复，见 11d）。
- Bot 新增 `task_report(progress_note)`：中途汇报进度写进 task 记录供 status 显示，不触发状态变化（可选；没有它 Bot 只能沉默或 `send_message`——聊天通道不该混用）。
- `task_update(status="completed")` 语义变更：触发验收。
- **`task_create` 从 lead 工具表移除**（lead 只能经 `group_plan` 建任务，防绕过 DAG 走认领老路）；`task_list` 保留；`task_update` 仅对 Bot 开放（lead 不该手动标完成）。

### 9. 技能与先验

- `team-dispatch` 技能放 **`doclens/skills/`**（宿主技能，走现有部署链路）——方法论属宿主、角色属框架，分家。内容：怎么拆步骤、依赖只写真实输入关系、验收怎么选、并行路径互异、何时重规划。
- 角色清单及能力一句话从 `planify/roles/*.json` 的 `name` / `description` **派生注入** lead system prompt（角色新增自动更新，不手写）。
- 不把方法论塞 system prompt 常驻——DAG 级派活是领域不是段落。

### 10. 前置条件与实施形态

- **ADR-0058 与 本 ADR 必须作为一个整体落地**，不按 ADR 编号分阶段。两份 ADR 分开写是决策记录的需要，但实施上互相缠绕：0058 §8 的工具面引用本 ADR 的 `group_plan_status`/`task_report`（已改分期，但分期本身就说明缠绕）；0058 §9 的文件布局「inbox 不变」在本 ADR 移入 scopes/；0058 §6「复用 ≠ 复活」依赖本 ADR 的租约与 scope 收件箱。**按 ADR 编号分阶段会卡死在中间态**（0058 落地后 Bot 能用但无 scope/调度器，0059 落地前 config.json 已删）。
- **实施顺序建议**：先做端到端最小闭环 spike——一个 Bot、一步 DAG、一次验收、一次停止（停全部）、一次重启恢复——把 §11 全部断点跑通后再铺功能。 spike 的代码才是下一轮该评审的对象，不再是 ADR 文字。
- 团队 5 工具从 `GUI_FILTERED_TOOLS` 移出，`tests/test_gui_tool_filter.py` 同步。

### 11. 线程、身份与恢复（实施前必须解决的链路断点）

本节是按「用户打字 → Bot 完成 → 用户看到结果」全链路走查后补的，每条都对应现有代码里一个会让链路跑不通的点。

**11a. Bot 也过门禁——现状是 Bot 无门禁（安全洞，不是可用性 bug）。** 外部访问门禁只在两处接线：`runner.py:1596 _run_guarded()`（**仅 lead 流式工具循环**）与 `registry.py:528 wrap_shell_handler_fail_closed()`（**仅 shell 三件套**）。结构化工具 `read_file/write_file/edit_file` 的 handler 本身不做门禁——Bot 线程经 `self.registry` 直接调用，**不过 runner、不过门禁**。现状：Bot 可对知识库外任意路径写文件，不经门禁、不留痕、不受会话授权约束。**决定**：Bot 结构化工具也过 `classify_tool_call`；无交互渠道 → fail-closed。Bot 的授权通道 = **lead 的会话授权账本**（同一 scope 共享，与「子代理经 session_id 继承」同模型）——`Thread(args=...)` 显式传 scope_id、线程入口 `set_current_session_id(scope)`，使账本可查。**此注入同时是所有 scope 敏感工具的统一前提**：门禁 / `read_inbox` / `send_message` / `group_plan_status` / `record_grant` 的 scope 参数——不只门禁用。Bot 的 shell 进程登记随 scope 走（`kill_session_shell_procs(scope)` 可命中）。**首次使用必现的阻断对策**：`group_plan_start`（**用户确认后**，不是 `group_plan` 提交时——草稿态未确认就授权会先于用户意愿，且 `group_plan_revise` 改 output_dir 会让 grant 单调膨胀无回收）执行 `record_grant(scope, [output_dir], "write")`——DAG 级授权，用户确认计划卡即视为对 output_dir 的写授权（否则 Bot 首次写交付物时账本为空 → fail-closed 卡死）。其他外部路径仍 fail-closed（正确）。**注意**：仅扩展账本无效——账本在 Bot 路径上此前没有消费方，本节同时补消费方（过门禁）。**范围外**：Bot 独立向用户申请授权的模型（独立 ADR）。

**11b. Bot 线程死亡 ≠ 任务失败。** `teammate_manager.py:324-327` LLM 异常 → `_set_status(shutdown)` → `return`，任务仍 `in_progress`，调度器以为有人在做永远等。**必须**：线程退出（`finally`）时若持有未完成任务 → 标 `failed(reason="bot_thread_died")` → 唤醒调度器。

**11c. Bot 上下文压缩。** teammate 线程的 `messages` 只增不减，无 compact、无 token 计数，50 轮上限是唯一护栏——DAG 步骤几十轮工具调用，一个任务没做完就撞上下文窗口。**必须**与 lead 同构：微压缩（清旧 tool_result）+ 阈值压缩；压缩后**重注入**角色身份、任务指令、交付物要求（否则 Bot 压缩后忘了在做哪个任务）。

**11d. 停止 = 停全部，且需要常驻停止入口（不挂请求级 hook）。** `chat_interrupt.py:83-100` 的 hooks 是**请求级**——每次 chat 请求开始注册、收尾注销（`chat.py:253,554`），DAG 活跃期远超单次请求；lead 不在跑时 hooks 表空、`request_stop` 无任何回调。**决定**：①停止 = lead 回合中断 + 该作用域全部执行态 DAG 转**暂停** + 调度器停派新步骤 + 在跑 Bot 收 shutdown_request；②DAG 暂停**不挂请求级 hook**——`request_stop` 查 `_interrupts` 无命中时仍查 TeamHub 并暂停该 scope 的活跃 DAG（doclens 的 `request_stop` 访问 TeamHub 是新的跨层依赖，本 ADR 显式引入）。暂停可恢复：`group_plan_resume(dag_id)`，被中断步骤回 `ready` 重派（保留 fix_rounds）。新增 lead 工具 `group_plan_resume`（第 8 节 7 个 → 8 个）。

**11e. 进程重启恢复。** 启动时扫全部作用域：active DAG 中 `in_progress` 的步骤 → 回 `ready`（owner 线程已灭；fix_rounds 保留）；**发现任何 active DAG → 立即启动调度器**（惰性启动的例外条款，否则 `ready` 任务躺着不动直到用户下次 spawn）。**关键**：重启后无活 Bot 线程（租约已清空），调度器派单 = 写收件箱 + **确保目标 Bot 线程活着**——目标 Bot `shutdown` 态时**调度器自动 spawn 复活**（实体/角色/记忆俱在，0058 的复活路径由调度器触发而非 lead）。**复活时 `prompt` 传占位（如「你有新任务，请查收」）不传 instructions**——任务指令只经收件箱投递一次，否则 Bot 会收到两遍（spawn prompt 进 messages + 收件箱 assignment），可能做两遍。否则只写收件箱无人读、调度器永远空转（`ready` 任务已派单但没人接 → 不满足退出条件）。重派意味着 Bot 重做——产物可能已部分写入，靠验收兜底（接受：`exists` 类检查会过但内容可能半截，这是重启场景的已知局限，与 Pi Bot 同）。租约启动清空已在第 1 节。

**11f. 计划卡确认支持两种提问模式 + 确认状态程序化。** doclens 有交互式（回合内阻塞 300s）与对话式（`PLANIFY_ASK_MODE=chat`，断回合、答案 = 用户下一条消息）两种。**两种都要支持**；对话式下草稿 DAG 跨回合存活，lead 下一轮同时处理「用户要求的修改」与「重新展示计划卡」。**关键**：`group_plan` 提交后把 `pending_confirmation: dag_id` 写进 scope 状态文件；对话式下新回合的 system prompt 或 lead 工具结果里**程序注入**「有一个 DAG 草稿待确认（dag_id，标题），用户这条消息可能是确认或修改——调 `group_plan_status` 确认」。**不能让模型靠读对话历史推断确认语义**（ADR-0033 对话式的固有代价，本场景放大：确认 vs 修改是两个不同工具调用）。

**11g. `output_dir` 默认在知识库内。** `{workdir}/输出/<dag_id>-<slug>/`——产物即知识：进索引、随 Git 同步、用户在文件页直接看到。与即梦生成图落盘、PDF 译本「译本即知识」同一哲学。否决放协调目录（用户找不到、会话删除连带删产物）与 gitignore（与产品哲学相悖）。**索引风暴对策**：DAG active 期间对 `output_dir` 的 FileWatcher 事件**合并/延迟**（标 dirty，DAG 完成/暂停/stalled 时统一触发一次索引）——多个 Bot 并行写多文件 × 多次 write/edit，逐文件增量索引会风暴；日记/即梦先例是「一个文件写完一次性索引」，DAG 是并发增量写，需专门处置。**会话删除不删产物**（`scopes/<id>/` 整目录删的是 DAG 元数据；`输出/` 下的产物文件保留——删除会话 ≠ 删除知识，实施时防级联误删）。

### 12. 实施注意（不改架构，但第一次就会踩）

- **MessageBus 装配层变更**：`get_team_tools_handlers(team, bus)` 现在装配期绑死一个 bus——跨 scope 的 lead（CortexAgent 进程单例，team_tools 注册一次）拿的是同一个 bus，scope 失效。**改**：`MessageBus` 每 scope 一个实例（`inbox_dir = scopes/<sid>/inbox`）；team_tools handler **不在装配期绑 bus**，运行时按 `get_current_session_id()` 查 TeamHub 取当前 scope 的 bus。这是装配层签名变更，两个 ADR 的原描述都漏了。
- **验收不在 Bot 线程跑，也不在调度器主循环同步跑**：`task_update(completed)` handler 若同步跑验收（`tests_pass` 120s 超时），Bot 线程阻塞 120s 不响应 shutdown、不读收件箱；若挪到调度器主循环同步跑，**一个 120s 验收卡死全部 scope 的 DAG 推进**。**改**：handler 立即返回「验收中」并标任务 `verifying`（新增状态）；调度器发现 `verifying` 任务时**提交到线程池（或起一次性线程）**执行验收，主循环继续扫其他 scope；验收线程入口 `set_current_session_id(scope)`（否则 `tests_pass` 的 shell 进程登记到空键，停止杀不到）；完成后标 `done`/`failed` 并唤醒。Bot 拿到「验收中」可继续干别的或 idle。
- **成本兜底**：「DAG 结构是上限」只限任务数，**不限 LLM 调用次数**——10 步 × 50 轮 × fix_rounds × 多 DAG = 调用失控。除现有「单 Bot 单任务 50 轮」外，加「**单 DAG 总 LLM 调用上限 500 次**」（超了 DAG stalled，lead 收件箱通知）。**LLM 上限触发的 stalled `failed_step` 为空、`reason="llm_budget_exceeded"`**（与 §6 步骤 failed 导致的 stalled 区分——后者 `failed_step` 有值；`group_plan_replan` 的「只含未完成步骤」校验对前者语义明确：无 failed 步骤，全部 pending 即未完成）。完整预算（costUsd/activeSeconds）仍属独立 ADR。
- **`tests_pass` 的执行环境**：调度器线程跑验收没有 Bot 上下文；`pytest -q <path>` 以知识库为 cwd 没有环境。check 必须带 `cmd`（全路径或明确 workdir），或由 `team-dispatch` SKILL.md 引导 lead 写对。
- **调度器异常隔离**：一个作用域 task 文件损坏（JSON 解析失败）不得崩掉调度线程（全进程 DAG 停摆）。每 scope 扫描 try/except + 坏文件标记 + 日志，参照 Vision Worker 容错。
- **`list_teammates` 语义**：作用域下返回**全部 Bot 实体**（lead 要知道有哪些可租才能填 `assignee`）+ `leased_by` 字段标注占用；被占用的 Bot 提示要说清「被会话 <标题> 占用」，否则 lead 反复试同名失败。
- **执行中改 DAG**：用户在 DAG 跑着时说「别出 PDF 了」——lead 只能 cancel 整个 DAG 或等它完。不提供「移除未开始步骤」的轻量操作（用户确认不需要，cancel + replan 可达）。
- **会话删除钩子**：`sessions.py:530 delete_session` 与 `:579 delete_by_type` 两处都要触发 scope 清理（整目录删、活 Bot shutdown、租约释放）。
- **`team-dispatch` 技能的验收标准**：技能是文字，调度器有 7 种验收、技能本身零验收——这是全案唯一没定验收标准的部分。落地时附**固定评测集**：5 个派活任务 → lead 产出的 DAG 经程序校验的**格式通过率** + 人工读 DAG 的**合理性评分**（拆得对不对、owner 选得对不对、该串行的有没有写成并行）。没有评测集，「提示词零引导」的老病会以「技能写了但没用」的形式复发。

## 范围外

- SSE 主动推送（Bot 完成 / DAG stalled 的 toast）——doclens 侧
- 预算（modelRequests / costUsd / activeSeconds）——独立 ADR；本期 `group_plan_status` 仅显示各 Bot usage（数据源 `emit_usage`）
- 自动轮次上限（cycle / autoRoundLimit）——DAG 结构本身是上限，自由聊天轮次是另一话题
- 按 role 选模型（0058 留位）
- Bot 之间互相派活（只有 lead 能 `group_plan`，与 Pi Bot「只有 coordinator assigns」同哲学）
- **内容质量审查**：程序验收是**形态校验**（文件存在/章节/引用数），**保证「Bot 干了活」不保证「活干对了」**——内容全编也能通过验收。reviewer Bot 审查（Pi Bot 的 `code-reviewer` + `review_finding`）与用户复核是另一层；`team-dispatch` 技能的评测集评的是 lead 的 DAG 质量，不是 Bot 的交付物质量。用户须带此预期使用，不在本 ADR 建审查层。

## 后果

- `.planify/team/scopes/` 布局发版即有数据依赖；`task_create` 移除是对 lead 工具表的破坏性变更（有意）。
- 并行覆盖风险被接受且只做事后检测——用户须知道这是设计选择而非遗漏。
- 回归：`tests/test_architecture.py` `tests/test_gui_tool_filter.py` `tests/test_skills_config.py` + 新增 `tests/test_team_scope.py` `tests/test_dag_scheduler.py` `tests/test_acceptance.py`。实施时核实 planify 内置技能的部署链路（避免「技能四份副本」坑）。

## 考虑过的替代方案

- **teammate 回调驱动调度**（`idle` / `task_update` 时推进）：零常驻线程，但 Bot 做完进 idle 轮询不退线程，回调点不稳；用户明确要求定时更新进度 → 常驻轮询 + 事件唤醒。
- **每会话一个调度线程**：扫同一目录重复派单，且与「团队作用域」冲突——调度器是基础设施不是作用域成员。
- **`runtime_id` 兜底作用域**：CLI/TUI 已废弃，兜底是死代码。
- **自动开始 DAG**：用户要求确认权与确认前可经对话修改（如「最后加一个出 PDF 的节点」）。
- **`writes` 声明 + 文件锁并行**：模型漏声明比不声明更危险。
- **整 DAG 判 failed / 永远 active**：前者一个分支拖死全部，后者调度线程永不退。
