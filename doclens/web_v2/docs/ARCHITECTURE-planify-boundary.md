# planify 架构与 doclens 责任边界分析

> 生成日期：2026-09-02 · 基于分支 `0902-1` 实际代码核对
> 前置文档：[planify/docs/ARCHITECTURE.md](../../../planify/docs/ARCHITECTURE.md)、[planify/docs/DESIGN-async-refactor.md](../../../planify/docs/DESIGN-async-refactor.md)、[ARCHITECTURE-sse.md](./ARCHITECTURE-sse.md)、[ARCHITECTURE-event-flow.md](./ARCHITECTURE-event-flow.md)、[ARCHITECTURE-ask-loopback.md](./ARCHITECTURE-ask-loopback.md)
>
> 本文回答：planify 作为框架的责任边界在哪里；doclens（及反向 planify）是否存在入侵边界的问题。

## 一、planify 的责任边界（应然）

按 ARCHITECTURE.md 的分层，planify 作为「AI Agent 框架」的职责：

| 层 | 模块 | 职责 | 官方扩展点 |
|---|---|---|---|
| 装配层 | `bootstrap.py` / `core/runtime_manager.py` | AgentRuntime 组件装配、Provider 单例、配置注册 | `register_app_dependencies()` / `register_planify_config()` / `get_or_create_runtime()` |
| 执行层 | `streaming/runner.py` 等 | Agent 主循环、事件发射、中断 | `EventEmitter` 协议实现（宿主提供）、`interrupt_event` 注入 |
| 工具层 | `tools/registry.py` | 内置工具 + 外部工具合并 | `register_external_tools()`、`build_tool_registry()` 参数注入、`bind_user_interaction_handlers()` 运行时绑定 |
| LLM 层 | `core/llm/` | Provider 协议、双后端 | `create_provider(config)` |
| 技能层 | `skills/` | SKILL.md 加载、访问状态 | `SkillLoader(skills_dir)` 目录注入、`skill_access_state` 注入 |
| 子代理 | `subagent/runner.py` | 一次性子代理 | `extra_tools` / `extra_handlers` 注入 |

**doclens 的应然职责**：宿主应用——知识库索引（TreeSearch）、KB 工具实现、会话持久化（sessions_store）、Web/TUI 交互面，通过上述扩展点把 KB 能力注入 planify。

## 二、doclens → planify 的边界入侵（实证）

### 🔴 严重：装配层整体绕过，手工复刻 `initialize_runtime_components()`

`doclens/agent_integration.py:132-328`（`CortexAgent.initialize`）**完全绕过** planify 的装配入口（`bootstrap.get_or_create_runtime()` / `RuntimeManager.initialize_runtime_components()`），手工复刻全部装配逻辑——对照两边代码几乎逐行同构：

| planify 官方路径（`runtime_manager.py:277-346`） | doclens 复刻（`agent_integration.py`） |
|---|---|
| `runtime.logger = setup_logging(...)` | `:179-184` 同样调 `setup_logging` |
| 五个 Manager + MessageBus + SkillLoader | `:187-214` 逐个 new，连 `TeammateManager` 构造参数顺序都一样 |
| `build_tool_registry(...)` | `:276-294` 同样调用，另加 gui_mode/KB 参数 |
| `runtime.client = provider` 等属性赋值 | `:315-325` 直接对 `AgentRuntime` 属性逐个赋值 |

后果：

- **双写维护**：planify 装配逻辑任何演进（新 Manager、新参数）都必须手工同步到 doclens，否则静默缺失。与 planify 技术债 #1（双 runner）同构，是「双装配器」债。
- **两套装配并存**：`doclens/web_v2/deps.py:158` 的 `reload_config()` 还去调 `RuntimeManager.invalidate_provider()`——但 Web 聊天路径用的是 `CortexAgent` 手工装配的 runtime，**RuntimeManager 那条装配线从未产生实际运行时**，invalidate 的是一个没有消费者的缓存。代码读起来像在用官方路径，实际不是。
- 附带 hack：`agent_integration.py:18` 的 `sys.path.insert(0, ...)` 运行时改模块搜索路径。

### 🟠 中：宿主每请求改写 planify 共享 AgentRuntime 内部状态

`doclens/web_v2/api/chat.py:110-113`：每个 chat 请求都对**全局单例 runtime** 的 `tool_handlers` 字典执行 `bind_user_interaction_handlers` 重绑。绑定机制本身是官方扩展点，但「往共享单例上 per-request 重绑」越过其设计意图——隐含「单会话单流」假设，同 runtime 并发两流会互相覆盖绑定（ARCHITECTURE-sse.md 残留风险 #3）。

同理 `apply_config()`（`agent_integration.py:354-360`）直接写 `runtime.config.model_id` 等字段，绕过配置注册通路（`register_planify_config`），注释自述是为了绕过只读 property——说明 planify 没有提供热更新接口，宿主被迫戳内部。

### 🟡 轻：把 planify 内部模块当库函数直用

- `doclens/web_v2/api/diary.py:135`：`from planify.tools.baidu_weather import get_weather`——Web API 端点直接调**工具实现**（也是天气配置混入 planify 配置层、即技术债 #6 的另一半成因）。
- `doclens/cortex_cli.py:1110,1151`、`doclens/tui/app.py:945,1001`：CLI 直调 `run_web_search` / `run_webfetch` handler。
- `doclens/kb_tools.py:24`：导入 `planify.tools.basic.split_words_with_seps`——**有意的单一真相源**（两侧注释互相引用），属合理共享，但把 doclens 工具耦合到 planify 非公开实现细节。
- `doclens/skill_gate.py:14`：依赖 planify 的 contextvar 内部状态 `get_current_session_id()`——若 runner 不再 set 该 contextvar，门禁**静默失效**、无任何报错。

## 三、planify → doclens 的反向入侵（更违背分层）

框架反向知道宿主，问题性质更严重：

1. ~~**`planify/prompts.py:128-142,177` 硬编码 doclens 业务语义**~~（✅ 已修复，见第六节 #1）：曾在「通用 base」system prompt 写死 `search_kb / read_document / manage_kb / grep` 工具名、`load_skill("knowledge-base")`、「本应用是知识库问答工具……必须先查知识库」。
2. ~~**`planify/core/logging_config.py:16-55`**~~（✅ 已修复，见第六节 #4）：曾读 doclens 写入的 `CORTEX_DATA_DIRNAME` 环境变量；`_cortex_package_dir()` 通过 `Path(__file__).parent.parent.parent / "doclens"` **定位 doclens 包目录**，拷贝 doclens 的 `.env.example` 和 skills——首启工作区初始化（纯宿主职责）曾做进框架的日志配置模块。
3. ~~**`planify/streaming/runner.py:21,217-231`**~~（✅ 已修复，见第六节 #4）：曾从 logging_config 导入**私有函数** `_data_dirname`（下划线开头）；prompt 临时目录约定的注释曾直接引用 `doclens/web_v2/tmp_workspace.py`。

## 四、灰色地带（可接受，但需知晓）

- **`register_external_tools()` 注入 KB/grep 工具**（`agent_integration.py:233,238`）：官方扩展点的正确使用 ✅
- **子代理 `extra_tools` 注入 KB 只读工具**（`agent_integration.py:249-257`）：官方扩展点，`planify/subagent/runner.py:144` 注释明确标注「宿主应用注入」✅
- **`ChatEventEmitter` 实现 `EventEmitter` 协议**（`web_v2/api/_chat_emitter.py`）：协议化集成 ✅
- **会话持久化由 doclens 自建**（`sessions_store.py`）：planify 文档承认持久化缺位（技术债 #5），宿主补位合理；但意味着 planify 的 `AgentRuntime.messages` 在 Web 路径被架空，历史真相在 doclens 的 SQLite。

## 五、结论

**存在明确的边界入侵，且是双向的：**

| 方向 | 核心问题 | 严重度 |
|---|---|---|
| doclens → planify | 装配层整体绕过 + 手工复刻（~150 行同构代码），形成双装配器债 | 🔴 |
| doclens → planify | per-request 改写共享 runtime 的 tool_handlers；绕过配置通路直写 RuntimeConfig | 🟠 |
| planify → doclens | prompts.py 硬编码 KB 业务策略；logging_config 反向定位 doclens 包做首启初始化 | 🔴 |
| 双向 | 配置双通路（doclens env 直读 vs `register_planify_config`）+ RuntimeManager 形同虚设 | 🟠 |

**根因**：planify 的公开扩展面太窄（没有「宿主 prompt 注入」「装配自定义」「配置热更新」接口），doclens 的需求（KB prompt 策略、gui_mode 裁剪、技能目录、热重载）无处安放，于是双向都从内部撬。

**修复方向**（应在 planify 侧补扩展点，而非在 doclens 侧继续打补丁）：

1. prompt 段注入钩子（宿主注册额外 system prompt 片段），把 KB 策略从 `prompts.py` 迁回 doclens；
2. 可参数化的装配函数 / 装配钩子，收敛 `CortexAgent.initialize` 回 `bootstrap` 路径，消灭双装配器；
3. `reload_provider()` 公共 API 替代 `apply_config()` 直写 RuntimeConfig；
4. 首启工作区初始化（拷 skills/.env.example）从 `logging_config.py` 移到 doclens 启动流程；
5. 热重载后删除 `deps.py` 里对 `RuntimeManager.invalidate_provider()` 的空调用，或让装配真正走 RuntimeManager 二选一。

## 六、已修复（2026-09-02）

| # | 修复项 | 方案 | 涉及文件 |
|---|---|---|---|
| 1 | prompts.py 硬编码 KB 策略 | `build_system_prompt` / `SystemPromptBuilder.get` 新增 `extra_prompt` 参数（纳入缓存键）；`StreamingAgent` / `Agent` 新增 `system_prompt_extra` 构造参数透传；KB 策略三段文本逐字迁至 `doclens/agent_prompt.py` 的 `KB_SYSTEM_PROMPT_EXTRA`，由 `run_query()`（CLI/TUI）与 `chat.py`（Web）注入。**刻意不改**：subagent prompt 保持通用；planify 自带 cli.py 不再含 KB 策略（非 doclens 交互面） | `planify/prompts.py`、`planify/streaming/runner.py`、`planify/agent/runner.py`、`doclens/agent_prompt.py`（新建）、`doclens/agent_integration.py`、`doclens/web_v2/api/chat.py` |
| 2 | 装配层双写 | **最小变体（刻意不做完全收敛）**：RuntimeManager 官方装配缺 gui_mode / skill_access_state / 自定义 skills_dir 等 5+ 插槽，收敛风险大于收益。改为：删除 `deps.py` 的 `RuntimeManager.invalidate_provider()` 死调用（web 路径无消费者）与 import；`CortexAgent.initialize` docstring 显式声明装配归属——静默技术债转为文档化决策 | `doclens/web_v2/deps.py`、`doclens/agent_integration.py` |
| 3 | apply_config 直写 RuntimeConfig | planify 新增 `AgentRuntime.update_llm_config()` 官方热更新 API（重建 Provider + 更新 config 字段，None 表示不动）；`CortexAgent.apply_config` 改为薄适配层。顺手删除 `session.py` 死导入 `from anthropic import Anthropic`（planify 技术债 #3 一半） | `planify/core/runtime.py`（原 session.py）、`doclens/agent_integration.py` |
| 4 | logging_config 内置 doclens 首启初始化 | 确认 `_init_cortex_workspace` / `_cortex_package_dir` 全仓库零调用（doclens 自有 `CortexConfig._init_first_run`）→ 纯删除 + `import shutil` 移除；`_data_dirname` 公开化为 `data_dirname()`；`streaming/runner.py` 注释删除对 doclens 模块的引用 | `planify/core/logging_config.py`、`planify/streaming/runner.py` |
| 5 | per-request 改写共享 tool_handlers | `chat.py` 与 `agent_integration.run_query` CLI 分支改为 `{**runtime.tool_handlers}` 浅拷贝后 bind——顺带修复同 runtime 并发两流 emitter 交叉接线的真实 bug | `doclens/web_v2/api/chat.py`、`doclens/agent_integration.py` |

**残留（接受的边界状态）**：配置双通路仍在（doclens env 直读 + `register_planify_config`）；双装配器转为文档化决策而非消除；`kb_tools.py` 对 `split_words_with_seps` 的共享为有意单一真相源；`skill_gate.py` 对 contextvar 的依赖仍存（GATE_ENABLED 当前关闭）。
