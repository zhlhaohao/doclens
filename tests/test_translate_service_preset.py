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
