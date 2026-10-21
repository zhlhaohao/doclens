# -*- coding: utf-8 -*-
"""AP-51：Agent 装配轻量化与资源回收。

三条独立缺陷：
1. `initialize` 283 行单函数（装配根集七件事于一身）；
2. 每轮 `run_query` 新建事件循环却从不 close —— CLI/TUI 每问泄漏一个 selector/fd；
3. `initialize` 里子线程建库 `join()` 无上界 —— 建库卡住会让首个 agent 请求
   永久挂起（且它在 deps 的 `_agent_lock` 内，后续请求全部排队）。
"""
import asyncio
import inspect
import threading
import time

import pytest

from doclens import agent_integration as ai


class _FakeIdx:
    def __init__(self, delay: float = 0.0, error: Exception | None = None):
        self.delay = delay
        self.error = error
        self.calls = 0
        self.finished = threading.Event()

    def load_or_build_index(self):
        self.calls += 1
        if self.delay:
            time.sleep(self.delay)
        if self.error:
            raise self.error
        self.finished.set()


class TestIndexBuildTimeout:
    def test_normal_build_returns(self):
        idx = _FakeIdx()
        ai._build_index_blocking(idx, timeout_sec=5)
        assert idx.calls == 1 and idx.finished.is_set()

    def test_timeout_raises_with_actionable_message(self):
        idx = _FakeIdx(delay=5)
        t0 = time.monotonic()
        with pytest.raises(TimeoutError) as ei:
            ai._build_index_blocking(idx, timeout_sec=0.05)
        elapsed = time.monotonic() - t0
        assert elapsed < 2, "必须在超时上界附近返回，不能等建库跑完"
        msg = str(ei.value)
        assert "CORTEX_INDEX_BUILD_TIMEOUT" in msg
        assert "doclens index" in msg

    def test_build_error_is_propagated(self):
        idx = _FakeIdx(error=RuntimeError("db locked"))
        with pytest.raises(RuntimeError, match="db locked"):
            ai._build_index_blocking(idx, timeout_sec=5)

    def test_timeout_env_override(self, monkeypatch):
        monkeypatch.setenv("CORTEX_INDEX_BUILD_TIMEOUT", "42")
        assert ai._index_build_timeout() == 42.0
        monkeypatch.setenv("CORTEX_INDEX_BUILD_TIMEOUT", "oops")
        assert ai._index_build_timeout() == ai.INDEX_BUILD_TIMEOUT_SEC
        monkeypatch.setenv("CORTEX_INDEX_BUILD_TIMEOUT", "-1")
        assert ai._index_build_timeout() == ai.INDEX_BUILD_TIMEOUT_SEC


class _LoopAgent(ai.CortexAgent):
    """跳过真实装配的 CortexAgent（只测循环生命周期）。"""

    def __init__(self):  # noqa: D107 - 不调父类 __init__（会建目录/记忆库）
        self.loop = None
        self.runtime = None


class TestEventLoopLifecycle:
    def test_loop_closed_after_run(self):
        agent = _LoopAgent()

        async def work():
            await asyncio.sleep(0)
            return "done"

        assert agent._run_blocking(work()) == "done"
        loop = agent.loop
        assert loop.is_closed(), "每轮新建的循环必须关闭（否则泄漏 fd）"
        # 已关闭的循环不得继续挂在线程的 current loop 上
        try:
            assert asyncio.get_event_loop() is not loop
        except RuntimeError:
            pass  # 3.13+：设 None 后 get_event_loop 直接抛，正是期望状态

    def test_loop_closed_even_when_coroutine_raises(self):
        agent = _LoopAgent()

        async def boom():
            raise ValueError("agent failed")

        with pytest.raises(ValueError, match="agent failed"):
            agent._run_blocking(boom())
        assert agent.loop.is_closed()

    def test_pending_tasks_cancelled_before_close(self):
        """中断路径遗留的未完成任务必须被取消，否则 close 后仍会跑一步。"""
        agent = _LoopAgent()
        started = threading.Event()

        async def long_running():
            started.set()
            try:
                await asyncio.sleep(30)
            finally:
                pass

        async def main():
            asyncio.ensure_future(long_running())
            await asyncio.sleep(0.05)  # 让后台任务真正开始

        agent._run_blocking(main())
        assert started.is_set()
        assert agent.loop.is_closed()

    def test_python_warns_no_unclosed_loop(self, recwarn):
        agent = _LoopAgent()

        async def work():
            return 1

        agent._run_blocking(work())
        assert not [
            w for w in recwarn
            if issubclass(w.category, ResourceWarning) and "unclosed" in str(w.message)
        ]


class TestInitializeSplit:
    """结构回归：装配根保持编排者的体量，细节落在各阶段。"""

    def test_initialize_is_thin(self):
        src = inspect.getsource(ai.CortexAgent.initialize)
        body = [ln for ln in src.splitlines() if ln.strip() and not ln.strip().startswith(("#", '"'))]
        assert len(body) <= 20, f"initialize 仍过长（{len(body)} 行非空非注释）: {body}"

    def test_stage_methods_exist(self):
        for name in (
            "_stage_env", "_stage_dirs", "_stage_runtime", "_stage_skills",
            "_stage_knowledge_base", "_stage_tools", "_stage_assemble",
        ):
            assert callable(getattr(ai.CortexAgent, name)), name

    def test_no_loop_created_in_initialize(self):
        """initialize 不再创建一个「建了不用也不关」的事件循环。"""
        src = inspect.getsource(ai.CortexAgent.initialize)
        assert "new_event_loop" not in src
        assert "set_event_loop" not in src
