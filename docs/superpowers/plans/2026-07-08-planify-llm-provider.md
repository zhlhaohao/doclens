# planify LLM Provider 抽象层实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 planify 中引入 LLM Provider 抽象层，通过同一代码路径同时支持 Anthropic 原生协议与 OpenAI 兼容协议（DeepSeek/GLM/Qwen/Moonshot/OpenRouter/custom）。

**Architecture:** 新建 `planify/core/llm/` 子模块，提供 `LLMProvider` Protocol + `AnthropicProvider`（直通）+ `OpenAICompatProvider`（带 tool_translator 双向转译）+ `factory.create_provider(config)`。调用方（`agent/runner.py` / `context/compact.py` / `cli.py` / `web_v2/api/chat.py`）改为只依赖 `LLMProvider` 接口。配置层用 5 个统一 env vars（`PLANIFY_PROVIDER` / `PLANIFY_API_KEY` / `PLANIFY_MODEL_ID` / `PLANIFY_BASE_URL` / `PLANIFY_PROTOCOL`）+ 6 个内置预设（`anthropic` / `openrouter` / `qwen` / `deepseek` / `glm` / `custom`）。

**Tech Stack:** Python 3.10+、Anthropic SDK（已有）、OpenAI SDK（新增）、respx（HTTP mock）、pytest + pytest-asyncio（已有）、httpx（已有）。

## Global Constraints

- Python 3.10+（项目 requires-python）
- 沿用 `pyproject.toml` 已有 `testpaths = ["tests"]` 与 `asyncio_mode = "auto"`
- 沿用 `black` / `isort` / `ruff`（项目编码风格）
- 所有新增公共类型与函数必须有 type annotations
- 所有 dataclass 用 `@dataclass(frozen=True)`（immutability）
- 不在 commit message 中包含 `Co-Authored-By:`（项目规则）
- 任何阶段须保持现有 `claude-opus-4-6` 的 TUI + Web 端到端不破（回归基准）
- 用户可随时通过 `git checkout` 回滚到上一阶段（每阶段独立可发布）

---

## 阶段 1：基础（Anthropic 直通，行为零变化）

### Task 1: 新增依赖 `openai` 和 `respx`

**Files:**
- Modify: `pyproject.toml`（dependencies 段）

**Interfaces:**
- Consumes: 无
- Produces: `openai>=1.0` 和 `respx>=0.21` 进入 dev dependencies

- [ ] **Step 1: 打开 pyproject.toml 找到 dependencies 与 optional-dependencies.dev 段**

Run: `grep -n "dependencies\|respx\|openai" pyproject.toml`
Expected: 看到 `dependencies = [` 段起始行号；dev 段（如果存在）起始行号

- [ ] **Step 2: 在 dependencies 加入 openai**

修改 `pyproject.toml` 的 `dependencies` 列表，添加：
```toml
    "openai>=1.0",
```

- [ ] **Step 3: 在 dev optional-dependencies 加入 respx**

在 `optional-dependencies` 段下加入（如果没有则创建）：
```toml
[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "pytest-asyncio>=0.21",
    "pytest-cov>=4.1.0",
    "respx>=0.21",
    "httpx>=0.27.1",
]
```
（保留已有项；如已有 dev 段，追加 respx 即可）

- [ ] **Step 4: 同步安装新依赖**

Run: `.venv/Scripts/python.exe -m pip install -e ".[dev]"`
Expected: 成功安装 openai 与 respx，无报错

- [ ] **Step 5: 验证导入**

Run: `.venv/Scripts/python.exe -c "import openai, respx; print(openai.__version__, respx.__version__)"`
Expected: 打印两个版本号

- [ ] **Step 6: 提交**

```bash
git add pyproject.toml
git commit -m "build: add openai sdk and respx test dep for LLM provider"
```

---

### Task 2: 创建 `planify/core/llm/` 目录骨架

**Files:**
- Create: `planify/core/llm/__init__.py`

**Interfaces:**
- Consumes: 无
- Produces: 空包 `planify/core/llm/`

- [ ] **Step 1: 创建目录**

Run: `mkdir -p planify/core/llm`

- [ ] **Step 2: 写 __init__.py 初始内容**

文件 `planify/core/llm/__init__.py` 内容：
```python
"""LLM Provider 抽象层。"""
```

- [ ] **Step 3: 验证导入**

Run: `.venv/Scripts/python.exe -c "import planify.core.llm"`
Expected: 无报错

- [ ] **Step 4: 提交**

```bash
git add planify/core/llm/__init__.py
git commit -m "feat(planify): scaffold llm provider module"
```

---

### Task 3: 实现 `types.py`（归一化数据类）

**Files:**
- Create: `planify/core/llm/types.py`
- Create: `tests/planify/test_llm_types.py`

**Interfaces:**
- Consumes: 无
- Produces:
  - `TextBlock`（frozen dataclass, 字段 `text: str`）
  - `ToolUseBlock`（frozen dataclass, 字段 `id: str`, `name: str`, `input: dict`）
  - `ToolResultBlock`（frozen dataclass, 字段 `tool_use_id: str`, `content: str`, `is_error: bool = False`）
  - `Tool`（frozen dataclass, 字段 `name: str`, `description: str`, `input_schema: dict`）
  - `LLMResponse`（frozen dataclass, 字段 `content: list`, `stop_reason: str`, `model: str`, `usage: dict`）

- [ ] **Step 1: 写测试 `tests/planify/test_llm_types.py`**

```python
"""LLMProvider 归一化数据类测试。"""
from dataclasses import FrozenInstanceError

import pytest

from planify.core.llm.types import (
    LLMResponse,
    TextBlock,
    Tool,
    ToolResultBlock,
    ToolUseBlock,
)


def test_text_block_is_immutable():
    block = TextBlock(text="hello")
    with pytest.raises(FrozenInstanceError):
        block.text = "world"  # type: ignore[misc]


def test_tool_use_block_is_immutable():
    block = ToolUseBlock(id="toolu_1", name="read", input={"path": "/a"})
    with pytest.raises(FrozenInstanceError):
        block.name = "write"  # type: ignore[misc]


def test_tool_result_block_default_is_error_false():
    block = ToolResultBlock(tool_use_id="toolu_1", content="ok")
    assert block.is_error is False


def test_tool_immutable():
    tool = Tool(name="read", description="Read file", input_schema={"type": "object"})
    with pytest.raises(FrozenInstanceError):
        tool.name = "write"  # type: ignore[misc]


def test_llm_response_holds_blocks_and_stop_reason():
    resp = LLMResponse(
        content=[TextBlock(text="hi"), ToolUseBlock(id="t1", name="x", input={})],
        stop_reason="tool_use",
        model="claude-opus-4-6",
        usage={"input_tokens": 10, "output_tokens": 5},
    )
    assert len(resp.content) == 2
    assert resp.stop_reason == "tool_use"
    assert resp.model == "claude-opus-4-6"
    assert resp.usage["input_tokens"] == 10


def test_llm_response_is_immutable():
    resp = LLMResponse(
        content=[TextBlock(text="x")],
        stop_reason="end_turn",
        model="m",
        usage={},
    )
    with pytest.raises(FrozenInstanceError):
        resp.stop_reason = "max_tokens"  # type: ignore[misc]
```

- [ ] **Step 2: 运行测试，预期失败（模块未实现）**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_types.py -v`
Expected: ImportError: cannot import name 'TextBlock' from 'planify.core.llm.types'

- [ ] **Step 3: 实现 `planify/core/llm/types.py`**

```python
"""LLMProvider 归一化数据类型。"""
from dataclasses import dataclass
from typing import Any, Literal


@dataclass(frozen=True)
class TextBlock:
    """纯文本块。"""

    text: str
    type: Literal["text"] = "text"


@dataclass(frozen=True)
class ToolUseBlock:
    """模型请求调用工具的块。"""

    id: str
    name: str
    input: dict[str, Any]
    type: Literal["tool_use"] = "tool_use"


@dataclass(frozen=True)
class ToolResultBlock:
    """工具调用结果。"""

    tool_use_id: str
    content: str
    is_error: bool = False
    type: Literal["tool_result"] = "tool_result"


ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock


@dataclass(frozen=True)
class Tool:
    """工具定义（Anthropic 风格 JSON Schema）。"""

    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass(frozen=True)
class LLMResponse:
    """Provider 归一化响应。"""

    content: list[ContentBlock]
    stop_reason: Literal["end_turn", "tool_use", "max_tokens", "error"]
    model: str
    usage: dict[str, int]
```

- [ ] **Step 4: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_types.py -v`
Expected: 6 passed

- [ ] **Step 5: 提交**

```bash
git add planify/core/llm/types.py tests/planify/test_llm_types.py
git commit -m "feat(planify): add normalized LLM types"
```

---

### Task 4: 实现 `provider.py`（LLMProvider Protocol）

**Files:**
- Create: `planify/core/llm/provider.py`
- Create: `tests/planify/test_llm_provider.py`

**Interfaces:**
- Consumes: `types.LLMResponse`, `types.Tool`, `types.StreamEvent`（StreamEvent 在本任务用 `Any` 占位）
- Produces: `LLMProvider` Protocol 声明

- [ ] **Step 1: 写测试 `tests/planify/test_llm_provider.py`**

```python
"""LLMProvider Protocol 结构性测试。"""
from typing import Any

import pytest

from planify.core.llm.provider import LLMProvider


class _FakeProvider:
    """满足 LLMProvider Protocol 的最小实现。"""

    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list,
        max_tokens: int = 8000,
    ) -> Any:
        return None

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list,
        max_tokens: int = 8000,
    ):
        yield None

    def count_tokens(self, text: str) -> int:
        return len(text)


def test_fake_provider_satisfies_protocol():
    fake = _FakeProvider()
    # runtime_checkable Protocol
    assert isinstance(fake, LLMProvider)


def test_missing_method_breaks_protocol():
    class _Broken:
        def chat(self, *a, **kw):  # noqa: ARG002
            return None
        # missing stream and count_tokens

    assert not isinstance(_Broken(), LLMProvider)
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_provider.py -v`
Expected: ModuleNotFoundError: No module named 'planify.core.llm.provider'

- [ ] **Step 3: 实现 `planify/core/llm/provider.py`**

```python
"""LLMProvider 协议定义。"""
from typing import Any, Iterator, Protocol

from .types import LLMResponse, StreamEvent, Tool


class LLMProvider(Protocol):
    """归一化 LLM Provider 接口。

    所有 Provider（Anthropic 原生、OpenAI 兼容）必须对外呈现此接口，
    调用方只认此接口，不依赖具体 SDK 类型。
    """

    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> LLMResponse:
        """单次非流式调用。"""
        ...

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> Iterator[StreamEvent]:
        """流式调用，yield 归一化 StreamEvent。"""
        ...

    def count_tokens(self, text: str) -> int:
        """粗估 token 数。"""
        ...
```

- [ ] **Step 4: 临时在 `types.py` 增加 `StreamEvent` 占位**

修改 `planify/core/llm/types.py`，在末尾添加：
```python
@dataclass(frozen=True)
class StreamEvent:
    """归一化流式事件（后续 task 完善字段）。"""

    type: str
```

- [ ] **Step 5: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_provider.py -v`
Expected: 2 passed

- [ ] **Step 6: 提交**

```bash
git add planify/core/llm/provider.py planify/core/llm/types.py tests/planify/test_llm_provider.py
git commit -m "feat(planify): add LLMProvider protocol"
```

---

### Task 5: 实现 `presets.py`（预设表 + 解析器）

**Files:**
- Create: `planify/core/llm/presets.py`
- Create: `tests/planify/test_llm_presets.py`

**Interfaces:**
- Consumes: 配置字典（键：`planify_provider`, `planify_base_url`, `planify_protocol`）
- Produces:
  - `PROVIDER_PRESETS: dict[str, PresetSpec]`
  - `resolve_provider_config(config: dict) -> tuple[str, str | None, str, str]`
    返回 `(provider_name, base_url, model_id, protocol)`

- [ ] **Step 1: 写测试 `tests/planify/test_llm_presets.py`**

```python
"""预设表与解析器测试。"""
import pytest

from planify.core.llm.presets import (
    PROVIDER_PRESETS,
    resolve_provider_config,
)


def test_known_presets_have_base_url_and_protocol():
    for name in ["anthropic", "openrouter", "qwen", "deepseek", "glm"]:
        spec = PROVIDER_PRESETS[name]
        assert spec["protocol"] in ("anthropic", "openai_compat")
    # anthropic 可有可无 base_url（用 SDK 默认）
    assert "protocol" in PROVIDER_PRESETS["anthropic"]


def test_custom_not_in_presets():
    assert "custom" not in PROVIDER_PRESETS


def test_resolve_known_preset_anthropic():
    cfg = {
        "planify_provider": "anthropic",
        "planify_api_key": "sk-test",
        "planify_model_id": "claude-opus-4-6",
    }
    name, base_url, model, proto = resolve_provider_config(cfg)
    assert name == "anthropic"
    assert proto == "anthropic"
    assert model == "claude-opus-4-6"


def test_resolve_known_preset_deepseek():
    cfg = {
        "planify_provider": "deepseek",
        "planify_api_key": "sk-ds",
        "planify_model_id": "deepseek-chat",
    }
    _, base_url, _, proto = resolve_provider_config(cfg)
    assert proto == "openai_compat"
    assert base_url == "https://api.deepseek.com/v1"


def test_resolve_explicit_override_takes_precedence():
    cfg = {
        "planify_provider": "deepseek",
        "planify_base_url": "https://my-proxy.example.com/v1",
        "planify_protocol": "anthropic",
        "planify_api_key": "sk-x",
        "planify_model_id": "deepseek-chat",
    }
    _, base_url, _, proto = resolve_provider_config(cfg)
    assert base_url == "https://my-proxy.example.com/v1"
    assert proto == "anthropic"


def test_resolve_custom_requires_base_url():
    cfg = {
        "planify_provider": "custom",
        "planify_protocol": "openai_compat",
        "planify_api_key": "k",
        "planify_model_id": "m",
    }
    with pytest.raises(ValueError, match="base_url"):
        resolve_provider_config(cfg)


def test_resolve_custom_requires_protocol():
    cfg = {
        "planify_provider": "custom",
        "planify_base_url": "https://x/v1",
        "planify_api_key": "k",
        "planify_model_id": "m",
    }
    with pytest.raises(ValueError, match="protocol"):
        resolve_provider_config(cfg)


def test_resolve_custom_full():
    cfg = {
        "planify_provider": "custom",
        "planify_base_url": "https://x/v1",
        "planify_protocol": "openai_compat",
        "planify_api_key": "k",
        "planify_model_id": "m",
    }
    name, base_url, model, proto = resolve_provider_config(cfg)
    assert name == "custom"
    assert base_url == "https://x/v1"
    assert proto == "openai_compat"
    assert model == "m"


def test_resolve_unknown_provider_raises():
    cfg = {
        "planify_provider": "nonsense",
        "planify_api_key": "k",
        "planify_model_id": "m",
    }
    with pytest.raises(ValueError, match="unknown provider"):
        resolve_provider_config(cfg)


def test_resolve_default_provider_is_anthropic():
    cfg = {
        "planify_api_key": "k",
        "planify_model_id": "claude-opus-4-6",
    }
    name, _, _, proto = resolve_provider_config(cfg)
    assert name == "anthropic"
    assert proto == "anthropic"
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_presets.py -v`
Expected: ModuleNotFoundError

- [ ] **Step 3: 实现 `planify/core/llm/presets.py`**

```python
"""LLM Provider 预设表与解析器。"""
from typing import Literal, TypedDict

ProtocolName = Literal["anthropic", "openai_compat"]


class PresetSpec(TypedDict):
    base_url: str | None
    protocol: ProtocolName


PROVIDER_PRESETS: dict[str, PresetSpec] = {
    "anthropic": {"base_url": None, "protocol": "anthropic"},
    "openrouter": {
        "base_url": "https://openrouter.ai/api/v1",
        "protocol": "openai_compat",
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "protocol": "openai_compat",
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com/v1",
        "protocol": "openai_compat",
    },
    "glm": {
        "base_url": "https://open.bigmodel.cn/api/paas/v4/",
        "protocol": "openai_compat",
    },
}


def resolve_provider_config(
    config: dict,
) -> tuple[str, str | None, str, str]:
    """从 config 字典解析出 (provider_name, base_url, model_id, protocol)。

    规则：
      1. provider_name 默认 "anthropic"
      2. 已知预设：未显式设置 base_url/protocol 时，使用 PROVIDER_PRESETS 默认
      3. custom 预设：必须显式提供 base_url 与 protocol
      4. 显式设置优先于预设默认

    Raises:
        ValueError: provider 未知 / custom 缺字段
    """
    provider_name = config.get("planify_provider") or "anthropic"

    if provider_name not in PROVIDER_PRESETS and provider_name != "custom":
        raise ValueError(f"unknown provider: {provider_name}")

    base_url = config.get("planify_base_url") or None
    protocol = config.get("planify_protocol") or None
    model_id = config.get("planify_model_id", "")

    if provider_name == "custom":
        if not base_url:
            raise ValueError("custom provider requires planify_base_url")
        if not protocol:
            raise ValueError("custom provider requires planify_protocol")
    else:
        preset = PROVIDER_PRESETS[provider_name]
        if not base_url:
            base_url = preset["base_url"]
        if not protocol:
            protocol = preset["protocol"]

    return provider_name, base_url, model_id, protocol  # type: ignore[return-value]
```

- [ ] **Step 4: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_presets.py -v`
Expected: 10 passed

- [ ] **Step 5: 提交**

```bash
git add planify/core/llm/presets.py tests/planify/test_llm_presets.py
git commit -m "feat(planify): add provider presets and resolver"
```

---

### Task 6: 实现 `factory.py`

**Files:**
- Create: `planify/core/llm/factory.py`
- Modify: `planify/core/llm/__init__.py`（导出）
- Create: `tests/planify/test_llm_factory.py`

**Interfaces:**
- Consumes: `presets.resolve_provider_config`，`AnthropicProvider`（Task 7 才存在；本 task 先在 factory 中 import 时捕获）
- Produces: `create_provider(config: dict) -> LLMProvider` 占位（先用 `AnthropicProvider`，本阶段完整实现）

- [ ] **Step 1: 写测试 `tests/planify/test_llm_factory.py`**

```python
"""factory.create_provider 测试。"""
from unittest.mock import MagicMock

import pytest

from planify.core.llm import factory
from planify.core.llm.anthropic_provider import AnthropicProvider


def test_create_provider_anthropic(monkeypatch):
    captured = {}

    def fake_ctor(*, api_key, base_url, model):
        captured["api_key"] = api_key
        captured["base_url"] = base_url
        captured["model"] = model
        return MagicMock(spec=AnthropicProvider)

    monkeypatch.setattr(factory, "AnthropicProvider", fake_ctor)
    provider = factory.create_provider({
        "planify_provider": "anthropic",
        "planify_api_key": "sk-test",
        "planify_model_id": "claude-opus-4-6",
    })
    assert captured["api_key"] == "sk-test"
    assert captured["model"] == "claude-opus-4-6"


def test_create_provider_deepseek(monkeypatch):
    captured = {}

    def fake_ctor(*, api_key, base_url, model):
        captured["base_url"] = base_url
        captured["model"] = model
        return MagicMock()

    monkeypatch.setattr(factory, "AnthropicProvider", fake_ctor)
    factory.create_provider({
        "planify_provider": "deepseek",
        "planify_api_key": "sk-ds",
        "planify_model_id": "deepseek-chat",
    })
    assert captured["base_url"] == "https://api.deepseek.com/v1"
    assert captured["model"] == "deepseek-chat"


def test_create_provider_custom_missing_url(monkeypatch):
    monkeypatch.setattr(factory, "AnthropicProvider", lambda **kw: MagicMock())
    with pytest.raises(ValueError):
        factory.create_provider({
            "planify_provider": "custom",
            "planify_protocol": "openai_compat",
            "planify_api_key": "k",
            "planify_model_id": "m",
        })
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_factory.py -v`
Expected: ImportError（factory 与 AnthropicProvider 都未实现）

- [ ] **Step 3: 临时占位实现 `planify/core/llm/anthropic_provider.py`（仅供 factory 测试）**

```python
"""Anthropic Provider（Task 7 完整实现）。"""
from typing import Any


class AnthropicProvider:  # noqa: D401 - 临时占位
    """占位实现，Task 7 替换。"""

    def __init__(self, *, api_key: str, base_url: str | None, model: str) -> None:
        self.api_key = api_key
        self.base_url = base_url
        self.model = model

    def chat(self, *args: Any, **kwargs: Any) -> Any: ...
    def stream(self, *args: Any, **kwargs: Any) -> Any: ...
    def count_tokens(self, text: str) -> int: ...
```

- [ ] **Step 4: 实现 `planify/core/llm/factory.py`**

```python
"""LLM Provider 工厂。"""
from .anthropic_provider import AnthropicProvider
from .presets import resolve_provider_config


def create_provider(config: dict):
    """根据 config 创建 LLMProvider 实例。

    Args:
        config: 配置字典，必须含 planify_provider / planify_api_key / planify_model_id；
                custom 预设还须含 planify_base_url / planify_protocol。

    Returns:
        LLMProvider 实现（AnthropicProvider 或 OpenAICompatProvider，Task 9 引入后者）。
    """
    provider_name, base_url, model_id, protocol = resolve_provider_config(config)
    api_key = config.get("planify_api_key", "")

    if protocol == "anthropic":
        return AnthropicProvider(api_key=api_key, base_url=base_url, model=model_id)
    elif protocol == "openai_compat":
        # Task 9 引入 OpenAICompatProvider
        from .openai_compat_provider import OpenAICompatProvider

        return OpenAICompatProvider(api_key=api_key, base_url=base_url, model=model_id)
    else:
        raise ValueError(f"unknown protocol: {protocol}")
```

- [ ] **Step 5: 更新 `planify/core/llm/__init__.py`**

```python
"""LLM Provider 抽象层。"""
from .factory import create_provider
from .presets import PROVIDER_PRESETS, resolve_provider_config
from .provider import LLMProvider
from .types import (
    LLMResponse,
    StreamEvent,
    TextBlock,
    Tool,
    ToolResultBlock,
    ToolUseBlock,
)

__all__ = [
    "create_provider",
    "PROVIDER_PRESETS",
    "resolve_provider_config",
    "LLMProvider",
    "LLMResponse",
    "StreamEvent",
    "TextBlock",
    "Tool",
    "ToolResultBlock",
    "ToolUseBlock",
]
```

- [ ] **Step 6: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_factory.py -v`
Expected: 3 passed

- [ ] **Step 7: 提交**

```bash
git add planify/core/llm/factory.py planify/core/llm/anthropic_provider.py planify/core/llm/__init__.py tests/planify/test_llm_factory.py
git commit -m "feat(planify): add LLM provider factory"
```

---

### Task 7: 实现 `AnthropicProvider`（chat + stream + count_tokens）

**Files:**
- Modify: `planify/core/llm/anthropic_provider.py`（替换占位）
- Modify: `planify/core/llm/types.py`（补全 `StreamEvent` 字段）
- Create: `tests/planify/test_anthropic_provider.py`

**Interfaces:**
- Consumes: `types.Tool`, `types.LLMResponse`, `types.StreamEvent`
- Produces:
  - `AnthropicProvider(api_key, base_url, model)` 实现 `LLMProvider`
  - `chat()` 调用 `anthropic.Anthropic.messages.create`，响应转换为 `LLMResponse`
  - `stream()` yield 归一化 `StreamEvent`（Anthropic 事件直通）
  - `count_tokens(text)` 返回 `len(text) // 4` 估算

- [ ] **Step 1: 补全 `types.StreamEvent`**

修改 `planify/core/llm/types.py`，把临时 `StreamEvent` 替换为：
```python
@dataclass(frozen=True)
class StreamEvent:
    """归一化流式事件。"""

    type: Literal[
        "message_start",
        "content_block_start",
        "content_block_delta",
        "content_block_stop",
        "message_delta",
        "message_stop",
    ]
    # 可选字段
    text_delta: str | None = None
    input_json_delta: str | None = None
    stop_reason: str | None = None
    block_index: int | None = None
```

- [ ] **Step 2: 写测试 `tests/planify/test_anthropic_provider.py`**

```python
"""AnthropicProvider 测试（respx mock 拦截 httpx）。"""
import json

import httpx
import pytest
import respx

from planify.core.llm.anthropic_provider import AnthropicProvider
from planify.core.llm.types import TextBlock, Tool, ToolUseBlock


@pytest.fixture
def provider():
    return AnthropicProvider(
        api_key="sk-test",
        base_url="https://api.example.com",
        model="claude-opus-4-6",
    )


def _mock_anthropic_response(content_blocks, stop_reason="end_turn"):
    return {
        "id": "msg_01",
        "model": "claude-opus-4-6",
        "stop_reason": stop_reason,
        "content": content_blocks,
        "usage": {"input_tokens": 10, "output_tokens": 5},
    }


@respx.mock
def test_chat_text_response(provider):
    respx.post("https://api.example.com/v1/messages").mock(
        return_value=httpx.Response(
            200,
            json=_mock_anthropic_response(
                [{"type": "text", "text": "hello"}],
                stop_reason="end_turn",
            ),
        )
    )
    resp = provider.chat(
        messages=[{"role": "user", "content": "hi"}],
        system="sys",
        tools=[],
    )
    assert len(resp.content) == 1
    assert resp.content[0] == TextBlock(text="hello")
    assert resp.stop_reason == "end_turn"


@respx.mock
def test_chat_tool_use_response(provider):
    respx.post("https://api.example.com/v1/messages").mock(
        return_value=httpx.Response(
            200,
            json=_mock_anthropic_response(
                [
                    {"type": "text", "text": "calling read"},
                    {
                        "type": "tool_use",
                        "id": "toolu_1",
                        "name": "read",
                        "input": {"path": "/a"},
                    },
                ],
                stop_reason="tool_use",
            ),
        )
    )
    resp = provider.chat(messages=[], system="", tools=[
        Tool(name="read", description="Read", input_schema={"type": "object"})
    ])
    blocks = resp.content
    assert any(isinstance(b, ToolUseBlock) and b.id == "toolu_1" for b in blocks)
    assert resp.stop_reason == "tool_use"


@respx.mock
def test_chat_error_status_raises(provider):
    respx.post("https://api.example.com/v1/messages").mock(
        return_value=httpx.Response(401, json={"error": "unauthorized"})
    )
    with pytest.raises(Exception):  # 后续 task 会替换为具体 LLMError
        provider.chat(messages=[], system="", tools=[])


@respx.mock
def test_stream_yields_normalized_events(provider):
    events_raw = [
        {"type": "message_start", "message": {"id": "m1"}},
        {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}},
        {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": "hello"}},
        {"type": "content_block_stop", "index": 0},
        {"type": "message_delta", "delta": {"stop_reason": "end_turn"}},
        {"type": "message_stop"},
    ]
    # Anthropic SSE format: "data: <json>\n\n"
    sse_body = "\n\n".join(f"data: {json.dumps(e)}" for e in events_raw)
    respx.post("https://api.example.com/v1/messages").mock(
        return_value=httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            content=sse_body.encode(),
        )
    )
    out = list(provider.stream(messages=[], system="", tools=[]))
    types = [e.type for e in out]
    assert "message_start" in types
    assert "content_block_delta" in types
    delta = next(e for e in out if e.type == "content_block_delta")
    assert delta.text_delta == "hello"


def test_count_tokens_estimate(provider):
    assert provider.count_tokens("abcdefgh") == 2  # 8/4
    assert provider.count_tokens("") == 0
```

- [ ] **Step 3: 运行测试，预期失败（占位实现）**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_anthropic_provider.py -v`
Expected: 多数测试失败（占位 AnthropicProvider 没有真实逻辑）

- [ ] **Step 4: 实现 `planify/core/llm/anthropic_provider.py`**

```python
"""Anthropic 原生 Provider。

包装 anthropic SDK，事件/响应直通归一化。
"""
from __future__ import annotations

import json
from typing import Any, Iterator

import httpx
from anthropic import Anthropic

from .types import LLMResponse, StreamEvent, TextBlock, Tool, ToolResultBlock, ToolUseBlock


class AnthropicProvider:
    """LLMProvider 的 Anthropic 实现。"""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str | None,
        model: str,
    ) -> None:
        # 禁用 SSL 验证以适配自签名证书环境（与旧 init_anthropic_client 一致）
        http_client = httpx.Client(verify=False)
        kwargs: dict[str, Any] = {"api_key": api_key, "http_client": http_client}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = Anthropic(**kwargs)
        self.model = model
        self.base_url = base_url
        self.api_key = api_key

    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> LLMResponse:
        """单次非流式调用。"""
        response = self._client.messages.create(
            model=self.model,
            system=system,
            messages=messages,
            tools=[self._tool_to_anthropic(t) for t in tools],
            max_tokens=max_tokens,
        )
        content = [self._block_from_anthropic(b) for b in response.content]
        return LLMResponse(
            content=content,
            stop_reason=response.stop_reason or "end_turn",
            model=response.model,
            usage={
                "input_tokens": getattr(response.usage, "input_tokens", 0),
                "output_tokens": getattr(response.usage, "output_tokens", 0),
            },
        )

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> Iterator[StreamEvent]:
        """流式调用。Anthropic 事件格式与归一化事件语义接近，直接转换。"""
        with self._client.messages.stream(
            model=self.model,
            system=system,
            messages=messages,
            tools=[self._tool_to_anthropic(t) for t in tools],
            max_tokens=max_tokens,
        ) as stream:
            for event in stream:
                normalized = self._event_from_anthropic(event)
                if normalized is not None:
                    yield normalized

    def count_tokens(self, text: str) -> int:
        """粗估 token 数（每 4 字符 1 token）。"""
        return len(text) // 4

    # ---------- 转换工具 ----------

    @staticmethod
    def _tool_to_anthropic(tool: Tool) -> dict:
        return {
            "name": tool.name,
            "description": tool.description,
            "input_schema": tool.input_schema,
        }

    @staticmethod
    def _block_from_anthropic(block: Any) -> TextBlock | ToolUseBlock | ToolResultBlock:
        btype = getattr(block, "type", None)
        if btype == "text":
            return TextBlock(text=getattr(block, "text", ""))
        if btype == "tool_use":
            return ToolUseBlock(
                id=getattr(block, "id", ""),
                name=getattr(block, "name", ""),
                input=dict(getattr(block, "input", {}) or {}),
            )
        if btype == "tool_result":
            return ToolResultBlock(
                tool_use_id=getattr(block, "tool_use_id", ""),
                content=str(getattr(block, "content", "")),
                is_error=bool(getattr(block, "is_error", False)),
            )
        # 未知类型降级为文本
        return TextBlock(text=str(block))

    @staticmethod
    def _event_from_anthropic(event: Any) -> StreamEvent | None:
        etype = getattr(event, "type", None)
        if etype == "message_start":
            return StreamEvent(type="message_start")
        if etype == "content_block_start":
            return StreamEvent(
                type="content_block_start",
                block_index=getattr(event, "index", None),
            )
        if etype == "content_block_delta":
            delta = getattr(event, "delta", None)
            dtype = getattr(delta, "type", None) if delta else None
            if dtype == "text_delta":
                return StreamEvent(
                    type="content_block_delta",
                    text_delta=getattr(delta, "text", ""),
                    block_index=getattr(event, "index", None),
                )
            if dtype == "input_json_delta":
                return StreamEvent(
                    type="content_block_delta",
                    input_json_delta=getattr(delta, "partial_json", ""),
                    block_index=getattr(event, "index", None),
                )
            return None
        if etype == "content_block_stop":
            return StreamEvent(
                type="content_block_stop",
                block_index=getattr(event, "index", None),
            )
        if etype == "message_delta":
            delta = getattr(event, "delta", None)
            stop_reason = getattr(delta, "stop_reason", None) if delta else None
            return StreamEvent(type="message_delta", stop_reason=stop_reason)
        if etype == "message_stop":
            return StreamEvent(type="message_stop")
        return None
```

- [ ] **Step 5: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_anthropic_provider.py -v`
Expected: 5 passed

- [ ] **Step 6: 提交**

```bash
git add planify/core/llm/anthropic_provider.py planify/core/llm/types.py tests/planify/test_anthropic_provider.py
git commit -m "feat(planify): implement AnthropicProvider with chat/stream"
```

---

### Task 8: 阶段 1 回归验证（不破现有 Anthropic 流程）

**Files:** 无（仅验证）

- [ ] **Step 1: 跑所有 planify 相关测试**

Run: `.venv/Scripts/python.exe -m pytest tests/ -v --ignore=tests/web_v2 2>&1 | tail -50`
Expected: 全部通过（planify LLM 新增测试 + 现有测试）

- [ ] **Step 2: 跑 web_v2 测试，确认依赖没破**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_api.py tests/web_v2/test_deps.py -v 2>&1 | tail -20`
Expected: 全部通过

- [ ] **Step 3: 端到端 TUI 冒烟（需要真实 PLANIFY_API_KEY）**

```bash
export PLANIFY_PROVIDER=anthropic
export PLANIFY_API_KEY=<your-anthropic-key>
export PLANIFY_MODEL_ID=claude-opus-4-6
.venv/Scripts/python.exe -m doclens ai "echo hi"
```
Expected: AI 返回结果（不报错）；日志中看到 LLM 调用成功

- [ ] **Step 4: 提交阶段 1 末尾记录（如有 README 改动）**

无代码改动则不提交。

---

### Task 8.5: 实现 `errors.py`（Provider 异常类）

**Files:**
- Create: `planify/core/llm/errors.py`
- Create: `tests/planify/test_llm_errors.py`

**Interfaces:**
- Produces: `LLMError`（基类）/ `LLMAuthError` / `LLMRateLimitError` / `LLMContextLengthError` / `LLMNetworkError`

- [ ] **Step 1: 写测试 `tests/planify/test_llm_errors.py`**

```python
"""Provider 异常类测试。"""
import pytest

from planify.core.llm.errors import (
    LLMAuthError,
    LLMContextLengthError,
    LLMError,
    LLMNetworkError,
    LLMRateLimitError,
)


def test_all_inherit_from_llm_error():
    for cls in [LLMAuthError, LLMRateLimitError, LLMContextLengthError, LLMNetworkError]:
        assert issubclass(cls, LLMError)


def test_catch_llm_error_catches_subclasses():
    try:
        raise LLMAuthError("bad key")
    except LLMError as e:
        assert "bad key" in str(e)


def test_status_code_attribute():
    err = LLMRateLimitError("slow down", status_code=429)
    assert err.status_code == 429


def test_retryable_flag():
    assert LLMRateLimitError("x").retryable is True
    assert LLMAuthError("x").retryable is False
    assert LLMContextLengthError("x").retryable is False
    assert LLMNetworkError("x").retryable is True
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_errors.py -v`
Expected: ModuleNotFoundError

- [ ] **Step 3: 实现 `planify/core/llm/errors.py`**

```python
"""LLM Provider 异常类层级。"""


class LLMError(Exception):
    """Provider 层异常基类。"""

    retryable: bool = False

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class LLMAuthError(LLMError):
    """401/403：认证或权限错误，不重试。"""

    retryable = False


class LLMRateLimitError(LLMError):
    """429：限流，可重试。"""

    retryable = True


class LLMContextLengthError(LLMError):
    """413/400 with context_length_exceeded：上下文超限，不重试。"""

    retryable = False


class LLMNetworkError(LLMError):
    """网络层错误（连接超时、DNS 等），可重试。"""

    retryable = True
```

- [ ] **Step 4: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_llm_errors.py -v`
Expected: 4 passed

- [ ] **Step 5: 提交**

```bash
git add planify/core/llm/errors.py tests/planify/test_llm_errors.py
git commit -m "feat(planify): add LLM provider error hierarchy"
```

---

## 阶段 2：OpenAI 兼容 Provider

### Task 9: 实现 `tool_translator.py`（Anthropic ↔ OpenAI 转换）

**Files:**
- Create: `planify/core/llm/tool_translator.py`
- Create: `tests/planify/test_tool_translator.py`

**Interfaces:**
- Consumes: Anthropic 风格 tools/messages
- Produces:
  - `ToolCallMapper`：ID 双向映射
  - `tools_anthropic_to_openai(tools)` / `tools_openai_to_anthropic(tools)`
  - `messages_anthropic_to_openai(messages, mapper)`
  - `parse_openai_tool_calls(tool_calls, mapper)` → `list[ToolUseBlock]`
  - `accumulate_input_json_delta(deltas)` → `dict` 或 `None`

- [ ] **Step 1: 写测试 `tests/planify/test_tool_translator.py`**

```python
"""tool_translator 单元测试。"""
import pytest

from planify.core.llm.tool_translator import (
    ToolCallMapper,
    accumulate_input_json_delta,
    messages_anthropic_to_openai,
    tools_anthropic_to_openai,
)
from planify.core.llm.types import Tool


def test_tools_anthropic_to_openai():
    tools = [
        Tool(name="read", description="Read file", input_schema={"type": "object", "properties": {"path": {"type": "string"}}})
    ]
    out = tools_anthropic_to_openai(tools)
    assert out[0]["type"] == "function"
    fn = out[0]["function"]
    assert fn["name"] == "read"
    assert fn["description"] == "Read file"
    assert fn["parameters"] == {"type": "object", "properties": {"path": {"type": "string"}}}


def test_mapper_register_and_lookup():
    m = ToolCallMapper()
    internal = m.register("call_abc")
    assert internal.startswith("toolu_")
    assert m.to_openai(internal) == "call_abc"
    # 重复注册同一外部 ID 返回相同 internal
    assert m.register("call_abc") == internal


def test_messages_with_tool_use_and_tool_result():
    m = ToolCallMapper()
    internal_id = m.register("call_x")
    messages = [
        {"role": "user", "content": "do it"},
        {
            "role": "assistant",
            "content": [
                {"type": "text", "text": "ok"},
                {"type": "tool_use", "id": internal_id, "name": "read", "input": {"path": "/a"}},
            ],
        },
        {
            "role": "user",
            "content": [
                {"type": "tool_result", "tool_use_id": internal_id, "content": "file content"},
            ],
        },
    ]
    out = messages_anthropic_to_openai(messages, m)
    # assistant 转 assistant + tool_calls
    asst = out[1]
    assert asst["role"] == "assistant"
    assert asst["tool_calls"][0]["id"] == "call_x"
    assert asst["tool_calls"][0]["function"]["name"] == "read"
    import json
    assert json.loads(asst["tool_calls"][0]["function"]["arguments"]) == {"path": "/a"}
    # tool_result 转 role=tool
    tool_msg = out[2]
    assert tool_msg["role"] == "tool"
    assert tool_msg["tool_call_id"] == "call_x"
    assert tool_msg["content"] == "file content"


def test_accumulate_input_json_delta_valid():
    parsed = accumulate_input_json_delta(['{"path"', ':', ' "/a"}'])
    assert parsed == {"path": "/a"}


def test_accumulate_input_json_delta_invalid_returns_none():
    assert accumulate_input_json_delta(["{not valid"]) is None


def test_accumulate_input_json_delta_empty():
    assert accumulate_input_json_delta(["", "", ""]) is None
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_tool_translator.py -v`
Expected: ModuleNotFoundError

- [ ] **Step 3: 实现 `planify/core/llm/tool_translator.py`**

```python
"""Anthropic <-> OpenAI 兼容协议 工具调用转译。"""
from __future__ import annotations

import json
import uuid
from typing import Any, Iterator

from .types import Tool


class ToolCallMapper:
    """维护 openai_id <-> internal_id（toolu_xxx）映射。"""

    def __init__(self) -> None:
        self._openai_to_internal: dict[str, str] = {}
        self._internal_to_openai: dict[str, str] = {}

    def register(self, openai_id: str) -> str:
        """登记 openai_id，返回 internal toolu_xxx；重复返回相同 internal。"""
        if openai_id in self._openai_to_internal:
            return self._openai_to_internal[openai_id]
        internal = f"toolu_{uuid.uuid4().hex[:24]}"
        self._openai_to_internal[openai_id] = internal
        self._internal_to_openai[internal] = openai_id
        return internal

    def to_openai(self, internal_id: str) -> str | None:
        return self._internal_to_openai.get(internal_id)


def tools_anthropic_to_openai(tools: list[Tool]) -> list[dict]:
    """把 Tool 列表转为 OpenAI tools 格式。"""
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.input_schema,
            },
        }
        for t in tools
    ]


def messages_anthropic_to_openai(
    messages: list[dict], mapper: ToolCallMapper
) -> list[dict]:
    """把 Anthropic 风格 messages（含 tool_use / tool_result 块）转成 OpenAI 风格。

    转换规则：
      - assistant + tool_use blocks  -> assistant + tool_calls
      - user + tool_result blocks    -> 一条或多条 role=tool
      - 普通 user/assistant 文本     -> role=user/assistant with string content
    """
    out: list[dict] = []
    for msg in messages:
        role = msg["role"]
        content = msg.get("content")
        if isinstance(content, str) or content is None:
            out.append({"role": role, "content": content or ""})
            continue

        if role == "assistant":
            text_parts: list[str] = []
            tool_calls: list[dict] = []
            for block in content:
                btype = block.get("type")
                if btype == "text":
                    text_parts.append(block.get("text", ""))
                elif btype == "tool_use":
                    internal_id = block["id"]
                    openai_id = mapper.to_openai(internal_id) or mapper.register(
                        # 若 internal_id 不在 mapper 中（异常路径），回退为新生成
                        internal_id.replace("toolu_", "call_")
                    )
                    tool_calls.append({
                        "id": openai_id,
                        "type": "function",
                        "function": {
                            "name": block["name"],
                            "arguments": json.dumps(block.get("input", {}), ensure_ascii=False),
                        },
                    })
            asst: dict[str, Any] = {"role": "assistant", "content": "".join(text_parts)}
            if tool_calls:
                asst["tool_calls"] = tool_calls
            out.append(asst)
        elif role == "user":
            for block in content:
                if block.get("type") == "tool_result":
                    internal_id = block["tool_use_id"]
                    openai_id = mapper.to_openai(internal_id)
                    if not openai_id:
                        # 内部 ID 未注册（极端情况），跳过
                        continue
                    out.append({
                        "role": "tool",
                        "tool_call_id": openai_id,
                        "content": str(block.get("content", "")),
                    })
                else:
                    out.append({"role": "user", "content": str(block)})
        else:
            out.append({"role": role, "content": str(content)})
    return out


def accumulate_input_json_delta(deltas: list[str]) -> dict | None:
    """把流式 input_json_delta 累积并解析为 dict；失败返回 None。"""
    joined = "".join(deltas)
    if not joined.strip():
        return None
    try:
        return json.loads(joined)
    except json.JSONDecodeError:
        return None
```

- [ ] **Step 4: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_tool_translator.py -v`
Expected: 6 passed

- [ ] **Step 5: 提交**

```bash
git add planify/core/llm/tool_translator.py tests/planify/test_tool_translator.py
git commit -m "feat(planify): add Anthropic<->OpenAI tool translator"
```

---

### Task 10: 实现 `OpenAICompatProvider`（chat + count_tokens）

**Files:**
- Create: `planify/core/llm/openai_compat_provider.py`
- Create: `tests/planify/test_openai_compat_provider.py`

**Interfaces:**
- Consumes: `Tool`, `LLMResponse`，`tool_translator.*`
- Produces:
  - `OpenAICompatProvider(api_key, base_url, model)` 实现 `LLMProvider`
  - `chat()` 调用 `openai.OpenAI(...).chat.completions.create`
  - `count_tokens(text)` 估算

- [ ] **Step 1: 写测试 `tests/planify/test_openai_compat_provider.py`**

```python
"""OpenAICompatProvider 测试（respx mock）。"""
import json

import httpx
import pytest
import respx

from planify.core.llm.openai_compat_provider import OpenAICompatProvider
from planify.core.llm.types import TextBlock, Tool, ToolUseBlock


@pytest.fixture
def provider():
    return OpenAICompatProvider(
        api_key="sk-ds",
        base_url="https://api.deepseek.com/v1",
        model="deepseek-chat",
    )


def _mock_chat_completion(content_text=None, tool_calls=None, finish_reason="stop"):
    msg: dict = {"role": "assistant", "content": content_text}
    if tool_calls:
        msg["tool_calls"] = tool_calls
    return {
        "id": "cmpl-1",
        "model": "deepseek-chat",
        "choices": [
            {
                "index": 0,
                "message": msg,
                "finish_reason": finish_reason,
            }
        ],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5},
    }


@respx.mock
def test_chat_text_response(provider):
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            200, json=_mock_chat_completion(content_text="hello")
        )
    )
    resp = provider.chat(messages=[{"role": "user", "content": "hi"}], system="sys", tools=[])
    assert len(resp.content) == 1
    assert resp.content[0] == TextBlock(text="hello")
    assert resp.stop_reason == "end_turn"


@respx.mock
def test_chat_tool_call_response(provider):
    tool_calls = [
        {
            "id": "call_abc",
            "type": "function",
            "function": {
                "name": "read",
                "arguments": json.dumps({"path": "/a"}),
            },
        }
    ]
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json=_mock_chat_completion(
                content_text="calling read",
                tool_calls=tool_calls,
                finish_reason="tool_calls",
            ),
        )
    )
    resp = provider.chat(
        messages=[],
        system="",
        tools=[Tool(name="read", description="Read", input_schema={"type": "object"})],
    )
    blocks = resp.content
    assert any(isinstance(b, ToolUseBlock) and b.name == "read" for b in blocks)
    assert resp.stop_reason == "tool_use"


@respx.mock
def test_chat_invalid_tool_arguments_dont_crash(provider):
    tool_calls = [
        {
            "id": "call_bad",
            "type": "function",
            "function": {"name": "read", "arguments": "{not valid"},
        }
    ]
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json=_mock_chat_completion(tool_calls=tool_calls, finish_reason="tool_calls"),
        )
    )
    resp = provider.chat(messages=[], system="", tools=[])
    # 即使 arguments 无法解析也应不崩；input 为空 dict
    tool_block = next(b for b in resp.content if isinstance(b, ToolUseBlock))
    assert tool_block.name == "read"
    assert tool_block.input == {}


def test_count_tokens_estimate(provider):
    assert provider.count_tokens("abcdefgh") == 2
```

- [ ] **Step 2: 运行测试，预期失败**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_openai_compat_provider.py -v`
Expected: ModuleNotFoundError

- [ ] **Step 3: 实现 `planify/core/llm/openai_compat_provider.py`**

```python
"""OpenAI 兼容 Provider。"""
from __future__ import annotations

import json
from typing import Any, Iterator

from openai import OpenAI

from .tool_translator import (
    ToolCallMapper,
    messages_anthropic_to_openai,
    tools_anthropic_to_openai,
)
from .types import LLMResponse, StreamEvent, TextBlock, Tool, ToolUseBlock


class OpenAICompatProvider:
    """LLMProvider 的 OpenAI Chat Completions 实现。

    内部把 Anthropic 风格的 tools/messages 转成 OpenAI 风格，
    把响应转回 Anthropic 风格 ToolUseBlock / TextBlock。
    """

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str | None,
        model: str,
    ) -> None:
        kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self._client = OpenAI(**kwargs)
        self.model = model
        self.base_url = base_url
        self.api_key = api_key

    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> LLMResponse:
        # 每次调用创建新 mapper，避免跨请求 ID 状态泄漏
        mapper = ToolCallMapper()
        openai_messages = [{"role": "system", "content": system}] if system else []
        openai_messages.extend(messages_anthropic_to_openai(messages, mapper))
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": openai_messages,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = tools_anthropic_to_openai(tools)

        response = self._client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        message = choice.message
        content_blocks: list[TextBlock | ToolUseBlock] = []

        if message.content:
            content_blocks.append(TextBlock(text=message.content))

        if getattr(message, "tool_calls", None):
            for tc in message.tool_calls:
                internal_id = mapper.register(tc.id)
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except (json.JSONDecodeError, TypeError):
                    args = {}
                content_blocks.append(
                    ToolUseBlock(id=internal_id, name=tc.function.name, input=args)
                )

        # 映射 finish_reason
        stop_reason_map = {
            "stop": "end_turn",
            "tool_calls": "tool_use",
            "length": "max_tokens",
        }
        stop_reason = stop_reason_map.get(choice.finish_reason or "", "end_turn")

        return LLMResponse(
            content=content_blocks,
            stop_reason=stop_reason,
            model=response.model,
            usage={
                "input_tokens": getattr(response.usage, "prompt_tokens", 0) if response.usage else 0,
                "output_tokens": getattr(response.usage, "completion_tokens", 0) if response.usage else 0,
            },
        )

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> Iterator[StreamEvent]:
        raise NotImplementedError("OpenAICompatProvider.stream 将在 Task 11 实现")

    def count_tokens(self, text: str) -> int:
        return len(text) // 4
```

- [ ] **Step 4: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_openai_compat_provider.py -v`
Expected: 4 passed

- [ ] **Step 5: 提交**

```bash
git add planify/core/llm/openai_compat_provider.py tests/planify/test_openai_compat_provider.py
git commit -m "feat(planify): add OpenAICompatProvider (non-stream)"
```

---

### Task 11: 实现 `OpenAICompatProvider.stream`

**Files:**
- Modify: `planify/core/llm/openai_compat_provider.py`（替换 `stream`）
- Create: `tests/planify/test_openai_compat_stream.py`

**Interfaces:**
- Consumes: `types.StreamEvent`, `tool_translator.accumulate_input_json_delta`
- Produces: `stream()` yield 归一化 `StreamEvent`，把 OpenAI chunk 映射到 message_start/delta/stop

- [ ] **Step 1: 写测试 `tests/planify/test_openai_compat_stream.py`**

```python
"""OpenAICompatProvider.stream 测试。"""
import json

import httpx
import pytest
import respx

from planify.core.llm.openai_compat_provider import OpenAICompatProvider


@pytest.fixture
def provider():
    return OpenAICompatProvider(
        api_key="sk-ds",
        base_url="https://api.deepseek.com/v1",
        model="deepseek-chat",
    )


def _sse(data_obj):
    return f"data: {json.dumps(data_obj)}\n\n"


@respx.mock
def test_stream_text(provider):
    chunks = [
        {"id": "cmpl-1", "model": "deepseek-chat", "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {"content": "hello"}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {"content": " world"}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]},
    ]
    sse = "".join(_sse(c) for c in chunks) + "data: [DONE]\n\n"
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/event-stream"}, content=sse.encode())
    )
    out = list(provider.stream(messages=[{"role": "user", "content": "hi"}], system="", tools=[]))
    deltas = [e.text_delta for e in out if e.type == "content_block_delta" and e.text_delta]
    assert "".join(deltas) == "hello world"
    # 末尾应出现 message_stop
    assert any(e.type == "message_stop" for e in out)
    # stop_reason
    md = next((e for e in out if e.type == "message_delta"), None)
    assert md is not None and md.stop_reason == "end_turn"


@respx.mock
def test_stream_tool_call(provider):
    chunks = [
        {"id": "cmpl-2", "choices": [{"index": 0, "delta": {"role": "assistant", "tool_calls": [
            {"index": 0, "id": "call_xyz", "type": "function", "function": {"name": "read", "arguments": ""}}
        ]}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {"tool_calls": [
            {"index": 0, "function": {"arguments": '{"path"'}}
        ]}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {"tool_calls": [
            {"index": 0, "function": {"arguments": ':"/a"}'}}
        ]}, "finish_reason": None}]},
        {"choices": [{"index": 0, "delta": {}, "finish_reason": "tool_calls"}]},
    ]
    sse = "".join(_sse(c) for c in chunks) + "data: [DONE]\n\n"
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(200, headers={"content-type": "text/event-stream"}, content=sse.encode())
    )
    out = list(provider.stream(messages=[], system="", tools=[]))
    # 应有 content_block_start + content_block_delta(input_json_delta) + content_block_stop
    types = [e.type for e in out]
    assert "content_block_start" in types
    assert "content_block_stop" in types
    deltas = [e.input_json_delta for e in out if e.type == "content_block_delta" and e.input_json_delta]
    assert "".join(deltas) == '{"path":"/a"}'
    md = next(e for e in out if e.type == "message_delta")
    assert md.stop_reason == "tool_use"
```

- [ ] **Step 2: 运行测试，预期失败（stream 仍 NotImplementedError）**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_openai_compat_stream.py -v`
Expected: NotImplementedError

- [ ] **Step 3: 替换 `stream` 实现**

修改 `planify/core/llm/openai_compat_provider.py`，把 `stream` 方法替换为：
```python
    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> Iterator[StreamEvent]:
        openai_messages = [{"role": "system", "content": system}] if system else []
        # stream 内部不持有跨调用状态
        mapper = ToolCallMapper()
        openai_messages.extend(messages_anthropic_to_openai(messages, mapper))
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": openai_messages,
            "max_tokens": max_tokens,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = tools_anthropic_to_openai(tools)

        # 累积 input_json_delta 用于 tool_call
        json_deltas: dict[int, list[str]] = {}  # tool_call index -> partial JSON fragments
        tool_call_ids: dict[int, str] = {}      # tool_call index -> openai id
        tool_call_names: dict[int, str] = {}    # tool_call index -> function name
        text_started = False
        tool_started = False

        yield StreamEvent(type="message_start")

        for chunk in self._client.chat.completions.create(**kwargs):
            if not chunk.choices:
                continue
            choice = chunk.choices[0]
            delta = choice.delta

            if getattr(delta, "content", None):
                if not text_started:
                    yield StreamEvent(type="content_block_start", block_index=0)
                    text_started = True
                yield StreamEvent(
                    type="content_block_delta",
                    text_delta=delta.content,
                    block_index=0,
                )

            if getattr(delta, "tool_calls", None):
                for tc in delta.tool_calls:
                    idx = tc.index
                    if tc.id:
                        tool_call_ids[idx] = tc.id
                        tool_call_names[idx] = tc.function.name  # type: ignore[union-attr]
                        if not tool_started:
                            yield StreamEvent(
                                type="content_block_start",
                                block_index=1,
                            )
                            tool_started = True
                    if tc.function and tc.function.arguments:
                        json_deltas.setdefault(idx, []).append(tc.function.arguments)

            if choice.finish_reason:
                if text_started:
                    yield StreamEvent(type="content_block_stop", block_index=0)
                if tool_started:
                    # 关闭 tool_use block（input_json_delta 已在前面 yield）
                    yield StreamEvent(type="content_block_stop", block_index=1)
                stop_reason_map = {
                    "stop": "end_turn",
                    "tool_calls": "tool_use",
                    "length": "max_tokens",
                }
                mapped = stop_reason_map.get(choice.finish_reason, "end_turn")
                yield StreamEvent(type="message_delta", stop_reason=mapped)

        yield StreamEvent(type="message_stop")
```

- [ ] **Step 4: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_openai_compat_stream.py -v`
Expected: 2 passed

- [ ] **Step 5: 跑全部 provider 测试**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/ -v`
Expected: 所有 planify LLM 测试通过

- [ ] **Step 6: 提交**

```bash
git add planify/core/llm/openai_compat_provider.py tests/planify/test_openai_compat_stream.py
git commit -m "feat(planify): OpenAICompatProvider.stream with event mapping"
```

---

### Task 12: 阶段 2 集成验证

**Files:**
- Create: `tests/planify/test_factory_integration.py`

- [ ] **Step 1: 写集成测试**

```python
"""factory + OpenAICompatProvider 端到端集成测试。"""
import httpx
import pytest
import respx

from planify.core.llm import create_provider


def test_factory_creates_anthropic_provider():
    p = create_provider({
        "planify_provider": "anthropic",
        "planify_api_key": "sk-a",
        "planify_model_id": "claude-opus-4-6",
    })
    assert p.__class__.__name__ == "AnthropicProvider"


@respx.mock
def test_factory_creates_openai_compat_provider_for_deepseek():
    respx.post("https://api.deepseek.com/v1/chat/completions").mock(
        return_value=httpx.Response(
            200,
            json={
                "id": "cmpl",
                "model": "deepseek-chat",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "ok"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1},
            },
        )
    )
    p = create_provider({
        "planify_provider": "deepseek",
        "planify_api_key": "sk-ds",
        "planify_model_id": "deepseek-chat",
    })
    assert p.__class__.__name__ == "OpenAICompatProvider"
    resp = p.chat(messages=[{"role": "user", "content": "hi"}], system="", tools=[])
    assert resp.content[0].text == "ok"


def test_factory_custom_with_anthropic_protocol():
    p = create_provider({
        "planify_provider": "custom",
        "planify_base_url": "https://anthropic-proxy.example.com",
        "planify_protocol": "anthropic",
        "planify_api_key": "sk-x",
        "planify_model_id": "custom-model",
    })
    assert p.__class__.__name__ == "AnthropicProvider"
```

- [ ] **Step 2: 运行测试，预期通过**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_factory_integration.py -v`
Expected: 3 passed

- [ ] **Step 3: 提交**

```bash
git add tests/planify/test_factory_integration.py
git commit -m "test(planify): factory + provider integration"
```

---

## 阶段 3：重构调用方

### Task 13: 重构 `context/compact.py` 使用 LLMProvider

**Files:**
- Modify: `planify/context/compact.py`（修改 `_auto_compact` 签名与实现）
- Modify: `planify/agent/runner.py:124, 252`（调用点）

**Interfaces:**
- 旧：`auto_compact(messages, client: Anthropic, model: str, transcript_dir: str)`
- 新：`auto_compact(messages, provider: LLMProvider, transcript_dir: str)`

- [ ] **Step 1: 读当前 compact.py 与调用点**

Run: `cat planify/context/compact.py`
Expected: 看到 `_auto_compact(messages, client, model, transcript_dir)` 签名

- [ ] **Step 2: 修改 `auto_compact` 签名**

在 `planify/context/compact.py` 中，把签名改为：
```python
def auto_compact(
    messages: List[Dict],
    provider: LLMProvider,   # 原 client: Anthropic
    transcript_dir: str,
) -> List[Dict]:
```

- [ ] **Step 3: 替换 Anthropic SDK 调用为 provider.chat**

在 `auto_compact` 内部把 `client.messages.create(...)` 替换为：
```python
response = provider.chat(
    messages=summary_request_messages,
    system=summary_system,
    tools=[],  # compact 阶段不需要 tools
    max_tokens=2000,
)
summary_text = "".join(
    b.text for b in response.content if hasattr(b, "text")
)
```

- [ ] **Step 4: 修改 `agent/runner.py` 调用点**

`planify/agent/runner.py:124` 和 `:252`，两处 `self._auto_compact(messages, self.client, self.model, transcript_dir)` 改为：
```python
self._auto_compact(messages, self.provider, transcript_dir)
```

并在 `__init__` 中把 `self.client = client` 改为 `self.provider = client`（先保留 client 别名以减少破坏）：
```python
self.provider = client
# 兼容旧代码（删除之前先验证无引用）
self.client = client
```

- [ ] **Step 5: 跑现有 compact 相关测试**

Run: `.venv/Scripts/python.exe -m pytest tests/ -v -k compact 2>&1 | tail -30`
Expected: 通过或仅 mock 不匹配的小问题

- [ ] **Step 6: 跑全部 planify 测试**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/ -v`
Expected: 全过

- [ ] **Step 7: 提交**

```bash
git add planify/context/compact.py planify/agent/runner.py
git commit -m "refactor(planify): use LLMProvider in compact and runner"
```

---

### Task 14: 重构 `agent/runner.py` 完整迁移

**Files:**
- Modify: `planify/agent/runner.py:161-178`（核心 LLM 调用）

- [ ] **Step 1: 修改 LLM 调用**

`planify/agent/runner.py:161-164`，把：
```python
response = self.client.messages.create(
    model=self.model, system=system, messages=messages,
    tools=self.tools, max_tokens=8000,
)
```
替换为：
```python
response = self.provider.chat(
    messages=messages,
    system=system,
    tools=[Tool(name=t["name"], description=t.get("description", ""), input_schema=t.get("input_schema", {"type": "object"})) for t in self.tools],
    max_tokens=8000,
)
```

并在文件顶部加入 `from planify.core.llm.types import Tool, ToolUseBlock, TextBlock`。

- [ ] **Step 2: 替换响应字段访问**

`runner.py:177` 改为：
```python
messages.append({"role": "assistant", "content": [b if isinstance(b, dict) else dataclasses.asdict(b) for b in response.content]})
```

（`messages` 流转仍是 dict 列表，归一化块以 dict 形式存；保持与原 Anthropic SDK 行为一致）

或者：保持 `response.content` 直接是 `ContentBlock` 列表，但修改 `messages` 流转（推荐前者以最小化改动）。

- [ ] **Step 3: 替换 `block.type == "tool_use"` 检查**

`runner.py:187` 处：
```python
if block.type == "tool_use":
```
改为：
```python
if isinstance(block, ToolUseBlock) or (isinstance(block, dict) and block.get("type") == "tool_use"):
```

- [ ] **Step 4: 删除 `self.client` 别名（如所有引用都迁移完）**

Grep: `grep -n "self.client" planify/agent/runner.py`
Expected: 仅 `__init__` 中设置处

如已无其他引用，从 `__init__` 移除 `self.client = client`。

- [ ] **Step 5: 跑测试**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/ tests/web_v2/test_chat_api.py -v 2>&1 | tail -30`
Expected: 全过

- [ ] **Step 6: 提交**

```bash
git add planify/agent/runner.py
git commit -m "refactor(planify): runner uses LLMProvider for chat"
```

---

### Task 15: 重构 `core/session.py`（字段重命名 + 类型）

**Files:**
- Modify: `planify/core/session.py`
- Create: `tests/planify/test_session_provider.py`

- [ ] **Step 1: 修改 `SessionConfig`**

把字段：
```python
anthropic_api_key: str
anthropic_base_url: Optional[str] = None
```
改为：
```python
api_key: str
base_url: Optional[str] = None
provider_name: str = "anthropic"
protocol: str = "anthropic"
```

- [ ] **Step 2: 修改 `Session.client` 类型**

把：
```python
client: Optional[Anthropic] = None
```
改为：
```python
client: Optional[Any] = None  # 实际类型为 LLMProvider
provider: Optional[Any] = None  # 新增显式字段
```

并在类中加 property：
```python
@property
def llm_provider(self) -> Any:
    """统一访问 LLMProvider，优先用 provider，回退到 client。"""
    return self.provider or self.client
```

- [ ] **Step 3: 写测试**

```python
"""SessionConfig 字段迁移测试。"""
from planify.core.session import SessionConfig


def test_session_config_new_fields():
    cfg = SessionConfig(
        workdir=".",  # type: ignore[arg-type]
        model_id="claude-opus-4-6",
        api_key="sk-test",
        base_url="https://x",
        provider_name="deepseek",
        protocol="openai_compat",
    )
    assert cfg.api_key == "sk-test"
    assert cfg.provider_name == "deepseek"
    assert cfg.protocol == "openai_compat"


def test_session_config_defaults():
    cfg = SessionConfig(
        workdir=".",  # type: ignore[arg-type]
        model_id="m",
        api_key="k",
    )
    assert cfg.provider_name == "anthropic"
    assert cfg.protocol == "anthropic"
    assert cfg.base_url is None
```

- [ ] **Step 4: 跑测试**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/test_session_provider.py -v`
Expected: 2 passed

- [ ] **Step 5: 提交**

```bash
git add planify/core/session.py tests/planify/test_session_provider.py
git commit -m "refactor(planify): SessionConfig provider-agnostic fields"
```

---

### Task 16: 重构 `core/session_manager.py` 使用 factory

**Files:**
- Modify: `planify/core/session_manager.py`

- [ ] **Step 1: 替换 `_init_anthropic_client`**

把 `_init_anthropic_client` 替换为 `_init_provider`：
```python
@classmethod
def _init_provider(cls, config: dict | None = None) -> Optional[Any]:
    from .llm import create_provider

    if config is None:
        config = cls._get_config()
    if not config.get("planify_api_key"):
        return None
    try:
        provider = create_provider(config)
        cls._provider = provider
        cls._anthropic_model_id = config.get("planify_model_id", "")
        return provider
    except Exception as e:
        print(f"警告: 无法初始化 LLM Provider: {e}")
        return None
```

- [ ] **Step 2: 替换 `get_anthropic_client`**

新增 `get_provider`，保留 `get_anthropic_client` 为 deprecated alias：
```python
@classmethod
def get_provider(cls) -> tuple[Optional[Any], str]:
    if cls._provider is None:
        cls._init_provider()
    return cls._provider, cls._anthropic_model_id

@classmethod
def get_anthropic_client(cls) -> tuple[Optional[Any], str]:
    import warnings
    warnings.warn("get_anthropic_client 已弃用，请改用 get_provider", DeprecationWarning, stacklevel=2)
    return cls.get_provider()
```

- [ ] **Step 3: 跑测试**

Run: `.venv/Scripts/python.exe -m pytest tests/ -v -k session 2>&1 | tail -30`
Expected: 全过

- [ ] **Step 4: 提交**

```bash
git add planify/core/session_manager.py
git commit -m "refactor(planify): SessionManager uses factory for provider"
```

---

### Task 17: 重构 `cli.py` / `main.py` / `bootstrap.py` / `web_v2/deps.py` / `web_v2/api/chat.py`

**Files:**
- Modify: `planify/cli.py:299-304`
- Modify: `planify/main.py:120-122`
- Modify: `planify/bootstrap.py:52-54`
- Modify: `planify/web_v2/deps.py`
- Modify: `planify/web_v2/api/chat.py`

- [ ] **Step 1: 修改 `cli.py` 初始化**

`planify/cli.py:300-304`：
```python
from planify.core import init_anthropic_client

client = init_anthropic_client(
    config.get("anthropic_base_url"), config.get("anthropic_api_key")
)
```
改为：
```python
from planify.core.llm import create_provider

client = create_provider({
    "planify_provider": config.get("planify_provider", "anthropic"),
    "planify_api_key": config.get("planify_api_key", ""),
    "planify_model_id": config.get("planify_model_id", ""),
    "planify_base_url": config.get("planify_base_url", ""),
    "planify_protocol": config.get("planify_protocol", ""),
})
```

- [ ] **Step 2: 修改 `main.py` 字段名**

`planify/main.py:120-122` 当前形参：
```python
"model_id": app_config.get("model_id"),
"anthropic_api_key": app_config.get("anthropic_api_key"),
"anthropic_base_url": app_config.get("anthropic_base_url"),
```
改为（同步 planify_* 命名）：
```python
"model_id": app_config.get("model_id"),
"planify_api_key": app_config.get("planify_api_key"),
"planify_base_url": app_config.get("planify_base_url"),
"planify_provider": app_config.get("planify_provider", "anthropic"),
"planify_protocol": app_config.get("planify_protocol", ""),
```
并把后续 `get_user_config_dict` 调用中的 key 一并替换。

- [ ] **Step 3: 修改 `bootstrap.py` 形参**

`planify/bootstrap.py:52-54` 当前形参：
```python
planify_api_key: str = "",
planify_model_id: str = "claude-opus-4-6",
planify_base_url: str = "",
```
改为（新增 provider/protocol 形参）：
```python
planify_provider: str = "anthropic",
planify_api_key: str = "",
planify_model_id: str = "claude-opus-4-6",
planify_base_url: str = "",
planify_protocol: str = "",
```
并在 docstring 同步说明。

- [ ] **Step 4: 修改 `web_v2/deps.py`**

查找：
```bash
grep -n "init_anthropic_client\|Anthropic(" planify/web_v2/deps.py
```
把所有 `init_anthropic_client(base_url, api_key)` 替换为：
```python
from planify.core.llm import create_provider

provider = create_provider({
    "planify_provider": settings.PLANIFY_PROVIDER or "anthropic",
    "planify_api_key": settings.PLANIFY_API_KEY,
    "planify_model_id": settings.PLANIFY_MODEL_ID,
    "planify_base_url": settings.PLANIFY_BASE_URL,
    "planify_protocol": "",
})
```

- [ ] **Step 5: 修改 `web_v2/api/chat.py`**

查找：
```bash
grep -n "anthropic\|Anthropic(" planify/web_v2/api/chat.py
```
把 `agent = CortexAgent(client=anthropic_client, ...)` 改为：
```python
from planify.core.llm import create_provider

provider = create_provider({
    "planify_provider": "anthropic",
    "planify_api_key": settings.PLANIFY_API_KEY,
    "planify_model_id": settings.PLANIFY_MODEL_ID,
    "planify_base_url": settings.PLANIFY_BASE_URL,
    "planify_protocol": "",
})
agent = CortexAgent(provider=provider, ...)
```

- [ ] **Step 6: 跑全部测试**

Run: `.venv/Scripts/python.exe -m pytest tests/ -v 2>&1 | tail -50`
Expected: 全过

- [ ] **Step 7: 提交**

```bash
git add planify/cli.py planify/main.py planify/bootstrap.py planify/web_v2/deps.py planify/web_v2/api/chat.py
git commit -m "refactor(planify): wire factory into all entry points"
```

---

### Task 18: 阶段 3 回归验证（TUI + Web E2E）

**Files:** 无（验证）

- [ ] **Step 1: 跑全部 pytest**

Run: `.venv/Scripts/python.exe -m pytest tests/ -v 2>&1 | tail -30`
Expected: 全过

- [ ] **Step 2: 端到端 TUI（anthropic）**

```bash
export PLANIFY_PROVIDER=anthropic
export PLANIFY_API_KEY=<key>
export PLANIFY_MODEL_ID=claude-opus-4-6
.venv/Scripts/python.exe -m doclens ai "echo hi"
```
Expected: AI 返回正常结果

- [ ] **Step 3: 端到端 Web SSE（mock）**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_api.py -v`
Expected: 通过（SSE 事件正常）

- [ ] **Step 4: 提交（如有改动）**

无改动则不提交。

---

## 阶段 4：文档

### Task 19: 更新文档

**Files:**
- Modify: `planify/README.md`
- Modify: `planify/INTEGRATION.md`
- Modify: `planify/examples.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: 更新 README.md**

在 "安装 / 配置" 节加入 "切换 LLM Provider" 段落：
```markdown
## 切换 LLM Provider

通过 `PLANIFY_PROVIDER` 选择预设供应商：

| 预设 | 用途 | 默认 base_url | 默认协议 |
|------|------|---------------|----------|
| `anthropic`（默认） | Anthropic 原生 | SDK 默认 | `anthropic` |
| `openrouter` | OpenRouter 聚合 | `https://openrouter.ai/api/v1` | `openai_compat` |
| `qwen` | 阿里云通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `openai_compat` |
| `deepseek` | DeepSeek | `https://api.deepseek.com/v1` | `openai_compat` |
| `glm` | 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4/` | `openai_compat` |
| `custom` | 自定义 | 用户填写 | 用户填写 |

示例（DeepSeek）：
```bash
export PLANIFY_PROVIDER=deepseek
export PLANIFY_API_KEY=sk-...
export PLANIFY_MODEL_ID=deepseek-chat
```

自定义（OpenAI 兼容代理）：
```bash
export PLANIFY_PROVIDER=custom
export PLANIFY_BASE_URL=https://my-proxy/v1
export PLANIFY_PROTOCOL=openai_compat
export PLANIFY_API_KEY=...
export PLANIFY_MODEL_ID=...
```
```

- [ ] **Step 2: 更新 INTEGRATION.md**

移除旧的 `zhipuai_api_key` / `zhipuai_model_id` 示例，替换为 `PLANIFY_PROVIDER=deepseek` / `=qwen` / `=custom` 示例。

- [ ] **Step 3: 更新 examples.md**

新增 `examples.md` 段落：
- "切换到 DeepSeek"
- "切换到 Qwen"
- "通过 OpenRouter 路由多模型"
- "自定义代理"

- [ ] **Step 4: 更新 CLAUDE.md**

在 `start-app.ps1` 节加入"切换 LLM Provider"小节，列出 5 行配置示例。

- [ ] **Step 5: 提交**

```bash
git add planify/README.md planify/INTEGRATION.md planify/examples.md CLAUDE.md
git commit -m "docs: LLM provider preset table and examples"
```

---

## 自审与最终验证

### Task 20: 全量测试 + 端到端

- [ ] **Step 1: 全量测试**

Run: `.venv/Scripts/python.exe -m pytest tests/ -v 2>&1 | tail -50`
Expected: 全过

- [ ] **Step 2: 检查所有改动 diff**

Run: `git log --oneline 931bcf19..HEAD`
Expected: ~19 个 commit，每个对应一个 task

- [ ] **Step 3: 阶段 1 端到端（anthropic）**

```bash
export PLANIFY_PROVIDER=anthropic
.venv/Scripts/python.exe -m doclens ai "echo hi"
```
Expected: AI 响应

- [ ] **Step 4: 阶段 2 端到端（deepseek mock）**

可在 `test_factory_integration.py` 的 mock 测试覆盖；真实 API 端到端需用户配置真实 key。

- [ ] **Step 5: 提交最终 tag（如需）**

`git tag v0.2-llm-provider`（仅作为里程碑标记，不强制）

---

## 附录：风险与回滚点

| 阶段 | 回滚命令 |
|------|----------|
| 阶段 1（Task 1-8） | `git reset --hard 931bcf19` |
| 阶段 2（Task 9-12） | `git reset --hard <阶段1末尾commit>` |
| 阶段 3（Task 13-18） | `git reset --hard <阶段2末尾commit>` |
| 阶段 4（Task 19） | `git reset --hard <阶段3末尾commit>` |

每个阶段都保持了现有 `claude-opus-4-6` 行为不变，可安全地阶段性发布。
