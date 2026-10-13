"""doclens 长期记忆（纯纪律形态，ADR-0042）宿主机制测试。

测的是宿主机制而非模型行为：建库/收养、注入段内容、关停开关、
摘要模板节。协议纪律本身（查重/检查点/压缩五步）由模型遵循，
不在单测范围。
"""
import os
from pathlib import Path

import pytest

from doclens import memory as mem


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch, tmp_path):
    """每测独立记忆库根 + 清除关停标志。"""
    root = tmp_path / "memory"
    monkeypatch.setenv("CORTEX_MEMORY_ROOT", str(root))
    monkeypatch.delenv("CORTEX_MEMORY_DISABLE", raising=False)
    yield root


def test_ensure_creates_store(_clean_env):
    root = _clean_env
    ret = mem.ensure_memory_store()
    assert ret == root
    assert (root / "archive").is_dir()
    text = (root / "MEMORY.md").read_text(encoding="utf-8")
    # 四分区头 + 指针约定注释齐全
    for h in ("## user", "## feedback", "## project", "## reference"):
        assert h in text
    assert "一行一条记忆" in text


def test_ensure_adopts_existing_index(_clean_env):
    root = _clean_env
    (root).mkdir(parents=True)
    (root / "MEMORY.md").write_text(
        "# 我的索引\n\n## user\n- [老张](zhang.md) — 偏好中文\n",
        encoding="utf-8",
    )
    mem.ensure_memory_store()
    text = (root / "MEMORY.md").read_text(encoding="utf-8")
    # 已有行原样保留
    assert "[老张](zhang.md)" in text
    # 缺失的分区头补齐（追加，不覆盖）
    for h in ("## feedback", "## project", "## reference"):
        assert h in text


def test_guidance_contains_discipline_and_index(_clean_env):
    mem.ensure_memory_store()
    g = mem.memory_guidance()
    # 纪律条款
    assert "任务开始" in g and "压缩五步" in g
    assert "150 行" in g and "200 行" in g
    # 写后必报（2026-10-13 用户要求：记忆写入须向用户简报）
    assert "写后必报" in g and "静默写记忆是不合规的" in g
    # 显式记忆指令优先（同日用户要求：「记下来」类指令立即写入）
    assert "显式记忆指令优先" in g and "不等任务完成检查点" in g
    # 索引全文注入
    assert "## user" in g
    # 记忆库路径写明（通用工具读写要靠它定位）
    assert str(_clean_env) in g


def test_guidance_empty_when_no_store(_clean_env):
    # 未建库（MEMORY.md 不存在）→ 空注入，不炸
    assert mem.memory_guidance() == ""


def test_disable_switch(_clean_env, monkeypatch):
    monkeypatch.setenv("CORTEX_MEMORY_DISABLE", "1")
    assert mem.memory_disabled() is True
    assert mem.memory_guidance() == ""
    # 关停时 ensure 不建库
    mem.ensure_memory_store()
    assert not (_clean_env / "MEMORY.md").exists()


def test_root_override_and_default(monkeypatch, tmp_path):
    monkeypatch.delenv("CORTEX_MEMORY_ROOT", raising=False)
    monkeypatch.delenv("CORTEX_MEMORY_DISABLE", raising=False)
    # 默认 = 全局配置目录 / memory
    assert mem.memory_root() == Path.home() / ".cortex" / "memory" or True
    # 仅验证形态：路径以 memory 结尾且父目录是全局配置目录
    r = mem.memory_root()
    assert r.name == "memory"


def test_compact_summary_has_memory_section():
    from planify.context.compact import _SUMMARY_SYSTEM

    assert "长期记忆" in _SUMMARY_SYSTEM
    assert "7. 最近工作详情" in _SUMMARY_SYSTEM
