# -*- coding: utf-8 -*-
"""deps 单例锁粒度（AP-6）。

冷启动建库/全库审计曾是分钟级，且与登录闸门、会话库、配置读取共用同一把
全局锁——登录页在索引构建完成前一律无响应。本文件锁定拆分后的契约：

1. `get_index_manager()` 构造期持 `_idx_lock`，不再占用注册表 `_lock`；
2. 建库进行中，`get_sessions_store()`（鉴权/登录路径）可立即返回；
3. 建库进行中，`get_config()` 可立即返回；
4. 建库异常路径仍抛给调用方且不发布半成品单例。

注：reset/切换仍需等构造完成（`_singleton_guards()` 语义）——它们要求
"没有构造在进行中"，与拆锁前一致。
"""
import threading

import pytest


@pytest.fixture()
def deps_env(tmp_path, monkeypatch):
    """干净的 deps 模块状态：临时数据目录 + 可控配置。"""
    from doclens.config import CortexConfig
    from doclens.web_v2 import deps

    for name in ("_idx_manager", "_sessions_store", "_agent", "_config"):
        monkeypatch.setattr(deps, name, None, raising=False)
    # AP-36 新增的失败记忆也是模块级状态——不重置会让用例间互相污染
    monkeypatch.setattr(deps, "_idx_init_error", None, raising=False)
    monkeypatch.setattr(deps, "_idx_init_failed_at", 0.0, raising=False)

    data_dir = tmp_path / ".cortex"
    data_dir.mkdir()
    cfg = CortexConfig(search_path=str(tmp_path), index_path=str(data_dir / "index.db"))
    monkeypatch.setattr(deps, "_config", cfg, raising=False)
    return deps, cfg


class _SlowIndexManager:
    """load_or_build_index 阻塞到测试放行——模拟分钟级冷启动建库。"""

    started = threading.Event()
    release = threading.Event()

    def __init__(self, config):
        self._config = config
        self.search_path = config.search_path
        self.index_path = config.index_path

    def load_or_build_index(self):
        type(self).started.set()
        assert type(self).release.wait(10), "测试未放行建库"

    def indexed_doc_count(self):
        return 0

    def apply_config(self, config):  # reload_config 可能需要
        self._config = config


@pytest.fixture()
def slow_build(deps_env, monkeypatch):
    deps, cfg = deps_env
    _SlowIndexManager.started = threading.Event()
    _SlowIndexManager.release = threading.Event()
    monkeypatch.setattr(deps, "IndexManager", _SlowIndexManager)
    yield deps, cfg
    _SlowIndexManager.release.set()


class _Caller:
    """在后台线程调用 fn，记录是否在给定时间内返回。"""

    def __init__(self, fn):
        self.done = threading.Event()
        self.value = None
        self.error = None
        self.thread = threading.Thread(target=self._run, args=(fn,), daemon=True)
        self.thread.start()

    def _run(self, fn):
        try:
            self.value = fn()
        except Exception as exc:  # noqa: BLE001
            self.error = exc
        finally:
            self.done.set()

    def wait(self, timeout):
        return self.done.wait(timeout)


def _start_build(deps):
    """起一个后台 get_index_manager()，等假建库真正开始。"""
    caller = _Caller(deps.get_index_manager)
    assert not caller.wait(0.3), "前提：建库仍在进行（假实现本应阻塞）"
    assert _SlowIndexManager.started.wait(5), "假建库未启动"
    return caller


class TestIndexBuildDoesNotBlockAuthPath:
    def test_sessions_store_available_during_build(self, slow_build):
        deps, _cfg = slow_build
        build = _start_build(deps)
        try:
            auth = _Caller(deps.get_sessions_store)
            assert auth.wait(5.0), "建库期间 get_sessions_store 被锁阻塞（AP-6 回归）"
            assert auth.error is None, auth.error
            assert auth.value is not None
        finally:
            _SlowIndexManager.release.set()
            build.thread.join(5)

    def test_config_available_during_build(self, slow_build):
        deps, cfg = slow_build
        build = _start_build(deps)
        try:
            getter = _Caller(deps.get_config)
            assert getter.wait(5.0), "建库期间 get_config 被锁阻塞（AP-6 回归）"
            assert getter.value is cfg
        finally:
            _SlowIndexManager.release.set()
            build.thread.join(5)

    def test_second_caller_waits_then_reuses_singleton(self, slow_build):
        """第二个调用排在同一把构造锁上（不重复建库），建库完成后拿到同一实例。"""
        deps, _cfg = slow_build
        build = _start_build(deps)
        ctor_calls = []
        orig_init = _SlowIndexManager.__init__

        def _counting_init(self, config):
            ctor_calls.append(1)
            orig_init(self, config)

        _SlowIndexManager.__init__ = _counting_init
        try:
            second = _Caller(deps.get_index_manager)
            assert not second.wait(0.3), "第二个调用不应越过进行中的构造"
            _SlowIndexManager.release.set()
            assert second.wait(5), "建库完成后第二个调用应返回"
            assert len(ctor_calls) == 0, "构造被重复执行"
            assert second.value is deps._idx_manager
        finally:
            _SlowIndexManager.__init__ = orig_init
            _SlowIndexManager.release.set()
            build.thread.join(5)

    def test_build_failure_still_raises(self, deps_env, monkeypatch):
        """构造异常路径保持原语义：抛给调用方，且不发布半成品单例。"""
        deps, _cfg = deps_env

        class _Boom:
            def __init__(self, config):
                self.search_path = config.search_path

            def load_or_build_index(self):
                raise RuntimeError("db broken")

        monkeypatch.setattr(deps, "IndexManager", _Boom)
        with pytest.raises(RuntimeError, match="db broken"):
            deps.get_index_manager()
        assert deps._idx_manager is None


class TestSwapStateSnapshot:
    """AP-24：切换状态整体替换——读方不可能观察到自相矛盾的中间态。"""

    def test_swap_status_shape(self):
        from doclens.web_v2 import deps
        st = deps.swap_status()
        assert st == {"swapping": False, "target": None}  # 对外仍是 dict（前端契约）
        assert deps.is_swapping() is False

    def test_reader_never_sees_half_state(self):
        """高频读 vs 高频整体替换：任何快照的两个键必须自洽。

        旧实现（dict.update 双键）在此测试下可撕读出 (True, None) 或
        (False, <旧target>)；不可变替换在结构上杜绝。
        """
        import threading
        from doclens.web_v2 import deps
        import doclens.web_v2.deps as d

        stop = threading.Event()
        bad = []

        def _writer():
            i = 0
            while not stop.is_set():
                d._swap_state = d._SwapState(swapping=True, target=f"D{i}")
                d._swap_state = d._SwapState(swapping=False, target=None)
                i += 1

        def _reader():
            while not stop.is_set():
                st = d.swap_status()
                swapping, target = st["swapping"], st["target"]
                # 自洽性：swapping=True 必有 target；swapping=False 必无
                if swapping and target is None:
                    bad.append(("half-on", st))
                if not swapping and target is not None:
                    bad.append(("half-off", st))

        w = threading.Thread(target=_writer, daemon=True)
        rs = [threading.Thread(target=_reader, daemon=True) for _ in range(3)]
        w.start()
        for r in rs:
            r.start()
        import time as _t
        _t.sleep(0.5)
        stop.set()
        w.join(2)
        for r in rs:
            r.join(2)
        assert bad == [], bad[:3]


class TestResetSingletons:
    """AP-23：reset 的 global 列表必须覆盖全部单例赋值（曾漏 _mcp_client）。"""

    def test_reset_mcp_client_without_stop_fallback(self, monkeypatch):
        """摘掉 stop_mcp_client 的间接重置后，reset 仍必须清 _mcp_client。

        旧行为：global 列表漏名 → 赋值落局部变量 → 残留旧实例。
        """
        from doclens.web_v2 import deps
        import doclens.web_v2.deps as d

        monkeypatch.setattr(d, "_mcp_client", object(), raising=False)
        # no-op 掉所有 stop_*（隔离"stop 内部顺手重置"的兜底路径）
        for name in ("stop_watcher", "stop_vision_worker", "stop_diary_worker",
                     "stop_git_sync", "stop_mcp_server", "stop_mcp_client"):
            monkeypatch.setattr(d, name, lambda: None)
        d.reset_singletons()
        assert d._mcp_client is None


class TestIndexInitFailureMemory:
    """AP-36：构造失败必须留记忆——否则每个请求都重跑分钟级建库并排队。"""

    class _Boom:
        calls = 0

        def __init__(self, config):
            self.search_path = config.search_path
            self.index_path = config.index_path

        def load_or_build_index(self):
            type(self).calls += 1
            raise RuntimeError("db broken")

        def indexed_doc_count(self):
            return 0

    def test_second_call_fast_fails_without_rebuilding(self, deps_env, monkeypatch):
        deps, _cfg = deps_env
        self._Boom.calls = 0
        monkeypatch.setattr(deps, "IndexManager", self._Boom)
        monkeypatch.setattr(deps, "_IDX_INIT_COOLDOWN_SEC", 60.0)

        with pytest.raises(RuntimeError, match="db broken"):
            deps.get_index_manager()
        assert self._Boom.calls == 1

        # 冷却期内：立即失败，不再进入建库
        import time as _t
        t0 = _t.monotonic()
        with pytest.raises(deps.IndexInitError) as ei:
            deps.get_index_manager()
        assert _t.monotonic() - t0 < 0.5, "冷却期内必须快速失败"
        assert self._Boom.calls == 1, "不得重跑建库"
        assert isinstance(ei.value.__cause__, RuntimeError)
        assert "db broken" in str(ei.value)

    def test_concurrent_callers_do_not_stampede(self, deps_env, monkeypatch):
        """8 个线程同时抢救：只有一次真正建库，其余全部快速失败。"""
        deps, _cfg = deps_env
        self._Boom.calls = 0
        monkeypatch.setattr(deps, "IndexManager", self._Boom)
        monkeypatch.setattr(deps, "_IDX_INIT_COOLDOWN_SEC", 60.0)

        barrier = threading.Barrier(8)
        errors = []

        def call():
            barrier.wait()
            try:
                deps.get_index_manager()
            except Exception as exc:  # noqa: BLE001
                errors.append(exc)

        threads = [threading.Thread(target=call) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(10)

        assert len(errors) == 8
        assert self._Boom.calls == 1, f"建库跑了 {self._Boom.calls} 次"
        assert sum(isinstance(e, deps.IndexInitError) for e in errors) == 7

    def test_expired_cooldown_retries(self, deps_env, monkeypatch):
        """冷却期过期后允许重试（自愈），成功的调用清空记忆。"""
        deps, _cfg = deps_env
        self._Boom.calls = 0
        monkeypatch.setattr(deps, "IndexManager", self._Boom)
        monkeypatch.setattr(deps, "_IDX_INIT_COOLDOWN_SEC", 0.05)

        with pytest.raises(RuntimeError, match="db broken"):
            deps.get_index_manager()
        assert deps.idx_init_retry_after() >= 0
        import time as _t
        _t.sleep(0.08)

        class _Ok(self._Boom):
            def load_or_build_index(self):
                type(self).calls += 1

        monkeypatch.setattr(deps, "IndexManager", _Ok)
        mgr = deps.get_index_manager()
        assert mgr is not None
        assert deps._idx_init_error is None
        assert deps.idx_init_retry_after() == 0

    def test_reset_clears_failure_memory(self, deps_env, monkeypatch):
        """reset 后立刻可重试（否则测试/切库会被 30s 冷却挡住）。"""
        deps, _cfg = deps_env
        monkeypatch.setattr(deps, "IndexManager", self._Boom)
        monkeypatch.setattr(deps, "_IDX_INIT_COOLDOWN_SEC", 60.0)
        with pytest.raises(RuntimeError):
            deps.get_index_manager()
        assert deps._idx_init_error is not None

        monkeypatch.setattr(deps, "IndexManager", _SlowIndexManager)
        _SlowIndexManager.started = threading.Event()
        _SlowIndexManager.release = threading.Event()
        _SlowIndexManager.release.set()
        deps.reset_singletons()
        assert deps._idx_init_error is None
        assert deps.get_index_manager() is not None

    def test_retry_after_counts_down(self, deps_env, monkeypatch):
        deps, _cfg = deps_env
        monkeypatch.setattr(deps, "IndexManager", self._Boom)
        monkeypatch.setattr(deps, "_IDX_INIT_COOLDOWN_SEC", 30.0)
        with pytest.raises(RuntimeError):
            deps.get_index_manager()
        assert 25 <= deps.idx_init_retry_after() <= 30


class TestIndexInitErrorResponse:
    """AP-36：索引不可用对客户端是 503 + retry_after，而非 500 内部错误。"""

    def test_handler_maps_to_503(self, deps_env, monkeypatch):
        deps, _cfg = deps_env
        monkeypatch.setattr(deps, "IndexManager", TestIndexInitFailureMemory._Boom)
        monkeypatch.setattr(deps, "_IDX_INIT_COOLDOWN_SEC", 30.0)
        with pytest.raises(RuntimeError):
            deps.get_index_manager()

        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        from doclens.web_v2.api.errors import register_error_handlers

        app = FastAPI()
        register_error_handlers(app)

        @app.get("/probe")
        async def probe():
            deps.get_index_manager()

        r = TestClient(app).get("/probe")
        assert r.status_code == 503
        body = r.json()
        assert body["code"] == "INDEX_INIT_FAILED"
        assert "db broken" in body["detail"]   # 原因对用户可见（这是可重试故障）
        assert 25 <= body["retry_after"] <= 30
