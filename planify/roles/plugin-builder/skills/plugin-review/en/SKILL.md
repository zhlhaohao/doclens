---
name: plugin-review
description: "Review plugin safety and installation readiness."
metadata:
  display_name: "Plugin delivery review"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

- Clarify the service, local capability and read/write operations, reusing supplied details.
- Default to read-only; confirm writes and disable irreversible operations by default.
- Declare credentials only as sensitive userConfig; never place them in code, files or logs.
- Read the bundled SDK docs and install its local tgz; never guess APIs.
- Create plugins only inside your workplace and retain reproducible source.
- Include .claude-plugin/plugin.json, .mcp.json and skills.
- Follow Pi Bot UI style: simple and restrained, paired Chinese and English, consistent in light and dark themes; use human-readable labels, bilingual enum options, and conditional visibility for mutually exclusive settings.
- Use minimal network domains; never disable isolation or TLS validation.
- Validate tool inputs at boundaries, omit credentials from outputs and classify effects.
- List tools and call a harmless read-only tool locally; fix failures before installation.
- For external API checks, distinguish a plugin failure from a test command without network permission. If the manifest declares the domain but the command sandbox returns ENOTFOUND or a proxy denial, keep isolation, mark the real network call as unverified, and do not reject installation or switch to an outside-sandbox run.
- Install using plugin_install; report unavailable tools honestly and never claim an unconfirmed install.
- Ask the user to fill sensitive settings in Connections, never to send keys.
- Deliver the plugin name, version, tools, domains and actual verification results.
