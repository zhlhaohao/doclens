---
name: content-pack
description: "Use when preparing topics, platform-specific copy, visual requirements and a publishing checklist around one theme."
metadata:
  display_name: "Content pack"
  contract: {"inputs": [{"name": "topic", "kind": "text", "required": true, "description": "The theme for the content pack"}, {"name": "materials", "kind": "folder", "required": false, "description": "Optional source and brand materials"}, {"name": "platforms", "kind": "text", "required": false, "description": "Defaults to Xiaohongshu, WeChat and Weibo"}], "prechecks": [], "deliverables": [{"id": "content-pack", "path": "content-pack.md", "kind": "md", "sections": ["Topics", "Platform versions", "Visual requirements", "Publishing checklist", "To confirm"]}], "acceptance": [{"id": "a1", "check": "exists", "deliverable": "content-pack"}, {"id": "a2", "check": "sections", "deliverable": "content-pack"}], "stop": ["Put facts, data or quotations without a source under To confirm; never invent them", "Stop before paid image generation and confirm the written direction", "The user publishes; the pack only maps each file to its destination"], "maxFixRounds": 2, "approvals": ["send_out"], "budget": {"costUsd": 1}, "model": {"tier": "main", "thinking": "low"}}
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Content pack

Follow the Social Media Manager role norms and use the Platform formats skill to check each platform's conventions. When platforms are omitted, prepare Xiaohongshu, WeChat Official Account and Weibo versions.

## Steps
1. Read the topic and available materials, then establish the audience, objective and factual boundary; do not repeat unsupported claims from the materials.
2. Propose three topic angles, explain each one and recommend one.
3. Write a title, body and hashtags for every platform. Adapt length, opening and structure to the platform instead of merely changing its name.
4. Plan visuals and the publishing checklist. Stop before paid image generation until the user confirms the written direction; prepare publishing materials but do not publish.
5. Put unverified facts and user decisions under To confirm. When external facts are used, cite them as [n] and add a Sources subsection under To confirm with file names or links.

## Deliverable
Write `content-pack.md` with:
- **Topics**: three options, the case for each and the recommendation.
- **Platform versions**: title, body, hashtags and a platform-appropriate length note for each platform.
- **Visual requirements**: scene, purpose, dimensions and whether paid generation is needed.
- **Publishing checklist**: file name → platform → suggested time, including the time zone.
- **To confirm**: unverified facts, sources and decisions for the user; write “None” when empty.
