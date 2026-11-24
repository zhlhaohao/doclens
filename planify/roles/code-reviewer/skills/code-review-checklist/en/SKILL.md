---
name: code-review-checklist
description: "Use when reviewing code changes: check correctness, security, maintainability, performance and tests, and label findings by severity."
metadata:
  display_name: "Code review checklist"
  params: "[{\"name\":\"scope\",\"description\":\"Branch, commit, files, or \\\"current uncommitted changes\\\"\",\"default\":\"current uncommitted changes\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Code review checklist

Scope: {scope}

## 1. Understand the change
- Read the diff (git diff / git show; execution follows current permissions; honor exclusions on new tests), then the callers and callees of changed functions.
- Write one or two sentences on what the change is meant to do; if you cannot tell, ask the author.

## 2. Check each area
**Correctness**
- Edge cases: null, empty lists, 0, negatives, huge values, duplicates, time zones, encodings.
- Error handling: are failure paths handled? Any swallowed errors (empty catch)?
- Concurrency: shared state, races, duplicate submits, transaction boundaries.
- Resources: files, connections, timers and listeners released.

**Security** (use the security-review skill for detail when input, permissions, secrets or command execution are involved)
- Is external input validated? Any string-built SQL / shell / HTML?
- Any secrets or personal data in logs or error messages?

**Maintainability**
- Clear names; functions not too long and focused; no duplicated logic.
- Comments explain why, not what.

**Performance**
- Queries or array lookups inside loops (O(n²)), reading whole tables, needless recomputation.

**Tests**
- Are key paths and the fixed bug covered? Do existing tests still pass?

## 3. Record and report

Record each finding with `review_finding` first (one call per finding, most serious first: `path` relative to the primary folder, `line` the line in the CURRENT changed content and omitted for whole-file issues; `severity` is security / bug / suggestion; `message` states the defect, the triggering input and the suggested fix). Then summarize in the reply; findings that exist only in the reply stay invisible to the UI and to delivery evidence.

Summary format:

```
**Purpose of change**: …
**Verdict**: ready to merge / fix and re-review / needs discussion

**Must fix**
1. file:line — problem — why — suggested fix

**Should fix**
1. …

**Optional**
1. …

**Done well**: a sentence or two
**Checked**: files read and checks run
```

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
