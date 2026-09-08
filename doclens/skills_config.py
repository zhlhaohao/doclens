"""技能配置 sidecar 存储（ADR-0015）。

机器级单层 JSON 文件 ``~/.cortex/skills_config.json``（发行版 ``~/.doclens/``）。
以技能名为键存全部**可变状态**的稀疏覆盖：``enabled`` / ``context_menu`` /
``accept_dirs`` / ``deleted`` / ``source_url``。SKILL.md 永不被运行时改写，
故内置技能的「启动强制覆盖部署」与用户设置零冲突。

有效值合并规则：``sidecar 覆盖值 ?? 内置默认表 ?? false``（enabled 默认 true）。
内置默认存于本模块常量表（随发行版演进），sidecar 只存用户显式设置。

线程安全：文件读写经进程内锁串行化；写采用临时文件 + ``os.replace`` 原子替换。
不可变风格：更新走「重建 dict 再整体落盘」，不就地 mutation。
"""
import json
import os
import threading
from pathlib import Path
from typing import Any, Optional

from doclens.config import get_global_cortex_dir

_LOCK = threading.Lock()
_FILENAME = "skills_config.json"
_SCHEMA_VERSION = 1

# 可变字段白名单（稀疏存储：只存显式设置的键）
_FIELDS = ("enabled", "context_menu", "accept_dirs", "deleted", "source_url")

# 内置技能的出厂默认（context_menu / accept_dirs 已退出 frontmatter，ADR-0015）。
# 有效值 = sidecar 覆盖 ?? 本表 ?? false。键 = 技能名（SKILL.md 的 name 字段）。
BUILTIN_SKILL_DEFAULTS: dict[str, dict[str, bool]] = {
    "knowledge-base": {"context_menu": True, "accept_dirs": True},
    "summarize-files": {"context_menu": True},
}


class SkillsConfigError(Exception):
    """配置操作错误（技能不存在、内置同名冲突等），由 API 层映射为 4xx。"""


def _config_path() -> Path:
    return get_global_cortex_dir() / _FILENAME


def builtin_skill_names() -> set[str]:
    """内置技能名集合（发行包 doclens/skills/ 下各 SKILL.md 的 meta name）。

    注意目录名与技能名可能不一致（如目录 knowledge_base / 技能名 knowledge-base），
    一律以 meta name 为准——SkillLoader 与 sidecar 的键都是 meta name。
    """
    pkg_skills = Path(__file__).parent / "skills"
    if not pkg_skills.is_dir():
        return set()
    from planify.skills.skill_loader import SkillLoader

    return set(SkillLoader(pkg_skills).skills.keys())


def builtin_skill_meta() -> dict[str, dict]:
    """内置技能 meta 表（name → frontmatter dict），供已删除内置技能的展示。"""
    pkg_skills = Path(__file__).parent / "skills"
    if not pkg_skills.is_dir():
        return {}
    from planify.skills.skill_loader import SkillLoader

    return {n: s["meta"] for n, s in SkillLoader(pkg_skills).skills.items()}


def _empty_data() -> dict:
    return {"version": _SCHEMA_VERSION, "skills": {}}


def _load_raw() -> dict:
    """读取原始 JSON。文件缺失或损坏时返回空结构（不抛错）。"""
    path = _config_path()
    if not path.exists():
        return _empty_data()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _empty_data()
    if not isinstance(data, dict) or not isinstance(data.get("skills"), dict):
        return _empty_data()
    return data


def _save_raw(data: dict) -> None:
    """原子写：临时文件 + os.replace。"""
    path = _config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(tmp, path)


def get_override(name: str) -> dict:
    """单条稀疏覆盖（未设置时返回空 dict）。"""
    with _LOCK:
        return {**_load_raw()["skills"].get(name, {})}


def get_all_overrides() -> dict[str, dict]:
    """全部覆盖快照（name → 稀疏字段 dict）。"""
    with _LOCK:
        return {k: {**v} for k, v in _load_raw()["skills"].items()}


def effective_state(name: str) -> dict:
    """合并后的有效状态：sidecar 覆盖 ?? 内置默认 ?? 缺省。

    Returns:
        {enabled, context_menu, accept_dirs, deleted, source_url}
    """
    ov = get_override(name)
    defaults = BUILTIN_SKILL_DEFAULTS.get(name, {})
    return {
        "enabled": bool(ov.get("enabled", True)),
        "context_menu": bool(ov.get("context_menu", defaults.get("context_menu", False))),
        "accept_dirs": bool(ov.get("accept_dirs", defaults.get("accept_dirs", False))),
        "deleted": bool(ov.get("deleted", False)),
        "source_url": ov.get("source_url"),
    }


def update_skill(name: str, fields: dict[str, Any]) -> dict:
    """稀疏更新单条覆盖：值为 None 表示移除该键（回落默认）；条目变空则整条移除。

    Returns:
        更新后的有效状态（effective_state）。
    """
    name = str(name).strip()
    if not name:
        raise SkillsConfigError("技能名不能为空")
    bad = set(fields) - set(_FIELDS)
    if bad:
        raise SkillsConfigError(f"未知字段: {', '.join(sorted(bad))}")
    with _LOCK:
        data = _load_raw()
        entry = {**data["skills"].get(name, {})}
        for k, v in fields.items():
            if v is None:
                entry.pop(k, None)
            else:
                entry[k] = v
        new_skills = {**data["skills"]}
        if entry:
            new_skills[name] = entry
        else:
            new_skills.pop(name, None)
        _save_raw({**data, "skills": new_skills})
    return effective_state(name)


def remove_entry(name: str) -> None:
    """整条移除覆盖（外部技能真删时调用）。"""
    with _LOCK:
        data = _load_raw()
        if name not in data["skills"]:
            return
        new_skills = {k: v for k, v in data["skills"].items() if k != name}
        _save_raw({**data, "skills": new_skills})


def disabled_names(names) -> set[str]:
    """给定技能名集合，返回其中「停用或已删除」的子集（供 SkillLoader 路由隔断）。"""
    with _LOCK:
        overrides = _load_raw()["skills"]
    result = set()
    for n in names:
        ov = overrides.get(n, {})
        if ov.get("deleted", False) or not ov.get("enabled", True):
            result.add(n)
    return result


def deleted_names() -> set[str]:
    """全部标记 deleted 的技能名（部署步骤跳过 + 管理列表灰置呈现）。"""
    with _LOCK:
        overrides = _load_raw()["skills"]
    return {n for n, ov in overrides.items() if ov.get("deleted", False)}
