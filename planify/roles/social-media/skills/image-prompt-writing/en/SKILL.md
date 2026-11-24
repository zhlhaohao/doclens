---
name: image-prompt-writing
description: "Use when writing a scene description (prompt) for an image model: subject, setting, composition, light, style, colour and ratio, with a few directions."
metadata:
  display_name: "Image prompt writing"
  params: "[{\"name\":\"idea\",\"description\":\"The picture you want, even one sentence\"},{\"name\":\"ratio\",\"description\":\"e.g. 16:9, 1:1, 9:16\",\"default\":\"1:1\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Image prompt writing

Idea: {idea}  Ratio: {ratio}

## Structure (in this order, joined by commas or short phrases)
1. **Subject**: who or what, visual details, what it is doing
2. **Setting**: where, what is in the background
3. **Composition**: shot size (close-up / half body / wide), angle (eye level / high / low), subject position, empty space
4. **Light**: daylight / backlight / softbox / dusk / neon…
5. **Style and medium**: photo, flat illustration, 3D render, watercolour, pixel art… (see references/style-vocabulary.md)
6. **Colour**: main colours, palette, warm or cool
7. **Texture and detail**: materials, depth of field, grain
8. **Ratio**: {ratio}

## Directions
While the direction is open, offer 2–4 directions first, one line each: name + one-line scene + where it fits, and let the user choose.

## Tips
- Concrete beats abstract: "a ginger cat curled on a wooden windowsill in morning mist" beats "a cosy cat".
- One focal point per image; do not pile on elements.
- Write in-image text as: text reads "…"; keep it short and check spelling afterwards.
- Do not name real people, other brands' marks or copyrighted characters unless the user confirms they hold the rights.
- Skip empty boosters like "masterpiece, ultra HD, 8K"; they add little.
- Revise one or two things at a time and note what changed.

## Delivery format
```
Direction: …
Prompt: …
Ratio: …
Revision log: v N — what changed
```

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
