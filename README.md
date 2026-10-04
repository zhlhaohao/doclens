# doclens

[简体中文](README.zh-CN.md)

Structure-aware document retrieval — FTS5/BM25 keyword search over document trees, a PWA Web UI as the default interface, and a built-in harness agent for knowledge-base Q&A and vibe coding.

[![PyPI version](https://badge.fury.io/py/doclens.svg)](https://badge.fury.io/py/doclens)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](pyproject.toml)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)

**doclens** parses documents into tree structures (headings, classes, functions…) and searches them with FTS5/BM25 keyword matching — no embeddings, no chunking, no vector DB required. Works entirely offline.

---

## Features

**Core**

| | |
|---|---|
| **Structure-aware search** | Results anchored to document headings, code classes, or function definitions — not orphaned line fragments |
| **Multi-format** | Markdown, PDF, DOCX, PPTX, Excel, HTML, JSON, CSV, PST email archives, EPUB, images (vision-parsed), code (Python AST + tree-sitter) |
| **Zero embeddings** | FTS5/BM25 over document trees — no vector DB, fully offline |
| **CJK support** | Chinese/Japanese/Korean tokenization via jieba |
| **Web UI** | Lit + Shoelace PWA — the default interface |
| **Structured queries** | AND / OR / NOT / PHRASE operators (`search_v2`) |
| **Regex fallback** | Ripgrep-style regex `grep`; ripgrep fallback when FTS returns nothing |

**Additional**

| | |
|---|---|
| **Built-in AI agent** | A full harness agent (planify): tools, sub-agents, teammates, skills, context compaction — powers both KB Q&A and vibe coding. [See below](#ai-agent-knowledge-base-qa--vibe-coding) |
| **Rewind** | Every chat turn snapshots tracked files and each write is backed up before it happens — restore any earlier state from the session history |
| **Slash skills** | Invoke a skill directly in chat with `/skill-name question`, with a guided dropdown in the UI |
| **Background watching** | Auto-reindexes changed files via `watchdog` |
| **Git sync** | Auto commit → pull → merge → push for the knowledge directory (diary directory merges with `union`) |
| **Diary** | Daily fragments → deterministic next-day summary; image compression; weather lookup |
| **Web file manager** | Upload / rename / move / preview with TOC drawer |
| **Access PIN** | 6-digit password gate for non-loopback access; `doclens auth reset` to clear |
| **Web fetch** | Extract public web pages as markdown before searching |

---

## AI Agent: Knowledge-Base Q&A + Vibe Coding

The chat is not a thin "search + LLM" wrapper — it is a full **harness agent** built on [planify](planify/), doclens' in-repo AI agent framework. The same agent loop serves two modes that blend into each other: answering questions **grounded in your knowledge base**, and **vibe coding** — editing the knowledge base (or any working directory) through natural language.

### Why a harness agent

| Capability | What it does |
|---|---|
| **Tool loop** | The agent plans, calls tools, reads results, and iterates — multi-turn retrieval and code edits happen autonomously, not in a single fixed pipeline |
| **Sub-agents** | `task` spawns one-shot sub-agents (e.g. `Explore`) that read big files in parallel and return condensed summaries — large-document Q&A without blowing the context window |
| **Teammates** | `spawn_teammate` starts persistent autonomous teammates with their own agent loops; coordinate via `send_message` / `read_inbox` / file-based message bus |
| **Skills** | `load_skill` injects domain playbooks (KB retrieval strategy, citation rules, ignore-rule editing, README regeneration…) at call time; in chat, `/skill-name question` invokes one directly. Users can add their own SKILL.md files; skills hot-reload on change |
| **Context compaction** | Two-level automatic compaction (microcompact / auto-compact) keeps long sessions inside the model's context window |
| **Prompt caching** | Anthropic prompt caching with ephemeral breakpoints — system prompt and tools hit cache across turns |
| **Ask the user** | `ask_user_question` pauses for structured user input mid-task; chat-mode answers also work headless / mobile |
| **Rewind** | Turn-start snapshots plus pre-write backups make every AI edit reversible — pick a point in the session and restore the files as they were then |
| **Safety guard** | Outside-workdir guard: tool reads/writes outside the working directory are confirmed / allowed / blocked per `PLANIFY_OUTSIDE_WORKDIR` |

### Knowledge-base Q&A mode

The system prompt enforces a **knowledge-base-first** policy: factual questions must go through `load_skill("knowledge-base")` → `search_kb` (multi-query, synonyms, EN↔CN) before anything else; only when the KB truly has nothing may the agent fall back to web search — and it must say so. Citations are validated mechanically against the workdir (paths must actually exist), so answers cite what you really have.

A guidance file at the KB root (`CLAUDE.md` or `AGENTS.md`, up to 32 KB) is auto-injected into every system prompt — instructions you wrote for coding tools also steer this agent.

### Vibe coding mode

The same agent carries a full editing toolkit for the working directory:

- **File tools** — `read_file` / `write_file` / `edit_file` (edit_file requires unique old_text, so edits can't land in the wrong place)
- **Shell tools** — `bash` (Git Bash on Windows) and `powershell`, plus `background_run` / `check_background` for long jobs
- **Search tools** — `grep` / `glob` / `search_kb` / `read_document` over the indexed tree
- **Project tracking** — persistent task board (`task_create` / `task_update` / `claim_task`), in-memory todos, background shells — so multi-step refactors survive across turns

Open the chat, describe the change ("add a settings toggle for X", "summarize these three files into one"), and the agent searches, edits, runs builds, and reports — your knowledge base is the repo it works on. If an edit goes wrong, rewind restores the files to any earlier state captured in that session.

### Model presets

Switch LLM identity without touching `.env` by hand: named presets bundle protocol + base URL + model ID + API key (+ context window), managed in Settings → Model and applied hot (no restart). Anthropic and OpenAI-compatible endpoints are both supported; separate presets cover vision (image parsing) and search tuning.

---

## Installation

```bash
pip install doclens
```

Requires Python ≥ 3.10.

---

## Quick Start

```bash
# 1. Index your documents (current directory)
doclens index --force
# ...or point at a specific directory
doclens index --workdir /path/to/kb

# 2. Search from the CLI
doclens search "authentication flow"
doclens search "量子 计算"          # Chinese via jieba
doclens search_v2 '{"type": "and", "terms": ["auth", "token"]}'  # structured query

# 3. Launch the Web UI (opens the browser automatically)
doclens gui
# INFO: Uvicorn running on http://127.0.0.1:7860

# 4. Ask the AI a grounded question
doclens ai "How does the authentication system work?"
```

doclens automatically discovers supported files (`.md`, `.py`, `.pdf`, `.docx`, `.xlsx`, …) and skips common ignore patterns (`.git`, `node_modules`, `__pycache__`, `.venv`). The knowledge base root can also carry ignore rules in its `.gitignore`.

---

## CLI Reference

```
doclens <command> [--workdir DIR]
```

| Command | Description |
|---------|-------------|
| `doclens search <query…>` | Keyword search across indexed documents |
| `doclens search_v2 '<json>'` | Structured search: AND / OR / NOT / PHRASE operators |
| `doclens ai <message…>` | Send a message to the AI agent |
| `doclens index [--force]` | Build or update the document index |
| `doclens status` | Show index statistics and system status |
| `doclens gui [--port PORT]` | Launch the Web UI (PWA) |
| `doclens read_document --path <path>` | Read a document with structure info |
| `doclens search_kb <query…>` | KB search in the AI-tool output format (same engine as `search`) |
| `doclens webfetch <url>` | Extract a web page as markdown |
| `doclens grep <pattern>` | Ripgrep-style regex search |
| `doclens auth reset` | Clear the Web UI access password |

The bare `doclens` command launches the Web GUI by default.

---

## Web UI

The default interface is a PWA built with Lit + Shoelace, served by FastAPI on `http://127.0.0.1:7860` (port auto-increments on conflict — check the startup log).

- **Search** — keyword search with result cards and snippets
- **Chat** — the harness agent with SSE streaming, tool traces, and session history (see [AI Agent](#ai-agent-knowledge-base-qa--vibe-coding))
- **Files** — knowledge-base file tree with upload / rename / move / preview (Markdown, PDF, DOCX, PPTX, Excel, images, PST email lists) and a TOC drawer for long documents
- **Diary** — daily fragments with images and weather, summarized into finished entries the next day
- **Settings** — model presets (LLM / vision / search), access PIN, skills, MCP servers, Git sync

Access control: loopback (`127.0.0.1`) access never requires login. A 6-digit PIN can be set in Settings → Network; non-loopback requests then require it. Forgot the PIN? Run `doclens auth reset`.

---

## Claude Code Integration (MCP KB Q&A)

doclens auto-starts an **MCP server** (Streamable HTTP) inside the GUI, exposing the knowledge base as two MCP tools — `search_kb` and `read_document`. Any MCP-compatible client (Claude Code, Cursor, Cline, …) can connect and answer questions grounded in your indexed documents, with zero embedding / vector DB.

- The MCP HTTP server runs in a background thread **in-process**, sharing the same `IndexManager` as the GUI — live reindexing via the file watcher applies to MCP queries too.
- It listens at `http://<host>:<port>/mcp`. The URL is printed in the startup log on every launch.
- Loopback (`127.0.0.1`) by default, no auth. Binding to a non-loopback address **requires** a bearer token (`CORTEX_MCP_TOKEN`) — the server refuses to start otherwise.

### Setup

**1. Start doclens** (this also starts the MCP server):

```bash
doclens gui
```

Read the MCP URL from the startup log:

```
MCP server: http://127.0.0.1:7880/mcp
```

**2. Register it in Claude Code** (once per project):

```bash
claude mcp add --transport http doclens http://127.0.0.1:7880/mcp --scope local
claude mcp list      # expect: doclens: ... ✔ Connected
```

Scopes: `local` (default — this project + you, not committed), `user` (global), `project` (`.mcp.json`, committed).

**3. Restart your Claude Code session** if it was already running — MCP servers load only at session start.

**4. Ask.** In Claude Code, ask anything about your indexed docs; it will call `search_kb` / `read_document` automatically. For a focused, KB-only answer, restrict the session to the two tools:

```bash
claude -p "量子密钥分发 QKD 的基本原理是什么？" \
  --allowedTools "mcp__doclens__search_kb" "mcp__doclens__read_document"
```

### Bundled skill: `kb-ask`

doclens ships a Claude Code skill ([source: `doclens/claude_code_skills/kb-ask/skill.md`](doclens/claude_code_skills/kb-ask/skill.md)) that codifies the full KB Q&A workflow: MCP-connected prerequisite check, FTS multi-query strategy, `read_document` deep-read, source-citation rules, and a no-fabrication constraint.

On GUI startup, doclens checks `~/.claude/skills/kb-ask/` and, if the skill is missing or out of date, prompts to install/overwrite it (skipped silently in non-interactive terminals). After the first install, restart your Claude Code session and invoke it anywhere:

```
/kb-ask 新能源汽车技术有哪些
```

### Configuration

MCP behavior is controlled by these env vars (same `.env` as the rest of doclens):

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_MCP_ENABLED` | `false` | Auto-start the MCP server with the GUI. Set `true` to enable. |
| `CORTEX_MCP_PORT` | `7880` | MCP HTTP port. |
| `CORTEX_MCP_HOST` | `127.0.0.1` | Bind address. Non-loopback **requires** `CORTEX_MCP_TOKEN`. |
| `CORTEX_MCP_TOKEN` | — | Bearer token enforced when host is non-loopback. |

---

## Configuration

doclens reads `.env` from the project root. Copy and customize the template:

```bash
cp doclens/.env.example .env
```

Key variables (see `doclens/.env.example` for the full annotated list):

**Web / MCP**

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_WEB_HOST` | `127.0.0.1` | Web UI bind address |
| `CORTEX_WEB_PORT` | `7860` | Web UI port |
| `CORTEX_WEB_PASSWORD_HASH` | — | Access PIN hash (auto-written by the settings page; empty = no PIN) |
| `CORTEX_MCP_*` | — | MCP server toggle / host / port / token (see above) |
| `CORTEX_CHAT_DISCONNECT_CONTINUE` | `true` | SSE disconnect keeps the generation running; reconnect to resume viewing |

**LLM (AI chat)**

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_ACTIVE_LLM_PRESET` | — | Name of the active model preset |
| `PLANIFY_PROTOCOL` | — | `anthropic` or empty (OpenAI-compatible) |
| `PLANIFY_BASE_URL` / `PLANIFY_MODEL_ID` / `PLANIFY_API_KEY` | — | LLM endpoint, model, and key |
| `PLANIFY_CONTEXT_WINDOW` | `200000` | Context window in tokens; auto-compact at 0.8× |
| `PLANIFY_MAX_TOKENS` | `8000` | Max output tokens per response |
| `PLANIFY_ASK_MODE` | `interactive` | How `ask_user_question` asks: interactive card or chat message |

**Vision (image parsing)**

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_ACTIVE_VISION_PRESET` | — | Name of the active vision preset |
| `VISION_BASE_URL` | dashscope compatible-mode | OpenAI-compatible vision endpoint |
| `VISION_MODEL` | `qwen-vl-max` | Vision model |
| `VISION_API_KEY` | — | Required for image parsing |
| `VISION_AUTO_ROTATE` | `false` | Auto-rotate uploaded images via vision |

**Search tuning**

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_MAX_RESULTS` | `50` | Max search results returned |
| `CORTEX_MIN_SCORE_THRESHOLD` | `0.3` | Results below this score are filtered |
| `CORTEX_MAX_SPAN` | `50` | Keyword proximity window (chars) |
| `CORTEX_WEIGHT_*` | 4.0 / 2.0 / 1.0 / 2.0 / 1.0 | Scoring weights: keyword / file-name / FTS / title / proximity |
| `CORTEX_GREP_MAX_RESULTS` | `50` | Max grep results |

**Indexing / watching / Git sync**

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_WATCH_ENABLED` | `true` | Background file watcher |
| `CORTEX_WATCH_DEBOUNCE` | `5.0` | Watcher debounce (seconds) |
| `CORTEX_SYNC_ENABLED` | `false` | Git auto-sync (commit → pull → merge → push) |
| `CORTEX_SYNC_INTERVAL_MINUTES` | `5.0` | Sync interval |
| `CORTEX_CJK_TOKENIZER` | `jieba` | CJK tokenizer: jieba / bigram / char / auto |
| `TREESEARCH_INDEX_CHUNK_SIZE` | `500` | Chunked indexing block size (files) |

---

## Development

```bash
# 1. Create a virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1        # Windows (use pwsh 7)
# source .venv/bin/activate       # macOS / Linux

# 2. Install doclens in editable mode with dev dependencies
pip install -e ".[dev]"

# 3. Override treesearch / planify with local sources (editable, changes take effect immediately)
pip install -e ./treesearch
pip install -e ./planify

# 4. Playwright browsers for webfetch's JS-rendering fallback and E2E tests
python -m playwright install chromium --only-shell
```

Daily driving (repo root, PowerShell 7):

```powershell
./start-app.ps1 gui              # backend + built frontend
./start-app.ps1 gui -C D:\kb     # use a specific knowledge directory
./start-app.ps1 search "量子 计算"
```

Frontend (`doclens/web_v2/frontend`):

```bash
npm install
npm run build      # tsc --noEmit && vite build → outputs to doclens/web_v2/static/
npm test           # vitest unit tests
```

Backend tests:

```bash
.venv/Scripts/python.exe -m pytest
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│            Web UI (Lit + Shoelace PWA)          │
│           FastAPI + SSE streaming               │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│                 CLI (argparse)                  │
│   search / index / status / gui / ai / …        │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│      IndexManager │ CortexAgent │ EventBus      │
│         Scoring │ FileWatcher │ MCP server      │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│   treesearch/  —  parsers, indexer, FTS5/BM25  │
│   planify/     —  AI agent runner + tools       │
└─────────────────────────────────────────────────┘
```

- **doclens** — the host: CLI, Web UI, MCP server, event bus, file watcher, diary, Git sync
- **treesearch** — indexing and retrieval engine (FTS5/BM25 over document trees; distributed as `treesearchlib` on PyPI)
- **planify** — AI agent framework: LLM providers (Anthropic / OpenAI-compatible), streaming runner, tool registry, skills, teammates (distributed as `planify` on PyPI)

Layering rule: `doclens` may depend on `planify` and `treesearch`; the two libraries never import each other or the host, and private (underscore) members are never imported across module boundaries.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

## Contact

Lianghao — zhlhao@163.com
