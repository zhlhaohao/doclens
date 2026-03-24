# -*- coding: utf-8 -*-
"""
@description: Tests for TreeSearch.delete() and FTS5Index.delete_document().

Covers:
  - Delete an existing document: search results no longer contain it.
  - Delete a non-existent document: returns 0 / False, no exception.
  - index_meta is cleared on delete (critical: prevents silent re-index skip).
  - Delete then re-index: document reappears in search results.
  - In-memory mode delete.
  - Delete multiple documents in one call.
"""
import os
import tempfile

import pytest

from treesearch import TreeSearch
from treesearch.fts import FTS5Index
from treesearch.tree import Document


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_md_file(tmp_path, filename: str, content: str) -> str:
    p = tmp_path / filename
    p.write_text(content, encoding="utf-8")
    return str(p)


_DOC_A = """\
# Authentication

## Overview

The authentication system uses JWT tokens.

## Login Flow

1. User submits credentials.
2. Server validates and returns a JWT.
"""

_DOC_B = """\
# Database

## Schema

The database uses PostgreSQL with the following tables.

## Migrations

Run migrations with `alembic upgrade head`.
"""


# ---------------------------------------------------------------------------
# FTS5Index.delete_document()
# ---------------------------------------------------------------------------

class TestFTS5DeleteDocument:
    def test_delete_existing_returns_true(self, tmp_path, sample_tree_structure):
        db = str(tmp_path / "test.db")
        doc = Document(
            doc_id="doc1",
            doc_name="Test Doc",
            structure=sample_tree_structure,
            metadata={"source_path": "/fake/path.md"},
        )
        fts = FTS5Index(db_path=db)
        fts.save_document(doc)
        fts.index_document(doc)
        fts.set_index_meta("/fake/path.md", "abc123")

        result = fts.delete_document("doc1")

        assert result is True

    def test_delete_nonexistent_returns_false(self, tmp_path):
        db = str(tmp_path / "test.db")
        fts = FTS5Index(db_path=db)

        result = fts.delete_document("does_not_exist")

        assert result is False

    def test_delete_clears_fts_nodes(self, tmp_path, sample_tree_structure):
        """After delete, fts_nodes table has no rows for that doc_id."""
        db = str(tmp_path / "test.db")
        doc = Document(doc_id="doc1", doc_name="D", structure=sample_tree_structure)
        fts = FTS5Index(db_path=db)
        fts.save_document(doc)
        fts.index_document(doc)

        fts.delete_document("doc1")

        rows = fts._conn.execute(
            "SELECT COUNT(*) FROM nodes WHERE doc_id = 'doc1'"
        ).fetchone()
        assert rows[0] == 0

    def test_delete_clears_documents_table(self, tmp_path, sample_tree_structure):
        db = str(tmp_path / "test.db")
        doc = Document(doc_id="doc1", doc_name="D", structure=sample_tree_structure)
        fts = FTS5Index(db_path=db)
        fts.save_document(doc)
        fts.index_document(doc)

        fts.delete_document("doc1")

        row = fts._conn.execute(
            "SELECT COUNT(*) FROM documents WHERE doc_id = 'doc1'"
        ).fetchone()
        assert row[0] == 0

    def test_delete_clears_index_meta(self, tmp_path, sample_tree_structure):
        """CRITICAL: index_meta must be cleared so incremental indexing re-processes
        the file after deletion."""
        db = str(tmp_path / "test.db")
        source_path = "/some/file.md"
        doc = Document(
            doc_id="doc1",
            doc_name="D",
            structure=sample_tree_structure,
            metadata={"source_path": source_path},
        )
        fts = FTS5Index(db_path=db)
        fts.save_document(doc)
        fts.index_document(doc)
        fts.set_index_meta(source_path, "hash123")

        # Verify it's there before delete
        assert fts.get_index_meta(source_path) == "hash123"

        fts.delete_document("doc1")

        # Must be gone after delete
        assert fts.get_index_meta(source_path) is None

    def test_delete_is_idempotent(self, tmp_path, sample_tree_structure):
        """Deleting the same doc twice should not raise an exception."""
        db = str(tmp_path / "test.db")
        doc = Document(doc_id="doc1", doc_name="D", structure=sample_tree_structure)
        fts = FTS5Index(db_path=db)
        fts.save_document(doc)
        fts.index_document(doc)

        assert fts.delete_document("doc1") is True
        assert fts.delete_document("doc1") is False  # second call: not found

    def test_delete_search_returns_nothing(self, tmp_path, sample_tree_structure):
        """After delete, score_nodes() returns empty dict."""
        db = str(tmp_path / "test.db")
        doc = Document(doc_id="doc1", doc_name="D", structure=sample_tree_structure)
        fts = FTS5Index(db_path=db)
        fts.save_document(doc)
        fts.index_document(doc)

        # Sanity: should find something before delete
        scores_before = fts.score_nodes("FastAPI", "doc1")
        assert len(scores_before) > 0

        fts.delete_document("doc1")

        scores_after = fts.score_nodes("FastAPI", "doc1")
        assert scores_after == {}


# ---------------------------------------------------------------------------
# TreeSearch.delete() — high-level API
# ---------------------------------------------------------------------------

class TestTreeSearchDelete:
    def test_delete_by_source_path(self, tmp_path):
        path_a = _make_md_file(tmp_path, "auth.md", _DOC_A)
        path_b = _make_md_file(tmp_path, "db.md", _DOC_B)

        ts = TreeSearch(db_path=str(tmp_path / "idx.db"))
        ts.index(path_a, path_b)

        removed = ts.delete(path_a)

        assert removed == 1
        # auth.md should no longer appear in search results
        results = ts.search("JWT authentication")
        doc_names = [d["doc_name"] for d in results["documents"]]
        assert not any("auth" in n.lower() for n in doc_names)

    def test_delete_updates_self_documents(self, tmp_path):
        path_a = _make_md_file(tmp_path, "auth.md", _DOC_A)
        path_b = _make_md_file(tmp_path, "db.md", _DOC_B)

        ts = TreeSearch(db_path=str(tmp_path / "idx.db"))
        ts.index(path_a, path_b)

        count_before = len(ts.documents)
        ts.delete(path_a)
        count_after = len(ts.documents)

        assert count_after == count_before - 1

    def test_delete_nonexistent_returns_zero(self, tmp_path):
        path_a = _make_md_file(tmp_path, "auth.md", _DOC_A)
        ts = TreeSearch(db_path=str(tmp_path / "idx.db"))
        ts.index(path_a)

        removed = ts.delete("/nonexistent/path.md")

        assert removed == 0

    def test_delete_then_reindex_restores_results(self, tmp_path):
        """After delete, re-indexing the same file should make it searchable again."""
        path_a = _make_md_file(tmp_path, "auth.md", _DOC_A)
        db_path = str(tmp_path / "idx.db")

        ts = TreeSearch(db_path=db_path)
        ts.index(path_a)
        assert len(ts.documents) == 1

        # Delete — document is removed from DB and self.documents
        ts.delete(path_a)
        assert ts.documents == []

        # Re-index — should reprocess (not skip via index_meta)
        ts.index(path_a)
        assert len(ts.documents) == 1

        results_after_reindex = ts.search("JWT authentication")
        assert len(results_after_reindex["flat_nodes"]) > 0

    def test_delete_ensures_index_meta_cleared_for_reindex(self, tmp_path):
        """After delete, incremental indexing must re-process the file (not skip it).

        This guards against the CRITICAL GAP: if index_meta is not cleared,
        the next ts.index() call sees the file as 'already indexed' and skips it.
        """
        path_a = _make_md_file(tmp_path, "auth.md", _DOC_A)
        db_path = str(tmp_path / "idx.db")

        ts = TreeSearch(db_path=db_path)
        ts.index(path_a)

        ts.delete(path_a)

        # index_meta must be absent so the next index() reprocesses the file
        fts = FTS5Index(db_path=db_path)
        assert fts.get_index_meta(os.path.abspath(path_a)) is None
        fts.close()

    def test_delete_in_memory_mode(self, tmp_path):
        path_a = _make_md_file(tmp_path, "auth.md", _DOC_A)
        path_b = _make_md_file(tmp_path, "db.md", _DOC_B)

        ts = TreeSearch(db_path=None)
        ts.index(path_a, path_b)

        assert len(ts.documents) == 2
        removed = ts.delete(path_a)

        assert removed == 1
        assert len(ts.documents) == 1

    def test_delete_multiple_documents(self, tmp_path):
        path_a = _make_md_file(tmp_path, "auth.md", _DOC_A)
        path_b = _make_md_file(tmp_path, "db.md", _DOC_B)

        ts = TreeSearch(db_path=str(tmp_path / "idx.db"))
        ts.index(path_a, path_b)

        removed = ts.delete(path_a, path_b)

        assert removed == 2
        assert ts.documents == []

    def test_delete_no_args_returns_zero(self, tmp_path):
        path_a = _make_md_file(tmp_path, "auth.md", _DOC_A)
        ts = TreeSearch(db_path=str(tmp_path / "idx.db"))
        ts.index(path_a)

        assert ts.delete() == 0
