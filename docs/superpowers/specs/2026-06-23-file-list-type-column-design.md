# File List Type Column & Type-Aware Icons — Design

> **For agentic workers:** This spec is the source of truth for implementing the
> "文件类型" column in the file-list pane and the corresponding type-aware icon
> rendering. Implementation must follow the design decisions and edge-case
> behavior documented below.

**Date:** 2026-06-23
**Status:** Approved (user explicitly chose to skip per-section confirmation and
proceed straight to writing-plans)

---

## 1. Goal & Motivation

The file-list pane (right side of `files-view`) currently shows six columns:
checkbox, generic icon (📁 / 📄), name, size, modified-time, indexed-badge.
Every file looks the same regardless of type — users can't tell `proposal.pdf`
from `slides.pptx` from `sales.xlsx` at a glance.

**Goals:**
1. Add a seventh column "类型" that shows the file extension (e.g., `xlsx`,
   `md`, `pdf`).
2. Replace the binary 📁/📄 icon with a type-aware variant: a small colored
   circular badge (VS Code Material Icon Theme style) for the 10 most common
   document types; fall back to 📄 for unknown types.
3. Keep the visual change small and familiar — no fancy SVG icons, no icon
   font dependency.

**Non-goals (out of scope for v1):**
- Sort by type column
- Filter by type
- Backend changes (no new `extension` field on `FileEntry`)
- Type-aware icons in `tree-node.ts` (left tree panel stays unchanged)

---

## 2. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Column content | Lowercase extension (e.g., `xlsx`, `md`) | User-confirmed; simple, transparent |
| Icon variant | Colored circular letter badge (10 known types) | Familiar from Office / VS Code Material Icon Theme |
| Icon for unknown types | Fall back to 📄 | Universal document emoji |
| Icon for directories | Keep 📁 (no badge) | Per user-confirmed scope (file-list only, tree unchanged) |
| Data source | Frontend-derived from `entry.name` | User-confirmed; no backend change |
| Directory row in type column | Shows "文件夹" | Per user decision |
| No-extension files in type column | Blank (empty string) | Per user decision |
| Mobile (≤1023px) | Hide the type column | Match search-results pattern; mobile is constrained |
| Code organization | New `src/utils/file-type.ts` module | User chose approach B; pure functions are independently testable |

---

## 3. File Changes

| Action | Path | Purpose |
|---|---|---|
| Create | `cortex/web_v2/frontend/src/utils/file-type.ts` | Pure-function helpers |
| Create | `cortex/web_v2/frontend/tests/utils/file-type.spec.ts` | Unit tests for helpers |
| Modify | `cortex/web_v2/frontend/src/components/file-row.ts` | Render badge + type cell |
| Modify | `cortex/web_v2/frontend/src/components/file-list.ts` | 7-column grid; mobile responsive |
| Modify | `cortex/web_v2/frontend/tests/components/file-row.spec.ts` | Tests for badge + type cell rendering |
| Modify | `cortex/web_v2/frontend/tests/components/file-list.spec.ts` | Tests for grid template + mobile breakpoint |
| Rebuild | `cortex/web_v2/static/index.html`, `cortex/web_v2/static/assets/*` | Vite build output (git-tracked) |

---

## 4. `src/utils/file-type.ts` API

```typescript
import type { FileEntry } from "../api/files";

/**
 * Display badge for a known file type.
 *  - `letter`: 1-character uppercase label shown inside the badge (e.g., "P")
 *  - `bg`:     CSS color string for the badge background
 *  - `fg`:     CSS color string for the letter foreground
 */
export interface FileTypeBadge {
  letter: string;
  bg: string;
  fg: string;
}

/**
 * Extract the file extension (without leading dot, lowercased).
 *
 *  - "report.xlsx"     → "xlsx"
 *  - "data.TAR.GZ"     → "gz"        // last extension only
 *  - "README"          → ""          // no extension
 *  - ".gitignore"      → ""          // hidden file → treat as no extension
 *  - "archive."        → ""          // trailing dot, empty after
 *  - ""                → ""
 */
export function getExtension(name: string): string;

/**
 * Return a badge for a known file type, or null if the type is not recognized
 * (or the entry is a directory).
 *
 *  - directory → null  (caller renders 📁)
 *  - "report.pdf" → { letter: "P", bg: "#DC2626", fg: "#FFFFFF" }
 *  - "script.py"  → null  (caller renders 📄)
 */
export function getFileTypeBadge(name: string, isDir: boolean): FileTypeBadge | null;

/**
 * Return the text shown in the "类型" column.
 *
 *  - directory                 → "文件夹"
 *  - "report.xlsx"             → "xlsx"
 *  - "README" (no extension)   → ""
 */
export function getTypeLabel(entry: FileEntry): string;
```

### 4.1 Known types table

```typescript
const KNOWN_TYPES: Record<string, FileTypeBadge> = {
  pdf:  { letter: "P", bg: "#DC2626", fg: "#FFFFFF" },  // red
  doc:  { letter: "D", bg: "#2563EB", fg: "#FFFFFF" },  // blue
  docx: { letter: "D", bg: "#2563EB", fg: "#FFFFFF" },
  xls:  { letter: "X", bg: "#16A34A", fg: "#FFFFFF" },  // green
  xlsx: { letter: "X", bg: "#16A34A", fg: "#FFFFFF" },
  csv:  { letter: "C", bg: "#16A34A", fg: "#FFFFFF" },
  ppt:  { letter: "P", bg: "#EA580C", fg: "#FFFFFF" },  // orange
  pptx: { letter: "P", bg: "#EA580C", fg: "#FFFFFF" },
  md:   { letter: "M", bg: "#6366F1", fg: "#FFFFFF" },  // indigo
  txt:  { letter: "T", bg: "#6B7280", fg: "#FFFFFF" },  // gray
};
```

### 4.2 `getExtension` implementation rules

Use this exact regex-based logic (or equivalent that produces the same outputs):

```typescript
export function getExtension(name: string): string {
  if (!name) return "";
  // Skip leading-dot files (e.g., ".gitignore" → no extension)
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return "";          // no dot, or dotfile
  if (lastDot === name.length - 1) return "";  // trailing dot, empty after
  return name.slice(lastDot + 1).toLowerCase();
}
```

Edge cases covered:

| Input | Output | Reason |
|---|---|---|
| `"report.xlsx"` | `"xlsx"` | Standard case |
| `"data.TAR.GZ"` | `"gz"` | Take last segment; lowercase |
| `"README"` | `""` | No dot |
| `".gitignore"` | `""` | Dotfile — `lastDot === 0` |
| `"archive."` | `""` | Trailing dot, nothing after |
| `""` | `""` | Empty input |
| `"photo.JPG"` | `"jpg"` | Lowercased |

---

## 5. UI Changes

### 5.1 `file-list.ts` — grid template

```typescript
static styles = css`
  /* ... existing styles ... */

  .file-grid {
    display: grid;
    align-items: center;
    gap: var(--cortex-space-2);
    /* checkbox | icon | name | size | time | indexed | type */
    grid-template-columns: 28px 28px 1fr 80px 140px 70px 80px;
    padding: 8px 12px;
  }
  .file-grid.header { font-weight: 600; color: var(--cortex-text-subtle); }

  @media (max-width: 1023px) {
    .file-grid {
      /* checkbox | icon | name | size | time | indexed */
      grid-template-columns: 28px 28px 1fr 80px 140px 70px;
    }
    .cell-type { display: none; }
  }
`;
```

The header row's `<div class="file-grid header">` adds:
```html
<div class="cell cell-type">类型</div>
```

### 5.2 `file-row.ts` — render

```typescript
import { getExtension, getFileTypeBadge, getTypeLabel } from "../utils/file-type";

render() {
  const badge = getFileTypeBadge(this.entry.name, this.entry.is_dir);
  return html`
    <div class="file-grid row" @click=${this._onClick}>
      <div class="cell cell-check">
        <input type="checkbox"
          .checked=${this.selected}
          @click=${this._onCheckClick} />
      </div>
      <div class="cell cell-icon">
        ${this.entry.is_dir
          ? "📁"
          : badge
            ? html`<span class="type-badge"
                style="background:${badge.bg};color:${badge.fg}">${badge.letter}</span>`
            : "📄"}
      </div>
      <div class="cell cell-name">${this.entry.name}</div>
      <div class="cell cell-size">${this._formatSize()}</div>
      <div class="cell cell-time">${this._formatTime()}</div>
      <div class="cell cell-indexed">
        ${this.entry.indexed
          ? html`<sl-tag size="small" variant="primary">已索引</sl-tag>`
          : ""}
      </div>
      <div class="cell cell-type">${getTypeLabel(this.entry)}</div>
    </div>
  `;
}
```

### 5.3 Badge CSS (in `file-row.ts` styles)

```css
.type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  user-select: none;
  font-family: var(--cortex-font-sans);
}
```

---

## 6. Test Plan

### 6.1 `tests/utils/file-type.spec.ts` — pure-function tests

Required cases for `getExtension`:

- `"report.xlsx"` → `"xlsx"`
- `"data.TAR.GZ"` → `"gz"`
- `"README"` → `""`
- `".gitignore"` → `""`
- `"archive."` → `""`
- `""` → `""`
- `"photo.JPG"` → `"jpg"`

Required cases for `getFileTypeBadge`:

- `("report.pdf", false)` → red P badge
- `("notes.docx", false)` → blue D badge
- `("sales.xlsx", false)` → green X badge
- `("slides.pptx", false)` → orange P badge
- `("readme.md", false)` → indigo M badge
- `("notes.txt", false)` → gray T badge
- `("archive.zip", false)` → null
- `("script.py", false)` → null
- `("photo.jpg", false)` → null
- `("any", true)` → null (directory → no badge)

Required cases for `getTypeLabel`:

- `{ is_dir: true, name: "docs" }` → `"文件夹"`
- `{ is_dir: false, name: "sales.xlsx" }` → `"xlsx"`
- `{ is_dir: false, name: "README" }` → `""`
- `{ is_dir: false, name: ".gitignore" }` → `""`

### 6.2 `tests/components/file-row.spec.ts` — component tests

- Directory row: renders 📁, type cell = `"文件夹"`, no `.type-badge` element
- `proposal.pdf`: renders badge with text "P" and red background, type cell = `"pdf"`
- `sales.xlsx`: badge with "X" green, type cell = `"xlsx"`
- `readme.md`: badge with "M" indigo, type cell = `"md"`
- `notes.txt`: badge with "T" gray, type cell = `"txt"`
- `archive.zip`: no badge (📄 emoji), type cell = `"zip"`
- `README` (no extension): no badge (📄 emoji), type cell = `""`
- The badge's computed style includes the expected `background-color` and `color`

### 6.3 `tests/components/file-list.spec.ts` — grid template

- Desktop (default jsdom): `.file-grid` `grid-template-columns` includes 7 columns
- Mobile (mock `window.matchMedia('(max-width: 1023px)')` to match):
  `.cell-type` has `display: none` (or is hidden via the matching rule)

### 6.4 Manual smoke test

After implementation, rebuild and verify in browser:
1. Open files view, navigate to a directory with mixed types
2. Confirm PDF/DOC/XLS/MD/TXT rows show their distinct colored badges
3. Confirm ZIP/PY/JPG/etc. rows show 📄
4. Confirm directory rows show 📁 and "文件夹" in type column
5. Confirm README / .gitignore show no badge and blank type cell
6. Resize browser to < 1024px: type column disappears

---

## 7. Out of Scope (v1)

- **Sort by type**: Clicking the type column header does nothing in v1. Could be added later.
- **Filter by type**: No type-filter UI. Already implicit via the existing search/filter mechanism.
- **Backend `extension` field**: `FileEntry` stays as-is. The frontend derives extension from `name`.
- **`tree-node.ts` icons**: Stays at 📁/📄 for now. The user explicitly scoped this change to file-list only.
- **Click-to-rename on type cell**: No interaction in v1.

---

## 8. Build & Deploy Notes

After implementation, the frontend must be rebuilt so the git-tracked
`cortex/web_v2/static/` artifacts include the new code:

```bash
cd cortex/web_v2/frontend && npm run build
```

This regenerates `static/index.html` and `static/assets/index.*.js` / `*.css`
with new content hashes. The service worker caches these by URL, so the
new bundle will be picked up automatically on next page load.

No backend changes, no migration, no API contract changes.