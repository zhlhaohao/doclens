"""数字员工存储层（ADR-0062/0063）。

机器级单层 JSON ``~/.doclens/digital_employees.json``（开发 ``~/.cortex/``），
与模型预设、MCP 配置同位；**不含密钥**（模型只存预设引用），不参与知识库
Git 同步，不随知识库切换而变。出厂为空、不预置。

线程安全：文件读写经进程内锁串行化；写采用临时文件 + ``os.replace`` 原子替换。
"""
import json
import os
import threading
import uuid
from datetime import datetime
from typing import Optional

from doclens.config import get_global_cortex_dir
from doclens.web_v2.models.employee import (
    DEFAULT_TOOL_ALLOWLIST,
    EmployeeBase,
    EmployeeCreate,
)

_LOCK = threading.Lock()
_SCHEMA_VERSION = 1

# 持久化字段白名单（= EmployeeBase 的字段）
_FIELDS = tuple(EmployeeBase.model_fields.keys())


class EmployeeError(Exception):
    """员工操作错误（名称冲突、未找到、进行中不可删等），由 API 层映射为 4xx。"""

    def __init__(self, msg: str, *, code: str = "EMPLOYEE_ERROR", extra: Optional[dict] = None):
        super().__init__(msg)
        self.code = code
        self.extra = extra or {}


def _path():
    return get_global_cortex_dir() / _FILENAME


def _empty() -> dict:
    return {"version": _SCHEMA_VERSION, "employees": []}


def _load() -> dict:
    p = _path()
    if not p.exists():
        return _empty()
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _empty()
    if not isinstance(data, dict) or not isinstance(data.get("employees"), list):
        return _empty()
    return data


def _save(data: dict) -> None:
    p = _path()
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, p)


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _new_id() -> str:
    return uuid.uuid4().hex[:12]


def _normalize_name(name: str) -> str:
    """员工名归一（唯一性比较口径）：去首尾空白 + casefold（大小写不敏感）。"""
    return name.strip().casefold()


def _llm_preset_ids() -> set[str]:
    try:
        from doclens.web_v2 import presets_store

        return {p["id"] for p in presets_store.list_presets(kind="llm")}
    except Exception:  # noqa: BLE001
        return set()


_FILENAME = "digital_employees.json"
#: 内部技能库目录名（与员工库同位；ADR-0065 内部技能）
INTERNAL_SKILLS_DIRNAME = "employee_skills"


def internal_skills_dir():
    """内部技能库路径（机器级，与员工库同位）。不存在时返回路径但不创建。"""
    return get_global_cortex_dir() / INTERNAL_SKILLS_DIRNAME


def internal_skill_names() -> set[str]:
    """内部技能库里全部技能名（按 ``<技能名>/SKILL.md`` 一层发现）。"""
    root = internal_skills_dir()
    if not root.exists():
        return set()
    return {p.parent.name for p in root.glob("*/SKILL.md")}


def _decorate(emp: dict) -> dict:
    """补派生字段（预设缺失 / 内部技能缺失标记），去除非模型字段。"""
    out = {k: emp.get(k) for k in ("id", "name", "created_at", "updated_at", *_FIELDS)}
    llm_ids = _llm_preset_ids()
    out["model_missing"] = out.get("model_preset_id") not in llm_ids
    review_list = out.get("review_model_presets") or []
    out["review_model_missing"] = any(pid not in llm_ids for pid in review_list)
    if out.get("tools_allow") is None:
        out["tools_allow"] = list(DEFAULT_TOOL_ALLOWLIST)
    if out.get("tools_deny") is None:
        out["tools_deny"] = []
    if out.get("skills_allow") is None:
        out["skills_allow"] = []
    if out.get("review_model_presets") is None:
        out["review_model_presets"] = []
    names = internal_skill_names()
    missing = [n for n in (out.get("skills_allow") or []) if n not in names]
    if out.get("review_skill") and out["review_skill"] not in names:
        missing.append(out["review_skill"])
    out["skills_missing"] = missing
    return out


# ---------------------------------------------------------------------------
# 公共 API
# ---------------------------------------------------------------------------


def list_employees() -> list[dict]:
    with _LOCK:
        data = _load()
    return [_decorate(e) for e in data["employees"]]


def get_employee(emp_id: str) -> Optional[dict]:
    with _LOCK:
        data = _load()
    for e in data["employees"]:
        if e.get("id") == emp_id:
            return _decorate(e)
    return None


def get_employee_by_name(name: str) -> Optional[dict]:
    key = _normalize_name(name)
    with _LOCK:
        data = _load()
    for e in data["employees"]:
        if _normalize_name(e.get("name", "")) == key:
            return _decorate(e)
    return None


def create_employee(payload: EmployeeCreate) -> dict:
    name = _normalize_name(payload.name)
    with _LOCK:
        data = _load()
        if any(_normalize_name(e.get("name", "")) == name for e in data["employees"]):
            raise EmployeeError(f"员工名已存在：{name}", code="NAME_CONFLICT")
        now = _now()
        emp = {"id": _new_id(), "name": name, "created_at": now, "updated_at": now}
        for f in _FIELDS:
            v = getattr(payload, f)
            emp[f] = list(v) if isinstance(v, list) else v
        data["employees"].append(emp)
        _save(data)
    return _decorate(emp)


def update_employee(emp_id: str, updates: dict) -> dict:
    """updates = 已通过 Pydantic 校验的「仅要改的字段」字典（exclude_unset）。"""
    with _LOCK:
        data = _load()
        target = next((e for e in data["employees"] if e.get("id") == emp_id), None)
        if target is None:
            raise EmployeeError("员工不存在", code="NOT_FOUND")
        if "name" in updates:
            new_name = _normalize_name(updates["name"])
            if any(
                _normalize_name(e.get("name", "")) == new_name and e is not target
                for e in data["employees"]
            ):
                raise EmployeeError(f"员工名已存在：{new_name}", code="NAME_CONFLICT")
            updates = {**updates, "name": new_name}
        for k, v in updates.items():
            if k in _FIELDS or k == "name":
                target[k] = list(v) if isinstance(v, list) else v
        target["updated_at"] = _now()
        _save(data)
    return _decorate(target)


def delete_employee(emp_id: str) -> bool:
    with _LOCK:
        data = _load()
        before = len(data["employees"])
        data["employees"] = [e for e in data["employees"] if e.get("id") != emp_id]
        if len(data["employees"]) == before:
            raise EmployeeError("员工不存在", code="NOT_FOUND")
        _save(data)
    return True
