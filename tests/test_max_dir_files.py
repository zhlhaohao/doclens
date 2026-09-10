"""max_dir_files 配置链路测试（>10000 文件语料索引被卡死的回归）。

背景：GUI 索引企业级语料（>10000 文件）时，``pathutil._walk_directory``
抛 ``ValueError: contains more than 10000 matching files``，且 doclens 无任何
配置通路调大该上限。修复后 ``CORTEX/TREESEARCH_MAX_DIR_FILES`` 可调，0=不设限。
"""
from pathlib import Path

import pytest

from doclens.config import CortexConfig


class TestMaxDirFilesConfig:
    def test_default_unlimited(self):
        assert CortexConfig().treesearch_max_dir_files == 0

    def test_env_override(self, monkeypatch):
        monkeypatch.setenv("TREESEARCH_MAX_DIR_FILES", "50000")
        assert CortexConfig().treesearch_max_dir_files == 50000

    def test_index_manager_property(self, tmp_path: Path):
        from doclens.index_manager import IndexManager

        idx = IndexManager(CortexConfig())
        assert idx.max_dir_files == 0

    def test_index_manager_property_env_override(self, tmp_path: Path, monkeypatch):
        from doclens.index_manager import IndexManager

        monkeypatch.setenv("TREESEARCH_MAX_DIR_FILES", "10000")
        idx = IndexManager(CortexConfig())
        assert idx.max_dir_files == 10000


class TestWalkDirectoryCap:
    """treesearch.pathutil：上限行为与 0=不设限。"""

    @pytest.fixture()
    def many_files(self, tmp_path: Path) -> Path:
        """生成 30 个 .md 文件（超过测试用小上限）。"""
        for i in range(30):
            (tmp_path / f"f{i:02d}.md").write_text(f"# {i}\n内容\n", encoding="utf-8")
        (tmp_path / "skip.log").write_text("x", encoding="utf-8")
        return tmp_path

    def test_cap_raises(self, many_files: Path):
        from treesearch.pathutil import resolve_paths

        with pytest.raises(ValueError, match="more than 10 matching files"):
            resolve_paths([str(many_files)], max_files=10)

    def test_zero_means_unlimited(self, many_files: Path):
        from treesearch.pathutil import resolve_paths

        files = resolve_paths([str(many_files)], max_files=0)
        assert len(files) == 31  # 30 md + 1 log

    def test_negative_also_unlimited(self, many_files: Path):
        from treesearch.pathutil import resolve_paths

        files = resolve_paths([str(many_files)], max_files=-1)
        assert len(files) == 31

    def test_cap_above_count_passes(self, many_files: Path):
        from treesearch.pathutil import resolve_paths

        files = resolve_paths([str(many_files)], max_files=100)
        assert len(files) == 31


class TestEnvPlumbing:
    def test_treesearch_config_from_env(self, monkeypatch):
        from treesearch.config import TreeSearchConfig, reset_config

        monkeypatch.setenv("TREESEARCH_MAX_DIR_FILES", "77777")
        reset_config()
        try:
            from treesearch.config import get_config

            assert get_config(reload=True).max_dir_files == 77777
        finally:
            reset_config()

    def test_set_config_flows_to_tree_search(self, tmp_path: Path):
        """IndexManager 的 set_config 链路把 max_dir_files 传给 TreeSearchConfig。"""
        from treesearch import TreeSearch, set_config, TreeSearchConfig

        set_config(TreeSearchConfig(max_dir_files=0))
        ts = TreeSearch(db_path=str(tmp_path / "t.db"))
        assert ts._max_files == 0

    def test_index_manager_end_to_end_over_cap(self, tmp_path: Path, monkeypatch):
        """端到端：11 个文件 + 上限 5 → 调大上限后成功建索引。"""
        import os

        from doclens.index_manager import IndexManager

        for i in range(11):
            (tmp_path / f"d{i}.md").write_text(f"# {i}\n磁锚 检索\n", encoding="utf-8")
        monkeypatch.chdir(tmp_path)
        monkeypatch.setenv("TREESEARCH_MAX_DIR_FILES", "5")

        idx = IndexManager(CortexConfig())
        # 显式小上限 5 < 11 文件 → walk 抛 ValueError
        assert idx.max_dir_files == 5
        # 上限 5 < 11 文件 → walk 抛 ValueError（reindex 捕获为空索引）
        from treesearch.pathutil import resolve_paths
        with pytest.raises(ValueError):
            resolve_paths([str(tmp_path)], max_files=idx.max_dir_files)

        # 调大后成功
        monkeypatch.setenv("TREESEARCH_MAX_DIR_FILES", "20")
        idx2 = IndexManager(CortexConfig())
        assert idx2.max_dir_files == 20
        idx2.reindex(force=True)
        assert len(idx2.documents) == 11
