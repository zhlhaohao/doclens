import { describe, it, expect, beforeEach } from "vitest";
import "../src/components/file-search-results";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { IndexedDocument } from "../src/state/types";

const docs: IndexedDocument[] = [
  { path: "docs/README.md", name: "README.md", size: 2345, modifiedAt: "2026-06-24T00:00:00Z" },
  { path: "src/guide/readme.txt", name: "readme.txt", size: 1100, modifiedAt: "2026-06-21T00:00:00Z" },
  { path: "src/utils/bread.py", name: "bread.py", size: 800, modifiedAt: "2026-06-12T00:00:00Z" },
];

describe("file-search-results", () => {
  beforeEach(() => resetStore(store));

  it("renders empty state when query non-empty but no matches", async () => {
    actions.setFilenameSearchQuery({ query: "xyz", results: [], totalMatches: 0 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("未匹配到任何文件名包含");
    expect(el.shadowRoot.textContent).toContain("xyz");
    document.body.removeChild(el);
  });

  it("renders result rows with name + dir + size + modified", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const rows = el.shadowRoot.querySelectorAll(".row");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("README.md");
    expect(rows[0].textContent).toContain("docs/");
    expect(rows[0].textContent).toContain("2.3 KB");
  });

  it("highlights matched substring with <mark>", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const marks = el.shadowRoot.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThanOrEqual(1);
    expect(marks[0].textContent.toLowerCase()).toBe("read");
  });

  it("first row is selected by default (selectedPath = results[0].path)", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const active = el.shadowRoot.querySelector(".row.active");
    expect(active).toBeTruthy();
    expect(active.textContent).toContain("README.md");
    document.body.removeChild(el);
  });

  it("clicking a row emits 'activated' with path", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("activated", (e: CustomEvent) => captured = e.detail);
    const rows = el.shadowRoot.querySelectorAll(".row");
    rows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await el.updateComplete;
    expect(captured).toEqual({ path: "src/guide/readme.txt" });
    document.body.removeChild(el);
  });

  it("ArrowDown moves selectedPath to next row", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await el.updateComplete;
    expect(store.getState().files.filenameSearch.selectedPath).toBe("src/guide/readme.txt");
    document.body.removeChild(el);
  });

  it("ArrowUp does not wrap above first row", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    await el.updateComplete;
    expect(store.getState().files.filenameSearch.selectedPath).toBe("docs/README.md");
    document.body.removeChild(el);
  });

  it("Esc emits 'clear' event", async () => {
    actions.setFilenameSearchQuery({ query: "read", results: docs.slice(0, 2), totalMatches: 2 });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    let cleared = false;
    el.addEventListener("clear", () => { cleared = true; });
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(cleared).toBe(true);
    document.body.removeChild(el);
  });

  it("shows overflow hint when totalMatches > results.length", async () => {
    actions.setFilenameSearchQuery({
      query: "a",
      results: docs.slice(0, 2),
      totalMatches: 247,
    });
    const el = document.createElement("file-search-results") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const hint = el.shadowRoot.querySelector(".overflow-hint");
    expect(hint).toBeTruthy();
    expect(hint.textContent).toContain("247");
    expect(hint.textContent).toContain("100");
    document.body.removeChild(el);
  });
});
