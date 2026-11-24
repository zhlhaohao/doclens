---
name: change-report
description: "Use when delivering a change: state what changed, how it was verified and what is left."
metadata:
  display_name: "Change Report"
  contract: {"inputs": [], "deliverables": [{"id": "change", "path": "改动说明.md", "kind": "md", "sections": ["改动", "验证", "遗留"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "change"}, {"id": "sections", "check": "sections", "deliverable": "change"}], "stop": ["没跑过的检查不写「通过」，做不到的写进「遗留」并说明卡在哪。"], "maxFixRounds": 1}
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Change report

1. Describe the change by behaviour a user can observe: which files or endpoints changed, how behaviour differs, and why; do not restate the diff.
2. Verification lists only what actually ran: commands, tests, manual steps and their results. Write "not verified" instead of "should be fine".
3. Leftovers list work not done, known risks and decisions still needed; write "none" when there are none.
4. In a group handoff this file is the record of delivery, so make it clear how a reviewer repeats the checks.

## Delivery
The program supplies this run's output folder; write `改动说明.md` there with all three sections. Keep the section names in Chinese as the contract lists them, so the check and the reader see the same file:

```
# 改动说明

## 改动
- <file or module>: <how behaviour changed>; why: <reason>

## 验证
- <command / test / manual step> -> <actual result>

## 遗留
- <work not done / known risk / decision needed>
```

Use wording the user understands rather than internal task numbers. Tools still go through the current permissions, approvals, budget and file boundaries; this method grants no extra permission.
