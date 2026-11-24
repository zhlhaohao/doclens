---
name: security-review
description: "Use when code handles user input, permissions, secrets, file paths, command execution or outbound requests: check for common security problems."
metadata:
  display_name: "Security review"
  params: "[{\"name\":\"scope\",\"description\":\"Files, module or change to review\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Security review

Scope: {scope}

This is a read-only review: put findings in your reply and do not edit files.

## Checks
1. **Injection**: are SQL, shell commands, HTML/templates, regexes or paths built from user input? Use parameters, allow-lists or escaping.
2. **Paths and files**: can a user-supplied path escape the allowed directory via `..`, absolute paths or symlinks? Are uploads checked for type and size?
3. **Authentication and authorisation**: does every operation check who the caller is and whether they may touch this record? Any checks done only in the frontend?
4. **Secrets**: any plaintext keys or tokens in code, config, logs, error messages or commit history? Are they read from environment variables or a secret store?
5. **Sensitive data**: is personal data or chat content written to logs or sent to third parties? Is it encrypted in transit and at rest?
6. **Outbound requests**: can they be steered at internal addresses (SSRF)? Are there timeouts and size limits? Is certificate checking disabled?
7. **Parsing untrusted data**: JSON / YAML / XML / zip from outside: are size and depth limited, and is path traversal blocked?
8. **Dependencies**: are new dependencies necessary, from trusted sources and pinned?
9. **Failure mode**: on error, does it deny by default rather than allow?
10. **Frontend**: any raw HTML rendering, eval, or links allowed with arbitrary protocols?

## Output
```
**Summary**: high N / medium N / low N
1. [High/Medium/Low] file:line — problem — how it could be abused — fix
**Not covered**: parts you could not check and why
```

Describe the risk and the fix; do not write ready-to-use exploit code.

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
