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

  it("unindexed file name gets .unindexed class + hint title; indexed does not", async () => {
    const indexed = makeRow(fileEntry); // indexed: true
    await indexed.updateComplete;
    const nameEl = indexed.shadowRoot.querySelector(".name") as HTMLElement;
    expect(nameEl.classList.contains("unindexed")).toBe(false);

    const unindexed = makeRow({ ...fileEntry, name: "b.md", path: "b.md", indexed: false });
    await unindexed.updateComplete;
    const nameEl2 = unindexed.shadowRoot.querySelector(".name") as HTMLElement;
    expect(nameEl2.classList.contains("unindexed")).toBe(true);
    expect(nameEl2.getAttribute("title")).toContain("未索引");
  });

  it("dir row never gets .unindexed (indexed 标志对目录无意义)", async () => {
    const el = makeRow(dirEntry); // is_dir: true, indexed: false
    await el.updateComplete;
    const nameEl = el.shadowRoot.querySelector(".name") as HTMLElement;
    expect(nameEl.classList.contains("unindexed")).toBe(false);
  });

  it("no 已索引 badge column anymore (grid 只有 5 列)", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".cell-indexed")).toBeNull();
    expect(el.shadowRoot.querySelectorAll(".row > span").length).toBe(5);
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
    expect(badge.style.background).toBe("rgb(228, 30, 63)");  // #E41E3F Meta critical
    expect(badge.style.color).toBe("rgb(255, 255, 255)");
  });

  it("renders blue D badge for .docx files", async () => {
    const el = makeRow({ ...fileEntry, name: "notes.docx" });
    await el.updateComplete;
    const badge = el.shadowRoot.querySelector(".type-badge") as HTMLElement;
    expect(badge?.textContent).toBe("D");
    expect(badge?.style.background).toBe("rgb(0, 100, 224)");  // #0064E0 cobalt
  });

  it("renders green X badge for .xlsx files", async () => {
    const el = makeRow({ ...fileEntry, name: "sales.xlsx" });
    await el.updateComplete;
    const badge = el.shadowRoot.querySelector(".type-badge") as HTMLElement;
    expect(badge?.textContent).toBe("X");
    expect(badge?.style.background).toBe("rgb(49, 162, 76)");  // #31A24C success
  });

  it("renders indigo M badge for .md files", async () => {
    const el = makeRow(fileEntry);  // name: a.md
    await el.updateComplete;
    const badge = el.shadowRoot.querySelector(".type-badge") as HTMLElement;
    expect(badge?.textContent).toBe("M");
    expect(badge?.style.background).toBe("rgb(161, 33, 206)");  // #A121CE oculus
  });

  it("renders gray T badge for .txt files", async () => {
    const el = makeRow({ ...fileEntry, name: "notes.txt" });
    await el.updateComplete;
    const badge = el.shadowRoot.querySelector(".type-badge") as HTMLElement;
    expect(badge?.textContent).toBe("T");
    expect(badge?.style.background).toBe("rgb(93, 108, 123)");  // #5D6C7B steel
  });

  it("falls back to file icon for unknown file types", async () => {
    const el = makeRow({ ...fileEntry, name: "archive.zip" });
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".type-badge")).toBeNull();
    expect(el.shadowRoot.querySelector(".cell-icon doclens-icon")?.getAttribute("name")).toBe("file");
  });

  it("falls back to file icon for files without extension", async () => {
    const el = makeRow({ ...fileEntry, name: "README" });
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".type-badge")).toBeNull();
    expect(el.shadowRoot.querySelector(".cell-icon doclens-icon")?.getAttribute("name")).toBe("file");
  });

  it("renders folder icon for directory rows (no badge)", async () => {
    const el = makeRow(dirEntry);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".type-badge")).toBeNull();
    expect(el.shadowRoot.querySelector(".cell-icon doclens-icon")?.getAttribute("name")).toBe("folder");
  });

  it("no type column anymore (类型列 2026-08-10 移除，扩展名信息由图标徽标承担)", async () => {
    const el = makeRow({ ...fileEntry, name: "Sales.XLSX" });
    await el.updateComplete;
    expect(el.shadowRoot.querySelector(".cell-type")).toBeNull();
  });

  it("row uses 5-column grid (checkbox/icon/name/size/time)", async () => {
    const el = makeRow(fileEntry);
    await el.updateComplete;
    const row = el.shadowRoot.querySelector(".row") as HTMLElement;
    const cells = row.children;
    expect(cells.length).toBe(5);
  });
});
