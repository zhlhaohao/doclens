# AI 参考资料严格校验与重试机制 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 强制 AI 回答的「## 参考资料」正文符合机器可解析契约且路径真实存在；不合规静默重答，重试用尽用工具结果兜底并告警。

**Architecture:** 把重试判定逻辑抽成纯函数 `resolve_answer_with_retry`（注入 `run_round` callable），使其可独立单测；`_stream_agent_response` 只负责接线（在线程内多轮跑 `StreamingAgent`）与 SSE 转发。中间轮缓冲不发 token，仅采用轮（合规/豁免/兜底）的结果重放出 SSE。

**Tech Stack:** Python 3 (FastAPI, sse-starlette, pydantic, pytest) / TypeScript (Lit, vitest)。

## Global Constraints

- **git commit/push 须用户明确授权** —— 用户全局 git-workflow 规则优先级高于本计划模板中的 commit step；任何 commit 步骤执行前必须向用户确认。未授权时仅保留工作区改动。
- **Python**：所有函数加类型注解；不可变数据用 `@dataclass(frozen=True)`；测试用 `pytest`；禁止 `print`（用 `logging`）。
- **TypeScript**：不可变更新用 spread；测试用 `vitest`；禁止 `console.log`。
- **契约文本单一来源**：`doclens/web_v2/refs_retry.py` 的 `_REFERENCES_CONTRACT` 常量与 `doclens/skills/knowledge_base/SKILL.md` 的「机器解析契约」段**逐字一致**（人工保证 + Task 4 有校验测试）。
- **参数**：`MAX_RETRIES = 3`（共最多 4 轮）、`DEADLINE = 60s`（`refs_retry` 模块默认值）。
- **toast level 修正**：`toast-stack` 仅有 `success|error|info`（无 `warn`）；spec 中 toast 的 `level` 统一用 `"error"`。
- **Skill 同步**：改 `doclens/skills/knowledge_base/SKILL.md` 后必须同步到 `~/.cortex/skills/knowledge_base/SKILL.md`（CLAUDE.md 约定，`SkillLoader` 运行时从全局读）。
- **运行命令**：
  - 后端测试：`.venv/Scripts/python.exe -m pytest tests/web_v2/<file>.py -v`
  - 前端测试：`cd doclens/web_v2/frontend && npx vitest run tests/<file>.spec.ts`
  - 前端构建：`cd doclens/web_v2/frontend && npm run build`

---

## File Structure

| 文件 | 职责 | 类型 |
|---|---|---|
| `doclens/web_v2/refs_parser.py` | 从 markdown 正文解析「## 参考资料」→ 路径 + 格式诊断（纯函数） | 新增 |
| `doclens/web_v2/references.py` | 加 `validate_paths`（路径存在性校验） | 改 |
| `doclens/web_v2/refs_retry.py` | 重试循环核心逻辑 `resolve_answer_with_retry` + 契约常量 + 反馈渲染（纯函数） | 新增 |
| `doclens/web_v2/api/chat.py` | `_stream_agent_response` 接入重试 + SSE `toast` 事件 | 改 |
| `doclens/skills/knowledge_base/SKILL.md` | 新增「机器解析契约」段 | 改 |
| `~/.cortex/skills/knowledge_base/SKILL.md` | 同步上一项 | 同步 |
| `doclens/web_v2/frontend/src/api/chat.ts` | `toast` 事件类型 + SSE 解析 | 改 |
| `doclens/web_v2/frontend/src/views/chat-view.ts` | `_submit` 流式循环加 toast 分支 → `_pushToast` | 改 |
| `tests/web_v2/test_refs_parser.py` | 解析器单测 | 新增 |
| `tests/web_v2/test_references.py` | 加 `validate_paths` 单测 | 改 |
| `tests/web_v2/test_refs_retry.py` | 重试逻辑单测（核心） | 新增 |
| `tests/web_v2/test_chat_api.py` | 加 toast SSE 序列化测试 | 改 |
| `tests/web_v2/test_skill_contract.py` | 契约文本一致性校验 | 新增 |
| `doclens/web_v2/frontend/tests/chat.spec.ts` | `chatStream` 解析 toast 事件测试 | 改 |

---

## Task 1: 参考资料解析器 `refs_parser.py`

**Files:**
- Create: `doclens/web_v2/refs_parser.py`
- Test: `tests/web_v2/test_refs_parser.py`

**Interfaces:**
- Produces: `parse_references_section(markdown: str) -> ParsedRefs`；`ParsedRefs(has_section: bool, paths: list[str], diagnostics: list[str], is_compliant() -> bool)`

- [ ] **Step 1: Write the failing test**

Create `tests/web_v2/test_refs_parser.py`:

```python
"""refs_parser 单测：从 AI 正文解析「## 参考资料」章节 + 格式诊断。"""
from doclens.web_v2.refs_parser import parse_references_section


def test_compliant_section_extracts_paths():
    md = (
        "量子计算利用量子比特 [1]。\n\n"
        "## 参考资料\n"
        "1. 量子计算/第一章.md\n"
        "2. 量子计算/第二章.md\n"
    )
    r = parse_references_section(md)
    assert r.has_section is True
    assert r.paths == ["量子计算/第一章.md", "量子计算/第二章.md"]
    assert r.diagnostics == []
    assert r.is_compliant() is True


def test_missing_section():
    r = parse_references_section("纯回答，没有参考资料章节。")
    assert r.has_section is False
    assert r.paths == []
    assert any("参考资料" in d for d in r.diagnostics)
    assert r.is_compliant() is False


def test_empty_section_no_list_items():
    r = parse_references_section("回答。\n\n## 参考资料\n\n下一段。")
    assert r.has_section is True
    assert r.paths == []
    assert any("列表" in d for d in r.diagnostics)
    assert r.is_compliant() is False


def test_bracket_prefix_rejected():
    r = parse_references_section("## 参考资料\n[1] a/b.md\n")
    assert r.is_compliant() is False
    assert any("[N]" in d for d in r.diagnostics)


def test_markdown_link_rejected():
    r = parse_references_section("## 参考资料\n1. [文本](a/b.md)\n")
    assert r.is_compliant() is False
    assert any("markdown" in d for d in r.diagnostics)


def test_file_scheme_rejected():
    r = parse_references_section("## 参考资料\n1. file://a/b.md\n")
    assert r.is_compliant() is False
    assert any("file://" in d for d in r.diagnostics)


def test_line_number_suffix_rejected():
    r = parse_references_section("## 参考资料\n1. a/b.md:42\n")
    assert r.is_compliant() is False
    assert any("行号" in d for d in r.diagnostics)


def test_angle_bracket_rejected():
    r = parse_references_section("## 参考资料\n1. <a/b.md>\n")
    assert r.is_compliant() is False
    assert any("<" in d for d in r.diagnostics)


def test_section_scoped_until_next_heading():
    md = "## 参考资料\n1. a/b.md\n## 其它\n不应被解析\n"
    r = parse_references_section(md)
    assert r.paths == ["a/b.md"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_refs_parser.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'doclens.web_v2.refs_parser'`

- [ ] **Step 3: Write minimal implementation**

Create `doclens/web_v2/refs_parser.py`:

```python
"""从 AI 正文解析「## 参考资料」章节，产出路径列表 + 格式诊断。

与 doclens/skills/knowledge_base/SKILL.md 的「机器解析契约」逐字一致。
解析结果供 refs_retry 校验：不合规 → chat.py 静默重答。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

# 章节标题：恰好「## 参考资料」（两个 #、空白、"参考资料"、行尾）
_SECTION_HEADER_RE = re.compile(r"^##\s+参考资料\s*$", re.MULTILINE)
# 任意一级/二级标题（界定章节体边界）
_NEXT_HEADING_RE = re.compile(r"^#{1,2}\s+\S", re.MULTILINE)
# 合规列表项：「数字. 」或「数字、」前缀
_LIST_ITEM_RE = re.compile(r"^\s*(\d+)[.、]\s*(.+?)\s*$")
# 被禁的 [N] 前缀
_BRACKET_PREFIX_RE = re.compile(r"^\s*\[\d+\]\s*(.+?)\s*$")

_MARKDOWN_LINK_RE = re.compile(r"\]\(")
_FILE_SCHEME_RE = re.compile(r"file://")
_LINE_SUFFIX_RE = re.compile(r":\d+\s*$")
_ANGLE_RE = re.compile(r"[<>]")


@dataclass(frozen=True)
class ParsedRefs:
    has_section: bool
    paths: list[str] = field(default_factory=list)
    diagnostics: list[str] = field(default_factory=list)

    def is_compliant(self) -> bool:
        return self.has_section and not self.diagnostics


def _diagnose_path(raw: str) -> tuple[str | None, str | None]:
    """返回 (清洗后的路径, 诊断)；路径合规时诊断为 None。"""
    path = raw.strip()
    if _MARKDOWN_LINK_RE.search(path):
        return None, f"路径含 markdown 链接，禁止 [t](u)：{path}"
    if _FILE_SCHEME_RE.search(path):
        return None, f"路径含 file://，禁止绝对 URL：{path}"
    if _LINE_SUFFIX_RE.search(path):
        return None, f"路径含行号后缀，禁止 :数字：{path}"
    if _ANGLE_RE.search(path):
        return None, f"路径含 < 或 >，禁止 <hierarchy> 残留：{path}"
    return path, None


def parse_references_section(markdown: str) -> ParsedRefs:
    """解析正文，返回 ParsedRefs。"""
    header = _SECTION_HEADER_RE.search(markdown)
    if header is None:
        return ParsedRefs(
            has_section=False,
            paths=[],
            diagnostics=["缺少「## 参考资料」章节"],
        )

    body_start = header.end()
    nxt = _NEXT_HEADING_RE.search(markdown, pos=body_start)
    body = markdown[body_start : (nxt.start() if nxt else len(markdown))]

    paths: list[str] = []
    diagnostics: list[str] = []
    saw_list_item = False

    for line in body.splitlines():
        if not line.strip():
            continue
        m = _LIST_ITEM_RE.match(line)
        if m:
            saw_list_item = True
            path, diag = _diagnose_path(m.group(2))
            if diag:
                diagnostics.append(diag)
            elif path:
                paths.append(path)
            continue
        bm = _BRACKET_PREFIX_RE.match(line)
        if bm:
            diagnostics.append(f"列表前缀应为「数字. 」而非 [N]：{line.strip()}")
            continue
        # 其它非空行（说明性文字等）忽略

    if not saw_list_item:
        diagnostics.append("「## 参考资料」章节未找到「数字. 路径」列表项")

    return ParsedRefs(has_section=True, paths=paths, diagnostics=diagnostics)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_refs_parser.py -v`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**（须用户授权）

```bash
git add doclens/web_v2/refs_parser.py tests/web_v2/test_refs_parser.py
git commit -m "feat(web_v2): 新增 refs_parser 解析「## 参考资料」+ 格式诊断"
```

---

## Task 2: 路径存在性校验 `validate_paths`

**Files:**
- Modify: `doclens/web_v2/references.py`
- Test: `tests/web_v2/test_references.py`

**Interfaces:**
- Consumes: 无新依赖
- Produces: `validate_paths(paths: list[str], workdir: Path) -> list[str]`（返回不存在的路径，去重保序）

- [ ] **Step 1: Write the failing test**

Append to `tests/web_v2/test_references.py`:

```python
def test_validate_paths_all_exist(tmp_path):
    from pathlib import Path
    from doclens.web_v2.references import validate_paths
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "b.md").write_text("x", encoding="utf-8")
    assert validate_paths(["a/b.md"], tmp_path) == []


def test_validate_paths_returns_missing(tmp_path):
    from doclens.web_v2.references import validate_paths
    assert validate_paths(["a/b.md", "c/d.md"], tmp_path) == ["a/b.md", "c/d.md"]


def test_validate_paths_normalizes_leading_dot(tmp_path):
    from doclens.web_v2.references import validate_paths
    (tmp_path / "x.md").write_text("x", encoding="utf-8")
    assert validate_paths(["./x.md"], tmp_path) == []


def test_validate_paths_dedup_preserves_order(tmp_path):
    from doclens.web_v2.references import validate_paths
    assert validate_paths(["p.md", "p.md", "q.md"], tmp_path) == ["p.md", "q.md"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_references.py -v -k validate_paths`
Expected: FAIL — `ImportError: cannot import name 'validate_paths'`

- [ ] **Step 3: Write minimal implementation**

Modify `doclens/web_v2/references.py` — 在文件顶部 import 区加 `from pathlib import Path`，并在文件末尾追加：

```python
def validate_paths(paths: list[str], workdir: Path) -> list[str]:
    """返回 workdir 下不存在的路径子集（首次出现顺序，去重）。

    Args:
        paths: 待校验的相对路径列表。
        workdir: 知识库根目录，path 相对它解析。

    Returns:
        不存在的路径列表（去重保序）。空列表表示全部存在。
    """
    seen: set[str] = set()
    missing: list[str] = []
    for raw in paths:
        path = raw.strip()
        if not path or path in seen:
            continue
        seen.add(path)
        if not (workdir / path).resolve().exists():
            missing.append(path)
    return missing
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_references.py -v`
Expected: PASS（原有 `extract_references` 测试 + 新增 4 个 `validate_paths` 测试全过）

- [ ] **Step 5: Commit**（须用户授权）

```bash
git add doclens/web_v2/references.py tests/web_v2/test_references.py
git commit -m "feat(web_v2): references 新增 validate_paths 路径存在性校验"
```

---

## Task 3: 重试循环核心逻辑 `refs_retry.py`（核心任务）

**Files:**
- Create: `doclens/web_v2/refs_retry.py`
- Test: `tests/web_v2/test_refs_retry.py`

**Interfaces:**
- Consumes: `parse_references_section` (Task 1)、`validate_paths` (Task 2)、`extract_references` (`references.py`)
- Produces:
  - `RoundResult(text: str, tool_calls: list[dict])`（frozen dataclass）
  - `ResolvedAnswer(text, tool_calls, references: list[dict], toast: str | None)`（frozen dataclass）
  - `resolve_answer_with_retry(run_round, user_message, history, workdir, max_retries=3, deadline_monotonic=None) -> ResolvedAnswer`
  - `evaluate_round(result, workdir) -> tuple[bool, list[str], list[dict]]`
  - `render_feedback(diagnostics) -> str`
  - 常量 `_REFERENCES_CONTRACT`、`_FALLBACK_TOAST`

- [ ] **Step 1: Write the failing test**

Create `tests/web_v2/test_refs_retry.py`:

```python
"""重试循环核心逻辑单测（纯函数，注入 fake run_round）。"""
import time
from doclens.web_v2.refs_retry import resolve_answer_with_retry, RoundResult


def _round(text, tool_calls):
    return RoundResult(text=text, tool_calls=tool_calls)


def test_exempt_when_no_retrieval_tool(tmp_path):
    """没调检索工具 → 豁免，直接采用，无 references、无 toast。"""
    calls = []
    def run_round(history, query):
        calls.append(query)
        return _round("已为你重建索引。", [{"name": "manage_kb", "output": "ok"}])
    res = resolve_answer_with_retry(run_round, "重建索引", [], tmp_path)
    assert len(calls) == 1
    assert res.text == "已为你重建索引。"
    assert res.references == []
    assert res.toast is None


def test_compliant_first_try(tmp_path):
    """正文合规章节 + 路径存在 → 一次通过，references=parsed.paths。"""
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "b.md").write_text("x", encoding="utf-8")
    md = "回答 [1]。\n\n## 参考资料\n1. a/b.md\n"
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    res = resolve_answer_with_retry(lambda h, q: _round(md, tc), "问题", [], tmp_path)
    assert res.references == [{"path": "a/b.md"}]
    assert res.toast is None


def test_retry_then_compliant(tmp_path):
    """第 1 轮缺章节 → 重试 → 第 2 轮合规；反馈消息含契约。"""
    (tmp_path / "a").mkdir()
    (tmp_path / "a" / "b.md").write_text("x", encoding="utf-8")
    md_bad = "回答 [1]。"  # 无 ## 参考资料
    md_good = "回答 [1]。\n\n## 参考资料\n1. a/b.md\n"
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    seq = iter([_round(md_bad, tc), _round(md_good, tc)])
    queries = []
    def run_round(h, q):
        queries.append(q)
        return next(seq)
    res = resolve_answer_with_retry(run_round, "问题", [], tmp_path)
    assert len(queries) == 2
    assert "参考资料不合规" in queries[1]
    assert "机器解析契约" in queries[1] or "## 参考资料" in queries[1]
    assert res.references == [{"path": "a/b.md"}]
    assert res.toast is None


def test_brake_falls_back_to_tool_results(tmp_path):
    """重试用尽 → 用工具结果兜底 + toast。"""
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    md_bad = "回答 [1]。"
    res = resolve_answer_with_retry(
        lambda h, q: _round(md_bad, tc), "问题", [], tmp_path, max_retries=2,
    )
    assert res.toast is not None
    assert res.references == [{"path": "a/b.md"}]


def test_brake_empty_tool_results_still_toast(tmp_path):
    """刹车时工具结果为空 → references 空，但仍 toast。"""
    tc = [{"name": "search_kb", "output": "无结果", "is_error": False}]
    md_bad = "回答 [1]。"
    res = resolve_answer_with_retry(
        lambda h, q: _round(md_bad, tc), "问题", [], tmp_path, max_retries=1,
    )
    assert res.toast is not None
    assert res.references == []


def test_timeout_brakes(tmp_path):
    """deadline 已过 → 跑完第 1 轮即刹车兜底。"""
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    md_bad = "回答 [1]。"
    n = {"count": 0}
    def run_round(h, q):
        n["count"] += 1
        return _round(md_bad, tc)
    res = resolve_answer_with_retry(
        run_round, "问题", [], tmp_path,
        max_retries=5, deadline_monotonic=time.monotonic() - 1,
    )
    assert n["count"] == 1
    assert res.toast is not None


def test_history_not_mutated(tmp_path):
    """调用方 history 不被 mutate。"""
    md_bad = "回答 [1]。"
    tc = [{"name": "search_kb", "output": "<path>a/b.md</path>", "is_error": False}]
    history = []
    resolve_answer_with_retry(lambda h, q: _round(md_bad, tc), "问题", history, tmp_path, max_retries=1)
    assert history == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_refs_retry.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'doclens.web_v2.refs_retry'`

- [ ] **Step 3: Write minimal implementation**

Create `doclens/web_v2/refs_retry.py`:

```python
"""参考资料校验 + 重试循环核心逻辑（纯函数，可单测）。

不直接跑 StreamingAgent —— run_round 由调用方注入（生产=chat.py 跑 StreamingAgent，
测试=fake）。判定规则：用了检索工具的回答必须有合规章节 + 路径存在；不合规静默重答，
重试用尽用工具结果兜底 + 告警。
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from doclens.web_v2.refs_parser import parse_references_section
from doclens.web_v2.references import extract_references, validate_paths

# 检索类工具（与 references.py 保持一致；manage_kb 等非检索豁免）
_RETRIEVAL_TOOLS = frozenset({"search_kb", "grep", "read_document"})

FALLBACK_TOAST = (
    "AI 多次回答的参考资料均不合规，已改用检索结果兜底，建议重建索引确保路径有效。"
)

# 与 SKILL.md「机器解析契约」逐字一致（Task 4 校验）
REFERENCES_CONTRACT = """## 参考资料（系统强制解析契约）
1. 章节标题必须正好是「## 参考资料」（两个#、空格、"参考资料"四字）
2. 每行「数字. 路径」（如「1. 量子计算/第一章.md」），数字后一个点一个空格
3. 路径 = 纯相对路径，禁止 [t](u) / file:// / 行号 / <...>
4. 系统按此格式机器解析并校验路径是否存在；不合规将被自动打回重答。"""

DEADLINE_SECONDS = 60
MAX_RETRIES = 3


@dataclass(frozen=True)
class RoundResult:
    """一轮对话的收集结果。"""
    text: str
    tool_calls: list[dict]


@dataclass(frozen=True)
class ResolvedAnswer:
    """重试循环的最终采用结果。

    references 空 list 表示不发 references 事件；toast None 表示不告警。
    """
    text: str
    tool_calls: list[dict]
    references: list[dict]
    toast: str | None


def evaluate_round(result: RoundResult, workdir: Path) -> tuple[bool, list[str], list[dict]]:
    """评估一轮结果。

    Returns:
        (compliant, diagnostics, references)。compliant=True 时 references 是
        要下发的卡片数据（合规=parsed.paths，豁免=[]）；不合规时 references=[]。
    """
    used_retrieval = any(
        tc.get("name") in _RETRIEVAL_TOOLS and not tc.get("is_error")
        for tc in result.tool_calls
    )
    if not used_retrieval:
        return True, [], []  # 流程性回复豁免

    parsed = parse_references_section(result.text)
    if not parsed.is_compliant():
        return False, list(parsed.diagnostics), []

    invalid = validate_paths(parsed.paths, workdir)
    if invalid:
        return False, ["路径不存在: " + ", ".join(invalid)], []
    return True, [], [{"path": p} for p in parsed.paths]


def render_feedback(diagnostics: list[str]) -> str:
    """生成重试时追加给 AI 的反馈消息。"""
    issues = "\n".join(f"- {d}" for d in diagnostics)
    return (
        "你上一条回答的参考资料不合规：\n"
        f"{issues}\n"
        "请重新完整回答用户原问题，并严格遵循下方契约"
        "（再次不合规会被继续打回）：\n"
        f"{REFERENCES_CONTRACT}"
    )


def resolve_answer_with_retry(
    run_round: Callable[[list[dict], str], RoundResult],
    user_message: str,
    history: list[dict],
    workdir: Path,
    max_retries: int = MAX_RETRIES,
    deadline_monotonic: float | None = None,
) -> ResolvedAnswer:
    """重试循环。不 mutate 调用方 history。

    每轮：跑 run_round → evaluate → 合规/豁免则采用；不合规且未刹车则追加反馈重试。
    刹车（次数用尽或超时）→ 工具结果兜底 + toast。
    """
    local_history = list(history)
    deadline = deadline_monotonic if deadline_monotonic is not None else time.monotonic() + DEADLINE_SECONDS
    feedback: str | None = None
    last: RoundResult | None = None
    attempt = 0

    while True:
        query = feedback if feedback is not None else user_message
        last = run_round(local_history, query)
        local_history.append({
            "role": "assistant",
            "content": last.text,
            "tool_calls": last.tool_calls,
        })

        compliant, diagnostics, refs = evaluate_round(last, workdir)
        if compliant:
            return ResolvedAnswer(last.text, list(last.tool_calls), refs, None)

        if attempt >= max_retries or time.monotonic() > deadline:
            fallback = extract_references(last.tool_calls)
            return ResolvedAnswer(last.text, list(last.tool_calls), fallback, FALLBACK_TOAST)

        feedback = render_feedback(diagnostics)
        local_history.append({"role": "user", "content": feedback})
        attempt += 1
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_refs_retry.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**（须用户授权）

```bash
git add doclens/web_v2/refs_retry.py tests/web_v2/test_refs_retry.py
git commit -m "feat(web_v2): 新增 refs_retry 重试循环纯逻辑（校验+反馈+兜底）"
```

---

## Task 4: KB Skill 机器解析契约段 + 一致性校验

**Files:**
- Modify: `doclens/skills/knowledge_base/SKILL.md`
- Sync: `~/.cortex/skills/knowledge_base/SKILL.md`
- Test: `tests/web_v2/test_skill_contract.py`

**Interfaces:**
- Consumes: `REFERENCES_CONTRACT` 常量（Task 3）
- Produces: SKILL.md 新增「机器解析契约」段

- [ ] **Step 1: Write the failing test**

Create `tests/web_v2/test_skill_contract.py`:

```python
"""校验 SKILL.md 的机器解析契约与 refs_retry.REFERENCES_CONTRACT 一致。"""
from pathlib import Path
import re

from doclens.web_v2.refs_retry import REFERENCES_CONTRACT


_SKILL_MD = Path(__file__).resolve().parents[2] / "doclens" / "skills" / "knowledge_base" / "SKILL.md"


def test_skill_md_contains_contract_section():
    text = _SKILL_MD.read_text(encoding="utf-8")
    assert "机器解析契约" in text, "SKILL.md 缺少「机器解析契约」段"


def test_contract_clauses_consistent_with_code():
    """契约的 4 条关键约束在 SKILL.md 和代码常量中都出现。"""
    skill_text = _SKILL_MD.read_text(encoding="utf-8")
    # 提取 SKILL.md 中契约段后的一段（到下一个 ## 标题）
    m = re.search(r"机器解析契约(.*?)(?=\n## |\Z)", skill_text, re.DOTALL)
    assert m is not None
    skill_section = m.group(1)
    # 4 条约束逐条比对（关键短语同时出现在两处）
    key_phrases = [
        "## 参考资料",
        "数字. 路径",
        "file://",
        "打回",
    ]
    for phrase in key_phrases:
        assert phrase in skill_section, f"SKILL.md 契约段缺少：{phrase}"
        assert phrase in REFERENCES_CONTRACT, f"代码常量缺少：{phrase}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_skill_contract.py -v`
Expected: FAIL — `AssertionError: SKILL.md 缺少「机器解析契约」段`

- [ ] **Step 3: Modify SKILL.md**

在 `doclens/skills/knowledge_base/SKILL.md` 的「回答铁律」示例代码块（第 35 行 ```` ``` ```` 之后）与「## 搜索策略」之间，插入新章节（逐字如下，与 `REFERENCES_CONTRACT` 一致）：

```markdown
## 机器解析契约（系统强制）

系统会**机器解析**「## 参考资料」章节并**校验路径是否存在**，不合规将被**自动打回重答**。严格遵循：

1. 章节标题必须正好是 `## 参考资料`（两个#、空格、"参考资料"四字）
2. 每行 `数字. 路径`（如 `1. 量子计算/第一章.md`），数字后一个点一个空格
3. 路径 = 纯相对路径，禁止 `[t](u)` / `file://` / 行号 `:数字` / `<...>`
4. 用了 `search_kb`/`grep`/`read_document` 必须有本章节；路径必须真实存在
```

- [ ] **Step 4: Sync to global skills dir**

```bash
cp doclens/skills/knowledge_base/SKILL.md ~/.cortex/skills/knowledge_base/SKILL.md
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_skill_contract.py -v`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**（须用户授权）

```bash
git add doclens/skills/knowledge_base/SKILL.md tests/web_v2/test_skill_contract.py
git commit -m "docs(kb-skill): 新增机器解析契约段（不合规自动打回）"
```

> ⚠️ `~/.cortex/skills/knowledge_base/SKILL.md` 是全局文件（git 不跟踪），Step 4 已同步；commit 仅含源文件。

---

## Task 5: chat.py 接入重试循环 + SSE toast 事件

**Files:**
- Modify: `doclens/web_v2/api/chat.py`
- Test: `tests/web_v2/test_chat_api.py`

**Interfaces:**
- Consumes: `resolve_answer_with_retry`, `RoundResult`, `ResolvedAnswer` (Task 3)
- Produces: 改造后的 `_stream_agent_response`（多轮 + 重放）；`chat()` 新增 `toast` SSE 分支

> 说明：`_stream_agent_response` 的真实多轮接线（跑 `StreamingAgent`）无法单测（需 mock 整个 session/tools）。其逻辑正确性由 **Task 3 纯函数测试**保证；本任务仅测 `toast` 事件的 SSE 序列化层（沿用现有 `monkeypatch _stream_agent_response` 模式）+ Task 7 手动/E2E 验证。

- [ ] **Step 1: Write the failing test**

Append to `tests/web_v2/test_chat_api.py`:

```python
@pytest.mark.asyncio
async def test_chat_serializes_toast_event(env_cortex_config, temp_workdir, monkeypatch):
    """toast 事件 → event:toast SSE。"""
    from doclens.web_v2 import deps

    class _FakeAgent:
        def __init__(self):
            self.session = type("S", (), {"session_id": "test"})()

    async def _fake_stream(message, session_id):
        yield {"type": "toast", "level": "error", "detail": "已兜底"}

    monkeypatch.setattr(deps, "get_agent", lambda: _FakeAgent())
    import doclens.web_v2.api.chat as chat_mod
    monkeypatch.setattr(chat_mod, "_stream_agent_response", _fake_stream)

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/chat", json={"message": "hi", "session_id": "test"})

    assert res.status_code == 200
    events = _parse_sse_events(res.text)
    assert "toast" in [e[0] for e in events]
    toast_ev = next(e[1] for e in events if e[0] == "toast")
    assert toast_ev == {"level": "error", "detail": "已兜底"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_api.py::test_chat_serializes_toast_event -v`
Expected: FAIL — SSE 中无 `toast` 事件（`chat()` 还没加 toast 分支）

- [ ] **Step 3: Rewrite `_stream_agent_response` and add toast branch in `chat()`**

Modify `doclens/web_v2/api/chat.py` —— 替换整个 `_stream_agent_response` 函数，并在 `chat()` 的 `event_stream` 内 `references` 分支后加 `toast` 分支。

新 `_stream_agent_response`（替换原函数体）:

```python
async def _stream_agent_response(message: str, session_id: Optional[str]) -> AsyncIterator[dict]:
    """多轮重试 + 缓冲静默 + 最终轮重放。

    线程内跑 resolve_answer_with_retry（含多轮 StreamingAgent，中间轮不推 SSE），
    完成后把采用轮结果（token / tool_call / tool_result / references / toast）重放出 queue。
    """
    import threading

    from doclens.web_v2.refs_retry import RoundResult, resolve_answer_with_retry

    agent = get_agent()
    session = agent.session

    history: list[dict] = []
    if session_id:
        try:
            from doclens.web_v2.deps import get_sessions_store
            history = get_sessions_store().get_chat_history(session_id)
        except Exception as e:  # noqa: BLE001
            logger.warning("load chat history failed for %s: %s", session_id, e)

    queue: asyncio.Queue = asyncio.Queue()
    main_loop = asyncio.get_running_loop()

    def _run_round(round_history: list[dict], query: str) -> RoundResult:
        """静默跑一轮 StreamingAgent，返回累积 text + tool_calls（不推 SSE queue）。"""
        from doclens.web_v2.api._chat_emitter import GradioEventEmitter
        from planify.streaming.runner import StreamingAgent
        from planify.streaming.types import StreamingConfig
        from planify.streaming.waiter import get_global_waiter
        from planify.tools import bind_user_interaction_handlers

        emitter = GradioEventEmitter()
        interrupt = threading.Event()
        round_loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(round_loop)
            sa = StreamingAgent(
                client=session.client,
                model=session.model,
                tools=session.tools,
                tool_handlers=session.tool_handlers,
                emitter=emitter,
                config=StreamingConfig(
                    compact_threshold=int(round(session.config.planify_context_window * 0.8))
                ),
                waiter=get_global_waiter(),
                todo_manager=session.todo_mgr,
                bg_manager=session.bg_mgr,
                bus=session.bus,
                skills_loader=session.skills,
                logger_instance=session.logger,
                session=session,
                interrupt_event=interrupt,
            )
            bind_user_interaction_handlers(session.tool_handlers, emitter, get_global_waiter())
            round_loop.run_until_complete(
                sa.run_stream(round_history, query, session_id or session.session_id)
            )
        finally:
            round_loop.close()
        return RoundResult(text=emitter.get_full_text(), tool_calls=list(emitter.tool_calls))

    def _retry_in_thread() -> None:
        try:
            resolved = resolve_answer_with_retry(
                _run_round, message, history, session.workdir,
            )
            events: list[dict] = [{"type": "token", "text": resolved.text}]
            for tc in resolved.tool_calls:
                events.append({
                    "type": "tool_call",
                    "tool_use_id": tc.get("tool_use_id", ""),
                    "name": tc.get("name", ""),
                    "input": tc.get("input", {}),
                })
                events.append({
                    "type": "tool_result",
                    "tool_use_id": tc.get("tool_use_id", ""),
                    "name": tc.get("name", ""),
                    "output": tc.get("output", ""),
                    "is_error": tc.get("is_error", False),
                    "duration_ms": tc.get("duration_ms"),
                })
            if resolved.references:
                events.append({"type": "references", "items": resolved.references})
            if resolved.toast:
                events.append({"type": "toast", "level": "error", "detail": resolved.toast})
            main_loop.call_soon_threadsafe(_enqueue_all, events)
        except Exception as e:  # noqa: BLE001
            logger.exception("chat thread error: %s", e)
            main_loop.call_soon_threadsafe(
                _enqueue_all, [{"type": "error", "detail": str(e)}]
            )

    def _enqueue_all(events: list[dict]) -> None:
        for ev in events:
            queue.put_nowait(ev)
        queue.put_nowait(None)  # sentinel

    t = threading.Thread(target=_retry_in_thread, daemon=True)
    t.start()

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        yield chunk
```

在 `chat()` 的 `event_stream` 内，`references` 分支后加（与 `references` 同级）:

```python
                elif t == "toast":
                    yield {"event": "toast", "data": json.dumps({
                        "level": ev.get("level", "error"),
                        "detail": ev.get("detail", ""),
                    }, ensure_ascii=False)}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_chat_api.py -v`
Expected: PASS（原 3 个 + 新 toast 测试，共 4 个）

- [ ] **Step 5: Commit**（须用户授权）

```bash
git add doclens/web_v2/api/chat.py tests/web_v2/test_chat_api.py
git commit -m "feat(web_v2): chat 接入参考资料重试循环 + toast 告警 SSE"
```

---

## Task 6: 前端 chat.ts toast 解析 + chat-view 弹窗

**Files:**
- Modify: `doclens/web_v2/frontend/src/api/chat.ts`
- Modify: `doclens/web_v2/frontend/src/views/chat-view.ts`
- Test: `doclens/web_v2/frontend/tests/chat.spec.ts`

**Interfaces:**
- Consumes: 现有 `ChatStreamEvent` 联合类型、`_pushToast`
- Produces: `ChatStreamEvent` 新增 `{ type: "toast"; level: "error"|"info"|"success"; detail: string }`

- [ ] **Step 1: Locate the existing chatStream test file**

Run: `cd doclens/web_v2/frontend && grep -n "references" tests/chat.spec.ts`
确认现有 references 事件测试位置（仿照其结构）。若无 `tests/chat.spec.ts`，用 `grep -rn "event === \"references\"" tests/` 定位。

- [ ] **Step 2: Write the failing test**

在定位到的测试文件（默认 `tests/chat.spec.ts`）中，仿照 references 事件测试追加：

```typescript
it("parses toast event from SSE", async () => {
  // 构造一个最小 SSE ReadableStream，emit event: toast
  const sseBody = [
    'event: toast',
    'data: {"level":"error","detail":"已兜底"}',
    '',
    '',
  ].join("\n");
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(sseBody));
      controller.close();
    },
  });
  // mock fetch 返回该 stream（与 references 测试同构，复用其 fetch mock 方式）
  const events: any[] = [];
  for await (const ev of chatStream({ message: "x" })) {
    events.push(ev);
  }
  const toast = events.find((e) => e.type === "toast");
  expect(toast).toBeDefined();
  expect(toast.level).toBe("error");
  expect(toast.detail).toBe("已兜底");
});
```

> 注：若现有 references 测试用特定的 fetch mock 工具/fixture，本测试复用同一机制。具体 fetch mock 代码参照该文件中 references 测试的 setUp（保持一致）。

- [ ] **Step 3: Run test to verify it fails**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/chat.spec.ts`
Expected: FAIL — `toast` event 未解析（`chat.ts` 还没加 toast 分支）

- [ ] **Step 4: Modify `chat.ts` — add toast type and parsing**

在 `src/api/chat.ts` 的 `ChatStreamEvent` 联合类型加一行（紧接 references 分支后）:

```typescript
  | { type: "toast"; level: "error" | "info" | "success"; detail: string }
```

在 `chatStream` 的 SSE 解析逻辑中，`references` 分支后加（同级 `else if`）:

```typescript
    } else if (ev.event === "toast") {
      try {
        const d = JSON.parse(ev.data);
        yield {
          type: "toast",
          level: (d.level ?? "error") as "error" | "info" | "success",
          detail: String(d.detail ?? ""),
        };
      } catch { /* skip */ }
```

- [ ] **Step 5: Modify `chat-view.ts` — handle toast in `_submit`**

在 `src/views/chat-view.ts` 的 `_submit` 方法流式循环中，把现有的 `else if (ev.type !== "done")` 拆分出 toast 单独处理。定位到这段：

```typescript
        if (ev.type === "error") {
          messages = applyStreamEvent(messages, { type: "token", text: `\n\n⚠️ ${ev.detail}` });
          actions.setChatState({ messages });
        } else if (ev.type !== "done") {
          messages = applyStreamEvent(messages, ev);
          actions.setChatState({ messages });
        }
```

替换为：

```typescript
        if (ev.type === "error") {
          messages = applyStreamEvent(messages, { type: "token", text: `\n\n⚠️ ${ev.detail}` });
          actions.setChatState({ messages });
        } else if (ev.type === "toast") {
          this._pushToast(ev.detail, ev.level === "success" ? "success" : "error", 5000);
        } else if (ev.type !== "done") {
          messages = applyStreamEvent(messages, ev);
          actions.setChatState({ messages });
        }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd doclens/web_v2/frontend && npx vitest run tests/chat.spec.ts`
Expected: PASS

并确认无回归：`npx vitest run tests/chat-view-stream.spec.ts tests/chat-view-session.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**（须用户授权）

```bash
git add doclens/web_v2/frontend/src/api/chat.ts doclens/web_v2/frontend/src/views/chat-view.ts doclens/web_v2/frontend/tests/chat.spec.ts
git commit -m "feat(web): chatStream 解析 toast 事件 + 对话页弹兜底告警"
```

---

## Task 7: 收尾验证 + 前端构建

**Files:** 无新文件（验证 + 构建）

- [ ] **Step 1: 后端全量测试**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/ -v`
Expected: 所有新增/改动测试通过（refs_parser / references / refs_retry / skill_contract / chat_api）；不破坏既有测试。

- [ ] **Step 2: 前端全量测试**

Run: `cd doclens/web_v2/frontend && npx vitest run`
Expected: 新 toast 测试通过；references 相关测试不回归（注意：基线有 14 个与本特性无关的 settings/md-viewer/app-bar 失败，对比失败数不增加即可）。

- [ ] **Step 3: 前端类型检查**

Run: `cd doclens/web_v2/frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: 前端生产构建**

Run: `cd doclens/web_v2/frontend && npm run build`
Expected: 构建成功，产物写入 `doclens/web_v2/static/`。

- [ ] **Step 5: 手动验证（启动 GUI）**

Run: `pwsh -File ./start-app.ps1 gui`（在仓库根；按 CLAUDE.md 用 pwsh 7）

验证清单：
- [ ] 问一个知识库问题，AI 第 1 次就给合规 `## 参考资料` → 卡片正常、无 toast
- [ ] 刷新/重开历史 → 卡片仍在（Task 前置修复）
- [ ] 触发兜底（如临时改坏 SKILL 或问冷僻问题让 AI 漏写）→ 看到 toast「已兜底」+ 卡片来自工具结果
- [ ] 流程性问题（如"重建索引"）→ 无卡片、无 toast、无重试延迟

> ⚠️ 手动验证若发现 session 状态污染（下次对话受重试消息影响）→ 回到 Task 5 在 `_run_round` 间增加 `session.messages` 回滚（见 spec「已知限制」降级方案）。

- [ ] **Step 6: Commit 构建产物 + 收尾**（须用户授权）

```bash
git add doclens/web_v2/static/
git commit -m "chore(web): 重建前端静态产物（参考资料校验+重试+toast）"
```

---

## Self-Review 记录

- **Spec 覆盖**：spec 每节均有任务对应 —— 解析器(T1)、validate_paths(T2)、重试循环(T3=spec 组件设计 1+3+反馈模板)、SKILL 契约(T4)、chat.py(T5=spec 组件设计 3)、前端 toast(T6=spec 组件设计 前端)、测试策略(T1-T6 的测试)、配置(MAX_RETRIES/DEADLINE 在 T3 常量)。
- **可测性改进**（相对 spec）：把重试逻辑抽成 `refs_retry.py` 纯函数 + 注入 `run_round`，而非内嵌 `_stream_agent_response`（后者被现有测试整体 mock，无法测重试逻辑）。这是对 spec 实现细节的优化，语义不变。
- **toast level 修正**：spec 写 `level:"warn"`，但 `toast-stack` 仅有 success/error/info → 全计划统一用 `error`。
- **类型一致性**：`RoundResult`、`ResolvedAnswer`、`evaluate_round`、`resolve_answer_with_retry`、`render_feedback`、`REFERENCES_CONTRACT`、`FALLBACK_TOAST` 在 T3 定义后被 T5 消费，命名逐字一致；前端 `toast` 事件 `{type, level, detail}` 在 chat.ts / chat-view.ts / chat.spec.ts 三处一致。
