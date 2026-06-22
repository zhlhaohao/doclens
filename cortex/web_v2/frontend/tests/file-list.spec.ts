import { describe, it, expect, beforeEach } from "vitest";
import "../src/components/file-list";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { FileEntry } from "../src/api/files";

const entries: FileEntry[] = [
  { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "2026-06-22T00:00:00Z", indexed: false, writable: true },
  { name: "a.md", path: "a.md", is_dir: false, size: 100, modified_at: "2026-06-22T00:00:00Z", indexed: true, writable: true },
  { name: "b.md", path: "b.md", is_dir: false, size: 200, modified_at: "2026-06-22T00:00:00Z", indexed: false, writable: true },
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
});
