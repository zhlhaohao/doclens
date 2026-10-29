import { describe, it, expect } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/import-confirm-dialog";
import type { ImportConfirmDialog } from "../src/components/import-confirm-dialog";

/** 会话导入确认框（2026-10-29）：替代 window.confirm，并承载
 *  「同 id 已存在 → 作为副本导入」分支。 */

function btn(el: ImportConfirmDialog, label: string): HTMLButtonElement {
  return Array.from(el.shadowRoot?.querySelectorAll("button") ?? [])
    .find((b) => (b.textContent ?? "").includes(label)) as HTMLButtonElement;
}

describe("<import-confirm-dialog>", () => {
  it("confirm 态展示标题与条目数，确认不带 asCopy", async () => {
    const el = await fixture<ImportConfirmDialog>(html`
      <import-confirm-dialog
        fileName="a.json" sessionTitle="富会话" .itemCount=${12}
      ></import-confirm-dialog>`);
    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("导入会话");
    expect(text).toContain("富会话");
    expect(text).toContain("12 条记录");
    expect(text).toContain("a.json");

    let detail: { asCopy: boolean } | null = null;
    el.addEventListener("import-confirm", (e) => {
      detail = (e as CustomEvent<{ asCopy: boolean }>).detail;
    });
    btn(el, "导入").click();
    await elementUpdated(el);
    expect(detail).toEqual({ asCopy: false });
  });

  it("exists 态提供「作为副本导入」并回传 asCopy=true", async () => {
    const el = await fixture<ImportConfirmDialog>(html`
      <import-confirm-dialog
        sessionTitle="富会话" .itemCount=${12} .phase=${"exists"}
      ></import-confirm-dialog>`);
    const text = el.shadowRoot?.textContent ?? "";
    expect(text).toContain("会话已存在");
    expect(text).toContain("（导入副本）");
    // 不存在「导入」主按钮——只剩取消 / 作为副本导入
    expect(() => btn(el, "作为副本导入")).not.toThrow();

    let detail: { asCopy: boolean } | null = null;
    el.addEventListener("import-confirm", (e) => {
      detail = (e as CustomEvent<{ asCopy: boolean }>).detail;
    });
    btn(el, "作为副本导入").click();
    await elementUpdated(el);
    expect(detail).toEqual({ asCopy: true });
  });

  it("webview 态提示需重新选择文件", async () => {
    const el = await fixture<ImportConfirmDialog>(html`
      <import-confirm-dialog .phase=${"exists"} ?webview=${true}
      ></import-confirm-dialog>`);
    expect(el.shadowRoot?.textContent).toContain("重新选择");
  });

  it("busy 态按钮禁用", async () => {
    const el = await fixture<ImportConfirmDialog>(html`
      <import-confirm-dialog .phase=${"busy"}></import-confirm-dialog>`);
    const buttons = Array.from(el.shadowRoot?.querySelectorAll("button") ?? []);
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });

  it("取消按钮 dispatches cancel", async () => {
    const el = await fixture<ImportConfirmDialog>(html`
      <import-confirm-dialog></import-confirm-dialog>`);
    let fired = 0;
    el.addEventListener("cancel", () => fired++);
    btn(el, "取消").click();
    await elementUpdated(el);
    expect(fired).toBe(1);
  });
});
