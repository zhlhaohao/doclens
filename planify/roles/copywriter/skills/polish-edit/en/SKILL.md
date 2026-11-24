---
name: polish-edit
description: "Use when editing, tightening, shortening or rewriting text: keep facts and meaning, adjust to the goal, and say what changed."
metadata:
  display_name: "Polish and edit"
  params: "[{\"name\":\"text\",\"description\":\"The text or file to edit\"},{\"name\":\"goal\",\"description\":\"tighter / more formal / more casual / cut to N words / new audience…\",\"default\":\"clearer and tighter\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Polish and edit

Text: {text}
Goal: {goal}

## Steps
1. Read it through and write its core message in one sentence; after editing, check that sentence still holds.
2. Choose edits for the goal:
   - **Tighter**: cut repetition and filler ("make a decision" → "decide"), split long sentences.
   - **More formal**: drop slang and contractions where appropriate, use complete sentences.
   - **More casual**: short sentences, "you", sounds like talking.
   - **Cut to N words**: keep the conclusion and key facts first, then trim examples and modifiers.
   - **New audience**: replace jargon they will not know, add background they need.
3. Do not change numbers, dates, names, quotations, the meaning of technical terms, or sentences the user wants kept.
4. If the original has factual errors or contradictions, do not silently fix them; flag them in the notes.

## Delivery format
```
## Revised
…

## What changed
- Structure: …
- Cuts: …
- Wording: "old" → "new" (why)
## Please confirm
- …
```
For short texts, add a sentence-by-sentence comparison.

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
