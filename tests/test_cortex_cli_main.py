"""Tests for cortex.cortex_cli:main pre-TUI index check."""

import os
import shutil
import sqlite3
import tempfile
from unittest.mock import patch, MagicMock

import pytest

from cortex.cortex_cli import main


class TestMainPreTuiCheck:
    @staticmethod
    def _create_empty_index(db_path: str):
        """Create an index.db with a documents table but zero rows."""
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        with sqlite3.connect(db_path) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY)")
            conn.commit()

    @staticmethod
    def _create_index_with_doc(db_path: str):
        """Create an index.db with one document row."""
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        with sqlite3.connect(db_path) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY)")
            conn.execute("INSERT INTO documents VALUES ('doc_1')")
            conn.commit()

    @patch("sys.argv", ["cortex"])
    @patch("cortex.tui.app.CortexApp")
    @patch("cortex.config.CortexConfig")
    @patch("builtins.input")
    def test_skips_prompt_when_index_has_documents(self, mock_input, MockConfig, MockApp):
        """If documents exist, main() should launch TUI immediately."""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            db_path = os.path.join(tmpdir, ".cortex", "index.db")
            self._create_index_with_doc(db_path)

            mock_config = MagicMock()
            mock_config.search_path = tmpdir
            mock_config.index_path = db_path
            MockConfig.load.return_value = mock_config

            mock_app = MagicMock()
            MockApp.return_value = mock_app

            main()

            mock_app.run.assert_called_once_with(mouse=True)
            mock_input.assert_not_called()

    @patch("sys.argv", ["cortex"])
    @patch("cortex.tui.app.CortexApp")
    @patch("cortex.config.CortexConfig")
    @patch("treesearch.treesearch.TreeSearch")
    @patch("builtins.input", return_value="y")
    def test_prompts_and_builds_index_when_empty(self, mock_input, MockTreeSearch, MockConfig, MockApp):
        """If no documents, user agrees, index builds, then TUI launches."""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            db_path = os.path.join(tmpdir, ".cortex", "index.db")
            # No index file — doc_count will be 0

            mock_config = MagicMock()
            mock_config.search_path = tmpdir
            mock_config.index_path = db_path
            MockConfig.load.return_value = mock_config

            mock_ts = MagicMock()
            MockTreeSearch.return_value = mock_ts

            mock_app = MagicMock()
            MockApp.return_value = mock_app

            main()

            mock_input.assert_called_once()
            MockTreeSearch.assert_called_once_with(tmpdir, db_path=db_path)
            mock_ts.index.assert_called_once()
            # Verify progress_callback was passed
            call_kwargs = mock_ts.index.call_args[1]
            assert "progress_callback" in call_kwargs
            mock_app.run.assert_called_once_with(mouse=True)

    @patch("sys.argv", ["cortex"])
    @patch("cortex.config.CortexConfig")
    @patch("builtins.input", return_value="n")
    def test_exits_when_user_declines(self, mock_input, MockConfig):
        """If user declines, main() should print message and exit."""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            db_path = os.path.join(tmpdir, ".cortex", "index.db")

            mock_config = MagicMock()
            mock_config.search_path = tmpdir
            mock_config.index_path = db_path
            MockConfig.load.return_value = mock_config

            with pytest.raises(SystemExit) as exc_info:
                main()

            assert exc_info.value.code == 1
            mock_input.assert_called_once()

    @patch("sys.argv", ["cortex"])
    @patch("cortex.config.CortexConfig")
    @patch("builtins.input", side_effect=EOFError)
    def test_exits_on_eof_error(self, mock_input, MockConfig):
        """In non-interactive environments, EOFError should exit gracefully."""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            db_path = os.path.join(tmpdir, ".cortex", "index.db")

            mock_config = MagicMock()
            mock_config.search_path = tmpdir
            mock_config.index_path = db_path
            MockConfig.load.return_value = mock_config

            with pytest.raises(SystemExit) as exc_info:
                main()

            assert exc_info.value.code == 1
