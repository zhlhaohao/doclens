# ADR-0027: 回退即事实——rewound 边界条目 + 改前备份

chat view 增加 Claude Code `/rewind` 同款能力：回到某条历史用户消息重新来过，同时可选恢复该时点的文件状态。2026-09-19 决议。

## Context

源码调查结论（Claude Code `src/utils/fileHistory.ts` + `REPL.tsx`）：

- **对话侧是 fork 语义**：`rewindConversationTo` = `messages.slice(0, idx)` 内存态截断 + 新 conversationId + 锚点消息回填输入框；旧 transcript 留在磁盘但不提供入口。
- **文件侧不是 shadow repo**：按文件的版本化备份（`~/.claude/file-history/{sessionId}/{sha256(path)[:16]}@v{N}`，整文件 copyFile + chmod）。两阶段模型：每条用户消息提交时快照（对已追踪文件 stat/mtime/内容比对，变则新版本）+ 写工具动手前 trackEdit 备份改前内容 v1 回填最新快照。
- **捕获面局限**：只追踪结构化工具（Edit/Write/NotebookEdit + bash 里被模拟的 sed）触达的文件；bash 任意写（脚本生成、`>` 重定向）不追踪不恢复——best-effort。

doclens 现状与动机：

1. **对话**：`session_items` 是 append-only 持久日志（ADR-0026「压缩即事实」已确立回放投影机制），但「重问」只拷贝问题回输入框——旧问答仍留在 LLM 上下文里污染后续轮次，问歪了没有返工手段。
2. **文件**：agent 具备写能力（write_file/edit_file/bash/powershell/background_run，workdir 外还可经会话目录授权写），改坏知识库文件后无任何回退记账。
3. **本仓哲学**：库恒 append-only（CONTEXT.md：_Avoid_: 改写/删除旧条目）——Claude Code 的内存切片 + fork 新会话形态不能照搬，但「持久边界 + 确定性投影」机制可以完全复用。

## Decision

### 1. 对话侧：rewound 边界条目（append-only 投影）

新增 `kind="rewound"` 条目，payload 记锚点（被回退到的 user 消息 seq）。`get_chat_history` 回放投影：**最后一个** rewound 边界生效，回放 = 锚点之前的活前缀（`seq < point`）+ 边界之后的新对话（`seq > boundary`）；中间死段（含其中的 compacted / microcompact / skill_context / usage）对回放不可见。

- 否决 **fork 新会话**（Claude Code 形态）：doclens 会话列表是用户直面的 UI，每次回退长一个新会话，重试两三次即碎片化。
- 否决 **破坏性 DELETE**：违反 append-only 红线，丢审计。
- **无 redo**：死段保留在库中（可审计、可展开查看），不提供「恢复回来」的入口——与 Claude Code 一致。
- 与压缩边界天然叠加：回退到压缩边界**之前** = 旧全量历史复活（条目还在库里，死段内的压缩边界自然失效）；回退到边界之后 = 摘要仍在活前缀内。多次回退按「最后一个生效」组合，死段区间互不嵌套。

### 2. 文件侧：改前备份（两阶段，对齐 Claude Code 模型）

- **捕获面（双通道）**：
  1. 结构化工具——`write_file` / `edit_file` 执行**前** hook，备份被写文件的原内容（v1 = 改前态；文件不存在记 null = 「该时点不存在」标记）；
  2. shell 命令文本扫描——`bash` / `powershell` / `background_run` 执行**前**，用 ADR-0021 已有的路径扫描器 + 写信号词表提取命令文本中被引用的现存路径，命中的预备份。比 Claude Code 覆盖广（它只模拟 sed）。
- **否决 FileWatcher 补登记**：watchdog 事件在写入**后**触发，改前态原理性不可得——在最需要它的场景（bash 写完马上回退）恰好失效，且引入 debounce/异步竞态。漏网面（脚本内部生成文件）与 Claude Code 同局限，确认框对未备份文件明示。
- **快照时机**：每轮对话开始（`POST /api/chat` 入口）对已追踪文件做快照（stat/size/mtime 快路径 → 内容比对慢路径，变则新版本）；改前备份（v1）回填最新快照——锚点时点状态由此可恢复。
- **存储**：`.cortex/rewind/{session_id}/{sha256(绝对路径)[:16]}@v{N}`（doclens 数据目录，天然被索引排除 + GitSync gitignore；路径哈希命名可容纳 workdir 外文件）。
- **生命周期**：单文件 >50MB 跳过备份（记日志 + UI 标「未备份，无法恢复」；知识库有 GB 级 PST，整拷贝会吃穿磁盘）；快照环形上限 100/会话；删会话级联删备份目录；备份 hook 仅 GUI/web 链路注册（TUI/CLI 无会话可挂，不启用，不产生孤儿备份）；不做时间 GC（备份比会话短命会造成「回退点在、文件回不去」的静默坑）。
- **恢复**：逐文件三态——备份有内容且现文件有差异 → copyFile 恢复 + chmod；备份为 null 且文件现存 → 删除；无差异 → 不动。逐文件容错（单文件失败不阻断整批，结果逐文件上报）。

### 3. planify 注入形态（模块边界守规）

planify 禁止 import doclens（红线）。改前备份走**回调注入**：planify 工具层暴露中性的 pre-write / pre-shell hook 注册点（同 `bind_user_interaction_handlers`、`register_config` 先例），doclens 侧注册备份 tracker 实现；未注册时零行为变化（发行版 planify 兼容）。hook 命名与注释保持宿主中性。

### 4. API 与执行时序

`POST /api/sessions/{id}/rewind`（body: 锚点标识；流式中 409）：后端**同步**执行「文件恢复（best-effort）→ 落 rewound 条目 → 重算 message_count」，响应含逐文件恢复结果；前端随后重拉 detail（投影标记死段区间）+ 锚点消息内容回填输入框。

### 5. UI

- **入口**：user 气泡动作区第二按钮（桌面 hover 浮现 / 移动端常显，与「重问」同款形态）；锚点 = 任意 user 消息（含首条 = 整段重来）。流式期间（含 ask 挂起）禁用——本轮快照尚未固化，与输入框禁用同律。**不做** `/rewind` 斜杠（斜杠已被技能调用独占，`checkSlashSubmit` 对未知斜杠阻断）与双击 Esc（Web 无此惯例）。
- **确认框**：对话回退（固定）+ 文件恢复（勾选默认开，列出将恢复/将删除文件清单）+ 覆盖现内容危险提示。不做行级 diff（无 diff 库，Claude Code 的 ±行数统计属锦上添花）。
- **死段展示**：折叠条「↩ 已回退 · N 条消息」可展开查看（纯查看，无恢复入口）——保留 doclens 会话作为持久资产的可翻性，与 Claude Code（一次性工作台，直接隐藏）场景不同。

### 6. 口径

- usage / compacted 聚合**照常全量**（死段内的 token 成本真实发生；会话信息弹窗逻辑不动）。
- `message_count` 按可见时间线重算（死段不计）。

## Consequences

- **旧会话零迁移**：无 rewound 条目的会话行为不变；旧版本读到新 kind 走「未知 kind 忽略」既有先例。
- **文件恢复不可逆**（覆盖现内容）→ 确认框危险提示是唯一防线；被跳过备份的超限文件保持现状。
- **改前备份是 best-effort**：脚本内部写、扫描漏检、超限跳过的文件回退时不恢复——UI 明示而非静默。
- **planify 新增公共 hook 契约**（pre-write / pre-shell 注册点）：发行版 planify 需同步发版；未注册零行为，旧宿主兼容。
- **快照与轮次绑定**：回退点只能是 user 消息（快照挂在轮次上），不能回退到轮中间的某个工具调用。
- 用户在 agent 之外自己改的文件（预览编辑器、外部应用）同样被下一轮快照捕获——回退会连用户自己的改动一起恢复到锚点时点（语义正确：恢复「工作区状态」而非「agent 改动」）。
