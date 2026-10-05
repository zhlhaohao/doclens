# ADR-0035: 主动停止 = 信号 + 取消——静默期停止无效果的根治

- 状态：已接受
- 日期：2026-10-05
- 关联决议：ADR-0028（断开续跑——恢复态停止的受害场景）、ADR-0021（外部访问门禁——hook 唤醒机制先例）

## 背景

用户报告：AI 对话长时间思考的轮次中点停止，极少数情况下无效果。定位
的具体形态是**恢复态**——中断会话后重新打开（ADR-0028 断开续跑的
generating 占位 + 5s 轮询态）点停止，动画长时间不消失。

根因链（代码核实）：

1. 恢复态没有本地 SSE 流 → 前端 `_stop()` 无 controller 可 abort →
   没有连接断开 → **SSE 生成器的 finally 收尾分支（含 `agent_task.cancel()`）
   永远不会再执行**（SSE 生成器在断开放生时已退场）；
2. 恢复态的停止只剩 `request_stop` 一层：set Event + 中断 hook；
3. Event 检查点只在 **provider 流事件之间**（runner 循环顶 + 事件间隙）
   执行。「长时间思考」期间若网关不下发任何流事件（深度思考不流式、
   首 token 前静默），检查点一次都不触发——**Event 被 set 了也没人检查**；
   hook 也无事可做（无挂起 ask、无在跑 shell）。auto-compact 的摘要
   调用（`achat`，可达分钟级）是同一形态的静默期；
4. 前端 reload 时收尾未完成 → `generating=true` → 动画保持，直到 LLM
   调用自然返回（可达数分钟）。

在场停止（正常页面点停止）不受此害纯属侥幸：abort 触发连接断开 →
SSE finally 分支 cancel task——**cancel 这条万能路径一直存在，只是
恢复态够不着**。

## 决策

**`POST /api/chat/stop` 从「只发信号」升级为「信号 + 取消 + 等收尾」：**

1. **信号**：`request_stop` 照旧（set Event + 唤醒挂起 ask + 杀 shell
   进程树）——优雅检查点退出路径保留，正常流式时 agent 自查退出；
2. **取消**：`chat_runner.get_task(session_id)` 拿到活跃 task 且未 done
   → **立刻 `task.cancel()`**。cancel 在任意 await 点打断（CancelledError
   沿 await 链传播），是静默期的唯一可靠停止手段。与在场停止的 SSE
   finally cancel 同语义（双重 cancel 天然安全——`Task.cancel` 对已
   done/已 cancel 的 task 是 no-op）；收尾落库全在 `_run_and_finalize`
   的 finally（同步 SQLite 写），cancel 不丢收尾、半截文本仍落库
   （2026-09-22 语义不变）；
3. **等收尾**：`asyncio.shield` + `wait_for(2s)` 等 task 收尾完成才返回。
   前端 `stopChat` 返回即 `generating=false`，单次 reload 必见停止
   生效，不靠 5s 轮询兜底。2s 超时只是极端兜底（收尾是毫秒级同步写；
   等不到也不阻塞停止——task 终将收尾，轮询自然收敛）。

配套：

- **`chat_runner.get_task` 的「消费方不得 cancel」禁令解除**（docstring
  同步修订）：该禁令源于「保检查点退出、收尾落盘有序」的顾虑，但
  收尾全在 finally、SSE finally 路径本就在 cancel——禁令名存实亡。
  停止端点成为 cancel 的唯一合法入口（测试/诊断消费方仍不得 cancel）。
- **前端 `stopChat` 挂 5s 超时**（`AbortSignal.timeout`）：后端等收尾
  使 stop 响应有了延迟面，不设超时会在极端情况下把 `_stop()` 的
  abort 卡住（UI 停在流式态——G2 形态）。

### 否决的替代方案

- **先宽限再 cancel**（set Event → 延迟 1.5~2s 未停才 cancel）：保留
  优雅退出（半截可走参考资料策展），但引入延迟任务与两条语义分岔，
  且静默期白烧 2s token。在场停止今天就是立即 cancel，统一立即语义
  更简单。否决。
- **引擎层静默超时**（planify provider 的 astream 事件间加超时回检查点、
  achat 同理）：治本于引擎层（TUI/CLI 也受益），但改动两个 provider +
  压缩链路、每层超时轮询开销，而 cancel 已全覆盖。否决——引擎零改动。

## 边界（重要）

- **半截不走参考资料策展**：被 cancel 的半截文本退回原文落库（与
  断线/异常路径同语义）；「停止时已生成的部分保留落库」本身不变。
- **停止按钮与停止端点语义对齐**：在场/恢复态两个入口现在都最终落到
  cancel——不再存在「有的入口能停、有的入口看运气」的分岔。
- **planify 零改动**：CancelledError 沿 await 链传播是 asyncio 原生
  语义，引擎层无感知（无需发版）。

## 后果与风险

- 正常流式中的停止也从「检查点退出」变为「大概率 cancel 先到」——
  优雅检查点退出的 emitter done 事件（reason=stopped）可能不再发出，
  前端以流结束/abort 兜底（现有代码已如此处理断开路径，无新依赖）。
- cancel 时若正处于落库事务中（同步段执行中），cancel 要等当前同步段
  完成才生效——落库原子性不受影响，只是停止延迟毫秒级。
- `stopped` 诊断字段语义微变：True 仅表示「信号命中活跃流」，不再
  保证「靠信号停止」（可能实际由 cancel 完成）。
