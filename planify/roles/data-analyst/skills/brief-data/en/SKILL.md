---
name: brief-data
description: "Use to prepare data for a periodic brief: align definitions, summarize tables, and record items left out."
metadata:
  display_name: "Brief data"
  pibot-verified: "2026-10-23 · 真实资料两期 / two real periods"
  contract: {"inputs": [{"name": "material", "kind": "folder", "required": true}, {"name": "definitions", "kind": "text", "required": false}], "deliverables": [{"id": "data", "path": "data.md", "kind": "md", "sections": ["Definitions", "Data tables", "Left out"]}], "acceptance": [{"id": "d1", "check": "exists", "deliverable": "data"}, {"id": "d2", "check": "sections", "deliverable": "data"}, {"id": "columns", "check": "tableColumns", "columns": ["Metric", "Value", "Source"], "deliverable": "data"}], "stop": ["When definitions are unclear, state the definitions used and why; do not stop"], "maxFixRounds": 2, "budget": {"costUsd": 0.3}, "model": {"tier": "cheap", "thinking": "low"}}
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Brief data

## Steps
1. Find the tables and numbers in the material (csv / xlsx / numbers in text), and use csv-profile first to inspect the structure.
2. Align definitions (time range, units, and deduplication rules), summarize the data in tables, and cite the source file for each row.
3. Put anything that cannot or should not be calculated under "Left out" and explain why.

## Deliverable
`data.md` with sections: Definitions, Data tables, Left out.
