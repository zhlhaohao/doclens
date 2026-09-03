# doclens

> Structure-aware document retrieval — FTS5/BM25 keyword search over document trees, with an interactive TUI and a PWA Web UI.

[![PyPI version](https://badge.fury.io/py/doclens.svg)](https://badge.fury.io/py/doclens)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](pyproject.toml)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)

**doclens** parses documents into tree structures (headings, classes, functions…) and searches them with FTS5/BM25 keyword matching — no embeddings, no chunking, no vector DB required. Works entirely offline.

---

## Features

| | |
|---|---|
| **Structure-aware search** | Returns results anchored to document headings, code classes, or function definitions — not orphaned line fragments |
| **Multi-format** | Markdown, PDF, DOCX, PPTX, Excel, HTML, JSON, CSV, code (Python AST + tree-sitter) |
| **Two UIs** | Textual TUI (terminal) and Lit + Shoelace PWA (browser) |
| **LLM-augmented QA** | Send search results to Anthropic Claude for natural-language answers |
| **Background watching** | Auto-reindexes changed files via `watchdog` |
| **Web search** | Fetch + extract public web pages as markdown before searching |

---

## Installation

```bash
pip install doclens
```

Requires Python ≥ 3.10.

> **⚠️ Upgrading from ≤ 1.1.42** — the distribution layout changed in 1.1.43: the
> `treesearch` / `planify` modules are no longer vendored (they now come from the
> `treesearchlib` / `planify` PyPI packages). A plain `pip install --upgrade doclens`
> leaves a **broken install** (pip installs the new package first, then the old
> package's uninstall deletes the freshly installed `treesearch/` and `planify/`
> module directories). Upgrade cleanly instead:
>
> ```bash
> pip uninstall doclens && pip install doclens
> # already broken? repair with:
> pip install --force-reinstall --no-deps treesearchlib planify
> ```

**Quick setup:**

```bash
# Index your documents
doclens index --force

# Search from CLI
doclens search "authentication"

# Or launch the Web UI (opens browser automatically)
doclens gui
```

---

## CLI Reference

```
doclens <command> [--workdir DIR]
```

| Command | Description |
|---------|-------------|
| `doclens search <query…>` | Keyword search across indexed documents |
| `doclens search_v2 '<json>'` | Structured search: AND / OR / NOT / PHRASE operators |
| `doclens ai <message…>` | Send a message to the Claude agent |
| `doclens index [--force]` | Build or update the document index |
| `doclens status` | Show index statistics and system status |
| `doclens gui [--port PORT]` | Launch the Web UI (PWA) |
| `doclens read_document --path <path>` | Read a document with structure info |
| `doclens web <query…>` | Search the live web |
| `doclens webfetch <url>` | Extract a web page as markdown |
| `doclens grep <pattern>` | Ripgrep-style regex search |

---

## Quick Start

### 1. Index your documents

```bash
# Index the current directory
doclens index --force

# Or specify a working directory
doclens index --workdir /path/to/project
```

doclens automatically discovers supported files (`.md`, `.py`, `.pdf`, `.docx`, `.xlsx`, …) and skips common ignore patterns (`.git`, `node_modules`, `__pycache__`, `.venv`).

### 2. Search

```bash
doclens search "authentication flow"
doclens search "量子 计算"          # Chinese supported via jieba

# Structured query
doclens search_v2 '{"type": "and", "terms": ["auth", "token"]}'
```

### 3. Interactive TUI

```bash
doclens
```

Opens the full terminal UI with live preview, command history, and keyboard navigation.

### 4. Web UI

```bash
doclens gui
# INFO: Uvicorn running on http://127.0.0.1:7860
```

Browser opens automatically. Port may vary if 7860 is in use — check the startup log.

### 5. Ask the AI

```bash
doclens ai "How does the authentication system work?"
```

doclens first retrieves relevant document sections, then sends them to Anthropic Claude as context for a grounded answer.

---

## Claude Code Integration (MCP KB Q&A)

doclens auto-starts an **MCP server** (Streamable HTTP) inside both the TUI and the GUI, exposing the knowledge base as two MCP tools — `search_kb` and `read_document`. Any MCP-compatible client (Claude Code, Cursor, Cline, …) can connect and answer questions grounded in your indexed documents, with zero embedding / vector DB.

### How it works

- The MCP HTTP server runs in a background thread **in-process**, sharing the same `IndexManager` as the TUI/GUI — so live reindexing via the file watcher applies to MCP queries too.
- It listens at `http://<host>:<port>/mcp`. The URL is printed in the startup log on every launch.
- Loopback (`127.0.0.1`) by default, no auth. Binding to a non-loopback address **requires** a bearer token (`CORTEX_MCP_TOKEN`) — the server refuses to start otherwise.

### Setup

**1. Start doclens** (this also starts the MCP server):

```bash
doclens gui          # Web UI mode
# or
doclens              # TUI mode
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

On **TUI/GUI startup**, doclens checks `~/.claude/skills/kb-ask/` and, if the skill is missing or out of date, prompts to install/overwrite it (skipped silently in non-interactive terminals). After the first install, restart your Claude Code session and invoke it anywhere:

```
/kb-ask 新能源汽车技术有哪些
```

### Configuration

MCP behavior is controlled by these env vars (same `.env` as the rest of doclens):

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_MCP_ENABLED` | `true` | Auto-start the MCP server in TUI/GUI. Set `false` to disable. |
| `CORTEX_MCP_PORT` | `7880` | MCP HTTP port (override via this env var). |
| `CORTEX_MCP_HOST` | `127.0.0.1` | Bind address. Non-loopback **requires** `CORTEX_MCP_TOKEN`. |
| `CORTEX_MCP_TOKEN` | — | Bearer token enforced when host is non-loopback. |

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `claude mcp list` shows doclens missing / ✘ | doclens not running, or wrong port. Start doclens, read the URL from its log, re-add. |
| Tools `mcp__doclens__*` not available in session | MCP loads at session start — **restart the Claude Code session** after adding. |
| `search_kb` returns nothing | Keywords may not match FTS tokens. Try synonyms, EN↔CN, or rebuild the index: `doclens index --force`. |
| Non-loopback start refused | Set `CORTEX_MCP_TOKEN`, or bind back to `127.0.0.1`. |

---

## Configuration

doclens reads `.env` in the project root. Copy and customize:

```bash
cp doclens/.env.example .env
```

Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CORTEX_SEARCH_PATH` | `.` | Root directory to index and search |
| `CORTEX_DB_PATH` | `.cortex/sessions.db` | SQLite database path |
| `ANTHROPIC_API_KEY` | — | Required for `ai` and `web` commands |
| `ANTHROPIC_BASE_URL` | — | Custom API endpoint (optional) |

---

## Troubleshooting

### PST indexing fails on Windows (`WinError 225`)

When indexing Outlook `.pst` archives, Microsoft Defender may block the parser sidecar with:

```
[WinError 225] 无法成功完成操作，因为文件包含病毒或潜在的垃圾软件
```

**Cause:** the sidecar (`pst-extract.exe`) extracts email attachments to a temp dir; once any attachment is flagged as malware, Defender **cascades and blocks `pst-extract.exe` itself**, so every subsequent PST fails instantly — while the index still reports "complete".

**Fix** — run in an **admin PowerShell 7**:

```powershell
# Exclude the sidecar by process name to stop the cascade (works regardless of install location)
Add-MpPreference -ExclusionProcess "pst-extract.exe"
# Optional: stop extracted attachments from being scanned/quarantined
Add-MpPreference -ExclusionPath "<your-pst-directory>"
```

Then rebuild: `doclens index --force --workdir <your-pst-directory>`

> ⚠️ Real mail archives can contain **malicious attachments**. With the exclusion in place, those files land in `<workdir>/.cortex/pst_attachments/` unscanned — use them for search only, **never open or execute** them.

> PST indexing is **serialized** (`max_pst_concurrency=1`): each PST launches a heavy sidecar, so they run one at a time to avoid the memory/IO contention that previously crashed the sidecar. A 10+ GB archive takes a few minutes; progress is logged every 30 s.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                  TUI (Textual)              │
│  ┌───────────────────────────────────────┐  │
│  │  HeaderBar │ ContentArea │ InputBox   │  │
│  └───────────────────────────────────────┘  │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│           Web UI (Lit + Shoelace PWA)      │
│         FastAPI + SSE streaming             │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│         IndexManager + Scoring              │
│    TreeSearch (FTS5 + BM25)                │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│    treesearch/  —  parsers, indexer, FTS5  │
│    planify/     —  AI agent runner          │
└─────────────────────────────────────────────┘
```

- **treesearch**: Powers the indexing and retrieval engine (FTS5/BM25 over document trees)
- **planify**: Drives the AI agent, session management, and tool execution
- **doclens**: Ties them together — CLI, TUI, Web UI, event bus, and file watcher

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).
