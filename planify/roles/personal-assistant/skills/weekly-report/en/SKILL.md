---
name: weekly-report
description: "Use for a personal or project weekly report: distil progress, issues and next week's plan from the material, results first."
metadata:
  display_name: "Weekly report"
  params: "[{\"name\":\"materials\",\"description\":\"This week's notes, to-dos, commits, chat highlights…\"},{\"name\":\"audience\",\"description\":\"Manager, team, client\",\"default\":\"manager\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Weekly report

Materials: {materials}  Audience: {audience}

## Steps
1. Read everything and sort items into done, in progress, blocked and next week.
2. Write outcomes, not activity: "Shipped export in 3 formats" beats "worked on export".
3. Quantify where possible (items completed, metric changes), using numbers from the material only.
4. For blockers say where it is stuck, who needs to do what, and the latest date it must be resolved.
5. Tailor to the audience: highlights and needed support for a manager; detail and coordination for the team.
6. Keep it to one screen.

## Template
```
# Weekly report <date range>

## Highlights (1–3)
- …

## Done
- <item> — outcome / numbers

## In progress
- <item> — status — expected date

## Risks and support needed
- <issue> — need <who> to <do what> — by <date>

## Next week
- …
```
If this is needed every week, suggest the user turn it into a routine.

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
