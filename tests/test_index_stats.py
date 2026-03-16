# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for IndexStats feature.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from treesearch.indexer import build_index, IndexStats


@pytest.fixture
def sample_files():
    """Create a set of temp files for indexing."""
    tmpdir = tempfile.mkdtemp()

    # Markdown file
    md_path = os.path.join(tmpdir, "doc.md")
    with open(md_path, "w") as f:
        f.write("# Overview\n\nThis is an overview.\n\n## Details\n\nSome details here.\n")

    # Python file
    py_path = os.path.join(tmpdir, "example.py")
    with open(py_path, "w") as f:
        f.write("class Foo:\n    def bar(self):\n        pass\n\ndef baz():\n    return 42\n")

    # Text file
    txt_path = os.path.join(tmpdir, "notes.txt")
    with open(txt_path, "w") as f:
        f.write("1. Introduction\n\nSome intro text.\n\n2. Conclusion\n\nSome conclusion.\n")

    yield tmpdir

    # Cleanup
    for f in os.listdir(tmpdir):
        os.unlink(os.path.join(tmpdir, f))
    # Remove any generated .db files
    for f in os.listdir(tmpdir):
        os.unlink(os.path.join(tmpdir, f))
    os.rmdir(tmpdir)


async def test_build_index_returns_stats(sample_files):
    """Test that build_index returns a list with stats attribute."""
    db_path = os.path.join(sample_files, "test.db")
    results = await build_index(
        paths=[sample_files],
        db_path=db_path,
        force=True,
    )

    assert hasattr(results, "stats")
    stats = results.stats
    assert isinstance(stats, IndexStats)

    # 3 files: .md, .py, .txt
    assert stats.total_files == 3
    assert stats.indexed_files == 3
    assert stats.skipped_files == 0
    assert stats.failed_files == 0
    assert stats.total_nodes > 0
    assert stats.total_time_s > 0
    assert stats.db_path == db_path
    assert stats.db_size_bytes > 0

    # Clean up
    if os.path.exists(db_path):
        os.unlink(db_path)


async def test_stats_per_type(sample_files):
    """Test that per_type breakdown is populated correctly."""
    db_path = os.path.join(sample_files, "test.db")
    results = await build_index(
        paths=[sample_files],
        db_path=db_path,
        force=True,
    )

    stats = results.stats
    assert "markdown" in stats.per_type
    assert "code" in stats.per_type
    assert "text" in stats.per_type

    # Each type should have 1 file
    assert stats.per_type["markdown"]["count"] == 1
    assert stats.per_type["code"]["count"] == 1
    assert stats.per_type["text"]["count"] == 1

    # Each type should have positive node counts
    for stype in ("markdown", "code", "text"):
        assert stats.per_type[stype]["nodes"] > 0
        assert stats.per_type[stype]["time_s"] >= 0

    # Clean up
    if os.path.exists(db_path):
        os.unlink(db_path)


async def test_stats_summary_format(sample_files):
    """Test that stats.summary() returns a readable string."""
    db_path = os.path.join(sample_files, "test.db")
    results = await build_index(
        paths=[sample_files],
        db_path=db_path,
        force=True,
    )

    summary = results.stats.summary()
    assert isinstance(summary, str)
    assert "Index Statistics" in summary
    assert "Total files discovered" in summary
    assert "Per file type" in summary
    assert "markdown" in summary
    assert "code" in summary

    # Clean up
    if os.path.exists(db_path):
        os.unlink(db_path)


async def test_stats_incremental_skipped(sample_files):
    """Test that stats correctly reports skipped files on re-index."""
    db_path = os.path.join(sample_files, "test.db")

    # First index
    await build_index(paths=[sample_files], db_path=db_path, force=True)

    # Second index (should skip unchanged files)
    results2 = await build_index(paths=[sample_files], db_path=db_path, force=False)

    stats = results2.stats
    assert stats.skipped_files == 3
    assert stats.indexed_files == 0

    # Clean up
    if os.path.exists(db_path):
        os.unlink(db_path)


async def test_treesearch_get_index_stats(sample_files):
    """Test TreeSearch.get_index_stats() method."""
    from treesearch import TreeSearch

    ts = TreeSearch(db_path=None)
    assert ts.get_index_stats() is None  # No indexing yet

    await ts.aindex(sample_files)
    stats = ts.get_index_stats()
    assert stats is not None
    assert isinstance(stats, IndexStats)
    assert stats.total_files == 3
    assert stats.total_nodes > 0
