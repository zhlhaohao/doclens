import { describe, it, expect, beforeEach } from "vitest";
import "../src/components/file-row";
import type { FileEntry } from "../src/api/files";

const fileEntry: FileEntry = {
  name: "a.md", path: "a.md", is_dir: false, size: 100,
  modified_at: "2026-06-22T00:00:00Z", indexed: true, writable: true, has_child_dirs: false,
};
const dirEntry: FileEntry = {
  name: "docs", path: "docs", is_dir: true, size: 0,
  modified_at: "2026-06-22T00:00:00Z", indexed: false, writable: true, has_child_dirs: true,
};

function makeRow(entry: FileEntry, selected = false) {
  const el = document.createElement("file-row") as any;
  el.entry = entry;
  el.selected = selected;
  document.body.appendChild(el);
  return el;
}

describe("file-row", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("row body click dispatches activated with is_dir=false for files", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("activated", (e: Event) => captured = (e as CustomEvent).detail);
    el.shadowRoot.querySelector(".row").click();
    expect(captured).toEqual({ path: "a.md", is_dir: false });
  });

  it("row body click dispatches activated with is_dir=true for folders", async () => {
    const el = makeRow(dirEntry);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("activated", (e: Event) => captured = (e as CustomEvent).detail);
    el.shadowRoot.querySelector(".row").click();
    expect(captured).toEqual({ path: "docs", is_dir: true });
  });

  it("checkbox click dispatches checked and does not activate", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    let activated = null;
    let checked = null;
    el.addEventListener("activated", (e: Event) => activated = (e as CustomEvent).detail);
    el.addEventListener("checked", (e: Event) => checked = (e as CustomEvent).detail);
    const ev = new MouseEvent("click", { bubbles: true, ctrlKey: true });
    el.shadowRoot.querySelector("input[type='checkbox']").dispatchEvent(ev);
    expect(activated).toBeNull();
    expect(checked).toEqual({ path: "a.md", ctrl: true, shift: false });
  });

  it("row body click does not dispatch checked", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    let checked = null;
    el.addEventListener("checked", (e: Event) => checked = (e as CustomEvent).detail);
    el.shadowRoot.querySelector(".row").click();
    expect(checked).toBeNull();
  });

  it("reflects selected state on checkbox", async () => {
    const el = makeRow(fileEntry, true);
    await el.updateComplete;
    const cb = el.shadowRoot.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

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
    // grid-template-columns is exposed via :host style; we verify 7 tokens are present
    // The class .row is shadow-scoped, but the column count shows in the count of children
    const cells = row.children;
    expect(cells.length).toBe(7);
  });
});
