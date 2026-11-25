"""数字员工 API（ADR-0062/0063）。

- CRUD：``/api/employees``
- 工具 / 技能目录：``/api/employees/tools``、``/api/employees/skills``（表单勾选用）
- 派活：``POST /api/employees/{id}/dispatch``（新建独立会话并启动后台循环）
- 进行中的派活：``GET /api/employees/{id}/running``
- 停止复用既有 ``POST /api/chat/stop``（派活会话经 chat_runner 登记）。
"""

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from doclens.web_v2 import employees_store
from doclens.web_v2.api.errors import CortexAPIError
from doclens.web_v2.models.employee import (
    DeletionBlockedResponse,
    Employee,
    EmployeeCreate,
    EmployeeDispatchRequest,
    EmployeeDispatchResponse,
    EmployeeListResponse,
    EmployeeRunInfo,
    EmployeeStopResponse,
    EmployeeUpdate,
    SkillCatalogItem,
    SkillCatalogResponse,
    ToolCatalogItem,
    ToolCatalogResponse,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _status_for(code: str) -> int:
    return {
        "NOT_FOUND": 404,
        "NAME_CONFLICT": 409,
    }.get(code, 400)


@router.get("/employees", response_model=EmployeeListResponse)
async def list_employees():
    return EmployeeListResponse(employees=[Employee(**e) for e in employees_store.list_employees()])


# 静态路径须注册在 /employees/{emp_id} 之前
@router.get("/employees/tools", response_model=ToolCatalogResponse)
async def tools_catalog():
    """当前实际注册的全部工具（含 MCP），分组 + 可写 + 禁用标记。"""
    from doclens.web_v2 import employee_runner
    from doclens.web_v2.deps import get_agent

    return ToolCatalogResponse(
        tools=[ToolCatalogItem(**t) for t in employee_runner.tool_catalog(get_agent().runtime.tools)]
    )


@router.get("/employees/skills", response_model=SkillCatalogResponse)
async def skills_catalog():
    """可用技能目录（名字 + 描述）。深读技能（_bookskill_ 前缀）不列。"""
    from doclens.web_v2.deps import get_agent

    loader = get_agent().runtime.skills
    items: list[SkillCatalogItem] = []
    for name, meta in sorted((getattr(loader, "skills", {}) or {}).items()):
        if name.startswith("_bookskill_"):
            continue
        desc = str(meta.get("description", "") or "").strip()
        items.append(SkillCatalogItem(name=name, description=desc[:300]))
    return SkillCatalogResponse(skills=items)


@router.post("/employees", response_model=Employee, status_code=201)
async def create_employee(req: EmployeeCreate):
    try:
        created = employees_store.create_employee(req)
    except employees_store.EmployeeError as e:
        raise CortexAPIError(_status_for(e.code), e.code, str(e))
    return Employee(**created)


@router.get("/employees/{emp_id}", response_model=Employee)
async def get_employee(emp_id: str):
    emp = employees_store.get_employee(emp_id)
    if emp is None:
        raise CortexAPIError(404, "NOT_FOUND", f"员工不存在: {emp_id}")
    return Employee(**emp)


@router.put("/employees/{emp_id}", response_model=Employee)
async def update_employee(emp_id: str, req: EmployeeUpdate):
    try:
        updated = employees_store.update_employee(emp_id, req.model_dump(exclude_unset=True))
    except employees_store.EmployeeError as e:
        raise CortexAPIError(_status_for(e.code), e.code, str(e))
    return Employee(**updated)


@router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str):
    from doclens.web_v2 import employee_runner

    run = employee_runner.running_for(emp_id)
    if run is not None:
        return JSONResponse(
            status_code=409,
            content=DeletionBlockedResponse(
                detail="该员工有进行中的派活，请先停止再删除",
                run=EmployeeRunInfo(session_id=run.session_id, started_at=run.started_at,
                                    iteration=run.iteration),
            ).model_dump(),
        )
    try:
        employees_store.delete_employee(emp_id)
    except employees_store.EmployeeError as e:
        raise CortexAPIError(_status_for(e.code), e.code, str(e))
    return {"ok": True}


@router.get("/employees/{emp_id}/running", response_model=EmployeeRunInfo)
async def running_assignment(emp_id: str):
    from doclens.web_v2 import employee_runner

    run = employee_runner.running_for(emp_id)
    if run is None:
        return JSONResponse(status_code=204, content=None)
    return EmployeeRunInfo(session_id=run.session_id, started_at=run.started_at, iteration=run.iteration)


@router.post("/employees/{emp_id}/dispatch", response_model=EmployeeDispatchResponse, status_code=202)
async def dispatch_employee(emp_id: str, req: EmployeeDispatchRequest):
    from doclens.web_v2 import employee_runner

    emp = employees_store.get_employee(emp_id)
    if emp is None:
        raise CortexAPIError(404, "NOT_FOUND", f"员工不存在: {emp_id}")
    if emp.get("model_missing"):
        raise CortexAPIError(400, "MODEL_MISSING", "工作模型预设缺失，请先在员工设置里改配")
    if emp.get("review_model_missing"):
        raise CortexAPIError(400, "MODEL_MISSING", "评审模型预设缺失，请先在员工设置里改配")
    try:
        res = employee_runner.dispatch(emp, req.task)
    except employee_runner.DispatchError as e:
        raise CortexAPIError(e.status, e.code, str(e))
    return EmployeeDispatchResponse(
        session_id=res["session_id"], employee_id=emp_id, artifact_dir=res["artifact_dir"],
    )


@router.post("/employees/{emp_id}/stop", response_model=EmployeeStopResponse)
async def stop_employee(emp_id: str):
    """按员工停止（前端也可直接用 /chat/stop 按会话停）。"""
    from doclens.web_v2 import employee_runner

    run = employee_runner.running_for(emp_id)
    if run is None:
        return EmployeeStopResponse(stopped=False)
    employee_runner.stop(run.session_id)
    return EmployeeStopResponse(stopped=True, session_id=run.session_id)
