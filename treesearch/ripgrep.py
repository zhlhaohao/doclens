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


def _estimate_cmd_length(cmd: list[str]) -> int:
    """Estimate total command-line length (args + separating spaces)."""
    return sum(len(arg) for arg in cmd) + len(cmd)


# Windows command-line limit (CreateProcess)
_WIN_CMD_LIMIT = 32767

# Conservative per-batch path budget (leave room for rg flags + pattern)
_BATCH_PATH_BUDGET = 25000


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
        timeout: subprocess timeout in seconds (per batch).

    Returns:
        Dict mapping file paths to lists of 1-based line numbers where
        matches were found.  Returns empty dict on any error.
    """
    if not file_paths or not pattern:
        return {}

    if not rg_available():
        return {}

    # Build base command (without file paths) to measure overhead
    base_cmd = [_rg_path, "--json", "--max-count", str(max_count)]
    if not case_sensitive:
        base_cmd.append("--ignore-case")
    if not use_regex:
        base_cmd.append("--fixed-strings")
    base_cmd.extend(["--", pattern])
    base_len = _estimate_cmd_length(base_cmd)

    # If everything fits in one command, run directly
    full_cmd = base_cmd + file_paths
    if _estimate_cmd_length(full_cmd) <= _WIN_CMD_LIMIT:
        return _run_rg(full_cmd, timeout)

    # Split into batches to stay under command-line limit
    per_path_budget = _BATCH_PATH_BUDGET - base_len
    if per_path_budget <= 0:
        logger.warning("rg base command too long, cannot run search")
        return {}

    hits: dict[str, list[int]] = {}
    batch: list[str] = []
    batch_len = 0

    for fp in file_paths:
        fp_len = len(fp) + 1  # +1 for separator
        if batch and batch_len + fp_len > per_path_budget:
            hits.update(_run_rg(base_cmd + batch, timeout))
            batch = []
            batch_len = 0
        batch.append(fp)
        batch_len += fp_len

    if batch:
        hits.update(_run_rg(base_cmd + batch, timeout))

    return hits


def _run_rg(cmd: list[str], timeout: float) -> dict[str, list[int]]:
    """Execute a single rg command and parse JSON output."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='replace',
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        logger.warning("rg timed out after %.1fs", timeout)
        return {}
    except (OSError, FileNotFoundError) as e:
        logger.warning("rg execution failed: %s", e)
        return {}

    if not result.stdout:
        return {}

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
