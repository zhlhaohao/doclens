import { describe, it, expect, vi, beforeEach } from "vitest";
import { RenameDialog } from "../src/components/rename-dialog";
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

  it("mobile breakpoint overrides :host min-width and stacks actions", async () => {
    const cssText = (RenameDialog as any).styles.cssText as string;
    expect(cssText).toMatch(/@media\s*\(max-width:\s*1023px\)/);
    // 移除外层 360px min-width
    expect(cssText).toMatch(/@media[\s\S]*?:host\s*\{\s*min-width:\s*0/);
    // actions 列向（column-reverse），主按钮在主按钮在上方
    expect(cssText).toMatch(/@media[\s\S]*?\.actions\s*\{\s*flex-direction:\s*column-reverse/);
    // 按钮全宽 + 44px 触控目标
    expect(cssText).toMatch(/@media[\s\S]*?\.actions\s+button\s*\{[^}]*width:\s*100%/);
    expect(cssText).toMatch(/@media[\s\S]*?\.actions\s+button\s*\{[^}]*min-height:\s*44px/);
  });
});
