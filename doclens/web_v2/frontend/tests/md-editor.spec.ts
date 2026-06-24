import { describe, it, expect, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { MdEditor } from "../src/components/md-editor";
import "../src/components/md-editor";

async function makeFixture(original: string): Promise<MdEditor> {
  const el = await fixture(html`<md-editor path="x.md" .originalContent=${original}></md-editor>`) as MdEditor;
  await el.updateComplete;
  return el;
}

describe("<md-editor>", () => {
  it("renders textarea with original content", async () => {
    const el = await makeFixture("hello\nworld");
    const ta = el.shadowRoot!.querySelector("textarea")!;
    expect(ta).toBeTruthy();
    expect(ta.value).toBe("hello\nworld");
  });

  it("shows correct number of line numbers", async () => {
    const el = await makeFixture("a\nb\nc");
    await el.updateComplete;
    const lineNos = el.shadowRoot!.querySelectorAll(".line-no");
    // "a\nb\nc" 包含 2 个 \n → 3 行
    expect(lineNos.length).toBe(3);
  });

  it("emits dirty-change(true) on input", async () => {
    const el = await makeFixture("hello");
    await el.updateComplete;
    const detail = vi.fn();
    el.addEventListener("dirty-change", (e: any) => detail(e.detail));
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "changed";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    expect(detail).toHaveBeenCalledWith({ dirty: true });
  });

  it("emits save event with content on [保存] click (when dirty)", async () => {
    const el = await makeFixture("hello");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "world";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const saveHandler = vi.fn();
    el.addEventListener("save", (e: any) => saveHandler(e.detail));
    const saveBtn = el.shadowRoot!.querySelector(".save-btn") as HTMLButtonElement;
    saveBtn.click();
    expect(saveHandler).toHaveBeenCalledWith({ content: "world" });
  });

  it("emits save event on Ctrl+S keydown (when dirty)", async () => {
    const el = await makeFixture("hello");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "world";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const saveHandler = vi.fn();
    el.addEventListener("save", (e: any) => saveHandler(e.detail));
    const evt = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true });
    ta.dispatchEvent(evt);
    expect(saveHandler).toHaveBeenCalledWith({ content: "world" });
  });

  it("does NOT emit save on Ctrl+S when not dirty", async () => {
    const el = await makeFixture("hello");
    await el.updateComplete;
    const saveHandler = vi.fn();
    el.addEventListener("save", (e: any) => saveHandler(e.detail));
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    expect(saveHandler).not.toHaveBeenCalled();
  });

  it("emits cancel event on [取消] click and resets textarea", async () => {
    const el = await makeFixture("original");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "changed";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const cancelHandler = vi.fn();
    el.addEventListener("cancel", () => cancelHandler());
    (el.shadowRoot!.querySelector(".cancel-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    expect(cancelHandler).toHaveBeenCalled();
    expect(ta.value).toBe("original");
  });

  it("discard() resets content and emits cancel", async () => {
    const el = await makeFixture("orig");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector("textarea")!;
    ta.value = "x";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    const cancelHandler = vi.fn();
    el.addEventListener("cancel", () => cancelHandler());
    el.discard();
    await el.updateComplete;
    expect(ta.value).toBe("orig");
    expect(cancelHandler).toHaveBeenCalled();
  });

  it("setError() shows error message in header", async () => {
    const el = await makeFixture("hi");
    await el.updateComplete;
    el.setError("网络错误");
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".error-msg")!.textContent).toContain("网络错误");
  });
});
