import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/components/mkdir-dialog";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

describe("mkdir-dialog", () => {
  beforeEach(() => resetStore(store));

  it("rejects names with illegal chars in real-time", async () => {
    actions.setFilesState({ currentDir: "" });
    const el = document.createElement("mkdir-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot.querySelector("input");
    input.value = "a:b";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("非法");
    const btn = el.shadowRoot.querySelector("button.primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("submits valid name via event", async () => {
    actions.setFilesState({ currentDir: "docs" });
    const el = document.createElement("mkdir-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot.querySelector("input");
    input.value = "new_folder";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("submit", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector("button.primary").click();
    expect(spy).toHaveBeenCalledWith({ path: "docs/new_folder" });
    document.body.removeChild(el);
  });

  it("rejects leading dot", async () => {
    actions.setFilesState({ currentDir: "" });
    const el = document.createElement("mkdir-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot.querySelector("input");
    input.value = ".hidden";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("点");
    document.body.removeChild(el);
  });

  it("cancel button dispatches cancel event", async () => {
    const el = document.createElement("mkdir-dialog") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("cancel", () => spy());
    el.shadowRoot.querySelectorAll("button")[0].click(); // 第一个按钮是"取消"
    expect(spy).toHaveBeenCalledTimes(1);
    document.body.removeChild(el);
  });
});
