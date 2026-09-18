/** 斜杠技能调用（grilling 共识 2026-09-18）：
 *  提交校验（checkSlashSubmit：合法放行/未知阻断/非斜杠直通）+
 *  input-box 引导下拉（首字符 / 触发、↑↓/Enter 补全不发送、Esc 驳回、空格隐去）。
 */
import { describe, it, expect } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/components/input-box";
import { InputBox } from "../src/components/input-box";
import { checkSlashSubmit } from "../src/views/chat-view";

const CANDIDATES = [
  { name: "knowledge-base", description: "知识库检索" },
  { name: "summarize-files", description: "文件总结" },
];

describe("checkSlashSubmit", () => {
  it("non-slash message passes through", () => {
    expect(checkSlashSubmit("普通问题", CANDIDATES)).toEqual({ type: "non-slash" });
    expect(checkSlashSubmit("先 /knowledge-base 再说", CANDIDATES)).toEqual({ type: "non-slash" });
  });

  it("legal slash with question", () => {
    expect(checkSlashSubmit("/knowledge-base 查量子计算", CANDIDATES)).toEqual({
      type: "ok", name: "knowledge-base",
    });
  });

  it("bare slash name is legal (Q6)", () => {
    expect(checkSlashSubmit("/summarize-files", CANDIDATES)).toEqual({
      type: "ok", name: "summarize-files",
    });
  });

  it("unknown skill blocked", () => {
    expect(checkSlashSubmit("/nope 问题", CANDIDATES)).toEqual({
      type: "unknown", name: "nope",
    });
  });

  it("null candidates treated as unknown (load failed)", () => {
    expect(checkSlashSubmit("/knowledge-base q", null)).toEqual({
      type: "unknown", name: "knowledge-base",
    });
  });

  it("candidates exclude = blocked (model-only 不在引导集合)", () => {
    expect(checkSlashSubmit("/model-only q", CANDIDATES)).toEqual({
      type: "unknown", name: "model-only",
    });
  });
});

function setInput(el: InputBox, value: string) {
  const input = el.shadowRoot!.querySelector("textarea, input") as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("<input-box> slash guided menu", () => {
  async function make(value = ""): Promise<InputBox> {
    const el = await fixture(html`
      <input-box multiline .value=${value} .slashItems=${CANDIDATES}></input-box>
    `) as InputBox;
    await el.updateComplete;
    return el;
  }

  function menuItems(el: InputBox) {
    return [...el.shadowRoot!.querySelectorAll(".slash-menu .menu-item")];
  }

  it("shows filtered menu when value is slash-name fragment", async () => {
    const el = await make();
    setInput(el, "/know");
    await el.updateComplete;
    const items = menuItems(el);
    expect(items.length).toBe(1);
    expect(items[0]!.textContent).toContain("knowledge-base");
  });

  it("shows all candidates for bare slash", async () => {
    const el = await make();
    setInput(el, "/");
    await el.updateComplete;
    expect(menuItems(el).length).toBe(2);
  });

  it("hides menu once a space follows the name (question phase)", async () => {
    const el = await make();
    setInput(el, "/knowledge-base ");
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".slash-menu")).toBeNull();
  });

  it("no menu when slashItems disabled (null)", async () => {
    const el = await fixture(html`<input-box .value=${"/x"}></input-box>`) as InputBox;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".slash-menu")).toBeNull();
  });

  it("Enter completes to '/name ' instead of submitting", async () => {
    const el = await make();
    setInput(el, "/know");
    await el.updateComplete;
    let submitted = false;
    el.addEventListener("submit", () => (submitted = true));
    const input = el.shadowRoot!.querySelector("textarea, input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await el.updateComplete;
    expect(submitted).toBe(false);
    expect(el.value).toBe("/knowledge-base ");
    // 补全后（带空格）菜单隐去，再按 Enter 才真正提交
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await el.updateComplete;
    expect(submitted).toBe(true);
  });

  it("ArrowDown moves highlight and Enter picks the highlighted item", async () => {
    const el = await make();
    setInput(el, "/");
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("textarea, input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    await el.updateComplete;
    const active = el.shadowRoot!.querySelector(".slash-menu .menu-item.active")!;
    expect(active.textContent).toContain("summarize-files");
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await el.updateComplete;
    expect(el.value).toBe("/summarize-files ");
  });

  it("Escape dismisses menu until input changes", async () => {
    const el = await make();
    setInput(el, "/know");
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("textarea, input")!;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".slash-menu")).toBeNull();
    // 再敲字符（仍是名字片段）菜单回归
    setInput(el, "/knowl");
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".slash-menu")).toBeTruthy();
  });

  it("no-match fragment renders no menu (submit blocked by host)", async () => {
    const el = await make();
    setInput(el, "/zzz");
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".slash-menu")).toBeNull();
  });
});
