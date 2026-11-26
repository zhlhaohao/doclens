"""数字员工：存储层 + 派活纯函数 + 派活循环状态机（ADR-0062/0063/0065）。

三层：
1. employees_store CRUD（临时目录隔离；内部技能缺失派生标记）；
2. employee_runner 纯函数：工具授权、提示词拼装、评审指令 / 返工指令 / 预算预警、
   submit_review 入参解析、load_skill 白名单 handler、写入边界、工具目录；
3. _loop 状态机：FakeSA 区分工作/评审回合（评审回合调 submit_review handler），
   覆盖达标 / 轮数耗尽 / 评审失败（未提交 / 工作回合失败）/ 预算耗尽 / 用户停止
   五种结局与状态留档条目、重启补记中断。
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

from doclens.web_v2 import employee_runner as er
from doclens.web_v2 import employees_store as es
from doclens.web_v2.models.employee import EmployeeCreate, EmployeeUpdate
from doclens.web_v2.sessions_store import SessionsStore, SessionSummary, SessionType


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(es, "get_global_cortex_dir", lambda: Path(tmp_path) / "global")
    er._active.clear()
    yield
    er._active.clear()


def _now():
    return datetime.now(timezone.utc)


def _mk_internal_skills(tmp_path: Path, *names: str) -> None:
    root = tmp_path / "global" / "employee_skills"
    for n in names:
        d = root / n
        d.mkdir(parents=True, exist_ok=True)
        (d / "SKILL.md").write_text(
            f"---\nname: {n}\ndescription: {n} 技能\n---\n\n# {n}\n正文", encoding="utf-8",
        )


def _emp(**over) -> dict:
    base = dict(
        id="e1", name="tom", description="周报撰写员",
        prompt="你是周报撰写员。", tools_allow=[], tools_deny=[], skills_allow=["work-a"],
        review_skill="rev-a", model_preset_id="p-work", review_model_presets=[],
        thinking_depth="auto", artifact_root="周报", template_path=None,
        review_criteria="三节齐全", score_threshold=90, max_iterations=3,
        token_budget=0, max_tool_rounds=0, review_tool_rounds=0, created_at="t", updated_at="t",
    )
    base.update(over)
    return base


def _store(tmp_path: Path) -> SessionsStore:
    return SessionsStore(tmp_path / "sessions.db")


def _skill_names_in(loader) -> list[str]:
    """从 descriptions() 文本里解析技能名（行形如 ``  - name: desc``）。"""
    import re as _re

    return sorted(_re.findall(r"^\s*-\s+([^\s:]+):", loader.descriptions(), flags=_re.M))


def _fake_world(tmp_path: Path, monkeypatch, *, score_plan: list, usage_per_turn: int = 0,
                review_submits: bool = True, session_id: str = "sess-test"):
    """装配 _loop 需要的最小依赖。

    FakeSA：按 user 消息类型区分回合——
    - 首条（<assignment>）与 <rework-order> → 工作回合：追加 assistant 文本
    - <review-order> → 评审回合：调 handlers["submit_review"]（按 score_plan），
      review_submits=False 时模拟「忘了调」只输出文字
    usage_per_turn：每个回合模拟的 token 消耗。
    """
    workdir = tmp_path / "kb"
    workdir.mkdir(parents=True, exist_ok=True)
    store = _store(tmp_path)
    _mk_internal_skills(tmp_path, "work-a", "rev-a")
    loader = er.internal_skill_loader()
    assert loader is not None and set(loader.skills) == {"work-a", "rev-a"}

    runtime = SimpleNamespace(
        tools=[{"name": n} for n in ("read_file", "write_file", "edit_file", "grep", "bash",
                                     "ask_user_question", "task", "load_skill", "mcp__x__y")],
        tool_handlers={
            n: (lambda *a, **k: "ok") for n in
            ("read_file", "write_file", "edit_file", "grep", "bash", "ask_user_question", "task", "mcp__x__y")
        },
        skills=None, logger=None,
        config=SimpleNamespace(planify_context_window=128_000, planify_max_tokens=4000),
    )
    agent = SimpleNamespace(runtime=runtime, workdir=str(workdir))
    monkeypatch.setattr("doclens.web_v2.deps.get_agent", lambda: agent)
    monkeypatch.setattr("doclens.web_v2.deps.get_sessions_store", lambda: store)
    monkeypatch.setattr(er, "_preset_or_none", lambda pid: {
        "protocol": "openai_compat", "base_url": "https://x", "model_id": f"m-{pid}", "api_key": "k",
        "context_window": 128_000, "vision": False,
    } if pid else None)
    monkeypatch.setattr(er, "_make_provider", lambda preset, depth: SimpleNamespace(model=preset["model_id"]))
    seen = {"turns": [], "review_idx": 0}

    class _FakeSA:
        def __init__(self, **kw):
            self.kwargs = kw
            self.round_start_index = 0
            self.last_compaction = None
            self.round_cleared_tool_use_ids = None

        async def run_stream(self, history, message, session_id, images=None):
            ev = self.kwargs["interrupt_event"]
            await asyncio.sleep(0.005)
            if ev.is_set():
                return
            kind = ("review" if message.startswith("<review-order") else
                    "work" if message.startswith(("<assignment", "<rework-order")) else "other")
            seen["turns"].append({
                "kind": kind, "model": self.kwargs["model"],
                "keep_on_force": self.kwargs["config"].force_answer_keep_tools,
                "force_rounds": self.kwargs["config"].force_answer_rounds,
                "tools": sorted(t["name"] for t in self.kwargs["tools"]),
                "has_submit": "submit_review" in self.kwargs["tool_handlers"],
                "skills": _skill_names_in(self.kwargs["skills_loader"]) if self.kwargs["skills_loader"] else [],
            })
            history.append({"role": "user", "content": message})
            text = f"完成（{kind}）"
            if kind == "review":
                h = self.kwargs["tool_handlers"].get("submit_review")
                if h is not None and review_submits:
                    if seen["review_idx"] < len(score_plan):
                        s = score_plan[seen["review_idx"]]
                    else:
                        s = score_plan[-1]
                    seen["review_idx"] += 1
                    if s is None:
                        h(score=0, issues=["评审内部错误"])  # 提交但分数无效 → 不会发生；None 用于「未提交」场景见下
                    else:
                        h(score=s, passed=s >= 90, issues=["补来源"] if s < 90 else [],
                          summary="ok", checks=[{"name": "结构", "value": "齐全", "pass": True}])
                        text = "已提交评审"
                else:
                    text = "我觉得写得不错，大概 85 分吧。"   # 未调用 submit_review
            history.append({"role": "assistant", "content": text})

    class _FakeEmitter:
        def __init__(self, queue=None, context_window=0):
            self.tool_calls = []
            self.usages = ([{"input_tokens": usage_per_turn, "cache_read_input_tokens": 0,
                             "cache_creation_input_tokens": 0, "output_tokens": 0}] if usage_per_turn else [])
            self.error = None

        def get_full_text(self):
            return "完成"

        async def emit(self, event):
            pass

    monkeypatch.setattr("planify.streaming.runner.StreamingAgent", _FakeSA)
    monkeypatch.setattr("doclens.web_v2.api._chat_emitter.ChatEventEmitter", _FakeEmitter)
    monkeypatch.setattr(er, "persist_round", lambda *a, **k: SimpleNamespace(error=None))
    monkeypatch.setattr("planify.core.llm.trace.LLMTracer.create", lambda **k: None)
    monkeypatch.setattr("planify.streaming.waiter.get_global_waiter",
                        lambda: SimpleNamespace(interrupt_session=lambda s: None))
    # 内部 load_skill handler 依赖 access_state；桩掉
    monkeypatch.setattr(er, "_internal_load_skill_handler",
                        lambda loader_, runtime_: (lambda name: f"<skill>{name}</skill>"))

    artifact_dir = workdir / "周报" / "20260101-任务"
    artifact_dir.mkdir(parents=True, exist_ok=True)
    state = er.AssignmentState(
        session_id=session_id, employee_id="e1", employee_name="tom",
        artifact_dir=artifact_dir, started_at="now",
    )
    store.create(SessionSummary(id=session_id, type=SessionType.CHAT, title="t", preview="",
                                mode=er.SESSION_MODE, created_at=_now(), updated_at=_now()))
    return SimpleNamespace(store=store, state=state, artifact_dir=artifact_dir, workdir=workdir, seen=seen)


async def _run_loop(world, cfg, task="写周报"):
    brief = er.build_brief(task, world.artifact_dir, False, 90, "三节齐全", 3)
    world.store.ensure_message_user(world.state.session_id, brief)
    extra = er.build_system_extra("你是周报撰写员。", world.workdir, world.artifact_dir, ["work-a"])
    await er._loop(world.state, cfg, task, brief, extra)


def _events(store, sid, kind):
    return [json.loads(i.payload) for i in store.get_events(sid, kind)]


CFG = dict(model_preset_id="p-work", review_model_presets=[], thinking_depth="auto",
           score_threshold=90, max_iterations=3, review_criteria="三节齐全",
           tools_allow=[], tools_deny=[], skills_allow=["work-a"], review_skill="rev-a",
           token_budget=0, max_tool_rounds=0, review_tool_rounds=0)


# ---------------------------------------------------------------------------
# 1. 存储层
# ---------------------------------------------------------------------------


def _create_payload(**over):
    base = dict(name="tom", prompt="你是调研员。", model_preset_id="p1", artifact_root="调研",
                review_criteria="有来源", tools_allow=["read_file"], review_skill="rev-a")
    base.update(over)
    return EmployeeCreate(**base)


def test_store_create_get_list_roundtrip(tmp_path):
    _mk_internal_skills(tmp_path, "rev-a")
    created = es.create_employee(_create_payload())
    assert created["name"] == "tom" and created["id"]
    assert created["review_model_presets"] == [] and created["token_budget"] == 2_000_000
    assert es.get_employee(created["id"])["prompt"] == "你是调研员。"
    assert [e["name"] for e in es.list_employees()] == ["tom"]
    assert es.get_employee_by_name("tom")["id"] == created["id"]
    assert created["skills_missing"] == []


def test_store_name_unique_and_update(tmp_path):
    _mk_internal_skills(tmp_path, "rev-a")
    es.create_employee(_create_payload(name="tom"))
    with pytest.raises(es.EmployeeError) as ei:
        es.create_employee(_create_payload(name="  TOM "))
    assert ei.value.code == "NAME_CONFLICT"
    a = es.create_employee(_create_payload(name="a"))
    upd = es.update_employee(a["id"], EmployeeUpdate(review_model_presets=["p1", "p2"], token_budget=0).model_dump(exclude_unset=True))
    assert upd["review_model_presets"] == ["p1", "p2"] and upd["token_budget"] == 0
    with pytest.raises(es.EmployeeError):
        es.update_employee(a["id"], {"name": "tom"})
    with pytest.raises(es.EmployeeError):
        es.delete_employee("nope")


def test_store_model_and_skill_missing_derived(tmp_path, monkeypatch):
    from doclens.web_v2 import presets_store

    monkeypatch.setattr(presets_store, "list_presets", lambda kind=None: [{"id": "p1", "kind": "llm"}])
    _mk_internal_skills(tmp_path, "rev-a", "work-x")
    e = es.create_employee(_create_payload(model_preset_id="p1", review_model_presets=["p1", "gone"],
                                           skills_allow=["work-x", "ghost"]))
    assert e["model_missing"] is False and e["review_model_missing"] is True
    assert e["skills_missing"] == ["ghost"]
    e2 = es.create_employee(_create_payload(name="x", model_preset_id="nope", review_skill="nope"))
    assert e2["model_missing"] is True and e2["skills_missing"] == ["nope"]


# ---------------------------------------------------------------------------
# 2. 纯函数
# ---------------------------------------------------------------------------


def test_resolve_tools_allow_deny_forbidden():
    tools = [{"name": n} for n in ("read_file", "write_file", "bash", "task", "ask_user_question", "load_skill")]
    assert er.resolve_tools(tools, [], []) == ["read_file", "write_file", "bash", "load_skill"]
    assert er.resolve_tools(tools, ["read_file", "bash", "task"], []) == ["read_file", "bash"]
    assert er.resolve_tools(tools, [], ["bash", "load_skill"]) == ["read_file", "write_file"]
    assert "load_skill" not in er.FORBIDDEN_TOOLS


def test_assignment_dir_slug_and_collision(tmp_path):
    d1 = er.assignment_dir(tmp_path, "调研", "搜索最新的 agent 技术")
    assert d1.parent == tmp_path / "调研" and "-搜索最新的-agent-技术" in d1.name
    d1.mkdir(parents=True)
    assert er.assignment_dir(tmp_path, "调研", "搜索最新的 agent 技术").name.endswith("-2")
    assert er.slugify("a/b:c*?") == "a-b-c"


def test_build_brief_rework_review_order():
    brief = er.build_brief("写周报", Path("/k/a"), True, 90, "三节齐全", 5)
    assert brief.startswith("<assignment>") and brief.rstrip().endswith("写周报") and "模板拷贝" in brief
    ro = er.build_rework_order(er.ReviewResult(75, False, issues=["缺来源"], suggestions=["补案例"]), 90, Path("/k/a"))
    assert ro.startswith('<rework-order score="75" threshold="90">') and "1. 缺来源" in ro
    vo = er.build_review_order("rev-a", Path("/k/a"), "写周报", "三节齐全", 90)
    assert vo.startswith('<review-order skill="rev-a" threshold="90">')
    assert "load_skill" in vo and "submit_review" in vo and "三节齐全" in vo and "/k/a" in vo
    assert "工具调用上限" not in vo                       # 0 = 不明示
    vo2 = er.build_review_order("rev-a", Path("/k/a"), "写周报", "三节齐全", 90, tool_rounds=15)
    assert "最多 15 次工具调用" in vo2 and "抽查不是审计" in vo2
    assert er.build_budget_warning(850_000, 1_000_000).startswith("⚠️ 预算已用 85%")


def test_build_system_extra_names_work_skills():
    s = er.build_system_extra("你是周报撰写员。", Path("/k"), Path("/k/out/x"), ["work-a", "work-b"])
    assert "# Your role" in s and "`work-a`" in s and "`work-b`" in s and "只能写入产物目录" in s


def test_sum_usage_four_fields_unweighted():
    assert er.sum_usage([{"input_tokens": 10, "cache_read_input_tokens": 5,
                          "cache_creation_input_tokens": 2, "output_tokens": 3}]) == 20
    assert er.sum_usage([]) == 0 and er.sum_usage([{"junk": 1}, "x"]) == 0


def test_review_result_from_input():
    r = er._review_result_from_input({"score": 93.4, "issues": ["a", " "], "suggestions": ["s"],
                                      "checks": [{"name": "结构", "value": "齐全", "pass": True}, "bad"]}, 90)
    assert r.score == 93 and r.passed and r.issues == ["a"] and len(r.checks) == 1
    r2 = er._review_result_from_input({"score": 50, "issues": []}, 90)
    assert r2.passed is False
    with pytest.raises(ValueError):
        er._review_result_from_input({"score": "x", "issues": []}, 90)
    with pytest.raises(ValueError):
        er._review_result_from_input({"issues": []}, 90)


def test_skill_allowlist_handler():
    calls = []

    def orig(name):
        calls.append(name)
        return f"<skill>{name}</skill>"

    h = er.build_skill_allowlist_handler(orig, {"work-a", "rev-a"})
    assert h(name="work-a") == "<skill>work-a</skill>"
    out = h(name="evil")
    assert out.startswith("Error:") and "白名单" in out and "work-a" in out
    assert calls == ["work-a"]


def test_bind_write_boundary_file_and_shell(tmp_path):
    root = tmp_path / "kb" / "out" / "a"
    wd = tmp_path / "kb"
    root.mkdir(parents=True)
    calls = []

    def write_file(path, content):
        calls.append(path)
        return "written"

    h = er.bind_write_boundary({"write_file": write_file, "bash": lambda command: f"ran:{command}"}, root, wd)
    assert h["write_file"](path="out/a/x.md", content="x") == "written"
    assert "拒绝" in h["write_file"](path="out/x.md", content="x")
    assert "拒绝" in h["write_file"](path=str(wd / "z.md"), content="x")
    assert h["write_file"](str(root / "y.md"), "x") == "written"   # positional 首位是路径
    assert "拒绝" in h["bash"]("echo hi > 调研/x.md")
    assert h["bash"]("echo hi > out/a/ok.md").startswith("ran:")
    assert h["bash"]("python script.py").startswith("ran:")
    assert calls == ["out/a/x.md", str(root / "y.md")]


def test_tool_catalog_groups():
    cat = er.tool_catalog([{"name": "bash"}, {"name": "search_kb"}, {"name": "mcp__wordcraft__execute"},
                           {"name": "task"}, {"name": "read_file"}, {"name": "load_skill"}])
    by = {c["name"]: c for c in cat}
    assert by["bash"]["group"] == "builtin" and by["bash"]["writable"]
    assert by["search_kb"]["group"] == "kb"
    assert by["mcp__wordcraft__execute"]["server"] == "wordcraft"
    assert by["task"]["forbidden"] and not by["load_skill"]["forbidden"]


# ---------------------------------------------------------------------------
# 3. 循环状态机
# ---------------------------------------------------------------------------


def test_loop_passes_on_second_iteration(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[70, 95])
    asyncio.run(_run_loop(w, CFG))
    revs = _events(w.store, "sess-test", er.KIND_REVIEW)
    assert [r["score"] for r in revs] == [70, 95] and revs[1]["passed"] is True
    assert revs[0]["checks"] == [{"name": "结构", "value": "齐全", "pass": True}]
    end = _events(w.store, "sess-test", er.KIND_END)[0]
    assert end["outcome"] == er.OUTCOME_PASSED and end["score"] == 95 and end["iterations"] == 2
    # 回合序列：工作、评审、工作（返工）、评审
    assert [t["kind"] for t in w.seen["turns"]] == ["work", "review", "work", "review"]
    # 评审回合才有 submit_review；两类回合都有 load_skill；技能清单只列白名单
    for t in w.seen["turns"]:
        assert "load_skill" in t["tools"] and t["skills"] == ["rev-a", "work-a"]
        assert t["has_submit"] == (t["kind"] == "review")
    # 评审回合用独立上限，且强制终答时保留 submit_review（否则模型到上限无法交卷）
    w2 = _fake_world(tmp_path / "second", monkeypatch, score_plan=[95], usage_per_turn=0, session_id="sess-2")
    asyncio.run(_run_loop(w2, {**CFG, "max_tool_rounds": 40, "review_tool_rounds": 15}))
    rt = [t for t in w2.seen["turns"] if t["kind"] == "review"][0]
    wt = [t for t in w2.seen["turns"] if t["kind"] == "work"][0]
    assert rt["force_rounds"] == 15 and rt["keep_on_force"] == ("submit_review",)
    assert wt["force_rounds"] == 40 and wt["keep_on_force"] is None
    # 消息流：brief、评审指令、返工指令（评审指令以 user 消息落库）
    users = [json.loads(i.payload)["content"] for i in w.store.get_detail("sess-test") if i.kind == "message_user"]
    assert users[0].startswith("<assignment>") and users[1].startswith("<review-order") and users[2].startswith("<rework-order")
    assert er.is_assignment("sess-test") is False


def test_loop_exhausted(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[70, 80])
    asyncio.run(_run_loop(w, CFG))
    assert [r["score"] for r in _events(w.store, "sess-test", er.KIND_REVIEW)] == [70, 80, 80]
    end = _events(w.store, "sess-test", er.KIND_END)[0]
    assert end["outcome"] == er.OUTCOME_EXHAUSTED and end["score"] == 80 and end["iterations"] == 3


def test_loop_review_failed_when_not_submitted(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[95], review_submits=False)
    asyncio.run(_run_loop(w, CFG))
    revs = _events(w.store, "sess-test", er.KIND_REVIEW)
    assert revs[-1]["kind"] == "failed" and "未调用 submit_review" in revs[-1]["error"]
    assert _events(w.store, "sess-test", er.KIND_END)[0]["outcome"] == er.OUTCOME_REVIEW_FAILED
    assert len(w.seen["turns"]) == 2   # 工作一次、评审一次即止


def test_loop_budget_exhausted(tmp_path, monkeypatch):
    # 每回合 1000 token，预算 1500 → 工作(1000) + 评审(2000) ≥ 1500 → 评审后预算耗尽
    w = _fake_world(tmp_path, monkeypatch, score_plan=[70], usage_per_turn=1000)
    asyncio.run(_run_loop(w, {**CFG, "token_budget": 1500}))
    end = _events(w.store, "sess-test", er.KIND_END)[0]
    assert end["outcome"] == er.OUTCOME_BUDGET and end["tokens_spent"] == 2000 and end["token_budget"] == 1500
    assert len(w.seen["turns"]) == 2


def test_loop_budget_warning_prefix_on_rework(tmp_path, monkeypatch):
    # 每回合 300，预算 1000：工作(300)+评审(600) 后 60%<80% → 返工无预警；第二轮后 1200 ≥ 1000 终止。
    # 改为预算 2000：第一轮后 600/2000=30%；第二轮后 1200/2000=60%… 需第三轮 1800/2000=90% 才预警——
    # 用 max_iterations=4 让第四轮工作前触发预警（此时 spent=2400 ≥ 80%*2000=1600）。
    w = _fake_world(tmp_path, monkeypatch, score_plan=[70], usage_per_turn=300)
    asyncio.run(_run_loop(w, {**CFG, "token_budget": 2000, "max_iterations": 4}))
    # 2000 预算在第三轮评审后（1800）未超、第四轮工作后（2100）超 → 第四轮工作消息应带预警
    users = [json.loads(i.payload)["content"] for i in w.store.get_detail("sess-test") if i.kind == "message_user"]
    reworks = [u for u in users if u.startswith("<rework-order") or u.startswith("⚠️")]
    assert any(u.startswith("⚠️ 预算已用") for u in reworks), reworks
    end = _events(w.store, "sess-test", er.KIND_END)[0]
    assert end["outcome"] == er.OUTCOME_BUDGET


def test_loop_stopped_by_user(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[70])

    async def _go():
        brief = er.build_brief("写周报", w.artifact_dir, False, 90, "三节齐全", 3)
        w.store.ensure_message_user(w.state.session_id, brief)
        extra = er.build_system_extra("x", w.workdir, w.artifact_dir, [])
        task = asyncio.create_task(er._loop(w.state, CFG, "写周报", brief, extra))
        await asyncio.sleep(0.002)
        w.state.interrupt.set()
        w.state.stop_requested = True
        await task

    asyncio.run(_go())
    assert _events(w.store, "sess-test", er.KIND_END)[0]["outcome"] == er.OUTCOME_STOPPED


def test_loop_review_preset_list_used_in_review_turn(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[95])
    asyncio.run(_run_loop(w, {**CFG, "review_model_presets": ["p-review"]}))
    kinds = {t["kind"]: t["model"] for t in w.seen["turns"]}
    assert kinds["work"] == "m-p-work" and kinds["review"] == "m-p-review"


def test_mark_interrupted_on_startup(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[95])
    _now_ = _now()
    w.store.create(SessionSummary(id="sess-other", type=SessionType.CHAT, title="t", preview="",
                                  mode=er.SESSION_MODE, created_at=_now_, updated_at=_now_))
    w.store.append_event("sess-test", er.KIND_START, {"employee_id": "e1", "employee_name": "tom"})
    w.store.append_event("sess-other", er.KIND_START, {"employee_id": "e2"})
    w.store.append_event("sess-other", er.KIND_END, {"outcome": "passed"})
    assert er.mark_interrupted_on_startup() == 1
    end = _events(w.store, "sess-test", er.KIND_END)[0]
    assert end["outcome"] == er.OUTCOME_INTERRUPTED and end["employee_id"] == "e1"
    assert er.mark_interrupted_on_startup() == 0


def test_dispatch_rejects_missing_internal_skill(tmp_path, monkeypatch):
    w = _fake_world(tmp_path, monkeypatch, score_plan=[95])
    with pytest.raises(er.DispatchError) as ei:
        er.dispatch(_emp(skills_allow=["work-a", "ghost"]), "写周报")
    assert ei.value.code == "SKILL_MISSING" and "ghost" in str(ei.value)
    with pytest.raises(er.DispatchError):
        er.dispatch(_emp(review_skill=""), "写周报")


def test_sessions_store_append_event_and_open(tmp_path):
    store = _store(tmp_path)
    sid = store.new_session_id()
    store.create(SessionSummary(id=sid, type=SessionType.CHAT, title="t", preview="", mode=er.SESSION_MODE,
                                created_at=_now(), updated_at=_now()))
    store.append_event(sid, er.KIND_START, {"a": 1})
    store.ensure_message_user(sid, "hi")
    assert store.append_event(sid, er.KIND_REVIEW, {"b": 2}) == 2
    assert [i.kind for i in store.get_events(sid, er.KIND_REVIEW)] == [er.KIND_REVIEW]
    assert store.sessions_with_open_event(er.KIND_START, er.KIND_END) == [sid]
    store.append_event(sid, er.KIND_END, {"outcome": "passed"})
    assert store.sessions_with_open_event(er.KIND_START, er.KIND_END) == []
    assert [m["role"] for m in store.get_chat_history(sid)] == ["user"]
