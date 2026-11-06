import { describe, it, expect, vi, afterEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import { FocusHeader } from "../src/components/focus-header";
import type { FocusHeaderAction } from "../src/components/focus-header";

describe("<focus-header> actions prop", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("does not render .more-btn when actions is empty", async () => {
    const el = await fixture(html`<focus-header title="t"></focus-header>`) as FocusHeader;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more-btn")).toBeNull();
  });

  const makeActions = (): FocusHeaderAction[] => [{ label: "A", onClick: () => {} }];

  it("renders .more-btn when actions is non-empty", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${makeActions()}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".more-btn")).toBeTruthy();
  });

  it("clicking .more-btn toggles the dropdown", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${makeActions()}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement;
    btn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeTruthy();
    btn.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });

  it("clicking a menu item calls onClick and closes the dropdown", async () => {
    const onClick = vi.fn();
    const el = await fixture(html`
      <focus-header title="t" .actions=${[{ label: "A", icon: "🔧", onClick }]}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    const item = el.shadowRoot!.querySelector(".menu-item") as HTMLButtonElement;
    item.click();
    await el.updateComplete;
    expect(onClick).toHaveBeenCalledOnce();
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });

  it("clicking outside closes the dropdown", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${makeActions()}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeTruthy();
    // 模拟点击 body 上的其它元素
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });

  it("styles：:host 显式 z-index，保证菜单不被后序 positioned 兄弟遮盖", () => {
    // 回归：detail-overlay 中 preview-pane（position:relative）DOM 序在
    // focus-header 之后；backdrop-filter 已使 :host 成为层叠上下文，
    // 缺 z-index 时菜单会被 preview-pane 整体盖住。
    const cssText = FocusHeader.styles.cssText;
    expect(cssText).toContain("z-index: 10");
  });
});

/** 横排快捷条（2026-11-06）：row=true 的动作不进竖排文字列表，
 *  而是等宽图标钮并排成一行（移动端会话导航三动作共用一行）。 */
describe("<focus-header> row actions", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const actions = (): FocusHeaderAction[] => [
    { label: "回到顶部", icon: "arrow-up-to-line", row: true, onClick: () => {} },
    { label: "展开全部思考过程", icon: "chevrons-down-up", row: true, onClick: () => {} },
    { label: "回到底部", icon: "arrow-down-to-line", row: true, onClick: () => {} },
    { label: "刷新会话", icon: "refresh-cw", onClick: () => {} },
  ];

  it("renders row actions in one .menu-row, text actions in .menu-list", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${actions()}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;

    const rows = el.shadowRoot!.querySelectorAll(".menu-row");
    expect(rows.length).toBe(1);
    expect(rows[0].querySelectorAll(".menu-row-btn").length).toBe(3);
    const list = el.shadowRoot!.querySelectorAll(".menu-list .menu-item");
    expect(list.length).toBe(1);
    expect(list[0].textContent).toContain("刷新会话");
  });

  it("row buttons keep label as aria-label/title and run onClick", async () => {
    const onClick = vi.fn();
    const el = await fixture(html`
      <focus-header title="t" .actions=${[
        { label: "回到顶部", icon: "arrow-up-to-line", row: true, onClick },
        { label: "刷新会话", onClick: () => {} },
      ]}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;

    const btn = el.shadowRoot!.querySelector(".menu-row-btn") as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).toBe("回到顶部");
    expect(btn.getAttribute("title")).toBe("回到顶部");
    btn.click();
    await el.updateComplete;
    expect(onClick).toHaveBeenCalledOnce();
    expect(el.shadowRoot!.querySelector(".menu.open")).toBeNull();
  });

  it("row button honours disabled", async () => {
    const onClick = vi.fn();
    const el = await fixture(html`
      <focus-header title="t" .actions=${[
        { label: "本会话没有思考过程", icon: "chevrons-down-up", row: true, disabled: true, onClick },
        { label: "刷新会话", onClick: () => {} },
      ]}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector(".menu-row-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    btn.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not render .menu-row when no action is marked row", async () => {
    const el = await fixture(html`
      <focus-header title="t" .actions=${[{ label: "A", onClick: () => {} }]}></focus-header>
    `) as FocusHeader;
    await el.updateComplete;
    (el.shadowRoot!.querySelector(".more-btn") as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector(".menu-row")).toBeNull();
    expect(el.shadowRoot!.querySelectorAll(".menu-list .menu-item").length).toBe(1);
  });
});
