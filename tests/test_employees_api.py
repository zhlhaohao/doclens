"""数字员工 API 层（路由函数直调 + 桩注入，不起 TestClient——对齐 test_manual_compact_api 先例）。

覆盖：CRUD 映射（201/404/409）、工具/技能目录、派活的前置校验（404/400/409）、
删除被进行中派活阻止、停止。
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.responses import JSONResponse

from doclens.web_v2 import employee_runner as er
from doclens.web_v2 import employees_store as es
from doclens.web_v2.api import employees as api
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.models.employee import (
    EmployeeCreate,
    EmployeeDispatchRequest,
    EmployeeUpdate,
)


@pytest.fixture(autouse=True)
def _isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(es, "get_global_cortex_dir", lambda: Path(tmp_path) / "global")
    d = Path(tmp_path) / "global" / "employee_skills" / "rev-a"
    d.mkdir(parents=True)
    (d / "SKILL.md").write_text(
        "---\nname: rev-a\ndescription: 评审技能\n---\n", encoding="utf-8",
    )
    er._active.clear()
    yield
    er._active.clear()


def _req(**over):
    base = dict(name="tom", prompt="调研", model_preset_id="p1", artifact_root="调研", review_criteria="有来源",
                review_skill="rev-a")
    base.update(over)
    return EmployeeCreate(**base)


async def _call(coro):
    return await coro


def test_crud_mapping(monkeypatch):
    monkeypatch.setattr(er, "_preset_or_none", lambda pid: {"x": 1} if pid == "p1" else None)
    monkeypatch.setattr("doclens.web_v2.presets_store.list_presets",
                        lambda kind=None: [{"id": "p1", "kind": "llm"}])
    created = asyncio.run(api.create_employee(_req()))
    assert created.name == "tom" and created.model_missing is False

    got = asyncio.run(api.get_employee(created.id))
    assert got.id == created.id

    upd = asyncio.run(api.update_employee(created.id, EmployeeUpdate(score_threshold=80)))
    assert upd.score_threshold == 80

    asyncio.run(api.create_employee(_req(name="alice")))
    with pytest.raises(CortexAPIError) as ei:
        asyncio.run(api.create_employee(_req(name="TOM")))
    assert ei.value.status == 409 and ei.value.code == "NAME_CONFLICT"

    with pytest.raises(CortexAPIError) as ei2:
        asyncio.run(api.get_employee("nope"))
    assert ei2.value.status == 404

    assert asyncio.run(api.delete_employee(created.id)) == {"ok": True}
    with pytest.raises(CortexAPIError) as ei3:
        asyncio.run(api.delete_employee(created.id))
    assert ei3.value.status == 404


def test_catalogs(monkeypatch, tmp_path):
    runtime = SimpleNamespace(
        tools=[{"name": "bash"}, {"name": "search_kb"}, {"name": "mcp__wordcraft__execute"}, {"name": "task"}],
    )
    monkeypatch.setattr("doclens.web_v2.deps.get_agent", lambda: SimpleNamespace(runtime=runtime))
    monkeypatch.setattr(es, "get_global_cortex_dir", lambda: Path(tmp_path) / "cat")
    for n in ("alpha", "beta"):
        d = Path(tmp_path) / "cat" / "employee_skills" / n
        d.mkdir(parents=True)
        (d / "SKILL.md").write_text(
            f"---\nname: {n}\ndescription: {n} 技能\n---\n", encoding="utf-8",
        )
    tools = asyncio.run(api.tools_catalog())
    by = {t.name: t for t in tools.tools}
    assert by["bash"].group == "builtin" and by["search_kb"].group == "kb"
    assert by["mcp__wordcraft__execute"].server == "wordcraft" and by["task"].forbidden
    skills = asyncio.run(api.skills_catalog())   # 读内部技能库，不再是公开技能
    assert [s.name for s in skills.skills] == ["alpha", "beta"]
    assert skills.skills[0].description == "alpha 技能"


def test_dispatch_validation(monkeypatch):
    created = asyncio.run(api.create_employee(_req(model_preset_id="missing")))
    # model_missing 由 store 派生（无预设）→ 400
    with pytest.raises(CortexAPIError) as ei:
        asyncio.run(api.dispatch_employee(created.id, EmployeeDispatchRequest(task="写报告")))
    assert ei.value.status == 400 and ei.value.code == "MODEL_MISSING"

    with pytest.raises(CortexAPIError) as ei2:
        asyncio.run(api.dispatch_employee("nope", EmployeeDispatchRequest(task="x")))
    assert ei2.value.status == 404


def test_dispatch_delegates_and_maps_busy(monkeypatch):
    monkeypatch.setattr("doclens.web_v2.presets_store.list_presets",
                        lambda kind=None: [{"id": "p1", "kind": "llm"}])
    created = asyncio.run(api.create_employee(_req()))
    captured = {}

    def fake_dispatch(emp, task):
        captured["emp"], captured["task"] = emp, task
        return {"session_id": "s1", "artifact_dir": "调研/x"}

    monkeypatch.setattr(er, "dispatch", fake_dispatch)
    res = asyncio.run(api.dispatch_employee(created.id, EmployeeDispatchRequest(task="写报告")))
    assert res.session_id == "s1" and res.employee_id == created.id and res.artifact_dir == "调研/x"
    assert captured["emp"]["id"] == created.id and captured["task"] == "写报告"

    def busy(emp, task):
        raise er.DispatchError("有进行中的派活", "EMPLOYEE_BUSY", 409)

    monkeypatch.setattr(er, "dispatch", busy)
    with pytest.raises(CortexAPIError) as ei:
        asyncio.run(api.dispatch_employee(created.id, EmployeeDispatchRequest(task="再来")))
    assert ei.value.status == 409 and ei.value.code == "EMPLOYEE_BUSY"


def test_delete_blocked_and_stop_when_running(monkeypatch):
    monkeypatch.setattr("doclens.web_v2.presets_store.list_presets",
                        lambda kind=None: [{"id": "p1", "kind": "llm"}])
    created = asyncio.run(api.create_employee(_req()))
    st = er.AssignmentState(session_id="s-run", employee_id=created.id, employee_name="tom",
                            artifact_dir=Path("/k/a"), started_at="now", iteration=2)
    er._active["s-run"] = st

    res = asyncio.run(api.delete_employee(created.id))
    assert isinstance(res, JSONResponse) and res.status_code == 409
    body = json.loads(res.body)
    assert body["run"]["session_id"] == "s-run" and body["run"]["iteration"] == 2
    assert es.get_employee(created.id) is not None   # 未删

    run = asyncio.run(api.running_assignment(created.id))
    assert run.session_id == "s-run" and run.iteration == 2

    stopped = []
    monkeypatch.setattr(er, "stop", lambda sid: stopped.append(sid) or True)
    assert asyncio.run(api.stop_employee(created.id)).stopped is True
    assert stopped == ["s-run"]

    er._active.clear()
    assert asyncio.run(api.stop_employee(created.id)).stopped is False
    r204 = asyncio.run(api.running_assignment(created.id))
    assert isinstance(r204, JSONResponse) and r204.status_code == 204
