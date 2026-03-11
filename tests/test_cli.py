# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for treesearch.cli module.
"""
import os
import sys
import tempfile

import pytest
from treesearch.cli import _build_parser, _load_documents_from_dir


class TestBuildParser:
    def test_index_subcommand(self):
        parser = _build_parser()
        args = parser.parse_args(["index", "--paths", "test.md"])
        assert args.command == "index"
        assert args.paths == ["test.md"]

    def test_index_with_multiple_paths(self):
        parser = _build_parser()
        args = parser.parse_args(["index", "--paths", "docs/*.md", "paper.txt"])
        assert args.command == "index"
        assert args.paths == ["docs/*.md", "paper.txt"]

    def test_index_with_output_dir(self):
        parser = _build_parser()
        args = parser.parse_args(["index", "--paths", "test.md", "-o", "./out"])
        assert args.command == "index"
        assert args.output_dir == "./out"

    def test_index_with_force(self):
        parser = _build_parser()
        args = parser.parse_args(["index", "--paths", "test.md", "--force"])
        assert args.force is True

    def test_index_with_max_concurrency(self):
        parser = _build_parser()
        args = parser.parse_args(["index", "--paths", "test.md", "--max-concurrency", "10"])
        assert args.max_concurrency == 10

    def test_search_subcommand(self):
        parser = _build_parser()
        args = parser.parse_args(["search", "--index_dir", "./idx", "--query", "hello"])
        assert args.command == "search"
        assert args.index_dir == "./idx"
        assert args.query == "hello"

    def test_verbose_flag(self):
        parser = _build_parser()
        args = parser.parse_args(["-v", "index", "--paths", "x.md"])
        assert args.verbose is True

    def test_no_command_returns_none(self):
        parser = _build_parser()
        args = parser.parse_args([])
        assert args.command is None


class TestLoadDocuments:
    def test_loads_from_db(self):
        from treesearch.fts import FTS5Index
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "index.db")
            fts = FTS5Index(db_path=db_path)
            for name in ["doc_a", "doc_b"]:
                from treesearch.tree import Document
                doc = Document(
                    doc_id=name,
                    doc_name=name,
                    structure=[{"title": f"{name} root", "node_id": "0"}],
                    doc_description=f"Description of {name}",
                )
                fts.save_document(doc)
            fts.close()

            docs = _load_documents_from_dir(tmpdir)
            assert len(docs) == 2
            names = {d.doc_name for d in docs}
            assert "doc_a" in names
            assert "doc_b" in names

    def test_empty_db_exits(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "index.db")
            from treesearch.fts import FTS5Index
            fts = FTS5Index(db_path=db_path)
            fts.close()
            with pytest.raises(SystemExit):
                _load_documents_from_dir(tmpdir)

    def test_missing_db_exits(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            with pytest.raises(SystemExit):
                _load_documents_from_dir(tmpdir)
