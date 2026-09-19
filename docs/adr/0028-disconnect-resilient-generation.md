# ADR-0028: 断开续跑——SSE 消费端断开不再终止生成

对话生成中浏览器关闭/断网/切走时，后台 agent 从「断开即停」翻转为「续跑完本轮并落库，回来可见」；用户主动点停止按钮不受影响，仍然立刻停止。2026-09-19 决议。

## Context

旧行为（chat.py 的 CancelledError 分支 `request_stop`）：SSE 消费端断开 → 三层兜底（Event 检查点退出 + 中断 hook 唤醒 ask + cancel）→ 半截落库。设计动机是「堵住前端不读了、后端继续烧 token 的泄漏」。

痛点：AI 一轮可达分钟级（多工具循环 + 长输出）。误关页/网络闪断即丢整轮——用户回来只看到问题没有答案，token 已花的部分白丢。Claude Code 的 headless/resume 形态证明「生成与消费者连接解耦」是更合理的默认。

两个结构事实决定了改造不是删掉 request_stop 就完事：

1. **展示层 `message_ai` 由前端落库**（chat-view 流结束后 appendSession）——前端不在场时没人写，用户回来看不到那轮回答（展示映射只认 message_user/message_ai）。断开续跑必须配套后端补写。
2. **断开即停顺带堵住了同会话并发**——续跑使「旧轮未完、新消息又来」窗口敞开，两轮交错写 session_items 会破坏 raw_messages 配对（孤儿 tool_result 400 那类问题）。必须加会话级生成锁。

## Decision

### 1. 判据：区分「主动停止」与「消费者断开」

断开在连接层无法区分来源（关页/断网/前端 abort 都是连接关闭）。判据用**停止信号的到达时序**：

- 前端 `_stop` 改为**先 `await stopChat()`（停止信号落 interrupt registry）再 abort 连接**；
- SSE 生成器 finally 的早退分支：`interrupt.is_set()` → 停止路径（request_stop + cancel，**立刻停止不烧 token**，保持旧三层兜底）；未 set 且开关开 → 断开放生。

时序正确性依赖前端先停后断；后端旧前端（fire-and-forget stop + 立即 abort）在信号晚到的极小窗口内会把主动停止误判为断开——续跑而非立停，属可接受的窗口竞态（升级前端后消失）。

### 2. agent task 与 SSE 生成器生命周期脱钩

`chat_runner` registry（会话级，`doclens/web_v2/chat_runner.py`）：

- `try_register` 原子注册（同会话并发只有一个成功）+ `done_callback` 自动注销（防异常路径漏注销导致会话永久占用）；
- 断开放生时 registry 持有 task 强引用（asyncio 只持弱引用），落库/补写由 `_run_and_finalize` 的 finally 自行收尾；
- interrupt 的注销从 SSE 生成器 finally **挪到** agent 收尾——续跑期间 `/chat/stop` 仍可经 registry 寻址。

### 3. 展示层落库统一到后端（原「断开补写」的治本取代）

初版实现是「前端写 message_ai + 后端仅在断开轮补写（append_display_ai_if_absent 判重防双写）」——双生产者并存，判重与 client_gone 补写分支复杂。当日即治本取代：**后端成为展示层的唯一生产者**：

- 入口 `ensure_message_user`（老前端已写的同内容末尾条目幂等跳过，过渡兼容）；
- 收尾 `append_message_ai` 无条件判重（409 会话锁保证无并发写者）：正常完成 / 断开续跑（含续跑中被 stop 的半截——已生成部分用户回来可见）都落；**在线主动停止不落**（`client_gone or not interrupt.is_set()`）——对齐「UI 当场丢弃半截、重进会话只留问题」的既有语义；
- payload 与历史前端写入同构：content（策展文本，错误并入 ⚠️ 对齐前端展示格式）+ tool_calls（emitter 积累，含 duration_ms，未完成对过滤）+ references（恒 []——该 SSE 事件后端本无产生点，历史前端写入也恒空，等价）；
- message_count 由后端 `count_live_messages` 刷新（与回退同口径，消灭前端传本地 messages.length 的第二口径）。

前端自此在 chat 路径零 DB 写入（search 会话的 result 条目仍走 PATCH /sessions）。

### 4. 会话生成锁（409）

`POST /chat` 预检 `chat_runner.is_running` → 409 SESSION_BUSY；`_stream_agent_response` 内 `try_register` 原子兜底竞争窗口。防两轮交错写库。

### 5. 恢复态可见性（detail.generating）

`GET /api/sessions/{id}` 返回 `generating`；前端恢复会话时若在生成中：末尾「思考中」占位 + streaming 态（禁输入、停止钮可用），停止/完成后重拉可见。不做 SSE 断点续传/replay（成本陡增收益低——回来刷新即见全量）。

### 6. 开关

`CORTEX_CHAT_DISCONNECT_CONTINUE`（默认 **true** = 续跑；false = 旧行为断开即停）。token 成本语义翻转的退路。

## Consequences

- **关页也烧 token**（直到本轮跑完）——默认行为的成本语义变化；介意者关开关。
- 断开续跑期间正在执行的工具（to_thread 线程）不可被后续 stop 中断——stop 只影响检查点之后的动作，当前工具调用会跑完（与旧断开停止的线程行为一致）。
- 服务重启会丢续跑中的轮次（registry 内存态、无进程级 resume）——与旧断开停止的丢失面等价，不追求更多。
- ask 挂起 + 断开：中断 hook 按拒绝唤醒，流按拒绝继续收尾（不无限等）。
- `background_run` 的后台命令本就与对话流解耦，不受影响。
- 旧版前端 + 新后端：主动停止存在小概率被误判为断开续跑（见 §1 时序注）。
