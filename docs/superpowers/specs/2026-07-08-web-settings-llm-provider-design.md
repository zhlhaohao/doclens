# Web Settings 页面支持 LLM Provider 切换

**日期**：2026-07-08
**状态**：待审阅
**作者**：brainstorming session

## 1. 背景

已完成 planify LLM Provider 抽象层（22 commits, 见 spec `2026-07-08-planify-llm-provider-design.md`），后端支持 6 个预设（anthropic / openrouter / qwen / deepseek / glm / custom）。但 **web UI 的 settings 页面完全未触碰**：用户无法在浏览器切换 provider，只能通过 .env 文件手动设置。

本文档设计：把 provider 切换集成到现有 settings 页面，让用户能热切换生效，无需重启 GUI。

## 2. 目标

- 在 settings 页面的 AI Tab 顶部新增 provider 切换控件
- 选中已知预设后自动填入 base_url + protocol（用户可覆盖）
- 选中 custom 时要求 base_url + protocol 显式填入
- 保存后热切换 SessionManager 的 provider，无需重启

## 3. 非目标（YAGNI）

- 不做 chat 视图的快速切换器
- 不做 provider 历史记录或多 profile
- 不做独立的"Provider" tab
- 不做 server-side 工具迁移
- 不改 settings 页面其他 tabs（Search / Scoring / Terminal）

## 4. 架构

```
┌──────────────────────────────────────────────┐
│ Frontend settings-view                       │
│   new fields: provider (select 6)            │
│                protocol (select 2)           │
│   auto-fill on preset change                 │
│   validation messages                        │
└──────────────────────────────────────────────┘
                ↓ PUT /api/config
┌──────────────────────────────────────────────┐
│ Backend doclens/web_v2/api/config.py         │
│   KNOWN_KEYS += [PLANIFY_PROVIDER,           │
│                  PLANIFY_PROTOCOL]           │
│   validate_values: custom rules              │
│   write → reload_config()                    │
└──────────────────────────────────────────────┘
                ↓ reload_config
┌──────────────────────────────────────────────┐
│ SessionManager                              │
│   _provider → set to None                    │
│   next get_provider() call rebuilds           │
└──────────────────────────────────────────────┘
```

## 5. 文件改动清单

| 文件 | 改动 |
|------|------|
| `doclens/web_v2/config_store.py` | `KNOWN_KEYS` 增 `PLANIFY_PROVIDER` / `PLANIFY_PROTOCOL` |
| `doclens/web_v2/config_validator.py` | 增 `provider=custom` 校验规则 |
| `doclens/web_v2/deps.py` | `reload_config()` 末尾调 `SessionManager.invalidate_provider()` |
| `planify/core/session_manager.py` | 增 `invalidate_provider()` classmethod |
| `doclens/web_v2/frontend/src/views/settings-fields.ts` | 增 2 个 SETTINGS_FIELDS 条目 + provider/protocol options |
| `doclens/web_v2/frontend/src/views/settings-view.ts` | 监听 provider 变化 → auto-fill base_url/protocol |
| `tests/web_v2/test_config_validator.py` | 增 custom 校验 + save 路径测试 |
| `tests/planify/test_session_manager.py`（可能新建） | 增 `invalidate_provider` 测试 |

## 6. 数据流

### 6.1 保存新 provider

1. 用户改 `PLANIFY_PROVIDER = "deepseek"`
2. 前端 auto-fill：`PLANIFY_BASE_URL = "https://api.deepseek.com/v1"`，`PLANIFY_PROTOCOL = "openai_compat"`（仅当用户未手动改过这些字段）
3. 用户点保存
4. 前端 `PUT /api/config?scope=local` with `{"values": {PLANIFY_PROVIDER, PLANIFY_PROTOCOL, PLANIFY_BASE_URL, PLANIFY_API_KEY, PLANIFY_MODEL_ID}}`
5. 后端 `validate_values`：provider=deepseek（合法），protocol=openai_compat（合法），base_url（合法 URL）
6. 后端 `write_env_values()` 写 .env
7. 后端 `reload_config()`
8. `reload_config()` 调 `SessionManager.invalidate_provider()` → `cls._provider = None`
9. 前端收到 `{ok: true, needs_restart: false, restart_fields: []}`
10. 用户切到 chat 视图发消息
11. chat 调用 `CortexAgent.run_query()` → `SessionManager.get_provider()` → `_init_provider()` 重建 `OpenAICompatProvider` (deepseek)

### 6.2 Auto-fill 行为

`settings-view.ts` 用 `@state` 字段监听 `provider` 变化：

```typescript
// settings-view.ts (示意)
private _userEditedBaseUrl = false;

private _onProviderChange(newProvider: string) {
  this.values[PLANIFY_PROVIDER] = newProvider;
  if (newProvider !== 'custom' && !this._userEditedBaseUrl) {
    this.values[PLANIFY_BASE_URL] = PRESET_BASE_URLS[newProvider] || '';
    this.values[PLANIFY_PROTOCOL] = PRESET_PROTOCOLS[newProvider] || 'anthropic';
  } else if (newProvider === 'custom') {
    this.values[PLANIFY_PROTOCOL] = this.values[PLANIFY_PROTOCOL] || 'openai_compat';
  }
}
```

`_userEditedBaseUrl` 在用户主动改 `PLANIFY_BASE_URL` 文本框时设为 true（保护用户输入不被 auto-fill 覆盖）。

## 7. 字段定义

### 7.1 `PLANIFY_PROVIDER`

- **Type**: `select`
- **Tab**: `ai`
- **Section**: `🤖 AI 模型与 API`
- **Options**:
  - `anthropic` "Anthropic（默认）"
  - `openrouter` "OpenRouter"
  - `qwen` "阿里通义千问"
  - `deepseek` "DeepSeek"
  - `glm` "智谱 GLM"
  - `custom` "自定义（OpenAI 兼容或 Anthropic 协议）"
- **Effect**: `live`
- **Hint**: "选择 LLM 提供商。已知预设会自动填入默认 base_url 和 protocol。"

### 7.2 `PLANIFY_PROTOCOL`

- **Type**: `select`
- **Tab**: `ai`
- **Section**: `🤖 AI 模型与 API`
- **Options**:
  - `anthropic` "Anthropic 协议"
  - `openai_compat` "OpenAI 兼容"
- **Effect**: `live`
- **Hint**: "已知预设下会自动选择；custom 时必填。"

### 7.3 现有 3 字段（保持不变）

- `PLANIFY_BASE_URL` text / restart / mono
- `PLANIFY_API_KEY` password / restart / mono
- `PLANIFY_MODEL_ID` text / restart / mono

## 8. 预设默认值表（前端常量）

```typescript
const PRESET_BASE_URLS: Record<string, string> = {
  anthropic: '',  // SDK 默认
  openrouter: 'https://openrouter.ai/api/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  deepseek: 'https://api.deepseek.com/v1',
  glm: 'https://open.bigmodel.cn/api/paas/v4/',
  custom: '',
};

const PRESET_PROTOCOLS: Record<string, string> = {
  anthropic: 'anthropic',
  openrouter: 'openai_compat',
  qwen: 'openai_compat',
  deepseek: 'openai_compat',
  glm: 'openai_compat',
  custom: '',  // user must pick
};
```

后端 `planify/core/llm/presets.py::PROVIDER_PRESETS` 已有同名表（不同步使用，前后端各持一份作为契约）。

## 9. 验证规则

### 9.1 前端（`settings-view.ts` 保存前）

- `provider=custom` 时：`base_url` 和 `protocol` 都必填，否则前端 toast 红条，禁用保存按钮
- `protocol=openai_compat` 时：`base_url` 必须以 `http://` 或 `https://` 开头

### 9.2 后端（`config_validator.py::validate_values`）

- 同上规则（双层防御）
- 未知 provider 名 → 拒绝
- 失败返回 `CortexAPIError(400, "VALIDATION_FAILED")` with `fields` 列表

## 10. SessionManager 新方法

```python
@classmethod
def invalidate_provider(cls) -> None:
    """使缓存的 provider 失效；下次 get_provider() 调用时重建。

    reload_config() 在 env 变更后调用此方法，让新 provider 立即生效。
    """
    with cls._lock:  # 如果存在 lock
        cls._provider = None
```

`doclens/web_v2/deps.py::reload_config()` 末尾添加：

```python
from planify.core.session_manager import SessionManager
SessionManager.invalidate_provider()
```

（注意：现有的 `_init_provider` 是 classmethod with lock pattern，需保持一致）

## 11. 错误处理

- 后端 `VALIDATION_FAILED` 400 → 前端 toast 红条 + 字段下方红字提示（用现有 `ConfigApiError` 错误展示组件）
- 后端 `WRITE_FORBIDDEN` 403 → 前端 toast 红条
- 前端 auto-fill 触发空字符串 → 后端兜底拒绝

## 12. 测试策略

### 12.1 单元测试

| 测试 | 文件 | 覆盖 |
|------|------|------|
| `test_provider_presets_defined` | `tests/planify/test_session_manager.py` | PROVIDER_PRESETS 存在 6 个 |
| `test_invalidate_provider` | 同上 | `invalidate_provider()` 后 `_provider is None` |
| `test_reload_config_invalidates_provider` | `tests/web_v2/test_deps.py` | reload_config 调 SessionManager.invalidate_provider |
| `test_validate_custom_requires_base_url` | `tests/web_v2/test_config_validator.py` | provider=custom + 空 base_url → 错误 |
| `test_validate_custom_requires_protocol` | 同上 | provider=custom + 空 protocol → 错误 |
| `test_validate_openai_compat_requires_https` | 同上 | protocol=openai_compat + 非 http(s) URL → 错误 |
| `test_validate_unknown_provider` | 同上 | provider=garbage → 错误 |
| `test_save_provider_switch` | `tests/web_v2/test_config_api.py` | PUT /api/config 切到 deepseek 成功 |
| `test_save_custom_missing_url` | 同上 | PUT /api/config provider=custom 无 base_url → 400 |

### 12.2 端到端（如 playwright 已配置）

| 测试 | 覆盖 |
|------|------|
| E2E: 切到 deepseek → reload → chat 用 deepseek | 完整流程 |

## 13. 迁移步骤（粗略）

1. 后端：`config_store.py` `KNOWN_KEYS` 增 2 个键
2. 后端：`config_validator.py` 增 custom 规则
3. 后端：`session_manager.py` 增 `invalidate_provider()` classmethod
4. 后端：`deps.py::reload_config()` 末尾调 `invalidate_provider()`
5. 前端：`settings-fields.ts` 增 2 个字段 + options 表
6. 前端：`settings-view.ts` 增 `_onProviderChange()` auto-fill 逻辑
7. 测试：写单元测试覆盖新逻辑
8. 端到端：E2E（如有 playwright）

## 14. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 用户切到 deepseek 但没改 api_key，保存后 provider 报错 | 切到非 anthropic 预设时，如果 `api_key` 为空则前端 disabled 保存按钮 + 提示"请先填入 API Key" |
| 旧 session 已经用 anthropic client 在跑聊天，切 provider 后旧 session 出错 | SessionManager 重建 provider 即可；旧 session 持有 client 引用但下次 get_provider 返回新对象 |
| Custom 预设 base_url 拼错 | 验证 URL 格式（http/https 前缀）+ 后端 factory 兜底 |
| Preset 列表未来会扩 | 选项在前端写为常量数组 + 后端 presets.py 同步；后续可改为从 /api/providers 动态获取 |
| 启动 GUI 时 .env 无 PLANIFY_PROVIDER | 默认 "anthropic"（与 factory 默认一致） |

## 15. 关联文档

- 主 spec: `docs/superpowers/specs/2026-07-08-planify-llm-provider-design.md`
- 主 plan: `docs/superpowers/plans/2026-07-08-planify-llm-provider.md`
