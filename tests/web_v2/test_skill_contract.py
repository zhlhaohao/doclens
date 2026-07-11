"""校验 SKILL.md 含「机器解析契约」段及关键约束。"""
from pathlib import Path
import re

_SKILL_MD = Path(__file__).resolve().parents[2] / "doclens" / "skills" / "knowledge_base" / "SKILL.md"


def test_skill_md_contains_contract_section():
    text = _SKILL_MD.read_text(encoding="utf-8")
    assert "机器解析契约" in text, "SKILL.md 缺少「机器解析契约」段"


def test_contract_key_phrases_present():
    """契约段含关键约束（标题/格式/禁用项/兜底告警）。"""
    text = _SKILL_MD.read_text(encoding="utf-8")
    m = re.search(r"机器解析契约(.*?)(?=\n## |\Z)", text, re.DOTALL)
    assert m is not None
    section = m.group(1)
    for phrase in ["## 参考资料", "数字. 路径", "file://", "告警"]:
        assert phrase in section, f"SKILL.md 契约段缺少：{phrase}"
