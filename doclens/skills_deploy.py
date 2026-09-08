"""内置技能部署：发行包 doclens/skills/ → 全局 skills 目录（ADR-0015）。

启动时强制覆盖部署（内置技能随发行版升级自动更新），但跳过 sidecar 中
标记 deleted: true 的内置技能（用户已删除，不再部署回来）。可变状态
一律不写 SKILL.md——覆盖部署不会冲掉任何用户设置（sidecar 承担）。

供两处消费：CortexAgent.initialize 启动部署、/api/skills/{name}/restore
恢复单个内置技能（热部署，无需重启）。
"""
import logging
import re
import shutil
from pathlib import Path

from doclens import skills_config

logger = logging.getLogger(__name__)


def skill_name_of(skill_md: Path, fallback: str) -> str:
    """解析 SKILL.md frontmatter 的 name（缺省回落目录名）。

    目录名与技能名可能不一致（knowledge_base 目录 / knowledge-base 技能），
    sidecar 删除标记以 meta name 为准。
    """
    try:
        text = skill_md.read_text(encoding="utf-8")
    except OSError:
        return fallback
    match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    if match:
        for line in match.group(1).strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                if k.strip() == "name" and v.strip():
                    return v.strip()
    return fallback


def deploy_builtin_skills(skills_dir: Path) -> list[str]:
    """把发行包内置技能强制覆盖部署到 skills_dir，跳过已删除项。

    Returns:
        实际部署的技能名（meta name）列表。
    """
    skills_src_root = Path(__file__).parent / "skills"
    if not skills_src_root.exists():
        return []
    deleted = skills_config.deleted_names()
    deployed: list[str] = []
    for skill_src_dir in sorted(skills_src_root.iterdir()):
        if not skill_src_dir.is_dir():
            continue
        src_skill_md = skill_src_dir / "SKILL.md"
        if not src_skill_md.exists():
            continue
        skill_name = skill_name_of(src_skill_md, skill_src_dir.name)
        if skill_name in deleted:
            logger.info("内置技能已标记删除，跳过部署: %s", skill_name)
            continue
        skill_dst_dir = skills_dir / skill_src_dir.name
        skill_dst_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_skill_md, skill_dst_dir / "SKILL.md")
        deployed.append(skill_name)
    return deployed
