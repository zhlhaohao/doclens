---
name: copy-framework
description: "Use for marketing copy, product descriptions, ads and headlines: settle audience and goal, then write 2–3 angles with a framework and several headlines."
metadata:
  display_name: "Copy framework"
  params: "[{\"name\":\"subject\",\"description\":\"Product, campaign or topic\"},{\"name\":\"audience\",\"description\":\"Who it is for\",\"default\":\"ask the user\"},{\"name\":\"channel\",\"description\":\"Where it runs and how long\",\"default\":\"ask the user\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Copy framework

Subject: {subject}  Audience: {audience}  Channel and length: {channel}

## 1. Fill in the brief (ask about anything unclear)
```
Who the audience is and what they care about:
The one action we want after reading:
Key selling points (max 3, each with a fact or number):
Tone: expert / friendly / playful / understated …
Must include / must avoid:
```

## 2. Pick a framework (one per version)
- **Problem → solution → proof → action**: for products that fix a clear problem.
- **Scene → tension → turn → action**: for stories and lifestyle content.
- **Result first → how → why believe it → action**: when there is a strong number.
- **Contrast**: before / after, them / us (compare facts; never disparage a named brand).

## 3. Write
- Follow the requested version count; when unspecified and comparison is useful, offer a few angles with their framework and use.
- Follow the requested headline count; choose number, question, benefit, curiosity, or direct alternatives when useful.
- Use concrete facts and scenes instead of adjectives; one idea per sentence.
- No absolute claims ("best", "#1", "100%"); never invent data or testimonials.

## 4. Delivery format
```
## Headline options
1. …
## Version A (framework: …, best for: …)
Body…
Words: N
## Version B …
## Notes
- Facts the user should confirm: …
```

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
