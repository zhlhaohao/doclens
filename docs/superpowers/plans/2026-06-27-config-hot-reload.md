# Config Hot-Reload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All 18 config fields take effect immediately after saving via the Web GUI, with no restart required.

**Architecture:** Remove instance-variable caching in IndexManager and CortexAgent. Config-backed values become `@property` delegating to `self._config`. A new `deps.reload_config()` recreates `CortexConfig` and pushes it into live singletons via `apply_config()`. The PUT API calls `reload_config()` after writing `.env`.

**Tech Stack:** Python, FastAPI, Pydantic, pytest

## Global Constraints

- Run Python via `.venv/Scripts/python.exe` (Claude Code Bash uses Git Bash, `activate` won't work)
- Test command: `.venv/Scripts/python.exe -m pytest tests/web_v2/ -v`
- Config singleton lives in `doclens/web_v2/deps.py`
- `search_path` and `index_path` are NOT hot-reloadable (changing them requires index rebuild) — they stay as instance variables on IndexManager

---

### Task 1: IndexManager — property delegation + apply_config()

**Files:**
- Modify: `doclens/index_manager.py:38-90` (replace `__init__` body) and add properties + `apply_config()`
- Test: `tests/web_v2/test_index_manager_hotreload.py` (create)

**Interfaces:**
- Consumes: `CortexConfig` from `doclens/config.py` (existing class, all fields already defined)
- Produces: `IndexManager.apply_config(config: CortexConfig) -> None` — called by `deps.reload_config()`

**Context:** The current `__init__` copies ~25 config values into `self.xxx`. We keep `search_path`, `index_path`, and all `_`-prefixed internal state as instance variables. Everything else becomes a `@property` reading from `self._config`.

- [ ] **Step 1: Write the failing test**

```python
# tests/web_v2/test_index_manager_hotreload.py
"""Tests for IndexManager config hot-reload via apply_config()."""
from unittest.mock import MagicMock
from doclens.index_manager import IndexManager


def _make_config(**overrides):
    """Create a mock CortexConfig with sensible defaults."""
    c = MagicMock()
    c.search_path = "/tmp/test"
    c.index_path = None
    c.max_results = 20
    c.max_nodes_per_doc = 3
    c.top_k_docs = 100
    c.max_span = 20
    c.min_keyword_match = 2
    c.min_proximity_score = 1
    c.min_keywords_per_line = 2
    c.min_score_threshold = 0.0
    c.cjk_tokenizer = "jieba"
    c.max_index_fail_count = 3
    c.treesearch_enable_shadow_md = True
    c.treesearch_xlsx_max_rows_per_sheet = 10000
    c.treesearch_xlsx_max_consecutive_empty_rows = 100
    c.allowed_source_types = []
    c.title_width = 55
    c.line_width = 78
    c.max_context_lines = 5
    c.max_anchor_lines = 3
    c.context_expand_range = 5
    c.max_context_chars_per_result = 800
    c.max_total_chars = 10000
    c.max_read_chars = 6000
    c.read_doc_show_toc = False
    c.rg_context_before = 6
    c.rg_context_after = 5
    c.grep_score_threshold = 0.0
    c.grep_max_results = 50
    c.weight_keyword_match = 3.0
    c.weight_file_name_match = 2.0
    c.weight_fts_score = 2.0
    c.weight_title_match = 1.5
    c.weight_proximity_match = 1.0
    for k, v in overrides.items():
        setattr(c, k, v)
    return c


def test_apply_config_updates_max_results():
    mgr = IndexManager(_make_config(max_results=20))
    assert mgr.max_results == 20
    mgr.apply_config(_make_config(max_results=99))
    assert mgr.max_results == 99


def test_apply_config_updates_scoring_weights():
    mgr = IndexManager(_make_config(weight_keyword_match=3.0))
    assert mgr.scoring_weights["keyword_match_ratio"] == 3.0
    mgr.apply_config(_make_config(weight_keyword_match=9.5))
    assert mgr.scoring_weights["keyword_match_ratio"] == 9.5


def test_apply_config_preserves_search_path():
    mgr = IndexManager(_make_config(search_path="/tmp/aaa"))
    assert mgr.search_path == "/tmp/aaa"
    mgr.apply_config(_make_config(search_path="/tmp/bbb"))
    assert mgr.search_path == "/tmp/aaa"  # NOT updated — stays from init


def test_apply_config_preserves_ts_instance():
    """Internal _ts state must survive apply_config."""
    mgr = IndexManager(_make_config())
    mgr._ts = "fake_ts"
    mgr._path_map = {"key": "val"}
    mgr.apply_config(_make_config())
    assert mgr._ts == "fake_ts"
    assert mgr._path_map == {"key": "val"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_index_manager_hotreload.py -v`
Expected: FAIL with `AttributeError: 'IndexManager' object has no attribute 'apply_config'`

- [ ] **Step 3: Rewrite IndexManager `__init__` + add properties + `apply_config()`**

Replace the `__init__` method (lines 38-90) with a minimal version that only stores `self._config` and non-config state, then add `@property` methods for every config-backed field.

New `__init__`:
```python
def __init__(self, config: CortexConfig):
    self._config = config
    self.search_path = config.search_path
    self.index_path = config.index_path or os.path.join(self.search_path, ".cortex", "index.db")
    self._ts = None
    self._path_map = {}
    self._pending_swap = None
    self._needs_reload = False
    self._reindexing = False
    self._reindex_lock = threading.Lock()
```

Add `apply_config()` right after `__init__`:
```python
def apply_config(self, config: CortexConfig) -> None:
    """Hot-reload config values. Does NOT touch index or search_path."""
    self._config = config
```

Add all `@property` methods (place them after `apply_config`, before the existing `@property def ts`):
```python
# --- Config-backed properties (hot-reloadable) ---

@property
def max_results(self) -> int:
    return self._config.max_results

@property
def max_nodes_per_doc(self) -> int:
    return self._config.max_nodes_per_doc

@property
def top_k_docs(self) -> int:
    return self._config.top_k_docs

@property
def max_span(self) -> int:
    return self._config.max_span

@property
def min_keyword_match(self) -> int:
    return self._config.min_keyword_match

@property
def min_proximity_score(self) -> int:
    return self._config.min_proximity_score

@property
def min_keywords_per_line(self) -> int:
    return self._config.min_keywords_per_line

@property
def min_score_threshold(self) -> float:
    return self._config.min_score_threshold

@property
def cjk_tokenizer(self) -> str:
    return self._config.cjk_tokenizer

@property
def max_index_fail_count(self) -> int:
    return self._config.max_index_fail_count

@property
def enable_shadow_md(self) -> bool:
    return self._config.treesearch_enable_shadow_md

@property
def xlsx_max_rows_per_sheet(self) -> int:
    return self._config.treesearch_xlsx_max_rows_per_sheet

@property
def xlsx_max_consecutive_empty_rows(self) -> int:
    return self._config.treesearch_xlsx_max_consecutive_empty_rows

@property
def allowed_source_types(self) -> list[str]:
    return self._config.allowed_source_types

@property
def title_width(self) -> int:
    return self._config.title_width

@property
def line_width(self) -> int:
    return self._config.line_width

@property
def max_context_lines(self) -> int:
    return self._config.max_context_lines

@property
def max_anchor_lines(self) -> int:
    return self._config.max_anchor_lines

@property
def context_expand_range(self) -> int:
    return self._config.context_expand_range

@property
def max_context_chars_per_result(self) -> int:
    return self._config.max_context_chars_per_result

@property
def max_total_chars(self) -> int:
    return self._config.max_total_chars

@property
def max_read_chars(self) -> int:
    return self._config.max_read_chars

@property
def read_doc_show_toc(self) -> bool:
    return self._config.read_doc_show_toc

@property
def rg_context_before(self) -> int:
    return self._config.rg_context_before

@property
def rg_context_after(self) -> int:
    return self._config.rg_context_after

@property
def grep_score_threshold(self) -> float:
    return self._config.grep_score_threshold

@property
def grep_max_results(self) -> int:
    return self._config.grep_max_results

@property
def scoring_weights(self) -> dict:
    c = self._config
    return {
        "keyword_match_ratio": c.weight_keyword_match,
        "file_name_match": c.weight_file_name_match,
        "fts_score": c.weight_fts_score,
        "title_match": c.weight_title_match,
        "proximity_match": c.weight_proximity_match,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_index_manager_hotreload.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Run existing tests to check no regressions**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/ -v -k "not test_chat"`
Expected: All pass (chat tests need API key, skip them)

- [ ] **Step 6: Commit**

```bash
git add doclens/index_manager.py tests/web_v2/test_index_manager_hotreload.py
git commit -m "refactor: IndexManager config-backed properties + apply_config()"
```

---

### Task 2: CortexAgent — apply_config() for hot-reload

**Files:**
- Modify: `doclens/agent_integration.py:116-122` (store `_config`) and add `apply_config()` method
- Test: `tests/web_v2/test_agent_hotreload.py` (create)

**Interfaces:**
- Consumes: `CortexConfig` from `doclens/config.py`
- Produces: `CortexAgent.apply_config(config: CortexConfig) -> None` — called by `deps.reload_config()`

**Context:** CortexAgent reads env vars directly in `initialize()` to build an Anthropic client + session. We add `apply_config()` to update the live session's client and model without re-running the full `initialize()`. The primary chat path (`run_query()` → `StreamingAgent`) reads from `self.session.client` and `self.session.model`, so updating those two fields is sufficient.

- [ ] **Step 1: Write the failing test**

```python
# tests/web_v2/test_agent_hotreload.py
"""Tests for CortexAgent apply_config() hot-reload."""
from unittest.mock import MagicMock, patch
from pathlib import Path


def test_apply_config_updates_session_client_and_model():
    from doclens.agent_integration import CortexAgent

    agent = CortexAgent(Path("/tmp/fake"))
    # Simulate an initialized session
    agent.session = MagicMock()
    agent.session.client = "old_client"
    agent.session.model = "old-model-id"

    config = MagicMock()
    config.planify_base_url = "https://new.api.url"
    config.planify_api_key = "sk-new-key"
    config.planify_model_id = "claude-sonnet-4-6"

    with patch("doclens.agent_integration.init_anthropic_client", return_value="new_client") as mock_init:
        agent.apply_config(config)

    mock_init.assert_called_once_with("https://new.api.url", "sk-new-key")
    assert agent.session.client == "new_client"
    assert agent.session.model == "claude-sonnet-4-6"


def test_apply_config_does_not_crash_when_session_is_none():
    from doclens.agent_integration import CortexAgent

    agent = CortexAgent(Path("/tmp/fake"))
    agent.session = None  # Not yet initialized

    config = MagicMock()
    config.planify_base_url = None
    config.planify_api_key = None
    config.planify_model_id = "claude-opus-4-6"

    # Should be a no-op, not raise
    agent.apply_config(config)
    assert agent.session is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_agent_hotreload.py -v`
Expected: FAIL with `AttributeError: 'CortexAgent' object has no attribute 'apply_config'`

- [ ] **Step 3: Add `apply_config()` to CortexAgent**

Add this method after `initialize()` (after line 286, before `run_query`):

```python
def apply_config(self, config) -> None:
    """Hot-reload AI config: update session client + model."""
    if self.session is None:
        return
    client = init_anthropic_client(
        config.planify_base_url,
        config.planify_api_key,
    )
    self.session.client = client
    self.session.model = config.planify_model_id
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_agent_hotreload.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add doclens/agent_integration.py tests/web_v2/test_agent_hotreload.py
git commit -m "feat: CortexAgent.apply_config() for AI config hot-reload"
```

---

### Task 3: deps.py — reload_config()

**Files:**
- Modify: `doclens/web_v2/deps.py:78-84` (add `reload_config()` after `reset_singletons()`)
- Test: `tests/web_v2/test_deps.py` (modify — add new test)

**Interfaces:**
- Consumes: `IndexManager.apply_config()` (Task 1), `CortexAgent.apply_config()` (Task 2)
- Produces: `deps.reload_config() -> CortexConfig` — called by PUT API

- [ ] **Step 1: Write the failing test**

Add to `tests/web_v2/test_deps.py`:

```python
def test_reload_config_pushes_new_config_to_singletons(env_cortex_config):
    """reload_config recreates CortexConfig and pushes to live singletons."""
    from unittest.mock import MagicMock, patch

    deps._config = None
    deps._idx_manager = None
    deps._agent = None

    # Initialize
    original_config = deps.get_config()
    mgr = deps.get_index_manager()

    # Record original value
    original_max = mgr.max_results

    # Write a new .env with different max_results
    import os
    env_path = os.path.join(os.getcwd(), ".cortex", ".env")
    os.makedirs(os.path.dirname(env_path), exist_ok=True)
    with open(env_path, "w", encoding="utf-8") as f:
        f.write(f"CORTEX_MAX_RESULTS={original_max + 500}\n")

    # Reload
    new_config = deps.reload_config()
    assert new_config is not original_config
    assert new_config.max_results == original_max + 500
    # IndexManager got the push
    assert mgr.max_results == original_max + 500

    # Cleanup
    deps._config = None
    deps._idx_manager = None
    deps._agent = None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_deps.py::test_reload_config_pushes_new_config_to_singletons -v`
Expected: FAIL with `AttributeError: module 'doclens.web_v2.deps' has no attribute 'reload_config'`

- [ ] **Step 3: Implement `reload_config()` in deps.py**

Add after `reset_singletons()` (after line 84):

```python
def reload_config() -> CortexConfig:
    """重建 CortexConfig 并推送到已存在的单例。"""
    global _config
    with _lock:
        _config = CortexConfig.load()
        if _idx_manager:
            _idx_manager.apply_config(_config)
        if _agent:
            _agent.apply_config(_config)
    return _config
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_deps.py::test_reload_config_pushes_new_config_to_singletons -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/deps.py tests/web_v2/test_deps.py
git commit -m "feat: deps.reload_config() for hot-reload"
```

---

### Task 4: PUT /api/config — call reload_config() + update response

**Files:**
- Modify: `doclens/web_v2/api/config.py:41-85` (add reload call, change `needs_restart` to always False)
- Modify: `doclens/web_v2/models/config.py:19-23` (empty RESTART_FIELDS)
- Test: `tests/web_v2/test_config_api.py` (modify existing tests)

**Interfaces:**
- Consumes: `deps.reload_config()` (Task 3)
- Produces: All PUT responses return `needs_restart=False`

- [ ] **Step 1: Update existing tests to expect `needs_restart=False` always**

In `tests/web_v2/test_config_api.py`, modify:

`test_put_local_config_creates_file_and_writes_values` — change:
```python
# OLD: assert body["needs_restart"] is True
# OLD: assert "PLANIFY_API_KEY" in body["restart_fields"]
assert body["needs_restart"] is False
assert body["restart_fields"] == []
```

`test_put_local_config_no_restart_when_only_live_fields` stays the same (already expects False).

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_api.py -v -k "test_put_local_config_creates"`
Expected: FAIL — `needs_restart` is True (old behavior)

- [ ] **Step 3: Implement changes**

In `doclens/web_v2/models/config.py`, change `RESTART_FIELDS`:
```python
# All fields hot-reload now; kept for API compatibility but always empty.
RESTART_FIELDS: frozenset[str] = frozenset()
```

In `doclens/web_v2/api/config.py`, add reload call after the write (after line 75, before the `logger.info`):
```python
    # 4. Hot-reload in-memory singletons
    from doclens.web_v2.deps import reload_config
    reload_config()
```

- [ ] **Step 4: Run all config API tests**

Run: `.venv/Scripts/python.exe -m pytest tests/web_v2/test_config_api.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add doclens/web_v2/api/config.py doclens/web_v2/models/config.py tests/web_v2/test_config_api.py
git commit -m "feat: PUT /api/config hot-reloads singletons, needs_restart always False"
```

---

### Task 5: E2E verification via GUI

**Files:**
- No code changes — manual verification via playwright-cli

**Context:** Verify end-to-end that changing a config value in the settings UI takes effect on the next search without restart.

- [ ] **Step 1: Build frontend + start GUI**

```bash
cd doclens/web_v2/frontend && npm run build
cd D:/github/0627-2 && pwsh -File ./start.ps1 gui &
```

- [ ] **Step 2: Open browser and navigate to settings**

```bash
playwright-cli open http://127.0.0.1:7860
```

- [ ] **Step 3: Change a "live" field (e.g., CORTEX_MAX_RESULTS), save, and verify**

Navigate to settings → search tab → change max_results → save. The save should succeed and show "已保存。下次查询立即生效。" without restart messaging.

- [ ] **Step 4: Close browser**

```bash
playwright-cli close
```
