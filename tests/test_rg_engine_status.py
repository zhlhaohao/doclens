# -*- coding: utf-8 -*-
"""AP-46：rg 没跑起来 ≠ 没有命中。

原状：`rg_search_root_hits` 用 bool 表达结局——超时返回 `({}, True)`、
`OSError` 返回 `({}, False)`。调用方只看「有没有超时」，于是 rg 缺失/被杀/
权限失败时文本腿静默返回零结果，模型与用户都以为「确实没有」。同模块
`grep_tools.py` 却明确承诺「结果可能不完整必须显式告知，不能静默当作无结果」。

修复：结局改为四态枚举（ok / timeout / unavailable / error），非 ok 一律
产出 notes；运行期失败还会降级到「索引全量 REGEXP」并说明覆盖范围缩小。
"""
import sqlite3
from pathlib import Path
from unittest.mock import patch

import pytest

from doclens import ripgrep as rgmod
from doclens.ripgrep import (
    RG_SCAN_ERROR,
    RG_SCAN_OK,
    RG_SCAN_TIMEOUT,
    RG_SCAN_UNAVAILABLE,
    rg_search_root_hits,
    execute_grep_search,
)
from doclens.grep_tools import handle_grep


class TestScanStatusIsEnum:
    def test_ok(self, tmp_path):
        (tmp_path / "a.txt").write_text("hello", encoding="utf-8")
        hits, status = rg_search_root_hits("hello", str(tmp_path), use_regex=False)
        assert status == RG_SCAN_OK
        assert hits

    def test_unavailable(self, tmp_path):
        # rg_search_root_hits 内部 `from treesearch.ripgrep import rg_available`，
        # 故补丁要打在 treesearch 侧（模块级引用补丁对它无效）
        with patch("treesearch.ripgrep.rg_available", return_value=False):
            hits, status = rg_search_root_hits("x", str(tmp_path), use_regex=False)
        assert (hits, status) == ({}, RG_SCAN_UNAVAILABLE)

    def test_timeout(self, tmp_path):
        (tmp_path / "a.txt").write_text("hello", encoding="utf-8")
        with patch("subprocess.run") as run:
            import subprocess

            run.side_effect = subprocess.TimeoutExpired(cmd="rg", timeout=1)
            _, status = rg_search_root_hits("x", str(tmp_path), use_regex=False)
        assert status == RG_SCAN_TIMEOUT

    def test_start_failure(self, tmp_path):
        (tmp_path / "a.txt").write_text("hello", encoding="utf-8")
        with patch("subprocess.run", side_effect=OSError("denied")):
            _, status = rg_search_root_hits("x", str(tmp_path), use_regex=False)
        assert status == RG_SCAN_ERROR

    def test_status_is_not_truthy_bool(self):
        """四个状态的取值必须互异，且都不是 False（防止又被当布尔用）。"""
        values = {RG_SCAN_OK, RG_SCAN_TIMEOUT, RG_SCAN_UNAVAILABLE, RG_SCAN_ERROR}
        assert len(values) == 4
        assert False not in values


@pytest.fixture()
def idx_env(tmp_path, monkeypatch):
    """真实索引库（含一篇已索引文本）+ 一篇「只在磁盘、未索引」的文本。

    后者是 AP-46 的关键：rg 不可用时它搜不到，用户必须被告知覆盖范围缩小，
    而不是看到「未找到」就以为真的没有。
    """
    from doclens.config import CortexConfig
    from doclens.index_manager import IndexManager

    kb = tmp_path / "kb"
    kb.mkdir()
    (kb / "indexed.md").write_text(
        "# 已索引" + chr(10) + chr(10) + "needle in indexed doc" + chr(10),
        encoding="utf-8",
    )
    (kb / "disk_only.md").write_text(
        "# 未索引" + chr(10) + chr(10) + "needle on disk" + chr(10),
        encoding="utf-8",
    )

    monkeypatch.setenv("CORTEX_SEARCH_PATH", str(kb))
    monkeypatch.setenv("CORTEX_INDEX_PATH", str(tmp_path / "idx" / "index.db"))
    idx = IndexManager(CortexConfig())
    idx.reindex(force=True)
    return idx


class TestNotesOnFailure:
    def test_runtime_start_failure_yields_note(self, idx_env):
        with patch("subprocess.run", side_effect=OSError("denied")):
            result = execute_grep_search(idx_env, "needle")

        assert any("启动失败" in n for n in result.notes), result.notes
        assert any("未索引的文本文件未覆盖" in n for n in result.notes)

    def test_runtime_failure_falls_back_to_index_scan(self, idx_env):
        """rg 挂掉时文本结果改从索引取——不是零结果。"""
        with patch("subprocess.run", side_effect=OSError("denied")):
            result = execute_grep_search(idx_env, "needle")

        assert result.content_results, "降级后应能找到已索引文档里的命中"

    def test_unavailable_yields_note(self, idx_env):
        with patch("treesearch.ripgrep.rg_available", return_value=False),                 patch("doclens.ripgrep.rg_available", return_value=False):
            result = execute_grep_search(idx_env, "needle")

        assert any("rg 未安装或不可用" in n for n in result.notes), result.notes
        assert result.content_results, "无 rg 时仍应搜到已索引文档"

    def test_timeout_note_unchanged(self, idx_env):
        with patch("doclens.ripgrep.rg_search_root_hits",
                   return_value=({}, RG_SCAN_TIMEOUT)):
            result = execute_grep_search(idx_env, "needle")
        assert any("超时" in n for n in result.notes)


class TestNoteReachesUser:
    def test_handle_grep_surfaces_note_when_no_results(self, idx_env):
        """工具层：无结果时也必须把「引擎不可用」说出来，不能只回「未找到」。"""
        with patch("treesearch.ripgrep.rg_available", return_value=False),                 patch("doclens.ripgrep.rg_available", return_value=False):
            out = handle_grep(idx_env, pattern="完全不存在的词xyz")
        assert "rg 未安装或不可用" in out
        assert "未找到" in out

    def test_handle_grep_surfaces_note_with_results(self, idx_env):
        with patch("treesearch.ripgrep.rg_available", return_value=False),                 patch("doclens.ripgrep.rg_available", return_value=False):
            out = handle_grep(idx_env, pattern="needle")
        assert "[注意]" in out
        assert "rg 未安装或不可用" in out
