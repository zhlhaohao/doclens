import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture, html } from "@open-wc/testing";
import "../src/views/chat-view";
import { resetStore, setDesktopViewport } from "./test-utils";
import { store, actions } from "../src/state/store";
import type { ChatView } from "../src/views/chat-view";

/** 对话框模板外迁（AP-1）回归：各对话框宿主在 open 时渲染出 <dialog>，
 *  且由 updated() 调 showModal（top-layer）——模板从类方法改为纯函数后，
 *  这条链路不能断。 */
function focusChat() {
  actions.setChatState({
    state: "focus",
    currentSession: {
      id: "s1", type: "chat", title: "t", preview: "p",
      updated_at: new Date().toISOString(), message_count: 2,
    },
    messages: [] as any,
    streaming: false,
  });
}

describe("<chat-view> 对话框宿主（模板外迁回归）", () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = vi.fn(async () =>
      new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }),
    ) as unknown as typeof fetch;
    resetStore(store);
    focusChat();
    setDesktopViewport();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rename 对话框：open 时渲染 <dialog> 并 showModal", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    (el as any)._renameDialogOpen = true;
    await el.updateComplete;
    const dlg = el.shadowRoot?.querySelector("dialog");
    expect(dlg).toBeTruthy();
    expect(dlg!.open).toBe(true);
    expect(el.shadowRoot?.querySelector("session-rename-dialog")).toBeTruthy();
  });

  it("vision-gate 对话框：open 时渲染并 showModal", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    (el as any)._visionGateOpen = true;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector("vision-gate-dialog")).toBeTruthy();
    expect(el.shadowRoot?.querySelector("dialog")?.open).toBe(true);
  });

  it("interject 对话框：open 时渲染并 showModal", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    (el as any)._interjectDialogOpen = true;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector("interject-dialog")).toBeTruthy();
    expect(el.shadowRoot?.querySelector("dialog")?.open).toBe(true);
  });

  it("compact 对话框：open 时渲染并 showModal", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    (el as any)._compactDialog = {
      phase: "confirm", preTokens: 0, postTokens: 0, errorMessage: "", compactedText: "",
    };
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector("compact-confirm-dialog")).toBeTruthy();
    expect(el.shadowRoot?.querySelector("dialog")?.open).toBe(true);
  });

  it("closed 状态不渲染对话框", async () => {
    const el = await fixture(html`<chat-view></chat-view>`) as ChatView;
    await el.updateComplete;
    expect(el.shadowRoot?.querySelector("dialog")).toBeNull();
  });
});
