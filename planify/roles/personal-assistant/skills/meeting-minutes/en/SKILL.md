---
name: meeting-minutes
description: "Use when turning meeting notes, transcripts or chat into minutes: decisions, action items with owner and due date, open questions."
metadata:
  display_name: "Meeting minutes"
  params: "[{\"name\":\"materials\",\"description\":\"Notes, transcript or chat content\"},{\"name\":\"meeting\",\"description\":\"Meeting title\",\"default\":\"infer from the material\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Meeting minutes

Meeting: {meeting}
Materials: {materials}

## Steps
1. Read everything and find what was decided, who does what, and what is still open.
2. Every action item needs an owner and a due date; where the material has none, mark "TBD" rather than assigning someone.
3. Record conclusions and key reasons, not a blow-by-blow of the discussion.
4. Where people disagreed, note the positions and how it was settled (or that it was not).
5. Use names as they appear in the material; leave out private details unrelated to the meeting.
6. Prepare a draft for attendees; actual sending follows user authorization and current permissions. Do not claim delivery before it occurs.

## Template
```
# <Meeting> minutes
Date: …  Attendees: …  Notes by: …

## Decisions
1. …

## Action items
| Item | Owner | Due | Notes |
|---|---|---|---|

## Open questions
- <question> — <who> decides by <when>

## Discussion highlights (optional)
- …

## Next meeting
Date / topics
```

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
