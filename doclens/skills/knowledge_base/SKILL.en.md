---
name: knowledge-base
description: Knowledge-base search and document retrieval skill. Any question about knowledge-base content must load this skill first to get the retrieval strategy (multi-query / grep fallback), citation rules (## 参考资料), and deep-read tool usage. Also supports scoped Q&A over user-selected files/directories (paths-locked scope). Load via load_skill("knowledge-base").
icon: search
---

# Knowledge Base Skill

## Tools

- **search_kb**: FTS5 full-text search over document snippets (natural-language keywords, automatic CJK/EN tokenization). Returns XML (`<meta>` with path/hierarchy + `<content>`). **Any result used in an answer must be cited.** Optional `paths` narrows scope: an array of relative directories (e.g. `"tech"`) or relative file paths (e.g. `"tech/quantum.md"`).
- **grep**: Regex search over file contents (includes unindexed files). Use when `search_kb` returns nothing or exact matching is needed (code / regex patterns). Result `<path>` values feed directly into `read_document`. Optional `paths` same as search_kb.
- **file_info**: Single-file overview (size / total words / section count / section list / mtime); **does not return body text**. **Always call it before `read_document`**: gauge file size and pick a section or word range instead of blind-reading and wasting tokens.
- **read_document**: Read full/partial document content (md/pdf/docx/pptx/xlsx/html/code etc.). **Any result used in an answer must be cited.**
- **manage_kb**: Index management (`reindex` rebuild / `stats` statistics). reindex is only for suspected index corruption or right after corpus updates — it is NOT a routine retry tactic.

## ⚠️ Answer Rules (Highest Priority)

Whenever you answer the user after calling `search_kb` / `read_document` / `grep`, the answer **must include both**:

1. **Inline markers**: insert `[N]` at citation points (e.g. `[1]`, `[1][2]`), right after the statement, before punctuation.
2. **Trailing citation section**: append `## 参考资料`, entries numbered `1.` `2.` (**do not use `[N]` as list prefix**), each entry containing **only the document path relative to workdir** (e.g. `生命科学/xxx.md`).
   - **Format constraints**: paths must NOT be markdown links `[text](url)`, must NOT be `file://` absolute URLs, must not contain `<hierarchy>` or line numbers. Violations → the user clicks and "cannot open" the file.
   - From `search_kb`/`grep` take the `<path>`; from `read_document` take the path after the `文档:` line. List each document only once, in order.
   - **Only cite `<result>` entries that actually sourced the answer**: cite the `<path>` of whichever hit provided the data/conclusion; do NOT list irrelevant hits (better too few than too many). Every key claim in the body must be traceable to a cited document.

Using the tools above without a `## 参考资料` section = non-compliant; complete it before output. Procedural replies (reindex/stats notices) are exempt.

**Pre-answer checklist**: used tools? body has `[N]`? trailing `## 参考资料` with pure relative paths? each document listed only once?

**Example**:
```
Quantum computing uses qubits for information processing [1][2].

## 参考资料
1. 量子计算导论/第一章.md
2. 量子计算导论/第二章.md
```

## Machine-Parsing Contract (System-Enforced)

The system **machine-parses** the `## 参考资料` section and **validates that paths exist**; non-compliant answers fall back to tool-retrieved results with a user warning (no re-answer). Strictly follow:

1. The section heading must be exactly `## 参考资料` (two #, one space, these exact four characters — do NOT translate it)
2. Each line: `number. path` (e.g. `1. 量子计算/第一章.md`), one dot and one space after the number
3. Path = pure relative path; no `[t](u)` / `file://` / line number `:N` / `<...>`
4. After using `search_kb`/`grep`/`read_document` this section is mandatory; paths must actually exist

## Scoped Mode (when the message contains a「文件：」list)

When the user selects files/directories from the file list and invokes this skill, the message carries a「文件：」section (relative paths; **files and directories may be mixed**). The Q&A scope is then **locked to that list**:

1. **Searches must carry `paths`**: `search_kb` / `grep` calls must pass `paths=[the list verbatim]` (both directory and file entries are valid) and search only within it.
2. **Concrete files in the list**: may be deep-read directly via `file_info` → `read_document`.
3. **Directories in the list**: directories cannot be `read_document` — first `search_kb(query, paths=["that directory"])` to locate documents inside, then `file_info` / `read_document` on hits.
4. Citation rules unchanged (`## 参考资料`, paths still relative to workdir).
5. If the answer is not in the list, say "所选范围内未找到相关内容" — do NOT answer from outside the list (unless the user later explicitly widens the scope).

## Search Strategy (Plan First, Search with a Budget)

### Step 1: Query planning (complete BEFORE calling tools)

`search_kb` is FTS5 **exact keyword matching**, NOT semantic search — a single query easily misses. BEFORE searching, generate 3~6 mutually independent queries covering different angles:
- Core entities / proper nouns (person names, product names, project codenames, file names)
- Synonym / near-synonym substitution
- Hypernym/hyponym expansion (e.g. "chronic disease" → "diabetes" "hypertension")
- Domain terminology / jargon
- Chinese ↔ English switching
- Splitting long sentences into short keyword combos

**HyDE for semantic questions (powerful)**: when the question is conceptual/scenario-based and direct keywords feel guessy, first **mentally draft a hypothetical answer passage** (2-4 sentences as the ideal document would state it, using plausible domain terms, metric names, system names), then extract keywords from THAT passage as search queries. A hypothetical answer shares far more vocabulary with the real document than the question does — this converts semantic intent into keyword space.

### Step 2: Parallel batch retrieval

**Issue all independent `search_kb` calls in parallel within the same turn** (they don't depend on each other; local FTS is fast). Deduplicate and merge results across queries.

### Step 3: Broad to narrow, deep-read on hit

On hits: `file_info` for the overview (size / section list) → `read_document` for key sections (`section="Chapter 3 Methods"` returns that section and its children; or `start_word/end_word` by word index, e.g. `start_word=100, end_word=300`).
On no hits: fall back to `grep` (exact strings / regex); on hits, likewise `file_info` → `read_document`.

### Retrieval Budget & Stop-Loss (Mandatory)

- **Budget**: if `search_kb` + `grep` together have run about **6 rounds** with no useful result → **STOP searching and answer honestly that the content was not found in the knowledge base**; you may state in one sentence which angles were tried; do NOT fabricate content.
- **Stop on convergence**: once the hits sufficiently support an answer, answer immediately. Do not chase "perfect" results or run confirmatory repeat searches.
- **No reworded repeats**: every new query round must introduce a **new angle** (new entity / new language / new word forms); re-issuing semantically identical near-synonym queries counts against the budget.
- **reindex is not a retry tactic**: only use `manage_kb(action='reindex')` when index corruption is suspected or the corpus was just updated, at most once per Q&A.

`search_kb` examples: `search_kb(query="machine learning deep learning", max_results=10)`; scoped: `search_kb(query="machine learning", paths=["tech", "programming/ai.md"])`

## Multi-Format Reading

- Binary formats (PDF/DOCX/PPTX/XLSX etc.) **must use `read_document`** (not `read_file`)
- `section` locates by heading (nested structures extracted whole); `start_word/end_word` reads by word index (1-based inclusive; **CJK characters count one word each**, English/numbers split on whitespace; output marks current word position and total; when truncated, continue from the indicated start_word)

## Boundaries (Mandatory)

**Internal knowledge-base Q&A only**. **Forbidden**: `Task` subagents (lose context + carry external tools), `webfetch` / web search / `bash` networking. Answer locally using only the 5 tools above. When nothing is found, follow「Retrieval Budget & Stop-Loss」and honestly tell the user it was not found (no infinite retries, reindex is not the default move); **never turn to external search**.
