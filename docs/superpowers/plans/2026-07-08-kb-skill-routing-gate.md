# 知识库技能路由门禁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `knowledge-base` skill body 的全部指引（引文 / FTS 多查询 / grep 降级 / read_document 用法）在 KB 问答时确定性生效——通过"prompt 路由修复 + 工具门禁兜底"保证 LLM 无法跳过 `load_skill` 直接调 KB 工具。

**Architecture:** 新增 session 级 `SkillAccessState`（按 `session_id` 记录已加载 skill）+ `_current_session_id` ContextVar（并发安全传递）。KB 工具（`search_kb`/`read_document`/`manage_kb`/`grep`）handler 用门禁包装：未加载所属 skill 时返回弹回消息、不执行。`load_skill` 成功即标记。`run_stream` 每轮重建 skill-context 消息（descriptions + 已加载 body + agent.md），并设置 ContextVar。

**Tech Stack:** Python 3.10+, pytest, planify StreamingAgent, doclens KB tools, `contextvars` + `threading`。

## Global Constraints

- **测试命令**：`.venv/Scripts/python.exe -m pytest <path> -v`（CLAUDE.md 规定 Bash 用 `.venv` 的 python.exe）。
- **测试目录**：新测试放 `tests/planify/skills/`、`tests/doclens/`（目录不存在则创建，无需 `__init__.py`，与 `tests/treesearch/` 一致）。
- **Commit 规则**：每个 commit 步骤**必须等用户明确授权后**再执行（项目 git-workflow 规则：未经允许禁止 commit/push）。commit message **禁止** `Co-Authored-By`。
- **不可变原则**：重建消息时新建 dict（`{**msg, "content": ...}`），不原地改。
- **类型注解**：所有新函数签名带类型注解（项目 python coding-style）。
- **门禁集合**：`{search_kb, read_document, manage_kb, grep}` 归属 `knowledge-base`；`manage_kb(stats)` 也走门禁（保持一致，后续可调）。
- **E2E**：GUI E2E 用 `playwright-cli` skill（CLAUDE.md 规定），不直接用 playwright。

## File Structure

| 文件 | 责任 | 动作 |
|------|------|------|
| `planify/skills/access_state.py` | `SkillAccessState`（按 session_id 记录已加载 skill）+ `_current_session_id` ContextVar 及 set/get/reset + `mark_loaded_if_known` 辅助 | **新增** |
| `doclens/skill_gate.py` | `gate_skill` 包装器 + 常量（`KB_SKILL`/`KB_GATED_TOOLS`/`BOUNCE_MSG`） | **新增** |
| `doclens/kb_tools.py` | `build_kb_tools` 增 `skill_state` 入参，用 `gate_skill` 包裹 3 个 handler | 修改 |
| `doclens/grep_tools.py` | `build_grep_tools` 增 `skill_state` 入参，包裹 grep handler | 修改 |
| `planify/tools/registry.py` | `build_tool_registry` 增 `skill_access_state` 入参；`load_skill` handler 成功时 `mark_loaded_if_known` | 修改 |
| `planify/streaming/runner.py` | `run_stream` 设置 ContextVar；每轮重建 skill-context 消息（`_refresh_or_insert_context` 辅助） | 修改 |
| `planify/skills/skill_loader.py` | `descriptions()` 每条加 `→ 调用 load_skill("<name>")` 路由指引 | 修改 |
| `planify/prompts.py` | 系统提示词 `Skill tool` → `load_skill tool`；补 KB 工具前置 `load_skill` 硬规则 | 修改 |
| `doclens/skills/knowledge_base/SKILL.md` | frontmatter description 改写（不点名工具） | 修改 |
| `doclens/agent_integration.py` | 初始化 `SkillAccessState`（早于 build_kb_tools），传入 builders + 挂 `session`；`/clear` 同步 `clear` | 修改 |
| `tests/planify/skills/test_access_state.py` | Task 1 单测 | **新增** |
| `tests/doclens/test_skill_gate.py` | Task 2/8 测试 | **新增** |
| `tests/doclens/test_kb_tools_gating.py` | Task 3 接线测试 | **新增** |
| `tests/planify/tools/test_registry_load_skill.py` | Task 4 测试 | **新增** |
| `tests/planify/streaming/test_runner_context.py` | Task 5 测试 | **新增** |
| `tests/doclens/test_agent_clear_skill_state.py` | Task 6 测试 | **新增** |
| `tests/doclens/test_prompt_fixes.py` | Task 7 内容断言 | **新增** |

---

### Task 1: `SkillAccessState` + session_id ContextVar

**Files:**
- Create: `planify/skills/access_state.py`
- Test: `tests/planify/skills/test_access_state.py`

**Interfaces:**
- Produces: `SkillAccessState`（`mark_loaded(session_id, name) -> None`、`is_loaded(session_id, name) -> bool`、`loaded_names(session_id) -> set[str]`、`clear(session_id) -> None`）；`set_current_session_id(session_id) -> Token`、`get_current_session_id() -> str`、`reset_current_session_id(token) -> None`；`mark_loaded_if_known(skill_state, session_id, name, body) -> None`。

- [ ] **Step 1: Write the failing test**

Create `tests/planify/skills/test_access_state.py`:

```python
"""SkillAccessState 与 session_id ContextVar 单元测试。"""
import threading

import pytest

from planify.skills.access_state import (
    SkillAccessState,
    get_current_session_id,
    mark_loaded_if_known,
    reset_current_session_id,
    set_current_session_id,
)


def test_mark_and_is_loaded_session_isolation():
    state = SkillAccessState()
    state.mark_loaded("s1", "knowledge-base")
    assert state.is_loaded("s1", "knowledge-base")
    assert not state.is_loaded("s1", "other")
    assert not state.is_loaded("s2", "knowledge-base")  # session 隔离


def test_loaded_names_returns_copy():
    state = SkillAccessState()
    state.mark_loaded("s1", "knowledge-base")
    names = state.loaded_names("s1")
    names.add("mutated")  # 副本，不污染内部
    assert state.loaded_names("s1") == {"knowledge-base"}


def test_clear_removes_session():
    state = SkillAccessState()
    state.mark_loaded("s1", "knowledge-base")
    state.clear("s1")
    assert not state.is_loaded("s1", "knowledge-base")


def test_empty_session_id_is_noop():
    state = SkillAccessState()
    state.mark_loaded("", "knowledge-base")
    assert not state.is_loaded("", "knowledge-base")
    assert state.loaded_names("") == set()


def test_concurrent_mark_loaded_is_threadsafe():
    state = SkillAccessState()

    def worker():
        for _ in range(200):
            state.mark_loaded("s1", "knowledge-base")

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert state.is_loaded("s1", "knowledge-base")


def test_contextvar_set_get_reset():
    assert get_current_session_id() == ""
    token = set_current_session_id("abc")
    try:
        assert get_current_session_id() == "abc"
    finally:
        reset_current_session_id(token)
    assert get_current_session_id() == ""


def test_mark_loaded_if_known_marks_on_real_body():
    state = SkillAccessState()
    set_current_session_id("s1")
    try:
        mark_loaded_if_known(state, get_current_session_id(), "knowledge-base", "<skill>...</skill>")
        assert state.is_loaded("s1", "knowledge-base")
    finally:
        reset_current_session_id(set_current_session_id(""))


def test_mark_loaded_if_known_skips_error_body():
    state = SkillAccessState()
    mark_loaded_if_known(state, "s1", "knowledge-base", "Error: Unknown skill 'x'")
    assert not state.is_loaded("s1", "knowledge-base")


def test_mark_loaded_if_known_noop_without_state_or_session():
    mark_loaded_if_known(None, "s1", "knowledge-base", "body")  # 不抛异常
    state = SkillAccessState()
    mark_loaded_if_known(state, "", "knowledge-base", "body")
    assert not state.is_loaded("", "knowledge-base")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/skills/test_access_state.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'planify.skills.access_state'`

- [ ] **Step 3: Write minimal implementation**

Create `planify/skills/access_state.py`:

```python
"""技能加载状态：按 session_id 记录已加载的 skill，供工具门禁使用。

并发安全（web 多请求多线程共享同一 Session 上的实例）。内存态——进程重启
后丢失，每个会话首次 KB 提问会重新加载一次 skill，可接受。
"""
from __future__ import annotations

import contextvars
import threading
from typing import Optional, Set


# 当前请求的 session_id。run_stream 开始时 set，工具 handler 通过 get 读取。
# ContextVar 按 asyncio 任务 / 线程上下文隔离，web 并发安全。
_current_session_id: "contextvars.ContextVar[str]" = contextvars.ContextVar(
    "current_session_id", default=""
)


def set_current_session_id(session_id: str) -> "contextvars.Token[str]":
    """设置当前请求的 session_id，返回 token 用于 reset。"""
    return _current_session_id.set(session_id)


def get_current_session_id() -> str:
    """读取当前请求的 session_id（未设置时返回 ""）。"""
    return _current_session_id.get()


def reset_current_session_id(token: "contextvars.Token[str]") -> None:
    """用 set 返回的 token 复位 ContextVar。"""
    _current_session_id.reset(token)


class SkillAccessState:
    """按 session_id 记录已加载的 skill 集合。线程安全。"""

    def __init__(self) -> None:
        self._loaded: dict[str, Set[str]] = {}
        self._lock = threading.Lock()

    def mark_loaded(self, session_id: str, name: str) -> None:
        """标记某 session 已加载某 skill。"""
        if not session_id or not name:
            return
        with self._lock:
            self._loaded.setdefault(session_id, set()).add(name)

    def is_loaded(self, session_id: str, name: str) -> bool:
        """判断某 session 是否已加载某 skill。"""
        if not session_id or not name:
            return False
        with self._lock:
            return name in self._loaded.get(session_id, set())

    def loaded_names(self, session_id: str) -> Set[str]:
        """返回某 session 已加载 skill 名集合（副本）。"""
        if not session_id:
            return set()
        with self._lock:
            return set(self._loaded.get(session_id, set()))

    def clear(self, session_id: str) -> None:
        """清空某 session 的加载记录（/clear 时调用）。"""
        if not session_id:
            return
        with self._lock:
            self._loaded.pop(session_id, None)


def mark_loaded_if_known(
    skill_state: Optional[SkillAccessState],
    session_id: str,
    name: str,
    body: str,
) -> None:
    """load_skill 返回 body 后调用：body 非空且非 Error 时标记已加载。

    用于 load_skill handler 成功路径。session_id/name 缺失或 skill_state 为
    None 时静默跳过（兼容非会话上下文，如单元测试直调）。
    """
    if skill_state is None or not session_id or not name:
        return
    if body and not body.startswith("Error:"):
        skill_state.mark_loaded(session_id, name)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/skills/test_access_state.py -v`
Expected: PASS（8 tests）

- [ ] **Step 5: Commit**（需用户授权）

```bash
git add planify/skills/access_state.py tests/planify/skills/test_access_state.py
git commit -m "feat(planify): add SkillAccessState + session_id ContextVar for skill gating"
```

---

### Task 2: 门禁包装器 `skill_gate.py`

**Files:**
- Create: `doclens/skill_gate.py`
- Test: `tests/doclens/test_skill_gate.py`

**Interfaces:**
- Consumes: `SkillAccessState`、`get_current_session_id`（from Task 1）。
- Produces: `KB_SKILL = "knowledge-base"`、`KB_GATED_TOOLS = {"search_kb","read_document","manage_kb","grep"}`、`BOUNCE_MSG`、`gate_skill(skill_state, skill_name, tool_name, handler) -> Callable`。

- [ ] **Step 1: Write the failing test**

Create `tests/doclens/test_skill_gate.py`:

```python
"""skill_gate.gate_skill 单元测试。"""
from planify.skills.access_state import (
    SkillAccessState,
    reset_current_session_id,
    set_current_session_id,
)

from doclens.skill_gate import BOUNCE_MSG, KB_SKILL, gate_skill


def test_gate_bounces_when_not_loaded():
    state = SkillAccessState()
    set_current_session_id("s1")
    try:
        called = []
        gated = gate_skill(state, KB_SKILL, "search_kb", lambda **kw: called.append(kw) or "OK")
        out = gated(query="x")
    finally:
        reset_current_session_id(set_current_session_id(""))
    assert "<skill_required>" in out
    assert "knowledge-base" in out
    assert "search_kb" in out
    assert called == []  # 真实 handler 未执行


def test_gate_executes_when_loaded():
    state = SkillAccessState()
    state.mark_loaded("s1", KB_SKILL)
    set_current_session_id("s1")
    try:
        gated = gate_skill(state, KB_SKILL, "search_kb", lambda **kw: "RESULTS")
        assert gated(query="x") == "RESULTS"
    finally:
        reset_current_session_id(set_current_session_id(""))


def test_gate_skips_when_session_id_empty():
    """ContextVar 未设置（非 run_stream 上下文）时直接执行，不阻断。"""
    state = SkillAccessState()  # 未加载
    assert get_sid() == ""  # 默认空
    gated = gate_skill(state, KB_SKILL, "search_kb", lambda **kw: "RESULTS")
    assert gated(query="x") == "RESULTS"


def get_sid() -> str:
    from planify.skills.access_state import get_current_session_id
    return get_current_session_id()


def test_bounce_msg_contains_load_skill_instruction():
    msg = BOUNCE_MSG.format(tool="grep", skill=KB_SKILL)
    assert 'load_skill(name="knowledge-base")' in msg
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_skill_gate.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'doclens.skill_gate'`

- [ ] **Step 3: Write minimal implementation**

Create `doclens/skill_gate.py`:

```python
"""技能门禁：KB 工具执行前确认所属 skill 已加载，否则弹回。

强制 LLM 在使用 search_kb / read_document / manage_kb / grep 前先
load_skill("knowledge-base") 获取检索策略与引文规范。
"""
from __future__ import annotations

from typing import Any, Callable

from planify.skills.access_state import SkillAccessState, get_current_session_id

# knowledge-base 技能"拥有"的工具集合
KB_SKILL = "knowledge-base"
KB_GATED_TOOLS = {"search_kb", "read_document", "manage_kb", "grep"}

BOUNCE_MSG = (
    "<skill_required>\n"
    "本工具（{tool}）属于 {skill} 技能，但该技能尚未加载。\n"
    "请先调用 load_skill(name=\"{skill}\") 获取检索策略与引文规范，再重新调用本工具。\n"
    "</skill_required>"
)


def gate_skill(
    skill_state: SkillAccessState,
    skill_name: str,
    tool_name: str,
    handler: Callable[..., Any],
) -> Callable[..., Any]:
    """包装工具 handler：未加载所属 skill 时弹回，否则执行。

    ContextVar（当前 session_id）为空时跳过门禁直接执行，兼容非会话上下文
    （单元测试、CLI 直调 handler 等）。
    """
    def wrapped(**kw: Any) -> Any:
        sid = get_current_session_id()
        if sid and not skill_state.is_loaded(sid, skill_name):
            return BOUNCE_MSG.format(tool=tool_name, skill=skill_name)
        return handler(**kw)

    return wrapped
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_skill_gate.py -v`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**（需用户授权）

```bash
git add doclens/skill_gate.py tests/doclens/test_skill_gate.py
git commit -m "feat(doclens): add skill gate wrapper for KB tools"
```

---

### Task 3: 把门禁接入 `build_kb_tools` / `build_grep_tools`

**Files:**
- Modify: `doclens/kb_tools.py:145-187`（`build_kb_tools`）
- Modify: `doclens/grep_tools.py:49-63`（`build_grep_tools`）
- Test: `tests/doclens/test_kb_tools_gating.py`

**Interfaces:**
- Consumes: `gate_skill`、`KB_SKILL`（from Task 2）；`SkillAccessState`（from Task 1）。
- Produces: `build_kb_tools(idx_manager, workdir, skill_state=None)` 与 `build_grep_tools(idx, skill_state=None)`——`skill_state` 非 None 时返回的 handler 被门禁包裹。

- [ ] **Step 1: Write the failing test**

Create `tests/doclens/test_kb_tools_gating.py`:

```python
"""验证 build_kb_tools / build_grep_tools 在传入 skill_state 时返回门禁 handler。"""
from planify.skills.access_state import (
    SkillAccessState,
    reset_current_session_id,
    set_current_session_id,
)

from doclens.kb_tools import build_kb_tools
from doclens.grep_tools import build_grep_tools


class _FakeIdx:
    """最小 IndexManager 替身，仅满足 handler 不被真实调用即弹回。"""
    pass


def test_build_kb_tools_gates_search_kb_when_not_loaded():
    state = SkillAccessState()
    _tools, handlers = build_kb_tools(_FakeIdx(), workdir=".", skill_state=state)
    set_current_session_id("s1")
    try:
        out = handlers["search_kb"](query="量子计算")
    finally:
        reset_current_session_id(set_current_session_id(""))
    assert "<skill_required>" in out


def test_build_grep_tools_gates_grep_when_not_loaded():
    state = SkillAccessState()
    _tools, handlers = build_grep_tools(_FakeIdx(), skill_state=state)
    set_current_session_id("s1")
    try:
        out = handlers["grep"](pattern="foo")
    finally:
        reset_current_session_id(set_current_session_id(""))
    assert "<skill_required>" in out


def test_build_kb_tools_no_skill_state_passthrough():
    """不传 skill_state 时行为不变（不门禁），兼容既有调用。"""
    _tools, handlers = build_kb_tools(_FakeIdx(), workdir=".", skill_state=None)
    # handler 存在且可调用（不门禁，会进入真实逻辑——这里只验证未被包裹的签名）
    assert "search_kb" in handlers
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_kb_tools_gating.py -v`
Expected: FAIL — `TypeError: build_kb_tools() got an unexpected keyword argument 'skill_state'`

- [ ] **Step 3: Modify `build_kb_tools`**

In `doclens/kb_tools.py`, replace the `build_kb_tools` function (lines 145-187) — change signature and handler dict:

```python
def build_kb_tools(
    idx_manager: IndexManager,
    workdir: Path,
    skill_state: "SkillAccessState | None" = None,
) -> Tuple[List[Dict], Dict[str, Callable]]:
    """构建知识库工具定义和处理器。

    Args:
        idx_manager: 已初始化的 IndexManager 实例
        workdir: 工作目录（知识库搜索路径）
        skill_state: 可选，技能加载状态；传入则 search_kb/read_document/manage_kb
            被门禁包裹（未加载 knowledge-base 技能时弹回）。

    Returns:
        (tools, handlers) 元组
    """
    # 动态生成 search_kb schema，使用配置中的 max_results
    search_kb_schema = {
        "name": "search_kb",
        "description": SEARCH_KB_TOOL["description"],
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "搜索关键词，支持中英文混合",
                },
                "max_results": {
                    "type": "integer",
                    "description": "返回的最大结果数",
                    "default": idx_manager.max_results,
                },
            },
            "required": ["query"],
        },
    }

    raw_handlers = {
        "search_kb": lambda **kw: _handle_search_kb(idx_manager, workdir, **kw),
        "manage_kb": lambda **kw: _handle_manage_kb(idx_manager, **kw),
        "read_document": lambda **kw: _handle_read_document(idx_manager, workdir, **kw),
    }

    if skill_state is not None:
        from doclens.skill_gate import KB_SKILL, gate_skill
        handlers = {
            name: gate_skill(skill_state, KB_SKILL, name, h)
            for name, h in raw_handlers.items()
        }
    else:
        handlers = raw_handlers

    return [search_kb_schema, MANAGE_KB_TOOL, READ_DOCUMENT_TOOL], handlers
```

(在文件顶部已有的 `from typing import ... Callable, ...` 可复用；`SkillAccessState` 用字符串注解避免循环导入。)

- [ ] **Step 4: Modify `build_grep_tools`**

In `doclens/grep_tools.py`, replace `build_grep_tools` (lines 49-63):

```python
def build_grep_tools(
    idx: IndexManager,
    skill_state: "SkillAccessState | None" = None,
) -> tuple[list[dict], dict[str, Callable]]:
    """构建 grep 工具定义和处理器。

    Args:
        idx: IndexManager 实例
        skill_state: 可选，技能加载状态；传入则 grep 被门禁包裹。

    Returns:
        (tools, handlers) 元组
    """
    raw_handler: Callable = lambda **kw: _handle_grep(idx, **kw)
    if skill_state is not None:
        from doclens.skill_gate import KB_SKILL, gate_skill
        handler = gate_skill(skill_state, KB_SKILL, "grep", raw_handler)
    else:
        handler = raw_handler
    return [GREP_TOOL], {"grep": handler}
```

并在 `grep_tools.py` 顶部 `if TYPE_CHECKING:` 块中追加（避免运行时循环导入）：

```python
if TYPE_CHECKING:
    from doclens.index_manager import IndexManager
    from planify.skills.access_state import SkillAccessState
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_kb_tools_gating.py -v`
Expected: PASS（3 tests）

- [ ] **Step 6: Commit**（需用户授权）

```bash
git add doclens/kb_tools.py doclens/grep_tools.py tests/doclens/test_kb_tools_gating.py
git commit -m "feat(doclens): wire skill gate into build_kb_tools/build_grep_tools"
```

---

### Task 4: `load_skill` 成功时标记已加载

**Files:**
- Modify: `planify/tools/registry.py:43-57`（`build_tool_registry` 签名）、`190-216`（load_skill handler）
- Test: `tests/planify/tools/test_registry_load_skill.py`

**Interfaces:**
- Consumes: `mark_loaded_if_known`、`get_current_session_id`（from Task 1）。
- Produces: `build_tool_registry(..., skill_access_state=None)`；`load_skill` handler 成功返回时调用 `mark_loaded_if_known`。

- [ ] **Step 1: Write the failing test**

Create `tests/planify/tools/test_registry_load_skill.py`:

```python
"""验证 build_tool_registry 的 load_skill handler 在成功时标记 skill 已加载。"""
from planify.skills.access_state import (
    SkillAccessState,
    reset_current_session_id,
    set_current_session_id,
)
from planify.skills.skill_loader import SkillLoader


class _FakeLoader:
    """最小 SkillLoader 替身。"""
    def load(self, name: str) -> str:
        if name == "knowledge-base":
            return "<skill>body</skill>"
        return f"Error: Unknown skill '{name}'"


def _build_registry_handlers(skill_state):
    """仅构建 load_skill handler（隔离重型 build_tool_registry）。"""
    from planify.tools.registry import _build_load_skill_handler
    return _build_load_skill_handler(_FakeLoader(), skill_state)


def test_load_skill_marks_state_on_success():
    state = SkillAccessState()
    handler = _build_registry_handlers(state)
    set_current_session_id("s1")
    try:
        body = handler(name="knowledge-base")
    finally:
        reset_current_session_id(set_current_session_id(""))
    assert body == "<skill>body</skill>"
    assert state.is_loaded("s1", "knowledge-base")


def test_load_skill_does_not_mark_on_unknown():
    state = SkillAccessState()
    handler = _build_registry_handlers(state)
    set_current_session_id("s1")
    try:
        body = handler(name="nope")
    finally:
        reset_current_session_id(set_current_session_id(""))
    assert body.startswith("Error:")
    assert not state.is_loaded("s1", "nope")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/tools/test_registry_load_skill.py -v`
Expected: FAIL — `ImportError: cannot import name '_build_load_skill_handler'`

- [ ] **Step 3: Add `skill_access_state` param + extract `_build_load_skill_handler`**

In `planify/tools/registry.py`:

(a) 给 `build_tool_registry` 签名追加参数（在 `session=None, **kwargs,` 之间）：

```python
def build_tool_registry(
    workdir,
    todo_mgr=None,
    task_mgr=None,
    bg_mgr=None,
    bus=None,
    team_mgr=None,
    skills_loader=None,
    run_subagent=None,
    model=None,
    client=None,
    transcript_dir=None,
    session=None,
    skill_access_state=None,
    **kwargs,
) -> Tuple[List[Dict], Dict[str, Any]]:
```

并在 docstring 的 Args 中补一行：`skill_access_state: SkillAccessState 实例（可选），用于 load_skill 标记已加载`。

(b) 在模块顶层（`build_tool_registry` 之前）新增工厂函数：

```python
def _build_load_skill_handler(skills_loader, skill_access_state):
    """构建 load_skill handler：返回 body，成功时标记已加载。

    抽成独立函数便于单元测试（隔离重型 build_tool_registry）。
    """
    from ..skills.access_state import get_current_session_id, mark_loaded_if_known

    def _handle_load_skill(name: str) -> str:
        body = skills_loader.load(name) if skills_loader else "Error: no skills_loader"
        mark_loaded_if_known(skill_access_state, get_current_session_id(), name, body)
        return body

    return _handle_load_skill
```

(c) 替换原 `handlers.update({...})` 中的 `"load_skill"` 行（原 `lambda **kw: skills_loader.load(kw["name"])`）：

```python
    _load_skill_handler = _build_load_skill_handler(skills_loader, skill_access_state)

    handlers.update(
        {
            "TodoWrite": lambda **kw: todo_mgr.update(kw["items"]) if todo_mgr else None,
            "task": lambda **kw: _handle_task(
                kw["prompt"],
                kw.get("agent_type", "Explore"),
                workdir,
                client,
                model,
                handlers,
                run_subagent,
                session,
            ),
            "load_skill": lambda **kw: _load_skill_handler(kw["name"]),
        }
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/tools/test_registry_load_skill.py -v`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**（需用户授权）

```bash
git add planify/tools/registry.py tests/planify/tools/test_registry_load_skill.py
git commit -m "feat(planify): mark skill loaded on load_skill success"
```

---

### Task 5: `run_stream` 设置 ContextVar + 每轮重建 skill-context

**Files:**
- Modify: `planify/streaming/runner.py:116-198`（`run_stream` 注入块）、`204-279`（try/except 加 finally）
- Test: `tests/planify/streaming/test_runner_context.py`

**Interfaces:**
- Consumes: `set_current_session_id`/`reset_current_session_id`（Task 1）；`self.session.skill_access_state`；`SkillLoader.load`/`descriptions`。
- Produces: 模块级 `_refresh_or_insert_context(messages, marker, new_content)`；`run_stream` 每轮把 descriptions + 已加载 body + agent.md 重建进 messages 开头。

- [ ] **Step 1: Write the failing test**

Create `tests/planify/streaming/test_runner_context.py`:

```python
"""验证 _refresh_or_insert_context：刷新或插入 skill-context 消息。"""
from planify.streaming.runner import _refresh_or_insert_context


def test_inserts_when_marker_absent():
    messages = [{"role": "user", "content": "hi"}]
    _refresh_or_insert_context(messages, "MARKER", "ctx-MARKER-body")
    assert messages[0]["content"] == "ctx-MARKER-body"
    assert messages[0]["role"] == "user"
    assert messages[1] == {"role": "assistant", "content": "Noted."}
    assert messages[2]["content"] == "hi"  # 原消息后移


def test_replaces_when_marker_present():
    messages = [
        {"role": "user", "content": "old-MARKER-old"},
        {"role": "assistant", "content": "Noted."},
        {"role": "user", "content": "hi"},
    ]
    _refresh_or_insert_context(messages, "MARKER", "new-MARKER-new")
    assert messages[0]["content"] == "new-MARKER-new"
    assert messages[1] == {"role": "assistant", "content": "Noted."}
    assert messages[2]["content"] == "hi"
    assert len(messages) == 3  # 不新增


def test_replaces_in_first_six_slots_only():
    messages = [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a2"},
        {"role": "user", "content": "q3"},
        {"role": "assistant", "content": "a3"},
        {"role": "user", "content": "deep-MARKER-old"},  # 超出前 6，忽略
    ]
    _refresh_or_insert_context(messages, "MARKER", "fresh-MARKER")
    assert messages[0]["content"] == "fresh-MARKER"
    assert messages[-1]["content"] == "deep-MARKER-old"  # 未被替换
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/streaming/test_runner_context.py -v`
Expected: FAIL — `ImportError: cannot import name '_refresh_or_insert_context'`

- [ ] **Step 3: Add `_refresh_or_insert_context` helper + new import**

In `planify/streaming/runner.py`, near the top (after existing imports, around line 24), add:

```python
from ..skills.access_state import (
    reset_current_session_id,
    set_current_session_id,
)
```

Add module-level helper (above `class StreamingAgent`):

```python
_CONTEXT_MARKER = "The following skills are available for use with the Skill tool"


def _refresh_or_insert_context(
    messages: List[Dict], marker: str, new_content: str
) -> None:
    """刷新 messages 开头的 skill-context 消息。

    在前 6 条里找带 marker 的 user 消息则原地替换（新建 dict，不改原对象）；
    否则 insert 到开头并补一条 assistant 'Noted.'。
    """
    for i, msg in enumerate(messages[:6]):
        content = msg.get("content")
        if (
            msg.get("role") == "user"
            and isinstance(content, str)
            and marker in content
        ):
            messages[i] = {**msg, "content": new_content}
            return
    messages.insert(0, {"role": "user", "content": new_content})
    messages.insert(1, {"role": "assistant", "content": "Noted."})
```

- [ ] **Step 4: Replace the injection block in `run_stream`**

Replace the block from `# 在 messages 头部注入 skills 和 agent.md（仅一次）` through the `messages.insert(1, {"role": "assistant", "content": "Noted."})` closing (runner.py 约 133-195 行) with:

```python
        # 设置当前 session_id（供工具门禁/load_skill 标记使用）
        ctx_token = set_current_session_id(session_id)

        # 每轮重建 skill-context（descriptions + 已加载 skill body）+ agent.md
        context_parts: List[str] = []

        # 1. skills descriptions + 已加载 skill body
        if self.skills:
            skills_lines: List[str] = []
            desc_text = self.skills.descriptions()
            if desc_text and desc_text != "(no skills)":
                skills_lines.append(
                    "The following skills are available for use with the Skill tool:\n\n"
                    f"{desc_text}"
                )
            skill_state = getattr(self.session, "skill_access_state", None) if self.session else None
            if skill_state is not None and session_id:
                for name in sorted(skill_state.loaded_names(session_id)):
                    body = self.skills.load(name)
                    if body and not body.startswith("Error:"):
                        skills_lines.append(body)
            if skills_lines:
                context_parts.append(
                    "<system-reminder>\n" + "\n\n".join(skills_lines) + "\n</system-reminder>"
                )

        # 2. agent.md 内容
        agent_md_content = ""
        if self.session and self.session.config.assets_dir:
            agent_md_path = self.session.config.assets_dir / "agent.md"
            if agent_md_path.exists():
                agent_md_content = agent_md_path.read_text(encoding="utf-8")
        else:
            from pathlib import Path as _Path
            global_agent_md = _Path.home() / ".cortex" / "agent.md"
            workdir = "."
            if self.config:
                workdir = getattr(self.config, "workdir", ".")
            local_agent_md = _Path(workdir) / ".cortex" / "agent.md"
            md_parts = []
            if global_agent_md.exists():
                md_parts.append(global_agent_md.read_text(encoding="utf-8"))
            if local_agent_md.exists():
                md_parts.append(local_agent_md.read_text(encoding="utf-8"))
            if md_parts:
                agent_md_content = "\n\n".join(md_parts)

        if agent_md_content:
            context_parts.append(
                "<system-reminder>\n"
                "As you answer the user's questions, you can use the following context:\n"
                f"{agent_md_content}\n"
                "</system-reminder>"
            )

        if context_parts:
            _refresh_or_insert_context(
                messages, _CONTEXT_MARKER, "\n\n".join(context_parts)
            )
```

- [ ] **Step 5: Reset ContextVar in `finally`**

The existing `try/except` at the end of `run_stream` (约 204-279 行) currently is:

```python
        try:
            while True:
                ...
        except Exception as e:
            self.logger.exception(f"[StreamingAgent] 运行异常: {e}")
            await self.emitter.emit_error(str(e), code="AGENT_ERROR")
            return self._cleanup_messages(messages)
```

Add a `finally` clause that resets the ContextVar:

```python
        try:
            while True:
                ...
        except Exception as e:
            self.logger.exception(f"[StreamingAgent] 运行异常: {e}")
            await self.emitter.emit_error(str(e), code="AGENT_ERROR")
            return self._cleanup_messages(messages)
        finally:
            reset_current_session_id(ctx_token)
```

(注意：`ctx_token` 由 Step 4 的 `set_current_session_id(session_id)` 返回，作用域覆盖整个 `run_stream` 方法体。)

- [ ] **Step 6: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/streaming/test_runner_context.py -v`
Expected: PASS（3 tests）

- [ ] **Step 7: Commit**（需用户授权）

```bash
git add planify/streaming/runner.py tests/planify/streaming/test_runner_context.py
git commit -m "feat(planify): rebuild skill context each turn + set session ContextVar"
```

---

### Task 6: `agent_integration.py` 接线 + `/clear` 清状态

**Files:**
- Modify: `doclens/agent_integration.py:130-285`（`initialize`）、`435-438`（`/clear` 分支）
- Test: `tests/doclens/test_agent_clear_skill_state.py`

**Interfaces:**
- Consumes: `SkillAccessState`（Task 1）；`build_kb_tools`/`build_grep_tools` 的 `skill_state` 入参（Task 3）；`build_tool_registry` 的 `skill_access_state` 入参（Task 4）；`session.skill_access_state`（Task 5 读取）。
- Produces: `session.skill_access_state` 共享实例；`/clear` 调用 `skill_access_state.clear(session.session_id)`。

- [ ] **Step 1: Write the failing test**

Create `tests/doclens/test_agent_clear_skill_state.py`:

```python
"""验证 /clear 斜杠命令清空当前 session 的技能加载状态。"""
from types import SimpleNamespace

from planify.skills.access_state import SkillAccessState

from doclens.agent_integration import CortexAgent


def test_clear_slash_command_clears_skill_state(tmp_path):
    agent = CortexAgent(tmp_path)
    state = SkillAccessState()
    state.mark_loaded("s1", "knowledge-base")

    agent.session = SimpleNamespace(
        skill_access_state=state,
        session_id="s1",
        replace_messages_in_place=lambda msgs: None,
    )

    should_exit, history = agent.handle_slash_command(
        "clear", "", [{"role": "user", "content": "x"}]
    )

    assert should_exit is False
    assert not state.is_loaded("s1", "knowledge-base")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_agent_clear_skill_state.py -v`
Expected: FAIL — `state.is_loaded("s1", "knowledge-base")` 仍为 True（/clear 未清状态）

- [ ] **Step 3: Create `SkillAccessState` early in `initialize` + wire to builders**

In `doclens/agent_integration.py` `initialize()`, find the block where skills loader is created (around line 192):

```python
        skills = SkillLoader(skills_dir)
```

Immediately after it, add:

```python
        # 技能加载状态（按 session_id 记录），供工具门禁 + load_skill 标记 + 跨轮 body 重注入使用
        from planify.skills.access_state import SkillAccessState
        skill_state = SkillAccessState()
```

Then update the three builder calls:

(1) KB tools（约 224-225 行）：

```python
        from doclens.kb_tools import build_kb_tools
        kb_tools, kb_handlers = build_kb_tools(self.idx, self.workdir, skill_state=skill_state)
```

(2) grep tools（约 231-233 行）：

```python
        from doclens.grep_tools import build_grep_tools
        grep_tools, grep_handlers = build_grep_tools(self.idx, skill_state=skill_state)
```

(3) `build_tool_registry`（约 244-259 行）追加 `skill_access_state=skill_state`：

```python
        tools, tool_handlers = build_tool_registry(
            workdir=self.workdir,
            zhipu_client=None,
            zhipu_model_id="glm-4",
            todo_mgr=todo_mgr,
            task_mgr=task_mgr,
            bg_mgr=bg_mgr,
            bus=bus,
            team_mgr=team,
            skills_loader=skills,
            skill_access_state=skill_state,
            run_subagent=run_subagent,
            model=config.get("model_id"),
            client=client,
            transcript_dir=transcript_dir,
            session=None,
        )
```

(4) 挂到 session（约 285 行 `self.session = session` 之前，在 `session.logger = logger` 后）：

```python
        session.skill_access_state = skill_state
```

- [ ] **Step 4: Clear state on `/clear`**

In `handle_slash_command`, replace the `clear` branch（约 435-438 行）：

```python
        if cmd in ("clear",):
            history.clear()
            self.session.replace_messages_in_place([])
            # 同步清空技能加载状态，避免状态记忆与已清空的对话上下文错位
            skill_state = getattr(self.session, "skill_access_state", None)
            if skill_state is not None:
                skill_state.clear(self.session.session_id)
            return False, history
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_agent_clear_skill_state.py -v`
Expected: PASS（1 test）

- [ ] **Step 6: Commit**（需用户授权）

```bash
git add doclens/agent_integration.py tests/doclens/test_agent_clear_skill_state.py
git commit -m "feat(doclens): wire SkillAccessState into CortexAgent + clear on /clear"
```

---

### Task 7: Prompt 路由修复（3 处）

**Files:**
- Modify: `doclens/skills/knowledge_base/SKILL.md:3`（frontmatter description）
- Modify: `planify/prompts.py:122-124`（Skill vs Tool priority）
- Modify: `planify/skills/skill_loader.py:59-71`（`descriptions()`）
- Test: `tests/doclens/test_prompt_fixes.py`

**Interfaces:**
- Produces: SKILL.md description 不点名工具；系统提示词明确 `load_skill` + KB 前置硬规则；`descriptions()` 每条带 `→ 调用 load_skill("<name>")`。

- [ ] **Step 1: Write the failing test**

Create `tests/doclens/test_prompt_fixes.py`:

```python
"""验证 skill 路由相关的 prompt 修复。"""
from pathlib import Path

from planify.prompts import build_system_prompt
from planify.skills.skill_loader import SkillLoader

SKILL_MD = Path(__file__).resolve().parents[2] / "doclens" / "skills" / "knowledge_base" / "SKILL.md"


def _frontmatter_description() -> str:
    text = SKILL_MD.read_text(encoding="utf-8")
    # 取第一个 --- ... --- 之间的内容
    parts = text.split("---", 2)
    assert len(parts) >= 3, "SKILL.md 缺少 frontmatter"
    for line in parts[1].strip().splitlines():
        if line.strip().startswith("description:"):
            return line.split("description:", 1)[1].strip()
    return ""


def test_skill_description_does_not_name_tool():
    """description 不应直接点名 search_kb（否则 LLM 跳过 load_skill）。"""
    desc = _frontmatter_description()
    assert "search_kb" not in desc
    assert "load_skill" in desc or "加载" in desc


def test_system_prompt_names_load_skill_and_kb_rule():
    prompt = build_system_prompt(".", agent_type="streaming")
    # 修正工具名错位：明确 load_skill
    assert "load_skill" in prompt
    # KB 工具前置 load_skill 硬规则
    assert "knowledge-base" in prompt
    assert "search_kb" in prompt or "search_kb/read_document" in prompt


def test_descriptions_has_routing_hint(tmp_path):
    skills_dir = tmp_path / "skills" / "demo"
    skills_dir.mkdir(parents=True)
    (skills_dir / "SKILL.md").write_text(
        "---\nname: demo\ndescription: a demo skill\n---\nbody\n", encoding="utf-8"
    )
    loader = SkillLoader(tmp_path / "skills")
    desc = loader.descriptions()
    assert "demo" in desc
    assert 'load_skill("demo")' in desc  # 路由指引
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_prompt_fixes.py -v`
Expected: FAIL（description 仍点名 search_kb；系统提示词无 load_skill；descriptions 无路由指引）

- [ ] **Step 3: Fix SKILL.md description**

In `doclens/skills/knowledge_base/SKILL.md`, replace line 3:

```markdown
description: 知识库搜索与文档检索技能。涉及知识库内容的提问需先加载本技能，获取检索策略（search_kb 多查询/grep 降级）、引文规范（## 参考资料）、read_document 深读用法。加载方式：load_skill("knowledge-base")。
```

- [ ] **Step 4: Fix system prompt**

In `planify/prompts.py`, replace the `# Skill vs Tool priority` section（122-124 行）:

```python
# Skill vs Tool priority

IMPORTANT: Skills 包含领域专属知识（检索策略、引文规范、降级方案）。当用户请求匹配某个 Skill 时，**必须先用 load_skill 工具加载它**，再按其指引使用相关工具，而不是直接调用工具。

调用任何知识库工具（search_kb / read_document / manage_kb / grep）之前，**必须先调用 load_skill(name="knowledge-base")**，按返回的技能内容执行检索与引文。
```

- [ ] **Step 5: Fix `descriptions()` routing hint**

In `planify/skills/skill_loader.py`, replace `descriptions()`（59-71 行）:

```python
    def descriptions(self) -> str:
        """
        获取所有技能的描述（含路由指引）。

        Returns:
            格式化的技能描述字符串
        """
        if not self.skills:
            return "(no skills)"
        return "\n".join(
            f"  - {n}: {s['meta'].get('description', '-')} "
            f"→ 调用 load_skill(\"{n}\") 获取详细指引"
            for n, s in self.skills.items()
        )
```

- [ ] **Step 6: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_prompt_fixes.py -v`
Expected: PASS（3 tests）

- [ ] **Step 7: Commit**（需用户授权）

```bash
git add doclens/skills/knowledge_base/SKILL.md planify/prompts.py planify/skills/skill_loader.py tests/doclens/test_prompt_fixes.py
git commit -m "feat: prompt fixes for skill routing (description/system/descriptions)"
```

---

### Task 8: 集成测试 —— skip→bounce→load→retry 完整门禁流程

**Files:**
- Test: `tests/doclens/test_skill_gate.py`（在 Task 2 文件末尾追加）

**Interfaces:**
- Consumes: `gate_skill`（Task 2）、`mark_loaded_if_known`（Task 1）、ContextVar（Task 1）。

- [ ] **Step 1: Write the failing test**

Append to `tests/doclens/test_skill_gate.py`:

```python
def test_skip_bounce_load_retry_full_flow():
    """模拟 LLM 跳过 load_skill 直接调 search_kb → 弹回 → load_skill → 重试放行。"""
    from planify.skills.access_state import (
        SkillAccessState,
        get_current_session_id,
        mark_loaded_if_known,
        reset_current_session_id,
        set_current_session_id,
    )

    state = SkillAccessState()
    set_current_session_id("s1")
    try:
        called = []
        gated = gate_skill(
            state, KB_SKILL, "search_kb", lambda **kw: called.append(kw) or "RESULTS"
        )

        # 1) 跳过 load_skill 直接调 → 弹回，真实 handler 不执行
        out1 = gated(query="量子计算")
        assert "<skill_required>" in out1
        assert called == []

        # 2) 模拟 LLM 收到弹回后调 load_skill 成功 → 标记
        mark_loaded_if_known(
            state, get_current_session_id(), KB_SKILL, "<skill>knowledge-base body</skill>"
        )
        assert state.is_loaded("s1", KB_SKILL)

        # 3) 重新调 search_kb → 放行，执行真实 handler
        out2 = gated(query="量子计算")
        assert out2 == "RESULTS"
        assert called == [{"query": "量子计算"}]
    finally:
        reset_current_session_id(set_current_session_id(""))
```

- [ ] **Step 2: Run test to verify it fails then passes**

Run: `.venv/Scripts/python.exe -m pytest tests/doclens/test_skill_gate.py::test_skip_bounce_load_retry_full_flow -v`
Expected: PASS（依赖 Task 1/2 已实现；验证端到端门禁流程）

- [ ] **Step 3: Run the full new-test suite**

Run: `.venv/Scripts/python.exe -m pytest tests/planify/skills/ tests/doclens/ tests/planify/tools/ tests/planify/streaming/ -v`
Expected: PASS（所有新增测试）

- [ ] **Step 4: Commit**（需用户授权）

```bash
git add tests/doclens/test_skill_gate.py
git commit -m "test: integration test for KB skill gate skip-bounce-load-retry"
```

---

### Task 9: GUI E2E 验证（playwright-cli）

**Files:**
- 无代码改动；使用 `playwright-cli` skill 做端到端验证。

**前提**：后端已起（`pwsh -File ./start-app.ps1 gui`，记录日志中的实际端口，如 `http://127.0.0.1:7860`），且知识库已索引。

- [ ] **Step 1: 调用 playwright-cli skill 打开 GUI**

用 playwright-cli skill 启动浏览器、导航到 GUI 地址、进入 AI 对话视图。

- [ ] **Step 2: 验证 happy path —— 提一个 KB 问题**

在对话框输入一个明确的知识库问题（例如 `知识库里有哪些文档？` 或针对已索引内容的实质性问题），发送。

预期：
- 前端展示工具调用过程（应能看到 `load_skill` 被调用一次）。
- 最终答案包含 `## 参考资料` 引文列表（说明 skill body 的引文规则生效）。

- [ ] **Step 3: 验证多轮不重复 load_skill**

在同一会话追加第二个 KB 问题，发送。

预期：答案仍带 `## 参考资料`；不应再次出现 `load_skill`（状态持久 + body 重注入生效）。

- [ ] **Step 4: 验证 skip path 兜底（如可观测）**

如前端能看到工具调用流，观察首轮是否曾出现"先 search_kb 被弹回、再 load_skill"的轨迹（取决于模型当次是否跳过；若模型直接 load_skill 则跳过本步）。

- [ ] **Step 5: 记录结果**

把 E2E 观察结果（是否带引文、load_skill 调用次数、是否弹回）回报到会话。若引文缺失或门禁未生效，回到对应 Task 排查。

---

## Self-Review

**1. Spec coverage**（对照 spec 各组件/数据流）：
- 组件 1 `SkillAccessState` + ContextVar → Task 1 ✓
- 组件 3 门禁包装器 → Task 2 ✓
- 组件 3 接入 KB/grep tools → Task 3 ✓
- 组件 4 `load_skill` 标记钩子 → Task 4 ✓
- 组件 5 `run_stream` 设置 ContextVar + 每轮重建 messages[0] → Task 5 ✓
- 组件 6 `/clear` 同步 + 初始化接线 → Task 6 ✓
- 组件 6 prompt 三处修复（6a/6b/6c）→ Task 7 ✓
- skip path 弹回数据流 → Task 8 ✓
- 多轮 body 重注入 / happy path → Task 5 + Task 9 ✓
- 边界（ContextVar 空 → 跳过门禁）→ Task 2 `test_gate_skips_when_session_id_empty` ✓
- 边界（未知 skill 不标记）→ Task 4 `test_load_skill_does_not_mark_on_unknown` ✓
- E2E → Task 9 ✓

**2. Placeholder scan**：所有步骤含完整代码 / 确切命令 / 预期输出，无 TBD/TODO。✓

**3. Type consistency**：
- `SkillAccessState.mark_loaded(session_id, name)` / `is_loaded(session_id, name)` / `loaded_names(session_id)` / `clear(session_id)` —— Task 1 定义，Task 3/5/6 调用一致 ✓
- `gate_skill(skill_state, skill_name, tool_name, handler)` —— Task 2 定义，Task 3 调用一致 ✓
- `build_kb_tools(..., skill_state=None)` / `build_grep_tools(idx, skill_state=None)` —— Task 3 定义，Task 6 调用一致 ✓
- `build_tool_registry(..., skill_access_state=None)` —— Task 4 定义，Task 6 调用一致 ✓
- `_build_load_skill_handler(skills_loader, skill_access_state)` —— Task 4 定义+测试一致 ✓
- `_refresh_or_insert_context(messages, marker, new_content)` —— Task 5 定义+测试一致 ✓
- `mark_loaded_if_known(skill_state, session_id, name, body)` —— Task 1 定义，Task 4/8 调用一致 ✓
- `session.skill_access_state` 属性名 —— Task 5 读取 / Task 6 写入 / Task 6 测试一致 ✓

无类型/命名漂移。
