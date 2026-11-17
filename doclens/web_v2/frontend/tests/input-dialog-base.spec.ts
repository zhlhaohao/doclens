/** 输入框对话框基类视觉改版（2026-11-17 截图复盘）测试。
 *
 *  守卫四条：
 *  ① 未交互前不展示任何校验提示（预填后一打开就是红框红字是误伤）；
 *  ② 「未变化」降为 hint 级——灰字、无红框，但仍阻断提交（按钮禁用）；
 *  ③ 真错误（非法字符等）仍是 error 级——红字 + 红框（.invalid 类）；
 *  ④ 禁用态主按钮不再用 opacity 压成灰砖——改描边 + 弱化文字。
 */
import { describe, it, expect } from "vitest";
import "../src/components/session-rename-dialog";
import "../src/components/rename-dialog";

describe("InputDialogBase 视觉改版", () => {
  it("预填后未交互：不显示错误也不显示提示", async () => {
    const el = document.createElement("session-rename-dialog") as any;
    el.currentTitle = "旧标题";
    document.body.appendChild(el);
    await el.updateComplete;
    const sr = el.shadowRoot!;
    expect(sr.querySelector(".err")).toBeNull();
    expect(sr.querySelector(".hint")).toBeNull();
    expect(sr.querySelector("input")!.className).toBe("");
    document.body.removeChild(el);
  });

  it("预填后未交互：主按钮仍禁用（值未变化不可提交）", async () => {
    const el = document.createElement("session-rename-dialog") as any;
    el.currentTitle = "旧标题";
    document.body.appendChild(el);
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector("button.primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    document.body.removeChild(el);
  });

  it("改动后回到原值：灰字 hint，无红框", async () => {
    const el = document.createElement("session-rename-dialog") as any;
    el.currentTitle = "旧标题";
    document.body.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input")!;
    input.value = "新标题";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    // 改动了 → 无提示，按钮可点
    expect(el.shadowRoot!.querySelector(".hint")).toBeNull();
    expect(
      (el.shadowRoot!.querySelector("button.primary") as HTMLButtonElement).disabled,
    ).toBe(false);
    // 改回原值 → hint 级
    input.value = "旧标题";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    const hint = el.shadowRoot!.querySelector(".hint");
    expect(hint).toBeTruthy();
    expect(hint!.textContent).toContain("标题未变化");
    expect(el.shadowRoot!.querySelector(".err")).toBeNull();
    expect(el.shadowRoot!.querySelector("input")!.className).not.toContain("invalid");
    document.body.removeChild(el);
  });

  it("真错误：红字 .err + input.invalid", async () => {
    const el = document.createElement("rename-dialog") as any;
    el.currentName = "old.md";
    document.body.appendChild(el);
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input")!;
    input.value = "a:b";
    input.dispatchEvent(new Event("input"));
    await el.updateComplete;
    const err = el.shadowRoot!.querySelector(".err");
    expect(err).toBeTruthy();
    expect(el.shadowRoot!.querySelector("input")!.className).toContain("invalid");
    expect(el.shadowRoot!.querySelector(".hint")).toBeNull();
    document.body.removeChild(el);
  });

  it("禁用态主按钮用描边弱化形态，不用 opacity 压灰", async () => {
    const el = document.createElement("session-rename-dialog") as any;
    el.currentTitle = "旧标题";
    document.body.appendChild(el);
    await el.updateComplete;
    const cssText = ((el.constructor as any).styles as { cssText: string }[])
      .map((s) => s.cssText)
      .join("\n") as string;
    expect(cssText).toContain("button.primary:disabled");
    expect(cssText).toMatch(/button\.primary:disabled\s*\{[^}]*opacity:\s*1/);
    expect(cssText).toMatch(/button\.primary:disabled\s*\{[^}]*border:\s*1px solid/);
  });
});
