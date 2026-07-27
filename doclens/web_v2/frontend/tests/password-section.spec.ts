import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

import "../src/components/password-section";
import type { PasswordSection } from "../src/components/password-section";
import { store, INITIAL_STATE } from "../src/state/store";
import * as authApi from "../src/api/auth";

vi.mock("../src/api/auth", () => ({
  getAuthStatus: vi.fn(),
  setPassword: vi.fn(),
  clearPassword: vi.fn(),
  logout: vi.fn(),
}));

const statusMock = authApi.getAuthStatus as ReturnType<typeof vi.fn>;
const setMock = authApi.setPassword as ReturnType<typeof vi.fn>;
const clearMock = authApi.clearPassword as ReturnType<typeof vi.fn>;

function stubStatus(required: boolean, hasPassword: boolean) {
  statusMock.mockResolvedValue({
    required,
    authenticated: !required,
    has_password: hasPassword,
  });
}

beforeEach(() => {
  store.setState({ ...INITIAL_STATE, auth: { ...INITIAL_STATE.auth } });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function mount(required: boolean, hasPassword: boolean): Promise<PasswordSection> {
  stubStatus(required, hasPassword);
  const el = await fixture<PasswordSection>(html`<password-section></password-section>`);
  await elementUpdated(el);
  // connectedCallback 里的 _refresh 是异步的，等它落地
  await vi.waitFor(() => expect((el as any)._hasPassword).toBe(hasPassword));
  await elementUpdated(el);
  return el;
}

function setInput(el: PasswordSection, placeholder: string, value: string) {
  const input = Array.from(el.shadowRoot?.querySelectorAll("input") ?? []).find(
    (i) => i.placeholder === placeholder,
  ) as HTMLInputElement | undefined;
  if (!input) throw new Error(`input "${placeholder}" not found`);
  input.value = value;
  input.dispatchEvent(new Event("input"));
}

describe("<password-section> 未设密码", () => {
  it("显示警示条 + 设置表单（无旧密码框），无退出登录按钮", async () => {
    const el = await mount(false, false);
    expect(el.shadowRoot?.querySelector(".warning")?.textContent).toContain("尚未设置");
    expect(el.shadowRoot?.querySelector(".badge")).toBeNull();
    const placeholders = Array.from(el.shadowRoot?.querySelectorAll("input") ?? []).map(
      (i) => i.placeholder,
    );
    expect(placeholders).not.toContain("旧密码");
    expect(placeholders).not.toContain("当前密码");
    const buttons = Array.from(el.shadowRoot?.querySelectorAll("button") ?? []).map(
      (b) => b.textContent?.trim(),
    );
    expect(buttons).toContain("设置密码");
    expect(buttons).not.toContain("退出登录");
  });

  it("首次设置：setPassword(null, next)", async () => {
    setMock.mockResolvedValueOnce({ ok: true });
    const el = await mount(false, false);
    setInput(el, "新密码（6 位数字）", "123456");
    setInput(el, "确认新密码", "123456");
    await elementUpdated(el);
    const btn = Array.from(el.shadowRoot?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.trim() === "设置密码",
    ) as HTMLButtonElement;
    btn.click();
    await vi.waitFor(() => expect(setMock).toHaveBeenCalledWith(null, "123456"));
  });

  it("两次输入不一致 → 内联报错，不调接口", async () => {
    const el = await mount(false, false);
    setInput(el, "新密码（6 位数字）", "123456");
    setInput(el, "确认新密码", "654321");
    await elementUpdated(el);
    const btn = Array.from(el.shadowRoot?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.trim() === "设置密码",
    ) as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".feedback")?.textContent).toContain("不一致");
    expect(setMock).not.toHaveBeenCalled();
  });

  it("非 6 位数字 → 内联报错，不调接口", async () => {
    const el = await mount(false, false);
    setInput(el, "新密码（6 位数字）", "12345");
    setInput(el, "确认新密码", "12345");
    await elementUpdated(el);
    const btn = Array.from(el.shadowRoot?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.trim() === "设置密码",
    ) as HTMLButtonElement;
    btn.click();
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector(".feedback")?.textContent).toContain("6 位数字");
    expect(setMock).not.toHaveBeenCalled();
  });
});

describe("<password-section> 已设密码", () => {
  it("显示徽标 + 旧密码框 + 清除按钮", async () => {
    const el = await mount(true, true);
    expect(el.shadowRoot?.querySelector(".badge")?.textContent).toContain("已设置");
    const placeholders = Array.from(el.shadowRoot?.querySelectorAll("input") ?? []).map(
      (i) => i.placeholder,
    );
    expect(placeholders).toContain("旧密码");
    expect(placeholders).toContain("当前密码");
  });

  it("修改密码：setPassword(old, next)", async () => {
    setMock.mockResolvedValueOnce({ ok: true });
    const el = await mount(true, true);
    setInput(el, "旧密码", "111111");
    setInput(el, "新密码（6 位数字）", "222222");
    setInput(el, "确认新密码", "222222");
    await elementUpdated(el);
    const btn = Array.from(el.shadowRoot?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.trim() === "修改密码",
    ) as HTMLButtonElement;
    btn.click();
    await vi.waitFor(() => expect(setMock).toHaveBeenCalledWith("111111", "222222"));
  });

  it("清除密码：clearPassword(current)", async () => {
    clearMock.mockResolvedValueOnce({ ok: true });
    const el = await mount(true, true);
    setInput(el, "当前密码", "111111");
    await elementUpdated(el);
    const btn = Array.from(el.shadowRoot?.querySelectorAll("button") ?? []).find(
      (b) => b.textContent?.trim() === "清除密码",
    ) as HTMLButtonElement;
    btn.click();
    await vi.waitFor(() => expect(clearMock).toHaveBeenCalledWith("111111"));
  });

  it("闸门生效时显示退出登录按钮；环回时不显示", async () => {
    const gated = await mount(true, true);
    const gatedButtons = Array.from(gated.shadowRoot?.querySelectorAll("button") ?? []).map(
      (b) => b.textContent?.trim(),
    );
    expect(gatedButtons).toContain("退出登录");

    const loopback = await mount(false, true);
    const loopbackButtons = Array.from(
      loopback.shadowRoot?.querySelectorAll("button") ?? [],
    ).map((b) => b.textContent?.trim());
    expect(loopbackButtons).not.toContain("退出登录");
  });
});
