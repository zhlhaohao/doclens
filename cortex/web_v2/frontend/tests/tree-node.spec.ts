import { describe, it, expect, vi } from "vitest";
import "../src/components/tree-node";

describe("tree-node", () => {
  it("renders folder icon and name", async () => {
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true, has_child_dirs: true };
    el.depth = 0;
    el.readonly = false;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("docs");
    document.body.removeChild(el);
  });

  it("dispatches select-dir on click in normal mode", async () => {
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true, has_child_dirs: true };
    el.depth = 0;
    el.readonly = false;
    document.body.appendChild(el);
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("select-dir", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector(".row").click();
    expect(spy).toHaveBeenCalledWith({ path: "docs" });
    document.body.removeChild(el);
  });

  it("dispatches pick-dir on click in readonly mode", async () => {
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true, has_child_dirs: true };
    el.depth = 0;
    el.readonly = true;
    document.body.appendChild(el);
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("pick-dir", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector(".row").click();
    expect(spy).toHaveBeenCalledWith({ path: "docs" });
    document.body.removeChild(el);
  });

  it("dispatches toggle on arrow click", async () => {
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true, has_child_dirs: true };
    el.depth = 0;
    el.expanded = false;
    el.readonly = false;
    document.body.appendChild(el);
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("toggle", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector(".arrow").click();
    expect(spy).toHaveBeenCalledWith({ path: "docs" });
    document.body.removeChild(el);
  });

  it("does not render children when collapsed", async () => {
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true, has_child_dirs: true };
    el.depth = 0;
    el.expanded = false;
    el.childEntries = [{ name: "sub", path: "docs/sub", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true, has_child_dirs: false }];
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll("tree-node").length).toBe(0);
    document.body.removeChild(el);
  });

  it("hides arrow when directory has no child dirs", async () => {
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "empty", path: "empty", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true, has_child_dirs: false };
    el.depth = 0;
    el.readonly = false;
    document.body.appendChild(el);
    await el.updateComplete;
    const arrow = el.shadowRoot.querySelector(".arrow") as HTMLElement;
    expect(arrow.classList.contains("leaf")).toBe(true);
    const spy = vi.fn();
    el.addEventListener("toggle", () => spy());
    arrow.click();
    expect(spy).not.toHaveBeenCalled();
    document.body.removeChild(el);
  });

  it("hides arrow for files", async () => {
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "a.md", path: "a.md", is_dir: false, size: 10, modified_at: "", indexed: false, writable: true, has_child_dirs: false };
    el.depth = 0;
    el.readonly = false;
    document.body.appendChild(el);
    await el.updateComplete;
    const arrow = el.shadowRoot.querySelector(".arrow") as HTMLElement;
    expect(arrow.classList.contains("leaf")).toBe(true);
    document.body.removeChild(el);
  });
});
