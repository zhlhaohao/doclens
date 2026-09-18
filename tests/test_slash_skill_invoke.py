"""斜杠技能调用（/技能名 问题）契约测试（grilling 共识，2026-09-18）。

链路：前端引导菜单 + 阻断（UX 层）→ chat.py 复检合法性（注入权威）→
hint 消息对注入（用户消息原样）→ skill_context 通路持久化（键 slash:<名>）
→ 回放原样重建消息对（prompt 前缀缓存稳定）→ 提取式引文策展联动。
"""
import json
from pathlib import Path

import pytest

from doclens.web_v2.api._chat_raw import extract_round_raw_messages
from doclens.web_v2.api._chat_slash import (
    SLASH_HINT_RE,
    hint_already_injected,
    legal_slash_skill,
    slash_hint_content,
)
from planify.skills.skill_loader import SkillLoader


def _write_skill(
    root: Path, dirname: str, extra: str = "", body: str = "正文"
) -> Path:
    d = root / dirname
    d.mkdir(parents=True, exist_ok=True)
    f = d / "SKILL.md"
    f.write_text(
        f"---\nname: {dirname}\ndescription: d\n{extra}\n---\n{body}",
        encoding="utf-8",
    )
    return f


@pytest.fixture()
def loader(tmp_path: Path) -> SkillLoader:
    """normal（全门通过）+ model-only（user-invocable: false）。"""
    _write_skill(tmp_path, "normal")
    _write_skill(tmp_path, "model-only", extra="user-invocable: false")
    return SkillLoader(tmp_path)


class TestLegalSlashSkill:
    def test_bare_name(self, loader):
        """裸 /name（Q6 允许）命中。"""
        assert legal_slash_skill("/normal", loader) == "normal"

    def test_name_with_question(self, loader):
        assert legal_slash_skill("/normal 帮我总结", loader) == "normal"

    def test_unknown_name(self, loader):
        assert legal_slash_skill("/nope 问题", loader) is None

    def test_model_only_rejected(self, loader):
        """用户调用面硬门：user-invocable: false 不可经斜杠调用。"""
        assert legal_slash_skill("/model-only 问题", loader) is None

    def test_disabled_rejected(self, loader, monkeypatch):
        """停用（含已删除，宿主 sidecar 注入）隔断。"""
        loader.set_disabled(["normal"])
        assert legal_slash_skill("/normal 问题", loader) is None

    def test_non_slash_message(self, loader):
        assert legal_slash_skill("普通问题", loader) is None
        assert legal_slash_skill("先做 /normal 再说", loader) is None  # 非首字符
        assert legal_slash_skill("", loader) is None

    def test_none_loader(self):
        assert legal_slash_skill("/normal", None) is None

    def test_name_charset_boundary(self, tmp_path):
        """名字含 . _ - 合法；空格后即问题文本。"""
        _write_skill(tmp_path, "a.b-c_d")
        loader = SkillLoader(tmp_path)
        assert legal_slash_skill("/a.b-c_d x", loader) == "a.b-c_d"


class TestHintContent:
    def test_format_contract(self):
        """hint 含：slash 标记、[调用技能] 信封标记（引文策展同待遇的语义源）、
        load_skill 指引、system-reminder 包装。"""
        content = slash_hint_content("normal")
        assert SLASH_HINT_RE.search(content).group(1) == "normal"
        assert "[调用技能: normal]" in content
        assert 'load_skill("normal")' in content
        assert content.startswith("<system-reminder>\n")
        assert content.endswith("</system-reminder>")

    def test_already_injected_detection(self):
        history = [
            {"role": "user", "content": "早轮问题"},
            {"role": "user", "content": slash_hint_content("normal")},
            {"role": "assistant", "content": "Noted."},
        ]
        assert hint_already_injected(history, "normal") is True
        assert hint_already_injected(history, "other") is False


class TestRawExtractionSkipsHint:
    def test_hint_pair_excluded_from_raw(self):
        """hint 消息对不进 raw_messages（另有 skill_context 通路），防双重回放。"""
        hint = slash_hint_content("normal")
        history = [
            {"role": "user", "content": hint},
            {"role": "assistant", "content": "Noted."},
            {"role": "user", "content": "/normal 问题"},
            {"role": "assistant", "content": [{"type": "text", "text": "答"}]},
        ]
        out = extract_round_raw_messages(history, 0, "/normal 问题")
        assert out == [{"role": "assistant", "content": [{"type": "text", "text": "答"}]}]


class TestExtractSkillContextsKeys:
    def test_slash_and_body_keys_isolated(self):
        """chat.py 提取：hint → slash:<名>，body → <名>，同技能两键并存。"""
        from doclens.web_v2.api.chat import _extract_injected_skill_contexts

        hint = slash_hint_content("tdd")
        body = (
            "<system-reminder>\n"
            '<loaded-skill name="tdd">\n技能正文\n</loaded-skill>\n'
            "</system-reminder>"
        )
        history = [
            {"role": "user", "content": hint},
            {"role": "assistant", "content": "Noted."},
            {"role": "user", "content": body},
            {"role": "assistant", "content": "Noted."},
        ]
        assert _extract_injected_skill_contexts(history) == [
            ("slash:tdd", hint),
            ("tdd", body),
        ]


class TestReplayConsistency:
    def test_upsert_and_replay_rebuilds_pair_in_position(self, tmp_path):
        """验收红线：hint 经 skill_context 通路落库后，回放在 message_user
        之前原样重建消息对（与 chat.py 发送前的内存注入位置一致）。"""
        from doclens.web_v2.sessions_store import SessionItem, SessionsStore, SessionType

        store = SessionsStore(tmp_path / "sessions.db")
        sid = store.find_or_create(SessionType.CHAT, "t").id
        # 前端先行落库本轮 message_user（chat.py 契约：upsert 插到它之前）
        msg = "/normal 问题"
        store.append_item(SessionItem(
            session_id=sid, seq=0, kind="message_user",
            payload=json.dumps({"content": msg}, ensure_ascii=False),
        ))
        hint = slash_hint_content("normal")
        store.upsert_skill_contexts(sid, [("slash:normal", hint)])

        history = store.get_chat_history(sid)
        assert history == [
            {"role": "user", "content": hint},
            {"role": "assistant", "content": "Noted."},
            {"role": "user", "content": msg},
        ]

    def test_upsert_idempotent_across_rounds(self, tmp_path):
        """同键幂等：同会话重复 upsert（同内容）不新增条目（轮 N+1 复检时
        hint_already_injected 已拦，此处兜底双保险）。"""
        from doclens.web_v2.sessions_store import SessionItem, SessionsStore, SessionType

        store = SessionsStore(tmp_path / "sessions.db")
        sid = store.find_or_create(SessionType.CHAT, "t").id
        # 契约：upsert 前必有前端落库的 message_user 尾条目（真实链路恒成立）
        store.append_item(SessionItem(
            session_id=sid, seq=0, kind="message_user",
            payload=json.dumps({"content": "/normal q"}, ensure_ascii=False),
        ))
        hint = slash_hint_content("normal")
        assert store.upsert_skill_contexts(sid, [("slash:normal", hint)]) == 1
        assert store.upsert_skill_contexts(sid, [("slash:normal", hint)]) == 0
