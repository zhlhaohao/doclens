# ADR-0011: 模型预设体系 —— 命名档案一键切换，物化进 .env

新增「模型预设 (Model Profile)」：一份命名的、可一键切换的完整模型连接档案，打包 `protocol + base_url + model_id + api_key`（LLM 另含 `context_window`）。LLM 与视觉模型共用一套预设体系，以 `kind: llm | vision` 区分。切换预设即将其全部字段一次性物化写入 global `.env`（local config 已禁用），运行时照旧只读 `.env`（`CortexConfig` / `planify` / `vision_worker`）。

动机：此前更换模型须逐字段重填（API Key、Model ID 等），而现有「供应商预设」只自动填 `base_url + protocol`，不覆盖 key/model；视觉模型则连半成品都没有。预设体系把"完整模型档案"作为可切换单位，把痛点从"重填 N 个字段"降到"选一个名字"。

关键的非显然决策：

- **物化进 .env，而非"激活指针 + 运行时读预设"**：保留 `.env` 为运行时单一真相源，避免重写 `CortexConfig.load → planify resolve → vision_worker` 整条读取链路；同时保留用户在设置页手动微调单字段的能力。代价是 `.env` 与预设可能漂移，以"激活预设 id"键 + 设置页偏离提示缓解。
- **废弃 `PLANIFY_PROVIDER` 字段及随包供应商表**：`provider` 在运行时不被消费（factory 只用 `protocol` 选 SDK），唯一作用是查 `(base_url, protocol)` 表；预设直接存这两个字段后，该中间层冗余。连带移除设置页"LLM 提供商"下拉、前端 `PROVIDER_OPTIONS` / `PRESET_BASE_URLS` / `PRESET_PROTOCOLS`、`.env.example` 引导项，**以及 planify 包内部的 `PROVIDER_PRESETS` 表与 `provider_name` 调用链**（`resolve_provider_config` 简化为只读 `base_url/model_id/protocol`；bootstrap / session / cli / config + doclens 的 agent_integration / diary_worker / cortex_cli / tui 全部清理）；老 `.env` 残留的 `PLANIFY_PROVIDER` 不再被任何代码读取。
- **预设存明文 API Key**：key 本就以明文存于 `.env`，预设副本放同目录、同 gitignore 保护、不参与 Git 同步，安全等级不变，但切换才真正做到零重填（含跨供应商切换这一最痛场景）。
- **全局单层预设库 `~/.cortex/model_presets.json`，不参与 Git 同步**：模型选择是用户级/机器级关注点，不随知识库变化；含明文凭据故各机器各自维护。
- **不预置、空列表自建**：用户明确选择完全自控的干净预设库，接受"首次创建预设时 base_url 须自行填写"的代价。

## Considered Options

- **激活指针 + 运行时读预设**（`PLANIFY_ACTIVE_PRESET` id，运行时查预设文件）：单一真相源无漂移，但要改读取链路全线、破坏手工编辑 .env 能力——否决。
- **保留 `provider` 字段 + 供应商表作创建预设的预填助手**：便利但有冗余字段、两套机制重叠——否决（用户选择彻底废弃）。
- **预设不存 key**：跨供应商切换仍须手动贴 key，恰是最痛场景——否决。
- **双层预设库（global + local）**：复杂度翻倍、几乎无真实需求——否决。
- **开箱预置常见预设 / base_url datalist 提示**：与"干净自建"偏好冲突——否决。

## Consequences

- 新增第二个明文 key 载体 `model_presets.json`，须与 `.env` 同等保护（gitignore、GET 脱敏、不进同步范围）。
- `PLANIFY_PROVIDER` 已**彻底移除**（含 planify 包内部 `provider_name` 调用链与 `PROVIDER_PRESETS` 表，factory 只用 `protocol` 选 SDK）；老 `.env` 残留的该键不再被任何代码读取。现有 `PLANIFY_*` / `VISION_*` 值保留不动物化（用户首次创建并切换预设时才开始物化）。
- 物化写 **global `.env`**（local config 已整体禁用——store scope 恒 global；模型为机器级关注点）。切换时同时**清 local `.env` 中对应模型键的残留**（空串=删除），避免 local 覆盖 global 致切换失效。激活预设 id（`CORTEX_ACTIVE_LLM_PRESET` / `CORTEX_ACTIVE_VISION_PRESET`）只存 global。（2026-08-09 演进：初版仅写 local → global+local 同步 → 终定 global-only + 清 local 残留，与「local config 禁用」一致。）
- 切换 LLM 预设即时热生效（`reload_config`）；切换视觉预设触发已解析图像下次启动重新解析（既有行为）。
- 视觉 `protocol` 取值与 LLM 对齐为 `openai_compat` / `anthropic`，消除现有"空串=OpenAI 兼容"的歧义。
