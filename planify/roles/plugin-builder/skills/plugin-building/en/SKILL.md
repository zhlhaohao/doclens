---
name: plugin-building
description: "Build and locally test a Pi Bot connection plugin with the bundled SDK."
metadata:
  display_name: "Build a plugin"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

Clarify target and effects; default to read-only, confirm writes and disable irreversible actions.
1. Create a dedicated directory inside the current workplace. Copy template/ from this skill into it. Never develop inside the skill directory.
2. Read sdk/README.md and the packed SDK declarations. Install sdk/pibot-plugin-sdk.tgz using npm install --offline --ignore-scripts --no-audit --no-fund. Do not substitute a registry package. If an offline dependency is missing, report it; do not claim offline installation succeeded.
3. Implement tools with @pibot/plugin-sdk using the documented createStdioServer API. Validate inputs, classify read-only/write/destructive behavior, use bounded results, AbortSignal and timeouts. stdout is MCP only; diagnostics go to stderr without credentials or file content.
4. Set `.claude-plugin/plugin.json` name/version/description and `pibotApp: true`; this is a Pi Bot application plugin, not a skill package or ordinary MCP import. If a secret or API key is needed, never collect it in chat, plugin_install config, source, `.env`, command arguments, logs, or the package; direct the user to Connections → Access tokens and use the existing token/secret channel. Use `.mcp.json` only as the application's runtime adapter with minimal network domains and portable relative paths using ${CLAUDE_PLUGIN_ROOT}; do not deliver standalone skills/.
   Follow Pi Bot UI style: simple and restrained, paired Chinese and English, consistent in light and dark themes; use human-readable labels and help text, bilingual enum options, conditional visibility for mutually exclusive settings, and never expose internal environment variable names as user copy.
5. Start the stdio server locally with a bounded MCP client; initialize, tools/list and tools/call a harmless read-only tool. Close transport and child on success, failure, timeout and cancellation. Check input errors; do not call writes/destructive tools to test real accounts. If the read-only tool needs an external API, first verify that `.mcp.json` and `pibot.json` declare the narrow network domain. A command sandbox without that domain is not evidence of a plugin bug: do not treat `ENOTFOUND`, proxy denial, or DNS failure as a code failure, and do not disable isolation just to test it.
6. Keep dependencies portable in the plugin package; no symlinks, absolute development paths, secrets or unrelated files. Re-run plugin-review after changes.
7. Call plugin_install with the plugin folder path and only nonsensitive config. Test the external API through the installed connector sandbox, using the plugin's declared network domain. If the current test environment lacks that network permission, finish the protocol-level self-test, install the plugin, and report “real network call not verified”; never present a test-environment network failure as an installation failure or switch to an outside-sandbox run to bypass it. A successful result is the installation receipt; if unavailable or rejected, report that result instead of bypassing checks. Updating uses the same tool.
8. If the result is needs_setup, tell the user to open Connections → Access tokens to create or select the token, then complete this plugin's existing settings form. Never ask for a key in chat. Deliver name, version, domains and actual self-test/install status.
