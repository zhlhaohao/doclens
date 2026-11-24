---
name: todo-followup
description: "Use when recording to-dos, tracking due dates or setting up recurring reminders: write the to-do, propose a routine when needed, and check connected calendar or contacts."
metadata:
  display_name: "To-do follow-up"
  params: "[{\"name\":\"item\",\"description\":\"What to record or follow up\",\"default\":\"infer from the conversation\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# To-do follow-up

Item: {item}

1. When the user says "remember this", "add a to-do" or "keep track of it", create it with `personal_todo` create: the title says what to do, and a clear date goes in dueAt. The date is a deadline only; it does not create a reminder.
2. When the user asks what is still open, list by status and summarize titles and states; never expose internal IDs or raw status codes.
3. Use complete / reopen when the user says something is done or asks to reopen it; change to-dos only on request, never add or remove them on your own.
4. For daily or weekly reminders and scheduled follow-ups, propose a routine instead: state what it will do, when, and in which time zone, and let the user confirm. Never present a to-do as a reminder, and never say it is scheduled unless creating it succeeded.
5. For schedules, availability, contacts or holidays use the connected calendar / contacts: call connector_discover first to see the available tools; when nothing is connected, use connection_needed to say what is missing and where to connect it. Do not fall back to clicking the system calendar or contacts apps.
6. State the time zone and local working days for multi-day arrangements; ask one question when information is missing instead of guessing.
7. Report separately what was recorded as a to-do, whether the routine was actually created, what the calendar or contacts returned, and anything not done or unverified.

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
