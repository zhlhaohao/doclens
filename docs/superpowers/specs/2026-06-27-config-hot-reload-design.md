# Config Hot-Reload Design

## Problem

`PUT /api/config` only writes `.env` files. The backend singletons (`IndexManager`, `CortexAgent`) cache config values as instance variables at init time and never re-read them. All config changes — even those marked `effect: "live"` in the frontend — require an application restart to take effect.

## Goal

All 18 config fields take effect immediately after saving, with no restart. This includes the 3 AI fields (`PLANIFY_BASE_URL`, `PLANIFY_API_KEY`, `PLANIFY_MODEL_ID`).

## Approach

**Approach C: Remove instance-variable caching; always delegate to the live config object.**

IndexManager and CortexAgent hold a reference to `CortexConfig`. They expose config-backed values via `@property` instead of copying values in `__init__`. When config is reloaded, `deps.py` pushes the new `CortexConfig` into existing singletons via `apply_config()`.

No singleton destruction. No index rebuild. No database reconnection.

## Design

### 1. deps.py — reload_config()

New function that recreates `CortexConfig` and pushes it into live singletons:

```python
def reload_config() -> CortexConfig:
    global _config
    with _lock:
        _config = CortexConfig.load()
        if _idx_manager:
            _idx_manager.apply_config(_config)
        if _agent:
            _agent.apply_config(_config)
    return _config
```

`reset_singletons()` remains unchanged (test-only).

### 2. PUT /api/config — trigger reload

After `write_env_values()` writes the `.env` file, call `deps.reload_config()` before returning the response.

`needs_restart` is always `False` now (all fields hot-reload). The frontend's `effect` badges become informational only.

### 3. IndexManager — property delegation + apply_config()

**Remove** all `self.xxx = config.xxx` assignments from `__init__` (~15 fields).

**Replace** with `@property`:

```python
@property
def max_results(self) -> int:
    return self._config.max_results

@property
def scoring_weights(self) -> dict:
    return self._config.scoring_weights
# ... etc for all config-backed fields
```

**Add** `apply_config()`:

```python
def apply_config(self, config: CortexConfig) -> None:
    self._config = config
```

Callers (`scoring_pipeline.py`, `kb_tools.py`, etc.) require zero changes — `idx_manager.max_results` works identically.

**Unchanged**: `load_or_build_index()`, `TreeSearch` instance, FTS5 database connection — none depend on these config parameters.

### 4. CortexAgent — lazy client rebuild + apply_config()

CortexAgent holds an Anthropic client created from API credentials. Client recreation is deferred to next use.

**apply_config()**:

```python
def apply_config(self, config: CortexConfig) -> None:
    self._config = config
    self._client = None  # rebuilt on next API call
```

**Lazy rebuild** — called before every API request:

```python
def _ensure_client(self):
    if self._client is None:
        self._client = Anthropic(
            base_url=self._config.planify_base_url,
            api_key=self._config.planify_api_key,
        )
```

**Model ID**: read from `self._config.planify_model_id` at call time, not cached.

**No session state loss**: conversation history lives in `sessions.db`, independent of the client object.

### 5. Concurrency

No locking on hot-reload. Acceptable for a low-concurrency personal tool — the probability of a user saving config while an SSE stream is active is negligible. Worst case: one in-flight request uses stale credentials, next request uses new ones.

## Files Changed

| File | Change |
|------|--------|
| `doclens/web_v2/deps.py` | Add `reload_config()` |
| `doclens/web_v2/api/config.py` | Call `reload_config()` after write |
| `doclens/index_manager.py` | Replace ~15 instance vars with `@property`; add `apply_config()` |
| `doclens/agent_integration.py` | Add `apply_config()` + lazy `_ensure_client()` |
| `doclens/web_v2/models/config.py` | `RESTART_FIELDS` becomes empty (or keep for reference) |

## Files NOT Changed

- `scoring_pipeline.py`, `kb_tools.py` — access syntax unchanged
- `doclens/config.py` — `CortexConfig.load()` already works correctly
- `doclens/web_v2/frontend/` — no frontend changes needed (badges remain informational)
