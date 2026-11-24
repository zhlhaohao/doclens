---
name: csv-profile
description: "Use on a new CSV / spreadsheet: run the bundled script to see rows, columns, missing values, duplicates and value ranges before analysing."
metadata:
  display_name: "CSV profile"
  params: "[{\"name\":\"file\",\"description\":\"Path to the CSV file; Excel files are fine, read them with office_read\"}]"
---
> **Environment note (planify port)**: Pi Bot-specific tools mentioned below are **not available** here:
> `office_*` (Office document tools), `review_finding`, `ask_bot` / `assign_task` (group collaboration).
> Instead: write **Markdown** with `write_file` (if the user insists on Word/PPT, say so plainly—never rename
> the extension to fake it); put review findings in your reply using the summary format below; ignore
> "group" / "hand to the presentation designer" sentences—you are an independent Bot assigned by a DAG;
> write deliverables to the output directory named in your assignment. "Pi Bot" refers to this system.
> The `contract` deliverables/acceptance are consumed by the dispatching program; just produce what it names.

# CSV profile

Data: {file}

## Steps
1. Make sure the file is in the working folder. Read Excel files (xlsx / xls) with `office_read` and say which sheet you read; ask the user to save as CSV only when you need the script's full statistics.
2. Run the bundled script (read-only: it does not change data or use the network). Commands follow current permissions and approval outcomes:
   - macOS / Linux: `python3 "<this skill's folder>/scripts/profile_csv.py" "{file}"`
   - Windows: `python "<this skill's folder>\scripts\profile_csv.py" "{file}"`
   - For other delimiters add `--delimiter ";"` (tab: `--delimiter tab`); for garbled Chinese text add `--encoding gb18030`.
3. If Python is not installed or the user declines: read the first 50 and last 20 lines and give the same profile by hand, saying it is a sample.
4. Write a data quality summary:
   - Columns with many missing values (> 20%) or entirely empty
   - Fully duplicated rows
   - Rows with the wrong number of columns (often delimiter or quoting issues)
   - Columns with suspicious types (text in numeric columns, mixed date formats)
   - Obvious outliers (negative amounts, future dates)
5. Propose next steps: whether to clean, the cleaning rules (written to a new file, never the original), and which questions the data can answer.

## Output
```
**Profile**: (table from the script)
**Quality issues**: 1. … 2. …
**Impact on analysis**: …
**Suggested cleaning rules**: …
**Questions it can answer**: …
```

## Scope

Use supplied information first; user requirements on count, format, and scope override this default template. Current capabilities govern permissions, primary/read-only workplaces, Plan mode, and budget; do not switch tools to bypass a refusal. This skill supplies a method, not authority to write, run commands, pay, send, commit, or publish. Identify unperformed or unverified steps.
