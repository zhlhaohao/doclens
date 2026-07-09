# Web Settings 页面支持 LLM Provider 切换 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 web settings 页面的 AI Tab 顶部新增 provider / protocol 两个 select 字段，让用户能选择 6 个已知预设或 custom，热切换 SessionManager 的 provider，无需重启 GUI。

**Architecture:** 后端扩展 `CortexConfig` + `KNOWN_KEYS` + `config_validator` 接受新 2 字段；新增 `SessionManager.invalidate_provider()` 让 `reload_config()` 让缓存的 provider 失效；前端 `settings-fields.ts` + `settings-view.ts` 加 2 字段 + 选中预设后 auto-fill base_url/protocol。

**Tech Stack:** Python 3.10+, FastAPI, pydantic v2 (`CortexConfig` is `BaseSettings`), Lit + TypeScript（前端）。

## Global Constraints

- Python 3.10+（项目 `requires-python`）
- pytest config: `testpaths = ["tests"]`, `asyncio_mode = "auto"`
- All functions need type annotations
- All new fields use `@dataclass(frozen=True)` for data types (LLM module pattern), but `CortexConfig` is pydantic `BaseSettings` — use pydantic `Field` for it
- 沿用 `black` / `isort` / `ruff`
- Do NOT include `Co-Authored-By:` in commit messages (project global rule)
- 现有 `claude-opus-4-6` Anthropic 路径必须保持不破（PlanifyProvider 仍是默认）
- venv path: `.venv/Scripts/python.exe`
- All env var names: UPPER_SNAKE_CASE with `PLANIFY_` prefix (per spec)
- Config dict key names: `provider_name` / `api_key` / `model_id` / `base_url` / `protocol` (per factory contract from planify/core/llm/factory.py)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `doclens/config.py` | `CortexConfig` pydantic model — add `planify_provider` + `planify_protocol` fields |
| `doclens/web_v2/config_store.py` | `KNOWN_KEYS` frozenset — add 2 new env var names |
| `doclens/web_v2/config_validator.py` | Custom validation rules (provider=custom requires base_url+protocol, etc.) |
| `planify/core/session_manager.py` | `SessionManager.invalidate_provider()` classmethod |
| `doclens/web_v2/deps.py` | `reload_config()` calls `SessionManager.invalidate_provider()` |
| `doclens/web_v2/frontend/src/views/settings-fields.ts` | Add 2 `SETTINGS_FIELDS` entries + 6 provider options + 2 protocol options + PRESET constants |
| `doclens/web_v2/frontend/src/views/settings-view.ts` | Auto-fill logic on provider change (use `_userEditedBaseUrl` flag) |
| `tests/web_v2/test_config_models.py` | New tests for `CortexConfig` provider fields |
| `tests/web_v2/test_config_store.py` | New tests for KNOWN_KEYS read/write |
| `tests/web_v2/test_config_validator.py` | New tests for custom validation |
| `tests/planify/test_session_manager.py` | New file — tests for `invalidate_provider` |
| `tests/web_v2/test_deps.py` | Extend — `reload_config` calls invalidate_provider |

---

## Task 1: 扩展 `CortexConfig` 与 `KNOWN_KEYS` 接受 2 个新字段

**Files:**
- Modify: `doclens/config.py`（`CortexConfig` 类，约 113-117 行附近）
- Modify: `doclens/web_v2/config_store.py`（`KNOWN_KEYS` 段）
- Modify: `tests/web_v2/test_config_models.py`（如不存在则新建）
- Modify: `tests/web_v2/test_config_store.py`（如不存在则新建）

**Interfaces:**
- Consumes: 无
- Produces: `CortexConfig.planify_provider: str = "anthropic"` + `CortexConfig.planify_protocol: Optional[str] = None`，`KNOWN_KEYS` 含 `"PLANIFY_PROVIDER"` 和 `"PLANIFY_PROTOCOL"`

- [ ] **Step 1: 写测试 `tests/web_v2/test_config_models.py`（如已存在则追加）**

```python
"""CortexConfig 字段测试 — 覆盖 planify_provider / planify_protocol。"""
import pytest

from doclens.config import CortexConfig


def test_cortex_config_default_provider_is_anthropic(monkeypatch):
    # 清除可能影响测试的环境变量
    for k in ["PLANIFY_PROVIDER", "PLANIFY_PROTOCOL", "PLANIFY_API_KEY",
              "PLANIFY_BASE_URL", "PLANIFY_MODEL_ID"]:
        monkeypatch.delenv(k, raising=False)
    cfg = CortexConfig()
    assert cfg.planify_provider == "anthropic"
    assert cfg.planify_protocol is None


def test_cortex_config_provider_from_env(monkeypatch):
    monkeypatch.setenv("PLANIFY_PROVIDER", "deepseek")
    monkeypatch.setenv("PLANIFY_PROTOCOL", "openai_compat")
    cfg = CortexConfig()
    assert cfg.planify_provider == "deepseek"
    assert cfg.planify_protocol == "openai_compat"
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_models.py::test_cortex_config_default_provider_is_anthropic -v`
Expected: FAIL with AttributeError (no such attribute `planify_provider`)

- [ ] **Step 3: 修改 `doclens/config.py`，在 `CortexConfig` 类已有字段（line 115-117）后添加 2 个新字段**

找到这段（line 115-117）:
```python
    planify_api_key: Optional[str] = Field(default=None, alias="PLANIFY_API_KEY")
    planify_model_id: str = Field(default="claude-opus-4-6", alias="PLANIFY_MODEL_ID")
    planify_base_url: Optional[str] = Field(default=None, alias="PLANIFY_BASE_URL")
```

在其后添加：
```python
    planify_provider: str = Field(default="anthropic", alias="PLANIFY_PROVIDER")
    planify_protocol: Optional[str] = Field(default=None, alias="PLANIFY_PROTOCOL")
```

- [ ] **Step 4: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_models.py -v`
Expected: 2 passed

- [ ] **Step 5: 写测试 `tests/web_v2/test_config_store.py`（如已存在则追加）**

```python
"""config_store KNOWN_KEYS 测试。"""
from doclens.web_v2.config_store import KNOWN_KEYS


def test_known_keys_includes_provider_and_protocol():
    assert "PLANIFY_PROVIDER" in KNOWN_KEYS
    assert "PLANIFY_PROTOCOL" in KNOWN_KEYS
    # 既有 3 个字段不能丢
    assert "PLANIFY_API_KEY" in KNOWN_KEYS
    assert "PLANIFY_BASE_URL" in KNOWN_KEYS
    assert "PLANIFY_MODEL_ID" in KNOWN_KEYS
```

- [ ] **Step 6: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_store.py::test_known_keys_includes_provider_and_protocol -v`
Expected: FAIL with AssertionError

- [ ] **Step 7: 修改 `doclens/web_v2/config_store.py` 的 `KNOWN_KEYS` frozenset**

找到 `# AI` 注释下的字段段，在 `PLANIFY_MODEL_ID` 之后添加 2 个键：
```python
    # AI
    "PLANIFY_BASE_URL",
    "PLANIFY_API_KEY",
    "PLANIFY_MODEL_ID",
    "PLANIFY_PROVIDER",
    "PLANIFY_PROTOCOL",
```

- [ ] **Step 8: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_store.py -v`
Expected: 1 passed

- [ ] **Step 9: 跑全 web_v2 config 相关测试，确保未破其它测试**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_models.py tests/web_v2/test_config_store.py tests/web_v2/test_config_api.py tests/web_v2/test_config_validator.py -v`
Expected: 全过

- [ ] **Step 10: 提交**

```bash
git add doclens/config.py doclens/web_v2/config_store.py tests/web_v2/test_config_models.py tests/web_v2/test_config_store.py
git commit -m "feat(web): add PLANIFY_PROVIDER and PLANIFY_PROTOCOL to CortexConfig and KNOWN_KEYS"
```

---

## Task 2: 添加 custom 验证规则

**Files:**
- Modify: `doclens/web_v2/config_validator.py`（在 `validate_values` 函数体内追加规则）
- Modify: `tests/web_v2/test_config_validator.py`（如不存在则新建）

**Interfaces:**
- Consumes: `CortexConfig` from doclens.config（已含 `planify_provider` / `planify_protocol`）
- Produces: `validate_values()` 拒绝 `provider=custom` 但 `base_url` 或 `protocol` 为空；拒绝 `protocol=openai_compat` 但 `base_url` 不是 http(s) URL；拒绝未知 provider 名

- [ ] **Step 1: 写测试 `tests/web_v2/test_config_validator.py`（如已存在则追加）**

```python
"""config_validator 自定义规则测试。"""
import pytest

from doclens.web_v2.config_validator import validate_values


def _ok(**overrides):
    base = {
        "PLANIFY_API_KEY": "sk-test",
        "PLANIFY_BASE_URL": "https://api.example.com",
        "PLANIFY_MODEL_ID": "claude-opus-4-6",
        "PLANIFY_PROVIDER": "anthropic",
        "PLANIFY_PROTOCOL": "anthropic",
    }
    base.update(overrides)
    return base


def test_anthropic_provider_minimal_ok():
    """anthropic + base_url 空 + protocol=anthropic 应通过（用 SDK 默认）。"""
    values = _ok()
    del values["PLANIFY_BASE_URL"]
    values["PLANIFY_BASE_URL"] = ""
    errors = validate_values(values)
    assert errors.fields == []


def test_known_preset_openai_compat_ok():
    """已知预设 + openai_compat + base_url https 应通过。"""
    values = _ok(
        PLANIFY_PROVIDER="deepseek",
        PLANIFY_PROTOCOL="openai_compat",
        PLANIFY_BASE_URL="https://api.deepseek.com/v1",
    )
    errors = validate_values(values)
    assert errors.fields == []


def test_custom_requires_base_url():
    """provider=custom 但 base_url 空应失败。"""
    values = _ok(
        PLANIFY_PROVIDER="custom",
        PLANIFY_PROTOCOL="openai_compat",
        PLANIFY_BASE_URL="",
    )
    errors = validate_values(values)
    field_names = [f.field for f in errors.fields]
    assert "PLANIFY_BASE_URL" in field_names


def test_custom_requires_protocol():
    """provider=custom 但 protocol 空应失败。"""
    values = _ok(
        PLANIFY_PROVIDER="custom",
        PLANIFY_PROTOCOL="",
        PLANIFY_BASE_URL="https://x/v1",
    )
    errors = validate_values(values)
    field_names = [f.field for f in errors.fields]
    assert "PLANIFY_PROTOCOL" in field_names


def test_openai_compat_requires_http_url():
    """protocol=openai_compat 但 base_url 不是 http(s) 应失败。"""
    values = _ok(
        PLANIFY_PROVIDER="custom",
        PLANIFY_PROTOCOL="openai_compat",
        PLANIFY_BASE_URL="ftp://x/v1",
    )
    errors = validate_values(values)
    field_names = [f.field for f in errors.fields]
    assert "PLANIFY_BASE_URL" in field_names


def test_unknown_provider_rejected():
    """未知 provider 名应失败。"""
    values = _ok(PLANIFY_PROVIDER="bogus-provider")
    errors = validate_values(values)
    field_names = [f.field for f in errors.fields]
    assert "PLANIFY_PROVIDER" in field_names
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_validator.py -v`
Expected: 多个 FAIL（custom / unknown provider 未被现有逻辑拒绝）

- [ ] **Step 3: 修改 `doclens/web_v2/config_validator.py`**

先 `cat` 文件查看完整结构（不要凭记忆改）。然后在 `validate_values` 函数体末尾追加 custom 验证逻辑（用 try/except 包裹，避免破坏现有 pydantic 校验流程）：

```python
def _custom_llm_provider_rules(values: dict) -> list[ConfigValidationError]:
    """自定义 LLM provider 验证规则。"""
    errors = []
    provider = values.get("PLANIFY_PROVIDER", "anthropic").strip()
    protocol = values.get("PLANIFY_PROTOCOL", "").strip()
    base_url = values.get("PLANIFY_BASE_URL", "").strip()

    # 已知 provider 列表（与 planify/core/llm/presets.py 同步）
    known_providers = {"anthropic", "openrouter", "qwen", "deepseek", "glm"}
    if provider and provider not in known_providers and provider != "custom":
        errors.append(ConfigValidationError(
            field="PLANIFY_PROVIDER",
            error=f"未知 provider: {provider}",
        ))
        return errors

    if provider == "custom":
        if not base_url:
            errors.append(ConfigValidationError(
                field="PLANIFY_BASE_URL",
                error="custom provider 需要 base_url",
            ))
        if not protocol:
            errors.append(ConfigValidationError(
                field="PLANIFY_PROTOCOL",
                error="custom provider 需要 protocol",
            ))

    if protocol == "openai_compat" and base_url and not base_url.startswith(("http://", "https://")):
        errors.append(ConfigValidationError(
            field="PLANIFY_BASE_URL",
            error="openai_compat 协议需要 http:// 或 https:// URL",
        ))

    return errors
```

并在 `validate_values` 主体内调用（找到 pydantic ValidationError 处理之后的位置，追加）：
```python
    # 自定义 LLM provider 规则
    errors.extend(_custom_llm_provider_rules(values_dict))
```

其中 `values_dict` 是构造 pydantic 模型时使用的 dict（如果变量名不同，找该函数内对 pydantic 调用的 dict 变量名替换）。

- [ ] **Step 4: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_validator.py -v`
Expected: 6 passed

- [ ] **Step 5: 跑全 web_v2 config 相关测试，确保未破其它**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_models.py tests/web_v2/test_config_store.py tests/web_v2/test_config_api.py tests/web_v2/test_config_validator.py -v`
Expected: 全过（可能新增 1-2 个相关旧测试，但不应失败）

- [ ] **Step 6: 提交**

```bash
git add doclens/web_v2/config_validator.py tests/web_v2/test_config_validator.py
git commit -m "feat(web): custom LLM provider validation (custom requires base_url+protocol)"
```

---

## Task 3: `SessionManager.invalidate_provider()` + `reload_config()` 集成

**Files:**
- Modify: `planify/core/session_manager.py`（加 `invalidate_provider` classmethod）
- Modify: `doclens/web_v2/deps.py`（`reload_config` 末尾调 invalidate_provider）
- Create: `tests/planify/test_session_manager.py`
- Modify: `tests/web_v2/test_deps.py`（加 reload_config 集成测试）

**Interfaces:**
- Consumes: `SessionManager._provider: Optional[Any]` 状态
- Produces: `SessionManager.invalidate_provider() -> None`（设置 `_provider = None`），`reload_config()` 调用它

- [ ] **Step 1: 写测试 `tests/planify/test_session_manager.py`**

```python
"""SessionManager.invalidate_provider 测试。"""
from unittest.mock import MagicMock, patch

import pytest

from planify.core.session_manager import SessionManager


def test_invalidate_provider_resets_cached_provider():
    """invalidate_provider 后 _provider 应为 None。"""
    fake = MagicMock()
    SessionManager._provider = fake
    SessionManager.invalidate_provider()
    assert SessionManager._provider is None


def test_invalidate_provider_safe_when_already_none():
    """多次调用或初始为 None 时不报错。"""
    SessionManager._provider = None
    SessionManager.invalidate_provider()
    assert SessionManager._provider is None
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_session_manager.py -v`
Expected: AttributeError: type object 'SessionManager' has no attribute 'invalidate_provider'

- [ ] **Step 3: 在 `planify/core/session_manager.py` 添加 `invalidate_provider` classmethod**

先 `cat` 文件查看现有结构。在 `get_provider` 之后添加：

```python
    @classmethod
    def invalidate_provider(cls) -> None:
        """使缓存的 provider 失效；下次 get_provider() 调用时重建。

        reload_config() 在 .env 变更后调用此方法，让新 provider 立即生效。
        """
        cls._provider = None
```

- [ ] **Step 4: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_session_manager.py -v`
Expected: 2 passed

- [ ] **Step 5: 写测试 `tests/web_v2/test_deps.py` 追加**

打开现有文件，在文件末尾追加：

```python
def test_reload_config_invalidates_session_manager_provider():
    """reload_config 应调 SessionManager.invalidate_provider，让 provider 失效。"""
    from unittest.mock import patch, MagicMock

    from doclens.web_v2 import deps

    fake_provider = MagicMock()
    with patch.object(deps, "SessionManager") as MockSM:
        MockSM._provider = fake_provider
        deps.reload_config()
        # 关键断言：invalidate_provider 被调用过
        MockSM.invalidate_provider.assert_called_once()
```

（如果现有 `test_deps.py` 已有 `dotenv` 相关的 monkeypatch，可能需要查看 `deps.reload_config` 的入口要求并相应调整；本测试关注的是 `invalidate_provider` 调用，monkey-patch 应该够用）

- [ ] **Step 6: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_deps.py::test_reload_config_invalidates_session_manager_provider -v`
Expected: AttributeError 或 AssertionError（`SessionManager.invalidate_provider` 未调）

- [ ] **Step 7: 修改 `doclens/web_v2/deps.py`，在 `reload_config` 末尾调 `invalidate_provider`**

先 `cat` 现有 `reload_config` 函数。在其 `return _config` 之前添加：

```python
    # 让 SessionManager 缓存的 provider 失效，下次 get_provider() 调用时重建
    from planify.core.session_manager import SessionManager
    SessionManager.invalidate_provider()
```

- [ ] **Step 8: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_deps.py::test_reload_config_invalidates_session_manager_provider -v`
Expected: 1 passed

- [ ] **Step 9: 跑全 planify + web_v2 测试，确保未破其它**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/ tests/web_v2/ -v 2>&1 | tail -30`
Expected: 47 planify + 4 web_v2 chat/deps still pass; 已知 10 个 pre-existing web_v2 failures 仍存在

- [ ] **Step 10: 提交**

```bash
git add planify/core/session_manager.py doclens/web_v2/deps.py tests/planify/test_session_manager.py tests/web_v2/test_deps.py
git commit -m "feat(planify,web): SessionManager.invalidate_provider + reload_config integration"
```

---

## Task 4: 前端 `settings-fields.ts` 新增 2 字段 + 选项表

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/settings-fields.ts`（在 `SETTINGS_FIELDS` 数组中插入 2 个新条目；新增 provider/protocol option 常量）

**Interfaces:**
- Consumes: 已有 `SettingsField` 接口
- Produces: 2 个 `SETTINGS_FIELDS` 条目（`PLANIFY_PROVIDER` 与 `PLANIFY_PROTOCOL`），`PROVIDER_OPTIONS` 6 项常量，`PROTOCOL_OPTIONS` 2 项常量，`PRESET_BASE_URLS` 与 `PRESET_PROTOCOLS` 映射

- [ ] **Step 1: 读 `doclens/web_v2/frontend/src/views/settings-fields.ts` 完整内容**

Run: `cat doclens/web_v2/frontend/src/views/settings-fields.ts`
Expected: 看到文件结构与已有 18 个 SETTINGS_FIELDS 条目

- [ ] **Step 2: 在文件顶部（`SETTINGS_FIELDS` 数组之前）新增 4 个常量**

```typescript
/** LLM provider 已知预设。必须与 planify/core/llm/presets.py::PROVIDER_PRESETS 同步。 */
export const PROVIDER_OPTIONS: SettingsFieldOption[] = [
  { value: "anthropic", label: "Anthropic（默认）" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "qwen", label: "阿里通义千问" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "glm", label: "智谱 GLM" },
  { value: "custom", label: "自定义（OpenAI 兼容或 Anthropic 协议）" },
];

/** LLM provider 协议枚举。 */
export const PROTOCOL_OPTIONS: SettingsFieldOption[] = [
  { value: "anthropic", label: "Anthropic 协议" },
  { value: "openai_compat", label: "OpenAI 兼容" },
];

/** 已知预设的默认 base_url。空字符串表示使用 SDK 默认（anthropic）。 */
export const PRESET_BASE_URLS: Record<string, string> = {
  anthropic: "",
  openrouter: "https://openrouter.ai/api/v1",
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com/v1",
  glm: "https://open.bigmodel.cn/api/paas/v4/",
  custom: "",
};

/** 已知预设的默认 protocol。 */
export const PRESET_PROTOCOLS: Record<string, string> = {
  anthropic: "anthropic",
  openrouter: "openai_compat",
  qwen: "openai_compat",
  deepseek: "openai_compat",
  glm: "openai_compat",
  custom: "",
};
```

- [ ] **Step 3: 在 `SETTINGS_FIELDS` 数组最前面（`# ===== AI 配置 (3) =====` 注释下方）插入 2 个新条目**

找到这段（`PLANIFY_BASE_URL` 之前的注释）：
```typescript
  // ===== AI 配置 (3) =====
  {
    tab: "ai",
    section: "🤖 AI 模型与 API",
    envVar: "PLANIFY_BASE_URL",
    ...
```

在 `// ===== AI 配置 (3) =====` 下方、`PLANIFY_BASE_URL` 条目之前插入：
```typescript
  {
    tab: "ai",
    section: "🤖 AI 模型与 API",
    envVar: "PLANIFY_PROVIDER",
    label: "LLM 提供商",
    component: "select",
    effect: "live",
    options: PROVIDER_OPTIONS,
    hint: "选择 LLM 提供商。已知预设会自动填入默认 base_url 和 protocol。",
  },
  {
    tab: "ai",
    section: "🤖 AI 模型与 API",
    envVar: "PLANIFY_PROTOCOL",
    label: "API 协议",
    component: "select",
    effect: "live",
    options: PROTOCOL_OPTIONS,
    hint: "已知预设下会自动选择；custom 时必填。",
  },
```

并将 `// ===== AI 配置 (3) =====` 注释改为 `// ===== AI 配置 (5) =====`

- [ ] **Step 4: 验证 TypeScript 编译无错**

Run: `cd doclens/web_v2/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错（若前端已配置 tsconfig）

如果 `npx tsc` 不可用，跳过此步，仅靠后续 E2E/手动验证。

- [ ] **Step 5: 提交**

```bash
git add doclens/web_v2/frontend/src/views/settings-fields.ts
git commit -m "feat(web): add PLANIFY_PROVIDER and PLANIFY_PROTOCOL fields to settings"
```

---

## Task 5: 前端 `settings-view.ts` 添加 auto-fill 逻辑

**Files:**
- Modify: `doclens/web_v2/frontend/src/views/settings-view.ts`（加 `@state` 标志 + `_onProviderChange` 方法 + 在保存按钮提交前检查）

**Interfaces:**
- Consumes: 已有 `SettingsView` LitElement + `PRESET_BASE_URLS` / `PRESET_PROTOCOLS` 常量
- Produces: `_userEditedBaseUrl` 状态 + provider 变化时的 auto-fill 行为

- [ ] **Step 1: 读 `doclens/web_v2/frontend/src/views/settings-view.ts` 完整内容**

Run: `cat doclens/web_v2/frontend/src/views/settings-view.ts`
Expected: 看到 SettingsView 类的完整结构（state、render、事件处理）

- [ ] **Step 2: 添加 `_userEditedBaseUrl` 状态字段**

找到 `@state() values: ...` 附近的 state 声明。在其下添加：

```typescript
  @state() private _userEditedBaseUrl = false;
```

- [ ] **Step 3: 导入 `PRESET_BASE_URLS` 与 `PRESET_PROTOCOLS`**

在文件顶部 import 段，找到从 `./settings-fields` 的 import（应该已经有 `SETTINGS_FIELDS, SETTINGS_TAB_LABELS, type SettingsField, type SettingsTab`），追加：
```typescript
import {
  SETTINGS_FIELDS,
  SETTINGS_TAB_LABELS,
  PRESET_BASE_URLS,
  PRESET_PROTOCOLS,
  type SettingsField,
  type SettingsTab,
} from "./settings-fields";
```

- [ ] **Step 4: 添加 `_onProviderChange` 方法**

在 SettingsView 类内部添加（位置：紧邻 `render()` 方法之前）：

```typescript
  private _onProviderChange(newProvider: string) {
    this.values = { ...this.values, PLANIFY_PROVIDER: newProvider };
    if (newProvider === "custom") {
      // custom 模式不自动覆盖，但建议 protocol=openai_compat
      if (!this.values["PLANIFY_PROTOCOL"]) {
        this.values = { ...this.values, PLANIFY_PROTOCOL: "openai_compat" };
      }
      return;
    }
    // 已知预设：若用户未手动改过 base_url，auto-fill
    if (!this._userEditedBaseUrl) {
      this.values = {
        ...this.values,
        PLANIFY_BASE_URL: PRESET_BASE_URLS[newProvider] ?? "",
        PLANIFY_PROTOCOL: PRESET_PROTOCOLS[newProvider] ?? "anthropic",
      };
    } else {
      // base_url 被用户改过：只覆盖 protocol，保留 base_url
      this.values = {
        ...this.values,
        PLANIFY_PROTOCOL: PRESET_PROTOCOLS[newProvider] ?? "anthropic",
      };
    }
  }

  private _onBaseUrlChange(newBaseUrl: string) {
    this._userEditedBaseUrl = true;
    this.values = { ...this.values, PLANIFY_BASE_URL: newBaseUrl };
  }
```

- [ ] **Step 5: 在 `render()` 方法中 hook 进 select 变化事件**

找到 render() 中渲染 PLANIFY_PROVIDER select 字段的位置（Task 4 新增的字段）。它应该是 metadata-driven 渲染（`SETTINGS_FIELDS` 数组迭代产生 select 元素），需要找到 select 元素的 `@change` 事件处理函数。

在 metadata-driven 渲染的 select 处理位置（找 `change` 事件 listener），对 `envVar === "PLANIFY_PROVIDER"` 的情况路由到 `this._onProviderChange(e.target.value)`。具体插入点取决于现有 select 渲染代码（可能类似 `case "select":`），但典型 pattern 是：

```typescript
// 在 select 字段的 @change handler 中
@change=${(e: Event) => {
  const value = (e.target as HTMLSelectElement).value;
  if (field.envVar === "PLANIFY_PROVIDER") {
    this._onProviderChange(value);
  } else {
    this.values = { ...this.values, [field.envVar]: value };
  }
}}
```

对 `envVar === "PLANIFY_BASE_URL"` 的情况路由到 `this._onBaseUrlChange`（保护 `_userEditedBaseUrl` 标志）。

**重要**：不要盲目复制粘贴上面的代码 — 先 `cat` 现有 select 处理代码，按现有 pattern 适配。如果现有 select handler 用了不同的写法（如内联 `if/else` 链），按相同的风格添加分支。

- [ ] **Step 6: 验证 TypeScript 编译无错**

Run: `cd doclens/web_v2/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错

- [ ] **Step 7: 提交**

```bash
git add doclens/web_v2/frontend/src/views/settings-view.ts
git commit -m "feat(web): auto-fill base_url/protocol on provider change in settings"
```

---

## Task 6: 阶段回归验证

**Files:** 无（纯验证）

- [ ] **Step 1: 跑全部 planify + web_v2 测试**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/ tests/web_v2/ -v 2>&1 | tail -30`
Expected: 47 planify + 新增的 3 个 web_v2 测试通过；已知 10 个 pre-existing web_v2 failures 仍存在

- [ ] **Step 2: 验证端到端：保存 deepseek 后 provider 切换**

模拟完整流程（不需要真实启动 GUI）：

```python
import os
os.environ["PLANIFY_PROVIDER"] = "deepseek"
os.environ["PLANIFY_API_KEY"] = "sk-fake"
os.environ["PLANIFY_BASE_URL"] = "https://api.deepseek.com/v1"
os.environ["PLANIFY_PROTOCOL"] = "openai_compat"
os.environ["PLANIFY_MODEL_ID"] = "deepseek-chat"

# 通过 get_config 读取
from planify.core.config import get_config
config = get_config()
print("provider_name:", config["provider_name"])
print("base_url:", config["base_url"])
print("protocol:", config["protocol"])

# 通过 factory 创建
from planify.core.llm import create_provider
p = create_provider(config)
print("class:", p.__class__.__name__)
print("model:", p.model)
print("base_url:", p.base_url)
```

Expected output:
```
provider_name: deepseek
base_url: https://api.deepseek.com/v1
protocol: openai_compat
class: OpenAICompatProvider
model: deepseek-chat
base_url: https://api.deepseek.com/v1
```

- [ ] **Step 3: 验证 SessionManager.invalidate_provider 工作流**

```python
from planify.core.session_manager import SessionManager
from unittest.mock import MagicMock

# 模拟缓存了一个 provider
SessionManager._provider = MagicMock()
print("before:", SessionManager._provider is not None)  # True

# 模拟 reload_config 调 invalidate
SessionManager.invalidate_provider()
print("after:", SessionManager._provider is not None)  # False
```

- [ ] **Step 4: 验证前端字段定义无 TypeScript 错**

Run: `cd doclens/web_v2/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: 无错

- [ ] **Step 5: 提交（仅当 Step 2/3/4 发现问题并修复了代码）**

如果一切正常，本任务无提交。

---

## Self-Review

### 1. Spec coverage

| Spec Section | Covered by |
|--------------|-----------|
| 4 架构 | Task 1-3 (backend) + Task 4-5 (frontend) |
| 5 文件改动清单 | Task 1-5 |
| 6.1 保存新 provider 数据流 | Task 1-3 + manual verification in Task 6 |
| 6.2 Auto-fill 行为 | Task 4-5 |
| 7 字段定义 | Task 4 |
| 8 预设默认值表 | Task 4 |
| 9 验证规则 | Task 2 (backend) + Task 5 (frontend) |
| 10 SessionManager 新方法 | Task 3 |
| 11 错误处理 | Task 2 (VALIDATION_FAILED) + Task 5 (前端校验) |
| 12 测试策略 | Tasks 1-3 测试 + Task 6 回归 |
| 13 迁移步骤 | Tasks 1-5 顺序 |
| 14 风险与缓解 | 由各 task 中的具体测试覆盖 |

### 2. Placeholder scan
- 无 TBD / TODO / 待定
- 无 "implement later"
- 无 "add appropriate error handling"（错误处理已具体到 `ConfigValidationError` 字段）

### 3. Type consistency
- `SessionManager.invalidate_provider() -> None` (Task 3) — 在 `reload_config` 中调 (Task 3)
- `PRESET_BASE_URLS: Record<string, string>` (Task 4) — 在 `settings-view.ts` 中用作 auto-fill 源 (Task 5)
- `PROVIDER_OPTIONS` / `PROTOCOL_OPTIONS` (Task 4) — 用作 `SettingsField.options` (Task 4)
- `validate_values(values: dict) -> ConfigValidationErrors` (Task 2) — `ConfigValidationError(field: str, error: str)` (Task 2)

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-08-web-settings-llm-provider.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints
