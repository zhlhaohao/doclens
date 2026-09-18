"""P0-1 修复回归测试：web 路径 skill body 注入位置稳定，prompt 前缀缓存不被打废。

修复内容：
1. chat.py 在 append_chat_turn_raw 之前把 run_stream 注入的 skill body 经
   SessionsStore.upsert_skill_contexts 落库（插到本轮 message_user 之前）；
2. get_chat_history 回放 skill_context 到首次注入位置；
3. runner 的 tool_result 块补 is_error，与回放块逐字节一致。

复现 web 聊天真实链路（chat.py + run_stream）：每轮从 SessionsStore(SQLite)
重建历史 → run_stream 注入 head / skill body → MockProvider 逐字记录实际收到的
messages。修复后：轮 2 请求 = 轮 1 最终请求 + 纯尾部追加（前缀 100% 命中）。
"""

import asyncio
import copy
import json
import re
from types import SimpleNamespace

from doclens.web_v2.api._chat_raw import extract_round_raw_messages
from doclens.web_v2.sessions_store import SessionItem, SessionsStore, SessionType
from planify.streaming.runner import CONTEXT_MARKER, StreamingAgent
from planify.streaming.types import StreamingConfig

# 模拟真实体量：一次检索工具的输出 + 一份技能正文
BIG_TOOL_OUTPUT = "检索结果段落，含若干文档片段与路径。" * 200  # ~4KB
SKILL_BODY = "# Demo Skill\n" + "技能正文指引行。\n" * 80

_LOADED_SKILL_RE = re.compile(r'<loaded-skill name="([^"]+)">')


def _ev(type_, **kw):
    """构造归一化 LLM 流事件（runner 只读属性，SimpleNamespace 即可）。"""
    d = dict(
        type=type_, block_index=None, block_type=None, tool_use_id=None,
        tool_name=None, text_delta=None, input_json_delta=None, stop_reason=None,
        usage=None,
    )
    d.update(kw)
    return SimpleNamespace(**d)


class MockProvider:
    """记录每次 astream 收到的 messages（深拷贝），按脚本产出事件。

    第 1 次调用发起一次 kb_search 工具调用（制造 tool 链），
    之后每次调用直接返回文本结束。
    """

    def __init__(self):
        self.records = []  # 每次 LLM 调用的 messages 快照（请求体）
        self._call = 0

    async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
        self.records.append(copy.deepcopy(messages))
        self._call += 1
        if self._call == 1:
            yield _ev("content_block_start", block_index=0, block_type="tool_use",
                      tool_use_id="tu_1", tool_name="kb_search")
            yield _ev("content_block_delta", block_index=0,
                      input_json_delta='{"query": "doclens"}')
            yield _ev("content_block_stop", block_index=0)
            yield _ev("message_delta", stop_reason="tool_use")
            yield _ev("message_stop")
        else:
            yield _ev("content_block_start", block_index=0, block_type="text")
            yield _ev("content_block_delta", block_index=0,
                      text_delta=f"第{self._call}次回答")
            yield _ev("content_block_stop", block_index=0)
            yield _ev("message_delta", stop_reason="end_turn")
            yield _ev("message_stop")


class StubEmitter:
    """记录已完成的工具调用（含 output），模拟 ChatEventEmitter.tool_calls。"""

    def __init__(self):
        self.tool_calls = []
        self.text_parts = []
        self._pending = {}

    async def emit_text(self, content, is_end=False):
        self.text_parts.append(content)

    async def emit_tool_call(self, tool_use_id, name, input_data, is_complete=False):
        if is_complete:
            self._pending[tool_use_id] = {
                "tool_use_id": tool_use_id, "name": name, "input": input_data,
            }

    async def emit_tool_result(self, tool_use_id, name, output, is_error=False):
        tc = self._pending.pop(tool_use_id, {
            "tool_use_id": tool_use_id, "name": name, "input": {},
        })
        tc["output"] = output
        tc["is_error"] = is_error
        self.tool_calls.append(tc)

    async def emit_notice(self, message):
        pass  # 轮内中性通知（压缩 toast）：本测试不消费

    async def emit_done(self, session_id, summary=None):
        pass

    async def emit_error(self, error, code=None):
        raise AssertionError(f"agent 运行出错: {error}")

    def get_full_text(self):
        return "".join(self.text_parts)


class FakeSkills:
    """模拟「demo-skill 已加载」的技能加载器。"""

    def descriptions(self):
        return "demo-skill: 演示技能（测试用，内容稳定）"

    def load(self, name):
        return SKILL_BODY if name == "demo-skill" else f"Error: unknown {name}"


def _make_runtime(tmp_path):
    config = SimpleNamespace(
        workdir=tmp_path,
        assets_dir=tmp_path / "assets",  # 不存在 → 不读 agent.md，环境隔离
    )
    return SimpleNamespace(
        config=config,
        skill_access_state=SimpleNamespace(loaded_names=lambda sid: ["demo-skill"]),
        # 压缩触达时 runner 会同步 runtime 内存副本（ADR-0026 测试桩需提供）
        replace_messages_in_place=lambda msgs: None,
    )


def _make_agent(provider, emitter, tmp_path):
    return StreamingAgent(
        client=provider,
        model="mock-model",
        tools=[{
            "name": "kb_search",
            "description": "搜索知识库",
            "input_schema": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
            },
        }],
        tool_handlers={"kb_search": lambda query: BIG_TOOL_OUTPUT},
        emitter=emitter,
        config=StreamingConfig(compact_threshold=10**9),  # 不触发压缩
        skills_loader=FakeSkills(),
        runtime=_make_runtime(tmp_path),
    )


def _extract_injected(history):
    """与 chat.py._extract_injected_skill_contexts 同逻辑。"""
    seen, out = set(), []
    for m in history:
        content = m.get("content")
        if m.get("role") != "user" or not isinstance(content, str):
            continue
        match = _LOADED_SKILL_RE.search(content)
        if match and match.group(1) not in seen:
            seen.add(match.group(1))
            out.append((match.group(1), content))
    return out


def _common_prefix_len(a, b):
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def _bytes(msgs):
    return len(json.dumps(msgs, ensure_ascii=False, default=str))


def _describe(msg):
    content = msg.get("content")
    if isinstance(content, str):
        tag = content[:24].replace("\n", " ")
        if "<loaded-skill" in content:
            tag = "<SKILL-BODY>"
        elif "skills are available" in content:
            tag = "<HEAD-CONTEXT>"
        return f"{msg['role']}: {tag!r}"
    kinds = [b.get("type") for b in content if isinstance(b, dict)]
    return f"{msg['role']}: {kinds}"


def _report(title, prev_req, next_req):
    n = _common_prefix_len(prev_req, next_req)
    shared = _bytes(next_req[:n])
    total = _bytes(next_req)
    print(f"\n=== {title} ===")
    print(f"公共前缀消息数: {n}/{len(next_req)}，"
          f"可缓存复用 {shared}/{total} 字节 ({shared * 100 // max(total, 1)}%)")
    print("下一轮请求消息序列（→ 后为未命中部分）:")
    for i, m in enumerate(next_req):
        mark = " " if i < n else "→"
        print(f"  {mark} [{i}] {_describe(m)}")
    return n, shared, total


def _run_web_rounds(store, sid, sa, emitter, provider, rounds):
    """模拟 chat.py 两轮 web 对话（含修复后的 skill_context 落库）。"""

    def _next_seq():
        items = store.get_detail(sid)
        return max((it.seq for it in items), default=-1) + 1

    async def web_round(msg):
        # 前端发送时已落库 message_user（chat.py:69-77 描述的行为）
        store.append_item(SessionItem(
            session_id=sid, seq=_next_seq(), kind="message_user",
            payload=json.dumps({"content": msg}, ensure_ascii=False),
        ))
        history = store.get_chat_history(sid)
        # 末尾是本轮消息时弹出防重复（chat.py 同款条件；压缩轮回放末尾
        # 可能是 raw 的 assistant 文本，无条件 pop 会误删）
        if (
            history
            and history[-1].get("role") == "user"
            and history[-1].get("content") == msg
        ):
            history.pop()
        round_start = len(history)  # fallback，见下
        await sa.run_stream(history, msg, sid)
        # 修复点 1：skill body 落库（在 append_chat_turn_raw 之前）
        injected = _extract_injected(history)
        if injected:
            store.upsert_skill_contexts(sid, injected)
        # 修复点 3（ADR-0026 压缩即事实）：压缩事件落库。顺序与 chat.py
        # finally 一致——upsert skill_contexts 之后、append_raw_messages
        # 之前（upsert 插入位置是当前 MAX(seq) 之前，compacted 先落库会把
        # 新 skill 条目插进已被截断投影丢弃的死前缀）
        compaction = getattr(sa, "last_compaction", None)
        if compaction:
            store.append_compacted(
                sid, compaction["messages"], compaction.get("pre_tokens", 0)
            )
        cleared = getattr(sa, "round_cleared_tool_use_ids", None)
        if cleared:
            store.append_microcompact(sid, cleared)
        # 修复点 2：本轮原始消息序列落库（多工具/交错文本轮结构等价）。
        # 轮起点必须用 runner 注入完成后的真实下标：run_stream 头部注入
        # context 消息对会把历史整体后移 2 条，用事前的 len(history) 切片
        # 会把上一轮末尾的 [tool_result, text] 漏进 raw_messages（孤儿
        # tool_result），下轮回放触发 OpenAI 兼容后端 400（chat.py 同款修复）
        raw_start = (
            sa.round_start_index
            if sa.round_start_index is not None
            else round_start
        )
        raw_msgs = extract_round_raw_messages(history, raw_start, msg)
        if raw_msgs:
            store.append_raw_messages(sid, raw_msgs)
        # 落库 raw 轮次：tool traces + AI 原文（chat.py:203-217，展示层用）
        traces = [tc for tc in emitter.tool_calls if "output" in tc]
        emitter.tool_calls.clear()
        store.append_chat_turn_raw(sid, traces, emitter.get_full_text())

    for msg in rounds:
        asyncio.run(web_round(msg))


def _orphan_tool_results(messages):
    """返回请求消息序列中的孤儿 tool_result id（前一条 assistant 无对应
    tool_use）——OpenAI 兼容后端对此直接 400。"""
    orphans = []
    prev = None
    for m in messages:
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


def test_web_path_no_orphan_tool_result_round3(tmp_path):
    """三轮回归：轮 2 落库的 raw_messages 不得漏进轮 1 末尾的
    [tool_result, text]（旧 bug：轮起点下标未计入头部注入的 +2 偏移，
    轮 3 重建历史含孤儿 tool_result → DeepSeek 等 400）。

    两轮测试覆盖不到——轮 2 的污染 raw 要到轮 3 才被回放。
    """
    store = SessionsStore(tmp_path / "sessions.db")
    sid = store.find_or_create(SessionType.CHAT, "孤儿回归").id

    provider = MockProvider()
    emitter = StubEmitter()
    sa = _make_agent(provider, emitter, tmp_path)
    _run_web_rounds(
        store, sid, sa, emitter, provider, ["第一轮", "第二轮", "第三轮"]
    )

    # 轮 2 落库的 raw_messages 首条必须是轮 2 自己的消息（无轮 1 泄漏）
    items = store.get_detail(sid)
    raws = [it for it in items if it.kind == "raw_messages"]
    assert len(raws) == 3
    round2_raw = json.loads(raws[1].payload)["messages"]
    first = round2_raw[0]
    assert not (
        first.get("role") == "user"
        and isinstance(first.get("content"), list)
        and first["content"][0].get("type") == "tool_result"
        and first["content"][0].get("tool_use_id") == "tu_1"
    ), f"轮 2 raw 漏进轮 1 的 tool_result：{first}"

    # 轮 3 的每次 LLM 请求都无孤儿 tool_result（重建历史干净）
    r3_records = provider.records[3:]  # 轮1两次 + 轮2两次之后
    assert r3_records, "轮 3 应至少调用一次 LLM"
    for req in r3_records:
        assert _orphan_tool_results(req) == []


def test_extract_uses_post_injection_round_start():
    """契约测试：头部注入 context 消息对后移历史 2 条，切片起点必须用
    注入后的真实下标（runner.round_start_index），否则漏进前轮末尾消息。"""
    seed = [
        {"role": "user", "content": "桌面上有哪些pdf"},
        {"role": "assistant", "content": [
            {"type": "tool_use", "id": "c1", "name": "bash", "input": {}},
        ]},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "c1", "content": "3pdfs"},
        ]},
        {"role": "assistant", "content": [{"type": "text", "text": "3 个 PDF"}]},
    ]
    history = list(seed)
    pre_run_len = len(history)  # 旧契约：run_stream 前捕获
    # 模拟 run_stream 头部注入（重建历史无 marker → insert 消息对到 0/1）
    history.insert(0, {"role": "user", "content": f"{CONTEXT_MARKER}: x"})
    history.insert(1, {"role": "assistant", "content": "Noted."})
    # 新契约：注入完成后、追加 user query 时的真实下标
    round_start_index = len(history)
    history.append({"role": "user", "content": "读一下"})
    history.append({"role": "assistant", "content": [
        {"type": "tool_use", "id": "c2", "name": "bash", "input": {}},
    ]})
    history.append({"role": "user", "content": [
        {"type": "tool_result", "tool_use_id": "c2", "content": "ok"},
    ]})
    history.append({"role": "assistant", "content": [
        {"type": "text", "text": "done"},
    ]})

    # 旧下标复现 bug：漏进前轮 [tool_result c1, text]，c1 成孤儿
    leaked = extract_round_raw_messages(history, pre_run_len, "读一下")
    assert _orphan_tool_results(leaked) == ["c1"]

    # 新下标：只含本轮消息，无泄漏
    out = extract_round_raw_messages(history, round_start_index, "读一下")
    assert _orphan_tool_results(out) == []
    ids = [
        b.get("id") or b.get("tool_use_id")
        for m in out
        if isinstance(m.get("content"), list)
        for b in m["content"]
        if b.get("type") in ("tool_use", "tool_result")
    ]
    assert ids == ["c2", "c2"]


def test_web_path_skill_body_position_stable(tmp_path):
    """修复后：轮 2 请求 = 轮 1 最终请求 + 纯尾部追加，前缀 100% 复用。"""
    store = SessionsStore(tmp_path / "sessions.db")
    sid = store.find_or_create(SessionType.CHAT, "P0-1 回归").id

    provider = MockProvider()
    emitter = StubEmitter()
    sa = _make_agent(provider, emitter, tmp_path)
    _run_web_rounds(store, sid, sa, emitter, provider, ["第一轮问题", "第二轮问题"])

    # provider 共被调用 3 次：轮1两次（tool_use → 文本）、轮2一次
    assert len(provider.records) == 3
    r1_final = provider.records[1]  # 轮 1 最后一次 LLM 调用（含完整 tool 链）
    r2_first = provider.records[2]  # 轮 2 第一次 LLM 调用（DB 重建 + 重注入）

    n, shared, total = _report("web 路径（修复后）", r1_final, r2_first)

    # 核心断言：轮 2 请求前段与轮 1 最终请求逐字节一致（纯尾部追加）
    assert n == len(r1_final), (
        f"前缀应完整复用轮 1 的 {len(r1_final)} 条消息，实际只共享 {n} 条"
    )
    # skill body 位置稳定：两轮都在 index 2（head/Noted 之后）
    assert "<loaded-skill" in json.dumps(r1_final[2])
    assert "<loaded-skill" in json.dumps(r2_first[2])
    # 缓存可复用字节占比 >90%（仅上一轮 AI 文本 + 本轮新问题为新增）
    assert shared * 100 > total * 90, (
        f"缓存复用占比 {shared}/{total} 低于预期 90%"
    )


def test_web_path_tool_result_replay_byte_identical(tmp_path):
    """tool_result 回放块与 runner 原始发出块逐字节一致（is_error 对齐）。"""
    store = SessionsStore(tmp_path / "sessions.db")
    sid = store.find_or_create(SessionType.CHAT, "回放一致性").id

    provider = MockProvider()
    emitter = StubEmitter()
    sa = _make_agent(provider, emitter, tmp_path)
    _run_web_rounds(store, sid, sa, emitter, provider, ["问题"])

    original_tr = provider.records[1][-1]  # runner 实际发出的 tool_result 消息
    replayed = store.get_chat_history(sid)
    replayed_tr = next(
        m for m in replayed
        if m["role"] == "user" and isinstance(m["content"], list)
    )
    assert original_tr == replayed_tr, (
        f"回放块与原始块不一致:\n原始: {original_tr}\n回放: {replayed_tr}"
    )


def test_cli_path_skill_body_position_stable(tmp_path):
    """对照组：内存复用 run_stream 返回值（CLI 语义）→ skill body 留在原位。"""
    provider = MockProvider()
    emitter = StubEmitter()
    sa = _make_agent(provider, emitter, tmp_path)
    sid = "cli-session"

    async def cli_round(history, msg):
        return await sa.run_stream(history, msg, sid)

    history = asyncio.run(cli_round([], "第一轮问题"))
    asyncio.run(cli_round(history, "第二轮问题"))

    assert len(provider.records) == 3
    r1_final = provider.records[1]
    r2_first = provider.records[2]

    n, shared, total = _report("CLI 语义（内存复用，对照组）", r1_final, r2_first)

    # skill body 稳定在 index 2（head/Noted 之后）：head/Noted/SKILL/Noted/u1 全部共享，
    # 分歧只发生在历史合法变化处（CLI 清理丢弃 tool 链）
    assert n >= 5, f"CLI 语义下前缀应稳定到 index≥5，实际 {n}"
    assert "<loaded-skill" in json.dumps(r2_first[2])
    assert "<loaded-skill" in json.dumps(r1_final[2])


# -------------------------------------------- 多工具/文本交错轮（结构等价回归）


class MultiToolProvider:
    """第 1 次调用产出 text + 两个并行 tool_use（单条 assistant 多 block）。"""

    def __init__(self):
        self.records = []
        self._call = 0

    async def astream(self, *, messages, system, tools, max_tokens, tracer=None):
        self.records.append(copy.deepcopy(messages))
        self._call += 1
        if self._call == 1:
            yield _ev("content_block_start", block_index=0, block_type="text")
            yield _ev("content_block_delta", block_index=0,
                      text_delta="先查两个资料。")
            yield _ev("content_block_stop", block_index=0)
            for idx, (tid, q) in enumerate((("tu_1", "a"), ("tu_2", "b")), start=1):
                yield _ev("content_block_start", block_index=idx,
                          block_type="tool_use", tool_use_id=tid,
                          tool_name="kb_search")
                yield _ev("content_block_delta", block_index=idx,
                          input_json_delta=json.dumps({"query": q}))
                yield _ev("content_block_stop", block_index=idx)
            yield _ev("message_delta", stop_reason="tool_use")
            yield _ev("message_stop")
        else:
            yield _ev("content_block_start", block_index=0, block_type="text")
            yield _ev("content_block_delta", block_index=0, text_delta="最终回答。")
            yield _ev("content_block_stop", block_index=0)
            yield _ev("message_delta", stop_reason="end_turn")
            yield _ev("message_stop")


def test_web_path_multitool_round_prefix_stable(tmp_path):
    """多工具/前导文本轮：raw_messages 回放与真实累积结构逐字节一致。

    修复前（tool_trace 拆对回放）：此类轮从该轮首条 assistant 起前缀分叉，
    实测缓存复用仅 26%；修复后应为轮 1 最终请求 + 纯尾部追加。
    """
    store = SessionsStore(tmp_path / "sessions.db")
    sid = store.find_or_create(SessionType.CHAT, "多工具轮").id

    provider = MultiToolProvider()
    emitter = StubEmitter()
    sa = _make_agent(provider, emitter, tmp_path)
    _run_web_rounds(store, sid, sa, emitter, provider, ["第一轮问题", "第二轮问题"])

    assert len(provider.records) == 3
    r1_final = provider.records[1]
    r2_first = provider.records[2]

    n, shared, total = _report("web 路径·多工具轮（修复后）", r1_final, r2_first)

    # 真实结构：assistant([text, tu1, tu2]) + user([tr1, tr2]) 原样回放
    assert n == len(r1_final), (
        f"前缀应完整复用轮 1 的 {len(r1_final)} 条消息，实际只共享 {n} 条"
    )
    assert shared * 100 > total * 85, (
        f"缓存复用占比 {shared}/{total} 低于预期 85%"
    )


def test_extract_round_raw_messages_truncates_dangling_tool_use():
    """中断残留：尾部未配对 tool_use 连同其后消息被截断（防孤儿 400）。"""
    history = [
        {"role": "user", "content": "问题"},
        {"role": "assistant", "content": [
            {"type": "text", "text": "查一下"},
            {"type": "tool_use", "id": "tu_1", "name": "t", "input": {}},
        ]},
        {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "tu_1", "content": "ok",
             "is_error": False},
        ]},
        # 中断：第二个 tool_use 无配对 tool_result
        {"role": "assistant", "content": [
            {"type": "tool_use", "id": "tu_2", "name": "t", "input": {}},
        ]},
    ]
    out = extract_round_raw_messages(history, 0, "问题")
    # 本轮 user 消息被跳过（前端已落库 message_user），尾部孤儿 tool_use 被截断
    assert out == history[1:3], f"应截断到闭合工具链，实际 {out}"


def test_extract_round_raw_messages_skips_injected_and_user():
    """注入消息对（head/skill）与本轮 user 消息不进入 raw_messages。"""
    history = [
        {"role": "user", "content": "The following skills are available for use with the Skill tool: ..."},
        {"role": "assistant", "content": "Noted."},
        {"role": "user", "content": '<loaded-skill name="x">\nbody\n</loaded-skill>'},
        {"role": "assistant", "content": "Noted."},
        {"role": "user", "content": "本轮问题"},
        {"role": "assistant", "content": [{"type": "text", "text": "回答"}]},
    ]
    out = extract_round_raw_messages(history, 0, "本轮问题")
    assert out == [
        {"role": "assistant", "content": [{"type": "text", "text": "回答"}]},
    ]


# === ADR-0026 压缩即事实：端到端回放投影 ===

_COMPACTED_PAIR = [
    {"role": "user", "content": "[Compressed. Transcript: t.jsonl]\n对话摘要"},
    {"role": "assistant", "content": "Understood. Continuing with summary context."},
]


def _make_compacting_agent(provider, emitter, tmp_path):
    """compact_threshold=1 必触发压缩的 agent（fake 摘要对，聚焦回放投影）。"""
    sa = _make_agent(provider, emitter, tmp_path)
    sa.config.compact_threshold = 1

    async def fake_compact(messages, provider_, transcript_dir, *, tracer=None,
                           summary_input_budget=0, summary_max_tokens=0):
        return [dict(m) for m in _COMPACTED_PAIR]

    sa._aauto_compact = fake_compact
    return sa


def test_compacted_replay_round2_prefix_identical(tmp_path):
    """ADR-0026 幂等闭环验收：压缩落库后，轮 2 回放首请求的头部 ==
    轮 1 压缩后最终请求（逐字节）——摘要冻结为事实，回放投影不再分叉。
    """
    store = SessionsStore(tmp_path / "sessions.db")
    sid = store.find_or_create(SessionType.CHAT, "压缩回放").id

    provider = MockProvider()
    emitter = StubEmitter()
    sa = _make_compacting_agent(provider, emitter, tmp_path)
    _run_web_rounds(store, sid, sa, emitter, provider, ["第一轮", "第二轮"])

    # 压缩事件已落库（轮 1 循环内两次压缩同轮覆盖，只落最后一条）
    kinds = [it.kind for it in store.get_detail(sid)]
    assert "compacted" in kinds

    assert len(provider.records) >= 3
    r1_final = provider.records[1]   # 轮 1 第 2 次调用（压缩后）
    r2_first = provider.records[2]   # 轮 2 首次调用（DB 回放）
    n, shared, total = _report("web 路径·压缩轮（ADR-0026）", r1_final, r2_first)

    # 轮 1 压缩后最终请求应完整成为轮 2 回放请求的前缀（逐字节）
    assert n == len(r1_final), (
        f"压缩后前缀应完整复用 {len(r1_final)} 条，实际只共享 {n} 条"
    )
    # 首条即头部注入对（压缩后重注入生效），其后是摘要对
    assert CONTEXT_MARKER in r2_first[0]["content"]
    assert r2_first[2] == _COMPACTED_PAIR[0]
    # 无孤儿 tool_result（压缩边界回放不复活旧工具链）
    for req in provider.records:
        assert _orphan_tool_results(req) == []


def test_compacted_replay_with_skill_body(tmp_path):
    """压缩会话中 skill body 的自愈链：压缩吃掉旧 skill_context → 边界感知
    upsert 以新 seq 重插 → 轮 2 回放含 skill body（位置在摘要之后）。"""
    store = SessionsStore(tmp_path / "sessions.db")
    sid = store.find_or_create(SessionType.CHAT, "压缩技能").id

    provider = MockProvider()
    emitter = StubEmitter()
    sa = _make_compacting_agent(provider, emitter, tmp_path)
    _run_web_rounds(store, sid, sa, emitter, provider, ["第一轮", "第二轮"])

    # 边界感知重插（threshold=1 每轮都压缩，最近 boundary 可能又在重插
    # 之后——验「重插发生过」：skill_context ≥ 2 条且最后一条在**首个**
    # compacted 之后。无边界感知时第二次 upsert 会匹配旧条目跳过插入）
    items = store.get_detail(sid)
    compacted_seqs = sorted(it.seq for it in items if it.kind == "compacted")
    skill_seqs = sorted(it.seq for it in items if it.kind == "skill_context")
    assert len(compacted_seqs) >= 1
    assert len(skill_seqs) >= 2, (
        f"压缩后 skill_context 应重插（边界感知 upsert），实际条目 seq={skill_seqs}"
    )
    assert skill_seqs[-1] > compacted_seqs[0], (
        f"重插条目应在首个压缩边界之后：skills={skill_seqs} compacted={compacted_seqs}"
    )

    # 轮 2 请求含 skill body 与摘要对
    r2_first = provider.records[2]
    texts = [
        m["content"] for m in r2_first
        if m.get("role") == "user" and isinstance(m.get("content"), str)
    ]
    assert any("<loaded-skill" in t for t in texts), "轮 2 回放应含重插的 skill body"
    assert any(t.startswith("[Compressed.") for t in texts)
