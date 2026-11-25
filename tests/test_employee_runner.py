"""数字员工：存储层 + 派活纯函数 + 派活循环状态机（ADR-0062/0063）。

三层：
1. employees_store CRUD（临时目录隔离）；
2. employee_runner 纯函数：工具授权、提示词拼装、产物清单 / 无产物预检 /
   评审材料预算、评审结果解析、写入边界、工具目录；
3. _loop 状态机：用 FakeProvider 跑真实的后台循环（不碰 LLM / 网络），
   覆盖达标 / 轮数耗尽 / 无产物预检 / 评审失败 / 用户停止 五种结局与
   状态留档条目、重启补记中断。
"""
from __future__ import annotations

import asyncio
import json
import threading
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.web_v2 import employee_runner as er
from doclens.web_v2 import employees_store as es
from doclens.web_v2.models.employee import EmployeeCreate, EmployeeUpdate
from doclens.web_v2.sessions_store import SessionItem, SessionsStore, SessionSummary, SessionType
from planify.core.llm.types import ToolUseBlock


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(es, "get_global_cortex_dir", lambda: Path(tmp_path) / "global")
    es._LOCK.acquire() and es._LOCK.release()
    yield


def _emp(**over) -> dict:
    base = dict(
        id="e1", name="tom", description="调研员",
        prompt="你是调研员。", tools_allow=[], tools_deny=[], skills_allow=[],
        model_preset_id="p-work", review_model_preset_id=None, thinking_depth="auto",
        artifact_root="调研", template_path=None, review_criteria="有来源、结构清楚",
        score_threshold=90, max_iterations=3, created_at="t", updated_at="t",
    )
    base.update(over)
    return base


def _store(tmp_path: Path) -> SessionsStore:
    return SessionsStore(tmp_path / "sessions.db")


def _fake_world(tmp_path: Path, monkeypatch, *, score_plan: list[int], preset_cw: int = 128_000):
    """装配 _loop 需要的最小依赖：agent/runtime/store/provider。

    score_plan：每次评审返回的分数（超出后重复最后一个）。评审模型直接被
    替换为 FakeReviewer（不解析 LLM 文本，直接给 ReviewResult）。
    """
    workdir = tmp_path / "kb"
    workdir.mkdir(exist_ok=True)
    store = _store(tmp_path)

    class _Skills:
        skills: dict = {}

        def load(self, name):
            return f"Error: Unknown skill '{name}'."

    runtime = SimpleNamespace(
        tools=[{"name": n} for n in ("read_file", "write_file", "edit_file", "grep", "bash",
                                     "ask_user_question", "task", "load_skill", "mcp__x__y")],
        tool_handlers={n: (lambda *a, **k: "ok") for n in
                       ("read_file", "write_file", "edit_file", "grep", "bash", "ask_user_question",
                        "task", "load_skill", "mcp__x__y")},
        skills=_Skills(),
        logger=None,
        config=SimpleNamespace(planify_context_window=128_000, planify_max_tokens=4000),
    )
    agent = SimpleNamespace(runtime=runtime, workdir=str(workdir))
    monkeypatch.setattr("doclens.web_v2.deps.get_agent", lambda: agent)
    monkeypatch.setattr("doclens.web_v2.deps.get_sessions_store", lambda: store)
    monkeypatch.setattr(er, "_preset_or_none", lambda pid: {
        "protocol": "openai_compat", "base_url": "https://x", "model_id": "m", "api_key": "k",
        "context_window": preset_cw, "vision": False,
    } if pid else None)
    monkeypatch.setattr(er, "_make_provider", lambda preset, depth: object())

    calls = {"review": 0, "rounds": 0}

    class _FakeSA:
        """替身 StreamingAgent：写一个产物文件并记录；可被 interrupt 打断。"""

        def __init__(self, **kw):
            self.kwargs = kw
            self.round_start_index = 0
            self.last_compaction = None
            self.round_cleared_tool_use_ids = None
            self._n = calls["rounds"]
            calls["rounds"] += 1

        async def run_stream(self, history, message, session_id, images=None):
            await asyncio.sleep(0.01)   # 让出控制权（interrupt 可在此间被 set）
            if self.kwargs["interrupt_event"].is_set():
                return
            # 第 1 轮不写文件（触发无产物预检），之后每轮写一个产物
            if self._n >= 1:
                (artifact_dir / "报告.md").write_text(f"# 报告 v{self._n}\n内容", encoding="utf-8")
            history.append({"role": "user", "content": message})
            history.append({"role": "assistant", "content": f"完成（第{self._n + 1}轮）"})

    class _FakeEmitter:
        def __init__(self, queue=None, context_window=0):
            self.tool_calls = []
            self.usages = []
            self.error = None
            self.queue = queue
            self.context_window = context_window

        def get_full_text(self):
            return "完成"

        async def emit(self, event):
            pass

    async def _fake_review(provider, messages, system, cw, review_images, tracer=None):
        calls["review"] += 1
        s = score_plan[min(calls["review"] - 1, len(score_plan) - 1)]
        if s is None:
            return er.ReviewResult(score=None, passed=False, kind="failed", error="boom")
        return er.ReviewResult(score=s, passed=s >= 90, issues=["补充来源"] if s < 90 else [])

    monkeypatch.setattr("planify.streaming.runner.StreamingAgent", _FakeSA)
    monkeypatch.setattr("doclens.web_v2.api._chat_emitter.ChatEventEmitter", _FakeEmitter)
    monkeypatch.setattr(er, "_do_review", _fake_review)
    # persist_round 依赖 extract_round_raw_messages 等；替身为空操作（落库细节由
    # round_finalizer 自己的测试覆盖）
    monkeypatch.setattr(er, "persist_round", lambda *a, **k: SimpleNamespace(error=None))
    monkeypatch.setattr("planify.core.llm.trace.LLMTracer.create", lambda **k: None)
    monkeypatch.setattr("planify.streaming.waiter.get_global_waiter", lambda: SimpleNamespace(interrupt_session=lambda s: None))

    artifact_dir = workdir / "调研" / "20260101-任务"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    state = er.AssignmentState(
        session_id="sess-test", employee_id="e1", employee_name="tom",
        artifact_dir=artifact_dir, started_at="now",
    )
    store.create(SessionSummary(
        id="sess-test", type=SessionType.CHAT, title="t", preview="", mode=er.SESSION_MODE,
        created_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        updated_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    ))
    return SimpleNamespace(store=store, state=state, artifact_dir=artifact_dir, workdir=workdir, calls=calls)


def _brief(task="写报告"):
    return er.build_brief(task, Path("/k/out"), False, 90, "有来源", 3)


async def _run_loop(world, cfg, task="写报告", templates=None):
    world.store.ensure_message_user(world.state.session_id, _brief(task))
    await er._loop(world.state, cfg, task, _brief(task), templates or set(), "EXTRA", False)


def _events(store, sid, kind):
    return [json.loads(i.payload) for i in store.get_events(sid, kind)]


# ---------------------------------------------------------------------------
# 1. 存储层
# ---------------------------------------------------------------------------


def _create_payload(**over):
    base = dict(
        name="tom", prompt="你是调研员。", model_preset_id="p1", artifact_root="调研",
        review_criteria="有来源", tools_allow=["read_file"],
    )
    base.update(over)
    return EmployeeCreate(**base)


def test_store_create_get_list_roundtrip():
    created = es.create_employee(_create_payload())
    assert created["name"] == "tom" and created["id"]
    assert es.get_employee(created["id"])["prompt"] == "你是调研员。"
    assert [e["name"] for e in es.list_employees()] == ["tom"]
    assert es.get_employee_by_name("tom")["id"] == created["id"]


def test_store_name_unique_case_insensitive_strip():
    es.create_employee(_create_payload(name="tom"))
    with pytest.raises(es.EmployeeError) as ei:
        es.create_employee(_create_payload(name="  TOM "))
    assert ei.value.code == "NAME_CONFLICT"


def test_store_update_partial_and_rename_conflict():
    a = es.create_employee(_create_payload(name="a"))
    es.create_employee(_create_payload(name="b"))
    upd = es.update_employee(a["id"], EmployeeUpdate(score_threshold=80, tools_deny=["bash"]).model_dump(exclude_unset=True))
    assert upd["score_threshold"] == 80 and upd["tools_deny"] == ["bash"]
    assert upd["prompt"] == "你是调研员。"
    with pytest.raises(es.EmployeeError):
        es.update_employee(a["id"], {"name": "b"})
    with pytest.raises(es.EmployeeError):
        es.update_employee("nope", {"name": "c"})


def test_store_delete_and_missing():
    a = es.create_employee(_create_payload())
    assert es.delete_employee(a["id"]) is True
    assert es.get_employee(a["id"]) is None
    with pytest.raises(es.EmployeeError):
        es.delete_employee(a["id"])


def test_store_model_missing_derived(monkeypatch):
    from doclens.web_v2 import presets_store

    monkeypatch.setattr(presets_store, "list_presets", lambda kind=None: [{"id": "p1", "kind": "llm"}])
    e = es.create_employee(_create_payload(model_preset_id="p1", review_model_preset_id="gone"))
    assert e["model_missing"] is False and e["review_model_missing"] is True
    e2 = es.create_employee(_create_payload(name="x", model_preset_id="nope"))
    assert e2["model_missing"] is True


# ---------------------------------------------------------------------------
# 2. 纯函数
# ---------------------------------------------------------------------------


def test_resolve_tools_allow_deny_forbidden():
    tools = [{"name": n} for n in ("read_file", "write_file", "bash", "task", "ask_user_question", "load_skill")]
    assert er.resolve_tools(tools, [], []) == ["read_file", "write_file", "bash"]
    assert er.resolve_tools(tools, ["read_file", "bash", "task"], []) == ["read_file", "bash"]
    assert er.resolve_tools(tools, [], ["bash"]) == ["read_file", "write_file"]
    assert er.resolve_tools(tools, ["read_file", "bash"], ["bash"]) == ["read_file"]


def test_assignment_dir_slug_and_collision(tmp_path):
    d1 = er.assignment_dir(tmp_path, "调研", "搜索最新的 agent 技术")
    assert d1.parent == tmp_path / "调研" and d1.name.startswith("20") and "-搜索最新的-agent-技术" in d1.name
    d1.mkdir(parents=True)
    d2 = er.assignment_dir(tmp_path, "调研", "搜索最新的 agent 技术")
    assert d2.name.endswith("-2")
    assert er.slugify("a/b:c*?") == "a-b-c"   # 非法字符→空格→连字符


def test_build_brief_and_rework_order():
    brief = er.build_brief("搜 agent", Path("/k/a"), True, 90, "有来源", 5)
    assert brief.startswith("<assignment>") and brief.rstrip().endswith("搜 agent")
    assert "模板拷贝" in brief and "达到 90 分" in brief and "<criteria>" in brief
    ro = er.build_rework_order(er.ReviewResult(75, False, issues=["缺来源"], suggestions=["补 2025 案例"]), 90, Path("/k/a"))
    assert ro.startswith(f'<{er.REWORK_TAG} score="75" threshold="90">') and ro.endswith(f"</{er.REWORK_TAG}>")
    assert "1. 缺来源" in ro and "- 补 2025 案例" in ro
    na = er.build_rework_order(er.ReviewResult(None, False, kind="no_artifact"), 90, Path("/k/a"))
    assert "产物目录为空" in na and 'score=""' in na


def test_build_system_extra_preloads_skills_and_rules():
    s = er.build_system_extra("你是调研员。", [("s1", "<skill>body</skill>")], Path("/k"), Path("/k/out/x"), ["gone"])
    assert "# Your role" in s and "<skill>body</skill>" in s and "gone" in s
    assert "只能写入产物目录" in s and "/k/out/x" in s


def test_list_artifacts_ignores_tmp_and_marks_template(tmp_path):
    d = tmp_path / "out"
    (d / "tmp").mkdir(parents=True)
    (d / "报告.md").write_text("x", encoding="utf-8")
    (d / "tmp" / "s.py").write_text("y", encoding="utf-8")
    (d / "模板.md").write_text("t", encoding="utf-8")
    arts = er.list_artifacts(d, {"模板.md"})
    assert [a.path for a in arts] == ["报告.md", "模板.md"]
    assert arts[1].is_template and not arts[0].is_template
    assert er.has_deliverable(d, {"模板.md"}) is True
    assert er.has_deliverable(d, {"报告.md", "模板.md"}) is False
    assert er.has_deliverable(tmp_path / "nope", set()) is False


def test_collect_review_material_budget_primary_protection(tmp_path):
    d = tmp_path / "out"
    d.mkdir()
    big = "甲" * 50_000
    (d / "主报告.md").write_text(big, encoding="utf-8")
    for i in range(3):
        (d / f"小{i}.txt").write_text("乙" * 2_000, encoding="utf-8")
    (d / "data.bin").write_bytes(b"\x00\x01")
    m = er.collect_review_material(d, set(), context_window=40_000)
    by = {f["path"]: f for f in m["files"]}
    budget = m["budget_chars"]
    assert budget == int(40_000 * 0.5 * 1.5)
    # 主报告至少六成预算：50_000 字 > 0.6*30000=18000 → 被截断，长度=18000
    assert by["主报告.md"]["truncated"] is True and len(by["主报告.md"]["text"]) == int(budget * 0.6)
    # 其余均分：30000-18000=12000/3=4000 > 2000 → 不截断
    assert all(by[f"小{i}.txt"]["included"] and not by[f"小{i}.txt"]["truncated"] for i in range(3))
    assert by["data.bin"]["included"] is False and by["data.bin"]["kind"] == "binary"
    system, msgs = er.build_review_messages(m, "任务", "标准", 90, False)
    assert "submit_review" in system and "主报告.md [TRUNCATED" in msgs[0]["content"]
    assert "not included in review" in msgs[0]["content"] and "Task\n任务" in msgs[0]["content"]


def test_collect_review_material_omits_when_share_too_small(tmp_path):
    d = tmp_path / "out"
    d.mkdir()
    (d / "a.md").write_text("x" * 100, encoding="utf-8")
    for i in range(60):
        (d / f"f{i:02d}.md").write_text("y" * 100, encoding="utf-8")
    m = er.collect_review_material(d, set(), context_window=20_000)
    assert m["omitted"], "预算不足时应省略部分文件"
    assert all(not f["included"] for f in m["files"] if f["path"] in m["omitted"])


def test_parse_review_variants():
    r = er.parse_review([{"type": "tool_use", "name": "submit_review",
                          "input": {"score": 93.4, "passed": True, "issues": [], "suggestions": ["s"],
                                    "summary": "好"}}], 0)
    assert r.score == 93 and r.passed and r.suggestions == ["s"]
    r2 = er.parse_review([{"type": "text", "text": "x"},
                          {"type": "tool_use", "name": "submit_review",
                           "input": {"score": 50, "passed": False, "issues": ["a", " ", "b"]}}], 90)
    assert r2.score == 50 and r2.issues == ["a", "b"]
    with pytest.raises(ValueError):
        er.parse_review([{"type": "text", "text": "no tool"}], 0)
    with pytest.raises(ValueError):
        er.parse_review([{"type": "tool_use", "name": "submit_review", "input": {"score": "x"}}], 0)
    # dataclass 块（ToolUseBlock）
    r3 = er.parse_review([ToolUseBlock(id="1", name="submit_review", input={"score": 1, "passed": False, "issues": []})], 0)
    assert r3.score == 1


def test_bind_write_boundary_file_tools(tmp_path):
    root = tmp_path / "kb" / "out" / "a"
    wd = tmp_path / "kb"
    root.mkdir(parents=True)
    calls = []

    def write_file(path, content):
        calls.append(path)
        return "written"

    h = er.bind_write_boundary({"write_file": write_file, "edit_file": write_file, "read_file": lambda p: "r"}, root, wd)
    assert h["write_file"](path="out/a/x.md", content="x") == "written"             # 产物目录内放行
    assert "拒绝" in h["write_file"](path="out/x.md", content="x")                  # 同级目录在外
    assert "拒绝" in h["write_file"](path=str(wd / "elsewhere.md"), content="x")    # 绝对路径在外
    assert h["write_file"](str(root / "y.md"), "x") == "written"                     # positional：首位是路径（在内），内容不当路径
    assert "拒绝" in h["write_file"](str(wd / "z.md"), "x")                          # positional 路径在外
    assert h["read_file"]("whatever") == "r"
    assert calls == ["out/a/x.md", str(root / "y.md")]


def test_bind_write_boundary_shell(tmp_path):
    root = tmp_path / "kb" / "out"
    wd = tmp_path / "kb"
    root.mkdir(parents=True)
    (wd / "outside.txt").parent.mkdir(exist_ok=True)
    h = er.bind_write_boundary({"bash": lambda command: f"ran:{command}"}, root, wd)
    assert "拒绝" in h["bash"]("echo hi > 调研/x.md")
    assert "拒绝" in h["bash"](f"echo hi > {wd / 'x.md'}")
    assert h["bash"]("ls 调研").startswith("ran:")
    assert h["bash"]("echo hi > out/ok.md").startswith("ran:")       # 产物目录内放行
    assert h["bash"]("python script.py").startswith("ran:")          # 无写信号放行
    assert h["bash"]("echo hi > /tmp/x").startswith("ran:")          # 工作目录外不拦（交门禁）


def test_tool_catalog_groups():
    cat = er.tool_catalog([{"name": "bash"}, {"name": "search_kb"}, {"name": "mcp__wordcraft__execute"},
                           {"name": "task"}, {"name": "read_file"}])
    by = {c["name"]: c for c in cat}
    assert by["bash"]["group"] == "builtin" and by["bash"]["writable"] and not by["bash"]["forbidden"]
    assert by["search_kb"]["group"] == "kb"
    assert by["mcp__wordcraft__execute"]["group"] == "mcp" and by["mcp__wordcraft__execute"]["server"] == "wordcraft"
    assert by["task"]["forbidden"] and by["read_file"]["group"] == "builtin" and not by["read_file"]["writable"]


# ---------------------------------------------------------------------------
# 3. 循环状态机
# ---------------------------------------------------------------------------


CFG = dict(model_preset_id="p-work", review_model_preset_id=None, thinking_depth="auto",
           score_threshold=90, max_iterations=3, review_criteria="有来源",
           tools_allow=[], tools_deny=[], skills_allow=[])


def test_loop_passes_then_ends(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[95])
    asyncio.run(_run_loop(w, CFG))
    ends = _events(w.store, "sess-test", er.KIND_END)
    assert len(ends) == 1 and ends[0]["outcome"] == er.OUTCOME_PASSED and ends[0]["score"] == 95
    revs = _events(w.store, "sess-test", er.KIND_REVIEW)
    # 第 1 轮无产物（FakeSA 首轮不写文件）→ 预检；第 2 轮评审 95 分通过
    assert [r["kind"] for r in revs] == ["no_artifact", "review"]
    assert revs[1]["score"] == 95 and revs[1]["passed"] is True
    assert ends[0]["iterations"] == 2
    starts = _events(w.store, "sess-test", er.KIND_START)
    assert starts[0]["employee_name"] == "tom" and starts[0]["threshold"] == 90
    assert er.is_assignment("sess-test") is False   # 结束后出注册表


def test_loop_exhausted_after_max_iterations(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[70, 80])
    asyncio.run(_run_loop(w, CFG))
    revs = _events(w.store, "sess-test", er.KIND_REVIEW)
    # 第 1 轮无产物（no_artifact），第 2、3 轮评审 70、80 → 轮数耗尽
    assert [r["kind"] for r in revs] == ["no_artifact", "review", "review"]
    assert [r["score"] for r in revs] == [None, 70, 80]
    end = _events(w.store, "sess-test", er.KIND_END)[0]
    assert end["outcome"] == er.OUTCOME_EXHAUSTED and end["score"] == 80 and end["iterations"] == 3
    # 第 2 轮的 user 消息是返工指令（带标签）
    users = [json.loads(i.payload)["content"] for i in w.store.get_detail("sess-test")
             if i.kind == "message_user"]
    assert users[0].startswith("<assignment>")                    # 派活说明（首轮，幂等不重复）
    assert len([u for u in users if u.startswith("<assignment>")]) == 1
    assert users[1].startswith(f'<{er.REWORK_TAG} score=""')   # 无产物 → 合成返工
    assert users[2].startswith(f'<{er.REWORK_TAG} score="70"')  # 评审未达标 → 评审返工


def test_loop_review_failed_terminates(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[None])
    asyncio.run(_run_loop(w, {**CFG, "max_iterations": 5}))
    revs = _events(w.store, "sess-test", er.KIND_REVIEW)
    assert revs[-1]["kind"] == "failed" and revs[-1]["error"] == "boom"
    assert _events(w.store, "sess-test", er.KIND_END)[0]["outcome"] == er.OUTCOME_REVIEW_FAILED
    assert w.calls["rounds"] == 2   # 第 1 轮无产物 + 第 2 轮评审失败后停止，不再续跑


def test_loop_stopped_by_user(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[70, 70])

    async def _go():
        world_store = w.store
        world_store.ensure_message_user(w.state.session_id, _brief())
        task = asyncio.create_task(er._loop(w.state, CFG, "写报告", _brief(), set(), "EXTRA", False))
        await asyncio.sleep(0.005)      # FakeSA 让出控制权期间
        w.state.interrupt.set()
        w.state.stop_requested = True
        await task

    asyncio.run(_go())
    end = _events(w.store, "sess-test", er.KIND_END)[0]
    assert end["outcome"] == er.OUTCOME_STOPPED


def test_loop_works_with_template_only_is_no_artifact(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[95])
    (w.artifact_dir / "模板.md").write_text("模板", encoding="utf-8")
    asyncio.run(_run_loop(w, {**CFG, "max_iterations": 1}, templates={"模板.md"}))
    revs = _events(w.store, "sess-test", er.KIND_REVIEW)
    assert revs[0]["kind"] == "no_artifact"
    assert _events(w.store, "sess-test", er.KIND_END)[0]["outcome"] == er.OUTCOME_EXHAUSTED


def test_do_review_passes_tool_dataclass_not_dict():
    """契约锁（2026-11-25 真机事故）：provider.chat 的 tools 必须是 Tool dataclass——
    传 dict 会在 tool_translator 里 'dict' object has no attribute 'name'。"""
    from planify.core.llm.types import Tool

    seen = {}

    class _P:
        def chat(self, messages, system, tools, max_tokens, tracer=None):
            seen["tools"] = tools
            return SimpleNamespace(content=[ToolUseBlock(id="1", name="submit_review",
                                                         input={"score": 88, "passed": False, "issues": ["x"]})],
                                   stop_reason="tool_use", model="m", usage={})

    r = asyncio.run(er._do_review(_P(), [{"role": "user", "content": "m"}], "s", None, False))
    assert r.score == 88 and r.issues == ["x"]
    assert len(seen["tools"]) == 1 and isinstance(seen["tools"][0], Tool)


def test_do_review_retries_once_then_failed():
    calls = {"n": 0}

    class _P:
        def chat(self, *a, **k):
            calls["n"] += 1
            raise RuntimeError("boom")

    async def _fast_sleep(_):
        return None

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(er.asyncio, "sleep", _fast_sleep)
        r = asyncio.run(er._do_review(_P(), [], "s", None, False))
    assert r.kind == "failed" and r.error == "boom" and calls["n"] == 2


def test_mark_interrupted_on_startup(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[95])
    monkeypatch.setattr(er, "_do_review", None)
    _now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
    w.store.create(SessionSummary(id="sess-other", type=SessionType.CHAT, title="t", preview="",
                                  mode=er.SESSION_MODE, created_at=_now, updated_at=_now))
    w.store.append_event("sess-test", er.KIND_START, {"employee_id": "e1", "employee_name": "tom"})
    w.store.append_event("sess-other", er.KIND_START, {"employee_id": "e2"})
    w.store.append_event("sess-other", er.KIND_END, {"outcome": "passed"})
    assert er.mark_interrupted_on_startup() == 1
    end = _events(w.store, "sess-test", er.KIND_END)[0]
    assert end["outcome"] == er.OUTCOME_INTERRUPTED and end["employee_id"] == "e1"
    assert er.mark_interrupted_on_startup() == 0   # 幂等


def test_sessions_store_append_event_and_open(tmp_path):
    store = _store(tmp_path)
    sid = store.new_session_id()
    store.create(SessionSummary(
        id=sid, type=SessionType.CHAT, title="t", preview="", mode=er.SESSION_MODE,
        created_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        updated_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    ))
    store.append_event(sid, er.KIND_START, {"a": 1})
    store.ensure_message_user(sid, "hi")
    s2 = store.append_event(sid, er.KIND_REVIEW, {"b": 2})
    assert s2 == 2
    assert [i.kind for i in store.get_events(sid, er.KIND_REVIEW)] == [er.KIND_REVIEW]
    assert store.sessions_with_open_event(er.KIND_START, er.KIND_END) == [sid]
    store.append_event(sid, er.KIND_END, {"outcome": "passed"})
    assert store.sessions_with_open_event(er.KIND_START, er.KIND_END) == []
    # 回放忽略自定义 kind：历史里只有 user（无 assistant）
    hist = store.get_chat_history(sid)
    assert [m["role"] for m in hist] == ["user"]
