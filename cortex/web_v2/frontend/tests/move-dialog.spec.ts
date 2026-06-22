import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/components/move-dialog";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

describe("move-dialog", () => {
  beforeEach(() => resetStore(store));

  it("shows 'N items' when multiple selected", async () => {
    actions.setFilesState({
      selectedPaths: ["a.md", "b.md", "c.md"],
      treeCache: { "": [
        { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true },
      ]},
    });
    const el = document.createElement("move-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("3");
    document.body.removeChild(el);
  });

  it("submit button disabled when no dest selected", async () => {
    actions.setFilesState({
      selectedPaths: ["a.md"],
      treeCache: { "": [
        { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true },
      ]},
    });
    const el = document.createElement("move-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const btn = el.shadowRoot.querySelector("button.primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("submit dispatches with selected destDir and overwrite", async () => {
    actions.setFilesState({
      selectedPaths: ["a.md"],
      treeCache: { "": [
        { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true },
      ]},
    });
    const el = document.createElement("move-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el._dest = "docs";
    el.requestUpdate();
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("submit", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector("button.primary").click();
    expect(spy).toHaveBeenCalledWith({ destDir: "docs", overwrite: false });
    document.body.removeChild(el);
  });
});
