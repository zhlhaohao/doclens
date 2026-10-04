# Planify

[简体中文](README.zh-CN.md)

Planify is a single-process, multi-agent LLM agent framework. It provides a streaming agent loop, a statically composed tool registry, dual provider backends (Anthropic and OpenAI-compatible), and context compaction designed to preserve prompt prefix caching (reusing the unchanged head of a conversation so the provider charges less for repeated input). Planify ships as a Python library — a host application embeds it and drives it, while providers, tools, and configuration can all be injected or extended from the outside.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start (Library Usage)](#quick-start-library-usage)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Built-in Tools](#built-in-tools)
- [Runtime Data Directories](#runtime-data-directories)
- [Embedding as a Host Application](#embedding-as-a-host-application)
- [Development](#development)
- [Documentation](#documentation)
- [License](#license)

## Features

**Agent execution**

- **Streaming agent loop** (primary path) — fully asynchronous, consuming normalized stream events from the provider. Tool handlers run off the main loop, and a mid-run interrupt event lets the caller stop generation between rounds.
- **Synchronous agent loop** — a legacy whole-response path that shares the same loop skeleton and compaction pipeline.
- **One-shot subagents** — temporary agent loops capped at 30 rounds: they execute an isolated task, return a summary, and are destroyed. The `agent_type` trims the toolset (`Explore` is read-only; `general-purpose` adds file writes).
- **Persistent teammates** — each teammate is a persistent agent running its own loop on a background daemon thread (a thread that does not block process exit), communicating through a file-based message bus. Idle teammates automatically claim unblocked tasks from the task board.

**Context management**

- **Microcompact** (truncation) keeps only the last 10 tool results and clears the rest. It is gated at 80% of the compaction threshold: below the gate, history is left completely untouched so the conversation head stays byte-stable and cache-friendly.
- **Auto-compact** (LLM summary) first writes the original transcript to disk, then asks the model to produce a continuity summary that replaces the history.
- Compaction triggers from four places: both agent loops internally, a `compress` tool the model may call itself, and a manual command from the hosting front end.

**LLM provider layer**

- A single provider protocol with three methods (send / stream / count tokens) — no caller touches SDK types directly.
- Two interchangeable backends: **Anthropic** (with prompt-caching breakpoints on the system prompt, tool table, and last user message) and **OpenAI-compatible** (via `/chat/completions`, with a built-in translator between the two tool-call formats).
- An error hierarchy carrying a `retryable` flag, covering auth, rate limit, context length, and network failures.

**Tool system**

- The registry is statically composed and returns tool definitions plus their handlers in one pass; handlers may be synchronous or async.
- A host application can inject its own tools, filter the set with a whitelist environment variable, and enable a stricter path guard for sandboxed front ends (shell tools get wrapped; file tools are blocked from path escapes).
- About 29 built-in tools ship out of the box — see [Built-in Tools](#built-in-tools).

**Skills**

- Skill files (`SKILL.md`) act as two-stage prompt injection rather than callable tools: a lightweight catalog is injected up front (cheap for caching), and the full body is fetched on demand via the `load_skill` tool. Skills hot-reload — changed files are picked up at the start of the next conversation turn without a restart.

**Task management**

- **TodoManager** — an in-memory, per-agent checklist: at most 20 items, exactly one in progress at a time, with a reminder nag if it goes stale for 3 rounds.
- **TaskManager** — a file-persisted task board with dependency edges (blocked-by / blocks); completing a task automatically unblocks dependents, and any agent may claim an unowned task.
- **BackgroundManager** — runs long shell commands on daemon threads (on Windows it falls back from Git Bash to PowerShell to cmd) and feeds results back into the agent loop as notifications.

**Host integration**

- Configuration and tools flow in through registration hooks; planify never imports the host application.
- Pluggable event emitters (SSE queue, console, callback routing) let one agent drive different front ends.

## Requirements

- Python ≥ 3.10 (declared in `pyproject.toml`)
- An API key for an Anthropic-compatible or OpenAI-compatible endpoint
- Playwright's Chromium binary, needed only for fetching JavaScript-rendered pages:

```bash
# One-time download of the headless browser for the webfetch tool
python -m playwright install chromium --only-shell
```

## Installation

Install from the repository root in editable mode (recommended for development):

```bash
# Editable install of the planify package
pip install -e ./planify
```

Core dependencies are pulled automatically: the two provider SDKs (`anthropic`, `openai`), `httpx`, `python-dotenv`, `borax` (lunar calendar data), and `trafilatura` + `playwright` (web fetching).

## Quick Start (Library Usage)

Planify is embedded by a host application; it has no user-facing entry point of its own. The minimal path is: register configuration → create a runtime → drive the streaming loop.

```python
import asyncio
from pathlib import Path

from planify.bootstrap import initialize, get_or_create_runtime
from planify.streaming import StreamingAgent
from planify.streaming.emitter import SSEEmitter   # or your own emitter implementation

# 1. Boot the runtime manager singleton for this working directory
manager = initialize(base_workdir=Path.cwd())

# 2. Create the per-user runtime: wires the provider, managers, message bus, tools
runtime = get_or_create_runtime("alice", {
    "api_key": "sk-...",
    "model_id": "claude-sonnet-4-6",
})

# 3. Build a streaming agent on top of that runtime
agent = StreamingAgent(
    client=runtime.client,          # provider instance
    model=runtime.model,
    tools=runtime.tools,
    tool_handlers=runtime.tool_handlers,
    emitter=SSEEmitter(),           # any emitter implementation
    bus=runtime.bus,
    skills_loader=runtime.skills,
    runtime=runtime,
    system_prompt_extra="Optional host policy appended to the system prompt.",
)

# 4. Run the loop. Note: `messages` is modified in place.
messages = []
asyncio.run(agent.run_stream(messages, "Summarize the repo layout.", session_id="demo-001"))
```

A one-shot subagent for isolated read-only exploration:

```python
from planify.subagent.runner import run_subagent
from planify.tools.basic import run_bash, run_read, run_write, run_edit

summary = run_subagent(
    prompt="List the top-level packages and their responsibilities.",
    agent_type="Explore",                 # read-only toolset
    workdir=Path.cwd(),
    client=runtime.client,
    model=runtime.model,
    run_bash=run_bash, run_read=run_read, run_write=run_write, run_edit=run_edit,
)
```

## Configuration

Config resolution order (highest first):

1. Host-injected registration at startup
2. The per-user config dict passed to `get_or_create_runtime()`
3. Environment variables
4. `.env` files in the working directory (`.planify/.env` → `.env.local` → `.env`)
5. Built-in defaults

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `PLANIFY_API_KEY` | Yes | LLM provider API key |
| `PLANIFY_MODEL_ID` | Yes | Model ID, e.g. `claude-sonnet-4-6`, `glm-4.7`, `deepseek-chat` — fully config-driven, no presets |
| `PLANIFY_PROTOCOL` | No | `anthropic` (default, `/v1/messages`) or `openai_compat` (`/chat/completions`) |
| `PLANIFY_BASE_URL` | No | Endpoint URL; empty = provider SDK default. Setting it removes `ANTHROPIC_AUTH_TOKEN` to avoid auth conflicts |
| `PLANIFY_ENABLED_TOOLS` | No | Comma-separated tool whitelist; empty/unset = register all tools |
| `PLANIFY_ASK_MODE` | No | How the agent asks the user questions: `interactive` (default, blocking prompt) or `chat` (answered via the next user message); re-read per call |
| `ASSETS_DIR` | No | Assets directory, absolute or relative to the workdir |
| `BAIDU_WEATHER_API_URL` / `BAIDU_WEATHER_AK` / `BAIDU_WEATHER_DATA_TYPE` | No | Baidu Map weather API settings for the `baidu_weather` tool |

### Switching LLM endpoints

The endpoint is chosen by protocol plus base URL — there are no provider presets.

OpenAI-compatible endpoint:

```bash
export PLANIFY_PROTOCOL=openai_compat          # use /chat/completions
export PLANIFY_BASE_URL=https://api.deepseek.com/v1
export PLANIFY_API_KEY=sk-...
export PLANIFY_MODEL_ID=deepseek-chat
```

Anthropic native (the default; no base URL needed):

```bash
export PLANIFY_API_KEY=sk-ant-...
export PLANIFY_MODEL_ID=claude-sonnet-4-6
```

## Architecture

Four layers, with dependencies strictly one-directional (upper depends on lower, no cycles):

```
Entry       host front ends (web SSE / console / callback routing)
              ↓
Assembly    bootstrap.py → core/runtime_manager.py → core/runtime.py (component container)
              ↓ tool registry assembly
Execution   streaming/runner.py (async, primary)  agent/runner.py (sync, legacy)  subagent/runner.py (one-shot)
              └─────────── all three share the provider protocol and the compaction pipeline ───────────┘
Support     core/llm/ (provider abstraction) · tools/ · skills/ · managers/ · messaging/ · context/compact.py
```

Source layout:

```
planify/
├── bootstrap.py            # Assembly entry: runtime manager singleton + host dependency registration
├── prompts.py              # System-prompt builder (per-agent-type branches; host extension point)
├── agent/
│   └── runner.py           # Synchronous agent loop (legacy whole-response path)
├── streaming/
│   ├── runner.py           # StreamingAgent — async main loop (primary path)
│   ├── emitter.py          # Emitter implementations (SSE queue / console / callback routing)
│   ├── waiter.py           # Cross-thread "agent asks, user answers" blocking wait
│   └── types.py            # Event types, protocols, streaming config
├── subagent/
│   └── runner.py           # One-shot subagent (≤ 30 rounds, toolset trimmed by agent type)
├── context/
│   └── compact.py          # Two-level compaction: truncation and LLM summary
├── core/
│   ├── runtime.py          # AgentRuntime: process-level component container
│   ├── runtime_manager.py  # Runtime lifecycle / component assembly (thread-safe singleton)
│   ├── config.py           # Config (.env multi-level loading + host-injection dual path)
│   ├── encoding.py         # Windows GBK/UTF-8 console handling
│   ├── logging_config.py   # Logging + first-run workspace init
│   └── llm/                # Provider protocol, factory, dual backends, translator, errors
├── managers/
│   ├── todo_manager.py     # In-memory per-agent todo list
│   ├── task_manager.py     # File-persisted task board with dependency edges
│   ├── background_manager.py  # Background shell commands (thread + notification queue)
│   └── teammate_manager.py # Persistent teammates (one daemon thread + agent loop each)
├── messaging/
│   └── message_bus.py      # File-level per-recipient inbox
├── skills/
│   ├── skill_loader.py     # SKILL.md scan/parse, lazy hot-reload
│   └── access_state.py     # Per-session loaded-skill state
└── tools/
    ├── registry.py         # Tool registry assembly + external tool injection + whitelist
    ├── basic.py            # bash / powershell / read_file / write_file / edit_file (+ path guard)
    ├── grep.py / glob_tool.py  # ripgrep-based content search / glob file matching
    ├── webfetch.py         # Web fetching: trafilatura → Playwright fallback, SSRF checks
    ├── user_interaction.py # User-question tools (host binds emitter + waiter at runtime)
    ├── team_tools.py       # Team collaboration tools
    ├── file_tasks.py       # Task-board tools
    ├── protocols.py        # shutdown / plan_approval / idle protocol tools
    ├── weather_tool.py / baidu_weather.py / lunar.py  # Weather + lunar calendar
    └── guard.py            # Path guard for sandboxed front ends
```

### Key concepts

- **Subagent vs teammate** — a subagent is temporary: it runs one task, returns a summary, and is destroyed. A teammate is persistent: it runs its own agent loop in a background thread and communicates through the message bus.
- **TodoManager vs TaskManager** — the former is an in-memory checklist private to one agent; the latter is a file-persisted task board shared across agents, with dependency edges.
- **Two-level compaction** — truncation clears old tool results automatically each round; the LLM summary kicks in once the token threshold is exceeded. Both protect prompt prefix caching through the 0.8 gate described above.

A deeper analysis (layering, call chains, known technical debt) lives in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Built-in Tools

About 29 tools, statically assembled by the tool registry in `tools/registry.py`. Tool definitions are plain dicts in Anthropic format; handlers may be sync or async. The host can inject more via the registration hook and filter the set with the whitelist variable.

| Category | Tools | Notes |
|---|---|---|
| Files & commands | `bash`, `powershell`, `read_file`, `write_file`, `edit_file` | Path-escape guard, dangerous-command filtering, timeouts, output truncation; reads are line-numbered with offset/limit paging; edits enforce unique match or explicit replace-all |
| Search | `grep`, `glob` | ripgrep-based content search and file-name matching |
| Web | `webfetch` | trafilatura extraction with Playwright fallback; SSRF (server-side request forgery) protection |
| User interaction | `ask_user`, `user_confirm`, `ask_user_question` | Registered unbound; the host binds an emitter and response waiter at runtime, so the same tools drive any front end |
| Team collaboration | `spawn_teammate`, `list_teammates`, `send_message`, `read_inbox`, `broadcast` | Delegate to the teammate manager and message bus |
| Protocol | `shutdown_request`, `plan_approval`, `idle` | Team lifecycle coordination |
| Task board | `task_create`, `task_get`, `task_update`, `task_list`, `claim_task` | Forward to the persistent task board |
| Agent-internal | `TodoWrite`, `task` (one-shot subagent), `load_skill`, `background_run`, `check_background`, `compress` | Loop-adjacent conveniences |
| Weather & calendar | `baidu_weather` | Baidu Map API plus borax lunar calendar |

## Runtime Data Directories

All runtime state lives under the working directory (`.planify/` namespace plus convention dirs):

```
your-project/
├── .planify/
│   ├── team/              # Team config and per-recipient inboxes (inbox/)
│   ├── tasks/             # Task board JSON files
│   ├── transcript.json    # Compaction transcript sink
│   └── .env               # Highest-priority .env location
├── skills/                # SKILL.md skill files (scanned recursively)
├── .transcripts/          # Conversation transcripts saved by auto-compact
└── logs/                  # Log files
```

## Embedding as a Host Application

Planify never imports the host — everything flows in through registration hooks:

```python
from planify import bootstrap

# 1. Inject configuration (highest priority, beats environment variables)
bootstrap.register_planify_config(
    api_key="sk-...",
    model_id="claude-sonnet-4-6",
    base_url="",                     # empty = SDK default
    protocol="anthropic",            # or "openai_compat"
)

# 2. Inject host tools (e.g. domain-specific retrieval tools)
bootstrap.register_app_dependencies(
    external_tools=[{"name": "read_document", "description": "...", "input_schema": {...}}],
    external_handlers={"read_document": my_handler},
)
```

User-question tools are wired at runtime: the host binds its event emitter and response waiter with `bind_user_interaction_handlers()` (in `tools/user_interaction.py`), so agent questions reach whatever front end the host provides and answers flow back asynchronously.

A full integration walkthrough (SSE streaming, custom tool development, config injection) is in [INTEGRATION.md](INTEGRATION.md) and [examples.md](examples.md).

## Development

```bash
# Install with dev extras (pytest / pytest-asyncio)
pip install -e "./planify[dev]"

# Run the test suite
pytest
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — deep architecture analysis (layering, call chains, technical debt)
- [INTEGRATION.md](INTEGRATION.md) — host-application integration guide (SSE, custom tools, config injection)
- [examples.md](examples.md) — usage example code

## License

Apache-2.0 — see the repository root [LICENSE](../LICENSE).
