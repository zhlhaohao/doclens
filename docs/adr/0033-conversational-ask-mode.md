# ADR-0033: ask_user_question 对话式降级——断回合 + 自然续接

- 状态：已接受
- 日期：2026-10-01
- 关联决议：ADR-0028（断开续跑——本决议的动机互补面）、ADR-0026（压缩即事实——续接前提）

## 背景

`ask_user_question` 的默认形态（交互式提问）：工具 handler 创建 waiter 请求、
阻塞 agent 循环等待，UI 弹交互答题卡，用户作答后同回合恢复（300s 超时回填
timeout 继续回合）。

移动端场景下这个形态不可用：手机浏览器频繁被杀后台 → SSE 断线 → 答题卡
丢失。虽然 ADR-0028 的断开续跑让服务端把整轮跑完，但「等待用户作答」这一步
本质是**回合内的常驻等待**——它赌 SSE、进程、会话状态整夜存活，而这恰是
「人不在电脑前」场景里最不成立的假设。用户需要的是把等待从**回合内**迁移到
**回合间**。

## 决策

**新增 `PLANIFY_ASK_MODE=interactive|chat`（默认 interactive，完全向后
兼容；env 全局、每次工具调用时读取——热生效零机制成本，非法值告警回退
interactive）。chat 模式走「断回合」方案：**

1. **问题以常规 assistant 消息送达**：handler 把结构化 questions 降维为
   Markdown（问题加粗编号 + 选项 label—description 列表）经 `emit_text`
   正文通道发出。GUI 侧随 token 策展落库为普通 message_ai——刷新/重开/
   换设备都能读；CLI/TUI 直接打印。选项 chips 点击直发是后续增强，非 v1。

2. **工具返回哨兵结果，runner 确定性断回合**：handler 返回以
   `[waiting-user-reply]` 为前缀的说明串（不建 waiter 请求、不阻塞）；
   StreamingAgent 在 `_execute_tools` 后检测到该前缀 → 以 stop reason
   `waiting_user` 调 `emit_done` 并结束本回合。断回合语义不交给模型自觉
   （仅靠哨兵文本让模型自然收尾是概率行为）。tool_use/tool_result 已按序
   入 history，回放/续轮配对完整。

3. **答案 = 用户的下一条消息，自然续接**：无 pending 状态机、无答案绑定
   机制。用户回来发消息 → 同会话全上下文续接，模型读到自己的提问 + 哨兵
   说明 + 用户回答，自行关联。前提已验证：microcompact 保留最近 10 个
   tool_result、auto_compact 摘要含末尾逐轮记录——最新一轮 tool 往返
   不会被压掉。

4. **提示词攒批**：chat 模式下 system prompt 增加分支（同 guard 模式的
   「延迟 import + 每次构建重读 env」先例）：一次调用问全所有待决问题
   （最多 4 问），不要挤牙膏式多轮提问——把「每次提问断一次回合」的成本
   从模型行为的随机数压成设计约束。

5. **SSE 收尾携带 reason**：`emit_done` 协议增加可选 `reason` 字段；
   ChatEventEmitter 在 reason 存在时推 `done` 队列事件（chat.py 终端
   done 以 saw_done 去重，前端仍只收一个 done）；前端 done 事件解析
   reason，`waiting_user` 时弹「等待你的回复」toast。

6. **设置页可视化配置**（同日补充）：设置页「模型」tab 新增「提问方式」
   select（交互式/对话式），完整复用 `PLANIFY_OUTSIDE_WORKDIR`（门禁）的
   通路——`KNOWN_KEYS` + 校验规则（interactive|chat，空串=默认）+ 保存时
   显式同步 `os.environ` 热生效 + `.env.example` 模板条目。落盘仍走
   local/global `.env`（与既有 scope 语义一致），对未进设置页的 env 直设
   场景无影响。

### 否决的替代方案

- **保循环（方案 A）**：waiter 继续阻塞，把「下一条用户聊天消息」回填为
  答案去 resolve waiter，回合不断。零中断的优点建立在「循环跨小时存活」
  的假设上——与移动端杀后台的动机直接冲突；且需引入「提问转消息」的
  UI 状态转换机制。否决。
- **结构化答案绑定**：session 记 pending_question，下一条用户消息包装注入
  为「用户对提问的回答」。真正价值只剩抗压缩（前提 3 已证不成立），而
  用户下一条消息是无关新指令时会错误标注。否决。
- **交互超时自动降级**（等待 N 分钟无人应答 → 原地转对话式）：要给已阻塞
  的 waiter 加取消+转换通路，且「已发出去的交互卡片」语义复杂。留作后续
  增强，v1 不做。

## 边界（重要）

- **范围仅 ask_user_question**：旧 ask_user/user_confirm（TUI/CLI 路径）
  不变；plan_approval（队友协议）后续可用同机制跟进；shutdown_request
  不适用（无人值守的正确行为是超时拒绝，非转对话式）。
- **门禁确认不受影响**：runner 的 `_guard_confirm` 仍走交互式确认 + 超时
  fail-closed（ADR-0021）——无人值守时外部访问被拒是安全默认，不是缺陷。
- **切换只对新调用生效**：模式在工具调用时读取；已阻塞中的 waiter 请求
  不原地转换（离开前主动切换是主路径，此时无 pending）。
- **子代理无此工具**：task 子代理只注入 bash/read/write/edit，天然不触
  发；若未来子代理获得提问能力，chat 模式对它应返回「不可交互，自行决策」
  的降级说明（跨层冒泡终止已否决，machinery 不成比例）。

## 后果与风险

- **每次提问断一次长对话**：回合内进行中的计划/工具链中断，由模型基于
  上下文重建；提示词攒批缓解频次。这是本决议明示接受的成本。
- **用户下一条消息可能不是答案**（新指令/闲聊）：自然续接路径下模型自行
  辨识，无机制强制——与人类对话同构，接受。
- planify 新增一条框架级控制流（工具结果哨兵 → 回合终止）：哨兵前缀是
  runner 与 user_interaction 的公共契约（`CHAT_ASK_RESULT_PREFIX`），
  两者必须同步演化。
- planify 改动需发版（`publish-pypi.ps1 planify`）并提升 doclens 依赖
  下限，否则发行版停在旧版。
