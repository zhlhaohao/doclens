"""技能目录契约测试：Base directory 注入头 + ${CLAUDE_SKILL_DIR} 确定性替换。

对齐 Claude Code 机制（loadSkillsDir.ts getPromptForCommand）：
1. load() 首行注入 "Base directory for this skill: <技能绝对目录>"——
   正文中的 ./scripts/run.sh 相对引用由模型据此拼接（宿主不 chdir）；
2. 正文占位符替换为正斜杠绝对路径（Windows 反斜杠防 bash 转义吞噬）；
3. frontmatter 值（allowed-tools 等）在解析期（rescan 后的 skills dict）即完成替换。
"""
from pathlib import Path

from planify.skills.skill_loader import SKILL_DIR_PLACEHOLDER, SkillLoader


def _write_skill(
    root: Path, dirname: str, body: str, frontmatter: str = "description: d"
) -> Path:
    d = root / dirname
    d.mkdir(parents=True, exist_ok=True)
    f = d / "SKILL.md"
    f.write_text(
        f"---\nname: {dirname}\n{frontmatter}\n---\n{body}", encoding="utf-8"
    )
    return f


def _fwd(p: Path) -> str:
    """路径 → 正斜杠字符串（与占位符替换的归一口径一致）。"""
    return str(p).replace("\\", "/")


class TestBaseDirHeader:
    def test_header_first_line_inside_skill_tag(self, tmp_path):
        """注入头位于 <skill> 标签内、正文之前，目录为技能自身绝对目录。"""
        _write_skill(tmp_path, "a", "正文")
        out = SkillLoader(tmp_path).load("a")
        assert out.startswith(
            f'<skill name="a">\n'
            f"Base directory for this skill: {tmp_path / 'a'}\n\n正文\n</skill>"
        )

    def test_relative_reference_left_untouched(self, tmp_path):
        """相对引用 ./scripts/run.sh 原样保留——拼接由模型依注入头完成。"""
        _write_skill(tmp_path, "a", "先跑 ./scripts/run.sh")
        out = SkillLoader(tmp_path).load("a")
        assert "./scripts/run.sh" in out
        assert "Base directory for this skill:" in out

    def test_base_dir_recorded_in_skills_dict(self, tmp_path):
        """扫描产物携带 base_dir（绝对路径，供宿主/测试消费）。"""
        _write_skill(tmp_path, "a", "x")
        loader = SkillLoader(tmp_path)
        assert loader.skills["a"]["base_dir"] == str(tmp_path / "a")


class TestPlaceholderSubstitution:
    def test_body_placeholder_replaced_forward_slash(self, tmp_path):
        """正文占位符 → 正斜杠绝对路径，占位符不残留。"""
        _write_skill(tmp_path, "a", f"运行 {SKILL_DIR_PLACEHOLDER}/scripts/run.sh")
        out = SkillLoader(tmp_path).load("a")
        assert SKILL_DIR_PLACEHOLDER not in out
        assert f"{_fwd(tmp_path / 'a')}/scripts/run.sh" in out

    def test_body_without_placeholder_untouched(self, tmp_path):
        _write_skill(tmp_path, "a", "没有占位符的正文")
        out = SkillLoader(tmp_path).load("a")
        assert "没有占位符的正文" in out
        assert SKILL_DIR_PLACEHOLDER not in out

    def test_unknown_skill_error_unchanged(self, tmp_path):
        """未知技能仍返回 Error（前缀注入不影响错误路径）。"""
        loader = SkillLoader(tmp_path)
        assert loader.load("nope").startswith("Error: Unknown skill")


class TestFrontmatterParseTimeSubstitution:
    def test_allowed_tools_substituted_at_rescan(self, tmp_path):
        """frontmatter 值解析期即替换（skills dict 里已是真实路径）。"""
        _write_skill(
            tmp_path,
            "a",
            "x",
            frontmatter=(
                f"allowed-tools: bash({SKILL_DIR_PLACEHOLDER}/scripts/run.sh)"
            ),
        )
        meta = SkillLoader(tmp_path).skills["a"]["meta"]
        assert SKILL_DIR_PLACEHOLDER not in meta["allowed-tools"]
        assert meta["allowed-tools"] == f"bash({_fwd(tmp_path / 'a')}/scripts/run.sh)"

    def test_meta_without_placeholder_untouched(self, tmp_path):
        _write_skill(tmp_path, "a", "x", frontmatter="description: 普通描述")
        meta = SkillLoader(tmp_path).skills["a"]["meta"]
        assert meta["description"] == "普通描述"
