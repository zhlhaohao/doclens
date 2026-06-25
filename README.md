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
doclens [--workdir DIR] <command>
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
doclens --workdir /path/to/project index
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
