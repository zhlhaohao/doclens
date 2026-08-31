# planify 模块架构分析

> 生成日期：2026-08-31 · 基于仓库 `release` 分支实际代码（54 文件 / 约 1.04 万行）

## 一、定位

planify 是一个**仿 Claude Code 的单进程多代理 AI Agent 框架**（docstring 自述源自 `agents/s_full.py` 重构，按 s01–s11 场景增量演进）。它被 doclens 作为 AI 引擎集成——`doclens/agent_integration.py` 的 `CortexAgent` 是组装根，KB 检索工具（`read_document` / `file_info` / grep）经 `register_external_tools()` 反向注入。

实际规模远大于 CLAUDE.md 中记录的结构（缺 `streaming/`、`tools/`、`skills/`、`subagent/`、`context/`、`core/llm/` 六个子包）。

## 二、总体分层

```
入口层   planify/main.py(旧REPL) | planify/cli.py(流式CLI) | doclens/web_v2/api/chat.py(Web SSE)
              ↓                         ↓                            ↓
装配层   planify/bootstrap.py → core/session_manager.py → core/session.py(Session 组件包)
                                        ↓ build_tool_registry
执行层   agent/runner.py(同步)    streaming/runner.py(异步流式，主路径)    subagent/runner.py(一次性)
              └──────────────── 三者共享同一 LLMProvider 协议与压缩管道 ────────────────┘
支撑层   core/llm/(Provider抽象) · tools/(工具注册表) · skills/ · managers/ · messaging/ · context/compact.py
```

无循环依赖：所有 manager 不反向引用 Agent；compact 与 prompts 位于最底层，仅依赖 `core/llm`。

### 三条入口链路

| 链路 | 入口 | 特点 |
|---|---|---|
| A 同步 REPL | `main.py:170` `repl()` | 旧版，`Agent.run()` + `provider.chat()` 整体返回 |
| B 流式 CLI | `cli.py:438` `main()` | 当前主力，持久事件循环 + `StreamingAgent.run_stream()` |
| C Web SSE | `doclens/web_v2/api/chat.py:30` | 子线程私有 loop + `call_soon_threadsafe` 回主 loop，`EventSourceResponse` 输出 |

### 装配与依赖注入（三种混合）

1. **注册表/回调注入**：`register_app_dependencies()` / `register_planify_config()`（`bootstrap.py:28,51`）——宿主反向注入，优先级最高
2. **单例 Service Locator**：模块级 `_manager` + `get_manager()`（`bootstrap.py:103`）
3. **构造函数注入（主体）**：`Session` 是组件属性包，显式拆传给 `Agent` / `StreamingAgent` 构造器

真正装配点在 `core/session_manager.py:277` `initialize_session_components()`：logger、全局共享 Provider、五个 Manager、MessageBus、SkillLoader、工具注册表。

## 三、核心子系统

### 1. LLM Provider 层（`core/llm/`）

- 唯一接口是 `LLMProvider` 协议（`core/llm/provider.py:8`）：`chat()` / `stream()` / `count_tokens()`，全部调用方只认协议不碰 SDK 类型
- 双后端：
  - `AnthropicProvider`——prompt caching 断点（system / tools 表尾 / 最后一条 user 消息尾）、thinking 块丢弃、"Streaming is required" 降级流式聚合
  - `OpenAICompatProvider`——OpenAI Chat Completions 实现，进出格式翻译
- `tool_translator.py`：Anthropic ↔ OpenAI tool-call 格式翻译层，仅被 OpenAICompatProvider 使用。模型生成的 id 原样透传（修复了 mapper 每轮重建导致 id 轮换、tool_result 匹配不上、模型无限重试的 bug，见 `:76-84` 注释）
- `factory.create_provider()` 按 `protocol` 字段（`anthropic` / `openai_compat`）选后端；ADR-0009 后 presets 不再选模型，model_id 完全由配置透传（默认 `claude-opus-4-6`）
- 异常层级：`LLMError` 基类带 `retryable` 标志，派生 Auth / RateLimit / ContextLength / Network

### 2. 执行层：三个 runner，一套循环骨架

所有 runner 共享同一模式——`while stop_reason == "tool_use"`（`agent/runner.py:33` 注释点题）：

| | `agent/runner.py` | `streaming/runner.py`（主力） | `subagent/runner.py` |
|---|---|---|---|
| 模型 | 同步 | 全 asyncio | 同步、一次性 |
| LLM | `chat()` 整体返回（`:179`） | `stream()` 逐事件（`:505`） | `chat()`，≤30 轮 |
| 工具 | 顺序，async handler 用 `asyncio.run` | 同步 handler 走 `asyncio.to_thread`（传播 contextvars 保住技能门禁，`:659-664`） | 按 agent_type 裁剪（Explore 只读） |
| 并发 | 无 | 同轮 ≥2 个 `task` 子代理 `asyncio.gather`（`:673-680`） | 由主代理并发调度 |
| 中断 | 无 | `interrupt_event` 检查点（`:512`） | 无 |
| 额外 | — | 上下文注入、ask_user 交互、`_cleanup_messages` 清洗历史供 Web 持久化 | 支持宿主注入 `extra_tools` |

每轮循环：**microcompact 门控检查 → 后台通知注入 → 读 lead 收件箱 → LLM 调用 → 工具执行 → tool_result 打包成一条 user 消息回传**（`streaming/runner.py:720`，Anthropic 协议约定）。

### 3. streaming 事件系统（`streaming/`）

- `types.py`：`EventEmitter` 协议（`@runtime_checkable`）+ 7 种事件类型（TEXT / TOOL_CALL / TOOL_RESULT / ASK_USER / DONE / ERROR / HEARTBEAT）+ `StreamingConfig` + `ToolCallState`（累积 `input_json_delta` 片段，解析失败返回 `{"_parse_error": raw}` 而非 `{}`）
- `emitter.py`：4 个实现——`SSEEmitter`（`asyncio.Queue` 生产者-消费者 + SSE 文本格式化，30s 心跳，`None` 哨兵关闭）、`QueueEmitter`、`CLIEventEmitter`（ask_user 直接 `input()`）、`TUIEventEmitter`（回调字典路由）；Web 侧另有 `ChatEventEmitter`（`doclens/web_v2/api/_chat_emitter.py`，缓冲收集器，供 chat.py 轮询搬运）
- `waiter.py`：`GlobalResponseWaiter` 单例（`__new__` 单例）实现「agent 提问 → 用户回答」跨线程阻塞等待——`PendingRequest` 持 `asyncio.Event`，等待侧 `asyncio.wait_for`，提交侧同步 `submit_response()`（刻意不加锁靠 GIL，供 CLI/线程调用）
- 关键取舍：`provider.stream()` 是**同步迭代器**，流式 runner 用普通 `for` 消费 + `asyncio.create_task` fire-and-forget 发射事件，循环后 `await asyncio.sleep(0.1)` 排空队列修时序；Web 侧用「子线程私有 loop + `call_soon_threadsafe`」桥接

### 4. 工具系统（`tools/`）

- `build_tool_registry()`（`tools/registry.py:67`）静态组装，返回 `(定义列表, handler 字典)` 二元组；无装饰器自动发现。工具定义是纯 dict `{"name", "description", "input_schema"}`（Anthropic 格式），handler 同步/async 皆可
- 外部工具经 `register_external_tools()`（`registry.py:27`）注入；`PLANIFY_ENABLED_TOOLS` 环境变量白名单过滤；gui_mode 下 `ask_user_question` 强制保留
- 约 25 个内置工具分 9 类：

| 类别 | 工具 | 实现要点 |
|---|---|---|
| 文件/命令 | `bash`、`powershell`、`read_file`、`write_file`、`edit_file` | `safe_path` 防路径逃逸、危险命令过滤、20s 超时、5 万字符截断、CJK 按词切片 |
| 网络搜索 | `web_search` | 走 Provider 服务端 `web_search_20250305` |
| 网页抓取 | `webfetch` | trafilatura → Playwright 降级，含 SSRF 校验 |
| 用户交互 | `ask_user`、`user_confirm`、`ask_user_question` | Claude Code AskUserQuestion 复刻（1-4 问 × 2-4 选项） |
| 团队协作 | `spawn_teammate` 等 5 个 | 委托 TeammateManager + MessageBus |
| 协议 | `shutdown_request`、`plan_approval`、`idle` | 走 MessageBus |
| 任务板 | `task_create/get/update/list`、`claim_task` | 转发 TaskManager |
| registry 内联 | `TodoWrite`、`task`(子代理)、`load_skill`、`background_run/check_background`、`compress` | — |
| 天气农历 | `baidu_weather` | httpx 百度地图 API + borax 农历 |

- **定义与处理器分离**是用户交互工具的关键设计：registry 只注册定义不绑 handler，运行时由宿主 `bind_user_interaction_handlers()`（`user_interaction.py:263`）注入 emitter + waiter，使同一工具适配 CLI/TUI/GUI 三种交互面。阻塞等待全 async 不占线程：`create_request` → `emit_ask_user` → `wait_for_response(timeout=300)`

### 5. 技能系统（`skills/`）

- SKILL.md 是 **prompt 注入而非可调用工具**，两段式：
  - 稳定部分：`descriptions()` 清单包 `<system-reminder>` 注入（`streaming/runner.py:176`）——刻意只放描述以护 prompt 前缀缓存
  - 按需部分：模型调 `load_skill(name)` 工具，返回 `<skill>` XML 注入对话尾部
- `SkillLoader`（`skill_loader.py:22`）：`rglob("SKILL.md")` 递归扫描，正则解析 YAML frontmatter + body
- 技能目录三条路径：CLI 用 `workdir/.planify/skills`；planify 核心用 `workdir/skills`；doclens 集成用 `~/.cortex/skills`（首启从包内拷贝）
- `SkillAccessState`（`access_state.py:35`）：按 session_id（contextvars `ContextVar` 传递，`run_stream` 开头 set）记录已加载技能，用作 KB 工具门禁

### 6. 多代理协作（`managers/` + `messaging/`）

三种执行单元，**同进程、threading 并发**：

| 单元 | 位置 | 并发模型 | 生命周期 |
|---|---|---|---|
| lead（主代理） | `agent/runner.py:20` | 调用方线程 | 跟随会话 |
| 子代理（`task` 工具） | `subagent/runner.py:33` | 内联同步，可并发 | 一次性，返回摘要即销毁 |
| teammate | `teammate_manager.py:44` | 每成员一个 daemon 线程 + 独立 agent loop | 持久，spawn→work(≤50轮)→idle 自动认领→shutdown |

- teammate 的 `_loop()`（`teammate_manager.py:190`）是**完全独立的 agent loop**：自拼 system prompt（不走 prompts.py）、自维护消息列表、共享 LLMProvider 实例与四个基础工具函数。IDLE 阶段自动扫描 `.tasks/task_*.json` 认领无主无阻塞任务
- `MessageBus`（`message_bus.py`）是**文件级 per-recipient mailbox**（`.team/inbox/<name>.jsonl`），无 topic/pub-sub；`broadcast()` 遍历逐个 `send`；`read_inbox()` 原子"读取并清空"（per-file 锁）。主 loop 每轮读 lead 收件箱注入 `<inbox>`
- 任务两层粒度：
  - `TodoManager`（`todo_manager.py:17`）：内存、单 agent 私有、强校验（≤20 项、恰好一项 in_progress）、3 轮未更新插 `<reminder>` nag
  - `TaskManager`（`task_manager.py:27`）：`.tasks/task_N.json` 持久化、跨 agent 认领、`blockedBy/blocks` 依赖图、completed 自动解除他人阻塞
- `BackgroundManager`（`background_manager.py:29`）：管长时 **shell 命令**（非 agent），daemon 线程执行，Windows 下 Git Bash → pwsh → cmd 三级回退，完成后向 `notifications: Queue` 投递，主 loop 每轮 `drain()`

### 7. 上下文压缩（`context/compact.py`）

- token 估算：`len(json.dumps(messages)) // 4` 启发式（`:29`）
- **microcompact**（截断式，`:64`）：只保留最近 10 个 tool_result、其余置 `"[cleared]"`；豁免集 `{"task"}`——子代理摘要清掉会丢失并发子代理结果（实测踩坑记录在 `:45-49` 注释）
- **auto_compact**（LLM 摘要式，`:116`）：先把原始对话落盘 `.transcripts/transcript_<ts>.jsonl`，再无工具调用生成 continuity 摘要，替换为 `[Compressed...]` + `Understood...` 两条消息
- **0.8 门控**（`MICROCOMPACT_GATE_RATIO`）：上下文未达 auto_compact 阈值 80% 时**完全不动历史**——历史中段任何单点突变会使之后的 prompt 前缀缓存全部失效（GLM/MiniMax 等整体前缀匹配端点双倍代价）
- 触发点 5 处：两个 runner 各自内嵌（micro 0.8 门控 / auto 超阈值）+ 模型手动 `compress` 工具 + 用户 `/compact` 命令

### 8. prompts.py

`build_system_prompt(workdir, agent_type)`（`:76`）唯一模板入口：通用 base（行为规范 / 先读后改 / 专用工具优先 / Skill 门禁优先 / Tool use mandate / Knowledge base first / 精简语气 / 实时环境注入）+ agent_type 分支（`subagent` / `agent` / `streaming`）。`SystemPromptBuilder` 按 (workdir, agent_type) 缓存。体系外 prompt 两处：teammate 内联拼接、compact 摘要 prompt。

### 9. 配置与编码

- 配置双通路：`get_config()` dict（优先级 user_config > 环境变量 > `.planify/.env` > `.env.local` > `.env` > 默认值，被 SessionManager 使用）与 `register_config()` / `_PlanifySettings`（宿主注入）。检测到 `PLANIFY_BASE_URL` 时 pop `ANTHROPIC_AUTH_TOKEN` 防认证冲突
- `encoding.py`：专治 Windows GBK 控制台与 UTF-8 冲突——`SetConsoleCP(65001)`、stdio reconfigure、`safe_print/safe_input`
- `Session`（`core/session.py:86`）：内存态组件包，消息历史由 `threading.RLock` 保护，`replace_messages_in_place` 服务压缩后就地替换；`SessionManager` 是线程安全单例，多用户每用户单会话

## 四、发现的技术债

1. **双 runner 维护成本**：`agent/runner.py`（服务旧 REPL `main.py`）与 `streaming/runner.py` 循环骨架刻意同构但需双写（压缩管道、工具执行各两份）
2. **teammate 无压缩管道**：`teammate_manager.py` 的 `_loop` 未接 compact，上下文无界增长；`:394` 的 identity 重注入是预留补丁位
3. **死代码**：`core/client.py` 的 `init_anthropic_client` 无任何调用方（已被 `AnthropicProvider.__init__` 内联取代，且残留修改全局 `os.environ` 的隐患）；`session.py:15` 死导入 `Anthropic`
4. **`transcript_dir` 语义混乱**：config 中实际是文件路径却被当目录用，runner 已防御性改用 `workdir/.transcripts`
5. **会话持久化缺位**：消息历史纯内存，唯一落盘是 auto_compact 触发时的 transcript；doclens 侧靠 `sessions_store.py`（SQLite）自建持久化补位
6. **配置双通路**：`get_config()` dict 与 `register_config()` / `_PlanifySettings` 并存，后者混入与 LLM 层无关的百度天气配置
7. **命名易混**：`task` 工具是子代理，`task_create` 是任务板，`background_run` 才是后台执行；`tools/protocols.py` 不是 typing.Protocol 而是团队协议工具
