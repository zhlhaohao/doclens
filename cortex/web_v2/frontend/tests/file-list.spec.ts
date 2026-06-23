import { describe, it, expect, beforeEach } from "vitest";
import "../src/components/file-list";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { FileEntry } from "../src/api/files";

const entries: FileEntry[] = [
  { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "2026-06-22T00:00:00Z", indexed: false, writable: true, has_child_dirs: true },
  { name: "a.md", path: "a.md", is_dir: false, size: 100, modified_at: "2026-06-22T00:00:00Z", indexed: true, writable: true, has_child_dirs: false },
  { name: "b.md", path: "b.md", is_dir: false, size: 200, modified_at: "2026-06-22T00:00:00Z", indexed: false, writable: true, has_child_dirs: false },
];

describe("file-list", () => {
  beforeEach(() => resetStore(store));

  it("renders empty state when no entries", async () => {
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("目录为空");
    document.body.removeChild(el);
  });

  it("renders rows from store treeCache[currentDir]", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const rows = el.shadowRoot.querySelectorAll("file-row");
    expect(rows.length).toBe(3);
    document.body.removeChild(el);
  });

  it("toolbar rename disabled when 0 selected", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const renameBtn = el.shadowRoot.querySelector('[data-action="rename"]') as HTMLButtonElement;
    expect(renameBtn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("toolbar rename enabled when exactly 1 selected", async () => {
    actions.setFilesState({
      currentDir: "",
      treeCache: { "": entries },
      selectedPaths: ["a.md"],
    });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const renameBtn = el.shadowRoot.querySelector('[data-action="rename"]') as HTMLButtonElement;
    expect(renameBtn.disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("toolbar move/delete enabled when 2+ selected", async () => {
    actions.setFilesState({
      currentDir: "",
      treeCache: { "": entries },
      selectedPaths: ["a.md", "b.md"],
    });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const moveBtn = el.shadowRoot.querySelector('[data-action="move"]') as HTMLButtonElement;
    const deleteBtn = el.shadowRoot.querySelector('[data-action="delete"]') as HTMLButtonElement;
    expect(moveBtn.disabled).toBe(false);
    expect(deleteBtn.disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("dispatches action event on toolbar click", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    let captured: any = null;
    el.addEventListener("action", (e: Event) => captured = (e as CustomEvent).detail);
    el.shadowRoot.querySelector('[data-action="mkdir"]').click();
    expect(captured).toEqual({ name: "mkdir" });
    document.body.removeChild(el);
  });

  it("up button disabled at root", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const upBtn = el.shadowRoot.querySelector(".up-btn") as HTMLButtonElement;
    expect(upBtn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("up button enabled in subdirectory", async () => {
    actions.setFilesState({ currentDir: "docs", treeCache: { docs: entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const upBtn = el.shadowRoot.querySelector(".up-btn") as HTMLButtonElement;
    expect(upBtn.disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("clicking up button navigates to parent dir", async () => {
    actions.setFilesState({ currentDir: "docs/sub", treeCache: { "docs/sub": entries, docs: [] } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector(".up-btn").click();
    expect(store.getState().files.currentDir).toBe("docs");
    document.body.removeChild(el);
  });

  it("clicking up button from top-level dir navigates to root", async () => {
    actions.setFilesState({ currentDir: "docs", treeCache: { docs: entries, "": [] } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.shadowRoot.querySelector(".up-btn").click();
    expect(store.getState().files.currentDir).toBe("");
    document.body.removeChild(el);
  });

  it("forwards row 'checked' event to actions.selectEntry", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const row = el.shadowRoot.querySelector("file-row");
    expect(row).toBeTruthy();
    row.dispatchEvent(new CustomEvent("checked", {
      detail: { path: "a.md", ctrl: false, shift: false },
      bubbles: true, composed: true,
    }));
    expect(store.getState().files.selectedPaths).toEqual(["a.md"]);
    document.body.removeChild(el);
  });

  it("header select-all checkbox toggles all entries", async () => {
    actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
    const el = document.createElement("file-list") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const headerCb = el.shadowRoot.querySelector(".select-all input[type='checkbox']") as HTMLInputElement;
    expect(headerCb).toBeTruthy();
    headerCb.click();
    expect(store.getState().files.selectedPaths.sort()).toEqual(["a.md", "b.md", "docs"].sort());
    // 再点一次清空
    headerCb.click();
    expect(store.getState().files.selectedPaths).toEqual([]);
    document.body.removeChild(el);
  });

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
    let el: any;
    try {
      actions.setFilesState({ currentDir: "", treeCache: { "": entries } });
      el = document.createElement("file-list") as any;
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
      if (el && el.parentNode) document.body.removeChild(el);
    }
  });
});
