# planify LLM Provider 抽象层设计

**日期**：2026-07-08
**状态**：待审阅
**作者**：brainstorming session

## 1. 背景与目标

### 1.1 当前状况

`planify` 模块的 LLM 集成**强耦合于 Anthropic SDK**：

- `planify/core/client.py` 只有一个 `init_anthropic_client(base_url, api_key)`
- 配置层 `PLANIFY_API_KEY` / `PLANIFY_MODEL_ID`（默认 `claude-opus-4-6`）/ `PLANIFY_BASE_URL` 实际是 Anthropic SDK 的参数集合
- 核心调用点 `planify/agent/runner.py:161` 写死 `self.client.messages.create(...)`，响应字段 `response.content[].type=='tool_use'`、`block.id` / `block.name` / `block.input` / `response.stop_reason` 都是 Anthropic 协议特有
- `planify/context/compact.py`、`session_manager.py`、`cli.py` 同样强耦合

虽然代码中存在 `PLANIFY_BASE_URL` 字段，**但它只改变 Anthropic SDK 的 endpoint，并不切换协议**。所以同一份代码无法走 OpenAI Chat Completions API（DeepSeek、GLM、Qwen、Moonshot、OpenRouter 等都走该协议）。

### 1.2 目标

让 planify 通过**同一套代码路径**同时支持：

- **Anthropic 原生协议**（保持现有行为）
- **OpenAI 兼容协议**（覆盖 DeepSeek / GLM / Qwen / Moonshot / OpenRouter / 自定义代理等）

### 1.3 非目标（YAGNI）

- 不支持 Google Gemini、AWS Bedrock、Mistral 等需要独立协议实现的 Provider
- 不支持 OpenAI Responses API（仅 Chat Completions）
- 不在本次重构里实现 structured output / JSON mode / vision
- 不实现 function-calling 之外的 tool 协议（computer use、web search 等）

## 2. 用户视角

### 2.1 预设供应商

用户从下列**预设**中选择一个：

| 预设名 | 默认 `base_url` | 默认协议 |
|--------|------------------|----------|
| `anthropic`（默认） | （SDK 默认） | `anthropic` |
| `openrouter` | `https://openrouter.ai/api/v1` | `openai_compat` |
| `qwen` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `openai_compat` |
| `deepseek` | `https://api.deepseek.com/v1` | `openai_compat` |
| `glm` | `https://open.bigmodel.cn/api/paas/v4/` | `openai_compat` |
| `custom` | （无默认） | （无默认） |

- 已知预设：`base_url` 和 `protocol` 自动填好，**用户只需填 `api_key` 和 `model_id`**
- `custom` 预设：用户**必须**填 `base_url` 和 `protocol`
- 已知预设也支持 `base_url` / `protocol` 显式覆盖（高级用户）

### 2.2 统一环境变量（仅一套）

| 变量 | 必填 | 说明 |
|------|------|------|
| `PLANIFY_PROVIDER` | 否（默认 `anthropic`） | `anthropic` / `openrouter` / `qwen` / `deepseek` / `glm` / `custom` |
| `PLANIFY_API_KEY` | 是 | 唯一 api key（不分裂为 `OPENAI_API_KEY`） |
| `PLANIFY_MODEL_ID` | 否（默认 `claude-opus-4-6`） | 唯一 model id（不分裂为 `OPENAI_MODEL_ID`）；用户实际通常会显式覆盖为具体模型名 |
| `PLANIFY_BASE_URL` | `custom` 必填；其他可选 | 已知预设自动填；可显式覆盖 |
| `PLANIFY_PROTOCOL` | `custom` 必填；其他可选 | `anthropic` / `openai_compat`；已知预设可省略 |

`custom` 预设可选 `anthropic` 协议：用户可接入任何 Anthropic 兼容的私有部署或代理（例如 DeepSeek 的 `/anthropic` 端点、本地 Anthropic 协议网关等）。

## 3. 架构

```
┌──────────────────────────────────────────────────────────────┐
│  Agent Runner / compact / cli / web SSE  (调用方)          │
│     只认归一化的 LLMProvider 接口                            │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│              LLMProvider (Protocol)                          │
│   .chat(messages, system, tools, max_tokens) -> LLMResponse  │
│   .stream(...)  -> Iterator[StreamEvent]                     │
│   .count_tokens(text) -> int                                 │
└──────────────────────────────────────────────────────────────┘
                          ↑ 实现
            ┌─────────────┴─────────────┐
┌───────────────────┐         ┌───────────────────────┐
│ AnthropicProvider │         │ OpenAICompatProvider │
│ (包装 Anthropic   │         │ (包装 openai SDK,    │
│  SDK, 直通)       │         │  内部转译)            │
└───────────────────┘         └───────────────────────┘
                          ↑
┌──────────────────────────────────────────────────────────────┐
│  factory.create_provider(config)  根据 PLANIFY_PROVIDER     │
│         + presets.PROVIDER_PRESETS 解析 base_url/protocol    │
└──────────────────────────────────────────────────────────────┘
                          ↑
┌──────────────────────────────────────────────────────────────┐
│  config.py 读取统一 env vars                                  │
└──────────────────────────────────────────────────────────────┘
```

## 4. 新增文件

```
planify/core/llm/
├── __init__.py                # 导出 LLMProvider, create_provider, 归一化类型
├── types.py                   # 归一化数据类型（frozen dataclass）
├── provider.py                # LLMProvider Protocol
├── factory.py                 # create_provider(config) -> LLMProvider
├── presets.py                 # PROVIDER_PRESETS 预设表 + 解析逻辑
├── tool_translator.py         # Anthropic <-> OpenAI tool 格式双向转译
├── anthropic_provider.py      # 实现 LLMProvider，包 Anthropic SDK
└── openai_compat_provider.py  # 实现 LLMProvider，包 openai SDK + 转译
```

## 5. 归一化数据类型（`llm/types.py`）

```python
from dataclasses import dataclass
from typing import Literal, Any

@dataclass(frozen=True)
class TextBlock:
    text: str
    type: Literal["text"] = "text"

@dataclass(frozen=True)
class ToolUseBlock:
    id: str                    # 内部统一使用 toolu_xxx 风格
    name: str
    input: dict[str, Any]
    type: Literal["tool_use"] = "tool_use"

@dataclass(frozen=True)
class ToolResultBlock:
    tool_use_id: str
    content: str
    is_error: bool = False
    type: Literal["tool_result"] = "tool_result"

ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]    # Anthropic 风格 JSON Schema

@dataclass(frozen=True)
class LLMResponse:
    content: list[ContentBlock]
    stop_reason: Literal["end_turn", "tool_use", "max_tokens", "error"]
    model: str
    usage: dict[str, int]            # input_tokens / output_tokens
```

## 6. 协议接口（`llm/provider.py`）

```python
from typing import Protocol, Iterator
from .types import LLMResponse, StreamEvent, Tool

class LLMProvider(Protocol):
    def chat(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> LLMResponse: ...

    def stream(
        self,
        messages: list[dict],
        system: str,
        tools: list[Tool],
        max_tokens: int = 8000,
    ) -> Iterator[StreamEvent]: ...

    def count_tokens(self, text: str) -> int: ...
```

**实现要求**：
- `AnthropicProvider` 几乎直通 Anthropic SDK
- `OpenAICompatProvider` 通过 `tool_translator` 双向转译，对外呈现与 `AnthropicProvider` 一致的 `LLMResponse` / `StreamEvent`

## 7. 预设表（`llm/presets.py`）

```python
from typing import TypedDict, Literal

Protocol = Literal["anthropic", "openai_compat"]

class PresetSpec(TypedDict):
    base_url: str | None           # None 表示使用 SDK 默认
    protocol: Protocol

PROVIDER_PRESETS: dict[str, PresetSpec] = {
    "anthropic":  {"base_url": None,                                          "protocol": "anthropic"},
    "openrouter": {"base_url": "https://openrouter.ai/api/v1",                "protocol": "openai_compat"},
    "qwen":       {"base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1", "protocol": "openai_compat"},
    "deepseek":   {"base_url": "https://api.deepseek.com/v1",                 "protocol": "openai_compat"},
    "glm":        {"base_url": "https://open.bigmodel.cn/api/paas/v4/",       "protocol": "openai_compat"},
    # custom 不在表内，运行时由用户提供 base_url 和 protocol
}

def resolve_provider_config(config: dict) -> tuple[str, str, str, Protocol]:
    """
    从 env config 解析出 (api_key, base_url, model, protocol)。

    规则：
    1. 读取 PLANIFY_PROVIDER（必填）
    2. 若 PLANIFY_BASE_URL / PLANIFY_PROTOCOL 已显式设置，使用之
    3. 否则查 PROVIDER_PRESETS[provider] 补全
    4. 若为 custom 且未显式提供 base_url/protocol，抛错

    Returns:
        (api_key, base_url, model_id, protocol) 四元组
    """
    ...
```

## 8. 工厂（`llm/factory.py`）

```python
def create_provider(config: dict) -> LLMProvider:
    api_key, base_url, model_id, protocol = resolve_provider_config(config)

    if protocol == "anthropic":
        return AnthropicProvider(api_key=api_key, base_url=base_url, model=model_id)
    elif protocol == "openai_compat":
        return OpenAICompatProvider(api_key=api_key, base_url=base_url, model=model_id)
    else:
        raise ValueError(f"unknown protocol: {protocol}")
```

## 9. 工具调用转译（`llm/tool_translator.py`）

### 9.1 协议差异

| 维度 | Anthropic | OpenAI 兼容 |
|------|-----------|--------------|
| 工具定义 | `tools=[{name, description, input_schema}]` | `tools=[{type:"function", function:{name, description, parameters}}]` |
| 工具调用 ID | `toolu_xxx` | `call_xxx` |
| 调用块 | `content=[{type:"tool_use", id, name, input}]` | `choice.message.tool_calls=[{id, function:{name, arguments(JSON str)}}]` |
| 工具结果 | `content=[{type:"tool_result", tool_use_id, content}]` | `messages=[{role:"tool", tool_call_id, content}]` |
| 流式增量 | `content_block_delta` with `input_json_delta` | `delta.tool_calls[].function.arguments` |

### 9.2 ID 映射

`OpenAICompatProvider` 内部维护 `ToolCallMapper`：

```python
class ToolCallMapper:
    def register(self, openai_id: str) -> str:
        """openai_id -> 内部 toolu_xxx；同时建反向索引"""
        ...

    def to_openai(self, internal_id: str) -> str:
        """内部 toolu_xxx -> openai_id，用于发送 tool_result"""
        ...
```

请求时把内部 `tool_use_id` 反查成 OpenAI id 发出；响应时把 OpenAI `call_xxx` 登记为新的 `toolu_xxx` 返回给 runner。

### 9.3 消息格式转换

`OpenAICompatProvider._convert_messages(messages)` 负责把 Anthropic 风格的 `messages`（含 `tool_use` / `tool_result` 块）转成 OpenAI `messages`（含 `tool_calls` / `tool` role），转换后内部 ID 一律映射到 OpenAI id。

## 10. 流式事件归一化

```python
@dataclass(frozen=True)
class StreamEvent:
    type: Literal[
        "message_start",
        "content_block_start",
        "content_block_delta",
        "content_block_stop",
        "message_delta",
        "message_stop",
    ]
    # 字段按 type 不同：
    # - content_block_start: block: TextBlock | ToolUseBlock
    # - content_block_delta: text_delta: str | input_json_delta: str
    # - message_delta: stop_reason: str
```

- `AnthropicProvider.stream` 直通 Anthropic SDK 事件
- `OpenAICompatProvider.stream` 把 OpenAI `chat.completion.chunk` 映射为归一化事件：
  - `delta.content` → `content_block_delta.text_delta`
  - `delta.tool_calls[].function.arguments` → `input_json_delta`
  - `finish_reason='tool_calls'` → `message_delta.stop_reason='tool_use'`
  - 多个 `tool_calls` 增量块合并为一个 `content_block_start` + 多个 `delta`

doclens web SSE 端 (`web_v2/api/chat.py`) 不用改协议事件——它继续消费归一化事件。

## 11. 调用方改造清单

| 文件 | 改造 |
|------|------|
| `planify/core/config.py` | 读取 `PLANIFY_PROVIDER` / `PLANIFY_BASE_URL` / `PLANIFY_PROTOCOL`；`get_user_config_dict` 同步新增字段；保持 `PLANIFY_API_KEY` / `PLANIFY_MODEL_ID` 语义 |
| `planify/core/client.py` | `init_anthropic_client` 标记 deprecated（保留 1 个 release），由 `AnthropicProvider` 内部调用 |
| `planify/core/session.py` | `SessionConfig` 字段重命名：`model_id` / `api_key` / `base_url` / `provider_name` / `protocol`（替代 `anthropic_api_key` / `anthropic_base_url`）；`Session.client: Optional[LLMProvider]`（was `Anthropic`） |
| `planify/core/session_manager.py` | `get_provider()` 替代 `get_anthropic_client()`；初始化走 `factory.create_provider`；旧 `get_anthropic_client` 保留为 deprecated alias |
| `planify/agent/runner.py:161-178` | `client.messages.create(...)` → `provider.chat(...)`；响应字段访问由 `block.type=='tool_use'` 改为 `isinstance(block, ToolUseBlock)`（`block.id` / `name` / `input` 字段名不变） |
| `planify/agent/runner.py:124, 252` | `_auto_compact` 传 `provider` 而非 `client`（更新 `compact.py` 签名） |
| `planify/context/compact.py` | 接收 `LLMProvider` 而非 `Anthropic`；使用 `provider.chat(...)` |
| `planify/cli.py:299-303` | 改用 `factory.create_provider`；删除直接 `init_anthropic_client` 调用 |
| `planify/main.py:120-122` | 改用 `factory.create_provider`；config 字段同步 |
| `planify/bootstrap.py:52-54` | 同步 `planify_provider` / `planify_base_url` / `planify_protocol` 参数 |
| `planify/web_v2/deps.py` | `IndexManager` / `CortexAgent` 初始化走 `factory.create_provider` |
| `planify/web_v2/api/chat.py` | 调用方只换 `provider` 来源；事件协议不变 |

## 12. 错误处理

| 异常 | 抛出层 | 处理 |
|------|--------|------|
| `LLMAuthError`（401/403） | Provider | 不重试；上层返回用户友好提示 |
| `LLMRateLimitError`（429） | Provider | 指数退避重试 3 次（5s/15s/45s） |
| `LLMContextLengthError` | Provider | 不重试；触发 `_auto_compact` 后再试一次 |
| `LLMNetworkError` | Provider | 重试 3 次（2s/4s/8s） |
| `LLMError`（其他 4xx/5xx） | Provider | 不重试；日志记录 + 用户提示 |
| JSON 解析失败（`tool_calls[].function.arguments` 流式增量） | `tool_translator` | 累积到 `content_block_stop` 时再尝试解析；失败则记录原始字符串并以 `is_error=True` 回传 |

## 13. 配置层

`planify/core/config.py` 新增字段：

```python
config = {
    # ... 现有字段 ...
    "planify_provider": os.getenv("PLANIFY_PROVIDER", "anthropic"),
    "planify_base_url": os.getenv("PLANIFY_BASE_URL", ""),
    "planify_protocol": os.getenv("PLANIFY_PROTOCOL", ""),
    "planify_api_key": os.getenv("PLANIFY_API_KEY", ""),
    "planify_model_id": os.getenv("PLANIFY_MODEL_ID", "claude-opus-4-6"),
}
```

读取后 `SessionConfig` 仍存这些字段；`factory.create_provider` 才是真正解析预设 + base_url + protocol 的地方。

`get_user_config_dict` 新增 `provider_name` / `base_url` / `protocol` 形参（保持命名一致性，去掉 `anthropic_` 前缀）。

## 14. 测试策略

| 测试 | 工具 | 覆盖 |
|------|------|------|
| `test_presets.py` | pytest | 已知预设能解析；custom 缺字段抛错；显式覆盖优先级正确 |
| `test_tool_translator.py` | pytest | tools / tool_use / tool_result 双向 round-trip；嵌套 JSON；流式 `input_json_delta` 累积解析 |
| `test_anthropic_provider.py` | pytest + `respx` mock | chat / stream / 错误路径；`response.content` 解析为 `TextBlock` / `ToolUseBlock` |
| `test_openai_compat_provider.py` | pytest + `respx` mock | DeepSeek 风格 `tool_calls` 流；finish_reason 映射；ID 映射正确 |
| `test_factory.py` | pytest | `PLANIFY_PROVIDER=deepseek` 走 OpenAI 路径；`=custom` 缺字段报错 |
| `test_session_manager.py` | pytest | 旧 `get_anthropic_client` 仍可用（deprecated） |
| 集成：`test_runner_uses_provider.py` | pytest | 走 `OpenAICompatProvider` 完成一次工具调用循环 |
| 回归：现有 Anthropic 路径 | `start-app.ps1 tui` / `gui` | claude-opus-4-6 端到端不破 |

## 15. 迁移路径

1. **阶段 1**：新增 `planify/core/llm/` 目录，实现 `types.py` / `provider.py` / `presets.py` / `factory.py` / `AnthropicProvider` + 单元测试；`AnthropicProvider` 内部继续调用 `init_anthropic_client`。CLI / runner **不动**。验证 Anthropic 路径未回归。
2. **阶段 2**：实现 `tool_translator.py` + `OpenAICompatProvider` + 单元测试 + DeepSeek 集成测试。
3. **阶段 3**：改造 `agent/runner.py` / `context/compact.py` 改用 `LLMProvider` 接口。
4. **阶段 4**：改造 `session_manager.py` / `cli.py` / `main.py` / `bootstrap.py` / `web_v2/deps.py` / `web_v2/api/chat.py` 改用 `factory.create_provider`。
5. **阶段 5**：end-to-end 验证两个 Provider 都跑通 TUI + Web UI，更新 `start-app.ps1` / `INTEGRATION.md` / `examples.md` 文档。

每个阶段独立可发布、可回滚。

## 16. 文档更新

- `planify/README.md`：补充 `PLANIFY_PROVIDER` 与预设列表
- `planify/INTEGRATION.md`：移除旧 `zhipuai_api_key` 示例，新增 `PLANIFY_PROVIDER=qwen` / `deepseek` 示例
- `planify/examples.md`：新增 `custom` + `openrouter` 配置示例
- `CLAUDE.md`：在 `start-app.ps1` 部分新增"切换 LLM Provider"小节

## 17. 风险与缓解

| 风险 | 缓解 |
|------|------|
| OpenAI 兼容 Provider 的 `tool_calls` 流式增量可能产生非法 JSON | `tool_translator` 累积到 `content_block_stop` 一次性解析；失败时以 `is_error=True` 回传原始字符串 |
| 不同 Provider 的 token 计数差异大 | 优先使用各 Provider 自身的 `usage` 字段回传值；`count_tokens` 退化为 `len(text)//4` 估算 |
| 已知预设的 `base_url` 后续变更 | 预设表写在 `presets.py` 单独文件，修改影响面小 |
| OpenRouter 等聚合服务的 `model` 字段格式特殊 | 已知预设中 `model_id` 仍由用户自由填写，Provider 透传 |
| 旧字段 `anthropic_api_key` 残留 | 阶段 1 保留 `init_anthropic_client` 并标 deprecated；阶段 4 一次性删除并升 major |
