# ADR-0014: MCP client——doclens 消费外部 MCP 服务器工具

给 AI 对话接入外部 MCP（Model Context Protocol）服务器暴露的工具，前端（Web GUI 设置页）可配置。2026-09-07 决议。

## Context

doclens 已有 MCP **server**（`mcp_server.py`，把 KB 工具暴露给外部）；本决策是反向：doclens 作为 MCP **client**，消费外部服务器（文件系统、GitHub、数据库等生态 server）的工具，扩充 AI 对话能力。要求兼容最新 MCP 标准（SDK `mcp>=2.0`，已在依赖中），且用户可在前端增删改查服务器配置。

## Decision

### 1. 层级归属：doclens 侧，planify 零改动

MCP client 全部实现放 doclens（`doclens/mcp_client.py` + `web_v2/api/mcp.py`），构建 `(tools, handlers)` 后经 planify 既有 `register_external_tools()` 注入——与 kb_tools / grep_tools 同款路径。

- 不放 planify：「前端可配置的服务器列表」是宿主业务概念，进 planify 违反中性化红线；且 planify 零新依赖（`mcp` 不进 planify pyproject）。
- streaming runner 原生支持 async handler（`iscoroutinefunction` 分支已存在），MCP `ClientSession` 天然兼容。

### 2. 传输：stdio + Streamable HTTP + 旧 SSE 三种全做

现行标准两种（stdio / Streamable HTTP）+ 已废弃但存量服务器不少的旧 SSE。SDK 三种 client transport 均已验证可用，成本对称。

### 3. 能力范围：仅消费 Tools

Resources / Prompts 不做。Tools 是无损映射（`inputSchema` → `input_schema`，`call_tool` → handler）；Resources/Prompts 需要发明映射语义，各自是独立 feature 的体量。

### 4. 存储：机器级 `mcp_servers.json`

`~/.cortex/mcp_servers.json`（发行版 `~/.doclens/`），复用 presets_store 模式（原子写 + 进程内锁 + schema version + GET 脱敏）。

- 否决工作目录级：stdio 启动命令依赖本机 npx/uvx、HTTP URL 常含本机端口——配置跨机器不可移植；与模型预设「机器级本地资产」先例一致（ADR-0011）。
- 含密钥（env 值 / headers 值）：GET 脱敏 `***`、PUT `***` = 保留原值，与 .env 同等保护，不参与知识库 Git 同步。

### 5. 生命周期：常驻，仅 GUI

- stdio 子进程常驻（Vision Worker / FileWatcher 同物种）：仅 enabled 的服务器随 GUI 拉起，退出统一收割；无空闲回收。单服务器启动失败 → 该服务器工具不注册 + 设置页显示原因，不阻塞主应用。
- **专属后台线程 + 专属 event loop**，不挂 uvicorn loop：`agent_integration.py` 是 TUI/GUI 共享装配，专属线程让 MCP 状态与请求 loop 解耦（未来 TUI 想接只是装配点不同）。请求 loop 上的 handler 经 `asyncio.run_coroutine_threadsafe` 投递到专属 loop。
- **仅 GUI 生效**：TUI / CLI 不接（不改 TUI 装配路径），判定锚在 web_v2 deps 懒加载 CortexAgent 处。

### 6. 工具命名与注入

- 前缀平铺 `mcp__<server>__<tool>`（Claude Code 同款约定），无命名冲突，AI 从名字可看出归属。
- 否决「每 server 一个代理工具」：JSON-in-JSON 两跳推理是模型已知弱项，且丢 JSON Schema 描述。
- MCP 工具不经 `PLANIFY_ENABLED_TOOLS` 白名单过滤——开关在 server enabled 位（停 server = 下架全部工具）。
- 单 server 工具数上限 64（超出截断 + 警告），防失控 server 撑爆上下文。

### 7. 结果归一（handler 返回 str）

`is_error` → `"Error: <文本>"`（对齐 planify 前端错误显示约定）；多 TextContent `\n\n` 拼接；`structured_content` JSON dumps 附后；Image/Audio/EmbeddedResource 首期丢弃换占位文本（planify 工具管线纯文本，图像结果要动 emitter→SSE→前端整条链路，体量不成比例）；超长截断（~30k 字符 + 注明）。

### 8. 生效方式：异步 reconcile 热更新

保存即返回；后台 diff（未动跳过 / 改动重连 / 删除收割），原位更新 `runtime.tools` / `runtime.tool_handlers`——chat 每请求现读工具表，下一轮对话即生效，进行中对话不受影响（handler 已拷贝快照 `chat.py:139`）。stdio 重启慢（npx 首次下载）不阻塞保存；状态（connecting/ok/failed + 工具数 + 错误）经独立 GET 轮询。失败不自动重试（同步停摆哲学），等下次变更或手动重连。

### 9. 安全模型：信任在配置时一次授予，运行时零摩擦

工具调用不确认（与 bash 等内置工具一致——信任决策在「配置并启用」时完成）；stdio env 注入不过滤（配置者=信任者）；工具描述 prompt injection 首期不做技术防御（生态未解难题，Claude Code 也不消毒），设置页提示风险。

## Considered Options

- **MCP client 放 planify**（框架层自带，其他宿主可复用）：违反宿主中性化红线、planify 增依赖，doclens 前端配置照样要自建——否决。
- **工作目录级配置（跟知识库走）**：配置含本机命令/端口/密钥，跨机器大概率坏——否决。
- **按需拉起 + 空闲回收**：省内存但复杂度高一个量级（空闲计时/冷启动可感/回收竞态），且工具表在进程内不稳定——否决。
- **每 server 代理工具（工具表只 +1）**：两跳推理 + 丢 schema——否决。
- **同步 reconcile（保存阻塞等结果）**：stdio 首次启动可达几十秒——否决，改异步 + 轮询。
- **每 server「调用前确认」开关**：复用 ask_user_question 可行但跨层加确认通路，与内置工具不一致——否决。

## Consequences

- doclens 侧新增：`mcp_client.py`（管理器 + 专属线程 loop + reconcile）、`web_v2/api/mcp.py`（REST CRUD + 状态 + 工具清单）、`mcp_servers.json` store、设置页第 4 个 tab + `mcp-servers-section` 组件、`chat-tool-trace` 的 `mcp__` 前缀图标支持。
- 依赖零新增（`mcp>=2.0` 已在；前端零新依赖）。
- 进行中的对话持旧工具快照跑到本轮结束——配置变更后正在跑的轮次可能用到已下架工具，由 handler 返回 "Error: server unavailable" 兜底。
- SDK 2.0 的 elicitation（`allow_input_required` 等新参数）不使用；未来 SDK 升级改变默认行为需留意（常规依赖维护）。
- TUI 用户暂无 MCP 能力；未来接入只是把装配点从 web_v2 deps 移入共享路径（专属线程设计已为此留门）。
