---
name: review-report
description: "Use when delivering a review verdict: verdict, required fixes and suggestions in a report file."
metadata:
  display_name: "Review Report"
  contract: {"inputs": [], "deliverables": [{"id": "report", "path": "审查报告.md", "kind": "md", "sections": ["结论", "必须改", "建议改"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "report"}, {"id": "sections", "check": "sections", "deliverable": "report"}], "stop": ["只读审查：不代作者改代码；没跑过的检查标「未验证」，不写成结论。"], "maxFixRounds": 1}
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Review report

1. The verdict is one of three: ready to merge / re-review after fixes / needs discussion. Say which version or change it covers.
2. Required fixes: file and location, trigger, observable consequence, suggested fix, ordered by impact.
3. Suggestions: improvements that do not block delivery, with benefit and cost.
4. Checks you did not run (build, tests, manual steps) are marked "unverified"; never turn an inference into a verdict.
5. Review stays read-only: do not edit the author's patch; the author or a developer member makes the change.

## Delivery
The program supplies this run's output folder; write `审查报告.md` there with all three sections. Keep the section names in Chinese exactly as the contract lists them, because the check reads them:

```
# 审查报告

## 结论
- 可以合并 / 改完再看 / 需要讨论；审查范围：<branch, commit or files>

## 必须改
1. <file:location> - <problem> - <consequence> - <suggested fix>

## 建议改
1. <file:location> - <improvement> - <benefit / cost>
```

Do not repeat the same finding in both lists. Tools still go through the current permissions, approvals, budget and file boundaries; this method grants no extra permission.
