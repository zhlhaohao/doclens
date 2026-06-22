import { describe, it, expect, vi } from "vitest";
import "../src/components/tree-node";

describe("tree-node", () => {
  it("renders folder icon and name", async () => {
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true };
    el.depth = 0;
    el.readonly = false;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("docs");
    document.body.removeChild(el);
  });

  it("dispatches select-dir on click in normal mode", async () => {
    const el = document.createElement("tree-node") as any;
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true };
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
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true };
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
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true };
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
    el.entry = { name: "docs", path: "docs", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true };
    el.depth = 0;
    el.expanded = false;
    el.childEntries = [{ name: "sub", path: "docs/sub", is_dir: true, size: 0, modified_at: "", indexed: false, writable: true }];
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelectorAll("tree-node").length).toBe(0);
    document.body.removeChild(el);
  });
});
