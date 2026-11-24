"""内置角色加载（ADR-0058 §3/§5，spike 版）。

角色 = 用户授予的权限包：persona + 可用工具边界 + 技能清单。**严格内置、唯一
来源**——无用户覆盖层、无 lead 临时自写逃生口。role JSON 随 planify 包分发于
``planify/roles/<id>/role.json``。

spike 范围：加载 + 权限裁剪；``model``/``thinking_level`` 只解析不生效；UI 资产
原样保留备用；``skills`` 清单返回但本 spike 不加载 SKILL.md。
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("planify.team.roles")

ROLES_DIR = Path(__file__).resolve().parent.parent / "roles"

#: Bot 强制注入的通信+任务+记忆 6 件（ADR-0058 §8；0059 落地再 +group_plan_status/task_report）
FORCED_BOT_TOOLS = frozenset({
    "send_message", "read_inbox", "idle", "claim_task", "task_update", "write_file",
})


class RoleError(Exception):
    """角色不存在或格式非法。"""


@dataclass
class Role:
    id: str
    version: int
    name: Dict[str, str]
    description: Dict[str, str]
    persona: Dict[str, str]
    norms: Dict[str, str]
    tools: List[str] = field(default_factory=list)
    forbid: List[str] = field(default_factory=list)
    skills: List[str] = field(default_factory=list)
    model: Optional[str] = None
    thinking_level: Optional[str] = None
    ui: Dict[str, Any] = field(default_factory=dict)
    lang: str = "zh"

    def text(self, d: Dict[str, str]) -> str:
        """双语字段按 lang 取，缺则回退另一语言。"""
        v = d.get(self.lang)
        if v:
            return v
        for fallback in ("zh", "en"):
            if d.get(fallback):
                return d[fallback]
        return ""

    def allowed_tools(self, all_tools: List[str]) -> List[str]:
        """实际工具表 = (tools ∩ all) − forbid ∪ FORCED。"""
        picked = {t for t in self.tools if t in all_tools}
        picked -= set(self.forbid)
        picked |= FORCED_BOT_TOOLS & set(all_tools)
        return [t for t in all_tools if t in picked]

    # ------------------------------------------------------------ 角色技能

    def skills_root(self) -> Path:
        return ROLES_DIR / self.id / "skills"

    def skill_md(self, name: str) -> Optional[Path]:
        """角色技能 SKILL.md 路径（按 lang，缺则回退另一语言）。技能须在 role.skills 清单内。"""
        if name not in self.skills:
            return None
        root = self.skills_root() / name
        for lang in (self.lang, "zh", "en"):
            p = root / lang / "SKILL.md"
            if p.exists():
                return p
        return None

    @staticmethod
    def _split_frontmatter(text: str) -> tuple:
        import re as _re
        m = _re.match(r"^---\n(.*?)\n---\n?(.*)$", text, _re.S)
        return (m.group(1), m.group(2)) if m else ("", text)

    def load_skill(self, name: str) -> str:
        """Bot 的 load_skill：返回角色技能正文（含 Base directory 头）。"""
        p = self.skill_md(name)
        if not p:
            avail = ", ".join(self.skills) or "(none)"
            return f"Error: role '{self.id}' has no skill '{name}'. Available: {avail}"
        text = p.read_text(encoding="utf-8")
        _, body = self._split_frontmatter(text)
        return f"Base directory for this skill: {p.parent}\n\n<skill name=\"{name}\">\n{body}\n</skill>"

    def skill_contract(self, name: str) -> Optional[Dict[str, Any]]:
        """角色技能契约（SKILL.md frontmatter metadata.contract）。无则 None。"""
        p = self.skill_md(name)
        if not p:
            return None
        fm, _ = self._split_frontmatter(p.read_text(encoding="utf-8"))
        # frontmatter 是 YAML；contract 以 `  contract: {...json...}` 形式内嵌
        import re as _re
        m = _re.search(r"^\s+contract:\s*(\{.*\})\s*$", fm, _re.M)
        if not m:
            return None
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            return None

    def system_prompt(self, bot_name: str, workdir: Path) -> str:
        skills_line = "\n".join(f"- {s}" for s in self.skills) if self.skills else "(none)"
        return (
            f"You are '{bot_name}', role: {self.id} v{self.version}, working at {workdir}.\n\n"
            f"{self.text(self.persona)}\n\n"
            f"Working norms:\n{self.text(self.norms)}\n\n"
            f"Your role's skills (load with load_skill(name) when the task matches):\n{skills_line}\n\n"
            "Report completion through task_update; the program verifies acceptance, not you. "
            "Use idle when done with current work."
        )


def _load_one(roles_dir: Path, role_id: str) -> Role:
    p = roles_dir / role_id / "role.json"
    if not p.exists():
        raise RoleError(f"Unknown role '{role_id}'")
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise RoleError(f"Role '{role_id}' is corrupted: {e}") from e
    perms = raw.get("permissions", {})
    return Role(
        id=raw["id"],
        version=int(raw.get("version", 1)),
        name=raw.get("name", {}),
        description=raw.get("description", {}),
        persona=raw.get("persona", {}),
        norms=raw.get("norms", {}),
        tools=list(perms.get("tools", [])),
        forbid=list(perms.get("forbid", [])),
        skills=list(raw.get("skills", [])),
        model=raw.get("model"),
        thinking_level=raw.get("thinking_level"),
        ui=raw.get("ui", {}),
    )


class RoleLibrary:
    """内置角色库。进程内缓存，按 lang 实例化。"""

    def __init__(self, roles_dir: Path = ROLES_DIR, lang: str = "zh"):
        self.roles_dir = Path(roles_dir)
        self.lang = lang
        self._cache: Dict[str, Role] = {}

    def ids(self) -> List[str]:
        if not self.roles_dir.exists():
            return []
        return sorted(p.parent.name for p in self.roles_dir.glob("*/role.json"))

    def get(self, role_id: str) -> Role:
        if role_id not in self._cache:
            role = _load_one(self.roles_dir, role_id)
            role.lang = self.lang
            self._cache[role_id] = role
        return self._cache[role_id]

    def catalog_line(self) -> str:
        """给 lead system prompt 的一行角色清单（派生注入，不手写）。"""
        parts = []
        for rid in self.ids():
            r = self.get(rid)
            parts.append(f"- {rid}: {r.text(r.description)}")
        return "\n".join(parts)
