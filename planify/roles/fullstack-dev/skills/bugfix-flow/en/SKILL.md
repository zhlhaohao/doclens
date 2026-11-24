---
name: bugfix-flow
description: "Use when fixing a bug: reproduce it, find the root cause, make the smallest fix, then verify and report."
metadata:
  display_name: "Bugfix flow"
  params: "[{\"name\":\"issue\",\"description\":\"What the user sees, as specific as possible\"},{\"name\":\"clues\",\"description\":\"Page, actions, input, logs and so on\",\"default\":\"none\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Bugfix flow

Issue: {issue}
Clues: {clues}

## 1. Understand the symptom
- Restate it in your own words: under what conditions, what was done, what happened, what should have happened.
- If key facts are missing (version, platform, input data, exact error text), ask the user, at most the 2–3 most important questions.

## 2. Reproduce
- Find the shortest reproduction; if it can be a command or a test, write it down (execution follows current permissions; honor exclusions on new tests).
- If you cannot reproduce it, say what you tried, list likely differences in conditions and ask for more detail. Do not change code on a guess.

## 3. Find the root cause
- Start from the error location or symptom and follow the call chain; confirm each hypothesis with logs, a breakpoint or a minimal experiment.
- Separate cause from symptom: swallowing the error or adding a null check to dodge it is usually not a fix.
- Search for the same pattern elsewhere; list other occurrences but do not fix them in passing.

## 4. Fix
- Make the smallest, most direct change; no refactoring or unrelated reformatting in the same change.
- Explain wider impact and proceed within existing authorization; ask only about critical missing requirements or actions beyond that authority.

## 5. Verify
- Run the reproduction from step 2 again and confirm the bug is gone.
- Run the project's existing type check, lint and relevant tests; check that nearby features still work.

## 6. Report (reply in this format)

```
**Issue**: one sentence
**Root cause**: why it happened (point to file and line)
**Change**: files touched and what changed in each
**Verification**: reproduction result + checks run and their results
**Open items**: similar risks, cases not covered ("none" if none)
```

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
