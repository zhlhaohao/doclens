# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Optional ripgrep (rg) integration for fast file-level grep.

Uses ``subprocess`` to call the system ``rg`` binary — no new Python
dependencies required.  All functions degrade gracefully if ``rg`` is not
installed: callers always get a valid (possibly empty) result.
"""
import json
import logging
import shutil
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)

# Cached result of rg availability check
_rg_path: Optional[str] = None
_rg_checked: bool = False


def rg_available() -> bool:
    """Return True if ``rg`` (ripgrep) is on PATH."""
    global _rg_path, _rg_checked
    if not _rg_checked:
        _rg_path = shutil.which("rg")
        _rg_checked = True
    return _rg_path is not None


def _reset_cache() -> None:
    """Reset the cached rg check (for testing only)."""
    global _rg_path, _rg_checked
    _rg_path = None
    _rg_checked = False


def rg_search(
    pattern: str,
    file_paths: list[str],
    *,
    case_sensitive: bool = False,
    use_regex: bool = False,
    max_count: int = 100,
    timeout: float = 10.0,
) -> dict[str, list[int]]:
    """Run ``rg --json`` and return ``{file_path: [line_numbers]}``.

    Args:
        pattern: search pattern (literal string or regex).
        file_paths: list of files to search in.
        case_sensitive: if False, search case-insensitively.
        use_regex: if True, treat *pattern* as a regex; otherwise ``--fixed-strings``.
        max_count: max matches per file.
        timeout: subprocess timeout in seconds.

    Returns:
        Dict mapping file paths to lists of 1-based line numbers where
        matches were found.  Returns empty dict on any error.
    """
    if not file_paths or not pattern:
        return {}

    if not rg_available():
        return {}
    rg_bin = _rg_path

    cmd = [rg_bin, "--json", "--max-count", str(max_count)]

    if not case_sensitive:
        cmd.append("--ignore-case")
    if not use_regex:
        cmd.append("--fixed-strings")

    cmd.append("--")
    cmd.append(pattern)
    cmd.extend(file_paths)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        logger.warning("rg timed out after %.1fs", timeout)
        return {}
    except (OSError, FileNotFoundError) as e:
        logger.warning("rg execution failed: %s", e)
        return {}

    # Parse JSON lines output
    hits: dict[str, list[int]] = {}
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue

        if obj.get("type") != "match":
            continue

        data = obj.get("data", {})
        path = data.get("path", {}).get("text", "")
        line_number = data.get("line_number")

        if path and line_number is not None:
            hits.setdefault(path, []).append(int(line_number))

    return hits
