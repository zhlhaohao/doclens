# -*- coding: utf-8 -*-
"""TranslationService 预设解析与单例生命周期（AP-17）。

覆盖：
- 未配置预设 = 合法默认（google，无告警）
- 配置了但预设不存在 / 内容不可读 / 读取异常 → 置 `_preset_error` 并降级，
  由 `_execute` 推 toast（不静默、也不让任务失败）
- 预设只解析一次（原 `_service_from_preset` / `_envs_from_preset` 各读一遍）
- 单例重置（工作目录切换后不残留旧 workdir）
"""
from __future__ import annotations

import pytest


@pytest.fixture()
def svc(tmp_path, monkeypatch):
    """不启动后台线程的 TranslationService（只测解析逻辑）。"""
    from doclens.translate_service import TranslationService

    monkeypatch.delenv("CORTEX_ACTIVE_TRANSLATE_PRESET", raising=False)
    monkeypatch.delenv("CORTEX_TRANSLATE_SERVICE", raising=False)
    return TranslationService(str(tmp_path))


class TestPresetResolution:
    def test_unconfigured_is_legal_default(self, svc):
        """完全未配置 → google + 空 envs，且**不**置降级原因。"""
        service, envs = svc._preset_or_default()
        assert service == "google"
        assert envs == {}
        assert svc._preset_error is None

    def test_active_preset_missing_records_error(self, svc, monkeypatch):
        """激活键非空但预设库里没有同名项（被删/改名）→ 记录原因后降级。"""
        monkeypatch.setenv("CORTEX_ACTIVE_TRANSLATE_PRESET", "ghost-preset")
        service, envs = svc._preset_or_default()
        assert service == "google"
        assert envs == {}
        assert svc._preset_error is not None
        assert "ghost-preset" in svc._preset_error
        assert "不存在" in svc._preset_error

    def test_materialized_env_fallback_no_error(self, svc, monkeypatch):
        """激活预设已删但仍留有物化 env → 用 env 值，不算失败。"""
        monkeypatch.setenv("CORTEX_ACTIVE_TRANSLATE_PRESET", "gone")
        monkeypatch.setenv("CORTEX_TRANSLATE_SERVICE", "bing")
        monkeypatch.setenv("CORTEX_TRANSLATE_MODEL", "m1")
        service, envs = svc._preset_or_default()
        assert service == "bing"
        assert envs == {}
        # 仍报了「预设不存在」——但实际用了物化值，属可接受的部分降级
        assert svc._preset_error is not None

    def test_read_exception_records_error(self, svc, monkeypatch):
        """presets_store 读取抛异常 → 记录原因，不向上抛。"""
        import doclens.web_v2.presets_store as ps

        def _boom(*_a, **_k):
            raise RuntimeError("store corrupt")

        monkeypatch.setenv("CORTEX_ACTIVE_TRANSLATE_PRESET", "any")
        monkeypatch.setattr(ps, "list_presets", _boom)
        service, envs = svc._preset_or_default()
        assert service == "google"
        assert envs == {}
        assert svc._preset_error is not None
        assert "读取失败" in svc._preset_error

    def test_preset_parsed_once_per_job(self, svc, monkeypatch):
        """一次任务只读一遍预设库（原实现读两遍）。"""
        import doclens.web_v2.presets_store as ps

        calls: list[int] = []
        monkeypatch.setattr(ps, "list_presets", lambda kind: calls.append(1) or [])
        monkeypatch.setenv("CORTEX_ACTIVE_TRANSLATE_PRESET", "x")
        svc._preset_or_default()
        assert len(calls) == 1


class TestToastEmission:
    def test_execute_emits_toast_on_degradation(self, svc, monkeypatch):
        """`_execute` 在降级时向订阅者推 toast 事件（任务继续跑）。"""
        import doclens.translate_service as ts_mod
        from doclens.translate_service import TranslateJob

        monkeypatch.setenv("CORTEX_ACTIVE_TRANSLATE_PRESET", "ghost")
        job = TranslateJob(
            job_id="j1",
            source_path="a.pdf",
            lang_in="en",
            lang_out="zh",
            outputs="both",
            pages=None,
            ultrafast=False,
            ignore_cache=False,
        )
        events: list[dict] = []
        job._subscribers.append(events.append)

        # 引擎调用替换掉（本用例只验事件）
        import doclens.vendor_pdf2zh.high_level as hl

        # _execute 的 finally 会起 threading.Timer(600s)（非 daemon）——
        # 不拦截会让 pytest 退出时干等 10 分钟。
        class _NoTimer:
            def __init__(self, *_a, **_k):
                pass

            def start(self):
                pass

        monkeypatch.setattr(ts_mod.threading, "Timer", _NoTimer)

        monkeypatch.setattr(hl, "translate", lambda *a, **k: [])
        monkeypatch.setattr(svc, "_ensure_engine", lambda: None)
        monkeypatch.setattr(svc, "_load_model", lambda: None)
        monkeypatch.setattr(svc, "_finalize_outputs", lambda job, res: [])
        monkeypatch.setattr(svc, "_jobs", {"j1": job})
        monkeypatch.setattr(svc, "_order", ["j1"])

        svc._execute(job)

        toasts = [e for e in events if e.get("type") == "toast"]
        assert len(toasts) == 1
        assert "ghost" in toasts[0]["message"]
        assert job.status == "done"  # 降级不阻断任务


class TestSingletonLifecycle:
    def test_reset_discards_instance(self, monkeypatch):
        """reset_translation_service 丢弃单例（工作目录切换不残留旧 workdir）。"""
        import doclens.translate_service as ts

        class _Fake:
            stopped = False

            def stop(self):
                _Fake.stopped = True

        monkeypatch.setattr(ts, "_service", _Fake())
        ts.reset_translation_service()
        assert ts._service is None
        assert _Fake.stopped is True

    def test_deps_reset_hook_present(self):
        """deps 提供重置钩子且被 swap/reset 路径调用（AP-17 接线）。"""
        import inspect

        from doclens.web_v2 import deps

        assert callable(deps._reset_translate_service)
        src = inspect.getsource(deps.reset_singletons)
        assert "_reset_translate_service" in src
        src_swap = inspect.getsource(deps.swap_workdir)
        assert "_reset_translate_service" in src_swap


class TestCancellation:
    """AP-39：running 态取消必须是真取消。

    旧实现：`job._loop.call_soon_threadsafe(...)` 投递到 `new_event_loop()`
    后从不 run_forever 的壳 loop —— 回调永不执行，引擎的 `is_set()` 轮询
    永不置位，任务照常跑完并变 done。
    """

    def _job(self, tmp_path):
        from doclens.translate_service import TranslateJob

        return TranslateJob(
            job_id="j1", source_path="a.pdf", lang_in="en", lang_out="zh",
            outputs="both", pages=None, ultrafast=False, ignore_cache=False,
        )

    def _drive(self, svc, job, monkeypatch, translate_impl):
        """把 _execute 跑在后台线程（模拟真实服务线程），返回线程句柄。"""
        import threading

        import doclens.translate_service as ts_mod
        import doclens.vendor_pdf2zh.high_level as hl

        class _NoTimer:
            def __init__(self, *_a, **_k):
                pass

            def start(self):
                pass

        monkeypatch.setattr(ts_mod.threading, "Timer", _NoTimer)
        monkeypatch.setattr(hl, "translate", translate_impl)
        monkeypatch.setattr(svc, "_ensure_engine", lambda: None)
        monkeypatch.setattr(svc, "_load_model", lambda: None)
        monkeypatch.setattr(svc, "_finalize_outputs", lambda j, res: [])
        monkeypatch.setattr(svc, "_jobs", {"j1": job})
        monkeypatch.setattr(svc, "_order", ["j1"])
        t = threading.Thread(target=svc._execute, args=(job,), daemon=True)
        t.start()
        return t

    def test_running_cancel_aborts_job(self, svc, tmp_path, monkeypatch):
        """引擎轮询到 is_set() → 抛 CancelledError → 任务转 cancelled。"""
        import threading
        import time as _t

        started = threading.Event()
        observed = []

        def fake_translate(*_a, cancellation_event=None, **_k):
            started.set()
            # 引擎的真实语义：每页前 `if cancellation_event.is_set(): raise`
            for _ in range(200):          # 最多等 2s
                if cancellation_event is not None and cancellation_event.is_set():
                    observed.append(True)
                    raise __import__("asyncio").CancelledError("task cancelled")
                _t.sleep(0.01)
            observed.append(False)
            return []

        job = self._job(tmp_path)
        t = self._drive(svc, job, monkeypatch, fake_translate)
        assert started.wait(5), "引擎未启动"

        assert svc.cancel("j1") is True, "running 态取消必须被接受"
        t.join(5)
        assert not t.is_alive()
        assert observed == [True], "引擎必须看到取消信号（旧实现在此为 False）"
        assert job.status == "cancelled"
        assert job.finished_at is not None

    def test_cancel_emits_cancelled_event(self, svc, tmp_path, monkeypatch):
        import threading
        import time as _t

        started = threading.Event()

        def fake_translate(*_a, cancellation_event=None, **_k):
            started.set()
            for _ in range(200):
                if cancellation_event is not None and cancellation_event.is_set():
                    raise __import__("asyncio").CancelledError()
                _t.sleep(0.01)
            return []

        job = self._job(tmp_path)
        events: list[dict] = []
        job._subscribers.append(events.append)
        t = self._drive(svc, job, monkeypatch, fake_translate)
        assert started.wait(5)
        svc.cancel("j1")
        t.join(5)
        assert [e["type"] for e in events][-1] == "cancelled"

    def test_cancellation_is_threading_event(self, svc, tmp_path, monkeypatch):
        """信号类型必须是 threading.Event——asyncio.Event 跨线程不可见。"""
        import threading
        import time as _t

        started = threading.Event()
        seen: list[type] = []

        def fake_translate(*_a, cancellation_event=None, **_k):
            seen.append(type(cancellation_event))
            started.set()
            for _ in range(100):
                if cancellation_event.is_set():
                    raise __import__("asyncio").CancelledError()
                _t.sleep(0.01)
            return []

        job = self._job(tmp_path)
        t = self._drive(svc, job, monkeypatch, fake_translate)
        assert started.wait(5)
        svc.cancel("j1")
        t.join(5)
        assert seen == [threading.Event]

    def test_cancel_queued_still_works(self, svc):
        """queued 态（从未进 running）取消路径保持不变。"""
        from doclens.translate_service import TranslateJob

        job = TranslateJob(
            job_id="q1", source_path="a.pdf", lang_in="en", lang_out="zh",
            outputs="both", pages=None, ultrafast=False, ignore_cache=False,
        )
        events: list[dict] = []
        job._subscribers.append(events.append)
        import doclens.translate_service as ts_mod

        # 绕过 submit 的文件校验，直接摆进队列
        svc._jobs["q1"] = job
        svc._order.append("q1")
        assert svc.cancel("q1") is True
        assert job.status == "cancelled"
        assert events[-1]["type"] == "cancelled"

    def test_cancel_unknown_returns_false(self, svc):
        assert svc.cancel("nope") is False
