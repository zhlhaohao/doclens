import { describe, it, expect, beforeEach } from "vitest";
import { sortFileEntries } from "../src/utils/file-sort";
import { store, actions } from "../src/state/store";
import { resetStore } from "./test-utils";
import "../src/components/file-list";
import type { FileEntry } from "../src/api/files";

const entry = (
  name: string,
  size: number,
  mtime: string,
  is_dir = false,
): FileEntry => ({
  name,
  path: name,
  is_dir,
  size,
  modified_at: mtime,
  indexed: false,
  writable: true,
  has_child_dirs: false,
});

const entries: FileEntry[] = [
  entry("dir", 0, "2026-01-01T00:00:00Z", true),
  entry("b.md", 200, "2026-06-01T00:00:00Z"),
  entry("a.md", 100, "2026-05-01T00:00:00Z"),
];

describe("sortFileEntries", () => {
  it("keeps directories first regardless of direction", () => {
    for (const dir of ["asc", "desc"] as const) {
      const out = sortFileEntries(entries, "size", dir);
      expect(out[0].is_dir).toBe(true);
      expect(out[0].name).toBe("dir");
    }
  });

  it("sorts by size ascending", () => {
    const out = sortFileEntries(entries, "size", "asc");
    expect(out.map(e => e.name)).toEqual(["dir", "a.md", "b.md"]);
  });

  it("sorts by size descending", () => {
    const out = sortFileEntries(entries, "size", "desc");
    expect(out.map(e => e.name)).toEqual(["dir", "b.md", "a.md"]);
  });

  it("sorts by modified time descending", () => {
    const out = sortFileEntries(entries, "mtime", "desc");
    expect(out.map(e => e.name)).toEqual(["dir", "b.md", "a.md"]);
  });

  it("sorts by name ascending", () => {
    const out = sortFileEntries(entries, "name", "asc");
    expect(out.map(e => e.name)).toEqual(["dir", "a.md", "b.md"]);
  });

  it("does not mutate the input array", () => {
    const input = [...entries];
    sortFileEntries(input, "size", "desc");
    expect(input.map(e => e.name)).toEqual(["dir", "b.md", "a.md"]);
  });
});

describe("file-list column sorting", () => {
  beforeEach(() => resetStore(store));

  const rowNames = (el: any) =>
    Array.from(el.shadowRoot.querySelectorAll("file-row")).map(
      (r: any) => r.entry?.name,
    );

  it("header renders clickable sortable cells for name/size/mtime", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const cells = el.shadowRoot.querySelectorAll(".header-row .sortable");
    expect(cells.length).toBe(3);
    expect(cells[0].getAttribute("title")).toContain("名称");
    expect(cells[1].getAttribute("title")).toContain("大小");
    expect(cells[2].getAttribute("title")).toContain("修改");
    document.body.removeChild(el);
  });

  it("clicking 大小 header sorts rows by size descending", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const cells = el.shadowRoot.querySelectorAll(".header-row .sortable");
    (cells[1] as HTMLElement).click();
    await el.updateComplete;
    expect(store.getState().files.sortKey).toBe("size");
    expect(store.getState().files.sortDir).toBe("desc");
    expect(rowNames(el)).toEqual(["dir", "b.md", "a.md"]);
    document.body.removeChild(el);
  });

  it("clicking the same header again flips direction", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const cells = el.shadowRoot.querySelectorAll(".header-row .sortable");
    (cells[1] as HTMLElement).click();
    await el.updateComplete;
    (el.shadowRoot.querySelectorAll(".header-row .sortable")[1] as HTMLElement).click();
    await el.updateComplete;
    expect(store.getState().files.sortDir).toBe("asc");
    expect(rowNames(el)).toEqual(["dir", "a.md", "b.md"]);
    document.body.removeChild(el);
  });

  it("switching to another header uses that key's default direction", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot.querySelectorAll(".header-row .sortable")[1] as HTMLElement).click();
    await el.updateComplete;
    (el.shadowRoot.querySelectorAll(".header-row .sortable")[2] as HTMLElement).click();
    await el.updateComplete;
    expect(store.getState().files.sortKey).toBe("mtime");
    expect(store.getState().files.sortDir).toBe("desc");
    document.body.removeChild(el);
  });

  it("active column shows arrow indicator and aria-sort", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    (el.shadowRoot.querySelectorAll(".header-row .sortable")[1] as HTMLElement).click();
    await el.updateComplete;
    const active = el.shadowRoot.querySelector(".header-row .sortable.sorted");
    expect(active.getAttribute("aria-sort")).toBe("descending");
    expect(active.querySelector(".sort-arrow").getAttribute("data-arrow")).toBe("▼");
    document.body.removeChild(el);
  });

  it("mobile header also exposes sortable cells", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    el.mobile = true;
    document.body.appendChild(el);
    await el.updateComplete;
    const cells = el.shadowRoot.querySelectorAll(".header-row .sortable");
    expect(cells.length).toBe(3);
    document.body.removeChild(el);
  });
});
