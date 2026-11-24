---
name: research-report
description: "Use when researching a topic and writing it up: split the question, find sources, separate fact from inference, cite every conclusion with confidence."
metadata:
  contract: {"inputs": [], "deliverables": [{"id": "report", "path": "report.md", "kind": "md", "sections": ["Key findings", "Questions", "Sources"]}], "acceptance": [{"id": "exists", "check": "exists", "deliverable": "report"}, {"id": "sections", "check": "sections", "deliverable": "report"}, {"id": "source-count", "check": "minCitations", "min": 3, "deliverable": "report"}, {"id": "sourced", "check": "sectionsSourced", "deliverable": "report"}], "maxFixRounds": 2}
  display_name: "Research report"
  params: "[{\"name\":\"question\",\"description\":\"What you need to find out\"},{\"name\":\"purpose\",\"description\":\"Who reads it and what decision it informs\",\"default\":\"help the user decide\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Research report

Question: {question}
Purpose: {purpose}

## Steps
1. **Split** the question into 3–6 sub-questions and say which to tackle first and why.
2. **Find sources**, preferring primary ones (official, raw data, papers, announcements) and noting dates; web access follows current permissions and approval outcomes. Take notes with the source-notes skill.
3. **Cross-check** key facts with two independent sources where possible; when sources conflict, list both.
4. **Synthesise** an answer per sub-question, labelling fact / inference / opinion.
5. **Conclude** against the purpose, with confidence levels and recommendations.
6. **Limitations**: what you could not find, what may be outdated, where samples are thin.

## Template

```
# <Research topic>
Date: …  Scope: …

## Key conclusions (3–5)
1. <Conclusion> [source no.] — confidence: high / medium / low

## Sub-questions
### 1. <Sub-question>
- Facts: … [1][2]
- Inference: … (because …)
- Other views: …

## Recommendations

## Limitations and gaps

## Sources
[1] Author / organisation. "Title". Published date. Link or reference. Date viewed
```

## Report types (add when doing industry research or writing / reading equity research)

**Industry research** (any industry):
- First list the industry's own key metrics, then look for data: e.g. same-store growth and sales per square metre for retail, ARR and net retention for SaaS, capacity utilisation and gross margin for manufacturing, pipeline stages and approvals for pharma; state why when unsure.
- Always cover: market size (definition, year, growth; total vs addressable), the value chain upstream to downstream and where profit sits, competitive landscape (main players, shares or concentration), drivers and constraints, policy and regulation, technology and business-model shifts.
- Prefer statistics bureaus, regulators, industry associations, annual reports and prospectuses; name the firm and definition for consultancy figures, and show them side by side when firms disagree widely.

**Writing an equity report** (industry or company), on top of the template:
- Open with 3–5 key views, each with its key figure and confidence.
- An earnings forecast table: revenue, net profit attributable, EPS and growth, 2 actual years plus 3 forecast years, marking which numbers are your assumptions and which come from consensus.
- Valuation: method (PE / PB / EV/EBITDA / DCF), key parameters and a comparables table, with the data cut-off date below it.
- A separate risk section with at least 3 specific risks that would break the conclusion.
- End with "Compiled by an AI assistant for research reference only; not investment advice", and give no buy or sell instruction.

**Reading equity reports** (summarising or comparing others' reports):
- For each report extract firm, author, date, rating, target price, core assumptions, key forecasts and main risks; mark anything absent as "not stated" and never fill it in.
- Put several reports in one comparison table, flag differences in rating, target price and assumptions, and say which assumption drives each difference.
- Mark forecasts older than 6 months, or predating newer financials, as "possibly stale"; check key facts against company filings and mark those you cannot as "report only".

## Rules
- Never invent sources, numbers or links; write "not found" instead.
- Keep quotes short and attributed.
- Writes follow current permissions and approval outcomes; save and name the report by the delivery rules in your norms.

## Word reports, templates and revisions
1. When Word is requested, use office_create for real heading levels, paragraphs, tables, captions and sources, with headers/footers, page numbers and a TOC field when needed (note that it must update on opening). Renaming an extension is not conversion. Retain the existing Markdown contract deliverable; resolve explicit user formats and paths through the current effective contract.
2. Templates: when office_template_fields / office_template_fill are available, use them to fill fields; otherwise locate placeholders and table ranges with office_inspect and replace them with office_edit. Check split-run fields and repeated table rows, retaining styles and headers/footers without guessing values.
3. Read the latest revision, structure and bookmarks before editing Word and checkpoint first. When tracked changes are requested, write real revisions (author Pi Bot · current Bot name) and comments and replace by bookmark. Accept or reject only requested revisions; do not clear all changes automatically.
4. Use office_validate for headings, headers and relationships, and office_render for layout when needed. Report unverified items and unsupported tools instead of rebuilding an external document and claiming fidelity.
5. For group slides, hand conclusions, source mappings and open questions to the presentation designer.
