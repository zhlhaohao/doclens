import { describe, it, expect } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/compact-confirm-dialog";
import type { CompactConfirmDialog } from "../src/components/compact-confirm-dialog";

describe("<compact-confirm-dialog>", () => {
  it("renders 压缩上下文 title and semantics explanation", async () => {
    const el = await fixture<CompactConfirmDialog>(html`<compact-confirm-dialog></compact-confirm-dialog>`);
    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("压缩上下文");
    expect(text).toContain("摘要");
    // 关键语义：展示不受影响 + 耗时提示
    expect(text).toContain("聊天记录展示不变");
    expect(text).toContain("几十秒");
  });

  it("确认按钮 dispatches compact-confirm（bubbles/composed）", async () => {
    const el = await fixture<CompactConfirmDialog>(html`<compact-confirm-dialog></compact-confirm-dialog>`);
    let fired = 0;
    el.addEventListener("compact-confirm", () => fired++);
    (el.shadowRoot?.querySelector("button.primary") as HTMLButtonElement).click();
    await elementUpdated(el);
    expect(fired).toBe(1);
  });

  it("取消按钮 dispatches cancel", async () => {
    const el = await fixture<CompactConfirmDialog>(html`<compact-confirm-dialog></compact-confirm-dialog>`);
    let fired = 0;
    el.addEventListener("cancel", () => fired++);
    const plain = Array.from(el.shadowRoot?.querySelectorAll("button") ?? [])
      .find((b) => (b.textContent ?? "").includes("取消")) as HTMLButtonElement;
    plain.click();
    await elementUpdated(el);
    expect(fired).toBe(1);
  });
});
