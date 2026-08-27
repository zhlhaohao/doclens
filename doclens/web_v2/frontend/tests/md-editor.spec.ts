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
    const ta = el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea:not(.mirror)")!;
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
    const ta = el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea:not(.mirror)")!;
    ta.value = "changed";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    expect(detail).toHaveBeenCalledWith({ dirty: true });
  });

  it("emits save event with content on [保存] click (when dirty)", async () => {
    const el = await makeFixture("hello");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea:not(.mirror)")!;
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
    const ta = el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea:not(.mirror)")!;
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
    const ta = el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea:not(.mirror)")!;
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    expect(saveHandler).not.toHaveBeenCalled();
  });

  it("emits cancel event on [取消] click and resets textarea", async () => {
    const el = await makeFixture("original");
    await el.updateComplete;
    const ta = el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea:not(.mirror)")!;
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
    const ta = el.shadowRoot!.querySelector<HTMLTextAreaElement>("textarea:not(.mirror)")!;
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

describe("<md-editor> WebView 行高校准（scrollHeight 比例修正内核取整偏差）", () => {
  /** jsdom 无布局：stub 镜像/textarea 的几何量。
   *  mirror: 每行 10px（textContent 的 \n 数 + 1 个行盒）
   *  textarea: 实际每行 12px（WebView 对表单控件行高取整与 div 不一致的模拟） */
  function stubGeometry(el: MdEditor, taLines: number, linePx = 12) {
    const ta = el.shadowRoot!.querySelector("textarea")!;
    const m = el.shadowRoot!.querySelector(".mirror")!;
    Object.defineProperty(m, "offsetHeight", {
      configurable: true,
      get(this: HTMLDivElement) {
        return this.textContent ? 10 * this.textContent.split("\n").length : 0;
      },
    });
    Object.defineProperty(ta, "clientHeight", { configurable: true, value: 400 });
    Object.defineProperty(ta, "scrollHeight", {
      configurable: true,
      value: taLines * linePx,
    });
    return ta;
  }

  it("scrollToLine 用实际/镜像总高比例校准（scale=1.2 → 滚动量同比放大）", async () => {
    const content = Array.from({ length: 100 }, (_, i) => `L${i + 1}`).join("\n");
    const el = await makeFixture(content);
    const ta = stubGeometry(el as unknown as MdEditor, 100);
    // 镜像总高 1000px，实际总高 1200px → scale = 1.2
    el.scrollToLine(51); // 镜像 hb(51) = 50 行 × 10px = 500 → 500 × 1.2 = 600
    expect(ta.scrollTop).toBe(600);
    // 未校准时 scrollTop = 500：WebView 中 500px 只到第 42 行（600/12+1），
    // 滚动不足→漂移；校准后 600px 恰好第 51 行贴顶
  });

  it("topLine 与 scrollToLine 同系数互逆：scrollTop=600 → 反查行 51", async () => {
    const content = Array.from({ length: 100 }, (_, i) => `L${i + 1}`).join("\n");
    const el = await makeFixture(content);
    const ta = stubGeometry(el as unknown as MdEditor, 100);
    ta.scrollTop = 600;
    expect(el.topLine()).toBe(51);
  });

  it("内容不足一屏（scrollHeight=clientHeight）不校准，行为与原实现一致", async () => {
    const content = Array.from({ length: 30 }, (_, i) => `L${i + 1}`).join("\n");
    const el = await makeFixture(content);
    // 30 行 × 12px = 360 < 400 → 无滚动
    const ta = stubGeometry(el as unknown as MdEditor, 30);
    expect((el as any)._lineHeightScale()).toBe(1);
    el.scrollToLine(21); // hb = 200 × 1 = 200
    expect(ta.scrollTop).toBe(200);
  });
});
