---
name: platform-formats
description: "Use when preparing content for a social or publishing platform: adapt titles, length, layout, hashtags, visuals and timing to its habits."
metadata:
  display_name: "Platform formats"
  params: "[{\"name\":\"platform\",\"description\":\"X, LinkedIn, Instagram, TikTok, YouTube, Xiaohongshu, WeChat, Weibo, Bilibili…\"},{\"name\":\"content\",\"description\":\"The topic or draft to publish\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Platform formats

Platform: {platform}  Content: {content}

## Steps
1. Find the platform notes below; for platforms not listed, ask the user about its usual format.
2. When moving content across platforms, rewrite the opening and structure, not just the length.
3. For each post deliver: title (3 options), body, hashtags, visual brief, suggested time, caveats.
4. Platform rules change; character limits and policies are whatever the platform says today. When unsure, ask the user to check.

## Platform notes (rules of thumb)
- **X**: short, one idea per post; key information first; 1–2 hashtags; split longer pieces into a thread.
- **LinkedIn**: professional but human; the first line must earn the "see more" click; short paragraphs; 3–5 hashtags.
- **Instagram**: image first (1:1, 4:5 or 9:16); the first line of the caption matters most; hashtags at the end.
- **TikTok / Reels / Shorts**: write a vertical short-video script (the storyboard skill helps); the first 3 seconds decide; caption of 1–2 lines plus 2–5 hashtags.
- **YouTube**: title and thumbnail say exactly what the video delivers; description with chapter timestamps.
- **Xiaohongshu**: short titles with a concrete benefit or number; casual, friend-to-friend body in short paragraphs; 3:4 vertical cover; 3–8 topic tags.
- **WeChat Official Account**: informative, non-clickbait title; first three lines say why it is worth reading; subheadings and short paragraphs; one clear action at the end.
- **Weibo**: like X, short and punchy, 1–2 topics.
- **Bilibili**: longer video, title and cover state the content; chapter timestamps in the description; a lighter, playful tone works.

## Common rules
- Nothing exaggerated or misleading; label ads and partnerships as the platform requires.
- No reposting others' content; check licences for images and music.
- Drafts only; the user publishes.

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
