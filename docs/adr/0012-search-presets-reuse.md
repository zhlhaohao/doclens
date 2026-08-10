# ADR-0012: 搜索预设——复用模型预设体系（kind 扩展）

搜索调优参数（3 过滤 + 5 评分权重）做成命名档案一键切换，**复用** ADR-0011 的模型预设整套机制（同一 `model_presets.json` / `presets_store` / `/api/presets` / 物化写 global `.env` / 激活键），以 `kind: "search"` 扩展，而非独立一套 `search_presets`。

动机：模型预设与搜索预设的机制完全同构（命名档案 → 一键物化 → 激活键 → global 单层），区别只在字段集与物化目标。复用避免 CRUD/存储/UI 模式重复，并统一"一切皆预设"的心智。

关键决策：

- **复用而非独立**：`Preset` 模型加可选搜索字段（模型字段对 search 为空、搜索字段对 llm/vision 为空），`_materialize` 加 `search` 分支物化写 `CORTEX_*` 搜索键 + `CORTEX_ACTIVE_SEARCH_PRESET`。
- **打包全部 8 个搜索参数**（3 过滤 + 5 权重）：预设即"完整搜索配置"；子集切换会半改（切了权重但阈值没动）反而更乱。
- **search tab 移除字段散填**（同 AI tab）：参数全由预设管；`KNOWN_KEYS` 保留 `CORTEX_*` 搜索键（物化写 .env 用，GET 返回但前端不再显示）。
- **切换即时热生效、无副作用**：`IndexManager.apply_config` 只更新 `_config`、不碰索引，搜索时按新参数运行（区别于视觉预设切换触发重解析）。
- **不含密钥**：搜索预设无需脱敏处理。

## Considered Options

- **独立 `search_presets`**（独立 store/API/组件）：字段集隔离彻底，但 CRUD/存储/UI 模式全部重写——否决（机制同构，复用更自然）。
- **仅打包 5 评分权重 / 仅 3 过滤**：子集切换半改——否决。
- **search tab 保留散填 + 预设**：滑块微调方便，但用户选择同 AI tab 一致（移除散填、无漂移）——否决。

## Consequences

- `Preset` 模型变胖（模型字段 + 搜索字段都可选，按 kind 区分有效字段集）。
- search tab 字段散填 section 移除（含 `WEIGHT_SECTION` 网格、`DEFAULT_WEIGHTS`）；`FIELD_DEFAULTS`/`IMPLICIT_DEFAULTS` 移除搜索项，"恢复默认"按钮的 `_allAtDefault` 判定只看 network 参数。
- 搜索预设 `name` 在 `kind=search` 内唯一（可与某 LLM 预设同名，互不冲突）——沿用模型预设规则。
