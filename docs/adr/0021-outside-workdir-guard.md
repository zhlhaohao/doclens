# ADR-0021: planify 外部访问门禁（workdir 外读写确认）

planify 工具层对「工作目录以外路径的读写」长期存在悖论：`read_file`/`write_file`/`edit_file` 被 `safe_path` 硬拒绝（`Path escapes workspace`），而 `bash`/`powershell`/`background_run` 仅过滤少数危险命令词、**任意目录读写畅通**——硬拦截可被 `bash -c 'cp ...'` 一行绕过，形同虚设。本决议统一为「外部访问 → 用户确认 → 放行/拒绝」模型，并以三态配置可整体关闭确认。2026-09-14 决议。

## Context

- **旧现状**：`safe_path`（`planify/tools/basic.py`）对结构化工具硬拒绝外部路径；shell 工具只有 `_is_dangerous` 关键词过滤（`rm -rf /`、`sudo` 等），`cat C:\任意机密` 畅通无阻。AI 被拒后会自发学会用 bash 绕过。
- **交互基建**：GUI 唯一用户交互通道是 `ask_user_question`（SSE 一等协议 `emit_ask_questions` + `/api/ask/respond` 回传）；旧 `ask_user`/`user_confirm` 在 GUI 被过滤。**子代理（task）与 teammate 是独立线程的同步循环，无 emitter/waiter，无法问用户**。
- **后门通道**：子代理直接复用主代理 handlers（`sub_handlers = {bash: handlers["bash"], ...}`）——若门禁只挂在 StreamingAgent 管道层，模型可把外部访问全部派给 task 绕过。
- **会话基建**：`get_current_session_id()` 走 contextvars，`asyncio.to_thread` 传播——子代理天然继承主代理会话 ID。

## Decision

### 1. 三态配置，统一处置模型

`PLANIFY_OUTSIDE_WORKDIR` = `ask`（默认，弹确认）/ `allow`（不问直接放行，即「关闭确认」）/ `block`（不问直接拦截，严格模式）。宿主可经 planify `register_config()` 注入。结构化工具从「硬拒绝」放宽为「确认后放行」，shell 从「全开」收紧为「检测到外部路径时确认」。

**block 优先于会话授权**：严格模式绝对拦截——本会话已确认过的授权目录同样不放行（用户切 block 的意图是全拦，授权只在 ask 模式下免弹）。设置页保存经宿主显式同步 `os.environ`（guard 惰性读、无启动缓存），三态切换**保存即热生效**、无需重启。

### 2. 覆盖范围：结构化 + shell，webfetch/外部/MCP 不动

`read_file`/`write_file`/`edit_file`（path 参数语义干净，精确判定）+ `bash`/`powershell`/`background_run`（命令文本启发式）。webfetch 不落盘不管；外部工具与 MCP 工具入参无统一 path 字段，无法静态检查，本期不动（信任边界归宿主配置时授予）。

### 3. 会话目录授权：目录级、读写分账、会话共享、不持久化

确认通过后记账——外部目录（含子树）粒度，**读/写两本账，写授权蕴含读授权**；作用域 = 聊天会话（session_id 键，主代理/子代理/teammate 共享，子代理免重新确认）；会话结束作废，**不做永久白名单**。shell 命令扫到的外部路径同享授权——正是读写分账解掉了「确认过 grep 就静默放行后续 rm」的风险。

### 4. shell 判定：绝对路径扫描 + 写信号词表

- **触发**：命令文本正则扫描 Windows 盘符绝对路径、UNC（`\\server\…`）、Unix 绝对路径（`/…`）、家目录（`~/`、`%USERPROFILE%`）、出界相对路径（`..` 出 workdir），命中 workdir 之外即触发。
- **读写作判定**：写信号词表（`rm/mv/cp/mkdir/touch/tee/sed -i/truncate/chmod` + PowerShell 写 cmdlet `Remove-Item/Copy-Item/Move-Item/New-Item/Set-Content/Out-File` + 重定向符 `>` `>>`）——命中任一整条按写，否则按读，**不确定偏写**（保守端）。词表为常量表可扩展。
- **明示局限**：变量拼接（`$VAR`）、`cd` 后相对操作等可绕过——**定位纵深防御，不是沙箱**，文档与代码注释双声明。

### 5. fail-closed：无渠道/超时按 block

子代理、teammate 无交互渠道，或确认弹窗 300s 超时——一律按 block 处置，错误信息提示模型「子代理无交互渠道，请由主代理确认后重试」，让任务能带回主循环。否则子代理即后门。

### 6. 确认弹窗：复用 ask_user_question 协议 + guard 标志位

传输层复用 `emit_ask_questions` + `/api/ask/respond`（零新端点），questions 载荷加 `guard: true` 标志，前端对 guard 卡片做视觉区分（醒目样式，与模型提问严格区分）。**模型自调的 ask_user_question 不带 guard 位，无法仿冒门禁卡片骗授权**——安全提示不可被保护对象模仿。

### 7. 接线范围：仅 GUI

planify 出机制（判定核心同步纯函数 + 会话账本 + handler 包装 + StreamingAgent 确认逻辑）；doclens GUI 链路（`gui_mode=True` 的 registry 构建）接线——主代理在 StreamingAgent 管道层做有渠道确认，子代理拿到的 handler 带「判定 + 查账本 + 无渠道 fail-closed」包装。TUI/CLI 链路不接线，行为不变。

### 8. 提示词层协同：脚本内容自审（2026-09-15 补记）

第 4 节静态扫描的盲区之一是**脚本内容穿透**：模型写 .py/.js/.ps1 再执行、或 `python -c` / `node -e` 内联代码，外部路径藏在脚本内容里，命令行 token 扫描不可见。工具层补法代价高（内容级静态扫描追不完动态拼接与编码；解释器命令一律确认则误报骚扰，用户会被逼去 `allow` 反而关掉门禁）。

决议：该盲区由**提示词层**承担——`build_system_prompt` 的 Working Directory Guard 段明确「门禁只检查直接工具调用里的路径，脚本内容由你自审」，要求执行脚本/内联代码前检查内容是否访问 workdir 外路径。规则段与 `get_guard_mode()` **同源联动**（每轮 prompt 构建时重读 env）：`ask` = 发现风险内容先用 `ask_user_question` 征得同意再执行、明知不问属安全违规；`allow` = 免打扰、仅要求回复中事后简要说明访问过的外部路径；`block` = 不执行、不绕过、不请求例外（对话授权无法豁免硬策略）。

软约束定位与门禁一致（纵深防御不是沙箱）：对「模型无意识走捷径」有效，对提示注入部分有效，对刻意对抗无效。

## Considered Options

- **仅结构化工具**——否决（bash 洞原样留着，安全增强是装饰）。
- **单次放行（问一次放一次）**——否决（批量外部目录操作问到怀疑人生）。
- **永久白名单（跨会话）**——否决（持久授权 = 攻击面永久扩大，且需新持久化存储与设置页管理 UI）。
- **二态开/关**——否决（「不想让 AI 碰外部」的 block 语义无法表达；三态多一个枚举值成本为零）。
- **读写各一个三态开关**——否决（配置面翻倍、授权账本要分别记账；读/写分账在**授权记账层**已实现用户意图）。
- **shell 逐参数分析（cp 源=读、目标=写）**——否决（管道/子 shell/变量使参数定位极不可靠，复杂度上一个量级）。
- **shell 一律按写查账**——被读写分账替代解掉（grep 外部目录走读账即可，无需最严账本）。
- **fail-open（无渠道放行）**——否决（prompt 注入诱导派子代理即绕过，门禁形同虚设）。
- **代理级账本隔离（子代理不继承）**——否决（子代理无渠道 → 永远 fail-closed，并发子代理型技能全废，用户确认白问）。
- **全新专用确认事件通道（emit_guard_confirm + 新组件 + 新端点）**——否决（三端改动面最大；guard 标志位折中拿到同等防仿冒性）。
- **激进扫描（cd/写盘命令全确认）**——否决（误报飙升把用户逼去 allow，反而关掉门禁）。
- **解释器命令一律确认（python/node/pip 全 ask）**——否决（绝大多数脚本只碰 workdir，全量确认同上把用户逼去 allow）；**脚本内容级静态扫描**——否决（动态拼接/编码/环境变量组装追不完，可靠性假象比没有更糟）。均以提示词层内容自审替代（第 8 节）。
- **三端齐做**——本期裁剪为仅 GUI（TUI/CLI 使用频率远低，机制核心已按全端设计，后续接线无痛）。

## Consequences

- **bash 行为收紧**：默认 `ask` 下，含 workdir 外绝对路径的命令首次要确认——既有用户可感知的行为变更，发布说明须写明（可用 `allow` 回到旧行为）。
- **结构化工具放宽**：确认后可读写外部目录——新增能力（旧硬拒绝下用户只能换 workdir 重启）。
- **漏检明示**：shell 绝对路径扫描非完备，纵深防御定位写入文档。
- **planify 须发版**（双形态分发纪律：改 `planify/**` 后跑 `publish-pypi.ps1 planify`，发行版依赖 PyPI 包）。
- **前端小改**：guard 卡片视觉区分（一个字段判断 + 样式），`ask` UI 与回传端点复用。
- **模块边界**：门禁机制归 planify 层（`PLANIFY_*` 配置、中性术语「宿主」），GUI 接线在 doclens chat 链路；`tests/test_architecture.py` 红线不受影响。
- **拒绝/拦截返回**：`Error:` 前缀字符串（`is_error=True`），含被拒路径、读/写语义与「由主代理确认或改用工作目录内路径」提示——模型可自行纠正。
