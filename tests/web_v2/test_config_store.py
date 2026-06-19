"""Tests for config_store: path resolution + .env read/write with key preservation."""
import os
from pathlib import Path

import pytest

from cortex.web_v2.config_store import (
    resolve_env_path,
    read_env_values,
    write_env_values,
    MERGED_VALUES_KEY,
)


def test_resolve_env_path_local_in_cwd(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    p = resolve_env_path("local")
    assert p == tmp_path / ".cortex" / ".env"


def test_resolve_env_path_global_uses_home(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))  # Windows
    p = resolve_env_path("global")
    assert p == tmp_path / ".cortex" / ".env"


def test_read_env_values_returns_empty_dict_when_missing(tmp_path):
    p = tmp_path / "missing.env"
    values, exists = read_env_values(p, frozenset({"CORTEX_MAX_RESULTS"}))
    assert values == {}
    assert exists is False


def test_read_env_values_returns_only_requested_keys(tmp_path):
    p = tmp_path / ".env"
    p.write_text(
        "CORTEX_MAX_RESULTS=20\n"
        "CORTEX_WEIGHT_KEYWORD_MATCH=3.0\n"
        "OTHER_VAR=keep_me\n",
        encoding="utf-8",
    )
    values, exists = read_env_values(
        p, frozenset({"CORTEX_MAX_RESULTS", "CORTEX_WEIGHT_KEYWORD_MATCH"})
    )
    assert exists is True
    assert values == {"CORTEX_MAX_RESULTS": "20", "CORTEX_WEIGHT_KEYWORD_MATCH": "3.0"}
    assert "OTHER_VAR" not in values  # unrequested keys filtered out


def test_write_env_values_creates_file_and_dir_if_missing(tmp_path):
    p = tmp_path / ".cortex" / ".env"
    write_env_values(
        p,
        updates={"CORTEX_MAX_RESULTS": "50", "PLANIFY_API_KEY": "sk-new"},
    )
    assert p.exists()
    text = p.read_text(encoding="utf-8")
    assert "CORTEX_MAX_RESULTS=50" in text
    assert "PLANIFY_API_KEY=sk-new" in text


def test_write_env_values_preserves_unrelated_keys_and_comments(tmp_path):
    p = tmp_path / ".env"
    p.write_text(
        "# my comment\n"
        "CORTEX_MAX_RESULTS=20\n"
        "OTHER_VAR=keep_me\n",
        encoding="utf-8",
    )
    write_env_values(p, updates={"CORTEX_MAX_RESULTS": "99"})
    text = p.read_text(encoding="utf-8")
    assert "# my comment" in text
    assert "OTHER_VAR=keep_me" in text
    assert "CORTEX_MAX_RESULTS=99" in text
    assert "CORTEX_MAX_RESULTS=20" not in text


def test_write_env_values_blanks_out_a_key_using_unset(tmp_path):
    """Empty string in updates => delete the key (per spec §6.2)."""
    p = tmp_path / ".env"
    p.write_text("PLANIFY_API_KEY=sk-old\nCORTEX_MAX_RESULTS=20\n", encoding="utf-8")
    write_env_values(p, updates={"PLANIFY_API_KEY": ""})
    text = p.read_text(encoding="utf-8")
    assert "PLANIFY_API_KEY" not in text
    assert "CORTEX_MAX_RESULTS=20" in text
