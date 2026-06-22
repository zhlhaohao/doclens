import { describe, it, expect, vi, beforeEach } from "vitest";
import "../src/components/rename-dialog";
import { resetStore } from "./test-utils";
import { store } from "../src/state/store";

describe("rename-dialog", () => {
  beforeEach(() => resetStore(store));

  it("prefills current name", async () => {
    const el = document.createElement("rename-dialog") as any;
    el.currentName = "old.md";
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.querySelector("input").value).toBe("old.md");
    document.body.removeChild(el);
  });

  it("submit disabled when name unchanged", async () => {
    const el = document.createElement("rename-dialog") as any;
    el.currentName = "old.md";
    document.body.appendChild(el);
    await el.updateComplete;
    const btn = el.shadowRoot.querySelector("button.primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("submits new name via event", async () => {
    const el = document.createElement("rename-dialog") as any;
    el.currentName = "old.md";
    document.body.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot.querySelector("input");
    input.value = "new.md";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    const spy = vi.fn();
    el.addEventListener("submit", (e: Event) => spy((e as CustomEvent).detail));
    el.shadowRoot.querySelector("button.primary").click();
    expect(spy).toHaveBeenCalledWith({ newName: "new.md" });
    document.body.removeChild(el);
  });
});
