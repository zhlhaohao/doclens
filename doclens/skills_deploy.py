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

# 发行包内置技能源目录（模块级便于测试 monkeypatch 嵌套包结构）
_BUILTIN_SKILLS_SRC = Path(__file__).parent / "skills"


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

    递归发现（rglob）：支持包内厂商/分类子目录组织（与 SkillLoader 同构，
    「递归直到找到 SKILL.md」在所有发现链路统一）。部署保持源相对结构
    （包内 ``<厂商>/<技能>/`` → 目标同名相对路径），升级时新旧结构对位覆盖。

    **整目录部署**（AP-37）：技能是目录级资产——``references/*.md``、
    ``ADR-FORMAT.md`` 等附件与 SKILL.md 同等重要。曾只拷 SKILL.md，导致
    升级后附件永不更新、删除后 restore 只剩一个光秃 SKILL.md 却仍报成功。
    ``dirs_exist_ok=True`` 逐文件覆盖同名、新增新文件，不删除目标侧多余
    文件（用户自建附件得以保留）。

    Returns:
        实际部署的技能名（meta name）列表。
    """
    skills_src_root = _BUILTIN_SKILLS_SRC
    if not skills_src_root.exists():
        return []
    deleted = skills_config.deleted_names()
    _cleanup_tombstone_dirs(skills_dir)
    deployed: list[str] = []
    for src_skill_md in sorted(skills_src_root.rglob("SKILL.md")):
        skill_src_dir = src_skill_md.parent
        skill_name = skill_name_of(src_skill_md, skill_src_dir.name)
        if skill_name in deleted:
            logger.info("内置技能已标记删除，跳过部署: %s", skill_name)
            continue
        # 相对结构保持：包内嵌套层级原样映射到目标（平铺结构行为不变）
        skill_dst_dir = skills_dir / skill_src_dir.relative_to(skills_src_root)
        skill_dst_dir.mkdir(parents=True, exist_ok=True)
        # 整目录覆盖（含 SKILL.md 与全部附件）；sidecar 用户设置在 skills_dir
        # 之外，不受影响
        shutil.copytree(skill_src_dir, skill_dst_dir, dirs_exist_ok=True)
        deployed.append(skill_name)
    return deployed


def _cleanup_tombstone_dirs(skills_dir: Path) -> None:
    """清理「改名墓碑」目录（2026-11-01 P3）：``~<名>/`` 形态的历史遗迹。

    成因：历史版本的删除操作（或用户手动）把技能目录改名成 ``~<名>``
    ——注意改名是**削掉首字符再冠 ~**（``deep-read`` → ``~eep-read``），
    meta name 仍是原名，SkillLoader 递归扫描时同名冲突「先者胜」每次
    启动告警一行/技能（13 天日志累计 3,940+ 行噪音）。

    判据（按 meta name 认亲，防误删）：
    1. 目录名以 ``~`` 开头；
    2. 墓碑 SKILL.md 的 meta name 与 skills_dir 下**另一个正主目录**的
       meta name 相同（正主=非 ~ 前缀）——认不上任何正主的 ~ 目录不动
       （可能是用户自建）；
    3. 墓碑内只有 SKILL.md（无用户附件——有附件的保守跳过）。
    Windows 删除失败（文件占用）跳过不抛——下轮启动再试。
    """
    if not skills_dir.is_dir():
        return
    # 正主清单：非 ~ 前缀目录的 meta name → 目录
    canon: dict[str, Path] = {}
    for d in skills_dir.iterdir():
        if not d.is_dir() or d.name.startswith("~"):
            continue
        md = d / "SKILL.md"
        if md.is_file():
            canon.setdefault(skill_name_of(md, d.name), d)
    for d in skills_dir.iterdir():
        if not d.is_dir() or not d.name.startswith("~"):
            continue
        # 墓碑内混入用户附件：保守跳过
        try:
            entries = sorted(p.name for p in d.iterdir())
        except OSError:
            continue
        if entries != ["SKILL.md"]:
            continue
        md = d / "SKILL.md"
        name = skill_name_of(md, d.name.lstrip("~"))
        if name not in canon:
            continue
        try:
            shutil.rmtree(d)
            logger.info(
                "已清理技能改名墓碑目录: %s（meta=%s 正主 %s 保留）",
                d.name, name, canon[name].name,
            )
        except OSError as e:
            logger.debug("清理墓碑目录失败（占用？下轮再试）: %s - %s", d, e)
