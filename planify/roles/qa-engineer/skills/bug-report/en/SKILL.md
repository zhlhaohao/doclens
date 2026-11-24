---
name: bug-report
description: "Use after finding or reproducing a problem: write a bug report anyone can reproduce from."
metadata:
  display_name: "Bug report"
  params: "[{\"name\":\"symptom\",\"description\":\"What you observed\"},{\"name\":\"environment\",\"description\":\"OS, version, browser, device and so on\",\"default\":\"fill in from the actual setup\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Bug report

Symptom: {symptom}
Environment: {environment}

## Steps
1. Reproduce it yourself at least once; if you cannot, say "could not reproduce" and list the conditions tried.
2. Cut the steps to the minimum, removing anything unrelated.
3. Collect evidence: exact error text, log excerpts (with secrets and personal data removed), a description of screenshots, the input that triggers it (made-up sample data).
4. Rate severity:
   - **Critical**: data loss or corruption, security issue, crash with no way to continue
   - **Major**: a main flow is broken with no workaround
   - **Minor**: wrong behaviour with a workaround
   - **Trivial**: wording, styling or polish
5. Note frequency: always / intermittent (M of N tries) / seen once.
6. State facts only; put guesses about the cause under Notes and label them as guesses.

## Template

```
**Title**: [Area] what goes wrong, under what condition
**Severity**: Critical / Major / Minor / Trivial
**Frequency**: always / intermittent (M/N) / once
**Environment**: OS, version, browser/device, relevant settings
**Preconditions**: account state, data setup, etc.

**Steps to reproduce**
1. …
2. …

**Expected**: …
**Actual**: …

**Evidence**: error text / logs / screenshot description
**Impact**: which users or features are affected
**Notes**: suspected cause, related issues (marked as guesses)
```

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
