import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { ToastStack } from "../src/components/toast-stack";
import "../src/components/toast-stack";

describe("<toast-stack>", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders empty initially", async () => {
    const el = await fixture(html`<toast-stack></toast-stack>`) as ToastStack;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(0);
  });

  it("pushToast() adds a toast with message", async () => {
    const el = await fixture(html`<toast-stack></toast-stack>`) as ToastStack;
    await el.updateComplete;
    el.pushToast("已保存", "success", 2500);
    await el.updateComplete;
    const toasts = el.shadowRoot!.querySelectorAll(".toast");
    expect(toasts.length).toBe(1);
    expect(toasts[0].textContent).toContain("已保存");
    expect(toasts[0].classList.contains("success")).toBe(true);
  });

  it("auto-dismisses after duration", async () => {
    const el = await fixture(html`<toast-stack></toast-stack>`) as ToastStack;
    await el.updateComplete;
    el.pushToast("hi", "info", 1000);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(1);
    vi.advanceTimersByTime(1100);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(0);
  });

  it("dismiss() removes toast and cancels timer", async () => {
    const el = await fixture(html`<toast-stack></toast-stack>`) as ToastStack;
    await el.updateComplete;
    el.pushToast("err", "error", 10000);
    await el.updateComplete;
    const id = el._toasts[0].id;
    el.dismiss(id);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(0);
    vi.advanceTimersByTime(11000);
    await el.updateComplete;
    // 仍为 0，没有副作用
    expect(el.shadowRoot!.querySelectorAll(".toast").length).toBe(0);
  });
});