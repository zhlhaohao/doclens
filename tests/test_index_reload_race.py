"""AP-13 回归：_needs_reload check-then-act 竞态防护。

修复前：load_or_build_index 的标志读与清位之间无锁，后台 reindex /
mark_index_dirty 的置位落在窗口内即被无条件覆盖——标志丢失且永不补账
（唯一 reload 触发源），搜索一直用旧句柄。

修复后契约：
1. mark_index_dirty / reindex 置位与 load 的「检查+清位」在 _build_cond
   保护域内互斥——置位发生在 load 临界段之前 → 本次 load 必然重建句柄；
2. 早退路径（_ts 就绪且无标志）不重建；
3. mark_index_dirty 持锁（锁被占时置位等待，不裸写）。
"""
import threading
import time
from unittest.mock import patch

from doclens.config import CortexConfig
from doclens.index_manager import IndexManager


def _fake_ts_factory(counter: dict):
    """TreeSearch 替身工厂：构造即计数，index/stats 可调用。"""

    class _FakeTS:
        def index(self, *a, **k):
            return []

        def get_index_stats(self):
            return None

    def ctor(**kw):
        counter["n"] = counter.get("n", 0) + 1
        return _FakeTS()

    return ctor


class TestNeedsReloadRace:
    def _mgr(self, tmp_path):
        """最小 IndexManager：索引库文件已存在 + _ts 已装配 + 审计已完成。"""
        (tmp_path / "index.db").write_bytes(b"")
        mgr = IndexManager(CortexConfig(search_path=str(tmp_path)))
        mgr._ts = object()          # 已装配（非 None → needs_audit=False）
        mgr._needs_reload = False
        return mgr

    def _patched_env(self, counter):
        return (
            patch.object(IndexManager, "build_path_map", lambda self: None),
            patch("doclens.index_manager.TreeSearch", _fake_ts_factory(counter)),
            patch("doclens.index_manager.set_config", lambda *a, **k: None),
            patch.object(IndexManager, "has_changed_files", lambda self: False),
        )

    def test_flag_set_before_load_survives(self, tmp_path):
        """置位先于 load → load 必须重建句柄（消费标志而非吞掉）。"""
        mgr = self._mgr(tmp_path)
        mgr.mark_index_dirty()
        counter = {}
        env = self._patched_env(counter)
        with env[0], env[1], env[2], env[3]:
            ok = mgr.load_or_build_index()
        assert ok is True
        assert counter.get("n", 0) == 1, "置位后 load 必须重建 _ts 句柄"
        assert mgr._needs_reload is False, "重建消费标志后清位（正常语义）"

    def test_interleaved_set_wins_window_rebuilds(self, tmp_path):
        """并发交错：load 与置位同发，最终不早退不丢标志（不重复 patch）。"""
        mgr = self._mgr(tmp_path)
        counter = {}
        done = threading.Event()

        def run_load():
            mgr.load_or_build_index()
            done.set()

        env = self._patched_env(counter)
        with env[0], env[1], env[2], env[3]:
            mgr.mark_index_dirty()
            t = threading.Thread(target=run_load)
            t.start()
            t.join(timeout=10)
        assert done.is_set(), "load 未退出——可能死锁"
        assert counter.get("n", 0) == 1, "并发下置位不得被吞"

    def test_early_exit_when_clean(self, tmp_path):
        """无标志 + 句柄就绪 → 早退不重建。"""
        mgr = self._mgr(tmp_path)
        before_ts = mgr._ts
        counter = {}
        env = self._patched_env(counter)
        with env[0], env[1], env[2], env[3]:
            ok = mgr.load_or_build_index()
        assert ok is True
        assert counter.get("n", 0) == 0, "干净状态不应重建句柄"
        assert mgr._ts is before_ts

    def test_mark_index_dirty_waits_for_lock(self, tmp_path):
        """mark_index_dirty 持 _build_cond：锁被占时置位阻塞（不裸写）。"""
        mgr = self._mgr(tmp_path)
        set_done = threading.Event()

        with mgr._build_cond:
            t = threading.Thread(
                target=lambda: (mgr.mark_index_dirty(), set_done.set())
            )
            t.start()
            time.sleep(0.1)
            # 持锁期间置位不得生效（若裸写，此处已变 True）
            assert mgr._needs_reload is False, "mark_index_dirty 未持锁——绕过保护域"
        t.join(timeout=5)
        assert set_done.is_set()
        assert mgr._needs_reload is True, "锁释放后置位必须完成"
