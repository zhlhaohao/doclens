import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/control-panel-dialog";
import type { ControlPanelDialog } from "../src/components/control-panel-dialog";
import { store, actions } from "../src/state/store";
import { INITIAL_STATE } from "../src/state/store";

describe("<control-panel-dialog>", () => {
  let el: ControlPanelDialog;
  const row = (id: string) =>
    el.shadowRoot?.querySelector(`[data-testid="${id}"]`) as HTMLButtonElement;

  beforeEach(async () => {
    store.setState({ ...INITIAL_STATE, reindex: { ...INITIAL_STATE.reindex, dialog: "closed" } });
    el = await fixture<ControlPanelDialog>(html`<control-panel-dialog .open=${true}></control-panel-dialog>`);
    await elementUpdated(el);
  });

  it("closed 时不渲染内容", async () => {
    const closed = await fixture<ControlPanelDialog>(html`<control-panel-dialog></control-panel-dialog>`);
    await elementUpdated(closed);
    expect(closed.shadowRoot?.querySelector("dialog")).toBeNull();
  });

  it("open 渲染三个操作行", () => {
    expect(row("refresh-row")).toBeTruthy();
    expect(row("reindex-row")).toBeTruthy();
    expect(row("watch-row")).toBeTruthy();
    expect(el.shadowRoot?.textContent).toContain("重载页面");
    expect(el.shadowRoot?.textContent).toContain("强制重建索引");
    expect(el.shadowRoot?.textContent).toContain("文件监控");
  });

  it("点击刷新行：派发 close 并调 window.location.reload", async () => {
    // happy-dom 的 location.reload 不可配置，无法 spyOn——整体 stub location
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const events: string[] = [];
    el.addEventListener("close", () => events.push("close"));
    row("refresh-row").click();
    await elementUpdated(el);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(events).toContain("close");
    vi.unstubAllGlobals();
  });

  it("点击重建索引行：派发 close 且 store 进入 confirm", async () => {
    const events: string[] = [];
    el.addEventListener("close", () => events.push("close"));
    row("reindex-row").click();
    await elementUpdated(el);
    expect(store.getState().reindex.dialog).toBe("confirm");
    expect(events).toContain("close");
  });

  it("reindex 对话框已开时重建行禁用（幂等守卫 UI 化）", async () => {
    actions.openReindexConfirm();
    await elementUpdated(el);
    expect(row("reindex-row").disabled).toBe(true);
  });

  it("点击文件监控行：派发 close + open-watch 两事件", async () => {
    const events: string[] = [];
    el.addEventListener("close", () => events.push("close"));
    el.addEventListener("open-watch", () => events.push("open-watch"));
    row("watch-row").click();
    await elementUpdated(el);
    expect(events).toContain("close");
    expect(events).toContain("open-watch");
  });

  it("watcher 待更新状态反映到文件监控行副文案", async () => {
    actions.setWatcherStatus({
      running: true,
      reindexing: false,
      changed_count: 3,
      last_reindex_at: null,
      last_doc_count: null,
      last_success: null,
    });
    await elementUpdated(el);
    expect(el.shadowRoot?.textContent).toContain("待更新 3");
  });

  it("Esc 与 ✕ 按钮派发 close", async () => {
    const events: string[] = [];
    el.addEventListener("close", () => events.push("close"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    (el.shadowRoot?.querySelector(".close-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    expect(events.length).toBe(2);
  });
});
