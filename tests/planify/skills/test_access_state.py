"""SkillAccessState 与 session_id ContextVar 单元测试。"""
import threading

import pytest

from planify.skills.access_state import (
    SkillAccessState,
    get_current_session_id,
    mark_loaded_if_known,
    reset_current_session_id,
    set_current_session_id,
)


def test_mark_and_is_loaded_session_isolation():
    state = SkillAccessState()
    state.mark_loaded("s1", "knowledge-base")
    assert state.is_loaded("s1", "knowledge-base")
    assert not state.is_loaded("s1", "other")
    assert not state.is_loaded("s2", "knowledge-base")  # session 隔离


def test_loaded_names_returns_copy():
    state = SkillAccessState()
    state.mark_loaded("s1", "knowledge-base")
    names = state.loaded_names("s1")
    names.add("mutated")  # 副本，不污染内部
    assert state.loaded_names("s1") == {"knowledge-base"}


def test_clear_removes_session():
    state = SkillAccessState()
    state.mark_loaded("s1", "knowledge-base")
    state.clear("s1")
    assert not state.is_loaded("s1", "knowledge-base")


def test_empty_session_id_is_noop():
    state = SkillAccessState()
    state.mark_loaded("", "knowledge-base")
    assert not state.is_loaded("", "knowledge-base")
    assert state.loaded_names("") == set()


def test_concurrent_mark_loaded_is_threadsafe():
    state = SkillAccessState()

    def worker():
        for _ in range(200):
            state.mark_loaded("s1", "knowledge-base")

    threads = [threading.Thread(target=worker) for _ in range(10)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert state.is_loaded("s1", "knowledge-base")


def test_contextvar_set_get_reset():
    assert get_current_session_id() == ""
    token = set_current_session_id("abc")
    try:
        assert get_current_session_id() == "abc"
    finally:
        reset_current_session_id(token)
    assert get_current_session_id() == ""


def test_mark_loaded_if_known_marks_on_real_body():
    state = SkillAccessState()
    set_current_session_id("s1")
    mark_loaded_if_known(state, get_current_session_id(), "knowledge-base", "<skill>...</skill>")
    assert state.is_loaded("s1", "knowledge-base")


def test_mark_loaded_if_known_skips_error_body():
    state = SkillAccessState()
    mark_loaded_if_known(state, "s1", "knowledge-base", "Error: Unknown skill 'x'")
    assert not state.is_loaded("s1", "knowledge-base")


def test_mark_loaded_if_known_noop_without_state_or_session():
    mark_loaded_if_known(None, "s1", "knowledge-base", "body")  # 不抛异常
    state = SkillAccessState()
    mark_loaded_if_known(state, "", "knowledge-base", "body")
    assert not state.is_loaded("", "knowledge-base")
