# CLI Subcommands Design

## Goal

Add CLI argument parsing to `cortex_cli:main()` so that running `cortex <command>` (e.g., `cortex search <query>`) executes the command in headless/plain-text mode without launching the Textual TUI.

## Architecture

```
cortex_cli:main()
├── argparse.ArgumentParser with subparsers: search, ai, index, status
│
├── _init_components()             ← shared initialization
│   └── returns (config, idx, agent)
│
├── _cli_search(args)             ← pure text output to stdout
│   └── reuses NotebookSearchCLI.format_results() logic
│
├── _cli_ai(args)                ← prints agent output to stdout
│
├── _cli_index(args)              ← prints progress to stdout
│
└── _cli_status(args)             ← prints status to stdout

When no subcommand is given → existing TUI launch path runs unchanged.
```

## Commands

### `cortex search <query>`

- Loads index via `_init_components()`
- Calls `idx.search(query)`
- Formats results using `NotebookSearchCLI.format_results()` (plain text, no Rich dependency)
- Prints to stdout, exits 0

### `cortex ai <message>`

- Loads index and initializes agent via `_init_components()`
- Runs `agent.run_query(message, [])`
- Captures stdout and prints to CLI stdout
- Exits 0 on success, 1 on error

### `cortex index [--force]`

- Loads index via `_init_components()`
- If `--force`: full rebuild, deletes existing index first
- Otherwise: incremental update
- Prints progress to stdout
- Exits 0 on success, 1 on error

### `cortex status`

- Loads index via `_init_components()`
- Prints same status info as TUI `/status` command
- Exits 0

## Output Strategy

The TUI's `render_search_results()` uses Rich `Text` objects. For CLI mode, reuse the plain-text rendering logic already in `NotebookSearchCLI.format_results()` which uses `print()` with ANSI `hl()` highlights. This keeps CLI output script- and pipe-friendly.

## Error Handling

- No index found: prompt user to build (`python -m cortex index`)
- Agent errors: print to stderr, exit code 1
- Invalid args: argparse error with usage hint

## Implementation Notes

- Extract shared initialization (config load, idx init, optional agent) into `_init_components()` to avoid duplicating logic between TUI and CLI paths
- CLI mode should NOT start the file watcher (no need for background monitoring in headless mode)
- Exit codes: 0 for success, 1 for errors, to be script-friendly
