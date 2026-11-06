"""planify ↔ doclens 注入式装配测试（ADR-0053）。

背景：planify 曾用 ``importlib.import_module("doclens.config")`` 反查宿主的
数据目录名与 .env 位置——用动态 import 把静态依赖藏进字符串，运行时反向依赖
照旧成立（违反 CLAUDE.md 红线 1「底层禁止 import 高层」）。现改为纯注入：

- 宿主调 ``register_data_dirname(name)`` 注入数据目录名；
- 宿主调 ``register_env_loader(loader)`` 注入 .env 加载回调；
- 框架侧**不知道**宿主是谁，未注册时用中性回退（".planify"）。

本测试覆盖注入契约本身（框架层与宿主层各一半），端到端的分层回归由
tests/test_architecture.py 的两条新守卫兜底（禁动态 import / 禁代码级宿主名）。
"""

import os
from pathlib import Path

import pytest

from planify.core import logging_config as lc


@pytest.fixture(autouse=True)
def _reset_injection():
    """每个测试前复位注入状态（模块级全局）——保存/恢复原值，不硬置。

    硬置会破坏「宿主已注册」的既有状态（doclens.config 在别的测试里已
    import 过，模块级注册不会重跑）——故用保存/恢复。
    """
    saved = (lc._data_dirname, lc._env_loader, lc._env_loaded)
    lc._data_dirname = ".planify"
    lc._env_loader = None
    lc._env_loaded = False
    yield
    lc._data_dirname, lc._env_loader, lc._env_loaded = saved


# ---- 数据目录名注入 ----


def test_data_dirname_defaults_to_framework_namespace():
    """未注入时回退框架自己的命名空间（不是宿主的 .cortex）。"""
    assert lc.data_dirname() == ".planify"


def test_register_data_dirname_injects():
    lc.register_data_dirname(".doclens")
    assert lc.data_dirname() == ".doclens"


def test_register_data_dirname_last_wins():
    lc.register_data_dirname(".cortex")
    lc.register_data_dirname(".doclens")
    assert lc.data_dirname() == ".doclens"


# ---- .env 加载器注入 ----


def test_env_loader_called_once():
    """注入的 loader 在进程内只被调用一次（幂等）。"""
    calls = []

    lc.register_env_loader(lambda: calls.append(1))
    lc._load_env()
    lc._load_env()
    assert calls == [1]


def test_env_loader_not_called_without_registration():
    """未注册 loader 时框架不加载任何 .env（planify 独立运行走 .planify/.env）。"""
    lc._load_env()  # 不应抛异常
    assert lc._env_loaded is True


def test_env_loader_failure_does_not_break_startup():
    """loader 抛异常不得阻断启动（env 加载失败 fail-open）。"""
    def _boom():
        raise RuntimeError("env 坏了")

    lc.register_env_loader(_boom)
    lc._load_env()  # 不应抛异常


def test_env_loader_receives_control():
    """loader 完全掌控加载行为——框架不关心文件在哪、装了什么键。"""
    lc.register_env_loader(lambda: os.environ.__setitem__("PLANIFY_LOG_LEVEL", "DEBUG"))
    lc._load_env()
    assert os.environ["PLANIFY_LOG_LEVEL"] == "DEBUG"


# ---- 宿主侧：注册的内容正确 ----


def test_host_registers_dirname_and_loader():
    """宿主注册后，planify 拿到宿主口径（目录名 + loader）。

    用显式的 ``_register_with_planify()`` 而非靠 import 副作用——本测试
    文件里 doclens.config 可能已被别的测试 import 过，模块级注册不会重跑。
    """
    import doclens.config as dc

    dc._register_with_planify()
    assert lc.data_dirname() in (".cortex", ".doclens")
    assert callable(lc._env_loader)


def test_host_loader_maps_log_level_namespace(tmp_path, monkeypatch):
    """宿主键 CORTEX_LOG_LEVEL → 框架键 PLANIFY_LOG_LEVEL（命名空间映射）。

    CLAUDE.md 规则 3：底层只认自己的 PLANIFY_*，不碰 CORTEX_*。宿主把用户
    可见开关（.env 里的 CORTEX_LOG_LEVEL）映射到框架命名空间——用户配置
    口径不变，框架层不再读宿主前缀。
    """
    import doclens.config as dc

    monkeypatch.setenv("CORTEX_LOG_LEVEL", "DEBUG")
    monkeypatch.delenv("PLANIFY_LOG_LEVEL", raising=False)
    dc._load_host_env_files()
    assert os.environ["PLANIFY_LOG_LEVEL"] == "DEBUG"


def test_host_loader_reads_both_env_files(tmp_path, monkeypatch):
    """宿主 loader 读全局 + 项目两份 .env（项目覆盖全局）。"""
    import doclens.config as dc

    home = tmp_path / "home"
    work = tmp_path / "work"
    (home / dc._dirname).mkdir(parents=True)
    (work / dc._dirname).mkdir(parents=True)
    (home / dc._dirname / ".env").write_text("PLANIFY_PROBE=global\n", encoding="utf-8")
    (work / dc._dirname / ".env").write_text("PLANIFY_PROBE=local\n", encoding="utf-8")

    monkeypatch.setattr(Path, "home", classmethod(lambda cls: home))
    monkeypatch.chdir(work)
    monkeypatch.delenv("PLANIFY_PROBE", raising=False)

    dc._load_host_env_files()
    assert os.environ["PLANIFY_PROBE"] == "local"
