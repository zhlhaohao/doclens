"""SkillLoader - 专业化知识加载 (s05)

从文件系统加载专业技能。

技能文件格式 (skills/my_skill/SKILL.md)：
    ---
    name: my_skill
    description: 技能描述
    ---
    # 技能使用说明
    详细使用说明...
    ---

关键洞察："Model 可以在运行时学习新能力。"
"""

import re
from pathlib import Path
from typing import Dict, Iterable, Optional


class SkillLoader:
    """
    技能加载器

    从文件系统加载专业技能。

    职责：
    - 扫描 skills_dir 下所有 SKILL.md 文件
    - 解析 YAML 前言（元数据）和 Markdown 正文
    - 按名称存储技能信息

    disabled（宿主注入的停用名单）只做**路由层隔断**：descriptions() 清单
    剔除停用技能，load() 不受影响（已知名称仍可加载）。原位更新接口
    rescan()/set_disabled() 供宿主热生效——工具 handler 闭包捕获的是本实例，
    换新实例会导致工具读到旧状态。
    """

    def __init__(self, skills_dir: Path, disabled: Optional[Iterable[str]] = None):
        """
        初始化并扫描技能目录

        扫描 skills_dir 下所有 SKILL.md 文件，解析元数据和内容。

        Args:
            skills_dir: 技能根目录
            disabled: 停用技能名集合（可选，宿主注入；仅影响 descriptions()）
        """
        self.skills_dir = skills_dir
        self._disabled = frozenset(disabled or ())
        self.skills: Dict[str, Dict[str, str]] = {}
        self.rescan()

    def rescan(self) -> None:
        """重新扫描技能目录，原位替换 skills dict（不 mutation 旧 dict）。"""
        skills: Dict[str, Dict[str, str]] = {}
        if self.skills_dir.exists():
            for f in sorted(self.skills_dir.rglob("SKILL.md")):
                text = f.read_text(encoding="utf-8")
                # 解析 YAML 前言
                match = re.match(r"^---\n(.*?)\n---\n(.*)", text, re.DOTALL)
                meta, body = {}, text
                if match:
                    for line in match.group(1).strip().splitlines():
                        if ":" in line:
                            k, v = line.split(":", 1)
                            meta[k.strip()] = v.strip()
                    body = match.group(2).strip()
                name = meta.get("name", f.parent.name)
                skills[name] = {"meta": meta, "body": body}
        self.skills = skills

    def set_disabled(self, names: Iterable[str]) -> None:
        """原位更新停用名单（热生效）。"""
        self._disabled = frozenset(names)

    def is_disabled(self, name: str) -> bool:
        """某技能是否在停用名单中（宿主的展示层据此过滤）。"""
        return name in self._disabled

    def descriptions(self) -> str:
        """
        获取所有启用技能的描述（含路由指引）。停用技能不出现在清单中。

        Returns:
            格式化的技能描述字符串
        """
        items = [(n, s) for n, s in self.skills.items() if n not in self._disabled]
        if not items:
            return "(no skills)"
        return "\n".join(
            f"  - {n}: {s['meta'].get('description', '-')} "
            f"→ 调用 load_skill(\"{n}\") 获取详细指引"
            for n, s in items
        )

    def load(self, name: str) -> str:
        """
        加载指定技能的完整内容

        Args:
            name: 技能名称

        Returns:
            XML 格式的技能内容，用于注入到对话中
        """
        s = self.skills.get(name)
        if not s:
            return f"Error: Unknown skill '{name}'. Available: {', '.join(self.skills.keys())}"
        return f"<skill name=\"{name}\">\n{s['body']}\n</skill>"
