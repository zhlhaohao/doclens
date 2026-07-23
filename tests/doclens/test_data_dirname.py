"""按运行模式切换数据目录名：开发 .cortex / 发行版 .doclens。

判据是 doclens.__file__ 的安装位置：
- editable / 源码树直接运行 → 开发模式（.cortex）
- wheel 装进 site-packages / dist-packages → 发行版模式（.doclens）

并验证 doclens 把决策写入 CORTEX_DATA_DIRNAME env、planify 消费端跟随读取。
"""
from __future__ import annotations

import os
from pathlib import Path

import doclens
from doclens.config import (
    data_dirname,
    get_global_cortex_dir,
    is_installed_mode,
)


def test_source_tree_is_dev_mode(monkeypatch):
    """__file__ 指向项目源码树（无 site-packages）→ 开发模式 .cortex。"""
    monkeypatch.setattr(
        doclens,
        "__file__",
        str(Path("/home/user/projects/cortex/doclens/__init__.py")),
    )
    assert is_installed_mode() is False
    assert data_dirname() == ".cortex"
    assert get_global_cortex_dir().name == ".cortex"


def test_site_packages_is_release_mode(monkeypatch):
    """__file__ 指向 site-packages → 发行版模式 .doclens。"""
    monkeypatch.setattr(
        doclens,
        "__file__",
        str(Path("/home/user/venv/lib/python3.12/site-packages/doclens/__init__.py")),
    )
    assert is_installed_mode() is True
    assert data_dirname() == ".doclens"
    assert get_global_cortex_dir().name == ".doclens"


def test_dist_packages_is_release_mode(monkeypatch):
    """__file__ 指向 dist-packages（Debian 系）→ 发行版模式。"""
    monkeypatch.setattr(
        doclens,
        "__file__",
        str(Path("/usr/lib/python3/dist-packages/doclens/__init__.py")),
    )
    assert is_installed_mode() is True
    assert data_dirname() == ".doclens"


def test_env_bridging_is_set():
    """doclens.config 模块加载后 CORTEX_DATA_DIRNAME 已被 setdefault 写入，
    且与当前真实模式一致（无论哪种环境都应满足 val == data_dirname()）。"""
    val = os.environ.get("CORTEX_DATA_DIRNAME")
    assert val is not None
    assert val == data_dirname()


def test_planify_reads_bridged_env(monkeypatch):
    """planify._data_dirname 读取 CORTEX_DATA_DIRNAME，跟随 doclens 模式；
    planify 独立运行（env 未设）时回退 .cortex。"""
    from planify.core.logging_config import _data_dirname

    monkeypatch.setenv("CORTEX_DATA_DIRNAME", ".doclens")
    assert _data_dirname() == ".doclens"
    monkeypatch.setenv("CORTEX_DATA_DIRNAME", ".cortex")
    assert _data_dirname() == ".cortex"
    monkeypatch.delenv("CORTEX_DATA_DIRNAME", raising=False)
    assert _data_dirname() == ".cortex"
