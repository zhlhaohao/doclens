# Cortex GUI Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings page to `cortex gui` that lets users edit 18 `.env` parameters across 4 tabs (AI / Search / Scoring / Terminal), with separate scope entries (local `{cwd}/.cortex/.env` vs global `~/.cortex/.env`) accessible only via a new top AppBar's avatar dropdown.

**Architecture:** Backend adds `GET/PUT /api/config?scope=local|global` REST endpoints that read/write `.env` files via `python-dotenv` (preserving unrelated keys). Frontend adds a new `<app-bar>` web component (top of app, contains brand + avatar dropdown), a `<settings-view>` Lit component that renders a metadata-driven form (`SETTINGS_FIELDS` array of 18 field descriptors), and corresponding state slices in the existing store.

**Tech Stack:** FastAPI + python-dotenv + Pydantic (backend); Lit + Vite + Vitest (frontend).

**Spec:** [`docs/superpowers/specs/2026-06-19-cortex-gui-settings-design.md`](../specs/2026-06-19-cortex-gui-settings-design.md)
**Mockup:** [`specs/settings-page-mockup.html`](../../../specs/settings-page-mockup.html) — open in browser for visual reference. All hint text strings come from this file.

---

## File Structure

### Backend — new
- `cortex/web_v2/api/config.py` — FastAPI router: `GET /api/config`, `PUT /api/config`
- `cortex/web_v2/models/config.py` — Pydantic request/response models
- `tests/web_v2/__init__.py` — empty, makes `tests/web_v2` a package
- `tests/web_v2/test_config_api.py` — pytest tests for config endpoints

### Backend — modified
- `cortex/web_v2/app.py` — register config router

### Frontend — new
- `cortex/web_v2/frontend/src/api/config.ts` — `getConfig(scope)` / `putConfig(scope, values)` client
- `cortex/web_v2/frontend/src/views/settings-fields.ts` — `SETTINGS_FIELDS` metadata array (18 fields) + types
- `cortex/web_v2/frontend/src/views/settings-view.ts` — `<settings-view>` Lit component (tabs + form + footer)
- `cortex/web_v2/frontend/src/components/app-bar.ts` — `<app-bar>` component (brand + avatar + dropdown)
- `cortex/web_v2/frontend/tests/config-api.spec.ts` — API client tests
- `cortex/web_v2/frontend/tests/settings-fields.spec.ts` — metadata sanity tests
- `cortex/web_v2/frontend/tests/settings-view.spec.ts` — SettingsView rendering tests
- `cortex/web_v2/frontend/tests/app-bar.spec.ts` — AppBar interaction tests

### Frontend — modified
- `cortex/web_v2/frontend/src/state/types.ts` — extend `ViewId`, add `SettingsScope` / `SettingsViewState` / `SettingsFieldValues`
- `cortex/web_v2/frontend/src/state/store.ts` — settings actions + INITIAL_STATE extension
- `cortex/web_v2/frontend/src/app.ts` — wrap layout in `app-shell` flex column + mount `<app-bar>` + route `settings` view

### Unchanged (per spec)
- `cortex/web_v2/frontend/src/components/activity-bar.ts` — stays 3 items
- `cortex/web_v2/frontend/src/components/tab-bar.ts` — mobile bottom nav stays 3 items

---

## Phase 1: Backend

### Task 1: Backend Pydantic models for config endpoint

**Files:**
- Create: `cortex/web_v2/models/config.py`
- Create: `tests/web_v2/__init__.py`
- Create: `tests/web_v2/test_config_models.py`

- [ ] **Step 1: Write the failing test**

Create `tests/web_v2/__init__.py` (empty file) and `tests/web_v2/test_config_models.py`:

```python
"""Tests for config request/response models."""
from cortex.web_v2.models.config import (
    ConfigScope,
    ConfigResponse,
    ConfigUpdateRequest,
    ConfigSaveResult,
)


def test_config_scope_values():
    assert ConfigScope.LOCAL == "local"
    assert ConfigScope.GLOBAL == "global"


def test_config_response_carries_values_and_exists_flag():
    resp = ConfigResponse(
        scope="local",
        values={"CORTEX_MAX_RESULTS": "20", "PLANIFY_API_KEY": ""},
        exists=True,
    )
    assert resp.scope == "local"
    assert resp.values["CORTEX_MAX_RESULTS"] == "20"
    assert resp.exists is True


def test_config_update_request_accepts_arbitrary_string_values():
    req = ConfigUpdateRequest(
        values={
            "CORTEX_MAX_RESULTS": "50",
            "PLANIFY_API_KEY": "sk-new",
        }
    )
    assert req.values["CORTEX_MAX_RESULTS"] == "50"


def test_config_save_result_reports_needs_restart_with_field_list():
    result = ConfigSaveResult(
        ok=True,
        saved_path="/tmp/.cortex/.env",
        needs_restart=True,
        restart_fields=["PLANIFY_API_KEY"],
    )
    assert result.needs_restart is True
    assert "PLANIFY_API_KEY" in result.restart_fields
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'cortex.web_v2.models.config'`

- [ ] **Step 3: Implement the models**

Create `cortex/web_v2/models/config.py`:

```python
"""Pydantic models for /api/config endpoints.

Values are always exchanged as strings (matching .env on-disk format).
Numeric / enum validation happens in IndexManager-backed validation on
the PUT path, not in these transport models.
"""
from typing import Optional

from pydantic import BaseModel, Field


class ConfigScope:
    """Scope constants for config read/write."""
    LOCAL = "local"
    GLOBAL = "global"


# Fields whose change requires restarting cortex gui to take effect.
# Must stay in sync with the `effect: "restart"` metadata in
# cortex/web_v2/frontend/src/views/settings-fields.ts
RESTART_FIELDS: frozenset[str] = frozenset({
    "PLANIFY_BASE_URL",
    "PLANIFY_API_KEY",
    "PLANIFY_MODEL_ID",
})


class ConfigResponse(BaseModel):
    """Response for GET /api/config?scope=..."""
    scope: str
    values: dict[str, str]        # env-var name -> current string value (may be "")
    exists: bool                  # False if the target .env file does not exist


class ConfigUpdateRequest(BaseModel):
    """Request body for PUT /api/config?scope=..."""
    values: dict[str, str] = Field(..., description="env-var name -> new string value")


class ConfigSaveResult(BaseModel):
    """Response for successful PUT."""
    ok: bool = True
    saved_path: str
    needs_restart: bool           # True if any changed field is in RESTART_FIELDS
    restart_fields: list[str]     # subset of changed fields that need restart


class ConfigValidationError(BaseModel):
    """Per-field validation error, returned with HTTP 400."""
    field: str
    error: str
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_models.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add cortex/web_v2/models/config.py tests/web_v2/__init__.py tests/web_v2/test_config_models.py
git commit -m "feat(web_v2): add Pydantic models for /api/config endpoints"
```

---

### Task 2: Path resolver + .env reader/writer helpers

**Files:**
- Create: `cortex/web_v2/config_store.py`
- Create: `tests/web_v2/test_config_store.py`

This module isolates all filesystem interaction so the router layer stays thin.

- [ ] **Step 1: Write the failing test**

Create `tests/web_v2/test_config_store.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_store.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement config_store**

Create `cortex/web_v2/config_store.py`:

```python
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
# cortex/web_v2/frontend/src/views/settings-fields.ts
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

    values maps each requested key to its current string value ("" if unset).
    exists is False if `path` does not exist on disk.
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
            set_key(str(path), key, value)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_store.py -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add cortex/web_v2/config_store.py tests/web_v2/test_config_store.py
git commit -m "feat(web_v2): add config_store for .env read/write with key preservation"
```

---

### Task 3: Validation helper (validates values against CortexConfig)

**Files:**
- Create: `cortex/web_v2/config_validator.py`
- Create: `tests/web_v2/test_config_validator.py`

- [ ] **Step 1: Write the failing test**

Create `tests/web_v2/test_config_validator.py`:

```python
"""Tests for config_validator: validates a values dict against CortexConfig."""
from cortex.web_v2.config_validator import validate_values, ValidationErrors


def test_validate_accepts_known_good_values():
    errors = validate_values({
        "CORTEX_MAX_RESULTS": "20",
        "CORTEX_WEIGHT_KEYWORD_MATCH": "3.0",
        "PLANIFY_API_KEY": "sk-test",
    })
    assert errors.fields == []


def test_validate_rejects_non_numeric_for_int_field():
    errors = validate_values({"CORTEX_MAX_RESULTS": "not-a-number"})
    assert any("CORTEX_MAX_RESULTS" in f.field for f in errors.fields)


def test_validate_rejects_value_out_of_range_implied_by_pydantic():
    """Pydantic itself doesn't enforce range; this test only verifies that
    a type mismatch (float string for int) is caught."""
    errors = validate_values({"CORTEX_MAX_RESULTS": "3.5"})
    assert any("CORTEX_MAX_RESULTS" in f.field for f in errors.fields)


def test_validate_rejects_unknown_key():
    errors = validate_values({"SOMETHING_UNEXPECTED": "x"})
    assert any("SOMETHING_UNEXPECTED" in f.field for f in errors.fields)


def test_validate_collects_multiple_errors():
    errors = validate_values({
        "CORTEX_MAX_RESULTS": "abc",
        "CORTEX_MIN_PROXIMITY_SCORE": "not-int",
        "UNKNOWN_KEY": "x",
    })
    assert len(errors.fields) >= 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_validator.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement validator**

Create `cortex/web_v2/config_validator.py`:

```python
"""Validate a {env_var: value} dict against the CortexConfig schema.

We construct a CortexConfig with the supplied values (via env injection) and
catch pydantic ValidationError, mapping each error to (field, message).
Unknown keys are reported separately.
"""
from __future__ import annotations

import os
from typing import Iterable

from pydantic import ValidationError

from cortex.config import CortexConfig
from cortex.web_v2.config_store import KNOWN_KEYS
from cortex.web_v2.models.config import ConfigValidationError


class ValidationErrors(Exception):
    """Aggregated per-field validation errors."""

    def __init__(self, fields: list[ConfigValidationError]) -> None:
        self.fields = fields
        super().__init__("; ".join(f"{f.field}: {f.error}" for f in fields))


def validate_values(values: dict[str, str]) -> ValidationErrors:
    """Return ValidationErrors (possibly empty) for the given values dict.

    Two sources of error:
    1. Unknown key (not in KNOWN_KEYS)
    2. pydantic ValidationError when constructing CortexConfig with these values
       (covers type mismatches like non-numeric strings for int fields)
    """
    errors: list[ConfigValidationError] = []

    # 1. Unknown keys
    for key in values:
        if key not in KNOWN_KEYS:
            errors.append(ConfigValidationError(
                field=key,
                error=f"未知的配置项: {key}",
            ))

    # 2. Type validation via CortexConfig
    # CortexConfig uses env_prefix="CORTEX_" and several aliases (PLANIFY_*,
    # TREESEARCH_*). The cleanest cross-cutting validation is to construct it
    # inside a modified environment.
    env_backup = dict(os.environ)
    try:
        # Clear our known keys from env first so only `values` apply
        for key in KNOWN_KEYS:
            os.environ.pop(key, None)
        for key, value in values.items():
            if key in KNOWN_KEYS:
                os.environ[key] = value
        try:
            CortexConfig(_env_file=None)
        except ValidationError as ve:
            for err in ve.errors():
                # err["loc"] is a tuple like ("max_results",) or ("planify_api_key",)
                loc = ".".join(str(part) for part in err.get("loc", ()))
                msg = err.get("msg", "invalid")
                errors.append(ConfigValidationError(field=loc, error=msg))
    finally:
        # Restore env
        os.environ.clear()
        os.environ.update(env_backup)

    return ValidationErrors(fields=errors)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_validator.py -v`
Expected: PASS (5 tests)

> If the env-mutation approach proves flaky on Windows, alternative: instantiate `CortexConfig(**transformed_kwargs)` directly by mapping each env-var name to its pydantic field name (use `CortexConfig.model_fields` reverse lookup). The test should still pass either way.

- [ ] **Step 5: Commit**

```bash
git add cortex/web_v2/config_validator.py tests/web_v2/test_config_validator.py
git commit -m "feat(web_v2): add config_validator for per-field type checking"
```

---

### Task 4: Config router (GET + PUT endpoints)

**Files:**
- Create: `cortex/web_v2/api/config.py`
- Create: `tests/web_v2/test_config_api.py`

- [ ] **Step 1: Write the failing test**

Create `tests/web_v2/test_config_api.py`:

```python
"""Integration tests for /api/config endpoints via FastAPI TestClient."""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from cortex.web_v2.app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    """App client with cwd and HOME both pointed at tmp_path."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    return TestClient(create_app())


def test_get_local_config_returns_empty_when_file_missing(client, tmp_path):
    resp = client.get("/api/config", params={"scope": "local"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["scope"] == "local"
    assert body["exists"] is False
    # All 18 keys present with empty values
    assert len(body["values"]) == 18
    assert all(v == "" for v in body["values"].values())


def test_get_local_config_reads_existing_values(client, tmp_path):
    env_path = tmp_path / ".cortex" / ".env"
    env_path.parent.mkdir(parents=True)
    env_path.write_text(
        "CORTEX_MAX_RESULTS=42\nPLANIFY_API_KEY=sk-test\n",
        encoding="utf-8",
    )
    resp = client.get("/api/config", params={"scope": "local"})
    body = resp.json()
    assert body["exists"] is True
    assert body["values"]["CORTEX_MAX_RESULTS"] == "42"
    assert body["values"]["PLANIFY_API_KEY"] == "sk-test"
    # Untouched known key still present (empty)
    assert body["values"]["CORTEX_MAX_SPAN"] == ""


def test_put_local_config_creates_file_and_writes_values(client, tmp_path):
    resp = client.put("/api/config", params={"scope": "local"}, json={
        "values": {"CORTEX_MAX_RESULTS": "99", "PLANIFY_API_KEY": "sk-new"}
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["needs_restart"] is True
    assert "PLANIFY_API_KEY" in body["restart_fields"]
    saved_path = tmp_path / ".cortex" / ".env"
    assert saved_path.exists()
    assert "CORTEX_MAX_RESULTS=99" in saved_path.read_text(encoding="utf-8")


def test_put_local_config_no_restart_when_only_live_fields(client, tmp_path):
    resp = client.put("/api/config", params={"scope": "local"}, json={
        "values": {"CORTEX_MAX_RESULTS": "99"}
    })
    body = resp.json()
    assert body["needs_restart"] is False
    assert body["restart_fields"] == []


def test_put_returns_400_on_type_validation_error(client):
    resp = client.put("/api/config", params={"scope": "local"}, json={
        "values": {"CORTEX_MAX_RESULTS": "not-a-number"}
    })
    assert resp.status_code == 400
    body = resp.json()
    assert any("max_results" in f["field"] or "CORTEX_MAX_RESULTS" in f["field"]
               for f in body["fields"])


def test_put_rejects_unknown_scope(client):
    resp = client.get("/api/config", params={"scope": "weird"})
    assert resp.status_code == 400
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_api.py -v`
Expected: FAIL with `ModuleNotFoundError` or 404 (router not registered)

- [ ] **Step 3: Implement router**

Create `cortex/web_v2/api/config.py`:

```python
"""GET/PUT /api/config — read/write .env for a given scope."""
import logging
from typing import Literal

from fastapi import APIRouter, Query

from cortex.web_v2.config_store import (
    KNOWN_KEYS,
    read_env_values,
    resolve_env_path,
    write_env_values,
)
from cortex.web_v2.config_validator import ValidationErrors, validate_values
from cortex.web_v2.models.config import (
    ConfigResponse,
    ConfigSaveResult,
    ConfigUpdateRequest,
    RESTART_FIELDS,
)
from cortex.web_v2.api.errors import CortexAPIError

logger = logging.getLogger(__name__)
router = APIRouter()

Scope = Literal["local", "global"]


@router.get("/config", response_model=ConfigResponse)
async def get_config(scope: Scope = Query(...)):
    try:
        path = resolve_env_path(scope)
    except ValueError as e:
        raise CortexAPIError(400, "INVALID_SCOPE", str(e))
    values, exists = read_env_values(path, KNOWN_KEYS)
    return ConfigResponse(scope=scope, values=values, exists=exists)


@router.put("/config", response_model=ConfigSaveResult)
async def put_config(
    req: ConfigUpdateRequest,
    scope: Scope = Query(...),
):
    try:
        path = resolve_env_path(scope)
    except ValueError as e:
        raise CortexAPIError(400, "INVALID_SCOPE", str(e))

    # 1. Validate
    errors = validate_values(req.values)
    if errors.fields:
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=400,
            content={
                "code": "VALIDATION_FAILED",
                "fields": [f.model_dump() for f in errors.fields],
            },
        )

    # 2. Diff against current to compute needs_restart
    current_values, _ = read_env_values(path, KNOWN_KEYS)
    changed_fields = [
        k for k, v in req.values.items()
        if (current_values.get(k, "") != v)
    ]
    restart_fields = [f for f in changed_fields if f in RESTART_FIELDS]

    # 3. Write
    try:
        write_env_values(path, req.values)
    except PermissionError as e:
        raise CortexAPIError(403, "WRITE_FORBIDDEN", f"无法写入 {path}: {e}")

    logger.info("config saved: scope=%s path=%s restart=%s", scope, path, restart_fields)
    return ConfigSaveResult(
        ok=True,
        saved_path=str(path),
        needs_restart=bool(restart_fields),
        restart_fields=restart_fields,
    )
```

- [ ] **Step 4: Register router in app.py**

Modify `cortex/web_v2/app.py`. Find the block where routers are registered (around line 25-34, where `search`, `preview`, `sessions`, `status`, `chat` are included) and add `config`:

```python
    from cortex.web_v2.api import chat
    app.include_router(chat.router, prefix="/api")
    from cortex.web_v2.api import config
    app.include_router(config.router, prefix="/api")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_api.py -v`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add cortex/web_v2/api/config.py cortex/web_v2/app.py tests/web_v2/test_config_api.py
git commit -m "feat(web_v2): add GET/PUT /api/config endpoints with validation"
```

---

## Phase 2: Frontend foundation

### Task 5: Extend state types + store actions

**Files:**
- Modify: `cortex/web_v2/frontend/src/state/types.ts`
- Modify: `cortex/web_v2/frontend/src/state/store.ts`
- Create: `cortex/web_v2/frontend/tests/store-settings.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `cortex/web_v2/frontend/tests/store-settings.spec.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { store, actions } from "../src/state/store";
import { SETTINGS_FIELDS } from "../src/views/settings-fields";

describe("settings store slice", () => {
  it("starts with scope=local and empty values", () => {
    const s = store.getState();
    expect(s.settings.scope).toBe("local");
    expect(s.settings.values).toEqual({});
    expect(s.settings.dirty).toBe(false);
  });

  it("updateSetting mutates a single field and marks dirty", () => {
    store.setState({
      ...store.getState(),
      settings: {
        ...store.getState().settings,
        original: { CORTEX_MAX_RESULTS: "20" },
        values: { CORTEX_MAX_RESULTS: "20" },
      },
    });
    actions.updateSetting("CORTEX_MAX_RESULTS", "99");
    const s = store.getState();
    expect(s.settings.values.CORTEX_MAX_RESULTS).toBe("99");
    expect(s.settings.dirty).toBe(true);
  });

  it("revertSettings restores values from original and clears dirty", () => {
    store.setState({
      ...store.getState(),
      settings: {
        scope: "local",
        original: { CORTEX_MAX_RESULTS: "20" },
        values: { CORTEX_MAX_RESULTS: "99" },
        dirty: true,
        saving: false,
        error: null,
        exists: true,
      },
    });
    actions.revertSettings();
    const s = store.getState();
    expect(s.settings.values.CORTEX_MAX_RESULTS).toBe("20");
    expect(s.settings.dirty).toBe(false);
  });

  it("setSettingsScope changes scope", () => {
    actions.setSettingsScope("global");
    expect(store.getState().settings.scope).toBe("global");
  });

  it("computeDirtyCount counts changed fields", () => {
    store.setState({
      ...store.getState(),
      settings: {
        scope: "local",
        original: { A: "1", B: "2", C: "3" },
        values: { A: "1", B: "9", C: "8" },
        dirty: true,
        saving: false,
        error: null,
        exists: true,
      },
    });
    // dirtyFields selector should return ["B", "C"]
    expect(store.getState().settings.dirtyFields).toEqual(["B", "C"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/store-settings.spec.ts`
Expected: FAIL with TypeScript errors (no `settings` slice, no `SETTINGS_FIELDS`)

- [ ] **Step 3: Update types.ts**

Modify `cortex/web_v2/frontend/src/state/types.ts`:

```typescript
/** 前端全局状态类型定义。 */

export type ViewId = "search" | "chat" | "history" | "settings";
export type FocusState = "initial" | "focus";

// ... (existing SearchResult, ChatMessage, Session, etc. unchanged)

/** Settings page */
export type SettingsScope = "local" | "global";
export type SettingsFieldValues = Record<string, string>;

export interface SettingsViewState {
  scope: SettingsScope;
  values: SettingsFieldValues;
  original: SettingsFieldValues;   // snapshot at load / last save
  dirty: boolean;                   // recomputed on every action for convenience
  exists: boolean;                  // does the target .env exist on disk?
  saving: boolean;
  error: string | null;
}

export interface AppState {
  view: ViewId;
  search: SearchViewState;
  chat: ChatViewState;
  settings: SettingsViewState;
  /** 详情推入栈（移动端整页推入） */
  detailStack: SearchResult[];
  /** 跨视图会话加载请求（history-view → search-view / chat-view） */
  pendingSession: Session | null;
  status: SystemStatus | null;
  error: string | null;
}
```

- [ ] **Step 4: Create placeholder settings-fields.ts so import resolves**

Create `cortex/web_v2/frontend/src/views/settings-fields.ts` with a minimal placeholder (we'll fill it in Task 7):

```typescript
/** Field metadata for the settings form. Filled in fully by Task 7. */
export type SettingsTab = "ai" | "search" | "scoring" | "terminal";
export type SettingsFieldComponent =
  | "text"
  | "number"
  | "select"
  | "password"
  | "slider";
export type SettingsFieldEffect = "live" | "restart";

export interface SettingsFieldOption {
  value: string;
  label: string;
}

export interface SettingsField {
  tab: SettingsTab;
  section: string;
  envVar: string;
  label: string;
  component: SettingsFieldComponent;
  effect?: SettingsFieldEffect;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  mono?: boolean;
  datalist?: string[];
  options?: SettingsFieldOption[];
}

export const SETTINGS_FIELDS: SettingsField[] = [];  // filled in Task 7
```

- [ ] **Step 5: Update store.ts**

Modify `cortex/web_v2/frontend/src/state/store.ts`. Find the `INITIAL_STATE` declaration (around line 9) and add `settings` slice:

```typescript
const INITIAL_STATE: AppState = {
  view: "search",
  search: { /* unchanged */ },
  chat: { /* unchanged */ },
  settings: {
    scope: "local",
    values: {},
    original: {},
    dirty: false,
    exists: true,
    saving: false,
    error: null,
  },
  detailStack: [],
  pendingSession: null,
  status: null,
  error: null,
};
```

Then find the `actions` object (or the equivalent mutation methods) and add settings actions. First add a `computeDirty` helper at the top of the file (module-scope, above the class):

```typescript
function computeDirty(
  original: SettingsFieldValues,
  values: SettingsFieldValues,
): boolean {
  const keys = new Set([...Object.keys(original), ...Object.keys(values)]);
  for (const k of keys) {
    if ((original[k] ?? "") !== (values[k] ?? "")) return true;
  }
  return false;
}

function dirtyFieldList(
  original: SettingsFieldValues,
  values: SettingsFieldValues,
): string[] {
  const keys = new Set([...Object.keys(original), ...Object.keys(values)]);
  const changed: string[] = [];
  for (const k of keys) {
    if ((original[k] ?? "") !== (values[k] ?? "")) changed.push(k);
  }
  return changed;
}
```

Then add settings actions to the existing `actions` object (match the existing method-declaration style — see how `setView` is defined):

```typescript
  setSettingsScope(scope: SettingsScope) {
    state.settings = { ...state.settings, scope };
    emit();
  },

  loadSettings(values: SettingsFieldValues, exists: boolean) {
    state.settings = {
      ...state.settings,
      values: { ...values },
      original: { ...values },
      exists,
      dirty: false,
      error: null,
    };
    emit();
  },

  updateSetting(field: string, value: string) {
    const values = { ...state.settings.values, [field]: value };
    const dirty = computeDirty(state.settings.original, values);
    state.settings = { ...state.settings, values, dirty };
    emit();
  },

  revertSettings() {
    const values = { ...state.settings.original };
    state.settings = { ...state.settings, values, dirty: false };
    emit();
  },

  setSettingsSaving(saving: boolean) {
    state.settings = { ...state.settings, saving };
    emit();
  },

  setSettingsError(error: string | null) {
    state.settings = { ...state.settings, error };
    emit();
  },
```

Export a `selectSettingsDirtyFields` selector for the test (and for any view that wants the dirty list). Add at the bottom of `store.ts`:

```typescript
export function selectSettingsDirtyFields(state: AppState): string[] {
  return dirtyFieldList(state.settings.original, state.settings.values);
}
```

Update the `computeDirtyCount` test (last test in Step 1's test file) to use this selector instead of `state.settings.dirtyFields`:

```typescript
import { selectSettingsDirtyFields } from "../src/state/store";

it("selectSettingsDirtyFields counts changed fields", () => {
  store.setState({
    ...store.getState(),
    settings: {
      scope: "local",
      original: { A: "1", B: "2", C: "3" },
      values: { A: "1", B: "9", C: "8" },
      dirty: true,
      exists: true,
      saving: false,
      error: null,
    },
  });
  expect(selectSettingsDirtyFields(store.getState())).toEqual(["B", "C"]);
});
```

Make sure to add the new types to the import block at top of `store.ts`:

```typescript
import type {
  AppState,
  Session,
  SettingsFieldValues,
  SettingsScope,
} from "./types";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/store-settings.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add cortex/web_v2/frontend/src/state/types.ts cortex/web_v2/frontend/src/state/store.ts cortex/web_v2/frontend/src/views/settings-fields.ts cortex/web_v2/frontend/tests/store-settings.spec.ts
git commit -m "feat(web_v2): add settings slice to store with scope/values/dirty tracking"
```

---

### Task 6: SETTINGS_FIELDS metadata (18 fields)

**Files:**
- Modify: `cortex/web_v2/frontend/src/views/settings-fields.ts`
- Create: `cortex/web_v2/frontend/tests/settings-fields.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `cortex/web_v2/frontend/tests/settings-fields.spec.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  SETTINGS_FIELDS,
  SETTINGS_TABS,
  type SettingsField,
} from "../src/views/settings-fields";

describe("SETTINGS_FIELDS", () => {
  it("has exactly 18 fields", () => {
    expect(SETTINGS_FIELDS).toHaveLength(18);
  });

  it("every field has a unique envVar", () => {
    const envVars = SETTINGS_FIELDS.map((f) => f.envVar);
    expect(new Set(envVars).size).toBe(envVars.length);
  });

  it("every field has tab/section/envVar/label/component", () => {
    for (const f of SETTINGS_FIELDS) {
      expect(f.tab).toBeTruthy();
      expect(f.section).toBeTruthy();
      expect(f.envVar).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(f.label).toBeTruthy();
      expect(["text", "number", "select", "password", "slider"]).toContain(f.component);
    }
  });

  it("select fields have at least 2 options", () => {
    for (const f of SETTINGS_FIELDS) {
      if (f.component === "select") {
        expect(f.options?.length ?? 0).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("number/slider fields have min < max", () => {
    for (const f of SETTINGS_FIELDS) {
      if (f.component === "number" || f.component === "slider") {
        expect(typeof f.min).toBe("number");
        expect(typeof f.max).toBe("number");
        expect(f.min!).toBeLessThan(f.max!);
      }
    }
  });

  it("4 tabs are exposed in SETTINGS_TABS in display order", () => {
    expect(SETTINGS_TABS).toEqual(["ai", "search", "scoring", "terminal"]);
  });

  it("AI tab has 3 fields all marked restart", () => {
    const ai = SETTINGS_FIELDS.filter((f) => f.tab === "ai");
    expect(ai).toHaveLength(3);
    expect(ai.every((f) => f.effect === "restart")).toBe(true);
  });

  it("password field is PLANIFY_API_KEY with mono", () => {
    const apiKey = SETTINGS_FIELDS.find((f) => f.envVar === "PLANIFY_API_KEY");
    expect(apiKey?.component).toBe("password");
    expect(apiKey?.mono).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/settings-fields.spec.ts`
Expected: FAIL (length 0, not 18)

- [ ] **Step 3: Populate SETTINGS_FIELDS**

Replace the empty `SETTINGS_FIELDS` in `cortex/web_v2/frontend/src/views/settings-fields.ts` with the full 18-field array. Add `SETTINGS_TABS` export. Hint strings come from `specs/settings-page-mockup.html`:

```typescript
export const SETTINGS_TABS: SettingsTab[] = ["ai", "search", "scoring", "terminal"];

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  ai: "AI 配置",
  search: "搜索调优",
  scoring: "评分",
  terminal: "终端",
};

export const SETTINGS_FIELDS: SettingsField[] = [
  // ===== AI 配置 (3) =====
  {
    tab: "ai",
    section: "🤖 AI 模型与 API",
    envVar: "PLANIFY_BASE_URL",
    label: "API Base URL",
    component: "text",
    effect: "restart",
    mono: true,
    hint: "Anthropic API 端点。可替换为兼容代理或本地模型服务。",
  },
  {
    tab: "ai",
    section: "🤖 AI 模型与 API",
    envVar: "PLANIFY_API_KEY",
    label: "API Key",
    component: "password",
    effect: "restart",
    mono: true,
    hint: "Anthropic API 密钥。保存时写入 .env，不会回传到前端其它视图。",
  },
  {
    tab: "ai",
    section: "🤖 AI 模型与 API",
    envVar: "PLANIFY_MODEL_ID",
    label: "模型 ID",
    component: "text",
    effect: "restart",
    mono: true,
    datalist: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5"],
    hint: "支持自动补全常见模型；也可手动输入自定义模型 ID。",
  },

  // ===== 搜索调优 (7) =====
  {
    tab: "search",
    section: "📊 结果数量",
    envVar: "CORTEX_MAX_RESULTS",
    label: "最大结果数（跨文档）",
    component: "number",
    effect: "live",
    min: 1, max: 200,
    hint: "search 工具返回的最大文档数量。",
  },
  {
    tab: "search",
    section: "📊 结果数量",
    envVar: "CORTEX_MAX_NODES_PER_DOC",
    label: "每文档最大节点数",
    component: "number",
    effect: "live",
    min: 1, max: 20,
    hint: "同一文档返回的最大节点（段落）数。",
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MAX_SPAN",
    label: "关键词最大跨度",
    component: "number",
    effect: "live",
    min: 1, max: 100,
    hint: "窗口内匹配关键词的最大字符跨度。",
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MIN_KEYWORD_MATCH",
    label: "最少关键词匹配数",
    component: "number",
    effect: "live",
    min: 0, max: 10,
    hint: "文档至少命中多少个关键词才进入候选。",
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MIN_PROXIMITY_SCORE",
    label: "最低邻近度阈值",
    component: "select",
    effect: "live",
    options: [
      { value: "0", label: "0 — 不限制" },
      { value: "1", label: "1 — 部分紧邻" },
      { value: "2", label: "2 — 全部关键词紧邻" },
    ],
    hint: "关键词在文档中的邻近程度阈值。",
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MIN_KEYWORDS_PER_LINE",
    label: "行级关键词阈值",
    component: "number",
    effect: "live",
    min: 1, max: 10,
    hint: '单行至少命中多少关键词才被选为"最佳行"。',
  },
  {
    tab: "search",
    section: "🎯 关键词匹配",
    envVar: "CORTEX_MIN_SCORE_THRESHOLD",
    label: "综合评分阈值",
    component: "number",
    effect: "live",
    min: 0, max: 1, step: 0.05,
    hint: "0 = 不过滤；0.3 = 轻微过滤；0.5+ 容易砍光多关键词结果。",
  },

  // ===== 评分 (5) =====
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_KEYWORD_MATCH",
    label: "关键词匹配权重",
    component: "slider",
    effect: "live",
    min: 0, max: 10, step: 0.1,
    hint: "权重越大，越偏好'命中的关键词数量多'的文档（多关键词 query 时尤其重要）。",
  },
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_FILE_NAME_MATCH",
    label: "文件名匹配权重",
    component: "slider",
    effect: "live",
    min: 0, max: 10, step: 0.1,
    hint: "权重越大，文件名包含关键词的文档排序越靠前。",
  },
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_FTS_SCORE",
    label: "FTS 原始分权重",
    component: "slider",
    effect: "live",
    min: 0, max: 10, step: 0.1,
    hint: "权重越大，越偏向传统全文检索 BM25 排序（与关键词匹配度正相关）。",
  },
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_TITLE_MATCH",
    label: "标题匹配权重",
    component: "slider",
    effect: "live",
    min: 0, max: 10, step: 0.1,
    hint: "权重越大，节点标题（如 Markdown 小节标题）含关键词时排序越靠前。",
  },
  {
    tab: "scoring",
    section: "⚖️ 权重配置",
    envVar: "CORTEX_WEIGHT_PROXIMITY_MATCH",
    label: "邻近度权重",
    component: "slider",
    effect: "live",
    min: 0, max: 10, step: 0.1,
    hint: "权重越大，多关键词在文档中紧邻出现的文档越受偏好。",
  },

  // ===== 终端 (3) =====
  {
    tab: "terminal",
    section: "🖥️ 终端结果显示",
    envVar: "CORTEX_MAX_CONTEXT_LINES",
    label: "上下文行数上限",
    component: "number",
    unit: "行",
    hint: "每个命中行向上/向下最多各显示多少行原文上下文。",
  },
  {
    tab: "terminal",
    section: "🖥️ 终端结果显示",
    envVar: "CORTEX_MAX_ANCHOR_LINES",
    label: "锚点行数上限",
    component: "number",
    unit: "行",
    hint: "从同一文档的所有命中行里，挑出多少个'最佳行'作为展示中心（锚点）。锚点越多，结果越完整但输出越长。",
  },
  {
    tab: "terminal",
    section: "🖥️ 终端结果显示",
    envVar: "CORTEX_CONTEXT_EXPAND_RANGE",
    label: "锚点上下文扩展范围",
    component: "number",
    unit: "行",
    hint: "以每个锚点为中心，向前/向后各展开多少行作为上下文（再与'上下文行数上限'取较小值）。",
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/settings-fields.spec.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add cortex/web_v2/frontend/src/views/settings-fields.ts cortex/web_v2/frontend/tests/settings-fields.spec.ts
git commit -m "feat(web_v2): populate SETTINGS_FIELDS metadata (18 fields across 4 tabs)"
```

---

### Task 7: API client for /api/config

**Files:**
- Create: `cortex/web_v2/frontend/src/api/config.ts`
- Create: `cortex/web_v2/frontend/tests/config-api.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `cortex/web_v2/frontend/tests/config-api.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getConfig, putConfig, type ConfigResponse, type ConfigSaveResult } from "../src/api/config";

describe("config api client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("getConfig builds GET /api/config?scope=... and parses response", async () => {
    const mock: ConfigResponse = {
      scope: "local",
      values: { CORTEX_MAX_RESULTS: "20" },
      exists: true,
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    });

    const result = await getConfig("local");
    expect(result).toEqual(mock);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/config?scope=local",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("putConfig builds PUT /api/config?scope=... with JSON body", async () => {
    const mock: ConfigSaveResult = {
      ok: true,
      saved_path: "/tmp/.env",
      needs_restart: true,
      restart_fields: ["PLANIFY_API_KEY"],
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mock,
    });

    const result = await putConfig("global", { PLANIFY_API_KEY: "sk-new" });
    expect(result.needs_restart).toBe(true);
    const [url, init] = (globalThis.fetch as any).mock.calls[0];
    expect(url).toBe("/api/config?scope=global");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ values: { PLANIFY_API_KEY: "sk-new" } });
  });

  it("getConfig throws on non-ok response", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: "bad scope" }),
    });
    await expect(getConfig("weird")).rejects.toThrow();
  });

  it("putConfig surfaces validation error body on 400", async () => {
    const errBody = {
      code: "VALIDATION_FAILED",
      fields: [{ field: "max_results", error: "bad int" }],
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => errBody,
    });
    await expect(putConfig("local", { CORTEX_MAX_RESULTS: "x" })).rejects.toMatchObject({
      status: 400,
      body: errBody,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/config-api.spec.ts`
Expected: FAIL with module not found

- [ ] **Step 3: Implement the API client**

Create `cortex/web_v2/frontend/src/api/config.ts`:

```typescript
// Config API client for /api/config
import type { SettingsScope } from "../state/types";

export interface ConfigResponse {
  scope: SettingsScope;
  values: Record<string, string>;
  exists: boolean;
}

export interface ConfigSaveResult {
  ok: boolean;
  saved_path: string;
  needs_restart: boolean;
  restart_fields: string[];
}

export interface ConfigValidationError {
  code: "VALIDATION_FAILED";
  fields: { field: string; error: string }[];
}

export class ConfigApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Config API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function getConfig(scope: SettingsScope): Promise<ConfigResponse> {
  const resp = await fetch(`/api/config?scope=${scope}`, { method: "GET" });
  if (!resp.ok) {
    throw new ConfigApiError(resp.status, await resp.json().catch(() => null));
  }
  return resp.json();
}

export async function putConfig(
  scope: SettingsScope,
  values: Record<string, string>,
): Promise<ConfigSaveResult> {
  const resp = await fetch(`/api/config?scope=${scope}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new ConfigApiError(resp.status, body);
  }
  return body as ConfigSaveResult;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/config-api.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add cortex/web_v2/frontend/src/api/config.ts cortex/web_v2/frontend/tests/config-api.spec.ts
git commit -m "feat(web_v2): add config API client with typed responses"
```

---

## Phase 3: Frontend components

### Task 8: `<app-bar>` component (brand + avatar dropdown)

**Files:**
- Create: `cortex/web_v2/frontend/src/components/app-bar.ts`
- Create: `cortex/web_v2/frontend/tests/app-bar.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `cortex/web_v2/frontend/tests/app-bar.spec.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing-helpers";

import "../src/components/app-bar";
import type { AppBar } from "../src/components/app-bar";

describe("<app-bar>", () => {
  let el: AppBar;
  beforeEach(async () => {
    el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
  });

  it("renders brand logo and name", () => {
    expect(el.shadowRoot?.textContent).toContain("Cortex");
  });

  it("dropdown is closed initially", () => {
    const menu = el.shadowRoot?.querySelector(".user-menu");
    expect(menu?.classList.contains("open")).toBe(false);
  });

  it("clicking avatar toggles dropdown open", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    const menu = el.shadowRoot?.querySelector(".user-menu");
    expect(menu?.classList.contains("open")).toBe(true);
  });

  it("clicking 本地配置 menu item dispatches navigate event with settings+local", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);

    const events: CustomEvent[] = [];
    el.addEventListener("navigate", (e: Event) => events.push(e as CustomEvent));

    const items = el.shadowRoot?.querySelectorAll(".menu-item");
    // First item is 本地配置
    (items?.[0] as HTMLButtonElement).click();
    await elementUpdated(el);

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ view: "settings", scope: "local" });
  });

  it("clicking 全局配置 menu item dispatches navigate with settings+global", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);

    const events: CustomEvent[] = [];
    el.addEventListener("navigate", (e: Event) => events.push(e as CustomEvent));

    const items = el.shadowRoot?.querySelectorAll(".menu-item");
    (items?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);

    expect(events[0].detail).toEqual({ view: "settings", scope: "global" });
  });

  it("clicking outside closes the dropdown", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".user-menu")?.classList.contains("open")).toBe(true);

    document.body.click();
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".user-menu")?.classList.contains("open")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/app-bar.spec.ts`
Expected: FAIL with module not found

> If `@open-wc/testing-helpers` is not installed, install it as a dev dep: `npm i -D @open-wc/testing-helpers`. Check existing component tests (e.g., `input-box.spec.ts`) for the established fixture pattern — adapt if they use a different helper.

- [ ] **Step 3: Implement app-bar**

Create `cortex/web_v2/frontend/src/components/app-bar.ts`:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { ViewId, SettingsScope } from "../state/types";

@customElement("app-bar")
export class AppBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 var(--cortex-space-6);
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      position: relative;
      z-index: 50;
      font-family: var(--cortex-font);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-weight: 600;
      font-size: var(--cortex-fs-md);
    }
    .brand .logo {
      width: 28px; height: 28px;
      background: var(--cortex-primary);
      border-radius: var(--cortex-radius-md);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 16px;
    }
    .right-cluster {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      position: relative;
    }
    .avatar-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 4px 8px 4px 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 999px;
      cursor: pointer;
      font-family: inherit;
      color: var(--cortex-text);
      transition: background 0.15s, border-color 0.15s;
    }
    .avatar-btn:hover {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-border);
    }
    .avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0D9488, #0F766E);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: var(--cortex-fs-sm);
    }
    .name { font-size: var(--cortex-fs-sm); }
    .chev { color: var(--cortex-text-muted); font-size: 12px; }

    .user-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 280px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: 0 8px 24px rgba(0,0,0,0.10);
      padding: var(--cortex-space-2);
      display: none;
      z-index: 60;
    }
    .user-menu.open { display: block; }
    .menu-header {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      margin-bottom: var(--cortex-space-2);
    }
    .menu-header .email {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
    }
    .menu-item {
      display: flex;
      align-items: flex-start;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
      transition: background 0.15s;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item .icon {
      font-size: 18px;
      flex-shrink: 0;
      width: 24px;
      text-align: center;
    }
    .menu-item .text { flex: 1; min-width: 0; }
    .menu-item .label {
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
      color: var(--cortex-text);
      display: block;
    }
    .menu-item .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      display: block;
      margin-top: 2px;
    }
  `;

  @property() activeView: ViewId = "search";

  @state() private _menuOpen = false;

  private _onAvatarClick(e: Event) {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
  }

  private _onScopeSelect(scope: SettingsScope) {
    this._menuOpen = false;
    this.dispatchEvent(new CustomEvent("navigate", {
      detail: { view: "settings", scope },
      bubbles: true,
      composed: true,
    }));
  }

  connectedCallback() {
    super.connectedCallback();
    this._onDocClick = this._onDocClick.bind(this);
    document.addEventListener("click", this._onDocClick);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick);
    super.disconnectedCallback();
  }

  private _onDocClick(e: MouseEvent) {
    if (!this._menuOpen) return;
    const path = e.composedPath();
    if (!path.includes(this)) {
      this._menuOpen = false;
    }
  }

  render() {
    return html`
      <div class="brand">
        <span class="logo">🧠</span>
        <span>Cortex</span>
      </div>
      <div class="right-cluster">
        <button class="avatar-btn" @click=${this._onAvatarClick}>
          <span class="avatar">L</span>
          <span class="name">Liang</span>
          <span class="chev">▾</span>
        </button>
        <div class="user-menu ${this._menuOpen ? "open" : ""}">
          <div class="menu-header">
            <div style="font-size: var(--cortex-fs-sm); font-weight: 500;">Liang</div>
            <div class="email">liang@example.com</div>
          </div>
          <button class="menu-item" type="button" @click=${() => this._onScopeSelect("local")}>
            <span class="icon">📁</span>
            <span class="text">
              <span class="label">本地配置</span>
              <span class="desc">仅当前工作目录</span>
            </span>
          </button>
          <button class="menu-item" type="button" @click=${() => this._onScopeSelect("global")}>
            <span class="icon">🌍</span>
            <span class="text">
              <span class="label">全局配置</span>
              <span class="desc">所有项目共用</span>
            </span>
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-bar": AppBar;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/app-bar.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add cortex/web_v2/frontend/src/components/app-bar.ts cortex/web_v2/frontend/tests/app-bar.spec.ts
git commit -m "feat(web_v2): add <app-bar> with avatar dropdown for scope switching"
```

---

### Task 9: `<settings-view>` — tab strip + field renderer

**Files:**
- Create: `cortex/web_v2/frontend/src/views/settings-view.ts`
- Create: `cortex/web_v2/frontend/tests/settings-view.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `cortex/web_v2/frontend/tests/settings-view.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing-helpers";

import "../src/views/settings-view";
import type { SettingsView } from "../src/views/settings-view";

// Mock the API client so tests don't hit network
vi.mock("../src/api/config", () => ({
  getConfig: vi.fn().mockResolvedValue({
    scope: "local",
    values: { CORTEX_MAX_RESULTS: "42" },
    exists: true,
  }),
  putConfig: vi.fn().mockResolvedValue({
    ok: true,
    saved_path: "/tmp/.env",
    needs_restart: false,
    restart_fields: [],
  }),
}));

describe("<settings-view>", () => {
  let el: SettingsView;
  beforeEach(async () => {
    el = await fixture<SettingsView>(html`<settings-view></settings-view>`);
    // Wait for connectedCallback + initial API call
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
  });

  it("renders 4 tab buttons in order: AI / 搜索调优 / 评分 / 终端", () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    expect(tabs?.length).toBe(4);
    expect(tabs?.[0].textContent?.trim()).toBe("AI 配置");
    expect(tabs?.[1].textContent?.trim()).toBe("搜索调优");
    expect(tabs?.[2].textContent?.trim()).toBe("评分");
    expect(tabs?.[3].textContent?.trim()).toBe("终端");
  });

  it("AI tab is active by default", () => {
    const active = el.shadowRoot?.querySelector(".tab-strip button.active");
    expect(active?.textContent?.trim()).toBe("AI 配置");
  });

  it("clicking 评分 tab switches active panel", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[2] as HTMLButtonElement).click();
    await elementUpdated(el);
    const activePanel = el.shadowRoot?.querySelector(".tab-panel.active");
    expect(activePanel?.getAttribute("data-panel")).toBe("scoring");
  });

  it("renders all 3 fields for AI tab", () => {
    const aiPanel = el.shadowRoot?.querySelector('.tab-panel[data-panel="ai"]');
    const fields = aiPanel?.querySelectorAll(".field");
    expect(fields?.length).toBe(3);
  });

  it("renders all 7 fields for search tab", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();
    await elementUpdated(el);
    const panel = el.shadowRoot?.querySelector('.tab-panel[data-panel="search"]');
    expect(panel?.querySelectorAll(".field").length).toBe(7);
  });

  it("updates a field value via input event and marks dirty", async () => {
    const tabs = el.shadowRoot?.querySelectorAll(".tab-strip button");
    (tabs?.[1] as HTMLButtonElement).click();  // search tab
    await elementUpdated(el);
    const input = el.shadowRoot?.querySelector(
      'input[data-env="CORTEX_MAX_RESULTS"]'
    ) as HTMLInputElement;
    input.value = "99";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await elementUpdated(el);

    const dirty = el.shadowRoot?.querySelector(".dirty-status");
    expect(dirty?.textContent).toContain("已修改");
  });

  it("footer save button text reflects scope (本地)", () => {
    const saveBtn = el.shadowRoot?.querySelector(".footer-bar .btn.primary") as HTMLButtonElement;
    expect(saveBtn.textContent).toContain("保存本地配置");
  });

  it("clicking save calls putConfig with current values", async () => {
    const { putConfig } = await import("../src/api/config");
    const saveBtn = el.shadowRoot?.querySelector(".footer-bar .btn.primary") as HTMLButtonElement;
    saveBtn.click();
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 0));
    expect(putConfig).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/settings-view.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement settings-view**

Create `cortex/web_v2/frontend/src/views/settings-view.ts`:

```typescript
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store } from "../state/store";
import { actions, selectSettingsDirtyFields } from "../state/store";
import type { SettingsScope, SettingsTab } from "../state/types";
import {
  SETTINGS_FIELDS,
  SETTINGS_TABS,
  SETTINGS_TAB_LABELS,
  type SettingsField,
} from "./settings-fields";
import { getConfig, putConfig } from "../api/config";

const TAB_ORDER: SettingsTab[] = ["ai", "search", "scoring", "terminal"];

@customElement("settings-view")
export class SettingsView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-bg);
      font-family: var(--cortex-font);
    }
    .tab-strip {
      display: flex;
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border);
      padding: 0 var(--cortex-space-8);
      overflow-x: auto;
      flex-shrink: 0;
    }
    .tab-strip button {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
    }
    .tab-strip button:hover { color: var(--cortex-text); }
    .tab-strip button.active {
      color: var(--cortex-primary);
      border-bottom-color: var(--cortex-primary);
      font-weight: 500;
    }
    .scroll-area {
      flex: 1;
      overflow-y: auto;
      padding: var(--cortex-space-6) var(--cortex-space-8) 120px;
    }
    .tab-panel { display: none; max-width: 880px; margin: 0 auto; }
    .tab-panel.active { display: block; }

    .section {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: var(--cortex-space-6);
      margin-bottom: var(--cortex-space-4);
    }
    .section h2 {
      margin: 0 0 var(--cortex-space-1) 0;
      font-size: var(--cortex-fs-md);
      font-weight: 600;
    }
    .section-desc {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin: 0 0 var(--cortex-space-4) 0;
    }
    .field {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      gap: var(--cortex-space-6);
      padding: var(--cortex-space-3) 0;
      border-top: 1px solid var(--cortex-border-muted);
      align-items: start;
    }
    .field:first-of-type { border-top: none; }
    .field-label .name {
      font-size: var(--cortex-fs-base);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .field-label .env {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-top: 2px;
    }
    .field-control { display: flex; flex-direction: column; gap: var(--cortex-space-1); }
    .field-control .row { display: flex; align-items: center; gap: var(--cortex-space-2); }
    .field-control .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }

    .input, .select {
      padding: 6px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      max-width: 420px;
    }
    .input.mono { font-family: var(--cortex-font-mono); }
    .input:focus, .select:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
    }

    .effect {
      display: inline-flex;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 500;
    }
    .effect.restart { background: rgba(245,158,11,0.12); color: var(--cortex-warning); }
    .effect.live { background: rgba(16,185,129,0.12); color: var(--cortex-success); }

    .info-box {
      background: var(--cortex-primary-soft);
      border-left: 3px solid var(--cortex-primary);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-sm);
      margin-bottom: var(--cortex-space-4);
      line-height: 1.7;
    }
    .info-box.warn {
      background: rgba(245,158,11,0.08);
      border-left-color: var(--cortex-warning);
    }

    .footer-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--cortex-surface);
      border-top: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3) var(--cortex-space-8);
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
    }
    .dirty-status {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .dirty-dot {
      width: 8px; height: 8px;
      background: var(--cortex-warning);
      border-radius: 50%;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 6px 12px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-sm);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
      font-family: inherit;
    }
    .btn:hover { background: var(--cortex-surface-muted); }
    .btn.primary {
      background: var(--cortex-primary);
      border-color: var(--cortex-primary);
      color: #fff;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Copy-from-global banner (empty state) */
    .copy-banner {
      background: var(--cortex-primary-soft);
      border-bottom: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3) var(--cortex-space-8);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
    }
    .copy-banner .grow { flex: 1; }
  `;

  @state() private _activeTab: SettingsTab = "ai";
  @state() private _saving = false;
  @state() private _error: string | null = null;
  @state() private _toast: string | null = null;
  /** Local snapshot so the view doesn't depend on store re-render plumbing
   * for every keystroke. Synced to store on load/save. */
  @state() private _values: Record<string, string> = {};
  @state() private _original: Record<string, string> = {};
  @state() private _exists = true;

  private _scope: SettingsScope = "local";
  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    const state = store.getState();
    this._scope = state.settings.scope;
    this._unsubscribe = store.subscribe(() => this._onStoreChange());
    this._load();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private _onStoreChange() {
    const newState = store.getState();
    if (newState.settings.scope !== this._scope) {
      this._scope = newState.settings.scope;
      this._load();
    }
  }

  private async _load() {
    this._error = null;
    try {
      const resp = await getConfig(this._scope);
      this._values = { ...resp.values };
      this._original = { ...resp.values };
      this._exists = resp.exists;
      actions.loadSettings(resp.values, resp.exists);
    } catch (e) {
      this._error = `加载失败: ${(e as Error).message}`;
    }
  }

  private get _dirtyFields(): string[] {
    const keys = new Set([...Object.keys(this._original), ...Object.keys(this._values)]);
    const changed: string[] = [];
    for (const k of keys) {
      if ((this._original[k] ?? "") !== (this._values[k] ?? "")) changed.push(k);
    }
    return changed;
  }

  private get _dirty(): boolean {
    return this._dirtyFields.length > 0;
  }

  private _onInput(envVar: string, value: string) {
    this._values = { ...this._values, [envVar]: value };
    actions.updateSetting(envVar, value);
  }

  private _revert() {
    this._values = { ...this._original };
    actions.revertSettings();
  }

  private async _save() {
    if (!this._dirty || this._saving) return;
    this._saving = true;
    try {
      const result = await putConfig(this._scope, this._values);
      this._original = { ...this._values };
      actions.loadSettings(this._values, true);
      this._toast = result.needs_restart
        ? `已保存。重启 cortex gui 后 AI 配置生效。`
        : `已保存。下次查询立即生效。`;
      setTimeout(() => { this._toast = null; }, 4000);
    } catch (e: any) {
      this._error = `保存失败: ${e?.body?.fields?.map((f: any) => f.field).join(", ") || e.message}`;
    } finally {
      this._saving = false;
    }
  }

  private _renderField(f: SettingsField) {
    const value = this._values[f.envVar] ?? "";
    const effectBadge = f.effect
      ? html`<span class="effect ${f.effect}">${f.effect === "restart" ? "🔁 需重启" : "● 即时"}</span>`
      : nothing;
    return html`
      <div class="field">
        <div class="field-label">
          <div class="name">${f.label} ${effectBadge}</div>
          <div class="env">${f.envVar}${f.min !== undefined && f.max !== undefined ? ` · 范围 ${f.min}~${f.max}` : ""}</div>
        </div>
        <div class="field-control">
          <div class="row">${this._renderInput(f, value)}</div>
          ${f.hint ? html`<div class="hint">${f.hint}</div>` : nothing}
        </div>
      </div>
    `;
  }

  private _renderInput(f: SettingsField, value: string) {
    const mono = f.mono ? "mono" : "";
    const onInput = (e: Event) =>
      this._onInput(f.envVar, (e.target as HTMLInputElement | HTMLSelectElement).value);

    switch (f.component) {
      case "text":
        return html`
          <input
            class="input ${mono}"
            type="text"
            .value=${value}
            data-env=${f.envVar}
            @input=${onInput}
            list=${f.datalist ? `${f.envVar}-list` : nothing}
          />
          ${f.datalist ? html`
            <datalist id=${`${f.envVar}-list`}>
              ${f.datalist.map((d) => html`<option value=${d}></option>`)}
            </datalist>
          ` : nothing}
        `;
      case "password":
        return html`
          <div style="position: relative; max-width: 420px;">
            <input
              class="input ${mono}"
              type="password"
              .value=${value}
              data-env=${f.envVar}
              @input=${onInput}
            />
            <button
              class="btn"
              type="button"
              style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); padding: 2px 8px; font-size: var(--cortex-fs-xs);"
              @click=${(e: Event) => {
                const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                input.type = input.type === "password" ? "text" : "password";
              }}
            >显示</button>
          </div>
        `;
      case "number":
        return html`
          <input
            class="input"
            type="number"
            .value=${value}
            min=${f.min ?? nothing}
            max=${f.max ?? nothing}
            step=${f.step ?? nothing}
            data-env=${f.envVar}
            @input=${onInput}
          />
          ${f.unit ? html`<span style="font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle);">${f.unit}</span>` : nothing}
        `;
      case "select":
        return html`
          <select class="select" .value=${value} data-env=${f.envVar} @change=${onInput}>
            ${(f.options ?? []).map((opt) => html`
              <option value=${opt.value} ?selected=${opt.value === value}>${opt.label}</option>
            `)}
          </select>
        `;
      case "slider":
        return html`
          <input
            class="input"
            type="number"
            .value=${value}
            min=${f.min ?? nothing}
            max=${f.max ?? nothing}
            step=${f.step ?? nothing}
            style="width: 100px;"
            data-env=${f.envVar}
            @input=${onInput}
          />
          <input
            type="range"
            .value=${value}
            min=${f.min ?? nothing}
            max=${f.max ?? nothing}
            step=${f.step ?? nothing}
            style="flex: 1; max-width: 280px;"
            @input=${onInput}
          />
        `;
      default:
        return nothing;
    }
  }

  private _renderInfoBox(tab: SettingsTab) {
    if (tab === "ai") {
      return html`
        <div class="info-box">
          本 tab 的所有参数修改后需<strong>重启 cortex gui</strong> 才能生效。当前 scope：
          ${this._scope === "local" ? "本地配置（{cwd}/.cortex/.env），只影响当前工作目录" : "全局配置（~/.cortex/.env），影响所有项目"}
          。
        </div>
      `;
    }
    if (tab === "search") {
      return html`<div class="info-box">本 tab 的参数保存后下次查询即时生效，<strong>无需重启</strong>。</div>`;
    }
    if (tab === "scoring") {
      return html`
        <div class="info-box">
          <strong>📐 评分原理（白话版）</strong><br>
          最终得分（0~1）= 把下面 5 个信号<strong>按权重做加权平均</strong>（每个信号名对应下方一个"XX 权重"字段）：<br>
          • <strong>关键词匹配</strong> —— 文档里命中的关键词数 ÷ 你查询的总词数<br>
          • <strong>文件名匹配</strong> —— 文件名里命中的关键词数 ÷ 总词数<br>
          • <strong>FTS 原始分</strong> —— FTS5 全文检索给的相关度（0~1 之间）<br>
          • <strong>标题匹配</strong> —— 段落标题里命中的关键词数 ÷ 总词数<br>
          • <strong>邻近度</strong> —— 0 / 0.5 / 1 三档（多词紧挨着分数更高）<br><br>
          每个权重<strong>越大</strong>，对应信号对最终排序的影响越大；权重设为 <code>0</code> = <strong>完全忽略</strong>该信号。推荐区间 <code>0~10</code>。
        </div>
      `;
    }
    if (tab === "terminal") {
      return html`
        <div class="info-box warn">
          ⚠️ 这些参数仅影响 <code>cortex</code> CLI/TUI 的<strong>终端输出格式</strong>，对 Web UI 没有可见效果。在此处提供编辑仅为了免去手动改 .env 的麻烦。
        </div>
      `;
    }
    return nothing;
  }

  render() {
    const scopeLabel = this._scope === "local" ? "本地" : "全局";
    return html`
      ${!this._exists && this._scope === "local"
        ? html`
            <div class="copy-banner">
              <span>ℹ️</span>
              <span>当前工作目录尚未创建 <code>.cortex/.env</code>，将使用全局配置。</span>
              <span class="grow"></span>
              <button class="btn primary" @click=${() => this._load()}>从全局复制占位（实际逻辑见 Task 11）</button>
            </div>
          `
        : nothing}

      <nav class="tab-strip" role="tablist">
        ${TAB_ORDER.map((tab) => html`
          <button
            class=${this._activeTab === tab ? "active" : ""}
            @click=${() => { this._activeTab = tab; }}
          >${SETTINGS_TAB_LABELS[tab]}</button>
        `)}
      </nav>

      <div class="scroll-area" style="position: relative;">
        ${TAB_ORDER.map((tab) => {
          const fields = SETTINGS_FIELDS.filter((f) => f.tab === tab);
          const sections: { title: string; desc?: string; fields: SettingsField[] }[] = [];
          for (const f of fields) {
            let s = sections.find((x) => x.title === f.section);
            if (!s) { s = { title: f.section, fields: [] }; sections.push(s); }
            s.fields.push(f);
          }
          return html`
            <div class="tab-panel ${this._activeTab === tab ? "active" : ""}" data-panel=${tab}>
              ${this._renderInfoBox(tab)}
              ${sections.map((s) => html`
                <div class="section">
                  <h2>${s.title}</h2>
                  ${s.fields.map((f) => this._renderField(f))}
                </div>
              `)}
            </div>
          `;
        })}

        <div class="footer-bar">
          <div class="dirty-status">
            ${this._dirty
              ? html`<span class="dirty-dot"></span><span>有 <strong>${this._dirtyFields.length}</strong> 个字段已修改</span>`
              : html`<span style="font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle);">所有字段与 .env 一致</span>`
            }
            ${this._error ? html`<span style="color: var(--cortex-danger); margin-left: var(--cortex-space-2);">${this._error}</span>` : nothing}
            ${this._toast ? html`<span style="color: var(--cortex-success); margin-left: var(--cortex-space-2);">${this._toast}</span>` : nothing}
          </div>
          <div style="display: flex; gap: var(--cortex-space-2);">
            <button class="btn" ?disabled=${!this._dirty || this._saving} @click=${() => this._revert()}>放弃修改</button>
            <button class="btn primary" ?disabled=${!this._dirty || this._saving} @click=${() => this._save()}>
              ${this._saving ? "保存中…" : `💾 保存${scopeLabel}配置`}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "settings-view": SettingsView;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cortex/web_v2/frontend && npx vitest run tests/settings-view.spec.ts`
Expected: PASS (8 tests)

> If `@open-wc/testing-helpers` isn't in the project, check `input-box.spec.ts` for the established fixture pattern and adapt. Common alternative: roll-your-own with `document.createElement`.

- [ ] **Step 5: Commit**

```bash
git add cortex/web_v2/frontend/src/views/settings-view.ts cortex/web_v2/frontend/tests/settings-view.spec.ts
git commit -m "feat(web_v2): add <settings-view> with 4 tabs + metadata-driven form"
```

---

## Phase 4: Integration

### Task 10: Wire AppBar + settings routing in app.ts

**Files:**
- Modify: `cortex/web_v2/frontend/src/app.ts`

- [ ] **Step 1: Read current app.ts and identify the structure**

Run: `head -90 cortex/web_v2/frontend/src/app.ts` to confirm where to inject.

The file currently has:
- `:host { display: flex; flex-direction: row; height: 100dvh; ... }`
- `render()` returns `<activity-bar>` + `<div class="main">${this._renderView()}</div>` + `<tab-bar>`

We need to wrap this in an `app-shell` flex column with `<app-bar>` at top.

- [ ] **Step 2: Update app.ts**

Modify `cortex/web_v2/frontend/src/app.ts`:

Add imports at top:

```typescript
import "./components/app-bar";
import "./views/settings-view";
```

Update `static styles`:

```typescript
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
      background: var(--cortex-bg);
    }
    .app-body {
      flex: 1;
      display: flex;
      flex-direction: row;
      min-height: 0;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      position: relative;
    }
    @media (max-width: 1023px) {
      .app-body { flex-direction: column; }
    }
  `;
```

Update `_renderView`:

```typescript
  private _renderView() {
    const view = store.getState().view;
    if (view === "search") return html`<search-view></search-view>`;
    if (view === "chat") return html`<chat-view></chat-view>`;
    if (view === "settings") return html`<settings-view></settings-view>`;
    return html`<history-view></history-view>`;
  }
```

Update `_navigate` to handle settings scope:

```typescript
  private _navigate(e: CustomEvent<{ view: ViewId; scope?: "local" | "global" }>) {
    actions.setView(e.detail.view);
    if (e.detail.view === "settings" && e.detail.scope) {
      actions.setSettingsScope(e.detail.scope);
    }
  }
```

Update `render`:

```typescript
  render() {
    const view = store.getState().view;
    return html`
      <app-bar
        .activeView=${view}
        @navigate=${this._navigate}
      ></app-bar>
      <div class="app-body">
        <activity-bar .active=${view} @navigate=${this._navigate}></activity-bar>
        <div class="main">
          ${this._renderView()}
        </div>
        <tab-bar .active=${view} @navigate=${this._navigate}></tab-bar>
      </div>
    `;
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd cortex/web_v2/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Run all frontend tests to verify no regressions**

Run: `cd cortex/web_v2/frontend && npx vitest run`
Expected: all tests pass (existing + new)

- [ ] **Step 5: Manual smoke test**

Run: `.venv/Scripts/python.exe -m cortex gui`
Open http://localhost:7860 in browser, verify:
- AppBar appears at top with 🧠 Cortex brand and avatar
- Clicking avatar opens dropdown
- Clicking 本地配置 / 全局配置 in dropdown navigates to settings view
- Settings view shows 4 tabs, AI tab active by default
- Editing a field enables the save button
- Saving shows toast

- [ ] **Step 6: Commit**

```bash
git add cortex/web_v2/frontend/src/app.ts
git commit -m "feat(web_v2): mount <app-bar> at top + route to <settings-view>"
```

---

### Task 11: "从全局复制" empty-state implementation

**Files:**
- Modify: `cortex/web_v2/api/config.py` — add `POST /api/config/copy-from-global` endpoint
- Modify: `cortex/web_v2/frontend/src/api/config.ts` — add `copyFromGlobal()` client function
- Modify: `cortex/web_v2/frontend/src/views/settings-view.ts` — wire banner button to API call
- Modify: `tests/web_v2/test_config_api.py` — add test for new endpoint
- Modify: `cortex/web_v2/frontend/tests/settings-view.spec.ts` — add test for banner click

- [ ] **Step 1: Write the backend failing test**

Append to `tests/web_v2/test_config_api.py`:

```python
def test_copy_from_global_creates_local_when_global_exists(client, tmp_path, monkeypatch):
    # Set up global .env with content
    global_env = tmp_path / ".cortex" / ".env"
    global_env.write_text("PLANIFY_API_KEY=sk-global\nCORTEX_MAX_RESULTS=20\n", encoding="utf-8")

    # Local .env doesn't exist yet
    local_env = tmp_path / ".cortex" / ".env"
    # Wait — both are at tmp_path/.cortex/.env because monkeypatch.setenv("HOME", tmp_path)
    # and chdir(tmp_path). For test isolation, use a different HOME:
    home_dir = tmp_path / "home"
    home_dir.mkdir()
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USERPROFILE", str(home_dir))
    monkeypatch.chdir(work_dir)

    global_env = home_dir / ".cortex" / ".env"
    global_env.parent.mkdir(parents=True)
    global_env.write_text("PLANIFY_API_KEY=sk-global\nCORTEX_MAX_RESULTS=20\n", encoding="utf-8")

    # Local doesn't exist
    local_env = work_dir / ".cortex" / ".env"
    assert not local_env.exists()

    # Trigger copy
    resp = client.post("/api/config/copy-from-global")
    assert resp.status_code == 200
    assert local_env.exists()
    assert "PLANIFY_API_KEY=sk-global" in local_env.read_text(encoding="utf-8")


def test_copy_from_global_returns_404_when_global_missing(client, tmp_path, monkeypatch):
    home_dir = tmp_path / "home"
    home_dir.mkdir()
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    monkeypatch.setenv("HOME", str(home_dir))
    monkeypatch.setenv("USERPROFILE", str(home_dir))
    monkeypatch.chdir(work_dir)

    resp = client.post("/api/config/copy-from-global")
    assert resp.status_code == 404
```

- [ ] **Step 2: Run backend test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_api.py::test_copy_from_global_creates_local_when_global_exists -v`
Expected: FAIL with 404 (endpoint not defined)

- [ ] **Step 3: Implement backend endpoint**

Add to `cortex/web_v2/api/config.py`:

```python
import shutil

@router.post("/config/copy-from-global")
async def copy_from_global():
    """Copy ~/.cortex/.env to {cwd}/.cortex/.env (only valid for local scope).

    Returns 404 if global .env doesn't exist.
    """
    global_path = resolve_env_path("global")
    local_path = resolve_env_path("local")
    if not global_path.exists():
        raise CortexAPIError(404, "GLOBAL_ENV_MISSING", f"全局 .env 不存在: {global_path}")
    local_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(str(global_path), str(local_path))
    logger.info("copied global env -> %s", local_path)
    return {"ok": True, "saved_path": str(local_path)}
```

- [ ] **Step 4: Run backend test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_api.py -v`
Expected: PASS (8 tests total, including 2 new)

- [ ] **Step 5: Add frontend API client function**

Append to `cortex/web_v2/frontend/src/api/config.ts`:

```typescript
export async function copyFromGlobal(): Promise<{ ok: boolean; saved_path: string }> {
  const resp = await fetch("/api/config/copy-from-global", { method: "POST" });
  const body = await resp.json().catch(() => null);
  if (!resp.ok) {
    throw new ConfigApiError(resp.status, body);
  }
  return body;
}
```

- [ ] **Step 6: Wire banner button in settings-view**

Update the copy-banner button in `cortex/web_v2/frontend/src/views/settings-view.ts`:

```typescript
// Update import:
import { getConfig, putConfig, copyFromGlobal } from "../api/config";

// Replace the banner button onClick handler:
${!this._exists && this._scope === "local"
  ? html`
      <div class="copy-banner">
        <span>ℹ️</span>
        <span>当前工作目录尚未创建 <code>.cortex/.env</code>，将使用全局配置。</span>
        <span class="grow"></span>
        <button class="btn primary" @click=${async () => {
          try {
            await copyFromGlobal();
            await this._load();
          } catch (e: any) {
            this._error = `复制失败: ${e?.body?.detail || e.message}`;
          }
        }}>📋 从全局复制并编辑</button>
      </div>
    `
  : nothing}
```

- [ ] **Step 7: Run all frontend tests**

Run: `cd cortex/web_v2/frontend && npx vitest run`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add cortex/web_v2/api/config.py cortex/web_v2/frontend/src/api/config.ts cortex/web_v2/frontend/src/views/settings-view.ts tests/web_v2/test_config_api.py
git commit -m "feat(web_v2): implement 从全局复制 banner for empty local .env"
```

---

### Task 12: Production build + final verification

**Files:**
- No source changes; final integration check.

- [ ] **Step 1: Run full backend test suite**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/ -v`
Expected: all tests pass

- [ ] **Step 2: Run full frontend test suite**

Run: `cd cortex/web_v2/frontend && npx vitest run`
Expected: all tests pass

- [ ] **Step 3: TypeScript compile check**

Run: `cd cortex/web_v2/frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Production build**

Run: `cd cortex/web_v2/frontend && npm run build`
Expected: Vite build succeeds, outputs to `cortex/web_v2/static/`

- [ ] **Step 5: Manual end-to-end test**

Run from `test_work_dir/`:
```bash
cd test_work_dir && rm -rf .cortex && ../.venv/Scripts/python.exe -m cortex gui
```

Open http://localhost:7860 in browser. Verify:

1. AppBar shows 🧠 Cortex on left, avatar on right
2. Click avatar → dropdown shows 本地配置 / 全局配置
3. Click 本地配置 → settings view opens with 4 tabs
4. Banner shows "尚未创建 .cortex/.env" (since we deleted it)
5. Click "从全局复制并编辑" → banner disappears, fields populate with global values
6. Edit CORTEX_MAX_RESULTS → footer shows "1 字段已修改"
7. Click "保存本地配置" → success toast, footer clears
8. Verify `.cortex/.env` was created with the edited value
9. Switch to 全局配置 via dropdown → different values loaded
10. Edit + save → `~/.cortex/.env` updated
11. Mobile viewport (DevTools toggle) → AppBar stays visible, bottom tab-bar unaffected

- [ ] **Step 6: Commit if any mockup reference updates are needed**

If `specs/settings-page-mockup.html` should be moved or noted as superseded:

```bash
git add -A
git commit -m "chore: finalize cortex gui settings page (build + manual verification)"
```

- [ ] **Step 7: Final tag**

```bash
git tag -a cortex-gui-settings-v1 -m "Cortex GUI settings page (local + global .env editing)"
# (only if tagging is desired — ask user)
```

---

## Plan Summary

**12 tasks across 4 phases:**
- Phase 1 (Backend): 4 tasks — models, store helper, validator, router
- Phase 2 (Frontend foundation): 3 tasks — state types/store, metadata, API client
- Phase 3 (Frontend components): 2 tasks — `<app-bar>`, `<settings-view>`
- Phase 4 (Integration): 3 tasks — wire app.ts, empty state, final build

**Every task:**
- Starts with a failing test (TDD)
- Includes exact code (no placeholders)
- Ends with a commit (frequent commits)
- File paths are absolute and explicit

**Total LOC estimate:** ~1500 (backend ~300, frontend ~1000, tests ~200)
