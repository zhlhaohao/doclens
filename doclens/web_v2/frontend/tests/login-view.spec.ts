import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/views/login-view";
import type { LoginView } from "../src/views/login-view";
import { store, INITIAL_STATE } from "../src/state/store";
import { router } from "../src/router/router";
import { ApiError } from "../src/api/client";
import * as authApi from "../src/api/auth";

vi.mock("../src/api/auth", () => ({
  login: vi.fn(),
}));

const loginMock = authApi.login as ReturnType<typeof vi.fn>;

function stubPointer(coarse: boolean) {
  Object.defineProperty(window, "matchMedia", {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: coarse,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  router._reset();
  store.setState({ ...INITIAL_STATE, auth: { ...INITIAL_STATE.auth } });
  loginMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mount(coarse: boolean): Promise<LoginView> {
  stubPointer(coarse);
  const el = await fixture<LoginView>(html`<login-view></login-view>`);
  await elementUpdated(el);
  return el;
}

describe("<login-view> 设备分支", () => {
  it("pointer: coarse → 渲染自绘数字键盘 + 圆点，不渲染输入框", async () => {
    const el = await mount(true);
    expect(el.shadowRoot?.querySelector("pin-pad")).toBeTruthy();
    expect(el.shadowRoot?.querySelectorAll(".dot").length).toBe(6);
    expect(el.shadowRoot?.querySelector("input.pin-input")).toBeNull();
  });

  it("pointer: fine → 渲染密码输入框 + 提交按钮，不渲染键盘", async () => {
    const el = await mount(false);
    expect(el.shadowRoot?.querySelector("pin-pad")).toBeNull();
    expect(el.shadowRoot?.querySelector("input.pin-input")).toBeTruthy();
  });
});

describe("<login-view> 桌面输入流", () => {
  it("未满 6 位时提交按钮禁用", async () => {
    const el = await mount(false);
    const btn = el.shadowRoot?.querySelector("button.submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("输入非数字字符被过滤", async () => {
    const el = await mount(false);
    const input = el.shadowRoot?.querySelector("input.pin-input") as HTMLInputElement;
    input.value = "12ab34";
    input.dispatchEvent(new Event("input"));
    await elementUpdated(el);
    expect(input.value).toBe("1234");
  });

  it("满 6 位点击登录 → 成功后跳 search 并置 authenticated", async () => {
    loginMock.mockResolvedValueOnce({ ok: true });
    const navSpy = vi.spyOn(router, "navigate").mockImplementation(() => {});
    const el = await mount(false);
    const input = el.shadowRoot?.querySelector("input.pin-input") as HTMLInputElement;
    input.value = "123456";
    input.dispatchEvent(new Event("input"));
    await elementUpdated(el);

    (el.shadowRoot?.querySelector("button.submit") as HTMLButtonElement).click();
    await vi.waitFor(() => expect(loginMock).toHaveBeenCalledWith("123456"));
    await vi.waitFor(() => expect(navSpy).toHaveBeenCalledWith("search"));
    expect(store.getState().auth.authenticated).toBe(true);
  });

  it("401 → 显示后端错误文案并清空输入", async () => {
    loginMock.mockRejectedValueOnce(new ApiError(401, "INVALID_PASSWORD", "密码错误"));
    const el = await mount(false);
    const input = el.shadowRoot?.querySelector("input.pin-input") as HTMLInputElement;
    input.value = "000000";
    input.dispatchEvent(new Event("input"));
    await elementUpdated(el);

    (el.shadowRoot?.querySelector("button.submit") as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(el.shadowRoot?.querySelector(".error")?.textContent).toContain("密码错误");
    });
    expect((el as any)._pin).toBe("");
  });

  it("429 → 显示锁定文案", async () => {
    loginMock.mockRejectedValueOnce(
      new ApiError(429, "AUTH_LOCKED", "失败次数过多，请 300 秒后再试"),
    );
    const el = await mount(false);
    const input = el.shadowRoot?.querySelector("input.pin-input") as HTMLInputElement;
    input.value = "000000";
    input.dispatchEvent(new Event("input"));
    await elementUpdated(el);

    (el.shadowRoot?.querySelector("button.submit") as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(el.shadowRoot?.querySelector(".error")?.textContent).toContain("300 秒");
    });
  });
});

describe("<login-view> 移动键盘流", () => {
  it("点按数字键填充圆点，满 6 位自动提交", async () => {
    loginMock.mockResolvedValueOnce({ ok: true });
    const navSpy = vi.spyOn(router, "navigate").mockImplementation(() => {});
    const el = await mount(true);
    const pad = el.shadowRoot?.querySelector("pin-pad")!;
    for (const d of ["1", "2", "3", "4", "5"]) {
      pad.dispatchEvent(new CustomEvent("digit", { detail: d }));
    }
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelectorAll(".dot.filled").length).toBe(5);

    pad.dispatchEvent(new CustomEvent("digit", { detail: "6" }));
    await vi.waitFor(() => expect(loginMock).toHaveBeenCalledWith("123456"));
    await vi.waitFor(() => expect(navSpy).toHaveBeenCalledWith("search"));
  });

  it("backspace 删除一位", async () => {
    const el = await mount(true);
    const pad = el.shadowRoot?.querySelector("pin-pad")!;
    pad.dispatchEvent(new CustomEvent("digit", { detail: "1" }));
    pad.dispatchEvent(new CustomEvent("digit", { detail: "2" }));
    pad.dispatchEvent(new Event("backspace"));
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelectorAll(".dot.filled").length).toBe(1);
  });
});

describe("<login-view> 桌面自动提交边界", () => {
  it("未满 6 位输入不触发提交", async () => {
    const el = await mount(false);
    const input = el.shadowRoot?.querySelector("input.pin-input") as HTMLInputElement;
    input.value = "12345";
    input.dispatchEvent(new Event("input"));
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 10));
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("输满含非数字的输入（过滤后不足 6 位）不提交", async () => {
    const el = await mount(false);
    const input = el.shadowRoot?.querySelector("input.pin-input") as HTMLInputElement;
    input.value = "12345a";
    input.dispatchEvent(new Event("input"));
    await elementUpdated(el);
    await new Promise((r) => setTimeout(r, 10));
    expect(loginMock).not.toHaveBeenCalled();
  });
});
