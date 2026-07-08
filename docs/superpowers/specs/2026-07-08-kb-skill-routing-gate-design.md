# 知识库技能路由门禁设计

## 背景

doclens GUI 的 AI 对话（`POST /api/chat`）与 CLI 复用同一条 `StreamingAgent.run_stream` 链路。技能（skill）分发机制如下：

1. 对话开头只注入 skill 的**描述**（`SkillLoader.descriptions()`），完整 body 不注入（`planify/streaming/runner.py:144-153`）。
2. LLM 需主动调用 `load_skill(name="knowledge-base")` 工具，才会拿到完整 `SKILL.md`（引文规则、FTS 多查询策略、grep 降级、`read_document` 用法等）（`planify/tools/registry.py:190-214`）。
3. 当前全局只有 `knowledge_base` 一个 skill。

**问题**：涉及 RAG 知识库问答时，LLM 有一定概率**跳过 `load_skill`，直接调用 `search_kb`**，导致 skill body 整个没加载——引文规范、FTS 多查询策略、grep 降级、`read_document` 深读约定全部丢失，整体回答质量退化。

**根因（3 个叠加）**：

1. **skill 描述自拆台**：`knowledge-base` 的 description 直接写"使用 search_kb 搜索相关文档片段"，点名了工具，LLM 于是跳过加载直接调工具。
2. **工具名错位**：系统提示词（`planify/prompts.py:124`）写"use the **Skill tool**"，但实际工具名是 `load_skill`，LLM 对不上号。
3. **`descriptions()` 无路由指引**：只输出 `- knowledge-base: <描述>`，没有"先 `load_skill` 获取详细指引"的提示。

## 目标

- 让 `knowledge-base` skill body 的全部指引（引文 / 多查询 / grep 降级 / `read_document`）在 KB 问答时**确定性生效**，不赌 LLM 是否调 `load_skill`。
- **保留多 skill 按需加载机制**（未来会扩展更多 skill），不做"常驻注入"。
- 方案需对并发安全（web 多 session 多线程）稳健，跨模型（Claude / glm-4）一致。
- 改动尽量隔离，不侵入 `Session` 历史 / `_cleanup_messages` 的既有语义。

## 方案概述

选定 **方案 B：Prompt 路由修复 + 确定性工具门禁**。

- **Prompt 修复**（概率层，压低跳过率）：修正 description 措辞、系统提示词工具名、`descriptions()` 路由指引。
- **工具门禁**（确定性层，兜底）：KB 相关工具执行前确认 `knowledge-base` 已加载，未加载则**拒绝执行并弹回**，强制 LLM 先 `load_skill`。
- **跨轮持久化**：`session_id` 级记录"已加载"，每轮 `run_stream` 开始自动重注入已加载 skill 的 body，避免多轮重复 `load_skill` 往返。

## 组件设计

### 1. `SkillAccessState` —— 技能加载状态（新文件）

**文件**：`planify/skills/access_state.py`

按 `session_id` 记录已加载的 skill 集合，内存态（进程重启丢失可接受——重启后每个会话首次 KB 提问会重新加载一次）。

```python
# 伪代码
class SkillAccessState:
    """按 session_id 记录已加载的 skill。线程安全。"""
    def __init__(self) -> None:
        self._loaded: dict[str, set[str]] = {}
        self._lock = threading.Lock()

    def mark_loaded(self, session_id: str, name: str) -> None: ...
    def is_loaded(self, session_id: str, name: str) -> bool: ...
    def loaded_names(self, session_id: str) -> set[str]: ...
    def clear(self, session_id: str) -> None: ...   # /clear 时调用
```

- 挂在共享 `Session` 上（`session.skill_access_state`），所有并发请求共享同一实例，靠 `_lock` + `session_id` 隔离。
- 不持久化到 SQLite——重启后重新加载是可接受的（仅多一次 `load_skill`）。

### 2. `_current_session_id` ContextVar —— 并发安全的 session 传递

同一文件内定义。web 每个请求在独立线程跑 `run_stream`，工具 handler 在请求线程内执行；用 `contextvars.ContextVar` 让 handler 拿到"当前请求的 session_id"，避免共享可变状态被并发踩踏。

```python
_current_session_id: contextvars.ContextVar[str] = ContextVar("current_session_id", default="")
```

- `run_stream` 开始时 `_current_session_id.set(session_id)`。
- 工具 handler / 门禁通过 `_current_session_id.get()` 读取。
- ContextVar 天然按 asyncio 任务 / 线程上下文隔离，web 并发安全。

### 3. 门禁包装器 —— 包裹 KB 工具 handler

**文件**：`doclens/kb_tools.py`、`doclens/grep_tools.py` 的 `build_*` 函数

`knowledge-base` 技能"拥有"的工具：`search_kb`、`read_document`、`manage_kb`、`grep`。这些工具的 handler 用门禁包装：

```python
SKILL_REQUIRED_FOR_KB = "knowledge-base"

KB_GATED_TOOLS = {"search_kb", "read_document", "manage_kb", "grep"}

BOUNCE_MSG = (
    "<skill_required>\n"
    "本工具（{tool}）属于 {skill} 技能，但该技能尚未加载。\n"
    "请先调用 load_skill(name=\"{skill}\") 获取检索策略与引文规范，再重新调用本工具。\n"
    "</skill_required>"
)

def _gate(skill_state, skill_name, tool_name, handler):
    def wrapped(**kw):
        sid = _current_session_id.get()
        if sid and not skill_state.is_loaded(sid, skill_name):
            return BOUNCE_MSG.format(tool=tool_name, skill=skill_name)
        return handler(**kw)
    return wrapped
```

- `sid` 为空（ContextVar 未设置，即不在 `run_stream` 上下文内）时**跳过门禁直接执行**，避免影响测试 / CLI 直调等非会话路径。
- 工具-skill 归属关系 v1 硬编码（`KB_GATED_TOOLS` + `SKILL_REQUIRED_FOR_KB`）；后续可下沉到 `SKILL.md` frontmatter（`requires_load: true` + `tools: [...]`）做通用化。

### 4. `load_skill` handler 钩子 —— 加载成功即标记

**文件**：`planify/tools/registry.py:214`

现有：`"load_skill": lambda **kw: skills_loader.load(kw["name"])`

改为：加载成功（返回的不是 "Error: Unknown skill"）时，调用 `skill_access_state.mark_loaded(session_id, name)`。

```python
def _handle_load_skill(name: str, skill_state, skills_loader) -> str:
    body = skills_loader.load(name)
    if not body.startswith("Error:"):
        sid = _current_session_id.get()
        if sid:
            skill_state.mark_loaded(sid, name)
    return body
```

- 未知 skill 名 → 沿用既有错误返回，**不标记**。
- 需要把 `skill_access_state` 透传进 `build_tool_registry`（新增可选参数，向后兼容）。

### 5. 跨轮 body 重注入 —— `run_stream` 开始处

**文件**：`planify/streaming/runner.py`（`run_stream` 注入 skills/agent.md 的代码块，约 133-195 行）

**关键修正**：不能简单复用既有 `has_context` 守卫——它检测到 descriptions marker 存在就**跳过注入**，会导致第 2 轮（skill 在第 1 轮才加载）body 不被重注入，跨轮持久化失效。

正确做法：**每轮 `run_stream` 开始时重建 skill-context 消息**（`messages[0]` 那条 user 消息），使其内容 = descriptions + 当前已加载 skill 的 body：

```python
# 伪代码：每轮重建 messages[0]，而非"仅首次注入"
skill_block_parts = [skills_descriptions_text]  # 静态 descriptions
if self.skills and session_id:
    for name in sorted(skill_state.loaded_names(session_id)):
        body = self.skills.load(name)
        skill_block_parts.append(f"<skill name=\"{name}\">\n{body}\n</skill>")
new_context = "<system-reminder>\n" + "\n\n".join(skill_block_parts) + "\n</system-reminder>"

# 在 messages[:4] 里找带 SKILLS_MARKER 的 user 消息，原地替换内容；
# 找不到则 insert 到 messages[0]（并补一条 assistant "Noted."）
_refresh_or_insert_skill_context(messages, new_context)
```

- 始终保持**恰好一条** skill-context 消息，内容随"已加载集合"变化而更新。
- 第 1 轮：`loaded_names` 为空 → messages[0] 仅 descriptions → LLM 调 `load_skill` → 标记（本轮内 body 作为 tool_result 已在上下文）。
- 第 2 轮起：重建 messages[0] = descriptions + `knowledge-base` body → 门禁放行，LLM 无需再 `load_skill`。
- agent.md 内容（现有 `context_parts` 第二段）一并并入这条重建消息：messages[0] = descriptions + loaded bodies + agent.md。原 `has_context` 首次注入优化被"每轮刷新"取代——代价是 agent.md/descriptions 每轮重包含（静态文本，单条消息不累积，token 成本恒定，可接受）。
- 持久化事实：`get_chat_history` 只返回 `message_user`/`message_ai`，**不持久化 skill-context**——web 每轮从裸历史开始，messages[0] 本就每轮重注入；CLI 在内存保留 messages[0]，靠 find-and-replace 刷新。两条路径都被 `_refresh_or_insert_skill_context` 覆盖。
- `/clear` 斜杠命令（`agent_integration.py:435`）需同步 `skill_state.clear(session_id)`，否则状态与上下文错位。

### 6. Prompt 修复（3 处确定性改进）

**6a. SKILL.md description 改写**（`doclens/skills/knowledge_base/SKILL.md` frontmatter）

去掉"使用 search_kb 搜索"等直接点名工具的措辞，改为"加载本技能获取知识库检索策略、引文规范、grep 降级方案"。

**6b. 系统提示词工具名修正**（`planify/prompts.py:122-124`）

`use the Skill tool` → 明确 `use the load_skill tool`，并补一条硬规则：

> 调用任何知识库工具（search_kb / read_document / manage_kb / grep）之前，**必须先调用 `load_skill(name="knowledge-base")`**。

**6c. `descriptions()` 加路由指引**（`planify/skills/skill_loader.py:59-71`）

每条描述格式从 `- name: desc` 改为 `- name: desc → 调用 load_skill("name") 获取详细指引`。

## 数据流

### Happy path（prompt 修复后主流）

```
用户 KB 提问
 → run_stream：注入 descriptions（含路由指引）+ 已加载 body（首轮为空）
 → LLM 调 load_skill("knowledge-base")         [prompt 引导]
 → handler 返回 body + mark_loaded
 → LLM 调 search_kb（带多查询策略）
 → 门禁 is_loaded ✅ → 执行
```

### Skip path（LLM 跳过，门禁兜底）

```
用户 KB 提问
 → LLM 直接调 search_kb
 → 门禁 is_loaded ❌ → 返回 BOUNCE_MSG，不执行
 → LLM 被弹回 → 调 load_skill → mark_loaded
 → LLM 重新调 search_kb → 门禁 ✅ → 执行
```

### 多轮（第 2 轮起）

```
用户继续 KB 提问
 → run_stream：descriptions + 自动重注入 knowledge-base body（状态命中）
 → 门禁 is_loaded ✅（状态持久）→ LLM 直接调 search_kb 即可，无需 load_skill
```

## 边界与错误处理

- **未知 skill 名**：`load_skill` 返回既有错误，不标记，不弹回。
- **ContextVar 未设置**（非 `run_stream` 上下文，如单元测试直调 handler）：门禁跳过（`sid` 为空 → 直接执行），不阻断既有调用路径。
- **`/clear` 命令**：必须同步 `skill_state.clear(session_id)`，否则状态记忆与清空的对话上下文错位（门禁误开放但 body 不在上下文）。
- **进程重启**：内存态丢失，每个会话首次 KB 提问重新走一次加载流程——可接受。
- **上下文压缩（auto_compact / microcompact）**：body 注入在持久上下文槽（`messages[0]` 区），通常不被压缩；若极端情况下被压缩，门禁仍按状态放行，但 body 可能缺席——v1 不专门处理，列为已知限制。
- **并发**：`SkillAccessState` 内部 `_lock` 保护 dict；`ContextVar` 按请求上下文隔离 session_id；共享 `Session` 上的状态靠 `session_id` 键隔离。
- **grep 工具归属**：grep 既属于 KB 工具集（SKILL.md 把它列为降级搜索），也在非 KB 场景可能被调用。门禁会让所有 grep 调用都要求先加载 knowledge-base。若这过严，可把 grep 移出门禁集合（v1 默认纳入，与 SKILL.md 描述一致）。

## 测试策略

### 单元测试（pytest）

- `SkillAccessState`：`mark_loaded` / `is_loaded` / `loaded_names` / `clear` 的并发安全（多线程）与 session 隔离。
- 门禁包装器：未加载 → 返回 `BOUNCE_MSG` 且不调用真实 handler；已加载 → 调用真实 handler；`sid` 为空 → 跳过门禁。
- `load_skill` 钩子：成功 → 标记；未知名 → 不标记。
- ContextVar：设置 / 读取 / 默认值。

### 集成测试

构造一个 mock LLM 流，模拟"跳过 load_skill 直接调 search_kb"：
1. 断言第一次 `search_kb` 返回 `BOUNCE_MSG`、真实 handler 未执行。
2. 模拟 LLM 收到弹回后调 `load_skill` → 断言 `mark_loaded` 被调用。
3. 模拟 LLM 再次调 `search_kb` → 断言真实 handler 执行、返回搜索结果。
4. 第二轮请求 → 断言 body 被自动重注入、门禁直接放行。

### E2E（playwright-cli skill）

按 `CLAUDE.md` 规定，GUI E2E 使用 `playwright-cli` skill：

- GUI 提一个 KB 问题 → 断言回答包含 `## 参考资料` 引文（说明 skill body 的引文规则生效）。
- 多次重试（≥5 次）验证跳过率显著下降（门禁兜底）。

## 不做（Out of Scope）

- 不做 `always_on` 常驻注入（方案 C）——保留按需加载。
- 不改 `_cleanup_messages` 保留 `load_skill` tool 对（更省 token 的备选持久化方案）——v1 用"状态 + 每轮重注入"。
- 不把工具-skill 归属关系下沉到 frontmatter 元数据——v1 硬编码，后续再通用化。
- 不开 Anthropic prompt caching（独立优化项，不在此范围）。

## 涉及文件清单

| 文件 | 改动 |
|------|------|
| `planify/skills/access_state.py` | **新增** `SkillAccessState` + `_current_session_id` ContextVar |
| `planify/tools/registry.py` | `load_skill` handler 改为钩子标记；`build_tool_registry` 透传 `skill_access_state` |
| `planify/streaming/runner.py` | `run_stream` 设置 ContextVar；注入已加载 skill body |
| `planify/skills/skill_loader.py` | `descriptions()` 加路由指引 |
| `planify/prompts.py` | 系统提示词工具名修正 + KB 工具前置 `load_skill` 硬规则 |
| `doclens/skills/knowledge_base/SKILL.md` | description 改写（不点名工具） |
| `doclens/agent_integration.py` | 初始化 `SkillAccessState` 挂到 `session`；`/clear` 同步 `clear` |
| `doclens/kb_tools.py` | `build_kb_tools` 用门禁包裹 handler，透传 `skill_state` |
| `doclens/grep_tools.py` | `build_grep_tools` 同上 |
| `doclens/web_v2/deps.py` | （若需）确保共享 `session.skill_access_state` 在 web 路径可用 |
