"""校验 SKILL.md 的机器解析契约与 refs_retry.REFERENCES_CONTRACT 一致。"""
from pathlib import Path
import re

from doclens.web_v2.refs_retry import REFERENCES_CONTRACT


_SKILL_MD = Path(__file__).resolve().parents[2] / "doclens" / "skills" / "knowledge_base" / "SKILL.md"


def test_skill_md_contains_contract_section():
    text = _SKILL_MD.read_text(encoding="utf-8")
    assert "机器解析契约" in text, "SKILL.md 缺少「机器解析契约」段"


def test_contract_clauses_consistent_with_code():
    """契约的关键约束在 SKILL.md 和代码常量中都出现。"""
    skill_text = _SKILL_MD.read_text(encoding="utf-8")
    # 提取 SKILL.md 中契约段后的一段（到下一个 ## 标题）
    m = re.search(r"机器解析契约(.*?)(?=\n## |\Z)", skill_text, re.DOTALL)
    assert m is not None
    skill_section = m.group(1)
    key_phrases = [
        "## 参考资料",
        "数字. 路径",
        "file://",
        "打回",
    ]
    for phrase in key_phrases:
        assert phrase in skill_section, f"SKILL.md 契约段缺少：{phrase}"
        assert phrase in REFERENCES_CONTRACT, f"代码常量缺少：{phrase}"
