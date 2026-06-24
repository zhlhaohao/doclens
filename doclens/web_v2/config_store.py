"""Filesystem layer for /api/config endpoints.

Responsibilities:
- Resolve the .env path for a given scope (local|global)
- Read a subset of keys from .env (using python-dotenv)
- Write updates to .env while preserving unrelated keys / comments / order,
  with empty-string => unset_key semantics (spec §6.2)
"""
import os
from pathlib import Path

from dotenv import dotenv_values, set_key, unset_key

MERGED_VALUES_KEY = "values"  # placeholder; not currently used externally

# 18 keys exposed in the settings UI. Keep in sync with
# cortex/web_v2/frontend/src/views/settings-fields.ts (created in Task 6)
KNOWN_KEYS: frozenset[str] = frozenset({
    # AI
    "PLANIFY_BASE_URL",
    "PLANIFY_API_KEY",
    "PLANIFY_MODEL_ID",
    # Search
    "CORTEX_MAX_RESULTS",
    "CORTEX_MAX_NODES_PER_DOC",
    "CORTEX_MAX_SPAN",
    "CORTEX_MIN_KEYWORD_MATCH",
    "CORTEX_MIN_PROXIMITY_SCORE",
    "CORTEX_MIN_KEYWORDS_PER_LINE",
    "CORTEX_MIN_SCORE_THRESHOLD",
    # Scoring
    "CORTEX_WEIGHT_KEYWORD_MATCH",
    "CORTEX_WEIGHT_FILE_NAME_MATCH",
    "CORTEX_WEIGHT_FTS_SCORE",
    "CORTEX_WEIGHT_TITLE_MATCH",
    "CORTEX_WEIGHT_PROXIMITY_MATCH",
    # Terminal
    "CORTEX_MAX_CONTEXT_LINES",
    "CORTEX_MAX_ANCHOR_LINES",
    "CORTEX_CONTEXT_EXPAND_RANGE",
})


def resolve_env_path(scope: str) -> Path:
    """Return the .env file path for the given scope.

    local  -> {cwd}/.cortex/.env
    global -> {home}/.cortex/.env
    """
    if scope == "local":
        return Path(os.getcwd()) / ".cortex" / ".env"
    if scope == "global":
        return Path.home() / ".cortex" / ".env"
    raise ValueError(f"Unknown scope: {scope!r}")


def read_env_values(
    path: Path, keys: frozenset[str] = KNOWN_KEYS
) -> tuple[dict[str, str], bool]:
    """Return (values, exists).

    values maps each requested key to its current string value ("" if unset
    or if the file is missing). exists is False if `path` does not exist.
    """
    if not path.exists():
        return {k: "" for k in keys}, False
    raw = dotenv_values(str(path))  # dict[str, Optional[str]]
    return {k: (raw.get(k) or "") for k in keys}, True


def write_env_values(path: Path, updates: dict[str, str]) -> None:
    """Apply updates to .env at `path`, preserving unrelated content.

    Empty string => unset_key (per spec §6.2). Creates parent dirs and the
    file if missing.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.touch()
    for key, value in updates.items():
        if value == "":
            unset_key(str(path), key)
        else:
            set_key(str(path), key, value, quote_mode="never")
