"""SessionsStore.get_chat_history 回放测试：原始输出优先 + tool 链回放。"""
import json
from datetime import datetime, timezone

import pytest

from doclens.web_v2.sessions_store import (
    SessionItem,
    SessionSummary,
    SessionType,
    SessionsStore,
)


@pytest.fixture()
def store(tmp_path):
    return SessionsStore(tmp_path / "sessions.db")


def _create_session(store: SessionsStore, sid: str = "s1") -> None:
    now = datetime.now(timezone.utc)
    store.create(SessionSummary(
        id=sid, type=SessionType.CHAT, title="t", preview="",
        created_at=now, updated_at=now, message_count=0,
    ))


def _append(store: SessionsStore, sid: str, kind: str, payload: dict, seq: int) -> None:
    store.append_item(SessionItem(
        session_id=sid, seq=seq, kind=kind, payload=json.dumps(payload, ensure_ascii=False),
    ))


class TestGetChatHistory:
    def test_legacy_user_ai_roundtrip(self, store):
        """旧会话（无 raw/tool_trace）行为不变。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        _append(store, "s1", "message_ai", {"content": "a1"}, 1)
        _append(store, "s1", "message_user", {"content": "q2"}, 2)
        _append(store, "s1", "message_ai", {"content": "a2"}, 3)
        history = store.get_chat_history("s1")
        assert history == [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
            {"role": "user", "content": "q2"},
            {"role": "assistant", "content": "a2"},
        ]

    def test_tool_trace_replayed_as_anthropic_pairs(self, store):
        """tool_trace 回放为 assistant(tool_use) + user(tool_result) 成对消息。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "查一下"}, 0)
        store.append_chat_turn_raw("s1", [
            {"tool_use_id": "tu1", "name": "search_kb", "input": {"q": "x"},
             "output": "结果正文", "is_error": False},
            {"tool_use_id": "tu2", "name": "read_document", "input": {"path": "a.md"},
             "output": "文档内容", "is_error": False},
        ], "原始回答")
        history = store.get_chat_history("s1")
        assert history[0] == {"role": "user", "content": "查一下"}
        assert history[1] == {"role": "assistant", "content": [
            {"type": "tool_use", "id": "tu1", "name": "search_kb", "input": {"q": "x"}},
        ]}
        assert history[2] == {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "tu1",
             "content": "结果正文", "is_error": False},
        ]}
        assert history[3]["content"][0]["id"] == "tu2"
        assert history[5] == {"role": "assistant", "content": "原始回答"}
        # role 严格交替
        roles = [m["role"] for m in history]
        assert roles == ["user", "assistant", "user", "assistant", "user", "assistant"]

    def test_raw_preferred_over_curated_display(self, store):
        """同轮有 message_ai_raw 与 message_ai（策展）时，上下文用原始输出。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        store.append_chat_turn_raw("s1", [], "模型原始输出")
        _append(store, "s1", "message_ai", {"content": "策展后展示文本"}, 2)
        history = store.get_chat_history("s1")
        assert history[-1] == {"role": "assistant", "content": "模型原始输出"}

    def test_display_fallback_when_no_raw(self, store):
        """没有 raw（旧数据 / 写 raw 失败）时回退到 message_ai 展示文本。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        _append(store, "s1", "message_ai", {"content": "展示文本"}, 1)
        history = store.get_chat_history("s1")
        assert history[-1] == {"role": "assistant", "content": "展示文本"}

    def test_alternation_guard_for_interrupted_turn(self, store):
        """中断轮只有 message_user：相邻 user 之间补填充消息，避免 400。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        _append(store, "s1", "message_user", {"content": "q2"}, 1)
        _append(store, "s1", "message_ai", {"content": "a2"}, 2)
        history = store.get_chat_history("s1")
        roles = [m["role"] for m in history]
        assert all(a != b for a, b in zip(roles, roles[1:]))

    def test_invalid_tool_trace_skipped(self, store):
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        # 缺 tool_use_id 的 trace 直接跳过
        _append(store, "s1", "tool_trace", {"name": "x", "output": "o"}, 1)
        _append(store, "s1", "message_ai", {"content": "a"}, 2)
        history = store.get_chat_history("s1")
        assert [m["role"] for m in history] == ["user", "assistant"]

    def test_raw_seq_continues_after_frontend_items(self, store):
        """append_chat_turn_raw 的 seq 接续已有条目，不与前端写入冲突。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        _append(store, "s1", "message_ai", {"content": "a1"}, 1)
        store.append_chat_turn_raw("s1", [], "raw1")
        _append(store, "s1", "message_user", {"content": "q2"}, 3)
        store.append_chat_turn_raw("s1", [], "raw2")
        items = store.get_detail("s1")
        seqs = [it.seq for it in items]
        assert seqs == sorted(seqs) and len(set(seqs)) == len(seqs)
        history = store.get_chat_history("s1")
        assert history == [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "raw1"},
            {"role": "user", "content": "q2"},
            {"role": "assistant", "content": "raw2"},
        ]


SKILL_MSG = (
    "<system-reminder>\n<loaded-skill name=\"demo\">\n# Demo\n</loaded-skill>\n</system-reminder>"
)


class TestUpsertSkillContexts:
    def test_inserted_before_tail_message_user_and_replayed_in_position(self, store):
        """skill_context 插到本轮 message_user 之前，回放在首次注入位置。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        inserted = store.upsert_skill_contexts("s1", [("demo", SKILL_MSG)])
        assert inserted == 1
        store.append_chat_turn_raw("s1", [], "a1")
        # seq 重排后唯一且有序
        seqs = [it.seq for it in store.get_detail("s1")]
        assert seqs == sorted(seqs) and len(set(seqs)) == len(seqs)
        history = store.get_chat_history("s1")
        assert history == [
            {"role": "user", "content": SKILL_MSG},
            {"role": "assistant", "content": "Noted."},
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "a1"},
        ]

    def test_idempotent_by_name(self, store):
        """同名重复注入跳过；seq 不变。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        assert store.upsert_skill_contexts("s1", [("demo", SKILL_MSG)]) == 1
        assert store.upsert_skill_contexts("s1", [("demo", SKILL_MSG)]) == 0
        items = [it for it in store.get_detail("s1") if it.kind == "skill_context"]
        assert len(items) == 1

    def test_content_update_in_place(self, store):
        """技能正文编辑后原地 UPDATE（位置不变，内容跟上 runner 注入）。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        store.upsert_skill_contexts("s1", [("demo", SKILL_MSG)])
        new_msg = SKILL_MSG.replace("# Demo", "# Demo v2")
        assert store.upsert_skill_contexts("s1", [("demo", new_msg)]) == 0
        history = store.get_chat_history("s1")
        assert history[0] == {"role": "user", "content": new_msg}

    def test_multiple_skills_preserve_order(self, store):
        """多个新技能一次插入，顺序与注入顺序一致。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        msg_b = SKILL_MSG.replace("demo", "bbb")
        inserted = store.upsert_skill_contexts(
            "s1", [("aaa", SKILL_MSG), ("bbb", msg_b)]
        )
        assert inserted == 2
        history = store.get_chat_history("s1")
        assert [m["content"] for m in history if m["role"] == "user"] == [
            SKILL_MSG, msg_b, "q1",
        ]


class TestRawMessagesReplay:
    def test_replayed_verbatim(self, store):
        """raw_messages 按原始结构原样回放（单条 assistant 多 block）。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": [
                {"type": "text", "text": "先查。"},
                {"type": "tool_use", "id": "tu1", "name": "t", "input": {"q": "x"}},
                {"type": "tool_use", "id": "tu2", "name": "t", "input": {"q": "y"}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "tu1", "content": "r1",
                 "is_error": False},
                {"type": "tool_result", "tool_use_id": "tu2", "content": "r2",
                 "is_error": False},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "最终回答"}],
        }])
        history = store.get_chat_history("s1")
        assert history[0] == {"role": "user", "content": "q1"}
        assert history[1]["role"] == "assistant"
        assert [b["type"] for b in history[1]["content"]] == [
            "text", "tool_use", "tool_use",
        ]
        assert history[2]["role"] == "user"
        assert [b["type"] for b in history[2]["content"]] == [
            "tool_result", "tool_result",
        ]
        assert history[3] == {
            "role": "assistant", "content": [{"type": "text", "text": "最终回答"}],
        }

    def test_raw_messages_preferred_over_tool_trace(self, store):
        """同轮有 raw_messages 与 tool_trace 时，回放忽略拆对副本。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "tu1", "name": "t", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "tu1", "content": "r",
                 "is_error": False},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "raw 回答"}]},
        ])
        # 展示层冗余副本（旧通道），不应影响回放
        store.append_chat_turn_raw("s1", [
            {"tool_use_id": "tu1", "name": "t", "input": {},
             "output": "r", "is_error": False},
        ], "raw 回答")
        history = store.get_chat_history("s1")
        assert [m["role"] for m in history] == ["user", "assistant", "user", "assistant"]
        assert history[1]["content"] == [
            {"type": "tool_use", "id": "tu1", "name": "t", "input": {}},
        ]
        assert history[-1]["content"] == [{"type": "text", "text": "raw 回答"}]


class TestToolPairingSanitizer:
    """回放侧消毒：剥除存量污染 raw_messages 中的孤儿 tool_result。

    旧版轮起点下标偏移（run_stream 头部注入 context 消息对后移历史 2 条）
    导致每轮 raw 多带上一轮末尾的 [user(tool_result), assistant(text)]，
    tool_result 无父 → OpenAI 兼容后端 400（tool_calls 配对校验）。
    """

    @staticmethod
    def _orphans(history):
        orphans = []
        prev = None
        for m in history:
            content = m.get("content")
            if m.get("role") == "user" and isinstance(content, list):
                tr_ids = [
                    b.get("tool_use_id")
                    for b in content
                    if isinstance(b, dict) and b.get("type") == "tool_result"
                ]
                if tr_ids:
                    tu_ids = set()
                    if prev and prev.get("role") == "assistant" and isinstance(
                        prev.get("content"), list
                    ):
                        tu_ids = {
                            b.get("id")
                            for b in prev["content"]
                            if isinstance(b, dict) and b.get("type") == "tool_use"
                        }
                    orphans.extend(t for t in tr_ids if t not in tu_ids)
            prev = m
        return orphans

    def test_orphan_tool_result_stripped(self, store):
        """复现真实污染结构：轮 2 raw 开头漏进轮 1 的 [tool_result, text]。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "桌面上有哪些pdf"}, 0)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "c1", "name": "bash", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "c1", "content": "r1"},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "3 个 PDF"}]},
        ])
        _append(store, "s1", "message_user", {"content": "读取其中一份"}, 5)
        # 污染的轮 2 raw：开头是轮 1 末尾的 [user(tool_result c1), asst text]
        store.append_raw_messages("s1", [
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "c1", "content": "r1"},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "3 个 PDF"}]},
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "c2", "name": "read_file", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "c2", "content": "r2"},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "读取结果"}]},
        ])
        history = store.get_chat_history("s1")
        assert self._orphans(history) == []
        # 合法配对逐字节保留（前缀缓存友好）
        assert {"type": "tool_use", "id": "c2", "name": "read_file", "input": {}} in [
            b for m in history if isinstance(m.get("content"), list)
            for b in m["content"]
        ]
        # 角色交替契约（ADR-0026）：user/user 不相邻（400 防护）；
        # assistant/assistant 允许（压缩边界后真实请求形态，不再插填充）
        roles = [m["role"] for m in history]
        assert not any(a == b == "user" for a, b in zip(roles, roles[1:]))

    def test_orphan_only_message_dropped(self, store):
        """整条都是孤儿 tool_result 的 user 消息整条丢弃，交替由填充补上。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        store.append_raw_messages("s1", [
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "ghost", "content": "x"},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "回答"}]},
        ])
        history = store.get_chat_history("s1")
        assert self._orphans(history) == []
        assert all(
            not (isinstance(m.get("content"), list)
                 and any(b.get("tool_use_id") == "ghost"
                         for b in m["content"] if isinstance(b, dict)))
            for m in history
        )
        # 角色交替契约（ADR-0026）：user/user 不相邻；assistant/assistant 允许
        roles = [m["role"] for m in history]
        assert not any(a == b == "user" for a, b in zip(roles, roles[1:]))

    def test_mixed_blocks_keep_valid(self, store):
        """user 消息混合合法/孤儿 tool_result：只剥孤儿，合法块保留。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "ok1", "name": "t", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "ghost", "content": "x"},
                {"type": "tool_result", "tool_use_id": "ok1", "content": "r"},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "a"}]},
        ])
        history = store.get_chat_history("s1")
        assert self._orphans(history) == []
        user_msg = next(
            m for m in history
            if m["role"] == "user" and isinstance(m.get("content"), list)
        )
        assert [b["tool_use_id"] for b in user_msg["content"]] == ["ok1"]

    def test_clean_history_byte_identical(self, store):
        """无污染的合法历史：消毒是恒等变换（逐字节不变）。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "tu1", "name": "t", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "tu1", "content": "r",
                 "is_error": True},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "a"}]},
        ])
        history = store.get_chat_history("s1")
        assert history == [
            {"role": "user", "content": "q"},
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "tu1", "name": "t", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "tu1", "content": "r",
                 "is_error": True},
            ]},
            {"role": "assistant", "content": [{"type": "text", "text": "a"}]},
        ]


class TestUsageItems:
    """kind='usage' 条目（2026-09-17 会话信息弹窗）：落库续排 + 回放免疫。"""

    def test_append_usage_seq_continues_and_ignored_by_replay(self, store):
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        store.append_chat_turn_raw("s1", [], "a1")
        store.append_usage("s1", {
            "input_tokens": 100, "output_tokens": 10,
            "cache_creation_input_tokens": 5, "cache_read_input_tokens": 20,
            "context_window": 200000,
        })
        items = store.get_detail("s1")
        seqs = [it.seq for it in items]
        assert seqs == sorted(seqs) and len(set(seqs)) == len(seqs)
        usage_items = [it for it in items if it.kind == "usage"]
        assert len(usage_items) == 1
        payload = json.loads(usage_items[0].payload)
        assert payload["input_tokens"] == 100
        assert payload["context_window"] == 200000
        # 回放不受 usage 条目影响
        history = store.get_chat_history("s1")
        assert history == [
            {"role": "user", "content": "q"},
            {"role": "assistant", "content": "a1"},
        ]


# === ADR-0026 压缩即事实：compacted / microcompact 回放投影 ===

_SUMMARY_PAIR = [
    {"role": "user", "content": "[Compressed. Transcript: t.jsonl]\n摘要"},
    {"role": "assistant", "content": "Understood. Continuing with summary context."},
]


class TestCompactedReplay:
    """kind='compacted' 截断投影：清空前缀、多边界取最后、抑制兜底复活。"""

    def test_clears_prefix_including_same_turn_user(self, store):
        """边界之前的全部条目（含同轮 message_user / skill_context）被摘要覆盖。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "旧问题"}, 0)
        _append(store, "s1", "message_ai", {"content": "旧回答"}, 1)
        _append(store, "s1", "message_user", {"content": "压缩轮问题"}, 2)
        _append(store, "s1", "skill_context",
                {"name": "demo", "content": "skill body"}, 3)
        store.append_compacted("s1", _SUMMARY_PAIR, 180000)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": [{"type": "text", "text": "压缩后回答"}]},
        ])
        history = store.get_chat_history("s1")
        assert history == [
            *_SUMMARY_PAIR,
            {"role": "assistant", "content": [{"type": "text", "text": "压缩后回答"}]},
        ]

    def test_multiple_boundaries_last_wins(self, store):
        """多次压缩：只最后一个边界生效（更早的摘要也被覆盖）。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        store.append_compacted("s1", _SUMMARY_PAIR, 190000)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": "边界1后回答"},
            {"role": "user", "content": "q2"},
        ])
        store.append_compacted(
            "s1",
            [
                {"role": "user", "content": "[Compressed. Transcript: t2]\n摘要2"},
                {"role": "assistant", "content": "Understood."},
            ],
            170000,
        )
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": "边界2后回答"},
        ])
        history = store.get_chat_history("s1")
        assert history == [
            {"role": "user", "content": "[Compressed. Transcript: t2]\n摘要2"},
            {"role": "assistant", "content": "Understood."},
            {"role": "assistant", "content": "边界2后回答"},
        ]

    def test_compacted_turn_suppresses_fallback_revival(self, store):
        """压缩轮 raw 为空（压缩后立刻中断）时，tool_trace/message_ai_raw
        不得兜底复活压缩前的旧工具链（ADR-0026 审查问题 2）。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        # 压缩前的工具链 + AI 原文（旧格式条目）
        _append(store, "s1", "tool_trace",
                {"tool_use_id": "tu_old", "name": "bash", "input": {},
                 "output": "旧结果", "is_error": False}, 1)
        _append(store, "s1", "message_ai_raw", {"content": "旧回答"}, 2)
        # 压缩边界（无后续 raw —— 中断）
        store.append_compacted("s1", _SUMMARY_PAIR, 180000)
        history = store.get_chat_history("s1")
        assert history == _SUMMARY_PAIR

    def test_consecutive_assistant_after_boundary_no_filler(self, store):
        """摘要确认（assistant）后紧跟 LLM 回复（assistant）不插 "(interrupted)"
        填充——真实请求形态，回放须逐字节一致（ADR-0026 审查问题 3）。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        store.append_compacted("s1", _SUMMARY_PAIR, 180000)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": "压缩后回答"},
        ])
        history = store.get_chat_history("s1")
        roles = [m["role"] for m in history]
        assert roles == ["user", "assistant", "assistant"]
        assert all(m["content"] != "(interrupted)" for m in history)

    def test_interrupted_user_filler_still_applies(self, store):
        """中断轮 user/user 填充保留（400 防护，契约另一半）。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        _append(store, "s1", "message_user", {"content": "q2"}, 1)
        _append(store, "s1", "message_ai", {"content": "a2"}, 2)
        history = store.get_chat_history("s1")
        assert history == [
            {"role": "user", "content": "q1"},
            {"role": "assistant", "content": "(interrupted)"},
            {"role": "user", "content": "q2"},
            {"role": "assistant", "content": "a2"},
        ]


class TestMicrocompactReplay:
    """kind='microcompact' 按 tool_use_id 重放 "[cleared]"。"""

    def test_cross_turn_tool_trace_replaced(self, store):
        """跨轮旧格式 tool_trace 原文被替换为 "[cleared]"（真正生效场景）。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        _append(store, "s1", "tool_trace",
                {"tool_use_id": "tu_a", "name": "bash", "input": {},
                 "output": "长输出" * 100, "is_error": False}, 1)
        _append(store, "s1", "message_ai_raw", {"content": "a1"}, 2)
        _append(store, "s1", "message_user", {"content": "q2"}, 3)
        store.append_microcompact("s1", ["tu_a"])
        history = store.get_chat_history("s1")
        # q1 → assistant(tool_use) → user(tool_result "[cleared]") → a1 → q2
        assert history[2]["content"][0]["content"] == "[cleared]"
        assert history[0]["content"] == "q1"
        assert history[4]["content"] == "q2"

    def test_raw_messages_cleared_idempotent(self, store):
        """raw_messages 内已是 "[cleared]" 的 tool_result 重放替换幂等。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "tu_b", "name": "bash", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "tu_b", "content": "[cleared]"},
            ]},
            {"role": "assistant", "content": [
                {"type": "tool_use", "id": "tu_keep", "name": "bash", "input": {}},
            ]},
            {"role": "user", "content": [
                {"type": "tool_result", "tool_use_id": "tu_keep", "content": "保留"},
            ]},
        ])
        store.append_microcompact("s1", ["tu_b"])
        history = store.get_chat_history("s1")
        # tu_b 仍 "[cleared]"；tu_keep 原文不受影响
        blocks = [b for m in history if isinstance(m.get("content"), list)
                  for b in m["content"]
                  if isinstance(b, dict) and b.get("type") == "tool_result"]
        by_id = {b["tool_use_id"]: b["content"] for b in blocks}
        assert by_id == {"tu_b": "[cleared]", "tu_keep": "保留"}

    def test_entry_before_boundary_ignored(self, store):
        """边界（compacted）之前的 microcompact 条目不生效——其目标已被
        截断投影清掉。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        _append(store, "s1", "tool_trace",
                {"tool_use_id": "tu_dead", "name": "bash", "input": {},
                 "output": "原文", "is_error": False}, 1)
        _append(store, "s1", "message_user", {"content": "q2"}, 2)
        store.append_microcompact("s1", ["tu_dead"])
        store.append_compacted("s1", _SUMMARY_PAIR, 180000)
        store.append_raw_messages("s1", [
            {"role": "assistant", "content": "新回答"},
        ])
        history = store.get_chat_history("s1")
        # 边界清掉一切（tu_dead 连同其 tool_trace 均不在回放中）
        assert history == [*_SUMMARY_PAIR, {"role": "assistant", "content": "新回答"}]


class TestUpsertBoundaryAware:
    """upsert_skill_contexts 压缩边界感知（ADR-0026 审查问题 1）。"""

    def test_reinsert_after_boundary(self, store):
        """边界前的同名 skill_context 视为不存在 → 压缩后重插新条目。

        真实时序（chat.py finally）：压缩轮 upsert 先跑（旧条目尚存活→跳过）
        → compacted 落库 → 下轮前端先落 message_user → 下轮 upsert 重插。
        """
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        # 压缩前的 skill_context
        assert store.upsert_skill_contexts("s1", [("demo", "skill body")]) == 1
        store.append_compacted("s1", _SUMMARY_PAIR, 180000)
        # 下轮：前端先落 message_user，再 upsert（旧条目在边界前不算存在）
        _append(store, "s1", "message_user", {"content": "q2"},
                max(it.seq for it in store.get_detail("s1")) + 1)
        assert store.upsert_skill_contexts("s1", [("demo", "skill body")]) == 1
        items = store.get_detail("s1")
        skills = sorted(it.seq for it in items if it.kind == "skill_context")
        compacted = [it.seq for it in items if it.kind == "compacted"]
        assert len(skills) == 2
        assert skills[1] > compacted[0]

    def test_boundary_dedupe_same_turn(self, store):
        """边界后已有同名条目时仍去重（边界感知只改存在性范围）。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q1"}, 0)
        store.append_compacted("s1", _SUMMARY_PAIR, 180000)
        # 下轮：message_user 先落，upsert 两次（第二次去重）
        _append(store, "s1", "message_user", {"content": "q2"},
                max(it.seq for it in store.get_detail("s1")) + 1)
        assert store.upsert_skill_contexts("s1", [("demo", "v1")]) == 1
        assert store.upsert_skill_contexts("s1", [("demo", "v1")]) == 0

    def test_dedupe_without_boundary_unchanged(self, store):
        """无 compacted 会话（boundary=-1）：同名去重行为与历史版本一致。"""
        _create_session(store)
        _append(store, "s1", "message_user", {"content": "q"}, 0)
        assert store.upsert_skill_contexts("s1", [("demo", "v1")]) == 1
        assert store.upsert_skill_contexts("s1", [("demo", "v1")]) == 0  # 去重
        assert store.upsert_skill_contexts("s1", [("demo", "v2")]) == 0  # 原地 UPDATE
        items = [it for it in store.get_detail("s1") if it.kind == "skill_context"]
        assert len(items) == 1
        assert json.loads(items[0].payload)["content"] == "v2"


class TestUpdateTitle:
    """人工改名（2026-09-17）：仅改 title，不刷新 updated_at。"""

    def test_title_updated(self, store):
        _create_session(store)
        store.update_title("s1", "新标题")
        assert store.get("s1").title == "新标题"

    def test_updated_at_unchanged(self, store):
        """历史列表按 updated_at 排序，改名不得把会话顶到最前。"""
        _create_session(store)
        before = store.get("s1").updated_at
        store.update_title("s1", "新标题")
        assert store.get("s1").updated_at == before


class TestStarred:
    """加星（2026-09-17）：置顶（starred DESC, updated_at DESC）+ 删除保护。"""

    def test_star_roundtrip(self, store):
        _create_session(store)
        assert store.get("s1").starred is False
        store.set_starred("s1", True)
        assert store.get("s1").starred is True
        store.set_starred("s1", False)
        assert store.get("s1").starred is False

    def test_star_does_not_refresh_updated_at(self, store):
        """置顶纯靠排序键；加星不得像 find_or_create 命中那样刷时间戳。"""
        _create_session(store)
        before = store.get("s1").updated_at
        store.set_starred("s1", True)
        assert store.get("s1").updated_at == before

    def test_list_starred_first_then_time_desc(self, store):
        _create_session(store, "old")
        _create_session(store, "new")
        store.update_count_and_time("new", 1)  # new 的 updated_at 更新
        store.set_starred("old", True)
        ids = [s.id for s in store.list(SessionType.CHAT)]
        assert ids == ["old", "new"]  # 加星的旧会话置顶

    def test_find_or_create_preserves_starred(self, store):
        """search 历史重复搜索走 find_or_create 命中分支，不得丢加星态。"""
        _create_session(store, "s1")
        store.set_starred("s1", True)
        hit = store.find_or_create(SessionType.CHAT, "t")
        assert hit.id == "s1" and hit.starred is True
        assert store.get("s1").starred is True

    def test_delete_refuses_starred(self, store):
        _create_session(store, "s1")
        store.set_starred("s1", True)
        assert store.delete("s1") is False
        assert store.get("s1") is not None
        # 取消加星后可删
        store.set_starred("s1", False)
        assert store.delete("s1") is True
        assert store.get("s1") is None

    def test_delete_by_type_skips_starred(self, store):
        _create_session(store, "keep")
        _create_session(store, "drop1")
        _create_session(store, "drop2")
        store.set_starred("keep", True)
        deleted, skipped, deleted_ids = store.delete_by_type(SessionType.CHAT)
        assert (deleted, skipped) == (2, 1)
        assert sorted(deleted_ids) == ["drop1", "drop2"]
        remaining = [s.id for s in store.list(SessionType.CHAT)]
        assert remaining == ["keep"]

    def test_migration_adds_starred_column(self, tmp_path):
        """旧库（无 starred 列）初始化时 ALTER 补列，存量行默认未加星。"""
        import sqlite3
        db = tmp_path / "old.db"
        with sqlite3.connect(db) as conn:
            conn.execute(
                """CREATE TABLE sessions (
                    id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL,
                    preview TEXT NOT NULL, mode TEXT,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
                    message_count INTEGER NOT NULL DEFAULT 0
                )"""
            )
            conn.execute(
                """INSERT INTO sessions
                   (id, type, title, preview, mode, created_at, updated_at, message_count)
                   VALUES ('legacy', 'chat', 't', '', NULL,
                           '2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00', 0)"""
            )
        store2 = SessionsStore(db)
        s = store2.get("legacy")
        assert s is not None and s.starred is False
        # 迁移后加星可用
        store2.set_starred("legacy", True)
        assert store2.get("legacy").starred is True
