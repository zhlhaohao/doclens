# doclens

[简体中文](README.md)

Structure-aware document retrieval — FTS5/BM25 keyword search over document trees, a PWA Web UI as the default interface, and a built-in harness agent for knowledge-base Q&A and vibe coding.

[![PyPI version](https://badge.fury.io/py/doclens.svg)](https://badge.fury.io/py/doclens)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](pyproject.toml)
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)](LICENSE)

**doclens** parses documents into tree structures (headings, classes, functions…) and searches them with FTS5/BM25 keyword matching — no embeddings, no chunking, no vector DB required. Works entirely offline.

---

## Features

| | |
|---|---|
| **Structure-aware search** | Results anchored to document headings, code classes, or function definitions — not orphaned line fragments |
| **Multi-format** | Markdown, PDF, DOCX, PPTX, Excel, HTML, JSON, CSV, PST email archives, EPUB, images (vision-parsed), code (Python AST + tree-sitter) |
| **Zero embeddings** | FTS5/BM25 over document trees — no vector DB, fully offline |
| **Web UI** | Lit PWA (Meta design system, Lucide icons) — the default interface |
| **Built-in AI personal assistant** | A full harness agent (planify): tools, sub-agents, skills, context compaction — powers both KB Q&A and vibe coding. [See below](#vibe-coding) |
| **Background watching** | Auto-reindexes changed files via `watchdog` |
| **Diary** | Daily fragments → deterministic next-day summary; image compression; weather lookup |
| **Web file manager** | Upload / rename / move / preview with TOC drawer |

---

## Vibe coding

The chat is not a thin "search + LLM" wrapper — it is a full **harness agent** built on [planify](planify/), doclens' in-repo AI agent framework — editing the knowledge base (or any working directory) through natural language.

| Capability | What it does |
|---|---|
| **Talk to code** | Describe the change and it acts — the agent plans, calls tools, reads results, and iterates; retrieving, editing, running builds, and reporting are all visible (every step expandable); not a single fixed pipeline |
| **Working-directory toolkit** | File tools `read_file` / `write_file` / `edit_file` (requires unique old_text, so edits can't land in the wrong place); shell tools `bash` (Git Bash on Windows) and `powershell`, plus `background_run` / `check_background` for long jobs; search tools over the indexed tree — `grep` / `glob` / `search_kb` / `read_document` |
| **Deep codebase understanding** | Structure-aware search anchors results on headings, classes, and function definitions; sub-agents spawned via `task` read big files in parallel — large-document Q&A without blowing the context window |
| **Long-term memory** | Preferences, corrections, and decisions persist across conversations — say "remember this" to store, "forget it" to retire; the memory store lives on your machine and is auditable |
| **Task tracking** | A persistent task board (`task_create` / `task_update` / `claim_task`) and in-memory todos survive across turns, so multi-step refactors don't lose progress |
| **CLAUDE.md compatible** | `CLAUDE.md` / `AGENTS.md` at the KB root is injected into every system prompt — team conventions work as-is, unchanged |
| **MCP ecosystem** | Built-in MCP server, plus external MCP servers — plug tools in and out |
| **Skill system** | Markdown is a skill: `load_skill` injects domain playbooks (KB retrieval strategy, citation rules, ignore-rule editing, README regeneration…) at call time; in chat, `/skill-name question` invokes one directly; a set of curated skills ships in the box, users can add their own SKILL.md, and changes hot-reload |
| **Context compaction** | Two-level automatic compaction (microcompact / auto-compact) keeps long sessions inside the model's context window |
| **Prompt caching** | Perfectly adapted to cloud providers' prompt caching — Anthropic uses explicit ephemeral breakpoints, while OpenAI-compatible endpoints (MiniMax / Alibaba Cloud / DeepSeek, …) auto-detect each vendor's cache-hit fields; the system prompt and tool definitions hit cache across turns, substantially cutting cost |
| **Ask the user** | `ask_user_question` pauses for structured user input mid-task; chat-mode answers also work headless / mobile |
| **Rewind** | Turn-start snapshots plus pre-write backups make every AI edit reversible — pick a point in the session and restore the files as they were then |
| **Safety guard** | Outside-workdir guard: tool reads/writes outside the working directory are confirmed / allowed / blocked per `PLANIFY_OUTSIDE_WORKDIR` |
| **Every platform** | A Lit PWA — open it in a browser; the same app on phone and desktop, with a real mobile layout rather than a squeezed one |
| **Work continuity** | Close the tab and the task keeps running (the server continues and persists it); reopen and pick up where you left off — same directory, file, and session |
| **Data stays on your machine** | Index, sessions, memory, backups, and logs live on local disk; retrieval is fully offline and the only outbound path is the replaceable model endpoint |
| **Auditable and portable** | Every step is recorded; sessions export whole; three rotating backups are kept automatically, so damaged data can be recovered |
| **Model of choice** | Anthropic and OpenAI-compatible protocols — point it at a domestic model and it just works; the endpoint can point at an intranet or self-hosted server |

## Knowledge-base Q&A

| Capability | What it does |
|---|---|
| **Questions from your knowledge base** | You ask; it goes looking in your **working directory** — Markdown, PDF, Word, PPT, Excel, code, email archives, all formats uniformly indexed. It retrieves the relevant passages, reads the original text of each, then **synthesizes** an answer with sources — not a paste of the matching snippets. When it finds nothing, it says so, rather than passing off a web result as one of your files |
| **Full-text search** | searches the structured nodes of indexed documents (headings, classes, functions, sections), anchoring results on actual definitions |
| **Regex grep** | ripgrep across the disk plus the body text of indexed PDF / DOCX files, so files that were never indexed are still searchable |
| **Five weighted factors** | keyword hits, file name, FTS score, title, and proximity (word span between hits); terms that sit close together rank higher |
| **Index updates itself** | watchdog watches file changes in real time (debounced) and rebuilds only the documents that changed, comparing node-level content hashes and skipping the rest |
| **Startup rescan** | picks up whatever changed while the app was down; renames are detected by fingerprint and rewrite the path in place instead of rebuilding |
| **Document-tree index** | every document stores its whole node tree (heading, depth, line range, content hash), so retrieval lands on a section or function |
| **Answers carry their own sources** | a "## 参考资料" section is attached at the end, listing which files the answer is based on |

---

## File management

A full file manager in the browser — no need to switch back to the terminal. A directory tree on the left, the file list on the right, everything done in place.

| Capability | What it does |
|---|---|
| **Tree + breadcrumbs** | The tree lazy-loads as you expand it; clicking a directory switches the list; breadcrumbs lead all the way back to the workdir root, a drive, or "This PC" |
| **Browsing the list** | Sort by name / size / modified time (click to toggle ascending and descending; directories always come first); checkboxes accumulate a selection, Shift picks a range, the header selects all — bulk move, bulk delete, copy path; column widths and the preview pane's width are drag-adjustable |
| **File operations** | Upload (drag anywhere in the window or use the system picker), download, new directories and empty files, single-file rename, multi-select move (never into itself or a subdirectory), delete (recursive for directories, root never deletable) |
| **Syntax highlighting** | Highlighted in both preview and edit: the editor mounts a language pack per file extension, covering 100+ extensions — Python / JS / TS / Rust / Go / Java / C / C++ / Ruby / Perl / Shell / SQL / HTML / CSS / JSON / YAML / TOML / Markdown, among others; in the preview pane Pygments detects the language from the filename, so the coloring matches the editor |
| **Multi-format preview** | Text with syntax highlighting; PDFs rendered natively with page jumping, zoom, fit-to-width, and remembered scroll position; Office / rtf / epub / csv / email archives synthesized into markdown; images shown as-is and rotatable by hand |
| **TOC drawer** | md / docx / epub get a table of contents with source line numbers extracted from their headings, PDFs use their native bookmarks; click to scroll smoothly and the current position highlights |
| **md editing** | Edit files right in the preview pane — Markdown and other text files alike, with a CodeMirror editor offering syntax highlighting and search, Ctrl+S to save to disk, and the index rebuilds automatically; files over 5 MB are read-only |
| **Uncommitted changes** | At a Git repo root, see the net diff of the working tree against HEAD, file by file, old vs new side by side |
| **Working directory** | "Set as working directory" in the toolbar moves to any directory, with a pre-check for an existing index, and recently used directories are one click away; outside it you can still browse the whole machine (drives / home), but it is always read-only and never indexed |

---

## Installation

### 1. Additional Windows setup (for the best experience)

**Git Bash** — the agent's `bash` tool runs on Git Bash (Unix syntax, not WSL). With it, code edits, builds, and git work feel natural:

```powershell
winget install -e --id Git.Git
```

After installing, open **Git Bash** from the Start menu or run `bash` in a terminal. See [git-scm.com/install/windows](https://git-scm.com/install/windows).

**PowerShell 7** — Microsoft's modern cross-platform terminal, built on .NET, installed side by side with the built-in Windows PowerShell 5.1:

- **Cross-platform**: the same commands run on Windows, Linux, and macOS
- **Fast**: a .NET runtime means quick startup and quick execution
- **Modern engine**: a better object pipeline and stronger error handling, with native support for Unix-style syntax like `&&` / `||` chaining and `?>` redirection
- **Extensible**: deep VS Code integration, official documentation, terminal reuse, and tabs out of the box

```powershell
winget install -e --id Microsoft.PowerShell
```

Launch it with `pwsh` afterwards — it coexists with the system `powershell` 5.1 without conflicting. See [Microsoft's official install guide](https://learn.microsoft.com/powershell/scripting/install/install-powershell-on-windows).

---

### 2. Install Python 3.13

Python ≥ 3.10 is required; **3.13** is recommended (newer features and better performance).

**Windows** (via winget, built into Win10/11):

```powershell
winget install -e --id Python.Python.3.13
```

Or download the installer from [python.org](https://www.python.org/downloads/) — **tick "Add python.exe to PATH"**.

**Linux (Ubuntu/Debian)**:

```bash
sudo apt update
sudo apt install -y software-properties-common
sudo add-apt-repository -y ppa:deadsnakes/ppa   # 3.13 isn't in the official repos yet
sudo apt update
sudo apt install -y python3.13 python3.13-venv python3.13-dev
```

Check it landed:

```bash
python3 --version   # Linux
python --version    # Windows
```

### 3. Install Doclens

```bash
pip install doclens
```

That one command installs **the whole application** — not just the main package. The indexing engine (treesearch), the AI agent framework (planify), document parsers, the PDF engine, the vision runtime, and the rest come along automatically; there is nothing else to install separately.

**Launch it straight away** — no extra database, service, or Docker needed. The browser opens the web interface on its own, and the index builds in the background (the first build takes a while, depending on how much you have).

### 4. Quick Start

**Open a new terminal** (PowerShell 7 on Windows, bash on Linux) — the `doclens` command may not be on the PATH of your current terminal yet; a fresh window picks it up:

```powershell
# Move to the directory you want to manage (the working directory = the docs and code doclens looks after)
cd D:\your-project
```

Then launch:

```bash
doclens
# INFO: Uvicorn running on http://127.0.0.1:7860
```

The browser opens on its own and the index builds in the background.

---

## Configuration

Most settings can be changed with a few clicks in the **settings page**, and they take effect immediately. The page has six sections: **模型 / 搜索 / 网络 / MCP / 技能 / 其它**.

You can also edit `.env` directly (it is read from the working directory):

```bash
cp doclens/.env.example .env
```

Below are all the parameters that appear on the settings page (for anything else, see `doclens/.env.example`).

**模型**

| Variable | Default | Description |
|---|---|---|
| `PLANIFY_ASK_MODE` | `interactive` | How the AI asks when it needs a decision: `interactive` answer card / `chat` chat-style message (headless, mobile) |
| `PLANIFY_OUTSIDE_WORKDIR` | `ask` | What to do when AI tools touch paths outside the working directory: `ask` confirm each time / `allow` let through / `block` block |
| `PLANIFY_THINKING_DEPTH` | `auto` | Reasoning depth: `auto` model default (no parameter, works with every endpoint) / `off` / `low` / `medium` / `high`; always-on-thinking models reject `off` |
| `CORTEX_FALLBACK_WINDOW_USED_PCT` | `80` | Fallback pre-check: skip a candidate whose 5-hour plan window is ≥ this percent used |
| `CORTEX_FALLBACK_BALANCE_MIN` | `10` | Fallback pre-check: skip a candidate whose account balance is below this amount (CNY) |
| `VISION_AUTO_ROTATE` | `false` | Detect image orientation on upload and auto-rotate upright ones |
| `BAIDU_WEATHER_AK` | — | Baidu Maps open-platform AK, used to fetch city weather for diary entries; leave empty to skip weather |
| `JIMENG_API_KEY` | — | Volcengine Ark API key. Once set, the Jimeng text-to-image tool is mounted automatically (the AI can generate images in chat) |
| `JIMENG_MODEL` | `doubao-seedream-4-0` | Default Jimeng model ID |
| `JIMENG_ACCESS_KEY` / `JIMENG_SECRET_KEY` | — | Volcengine AK/SK, only for querying account balance; leave empty to hide the balance |

Model parameters (base URL, model ID, API key, context window, output limit) are managed through **model presets** — see the vendor table below.

**网络** (changes need a restart)

| Variable | Default | Description |
|---|---|---|
| `CORTEX_WEB_HOST` | `127.0.0.1` | Web UI bind address; `0.0.0.0` exposes it on the LAN (no auth — use with care) |
| `CORTEX_WEB_PORT` | `7860` | Web UI port (1–65535) |
| `CORTEX_MCP_ENABLED` | `false` | Whether to start the built-in MCP HTTP server |
| `CORTEX_MCP_HOST` | `127.0.0.1` | MCP server bind address; a non-loopback address requires `CORTEX_MCP_TOKEN` in `.env` |
| `CORTEX_MCP_PORT` | `7880` | MCP server port (1–65535) |
| `CORTEX_SYNC_ENABLED` | `false` | Periodically auto-commit → pull → push when the working directory is a git root |
| `CORTEX_WORKDIR` | — | Working directory (used when no `-C` is passed); the index, `.env`, logs, and AI tools all follow it |

**其它**

| Variable | Default | Description |
|---|---|---|
| `PLANIFY_SHELL_TIMEOUT` | `120` | Shell command timeout (seconds) |
| `PLANIFY_MAX_TOOL_ROUNDS` | `0` | Max tool rounds per reply; `0` = unlimited |
| `PLANIFY_MAX_SUBAGENT_ROUNDS` | `30` | Max rounds for a sub-agent |
| `PLANIFY_LLM_TRACE` | `0` | Days to keep LLM traces; `0` = off |
| `PLANIFY_INJECTION_ACK` | `false` | Injection notification ack — only for endpoints that enforce strict user/assistant alternation |
| `CORTEX_MEMORY_DISABLE` | — | When set, long-term memory is no longer injected into replies (the memory files stay) |

The **搜索** and **技能** sections carry no loose fields: search parameters (result count, score threshold, keyword proximity window, the five scoring weights) are managed through **search presets**, and skills through **skill management**.

**Vendor connection details** (create a preset in Settings → Model, fill in the base URL and model ID):

| Vendor | Protocol | Base URL | Where to find the model ID |
|---|---|---|---|
| Zhipu GLM | Anthropic | `https://open.bigmodel.cn/api/anthropic` | [Model overview](https://docs.bigmodel.cn/cn/guide/start/model-overview) |
| Kimi | Anthropic | `https://api.kimi.com/coding` | [Model list](https://platform.kimi.com/docs/models) |
| MiniMax | Anthropic | `https://api.minimaxi.com/anthropic` | [Models intro](https://platform.minimax.io/docs/guides/models-intro) |
| DeepSeek | Anthropic | `https://api.deepseek.com/anthropic` | [Models & pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/) |
| Alibaba Cloud Bailian (Qwen) | OpenAI-compatible | `https://dashscope.aliyuncs.com/compatible-mode/v1` | [Choose a model](https://help.aliyun.com/zh/model-studio/models) |

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

## Documentation

Architecture write-ups, ADRs, configuration reference and other technical docs are indexed in [docs/README.md](docs/README.md).

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

## Contact

Lianghao — zhlhao@163.com
