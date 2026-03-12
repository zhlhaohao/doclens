# -*- coding: utf-8 -*-
"""Tests for treesearch.ripgrep — optional rg integration."""
import json
import os
import pytest
from unittest.mock import patch, MagicMock

from treesearch.ripgrep import rg_available, rg_search, _reset_cache


class TestRgAvailable:
    def setup_method(self):
        _reset_cache()

    def teardown_method(self):
        _reset_cache()

    def test_rg_found(self):
        with patch("treesearch.ripgrep.shutil.which", return_value="/usr/bin/rg"):
            assert rg_available() is True

    def test_rg_not_found(self):
        with patch("treesearch.ripgrep.shutil.which", return_value=None):
            assert rg_available() is False

    def test_cached(self):
        with patch("treesearch.ripgrep.shutil.which", return_value="/usr/bin/rg") as mock_which:
            assert rg_available() is True
            assert rg_available() is True
            assert mock_which.call_count == 1


class TestRgSearch:
    def _make_rg_output(self, path: str, line_numbers: list[int]) -> str:
        """Build rg --json style output."""
        lines = []
        for ln in line_numbers:
            obj = {
                "type": "match",
                "data": {
                    "path": {"text": path},
                    "line_number": ln,
                    "lines": {"text": "matched line\n"},
                    "submatches": [],
                },
            }
            lines.append(json.dumps(obj))
        # rg also emits summary messages
        lines.append(json.dumps({"type": "summary", "data": {}}))
        return "\n".join(lines)

    def test_basic_search(self, tmp_path):
        f = tmp_path / "test.py"
        f.write_text("def hello():\n    pass\n")
        path_str = str(f)
        rg_output = self._make_rg_output(path_str, [1])

        mock_result = MagicMock()
        mock_result.stdout = rg_output

        with patch("treesearch.ripgrep.shutil.which", return_value="/usr/bin/rg"):
            with patch("treesearch.ripgrep.subprocess.run", return_value=mock_result):
                hits = rg_search("hello", [path_str])
                assert path_str in hits
                assert hits[path_str] == [1]

    def test_empty_pattern(self):
        assert rg_search("", ["somefile.py"]) == {}

    def test_empty_files(self):
        assert rg_search("pattern", []) == {}

    def test_rg_not_installed(self):
        with patch("treesearch.ripgrep.shutil.which", return_value=None):
            assert rg_search("hello", ["test.py"]) == {}

    def test_timeout_returns_empty(self, tmp_path):
        import subprocess
        f = tmp_path / "test.py"
        f.write_text("hello\n")

        with patch("treesearch.ripgrep.shutil.which", return_value="/usr/bin/rg"):
            with patch(
                "treesearch.ripgrep.subprocess.run",
                side_effect=subprocess.TimeoutExpired(cmd="rg", timeout=10),
            ):
                result = rg_search("hello", [str(f)])
                assert result == {}

    def test_multiple_files(self, tmp_path):
        f1 = tmp_path / "a.py"
        f2 = tmp_path / "b.py"
        f1.write_text("hello\n")
        f2.write_text("world\n")

        p1, p2 = str(f1), str(f2)
        output = self._make_rg_output(p1, [1]) + "\n" + self._make_rg_output(p2, [1])

        mock_result = MagicMock()
        mock_result.stdout = output

        with patch("treesearch.ripgrep.shutil.which", return_value="/usr/bin/rg"):
            with patch("treesearch.ripgrep.subprocess.run", return_value=mock_result):
                hits = rg_search("hello", [p1, p2])
                assert len(hits) == 2
