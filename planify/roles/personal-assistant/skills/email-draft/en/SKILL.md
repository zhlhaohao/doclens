---
name: email-draft
description: "Use when writing an email: clear purpose and recipient, one topic per email, draft for the user to approve; sending needs approval."
metadata:
  display_name: "Email draft"
  params: "[{\"name\":\"recipient\",\"description\":\"Who it is for and their relationship to the user\"},{\"name\":\"purpose\",\"description\":\"What the email should achieve\"},{\"name\":\"points\",\"description\":\"Things that must be mentioned\",\"default\":\"none\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Email draft

Recipient: {recipient}
Purpose: {purpose}
Points: {points}

## Steps
1. Settle the tone: formal / friendly / brief; colleague, client, candidate or stranger.
2. Subject line states the topic and the action needed, e.g. "Please confirm: 12 March release plan (reply by Thursday)".
3. Body:
   - Opening: why you are writing and what you need from them.
   - Middle: necessary background and details, as a list.
   - Close: a clear next step, deadline and how to reach you.
4. Check recipient and salutation, that dates match weekdays, time zones, and that mentioned attachments and links are included.
5. Never include passwords, verification codes, full ID numbers or similar.
6. Deliver a draft by default. Actual sending requires user authorization and current permissions; do not repeatedly ask for authority already given.

## Template
```
Subject: <topic>: <action needed> (<deadline>)

Hi <name>,

<One sentence on why you are writing and what you are asking.>

<Background / details>
- …
- …

<Next step: please <do what> by <date>.>

<Sign-off>
```
Add a shorter version for chat when useful.

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
