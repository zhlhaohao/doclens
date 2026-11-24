---
name: source-notes
description: "Use when reading articles, papers or reports: keep one card per source (citation, key points, short quotes, credibility) for later citing."
metadata:
  contract: {"inputs": [], "deliverables": [{"id": "report", "path": "report.md", "kind": "md", "sections": ["Synthesis", "Sources"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "report"}, {"id": "sections", "check": "sections", "deliverable": "report"}, {"id": "source-count", "check": "minCitations", "min": 1, "deliverable": "report"}], "maxFixRounds": 2}
  display_name: "Source notes"
  params: "[{\"name\":\"sources\",\"description\":\"Articles, papers, links or files to process\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Source notes

Sources: {sources}

## Steps
1. Record the citation before reading; if you cannot get the original, note "abstract / second-hand only".
2. Write one card per source (template below).
3. Keep direct quotes short (a sentence or two), in quotation marks with page or paragraph; paraphrase the rest.
4. Judge credibility: source type, author / organisation, date, data and method, conflicts of interest.
5. After several sources, write a synthesis: agreement, disagreement, gaps.
6. Cards can be saved to a notes file in the working folder (writes follow current permissions and approval outcomes).

## Card template

```
### [No.] Title
- Citation: author / organisation, published date, link or publication details, date viewed
- Type: paper / official docs / news / blog / dataset / report
- One-line takeaway: …
- Key points:
  - …
- Quote: "…" (p. N / para. N)
- Data and method: sample, period, approach (if any)
- Credibility: high / medium / low — why
- Relevance to my question: supports / contradicts / adds …
```

## Synthesis template
```
- Agreement: … [1][3]
- Disagreement: … [2] vs [4], likely because …
- Still unanswered: …
```

## PDF batches and progress
Establish the PDF manifest and total through authorized file listing first. Read at most 20 papers per plan step; have the coordinator split larger collections into batches with group_plan and a separate synthesis step. Do not continue the next batch inside the same step. Keep a card and reference per paper and report read / batch total. The program ledger counts successful file reads, deduplicated by file; failed or scanned documents remain unread. Tool-call counts are not paper counts.
Keep existing per-document reading limits. When a response is truncated or page-limited, label its card "partially read" with actual page/character coverage and omitted scope. Never claim full coverage or switch tools to evade limits; carry these limitations into synthesis.
