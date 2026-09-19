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

### 3. 展示层 message_ai 后端补写（判重防双写）

`_run_and_finalize` finally：`client_gone`（断开放生时置位）→ `store.append_display_ai_if_absent`（最后一个 message_user 之后已有 message_ai 则跳过）。策展文本优先，中断半截退回 `emitter.get_full_text()`；payload 与前端写的同构（content/tool_calls/references: []）。被 stop 停止的断开轮同样补写半截——已生成部分用户回来可见。

正常路径（SSE 耗尽到哨兵）不补写——前端在场，由前端写（现状分工不变）。

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
