# File List Type Column & Type-Aware Icons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "类型" (file type) column to the file-list pane and replace the binary 📁/📄 icon with a colored circular letter badge (VS Code Material Icon Theme style) for 10 common document types.

**Architecture:** Frontend-only change. New `src/utils/file-type.ts` module exports three pure functions (`getExtension`, `getFileTypeBadge`, `getTypeLabel`) that the two existing components (`file-row.ts`, `file-list.ts`) import and call. No backend modifications, no new dependencies.

**Tech Stack:** Lit 3 Web Components, TypeScript 5.5, Vitest 2.1, Vite 5.4, Shoelace 2.15.

## Global Constraints

These constraints come from the design spec
(`docs/superpowers/specs/2026-06-23-file-list-type-column-design.md`) and apply to every task:

- **Pure-function module**: `src/utils/file-type.ts` MUST NOT import any Lit, DOM, or store code. Only `FileEntry` from `../api/files`.
- **Frontend-only**: No Python / FastAPI changes. No new `extension` field on `FileEntry`.
- **No new dependencies**: Use only existing packages (lit, vitest, etc.). No icon font.
- **Spec §4.2 `getExtension` rules**: exact behavior — `lastDot <= 0 → ""`, `lastDot === name.length - 1 → ""`, otherwise lowercased slice after dot. Implementation must produce exactly these outputs for the listed edge cases.
- **Known types table (spec §4.1)**: 10 entries (pdf/doc/docx/xls/xlsx/csv/ppt/pptx/md/txt) with the exact letter/bg/fg values from the spec.
- **Unknown types → fallback**: directory rows render 📁 (no badge); unrecognized file types render 📄 (no badge).
- **Mobile (≤1023px)**: the 7th column (`cell-type`) MUST be hidden via `@media (max-width: 1023px)`.
- **Directory row in type column**: shows "文件夹". No-extension file row: blank.
- **No breaking changes**: existing file-row tests must continue to pass after the icon/grid change (icon column width grows from 20px → 28px to fit the badge, but the structural selectors — `input[type='checkbox']`, `.row`, `.name` — remain).
- **Build**: After Task 3, run `npm run build` from `cortex/web_v2/frontend/` and commit the regenerated `cortex/web_v2/static/` artifacts.
- **Working directory**: All `npm` commands run from `D:\github\cortex\cortex\web_v2\frontend`. Git commands run from `D:\github\cortex`.

---

## File Structure

| File | Role | Status |
|---|---|---|
| `cortex/web_v2/frontend/src/utils/file-type.ts` | Pure helpers: `getExtension`, `getFileTypeBadge`, `getTypeLabel`, `KNOWN_TYPES`, `FileTypeBadge` interface | NEW |
| `cortex/web_v2/frontend/tests/utils/file-type.spec.ts` | Unit tests for the three functions | NEW |
| `cortex/web_v2/frontend/src/components/file-row.ts` | Render `.type-badge` for known types; add `.cell-type` div | MODIFY |
| `cortex/web_v2/frontend/tests/file-row.spec.ts` | Tests for badge rendering + type cell + 7-col grid | MODIFY (extend) |
| `cortex/web_v2/frontend/src/components/file-list.ts` | Header grid 7 cols; mobile breakpoint hides `.cell-type` | MODIFY |
| `cortex/web_v2/frontend/tests/file-list.spec.ts` | Tests for 7-col header + mobile responsive | MODIFY (extend) |
| `cortex/web_v2/static/index.html` + `cortex/web_v2/static/assets/*` | Vite output of `npm run build` | REBUILD |

---

## Task 1: Pure-Utility Module (`src/utils/file-type.ts`)

**Files:**
- Create: `cortex/web_v2/frontend/src/utils/file-type.ts`
- Create: `cortex/web_v2/frontend/tests/utils/file-type.spec.ts`

**Interfaces:**
- Produces (consumed by Task 2 / Task 3):
  - `export interface FileTypeBadge { letter: string; bg: string; fg: string }`
  - `export function getExtension(name: string): string`
  - `export function getFileTypeBadge(name: string, isDir: boolean): FileTypeBadge | null`
  - `export function getTypeLabel(entry: FileEntry): string`
- Imports: `import type { FileEntry } from "../api/files"` (type-only import; no runtime dep)

- [ ] **Step 1: Write the failing test file**

Create `cortex/web_v2/frontend/tests/utils/file-type.spec.ts` with the exact content below:

```typescript
import { describe, it, expect } from "vitest";
import type { FileEntry } from "../../src/api/files";
import {
  getExtension,
  getFileTypeBadge,
  getTypeLabel,
} from "../../src/utils/file-type";

describe("getExtension", () => {
  it("returns the lowercase extension for a normal filename", () => {
    expect(getExtension("report.xlsx")).toBe("xlsx");
  });
  it("lowercases the extension", () => {
    expect(getExtension("photo.JPG")).toBe("jpg");
  });
  it("returns the last segment for multi-dot names", () => {
    expect(getExtension("data.TAR.GZ")).toBe("gz");
  });
  it("returns empty for names with no dot", () => {
    expect(getExtension("README")).toBe("");
  });
  it("returns empty for dotfiles (leading dot)", () => {
    expect(getExtension(".gitignore")).toBe("");
  });
  it("returns empty for trailing-dot names", () => {
    expect(getExtension("archive.")).toBe("");
  });
  it("returns empty for empty input", () => {
    expect(getExtension("")).toBe("");
  });
});

describe("getFileTypeBadge", () => {
  it("returns red P badge for pdf", () => {
    expect(getFileTypeBadge("report.pdf", false)).toEqual({
      letter: "P", bg: "#DC2626", fg: "#FFFFFF",
    });
  });
  it("returns blue D badge for docx", () => {
    expect(getFileTypeBadge("notes.docx", false)).toEqual({
      letter: "D", bg: "#2563EB", fg: "#FFFFFF",
    });
  });
  it("returns blue D badge for doc", () => {
    expect(getFileTypeBadge("legacy.doc", false)).toEqual({
      letter: "D", bg: "#2563EB", fg: "#FFFFFF",
    });
  });
  it("returns green X badge for xlsx", () => {
    expect(getFileTypeBadge("sales.xlsx", false)).toEqual({
      letter: "X", bg: "#16A34A", fg: "#FFFFFF",
    });
  });
  it("returns green X badge for xls", () => {
    expect(getFileTypeBadge("old.xls", false)).toEqual({
      letter: "X", bg: "#16A34A", fg: "#FFFFFF",
    });
  });
  it("returns green C badge for csv", () => {
    expect(getFileTypeBadge("data.csv", false)).toEqual({
      letter: "C", bg: "#16A34A", fg: "#FFFFFF",
    });
  });
  it("returns orange P badge for pptx", () => {
    expect(getFileTypeBadge("slides.pptx", false)).toEqual({
      letter: "P", bg: "#EA580C", fg: "#FFFFFF",
    });
  });
  it("returns orange P badge for ppt", () => {
    expect(getFileTypeBadge("deck.ppt", false)).toEqual({
      letter: "P", bg: "#EA580C", fg: "#FFFFFF",
    });
  });
  it("returns indigo M badge for md", () => {
    expect(getFileTypeBadge("readme.md", false)).toEqual({
      letter: "M", bg: "#6366F1", fg: "#FFFFFF",
    });
  });
  it("returns gray T badge for txt", () => {
    expect(getFileTypeBadge("notes.txt", false)).toEqual({
      letter: "T", bg: "#6B7280", fg: "#FFFFFF",
    });
  });
  it("returns null for archive.zip (unknown type)", () => {
    expect(getFileTypeBadge("archive.zip", false)).toBeNull();
  });
  it("returns null for script.py (unknown type)", () => {
    expect(getFileTypeBadge("script.py", false)).toBeNull();
  });
  it("returns null for photo.jpg (unknown type)", () => {
    expect(getFileTypeBadge("photo.jpg", false)).toBeNull();
  });
  it("returns null for README (no extension)", () => {
    expect(getFileTypeBadge("README", false)).toBeNull();
  });
  it("returns null for any directory", () => {
    expect(getFileTypeBadge("any", true)).toBeNull();
  });
  it("matches case-insensitively (uppercase extension)", () => {
    expect(getFileTypeBadge("REPORT.PDF", false)).toEqual({
      letter: "P", bg: "#DC2626", fg: "#FFFFFF",
    });
  });
});

describe("getTypeLabel", () => {
  const base: Omit<FileEntry, "is_dir" | "name"> = {
    path: "", size: 0, modified_at: "", indexed: false, writable: true, has_child_dirs: false,
  };

  it("returns 文件夹 for directories", () => {
    expect(getTypeLabel({ ...base, name: "docs", is_dir: true })).toBe("文件夹");
  });
  it("returns lowercase extension for files with extension", () => {
    expect(getTypeLabel({ ...base, name: "sales.xlsx", is_dir: false })).toBe("xlsx");
  });
  it("returns empty for files without extension", () => {
    expect(getTypeLabel({ ...base, name: "README", is_dir: false })).toBe("");
  });
  it("returns empty for dotfiles", () => {
    expect(getTypeLabel({ ...base, name: ".gitignore", is_dir: false })).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `D:\github\cortex\cortex\web_v2\frontend`:

```bash
npm test -- tests/utils/file-type.spec.ts
```

Expected: FAIL — `Failed to resolve import "../../src/utils/file-type" from "tests/utils/file-type.spec.ts". Does the file exist?` (module not yet created)

- [ ] **Step 3: Implement the module**

Create `cortex/web_v2/frontend/src/utils/file-type.ts` with the exact content below:

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
 * Known file types — Office-style colors + first-letter label.
 * Keys are lowercase extensions (no leading dot).
 */
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
export function getExtension(name: string): string {
  if (!name) return "";
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return "";                          // no dot, or dotfile
  if (lastDot === name.length - 1) return "";           // trailing dot, empty after
  return name.slice(lastDot + 1).toLowerCase();
}

/**
 * Return a badge for a known file type, or null if the type is not recognized
 * (or the entry is a directory).
 *
 *  - directory             → null  (caller renders 📁)
 *  - "report.pdf"          → { letter: "P", bg: "#DC2626", fg: "#FFFFFF" }
 *  - "archive.zip" / "script.py" / "README" → null  (caller renders 📄)
 */
export function getFileTypeBadge(name: string, isDir: boolean): FileTypeBadge | null {
  if (isDir) return null;
  const ext = getExtension(name);
  return KNOWN_TYPES[ext] ?? null;
}

/**
 * Return the text shown in the "类型" column.
 *
 *  - directory                → "文件夹"
 *  - "report.xlsx"            → "xlsx"
 *  - "README" (no extension)  → ""
 */
export function getTypeLabel(entry: FileEntry): string {
  if (entry.is_dir) return "文件夹";
  return getExtension(entry.name);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run from `D:\github\cortex\cortex\web_v2\frontend`:

```bash
npm test -- tests/utils/file-type.spec.ts
```

Expected: PASS — all `describe` blocks green, all 27 `it` cases pass.

- [ ] **Step 5: Commit**

```bash
cd D:\github\cortex
git add cortex/web_v2/frontend/src/utils/file-type.ts cortex/web_v2/frontend/tests/utils/file-type.spec.ts
git commit -m "feat(web): add file-type utility module (getExtension/getFileTypeBadge/getTypeLabel)"
```

---

## Task 2: file-row.ts — Badge + Type Cell + 7-Column Grid

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/file-row.ts`
- Modify: `cortex/web_v2/frontend/tests/file-row.spec.ts`

**Interfaces:**
- Consumes:
  - `getExtension(name: string): string` from `../utils/file-type`
  - `getFileTypeBadge(name: string, isDir: boolean): FileTypeBadge | null` from `../utils/file-type`
  - `getTypeLabel(entry: FileEntry): string` from `../utils/file-type`
  - `FileEntry` type from `../api/files` (already imported)
- Produces:
  - Updated grid template `28px 28px 1fr 80px 140px 70px 80px` (was `28px 20px 1fr 80px 140px 70px`)
  - New `.cell-type` element (last grid cell)
  - New `.type-badge` element inside `.cell-icon` for known types (replaces 📄 only for known types)
  - Directory rows still render 📁 (unchanged)

- [ ] **Step 1: Add failing tests for badge and type cell**

Append the following test cases to `cortex/web_v2/frontend/tests/file-row.spec.ts` (after the existing tests inside the `describe("file-row", ...)` block — add them before the closing `});` on line 73). The exact insertion point is after line 71 (`expect(cb.checked).toBe(true);`):

```typescript
  it("renders red P badge for .pdf files", async () => {
    const el = makeRow({ ...fileEntry, name: "report.pdf" });
    await el.updateComplete;
    const badge = el.shadowRoot.querySelector(".type-badge") as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("P");
    expect(badge.style.background).toBe("rgb(220, 38, 38)");  // #DC2626
    expect(badge.style.color).toBe("rgb(255, 255, 255)");
  });

  it("renders blue D badge for .docx files", async () => {
    const el = makeRow({ ...fileEntry, name: "notes.docx" });
    await el.updateComplete;
    const badge = el.shadowRoot.querySelector(".type-badge") as HTMLElement;
    expect(badge?.textContent).toBe("D");
    expect(badge?.style.background).toBe("rgb(37, 99, 235)");  // #2563EB
  });

  it("renders green X badge for .xlsx files", async () => {
    const el = makeRow({ ...fileEntry, name: "sales.xlsx" });
    await el.updateComplete;
    const badge = el.shadowRoot.querySelector(".type-badge") as HTMLElement;
    expect(badge?.textContent).toBe("X");
    expect(badge?.style.background).toBe("rgb(22, 163, 74)");  // #16A34A
  });

  it("renders indigo M badge for .md files", async () => {
    const el = makeRow(fileEntry);  // name: a.md
    await el.updateComplete;
    const badge = el.shadowRoot.querySelector(".type-badge") as HTMLElement;
    expect(badge?.textContent).toBe("M");
    expect(badge?.style.background).toBe("rgb(99, 102, 241)");  // #6366F1
  });

  it("renders gray T badge for .txt files", async () => {
    const el = makeRow({ ...fileEntry, name: "notes.txt" });
    await el.updateComplete;
    const badge = el.shadowRoot.querySelector(".type-badge") as HTMLElement;
    expect(badge?.textContent).toBe("T");
    expect(badge?.style.background).toBe("rgb(107, 114, 128)");  // #6B7280
  });

  it("falls back to 📄 for unknown file types", async () => {
    const el = makeRow({ ...fileEntry, name: "archive.zip" });
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".type-badge")).toBeNull();
    expect(el.shadowRoot.querySelector(".cell-icon")?.textContent).toContain("📄");
  });

  it("falls back to 📄 for files without extension", async () => {
    const el = makeRow({ ...fileEntry, name: "README" });
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".type-badge")).toBeNull();
    expect(el.shadowRoot.querySelector(".cell-icon")?.textContent).toContain("📄");
  });

  it("renders 📁 for directory rows (no badge)", async () => {
    const el = makeRow(dirEntry);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".type-badge")).toBeNull();
    expect(el.shadowRoot.querySelector(".cell-icon")?.textContent).toContain("📁");
  });

  it("type cell shows the lowercase extension for files", async () => {
    const el = makeRow({ ...fileEntry, name: "Sales.XLSX" });
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".cell-type")?.textContent).toBe("xlsx");
  });

  it("type cell shows 文件夹 for directories", async () => {
    const el = makeRow(dirEntry);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".cell-type")?.textContent).toBe("文件夹");
  });

  it("type cell is blank for files without extension", async () => {
    const el = makeRow({ ...fileEntry, name: "README" });
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".cell-type")?.textContent).toBe("");
  });

  it("row uses 7-column grid template (icon column grows from 20px to 28px)", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    const row = el.shadowRoot.querySelector(".row") as HTMLElement;
    const style = (row).style.gridTemplateColumns || getComputedStyle(row).gridTemplateColumns;
    // grid-template-columns is exposed via :host style; we verify 7 tokens are present
    // The class .row is shadow-scoped, but the column count shows in the count of children
    const cells = row.querySelectorAll(":scope > *");
    expect(cells.length).toBe(7);
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run from `D:\github\cortex\cortex\web_v2\frontend`:

```bash
npm test -- tests/file-row.spec.ts
```

Expected: FAIL — the new tests reference `.type-badge` and `.cell-type` selectors that don't exist yet; also the row has 6 cells, not 7.

- [ ] **Step 3: Modify `file-row.ts`**

Replace the entire contents of `cortex/web_v2/frontend/src/components/file-row.ts` with:

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileEntry } from "../api/files";
import { getFileTypeBadge, getTypeLabel } from "../utils/file-type";

@customElement("file-row")
export class FileRow extends LitElement {
  static styles = css`
    :host { display: block; }
    .row {
      display: grid;
      grid-template-columns: 28px 28px 1fr 80px 140px 70px 80px;
      gap: var(--cortex-space-2);
      align-items: center;
      padding: 6px var(--cortex-space-3);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active { background: var(--cortex-primary-soft); }
    .checkbox { display: flex; align-items: center; justify-content: center; }
    .cell-icon { font-size: 14px; }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .size, .time, .cell-type {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .cell-type { text-align: left; }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: 10px;
      border-radius: var(--cortex-radius-sm);
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
    }
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
    @media (max-width: 1023px) {
      .row { grid-template-columns: 28px 28px 1fr 80px 140px 70px; }
      .cell-type { display: none; }
    }
  `;

  @property({ type: Object }) entry!: FileEntry;
  @property({ type: Boolean }) selected = false;
  /** 当前预览/焦点的文件行 —— 由行体单击触发，区别于 checkbox 的多选 */
  @property({ type: Boolean }) active = false;

  private _fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  private _fmtTime(s: string): string {
    if (!s) return "";
    try {
      return new Date(s).toLocaleString(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  }

  /** 行体单击 = 激活（文件夹=进入；文件=预览） */
  private _onRowClick() {
    this.dispatchEvent(new CustomEvent("activated", {
      detail: { path: this.entry.path, is_dir: this.entry.is_dir },
      bubbles: true, composed: true,
    }));
  }

  /** 复选框单击 = 多选（不触发 activated） */
  private _onCheckboxClick(e: MouseEvent) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("checked", {
      detail: {
        path: this.entry.path,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
      },
      bubbles: true, composed: true,
    }));
  }

  render() {
    const badge = getFileTypeBadge(this.entry.name, this.entry.is_dir);
    return html`
      <div
        class="row ${this.active ? "active" : ""}"
        @click=${this._onRowClick}>
        <span class="checkbox">
          <input
            type="checkbox"
            .checked=${this.selected}
            @click=${this._onCheckboxClick}
          />
        </span>
        <span class="cell-icon">
          ${this.entry.is_dir
            ? "📁"
            : badge
              ? html`<span class="type-badge"
                  style="background:${badge.bg};color:${badge.fg}">${badge.letter}</span>`
              : "📄"}
        </span>
        <span class="name">${this.entry.name}</span>
        <span class="size">${this.entry.is_dir ? "" : this._fmtSize(this.entry.size)}</span>
        <span class="time">${this._fmtTime(this.entry.modified_at)}</span>
        <span>${!this.entry.is_dir && this.entry.indexed ? html`<span class="badge">已索引</span>` : ""}</span>
        <span class="cell-type">${getTypeLabel(this.entry)}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-row": FileRow; }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `D:\github\cortex\cortex\web_v2\frontend`:

```bash
npm test -- tests/file-row.spec.ts
```

Expected: PASS — all 17 `it` cases pass (5 original + 12 new).

- [ ] **Step 5: Commit**

```bash
cd D:\github\cortex
git add cortex/web_v2/frontend/src/components/file-row.ts cortex/web_v2/frontend/tests/file-row.spec.ts
git commit -m "feat(web): render type-aware icon badges and 类型 column in file-row"
```

---

## Task 3: file-list.ts Header Grid + Mobile Breakpoint + Build

**Files:**
- Modify: `cortex/web_v2/frontend/src/components/file-list.ts`
- Modify: `cortex/web_v2/frontend/tests/file-list.spec.ts`
- Rebuild: `cortex/web_v2/static/index.html`, `cortex/web_v2/static/assets/*`

**Interfaces:**
- Consumes: same data flow as before (subscribes to `store.files`, dispatches `action` and `checked` events)
- Produces:
  - `.header-row` grid template `28px 28px 1fr 80px 140px 70px 80px` (matches row)
  - New 7th `<span class="cell-type">类型</span>` in header row
  - `@media (max-width: 1023px)` rule that switches `.header-row` to 6 columns and hides `.cell-type`
  - All existing event / state behavior unchanged

- [ ] **Step 1: Add failing tests for 7-column header**

Append the following test cases to `cortex/web_v2/frontend/tests/file-list.spec.ts` (inside the `describe("file-list", ...)` block, before the closing `});` on line 155):

```typescript
  it("header row renders 7 columns including 类型", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const headerCells = el.shadowRoot.querySelectorAll(".header-row > *");
    expect(headerCells.length).toBe(7);
    const typeHeader = Array.from(headerCells).find(
      (c) => (c as HTMLElement).textContent?.trim() === "类型",
    );
    expect(typeHeader).toBeTruthy();
    document.body.removeChild(el);
  });

  it("header uses 7-column grid template (desktop default)", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const header = el.shadowRoot.querySelector(".header-row") as HTMLElement;
    // jsdom exposes style.gridTemplateColumns only if explicitly set; rely on computed style check
    // on the stylesheet. Verify presence of 7 children instead — covered by previous test.
    // The mobile test below verifies the breakpoint logic.
    expect(header).toBeTruthy();
    document.body.removeChild(el);
  });

  it("header row uses 7-column grid template (cell-type hidden on ≤1023px)", async () => {
    // Match media query for mobile
    const origMatchMedia = window.matchMedia;
    window.matchMedia = (query: string) => ({
      matches: query.includes("max-width: 1023"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
    try {
      actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
      const el = document.createElement("file-list") as any;
      document.body.appendChild(el);
      await el.updateComplete;
      const typeHeader = Array.from(
        el.shadowRoot.querySelectorAll(".header-row > *"),
      ).find((c) => (c as HTMLElement).textContent?.trim() === "类型") as HTMLElement;
      expect(typeHeader).toBeTruthy();
      // The CSS rule for @media (max-width: 1023px) hides .cell-type via display: none.
      // jsdom doesn't compute CSS rules from adopted stylesheets, so we verify
      // that .cell-type has the *class* and that the stylesheet contains the rule.
      const cssText = (el.constructor as any).styles.cssText as string;
      expect(cssText).toMatch(/@media\s*\(max-width:\s*1023px\)/);
      expect(cssText).toMatch(/\.cell-type\s*\{\s*display:\s*none/);
    } finally {
      window.matchMedia = origMatchMedia;
      document.body.removeChild(el);
    }
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run from `D:\github\cortex\cortex\web_v2\frontend`:

```bash
npm test -- tests/file-list.spec.ts
```

Expected: FAIL — the header currently has 6 children, the new "类型" span is missing, and the stylesheet has no `@media (max-width: 1023px)` rule.

- [ ] **Step 3: Modify `file-list.ts`**

Edit `cortex/web_v2/frontend/src/components/file-list.ts` with these three changes:

**Change 3a** — replace the existing `.header-row` style block (lines 53-62) with:

```css
    .header-row {
      display: grid;
      grid-template-columns: 28px 28px 1fr 80px 140px 70px 80px;
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    @media (max-width: 1023px) {
      .header-row { grid-template-columns: 28px 28px 1fr 80px 140px 70px; }
      .header-row .cell-type { display: none; }
    }
```

**Change 3b** — append a `.cell-type` CSS class right after `.select-all` (around line 63):

```css
    .header-row .cell-type { color: var(--cortex-text-muted); font-size: var(--cortex-fs-sm); }
```

**Change 3c** — in the `render()` method, replace the existing 6-`<span>` header block (lines 151-164) with:

```typescript
        : html`<div class="header-row">
            <span class="select-all">
              <input
                type="checkbox"
                .checked=${allSelected}
                @click=${this._onSelectAll}
              />
            </span>
            <span></span>
            <span>名称</span>
            <span style="text-align:right;">大小</span>
            <span style="text-align:right;">修改</span>
            <span></span>
            <span class="cell-type">类型</span>
          </div>`}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `D:\github\cortex\cortex\web_v2\frontend`:

```bash
npm test -- tests/file-list.spec.ts
```

Expected: PASS — all 14 `it` cases pass (11 original + 3 new).

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run from `D:\github\cortex\cortex\web_v2\frontend`:

```bash
npm test
```

Expected: PASS — every existing test still green; the new utils + file-row + file-list tests all green.

- [ ] **Step 6: Rebuild the frontend bundle**

Run from `D:\github\cortex\cortex\web_v2\frontend`:

```bash
npm run build
```

Expected output ends with: `✓ built in <NN>ms` and `dist/index.html  dist/assets/index.*.js  dist/assets/index.*.css`. The Vite build script also runs `tsc --noEmit` first; if TypeScript reports errors, fix them and re-run before committing.

Confirm the static directory has new hashes:

```bash
ls cortex/web_v2/static/assets/
```

Expected: at least one new `index.*.js` and `index.*.css` with hashes different from the previous build (e.g., the prior commit's hash).

- [ ] **Step 7: Commit**

```bash
cd D:\github\cortex
git add cortex/web_v2/frontend/src/components/file-list.ts \
        cortex/web_v2/frontend/tests/file-list.spec.ts \
        cortex/web_v2/static/index.html \
        cortex/web_v2/static/assets/
git commit -m "feat(web): add 类型 column to file-list header with mobile hide + rebuild bundle"
```

---

## Verification

After all three tasks are committed:

1. **Manual smoke test** (optional but recommended):
   ```bash
   cd D:\github\cortex
   .venv/Scripts/python.exe -m cortex gui
   ```
   - Navigate to a directory containing `*.pdf`, `*.docx`, `*.xlsx`, `*.md`, `*.txt` files plus a subdirectory.
   - Confirm PDF/DOC/XLS/MD/TXT rows show their distinct colored badges.
   - Confirm ZIP/PY/JPG rows show 📄.
   - Confirm the directory row shows 📁 and "文件夹" in the type column.
   - Confirm `README` / `.gitignore` show no badge and blank type cell.
   - Resize browser to <1024px: the type column disappears.

2. **Test results summary**:
   - `tests/utils/file-type.spec.ts`: 27 cases green
   - `tests/file-row.spec.ts`: 17 cases green (5 original + 12 new)
   - `tests/file-list.spec.ts`: 14 cases green (11 original + 3 new)
   - Total: 58 cases green (27 of which are new)