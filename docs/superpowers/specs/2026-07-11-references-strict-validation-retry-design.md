# AI 参考资料严格校验与重试机制设计

## 目标

- **正文规范性**：强制 AI 回答正文末尾的「## 参考资料」章节符合机器可解析契约（标题/列表/路径形态）。
- **路径正确性**：参考资料路径必须在知识库 workdir 下真实存在（用户可打开）。
- **闭环纠错**：不合规时静默重答（反馈中重申契约），重试用尽则用工具检索结果兜底并告警。
- **契约单一**：KB Skill 新增「机器解析契约」段，AI 与解析器遵循同一份语法。

## 背景

- `doclens/skills/knowledge_base/SKILL.md` 已有详尽的「回答铁律」格式规范，但 AI 经常不遵守（指令遵循能力问题，非规范缺失）。
- `2cb1bd6e` 之后，参考资料卡片已不依赖 AI 正文：`extract_references(emitter.tool_calls)` 直接从 `search_kb`/`grep`/`read_document` 的工具返回结果提取 path。该路径来自真实检索，可靠性高于 AI 正文手写。
- 用户诉求：除卡片外，**正文本身**也要有规范且路径正确的「## 参考资料」；不合规要"打回让 AI 重答"。
- 现状 `doclens/web_v2/api/chat.py` 的 `_stream_agent_response` 是**单次** `run_stream`，需改造为带校验/重试/兜底的循环。

## 方案

**C：正文重试软约束 + 工具结果硬兜底。**

- 以「解析 AI 正文 → 校验 → 不合规重试」作为软约束，引导 AI 守规矩。
- 以工具结果 `extract_references` 作为硬兜底，重试用尽时接管卡片渲染，杜绝死循环与空转。

## 架构

一次 `POST /api/chat` 请求内部的闭环：

```
load history
for attempt in 0..MAX_RETRIES (共 MAX_RETRIES+1 轮):
    if now > DEADLINE: break
    query = 反馈消息 if attempt>0 else 用户原问题
    静默跑 run_stream(history, query)  →  收集 (full_text, tool_calls)  [中间轮不转发 token]
    history += [assistant: full_text]
    used_retrieval = tool_calls 命中 search_kb/grep/read_document
    if not used_retrieval:  →  采用本轮，break（流程性回复豁免）
    parsed = parse_references_section(full_text)
    path_invalid = validate_paths(parsed.paths, workdir)
    if parsed 合规 且 无 path_invalid:  →  采用本轮，break
    if attempt == MAX_RETRIES 或 now > DEADLINE:  →  刹车 → 兜底，break
    history += [user: render_feedback(diagnostics)]  →  下一轮
# 循环外：把采用轮的 (full_text, tool_calls) 流式重放给前端
# 兜底时：references 事件用工具结果 + toast 告警
```

## 组件设计

### 后端

#### 1. 新增 `doclens/web_v2/refs_parser.py`

从 markdown 正文解析「## 参考资料」章节，产出路径列表 + 格式诊断。

```python
@dataclass(frozen=True)
class ParsedRefs:
    has_section: bool          # 是否存在 ## 参考资料 标题
    paths: list[str]           # 解析出的（未校验存在的）相对路径
    diagnostics: list[str]     # 格式错误描述（人类可读，供反馈消息）

    def is_compliant(self) -> bool:
        return self.has_section and not self.diagnostics

def parse_references_section(markdown: str) -> ParsedRefs: ...
```

**解析规则**：
- 定位标题行：多行模式下匹配 `^##\s+参考资料\s*$`（恰好二级标题 + "参考资料"）。
- 章节体：该标题行之后，至下一个 `^#{1,2}\s` 同级或更高级标题之前的所有行。
- 列表项：每行匹配 `^\s*\d+[.、]\s*(.+)$` → 提取路径主体。
- `has_section=False`：找不到标题（且后续判定需要用到检索工具）。
- **诊断（任一命中即不合规，写入 diagnostics）**：
  - 标题缺失（`has_section=False`）
  - 章节存在但无任何列表项（空章节）
  - 列表项前缀用了 `[N]` 而非 `数字.`（违反契约第 2 条）
  - 路径含 markdown 链接 `](`（违反"禁止 markdown 链接"）
  - 路径含 `file://`（违反"禁止 file://"）
  - 路径以 `:\d+` 结尾（行号后缀）
  - 路径含 `<` 或 `>`（`<hierarchy>` 残留）

#### 2. 扩展 `doclens/web_v2/references.py`

新增路径存在性校验（保持 `extract_references` 原签名不变）：

```python
def validate_paths(paths: list[str], workdir: Path) -> list[str]:
    """返回 workdir 下不存在的路径子集（保留首次出现顺序，去重）。"""
```

- base = `session.workdir`（知识库根目录）。
- 判定：`(workdir / path).resolve().exists()`（兼容路径前导 `./`、大小写由文件系统决定）。
- 仅返回**不存在**的路径；空列表表示全部存在。

#### 3. 改造 `doclens/web_v2/api/chat.py`

把 `_stream_agent_response` 由单次改为**循环**，核心要点：

- **常量**：`MAX_RETRIES = 3`、`DEADLINE = time.monotonic() + 60`。
- **静默执行器** `run_one_round(history, query) -> (full_text, tool_calls)`：
  - 内部新建 `GradioEventEmitter` + `StreamingAgent`，跑 `run_stream`。
  - **不**把 token 推入外部 SSE queue（中间轮缓冲）。
  - 仅返回本轮累积的 `full_text` 与 `tool_calls`。
- **history 折叠**：每轮结束后向 `history` 追加 `{role:"assistant", content:full_text, tool_calls:...}`；需要重试时再追加 `{role:"user", content:render_feedback(...)}`；下一轮 `query = 反馈消息`。
- **采用判定**：见架构图（豁免 / 合规 / 刹车兜底）。
- **最终轮重放**：循环结束后，把采用轮的 `full_text` **分块**推入 queue（保留打字感），`tool_calls` 按序重放 `tool_call`/`tool_result` 事件。
- **兜底事件**：刹车时 references 用 `extract_references(采用轮 tool_calls)`；前端额外收 `toast` 事件。
- **合规事件**：合规时 references 用 `parsed.paths`（正文解析结果，与卡片一致）。
- **SSE 新事件**：`{"type":"toast","level":"warn","detail":"..."}`。

**反馈消息模板** `render_feedback(diagnostics, invalid_paths)`：

```
你上一条回答的参考资料不合规：
{diagnostics 列表 / 路径不存在列表}
请重新完整回答用户原问题，并严格遵循下方契约（再次不合规会被继续打回）：

## 参考资料（系统强制解析契约）
1. 章节标题必须正好是「## 参考资料」
2. 每行「数字. 路径」（如「1. 量子计算/第一章.md」）
3. 路径 = 纯相对路径，禁止 [t](u) / file:// / 行号 / <...>
4. 系统按此格式机器解析并校验路径是否存在；不合规将被自动打回重答。
```

#### 4. 改 `doclens/skills/knowledge_base/SKILL.md`

在现有「回答铁律」之后，新增「机器解析契约」段（与 `render_feedback` 引用的契约**逐字一致**），并按 CLAUDE.md 约定同步到 `~/.cortex/skills/knowledge_base/`。

### 前端

- **`chat-view.ts` / `api/chat.ts`**：`b 方案（缓冲静默）`下前端**几乎不动**——它只看到一次正常流式回答（采用轮的重放）。
- **新增 `toast` 事件处理**：收到兜底 `toast` 时，复用现有 `toast-stack` 组件弹出告警（"AI 多次回答的参考资料均不合规，已改用检索结果兜底，建议重建索引确保路径有效"）。
- `ChatStreamEvent` 类型新增 `{ type:"toast"; level:"warn"|"error"; detail:string }` 分支。

## 数据流（端到端：AI 第一次答得不合规）

```
前端 POST /chat(message, session_id)
后端 history = load(session_id)
  round 0: run_stream(message) → full_text0（缓冲，前端无感）
           解析 → 诊断"无 ## 参考资料" → 不合规、未刹车
           history += [assistant0, user:反馈0]
  round 1: run_stream(反馈0) → full_text1（缓冲）
           解析 → 路径"x/y.md"不存在 → 不合规、未刹车
           history += [assistant1, user:反馈1]
  round 2: run_stream(反馈1) → full_text2（缓冲）
           解析 → 合规 → 采用
重放 full_text2（token 分块）+ tool_call/tool_result → SSE → 前端正常流式渲染
合规 references 事件（parsed.paths）→ 卡片
done
```

刹车场景：round 3 仍不合规 → 重放 round 3 正文 + 兜底 references（工具结果）+ toast。

## 错误处理

| 情形 | 处理 |
|---|---|
| AI 没用检索工具（流程性回复） | 豁免：采用当轮，不校验、不重试、无 references |
| 重试达到 `MAX_RETRIES=3` | 刹车：采用最后一轮正文 + 工具结果兜底 + toast |
| 累计耗时超过 60s | 刹车（同上），即使次数未满 |
| 兜底时工具结果也为空 | 不发 references 事件；**仍发 toast**（告知参考资料不可用，建议重建索引/换关键词）。toast 与 references 解耦：凡刹车兜底必告警 |
| `run_stream` 抛异常 | 沿用现有 `error` 事件路径，中断循环 |
| 索引过时导致路径反复不存在 | 重试大概率无效 → 命中刹车 → toast 提示"建议重建索引" |

## 测试策略

### 后端（pytest）

- `tests/web_v2/test_refs_parser.py`：
  - 合规章节 → `is_compliant()` True、paths 正确
  - 无章节 / 空章节 / `[N]` 前缀 / markdown 链接 / `file://` / 行号 / `<hierarchy>` → 各自 diagnostics 命中
- `tests/web_v2/test_references.py`（扩展现有）：
  - `validate_paths`：全部存在 / 部分不存在 / 路径 normalize
- `tests/web_v2/test_chat_api.py`（扩展）：
  - mock `StreamingAgent`，模拟：① 一次合规 ② 重试后合规 ③ 刹车兜底 ④ 豁免（无检索工具） ⑤ 超时刹车
  - 断言：采用轮正文被重放、兜底 references 来自工具结果、toast 事件出现/不出现

### 前端（vitest）

- `chat-view-stream.spec.ts` 扩展：`toast` 事件 → 触发告警回调
- 现有 `chat-view-session.spec.ts`（references 持久化）保持绿。

### E2E（playwright-cli skill，可选）

- 构造一个会让 AI 漏写参考资料的问题，验证最终页面卡片可点击、兜底 toast 在反复不合规时出现。

## 配置

- `MAX_RETRIES = 3`、`DEADLINE_SECONDS = 60`：先作为 `doclens/web_v2/api/chat.py` 模块常量。后续如需调参，再提到 `CortexConfig`。
- 契约文本单一来源：`SKILL.md` 的契约段与 `render_feedback` 引用的契约段保持逐字一致（实现时考虑抽到共享常量或注释强约束）。

## 已知限制 / 风险

- **索引过时**：路径失效由索引与文件系统不同步引起时，重试无效、兜底也救不了 → 仅靠 toast 建议用户重建索引。不自动触发 reindex（避免请求侧效应）。
- **首次出字延迟**：`b 方案（缓冲静默）`下，用户从发送到看到第一个字，需等第 1 轮跑完 + 校验；重试轮会进一步累积延迟（被 60s 护栏封顶）。
- **session 状态污染**：重试中间轮会把多条 assistant/user 消息写入 `StreamingAgent` 内部的 `session.messages`。需在实现时验证：① 中间轮不持久化到 session store（仅前端最终 saveSession）；② 必要时在循环结束后回滚 session 内存消息至"用户原问题 + 采用轮回答"。若回滚成本高，降级为"接受 session 内多轮痕迹，但 store 只存最终"。
- **token 成本**：最坏 4 轮完整对话，LLM 费用与延迟翻数倍——已用 `MAX_RETRIES` + 时长护栏封顶。
- **旧历史数据**：本机制上线前已保存的历史对话 payload 仍无 references（前一修复的遗留，不可恢复）。

## 改动文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `doclens/web_v2/refs_parser.py` | 新增 | 正文 `## 参考资料` 解析 + 诊断 |
| `doclens/web_v2/references.py` | 改 | 新增 `validate_paths` |
| `doclens/web_v2/api/chat.py` | 改 | 重试循环 + 缓冲静默 + 最终轮重放 + 兜底 + toast 事件 |
| `doclens/skills/knowledge_base/SKILL.md` | 改 | 新增机器解析契约段 |
| `~/.cortex/skills/knowledge_base/SKILL.md` | 同步 | 运行时读取处（CLAUDE.md 约定） |
| `doclens/web_v2/frontend/src/api/chat.ts` | 改 | `toast` 事件类型 + 解析 |
| `doclens/web_v2/frontend/src/views/chat-view.ts` | 改 | `toast` → `toast-stack` |
| `tests/web_v2/test_refs_parser.py` | 新增 | 解析器单测 |
| `tests/web_v2/test_references.py` | 改 | `validate_paths` 单测 |
| `tests/web_v2/test_chat_api.py` | 改 | 重试/兜底/豁免集成测试 |
| `doclens/web_v2/frontend/tests/chat-view-stream.spec.ts` | 改 | toast 事件测试 |
