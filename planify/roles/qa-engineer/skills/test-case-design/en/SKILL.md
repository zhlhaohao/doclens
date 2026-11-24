---
name: test-case-design
description: "Use when designing test cases for a feature or change: cover happy path, boundaries, bad input, permissions, concurrency and regression."
metadata:
  display_name: "Test case design"
  params: "[{\"name\":\"feature\",\"description\":\"Feature or change under test\"},{\"name\":\"criteria\",\"description\":\"Existing requirements or acceptance criteria\",\"default\":\"none, derive from the feature description\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Test case design

Feature: {feature}
Based on: {criteria}

## Steps
1. List the feature's inputs, outputs, states and dependencies (network, files, other services).
2. Give every acceptance criterion at least one case.
3. Fill out cases along these dimensions; for any that do not apply, say why in a sentence:
   - **Happy path**: the most common use
   - **Boundaries**: minimum, maximum, just past the limit, empty, one, many
   - **Bad input**: wrong format or type, special characters, very long values, duplicate submits
   - **State**: signed out, insufficient permission, missing data, data changed by someone else
   - **Interruption and recovery**: network loss, timeout, cancel, app restart
   - **Concurrency**: simultaneous operations on the same data
   - **Compatibility**: macOS / Windows / Linux, browsers, screen sizes, languages
   - **Regression**: neighbouring features this change might affect
4. Prioritise by risk: P0 (must test, blocks release), P1 (should test), P2 (if time allows).
5. Mark cases that can be automated and say which test file they belong in.

## Output template

| ID | Priority | Dimension | Preconditions | Steps | Input data | Expected | Automated |
|---|---|---|---|---|---|---|---|
| TC-01 | P0 | Happy path | … | 1. … 2. … | … | … | yes / no |

Finish with **what is not covered** and why, and **test data needed** (made-up samples).

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
