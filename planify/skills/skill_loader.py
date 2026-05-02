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
from typing import Dict


class SkillLoader:
    """
    技能加载器

    从文件系统加载专业技能。

    职责：
    - 扫描 skills_dir 下所有 SKILL.md 文件
    - 解析 YAML 前言（元数据）和 Markdown 正文
    - 按名称存储技能信息
    """

    def __init__(self, skills_dir: Path):
        """
        初始化并扫描技能目录

        扫描 skills_dir 下所有 SKILL.md 文件，解析元数据和内容。

        Args:
            skills_dir: 技能根目录
        """
        self.skills: Dict[str, Dict[str, str]] = {}
        if skills_dir.exists():
            for f in sorted(skills_dir.rglob("SKILL.md")):
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
                self.skills[name] = {"meta": meta, "body": body}

    def descriptions(self) -> str:
        """
        获取所有技能的描述

        Returns:
            格式化的技能描述字符串
        """
        if not self.skills:
            return "(no skills)"
        return "\n".join(
            f"  - {n}: {s['meta'].get('description', '-')}"
            for n, s in self.skills.items()
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
