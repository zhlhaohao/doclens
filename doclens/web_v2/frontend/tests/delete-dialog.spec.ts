import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/components/delete-dialog";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

describe("delete-dialog", () => {
  beforeEach(() => resetStore(store));

  it("starts with loading-stats phase", async () => {
    actions.setFilesState({ selectedPaths: ["docs"] });
    const el = document.createElement("delete-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("统计中");
    document.body.removeChild(el);
  });

  it("confirming phase: button disabled until checkbox checked", async () => {
    actions.setFilesState({ selectedPaths: ["docs"] });
    const el = document.createElement("delete-dialog") as any;
    el._stats = { file_count: 5, dir_count: 2, total_size_bytes: 1024 };
    el._phase = "confirming";
    document.body.appendChild(el);
    await el.updateComplete;
    const btn = el.shadowRoot.querySelector("button.danger") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    // 勾选
    el.shadowRoot.querySelector("input[type=checkbox]").click();
    await el.updateComplete;
    expect(btn.disabled).toBe(false);
    document.body.removeChild(el);
  });

  it("delete button dispatches submit with paths", async () => {
    actions.setFilesState({ selectedPaths: ["a.md", "b.md"] });
    const el = document.createElement("delete-dialog") as any;
    el._stats = { file_count: 2, dir_count: 0, total_size_bytes: 0 };
    el._phase = "confirming";
    el._confirmed = true;
    document.body.appendChild(el);
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("submit", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector("button.danger").click();
    expect(spy).toHaveBeenCalledWith({ paths: ["a.md", "b.md"] });
    document.body.removeChild(el);
  });

  it("cancel button dispatches cancel event", async () => {
    actions.setFilesState({ selectedPaths: ["a.md"] });
    const el = document.createElement("delete-dialog") as any;
    el._stats = { file_count: 1, dir_count: 0, total_size_bytes: 0 };
    el._phase = "confirming";
    document.body.appendChild(el);
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("cancel", () => spy());
    el.shadowRoot.querySelectorAll("button")[0].click(); // 第一个按钮是"取消"
    expect(spy).toHaveBeenCalledTimes(1);
    document.body.removeChild(el);
  });
});
