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
