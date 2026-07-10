"""deps.py 单例测试。"""
import pytest

from doclens.web_v2 import deps


@pytest.fixture
def reset_deps():
    from doclens.web_v2 import deps
    deps.reset_singletons()
    yield
    deps.reset_singletons()


def test_get_config_returns_singleton(env_cortex_config):
    # 重置模块级单例
    deps._config = None
    c1 = deps.get_config()
    c2 = deps.get_config()
    assert c1 is c2


def test_get_index_manager_returns_singleton(env_cortex_config):
    # 重置模块级单例
    deps._idx_manager = None
    m1 = deps.get_index_manager()
    m2 = deps.get_index_manager()
    assert m1 is m2


def test_reload_config_pushes_new_config_to_singletons(env_cortex_config):
    """reload_config recreates CortexConfig and pushes to live singletons."""
    from unittest.mock import MagicMock, patch

    deps._config = None
    deps._idx_manager = None
    deps._agent = None

    # Initialize
    original_config = deps.get_config()
    mgr = deps.get_index_manager()

    # Record original value
    original_max = mgr.max_results

    # Write a new .env with different max_results
    import os
    env_path = os.path.join(os.getcwd(), ".cortex", ".env")
    os.makedirs(os.path.dirname(env_path), exist_ok=True)
    with open(env_path, "w", encoding="utf-8") as f:
        f.write(f"CORTEX_MAX_RESULTS={original_max + 500}\n")

    # Reload
    new_config = deps.reload_config()
    assert new_config is not original_config
    assert new_config.max_results == original_max + 500
    # IndexManager got the push
    assert mgr.max_results == original_max + 500

    # Cleanup
    deps._config = None
    deps._idx_manager = None
    deps._agent = None


def test_reload_config_invalidates_session_manager_provider():
    """reload_config 应调 SessionManager.invalidate_provider，让 provider 失效。"""
    from unittest.mock import patch, MagicMock

    from doclens.web_v2 import deps

    fake_provider = MagicMock()
    with patch.object(deps, "SessionManager") as MockSM:
        MockSM._provider = fake_provider
        deps.reload_config()
        # 关键断言：invalidate_provider 被调用过
        MockSM.invalidate_provider.assert_called_once()


def test_watcher_singletons_and_lifecycle(env_cortex_config, reset_deps, temp_workdir):
    """start_watcher 创建并注册 watcher；stop_watcher 清理；reset 清空单例。"""
    import asyncio
    from doclens.web_v2 import deps

    async def _init():
        await asyncio.to_thread(lambda: deps.get_index_manager().reindex(force=True))
    asyncio.run(_init())

    assert deps.get_watcher() is None
    started = deps.start_watcher()
    assert started is True
    w = deps.get_watcher()
    assert w is not None
    assert w.status()["running"] is True

    deps.stop_watcher()
    assert deps.get_watcher() is None  # stop_watcher 注销单例

    # reset_singletons 也应清空 _watcher
    deps.set_watcher(object())
    deps.reset_singletons()
    assert deps.get_watcher() is None


def test_start_watcher_respects_watch_disabled(env_cortex_config, reset_deps, monkeypatch):
    """watch_enabled=False 时 start_watcher 不创建 watcher，返回 False。"""
    import asyncio
    from doclens.web_v2 import deps

    async def _init():
        await asyncio.to_thread(deps.get_index_manager)
    asyncio.run(_init())

    monkeypatch.setattr(deps.get_config(), "watch_enabled", False)
    started = deps.start_watcher()
    assert started is False
    assert deps.get_watcher() is None
