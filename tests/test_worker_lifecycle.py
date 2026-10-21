# -*- coding: utf-8 -*-
"""worker stop 超时后不得起第二条线程（AP-43）。

旧行为：四个 worker（vision/diary/git_sync/translate）与 mcp_client 都是
``join(timeout)`` 之后无条件清引用 + 置 ``running=False``。在途视觉调用
5-60s、git push 120s、整本 PDF 翻译数分钟——超时是常态。切库流程紧接着
重启组件，于是新旧两个消费者并存：旧线程把产物写回旧 index_path / 旧
workdir，两条 MCP loop 并发改同一张连接表。
"""
import threading
import time

import pytest

from doclens.worker_lifecycle import WorkerStopState, join_thread


class TestJoinHelper:
    def test_none_thread_is_stopped(self):
        assert join_thread(None, 0.01) is True

    def test_finished_thread_reports_true(self):
        t = threading.Thread(target=lambda: None)
        t.start()
        assert join_thread(t, 5) is True

    def test_stuck_thread_reports_false(self):
        release = threading.Event()
        t = threading.Thread(target=release.wait, args=(5,), daemon=True)
        t.start()
        try:
            assert join_thread(t, 0.05) is False
        finally:
            release.set()
            t.join(5)


class TestStopState:
    def test_can_start_allows_when_thread_dead(self):
        st = WorkerStopState()
        t = threading.Thread(target=lambda: None)
        t.start()
        t.join()
        assert st.can_start("w", t) is True

    def test_can_start_refuses_while_stopping(self):
        st = WorkerStopState()
        release = threading.Event()
        t = threading.Thread(target=release.wait, args=(5,), daemon=True)
        t.start()
        try:
            st.begin()
            assert st.stopping is True
            assert st.can_start("w", t) is False
        finally:
            release.set()
            t.join(5)

    def test_can_start_refuses_duplicate_running(self):
        st = WorkerStopState()
        release = threading.Event()
        t = threading.Thread(target=release.wait, args=(5,), daemon=True)
        t.start()
        try:
            assert st.can_start("w", t) is False
        finally:
            release.set()
            t.join(5)

    def test_clear_resets(self):
        st = WorkerStopState()
        st.begin()
        st.clear()
        assert st.stopping is False


# ---------------------------------------------------------------- 各 worker


def _stuck_thread():
    release = threading.Event()
    t = threading.Thread(target=release.wait, args=(10,), daemon=True)
    t.start()
    return t, release


class TestVisionWorkerStop:
    def _worker(self, tmp_path):
        from doclens.vision_worker import VisionWorker

        return VisionWorker(None, lambda: None)

    def test_timeout_keeps_thread_and_blocks_restart(self, tmp_path, monkeypatch):
        w = self._worker(tmp_path)
        t, release = _stuck_thread()
        w._thread = t
        monkeypatch.setattr(w, "_ensure_engine", lambda: None, raising=False)
        try:
            assert w.stop(timeout=0.05) is False
            assert w.stopping is True
            assert w._thread is t, "超时不得丢弃旧线程引用"
            assert w.status()["stopping"] is True
            # start 必须拒绝（否则起第二条消费者）
            assert w.start() is False
            assert w._thread is t
        finally:
            release.set()
            t.join(5)

    def test_success_clears_state(self, tmp_path):
        w = self._worker(tmp_path)
        t = threading.Thread(target=lambda: None)
        t.start()
        t.join()
        w._thread = t
        assert w.stop(timeout=1) is True
        assert w._thread is None
        assert w.stopping is False


class TestDiaryWorkerStop:
    def _worker(self, tmp_path):
        from doclens.diary_worker import DiaryWorker

        return DiaryWorker(None, lambda: None)

    def test_timeout_blocks_restart(self, tmp_path):
        w = self._worker(tmp_path)
        t, release = _stuck_thread()
        w._thread = t
        try:
            assert w.stop(timeout=0.05) is False
            assert w.stopping is True
            assert w.start() is False
        finally:
            release.set()
            t.join(5)

    def test_success_clears_state(self, tmp_path):
        w = self._worker(tmp_path)
        t = threading.Thread(target=lambda: None)
        t.start()
        t.join()
        w._thread = t
        assert w.stop(timeout=1) is True
        assert w._thread is None and w.stopping is False


class TestGitSyncStop:
    def _worker(self, tmp_path):
        from doclens.git_sync import GitSync

        return GitSync(str(tmp_path))

    def test_timeout_blocks_restart(self, tmp_path, monkeypatch):
        w = self._worker(tmp_path)
        t, release = _stuck_thread()
        w._thread = t
        try:
            assert w.stop(timeout=0.05) is False
            assert w.stopping is True
            assert w.status()["stopping"] is True
            # start() 在停止中直接拒绝，不进入 git 探测
            monkeypatch.setattr(w, "_is_git_root", lambda: pytest.fail("不应进入探测"))
            assert w.start() is False
        finally:
            release.set()
            t.join(5)

    def test_success_clears_state(self, tmp_path):
        w = self._worker(tmp_path)
        t = threading.Thread(target=lambda: None)
        t.start()
        t.join()
        w._thread = t
        assert w.stop(timeout=1) is True
        assert w._thread is None and w.stopping is False


class TestTranslationServiceStop:
    def _worker(self, tmp_path):
        from doclens.translate_service import TranslationService

        return TranslationService(str(tmp_path))

    def test_timeout_blocks_restart(self, tmp_path):
        w = self._worker(tmp_path)
        t, release = _stuck_thread()
        w._thread = t
        try:
            assert w.stop(timeout=0.05) is False
            assert w.stopping is True
            w.start()   # 不抛，但不得新建线程
            assert w._thread is t
        finally:
            release.set()
            t.join(5)

    def test_success_clears_state(self, tmp_path):
        w = self._worker(tmp_path)
        t = threading.Thread(target=lambda: None)
        t.start()
        t.join()
        w._thread = t
        assert w.stop(timeout=1) is True
        assert w._thread is None and w.stopping is False


class TestMcpClientStop:
    def _worker(self):
        from doclens.mcp_client import McpClientManager

        return McpClientManager()

    def test_timeout_keeps_started_flag(self):
        m = self._worker()
        t, release = _stuck_thread()
        m._thread = t
        m._started.set()
        try:
            assert m.stop(timeout=0.05) is False
            assert m.stopping is True
            # 关键：started 仍置位，start() 因此拒绝（旧实现会 clear 后再起第二条）
            assert m._started.is_set() is True
            assert m.start() is False
            assert m._thread is t
        finally:
            release.set()
            t.join(5)

    def test_idempotent_when_never_started(self):
        m = self._worker()
        assert m.stop(timeout=0.01) is True


class TestDepsWiring:
    """deps 的 stop_* 失败时必须保留单例注册（否则旧线程失去引用）。"""

    def test_stop_vision_keeps_singleton_on_failure(self, monkeypatch):
        from doclens.web_v2 import deps

        class _W:
            stopping = True

            def stop(self, timeout=5.0):
                return False

            def status(self):
                return {"running": True, "stopping": True}

        worker = _W()
        monkeypatch.setattr(deps, "_vision_worker", worker, raising=False)
        assert deps.stop_vision_worker() is False
        assert deps._vision_worker is worker

    def test_stop_vision_unregisters_on_success(self, monkeypatch):
        from doclens.web_v2 import deps

        class _W:
            stopping = False

            def stop(self, timeout=5.0):
                return True

        worker = _W()
        monkeypatch.setattr(deps, "_vision_worker", worker, raising=False)
        assert deps.stop_vision_worker() is True
        assert deps._vision_worker is None

    def test_start_vision_refuses_when_stopping(self, monkeypatch):
        from doclens.web_v2 import deps

        class _W:
            stopping = True

        monkeypatch.setattr(deps, "_vision_worker", _W(), raising=False)
        monkeypatch.setattr(
            deps, "get_index_manager", lambda: pytest.fail("不应装配索引")
        )
        assert deps.start_vision_worker() is False

    def test_stop_mcp_keeps_singleton_on_failure(self, monkeypatch):
        from doclens.web_v2 import deps

        class _M:
            stopping = True

            def stop(self, timeout=10.0):
                return False

        mgr = _M()
        monkeypatch.setattr(deps, "_mcp_client", mgr, raising=False)
        assert deps.stop_mcp_client() is False
        assert deps._mcp_client is mgr

    def test_status_exposes_stopping(self, tmp_path):
        """前端需要区分「运行中 / 停止中 / 已停」——status 必须带 stopping。"""
        from doclens.git_sync import GitSync
        from doclens.vision_worker import VisionWorker

        assert "stopping" in VisionWorker(None, lambda: None).status()
        assert "stopping" in GitSync(str(tmp_path)).status()
