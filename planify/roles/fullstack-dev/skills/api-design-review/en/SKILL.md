---
name: api-design-review
description: "Use when adding or changing an HTTP / RPC API: check naming, validation, errors, pagination, compatibility and security."
metadata:
  display_name: "API design review"
  params: "[{\"name\":\"endpoint\",\"description\":\"Endpoint path or name, or the related files\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# API design review

Endpoint: {endpoint}

## 1. Write down the contract first
Use this format, then review against it:

```
METHOD path / name:
Purpose: one sentence
Request: field | type | required | meaning | allowed values
Response: field | type | meaning
Errors: code | when it happens | what the caller should do
```

## 2. Check each item
- **Naming**: consistent with the project's existing APIs (paths, casing, plurals).
- **Input validation**: types, lengths, ranges and enums validated at the boundary; unknown fields rejected or explicitly ignored.
- **Errors**: expected failures have clear codes and messages; internal exceptions, stack traces and SQL never reach the caller.
- **Lists**: always paginated (cursor or limit + cursor) with a maximum; stable ordering.
- **Idempotency and concurrency**: what happens on a duplicate submit or concurrent edits to the same resource? Add an idempotency key or version when needed.
- **Timeouts and cancellation**: long operations have timeouts and can be cancelled.
- **Authorisation**: who may call it, and can they only touch data they own (check ownership, not just sign-in)?
- **Data**: parameterised queries; transactions for multi-step writes; indexes for common filters.
- **Compatibility**: when changing an existing API, do old callers break? Are new fields optional?
- **Sensitive data**: no passwords, tokens or full ID numbers in responses or logs.

## 3. Output
```
**Contract**: (the table above)
**Findings**:
1. [Must fix / Should fix] problem — reason — suggestion
**Compatibility impact**: …
```

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
