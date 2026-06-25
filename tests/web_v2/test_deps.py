"""deps.py 单例测试。"""
from doclens.web_v2 import deps


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
