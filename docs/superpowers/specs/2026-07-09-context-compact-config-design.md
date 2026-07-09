# 上下文压缩：配置驱动的阈值

> 日期：2026-07-09
> 状态：design drafted（user absent — decisions via "best judgment proceed" per session rules）；待用户 review 与确认后进入 writing-plans

## 1. 背景

`planify/streaming/runner.py` 的 agent 循环顶部（line 209-220）有一道"压缩管道"：

```python
self._microcompact(messages)
if self._estimate_tokens(messages) > self.config.token_threshold:
    if self._auto_compact and self.session:
        compacted = self._auto_compact(messages, self.client, self.model, transcript_dir)
        self.session.replace_messages_in_place(compacted)
```

阈值 `StreamingConfig.token_threshold`（types.py:219）默认 **100,000 tokens**，是硬编码的——与用户实际使用的 LLM 上下文窗口长度无关。用户要求改为由模型上下文长度配置驱动，类似 Claude Code 的"按模型 context window 自动留 20% 余量"做法。

同时，本 spec 还覆盖用户的前置任务："为这套压缩机制编写测试，验证它按设计要求正确运行"。

## 2. 澄清决策

| # | 决策点 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 测试深度 | **单元 + 集成**（不含 E2E） | A（仅单元）漏关键路径（每轮触发 / 超阈值替换）；C（加 E2E）需 API key，CI 不稳 |
| 2 | 阈值推导公式 | **固定比例 0.8**（`context_window × 0.8`） | 预留 20% 给输出 + 安全边际，与 Claude Code 默认行为一致 |
| 3 | 与现有 `token_threshold` 关系 | **替换**（`token_threshold` → `compact_threshold`） | 用户意图"由这个值决定"暗示单一来源；移除冗余入口；breaking change 影响面仅 4 个 caller（可控） |

## 3. 详细设计

### 3.1 新增配置项（`doclens/config.py`）

在现有 `planify_*` 字段附近（line 115-117 之后）新增：

```python
# Planify / Agent 配置
planify_api_key: Optional[str] = Field(default=None, alias="PLANIFY_API_KEY")
planify_model_id: str = Field(default="claude-opus-4-6", alias="PLANIFY_MODEL_ID")
planify_base_url: Optional[str] = Field(default=None, alias="PLANIFY_BASE_URL")
planify_context_window: int = Field(
    default=200000,
    alias="PLANIFY_CONTEXT_WINDOW",
    description="LLM 上下文窗口大小（tokens）。compact 阈值 = context_window × 0.8。",
)
```

`.env` 用法：`PLANIFY_CONTEXT_WINDOW=200000`（默认即可）。覆盖场景：用户用 1M context 模型 → `=1000000`。

### 3.2 `StreamingConfig` 字段重命名（`planify/streaming/types.py`）

将 `token_threshold` 重命名为 `compact_threshold`：

```python
@dataclass
class StreamingConfig:
    # ... 其他字段 ...
    compact_threshold: int = 160000  # 默认 = 200000 × 0.8，硬编码兜底（通常由 caller 显式传入）
    # ... 其他字段 ...
```

### 3.3 Runner 引用更新（`planify/streaming/runner.py:211`）

```python
# 原
if self._estimate_tokens(messages) > self.config.token_threshold:
# 新
if self._estimate_tokens(messages) > self.config.compact_threshold:
```

### 3.4 4 个 caller 改动

构造 `StreamingConfig` 时显式传入 `compact_threshold`：

| 文件 | 行 | 改动 |
|------|---|------|
| `planify/cli.py` | 418 | `StreamingConfig(compact_threshold=int(ctx.config.planify_context_window * 0.8))` |
| `doclens/agent_integration.py` | 343 | 同上 |
| `doclens/web_v2/api/chat.py` | 102 | 同上 |
| `planify/INTEGRATION.md` | 119 | 文档示例同步更新 |

> `ctx.config` 是调用方持有的 `CortexConfig` 实例（doclens/config.py 加载）。

## 4. 测试设计

### 4.1 单元测试（`tests/planify/context/test_compact.py`，新文件）

**`estimate_tokens`（3 个）**
1. 空 list → 0
2. 单条 user → 估算字符 / 4
3. 多条混合（user/assistant/tool_use/tool_result）→ 总字符 / 4

**`microcompact`（7 个）**
4. messages 无 tool_result → 不变
5. 恰好 3 个 tool_result → 全部保留（边界）
6. 4 个 → 清最老 1 个
7. 10 个 → 清前 7 个，保留最近 3
8. tool_result.content ≤ 100 字符 → 不清（边界）
9. tool_result.content > 100 字符 → 清成 `"[cleared]"`
10. 非 tool_result 消息（纯文本 user/assistant）→ 不动

**`auto_compact`（4 个）**
11. mock `client.messages.create` → prompt 含 `"Summarize for continuity"`
12. `transcript_dir/transcript_{timestamp}.jsonl` 创建 + 每行是原始 message JSON
13. 返回 list 第一项：user 含 `[Compressed. Transcript: {path}]\n{summary}`
14. 返回 list 第二项：assistant `"Understood. Continuing with summary context."`

### 4.2 集成测试（`tests/planify/streaming/test_compression.py`，新文件）

15. messages 长度 < compact_threshold → microcompact 触发（旧 tool_result 被清）
16. messages > compact_threshold → auto_compact 触发 + `session.replace_messages_in_place` 被调
17. 未超阈值 → auto_compact **不**被调
18. 自定义小阈值（compact_threshold=10）→ 强制触发
19. `self._auto_compact=False` 或 `self.session=None` → 条件门拦截，不触发
20. compact_threshold 由 caller 传入推导值（`int(ctx.config.planify_context_window * 0.8)`）→ runner 使用正确（e2e 验证 200000 * 0.8 = 160000 触发）

## 5. 文件改动清单

| 文件 | 操作 |
|------|------|
| `doclens/config.py` | 修改（新增 `planify_context_window` 字段） |
| `planify/streaming/types.py` | 修改（`token_threshold` → `compact_threshold`） |
| `planify/streaming/runner.py` | 修改（字段名引用） |
| `planify/cli.py` | 修改（传入 compact_threshold） |
| `doclens/agent_integration.py` | 修改（同上） |
| `doclens/web_v2/api/chat.py` | 修改（同上） |
| `planify/INTEGRATION.md` | 修改（文档示例） |
| `tests/planify/context/test_compact.py` | **新建**（14 测试） |
| `tests/planify/streaming/test_compression.py` | **新建**（6 测试） |

## 6. 验收 + 范围外

**DoD**：
- 20 个新测试全绿
- 现有 16 后端测试 + 我之前加的 test_runner.py（2 个）不变绿
- 4 个 caller 都能正确传入 compact_threshold；runner 内部用 self.config.compact_threshold

**不在范围内**：
- 真实 LLM 摘要质量（mock 固定响应）
- compact_threshold 比例可配置化（已选固定 0.8）
- auto_compact 失败 fallback（当前实现无显式 fallback）
- 端到端长对话 E2E（受 API key 限制）

## 7. 设计依据

- 用户原始需求：「测试上下文压缩机制 + 加 context_window 配置项」
- 澄清决策：固定比例 0.8 + 替换 token_threshold + 单元+集成深度
- 参考 Claude Code 行为：`/model` 切换后自动适配上下文窗口管理

## 8. 风险与备选

- **风险**：`StreamingConfig.token_threshold` 字段删除是 breaking change（如果有外部代码依赖）。但仓库内仅 4 个 caller + 1 个文档，全在控制内。
- **备选**：若用户希望兼容老 token_threshold 字段，可改为"compact_threshold = token_threshold or context_window * 0.8"双源兼容（决策 3 选了纯替换）。