"""Tests for CLI subcommands: search, ai, index, status"""

import pytest
from unittest.mock import patch, MagicMock
from io import StringIO

from cortex.cortex_cli import (
    _build_parser, _init_components,
    _cli_search, _cli_ai, _cli_index, _cli_status
)


class TestArgParser:
    def test_parser_has_search_subcommand(self):
        parser = _build_parser()
        choices = parser._subparsers._group_actions[0].choices
        assert "search" in choices

    def test_parser_has_ai_subcommand(self):
        parser = _build_parser()
        choices = parser._subparsers._group_actions[0].choices
        assert "ai" in choices

    def test_parser_has_index_subcommand(self):
        parser = _build_parser()
        choices = parser._subparsers._group_actions[0].choices
        assert "index" in choices

    def test_parser_has_status_subcommand(self):
        parser = _build_parser()
        choices = parser._subparsers._group_actions[0].choices
        assert "status" in choices


class TestSearchCommand:
    @patch("cortex.cortex_cli.IndexManager")
    @patch("cortex.cortex_cli.CortexConfig")
    def test_search_calls_format_results(self, MockConfig, MockIdx):
        mock_config = MagicMock()
        mock_config.max_results = 20
        mock_idx = MagicMock()
        mock_idx.search_path = "/tmp"
        mock_idx.index_path = "/tmp/.cortex/index.db"
        mock_idx.documents = []
        mock_idx.path_map = {}
        mock_idx.search.return_value = ([], [])
        mock_idx.max_results = 20
        mock_idx.title_width = 60
        mock_idx.line_width = 120
        mock_idx.max_context_lines = 10
        mock_idx.context_expand_range = 2
        mock_idx.min_keyword_match = 1
        mock_idx.min_proximity_score = 0
        mock_idx.min_keywords_per_line = 1
        mock_idx.max_anchor_lines = 3
        mock_idx.rg_context_before = 2
        mock_idx.rg_context_after = 2
        mock_idx.max_span = 50
        mock_idx.scoring_weights = {"title": 1.0, "body": 0.8}
        mock_idx.load_or_build_index = MagicMock()

        args = MagicMock()
        args.query = ["test", "query"]

        # Should not raise
        _cli_search(args, mock_config, mock_idx)
        mock_idx.load_or_build_index.assert_called_once()
        mock_idx.search.assert_called_once()


class TestIndexCommand:
    @patch("cortex.cortex_cli.IndexManager")
    @patch("cortex.cortex_cli.CortexConfig")
    def test_index_with_force_flag(self, MockConfig, MockIdx):
        mock_config = MagicMock()
        mock_idx = MagicMock()
        mock_idx.load_or_build_index = MagicMock()
        mock_idx.reindex = MagicMock()
        mock_idx.documents = []

        args = MagicMock()
        args.force = True

        _cli_index(args, mock_config, mock_idx)
        mock_idx.reindex.assert_called_once()
        call_kwargs = mock_idx.reindex.call_args[1]
        assert call_kwargs["force"] is True

    @patch("cortex.cortex_cli.IndexManager")
    @patch("cortex.cortex_cli.CortexConfig")
    def test_index_incremental_without_force(self, MockConfig, MockIdx):
        mock_config = MagicMock()
        mock_idx = MagicMock()
        mock_idx.load_or_build_index = MagicMock()
        mock_idx.reindex = MagicMock()
        mock_idx.documents = []

        args = MagicMock()
        args.force = False

        _cli_index(args, mock_config, mock_idx)
        mock_idx.reindex.assert_called_once()
        call_kwargs = mock_idx.reindex.call_args[1]
        assert call_kwargs["force"] is False


class TestStatusCommand:
    @patch("cortex.cortex_cli.IndexManager")
    @patch("cortex.cortex_cli.CortexConfig")
    @patch("sys.stdout", new_callable=StringIO)
    def test_status_prints_output(self, mock_stdout, MockConfig, MockIdx):
        mock_config = MagicMock()
        mock_idx = MagicMock()
        mock_idx.load_or_build_index = MagicMock()
        mock_idx.index_path = "/tmp/.cortex/index.db"
        mock_idx.search_path = "/tmp"
        mock_doc = MagicMock()
        mock_doc.metadata = {"file_size": 1024, "source_path": "/tmp/test.py"}
        mock_idx.documents = [mock_doc]

        args = MagicMock()

        _cli_status(args, mock_config, mock_idx)
        output = mock_stdout.getvalue()
        assert "NotebookSearch 状态" in output or "索引路径" in output
