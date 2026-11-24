---
name: chart-guidelines
description: "Use when making or checking charts, formatting Excel reports, filling templates or preserving existing workbooks; check definitions, formula caches and native objects."
metadata:
  display_name: "Chart guidelines"
  params: "[{\"name\":\"message\",\"description\":\"What the reader should see in this chart\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# Chart guidelines

Message: {message}

## 1. Choose by relationship
| To show | Use | Avoid |
|---|---|---|
| Change over time | Line chart | Many bars for continuous time |
| Comparing categories | Bar chart (horizontal for long labels), sorted by value | 3D bars |
| Share of a whole (≤ 5 parts) | Stacked bar or pie | Pies with more than 5 slices |
| Distribution | Histogram, box plot | An average alone |
| Relationship of two variables | Scatter plot | Dual-axis line charts (easily misread) |
| One key number | A big number + comparison (vs last period / last year) | A chart with a single value |

## 2. Always include
- A title that states the finding ("Conversion recovered to 4.2% in March"), not just "Conversion trend".
- Axis names and units; the time grain (day / week / month).
- Data source and time range (small print under the chart).
- Bar chart value axes start at 0.

## 3. Colour
- Use colour only to highlight: the key series in an accent colour, the rest in grey.
- Keep one colour per category throughout a report.
- Do not rely on colour alone (colour-blind readers); add labels or line styles, and make sure it reads on light and dark backgrounds.

## 4. Less is more
- Remove needless gridlines, borders, shadows and legends (label lines directly when possible).
- One message per chart; with more than 5–6 series, split the chart or keep only the key ones.

## 5. Hand-off
For each chart, state its finding, data source and how it was produced (tool artifact or script location).

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.

## Excel formatting, templates and preserving edits
1. Read tables, ranges, defined names, formulas and existing charts with office_inspect / office_read. Keep values separate from display: apply percentage, thousands, currency and date formats instead of converting numbers to strings; keep decimals consistent within a column and show percentages to one decimal by default.
2. Freeze headers, write units in header cells, and set widths, alignment and conditional formats by unit. Use validation for input, separate raw data from calculations, keep one table per sheet and never merge cells. Prefer native editable charts referencing actual ranges, with titles, axes, units, legends and sources; save each chart's underlying data as CSV or a sheet and note the source, update time and filters under the table.
3. Templates: when office_template_fields / office_template_fill are available, use them to fill fields; otherwise locate placeholders, formula cells and table ranges with office_inspect and replace them with office_edit. After inserting rows, check relative formulas, table ranges, names and styles. Label unsupported evaluation for Excel to calculate on opening; retain formula safety restrictions.
4. Checkpoint and bind the latest revision before editing an existing XLSX. Change only requested ranges and charts, retaining unrelated sheets, formulas, pivots and validations. Report unsupported edits rather than rebuilding and claiming preservation.
5. Use office_validate and check cached values against recalculation. Verify complex charts and pivots in Excel; unverified is not passed. Hand checked data and definitions to the presentation designer for group slides.
