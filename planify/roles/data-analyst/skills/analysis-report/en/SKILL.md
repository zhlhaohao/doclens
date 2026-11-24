---
name: analysis-report
description: "Use when writing up a data analysis: conclusion first, then evidence, with definitions, method, limitations and recommendations."
metadata:
  contract: {"inputs": [], "deliverables": [{"id": "report", "path": "report.md", "kind": "md", "sections": ["Key findings", "Data and method"]}, {"id": "document", "path": "report.docx", "kind": "docx", "sections": ["Key findings", "Data and method"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "report"}, {"id": "sections", "check": "sections", "deliverable": "report"}, {"id": "chart", "check": "hasChart", "deliverable": "report"}, {"id": "docx-exists", "check": "exists", "deliverable": "document"}, {"id": "docx-sections", "check": "sections", "deliverable": "document"}, {"id": "docx-chart", "check": "hasChart", "deliverable": "document"}], "maxFixRounds": 2}
  display_name: "Analysis report"
  params: "[{\"name\":\"question\",\"description\":\"The business question to answer\"},{\"name\":\"audience\",\"description\":\"Executives, business team, engineers…\",\"default\":\"a business owner\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Analysis report

Question: {question}  Audience: {audience}

## Steps
1. Rephrase the question so data can answer it, and define the metrics.
2. Record the method: data used, time range, filters, calculations.
3. Only report numbers you actually computed; mark the rest "to compute".
4. Back each conclusion with evidence (a number, table or chart) and a confidence level.
5. For non-technical readers, move the method to an appendix and keep the body to findings and what they mean.

## Template

```
# <Title that states the conclusion>

## Bottom line

## Key findings
1. <Finding> — evidence: … — confidence: high / medium / low
2. …

## Recommendations
| Recommendation | Based on | Expected effect | Priority |

## Data and method
- Sources and time range: …
- Metric definitions: …
- Filters and cleaning: …
- Method: …
- Reproduce: where the scripts / queries are and how to run them

## Limitations and risks
- Sample, data quality, correlation vs causation…

## Questions to test next
```

## Financial and industry data (add when using filings, equity research or industry statistics)
- Align financial data on period (annual / quarterly / trailing twelve months), currency and unit, and note whether it is audited or restated.
- When taking figures from equity or industry reports, record firm, report date and page for every number; show several firms' values for the same metric side by side, and average them only when the user asks for consensus.
- Keep forecasts and actuals in separate columns, mark forecast columns with "E" (e.g. 2026E), and write the formula for derived metrics such as growth rates and margins.
- Note the definition and coverage of industry statistics, and never compare figures with different definitions in one column.

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.

## Program delivery contract
Write `report.md` in the artifact folder using the contract sections. Number the Sources entries and cite files actually read or URLs fetched in this run. Follow the contract table headers and chart requirements; analysis reports include a real local image reference.

## Charts and Word delivery
Use run_command to generate a local PNG from actual data and hand over its file reference: draw it directly when a Python interpreter and plotting library (such as matplotlib) are available; if not, report the missing chart and the blocker honestly, and never invent data or images. Do not use paid image generation. Use office_create to deliver the contracted `report.docx` with real headings. An image paragraph is `{type:"paragraph",text:"Figure 1: title; source and definitions",image:{path:"actual-chart.png",width:640,height:360}}`. The path must be readable in this run, not a web URL. A path or Markdown image text alone cannot pass DOCX hasChart. Image documents currently support creation only; revisions require a newly created document.
