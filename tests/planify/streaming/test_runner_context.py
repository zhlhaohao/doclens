"""验证 _refresh_or_insert_context：刷新或插入 skill-context 消息。

以及 ContextVar 跨线程传播：StreamingAgent._execute_tools 通过
asyncio.to_thread 运行同步 handler，必须保证 ContextVar（如 session_id）
能进入 worker 线程，门禁才不会被静默跳过。
"""
import asyncio

from planify.skills.access_state import (
    get_current_session_id,
    reset_current_session_id,
    set_current_session_id,
)
from planify.streaming.runner import _refresh_or_insert_context


def test_inserts_when_marker_absent():
    messages = [{"role": "user", "content": "hi"}]
    _refresh_or_insert_context(messages, "MARKER", "ctx-MARKER-body")
    assert messages[0]["content"] == "ctx-MARKER-body"
    assert messages[0]["role"] == "user"
    assert messages[1] == {"role": "assistant", "content": "Noted."}
    assert messages[2]["content"] == "hi"  # 原消息后移


def test_replaces_when_marker_present():
    messages = [
        {"role": "user", "content": "old-MARKER-old"},
        {"role": "assistant", "content": "Noted."},
        {"role": "user", "content": "hi"},
    ]
    _refresh_or_insert_context(messages, "MARKER", "new-MARKER-new")
    assert messages[0]["content"] == "new-MARKER-new"
    assert messages[1] == {"role": "assistant", "content": "Noted."}
    assert messages[2]["content"] == "hi"
    assert len(messages) == 3  # 不新增


def test_replaces_in_first_six_slots_only():
    messages = [
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "q2"},
        {"role": "assistant", "content": "a2"},
        {"role": "user", "content": "q3"},
        {"role": "assistant", "content": "a3"},
        {"role": "user", "content": "deep-MARKER-old"},  # 超出前 6，忽略
    ]
    _refresh_or_insert_context(messages, "MARKER", "fresh-MARKER")
    assert messages[0]["content"] == "fresh-MARKER"
    assert messages[-1]["content"] == "deep-MARKER-old"  # 未被替换


def test_contextvar_propagates_through_asyncio_to_thread():
    """回归测试：gate/load_skill 依赖 ContextVar 跨线程传播到 executor。

    asyncio.to_thread 通过 contextvars.copy_context() 复制上下文；默认
    ThreadPoolExecutor + run_in_executor 不会复制，会让门禁在生产中静默失效。
    """
    set_current_session_id("test-session")
    try:
        observed: list[str] = []

        def worker():
            observed.append(get_current_session_id())

        async def driver():
            await asyncio.to_thread(worker)

        asyncio.run(driver())
    finally:
        reset_current_session_id(set_current_session_id(""))

    assert observed == ["test-session"], (
        f"ContextVar did not propagate into to_thread worker; got {observed}"
    )


def test_gated_handler_sees_session_via_to_thread():
    """端到端：通过 asyncio.to_thread 调用 gate_skill 包裹的 handler，
    证明门禁能在 StreamingAgent._execute_tools 的执行路径上读到 session_id。"""
    from planify.skills.access_state import SkillAccessState
    from doclens.skill_gate import KB_SKILL, gate_skill

    state = SkillAccessState()
    state.mark_loaded("s1", KB_SKILL)
    set_current_session_id("s1")
    try:
        observed: list[str] = []

        def real_handler(**kw):
            observed.append(get_current_session_id())
            return "RESULTS"

        gated = gate_skill(state, KB_SKILL, "search_kb", real_handler)

        async def driver():
            return await asyncio.to_thread(gated, query="x")

        out = asyncio.run(driver())
    finally:
        reset_current_session_id(set_current_session_id(""))

    assert out == "RESULTS"
    assert observed == ["s1"]
