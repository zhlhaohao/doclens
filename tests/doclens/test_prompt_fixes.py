"""验证 skill 路由相关的 prompt 修复。"""
from pathlib import Path

from planify.prompts import build_system_prompt
from planify.skills.skill_loader import SkillLoader

SKILL_MD = Path(__file__).resolve().parents[2] / "doclens" / "skills" / "knowledge_base" / "SKILL.md"


def _frontmatter_description() -> str:
    text = SKILL_MD.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    assert len(parts) >= 3, "SKILL.md 缺少 frontmatter"
    for line in parts[1].strip().splitlines():
        if line.strip().startswith("description:"):
            return line.split("description:", 1)[1].strip()
    return ""


def test_skill_description_does_not_name_tool():
    desc = _frontmatter_description()
    assert "search_kb" not in desc
    assert "load_skill" in desc or "加载" in desc


def test_system_prompt_names_load_skill_and_kb_rule():
    prompt = build_system_prompt(".", agent_type="streaming")
    assert "load_skill" in prompt
    assert "knowledge-base" in prompt
    assert "search_kb" in prompt or "search_kb/read_document" in prompt


def test_descriptions_has_routing_hint(tmp_path):
    skills_dir = tmp_path / "skills" / "demo"
    skills_dir.mkdir(parents=True)
    (skills_dir / "SKILL.md").write_text(
        "---\nname: demo\ndescription: a demo skill\n---\nbody\n", encoding="utf-8"
    )
    loader = SkillLoader(tmp_path / "skills")
    desc = loader.descriptions()
    assert "demo" in desc
    assert 'load_skill("demo")' in desc