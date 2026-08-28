import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

vi.mock("../src/api/auth", () => ({
  logout: vi.fn().mockResolvedValue({ ok: true }),
}));

import "../src/components/app-bar";
import type { AppBar } from "../src/components/app-bar";
import { store, actions } from "../src/state/store";
import { router } from "../src/router/router";
import * as authApi from "../src/api/auth";

describe("<app-bar>", () => {
  let el: AppBar;
  beforeEach(async () => {
    el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
  });

  it("renders brand logo and name", () => {
    expect(el.shadowRoot?.textContent).toContain("Doclens");
  });

  it("dropdown is closed initially", () => {
    const menu = el.shadowRoot?.querySelector(".user-menu");
    expect(menu?.classList.contains("open")).toBe(false);
  });

  it("clicking avatar toggles dropdown open", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    const menu = el.shadowRoot?.querySelector(".user-menu");
    expect(menu?.classList.contains("open")).toBe(true);
  });

  it("clicking 全局配置 menu item dispatches navigate with settings+global", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);

    const events: CustomEvent[] = [];
    el.addEventListener("navigate", (e: Event) => events.push(e as CustomEvent));

    const items = el.shadowRoot?.querySelectorAll(".menu-item");
    // 首个菜单项即 全局配置
    (items?.[0] as HTMLButtonElement).click();
    await elementUpdated(el);

    expect(events).toHaveLength(1);
    expect(events[0].detail).toEqual({ view: "settings", scope: "global" });
  });

  it("clicking outside closes the dropdown", async () => {
    const btn = el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".user-menu")?.classList.contains("open")).toBe(true);

    document.body.click();
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".user-menu")?.classList.contains("open")).toBe(false);
  });
});

describe("<app-bar> logout menu item", () => {
  const logoutMock = authApi.logout as ReturnType<typeof vi.fn>;

  it("hidden when auth gate is not required", async () => {
    actions.setAuthState({ required: false, authenticated: true, hasPassword: false });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    const labels = Array.from(el.shadowRoot?.querySelectorAll(".menu-item") ?? [])
      .map((i) => i.textContent ?? "");
    expect(labels.some((l) => l.includes("注销登录"))).toBe(false);
  });

  it("shown when gate required and authenticated; click logs out and navigates to login", async () => {
    actions.setAuthState({ required: true, authenticated: true, hasPassword: true });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);

    const btn = Array.from(el.shadowRoot?.querySelectorAll(".menu-item") ?? [])
      .find((b) => (b.textContent ?? "").includes("注销登录")) as HTMLButtonElement;
    expect(btn).toBeTruthy();

    const navSpy = vi.spyOn(router, "navigate").mockImplementation(() => {});
    logoutMock.mockClear();
    btn.click();
    await vi.waitFor(() => expect(logoutMock).toHaveBeenCalled());
    expect(store.getState().auth.authenticated).toBe(false);
    expect(navSpy).toHaveBeenCalledWith("login");
    navSpy.mockRestore();
  });
});

describe("<app-bar> save button + revert", () => {
  it("never shows an app-bar save button (save lives in settings footer)", async () => {
    actions.setView("settings");
    actions.updateSetting("FOO", "bar");
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"settings"}></app-bar>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".save-btn")).toBeNull();
  });

  it("shows revert menu item when in settings view AND dirty", async () => {
    actions.setView("settings");
    actions.updateSetting("FOO", "bar");
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"settings"}></app-bar>`);
    await elementUpdated(el);

    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);

    const items = el.shadowRoot?.querySelectorAll(".menu-item");
    const labels = Array.from(items ?? []).map((i) => i.textContent ?? "");
    expect(labels.some((l) => l.includes("放弃修改"))).toBe(true);
  });

  it("clicking revert menu item dispatches cortex:revert-settings on window", async () => {
    actions.setView("settings");
    actions.updateSetting("FOO", "bar");
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"settings"}></app-bar>`);
    await elementUpdated(el);

    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);

    const revertBtn = Array.from(el.shadowRoot?.querySelectorAll(".menu-item") ?? [])
      .find((b) => (b.textContent ?? "").includes("放弃修改")) as HTMLButtonElement;
    expect(revertBtn).toBeTruthy();

    let captured = false;
    const handler = () => { captured = true; };
    window.addEventListener("cortex:revert-settings", handler);
    revertBtn.click();
    await elementUpdated(el);
    window.removeEventListener("cortex:revert-settings", handler);

    expect(captured).toBe(true);
  });
});

describe("<app-bar> watcher badge", () => {
  it("shows ○监控关 when watcher is null", async () => {
    actions.setWatcherStatus(null);
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".watch-badge")?.textContent).toContain("监控关");
  });

  it("shows ●监控 when running and idle", async () => {
    actions.setWatcherStatus({
      enabled: true, running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 123, last_doc_count: 42, last_success: true,
    });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    const badge = el.shadowRoot?.querySelector(".watch-badge");
    expect(badge?.textContent).toContain("●");
    expect(badge?.textContent).toContain("监控");
  });

  it("shows ⟳更新中 when reindexing", async () => {
    actions.setWatcherStatus({
      enabled: true, running: true, reindexing: true, changed_count: 0,
      last_reindex_at: 123, last_doc_count: 42, last_success: true,
    });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".watch-badge")?.textContent).toContain("更新中");
  });

  it("dispatching cortex:watch-reindexed pushes a toast", async () => {
    actions.setWatcherStatus({
      enabled: true, running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 123, last_doc_count: 42, last_success: true,
    });
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    await elementUpdated(el);
    const stack = el.shadowRoot?.querySelector("toast-stack") as any;
    const before = stack._toasts.length;
    window.dispatchEvent(new CustomEvent("cortex:watch-reindexed", { detail: { doc_count: 42 } }));
    await elementUpdated(el);
    expect(stack._toasts.length).toBe(before + 1);
    expect(stack._toasts[stack._toasts.length - 1].message).toContain("42");
  });
});

describe("<app-bar> reindex menu item", () => {
  it("renders 强制重建索引 menu item", async () => {
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    const labels = Array.from(el.shadowRoot?.querySelectorAll(".menu-item") ?? [])
      .map((i) => i.textContent ?? "");
    expect(labels.some((l) => l.includes("强制重建索引"))).toBe(true);
  });

  it("renders 关于 menu item and clicking opens about-dialog", async () => {
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    const btn = el.shadowRoot?.querySelector('[data-testid="about-item"]') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    const about = el.shadowRoot?.querySelector("about-dialog") as HTMLElement & { open: boolean };
    expect(about?.open).toBe(false);
    btn.click();
    await elementUpdated(el);
    expect(about.open).toBe(true);
  });

  it("clicking reindex menu opens confirm dialog (store)", async () => {
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    const btn = Array.from(el.shadowRoot?.querySelectorAll(".menu-item") ?? [])
      .find((b) => (b.textContent ?? "").includes("强制重建索引")) as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    expect(store.getState().reindex.dialog).toBe("confirm");
  });

  it("reindex menu click is ignored when dialog already open", async () => {
    actions.openReindexConfirm(); // dialog 已是 confirm
    const el = await fixture<AppBar>(html`<app-bar .activeView=${"search"}></app-bar>`);
    (el.shadowRoot?.querySelector(".avatar-btn") as HTMLButtonElement).click();
    await elementUpdated(el);
    const btn = Array.from(el.shadowRoot?.querySelectorAll(".menu-item") ?? [])
      .find((b) => (b.textContent || "").includes("强制重建索引")) as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    // 仍停留在 confirm（未因再次 click 重置/出错）
    expect(store.getState().reindex.dialog).toBe("confirm");
  });
});
