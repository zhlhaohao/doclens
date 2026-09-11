/**
 * auth api client 测试——挑战-响应协议（2026-09-11，方案 C）。
 *
 * 断言核心：登录/改密/清密的请求体**只含 proof/nonce/salt/hash**，
 * 明文 PIN 永不进请求体（这是本协议的全部意义，回归红线）。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearPassword, getAuthStatus, login, logout, setPassword } from "../src/api/auth";

const okJson = (body: unknown) => ({ ok: true, json: async () => body });

const CHALLENGE = {
  salt: "ab".repeat(16),
  iterations: 1_000,
  nonce: "cd".repeat(16),
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

/** 断言某次 fetch 调用的 JSON body 不含明文 PIN。 */
const expectNoPlaintextPin = (calls: any[], pin: string) => {
  for (const call of calls) {
    const body = call?.[1]?.body;
    if (typeof body === "string") {
      expect(body.includes(pin)).toBe(false);
    }
  }
};

describe("auth api client（挑战-响应）", () => {
  it("getAuthStatus GETs /api/auth/status", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(
      okJson({ required: true, authenticated: false, has_password: true }),
    );
    const s = await getAuthStatus();
    expect(s).toEqual({ required: true, authenticated: false, has_password: true });
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/auth/status", expect.anything());
  });

  it("login：先取挑战再 POST proof+nonce——请求体不含明文 PIN", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce(okJson(CHALLENGE))
      .mockResolvedValueOnce(okJson({ ok: true }));
    await login("123456");
    const calls = (globalThis.fetch as any).mock.calls;
    expect(calls[0][0]).toBe("/api/auth/challenge");
    expect(calls[1][0]).toBe("/api/auth/login");
    const body = JSON.parse(calls[1][1].body);
    expect(Object.keys(body).sort()).toEqual(["nonce", "proof"]);
    expect(body.nonce).toBe(CHALLENGE.nonce);
    expect(body.proof).toMatch(/^[0-9a-f]{64}$/);
    expectNoPlaintextPin(calls, "123456");
  });

  it("login：无挑战可用（400）时退明文兼容路径", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });
    (globalThis.fetch as any).mockResolvedValueOnce(okJson({ ok: true }));
    await login("123456");
    const calls = (globalThis.fetch as any).mock.calls;
    expect(calls[1][1].body).toBe(JSON.stringify({ password: "123456" }));
  });

  it("logout POSTs without body", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(okJson({ ok: true }));
    await logout();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("setPassword：旧 proof + 客户端预哈希——明文 PIN 不上线", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce(okJson(CHALLENGE))
      .mockResolvedValueOnce(okJson({ ok: true }));
    await setPassword("111111", "222222");
    const calls = (globalThis.fetch as any).mock.calls;
    expect(calls[0][0]).toBe("/api/auth/challenge");
    expect(calls[1][0]).toBe("/api/auth/password");
    expect(calls[1][1].method).toBe("PUT");
    const body = JSON.parse(calls[1][1].body);
    expect(Object.keys(body).sort()).toEqual(["new_hash", "new_salt", "old_nonce", "old_proof"]);
    expect(body.new_salt).toMatch(/^[0-9a-f]{32}$/);
    expect(body.new_hash).toMatch(/^[0-9a-f]{64}$/);
    expectNoPlaintextPin(calls, "111111");
    expectNoPlaintextPin(calls, "222222");
  });

  it("setPassword 首次设置（无旧密码）不带 proof 字段", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(okJson({ ok: true }));
    await setPassword(null, "222222");
    const calls = (globalThis.fetch as any).mock.calls;
    // 无旧密码 → 不取挑战，直接 PUT
    expect(calls[0][0]).toBe("/api/auth/password");
    const body = JSON.parse(calls[0][1].body);
    expect(body.old_proof).toBeUndefined();
    expect(body.old_nonce).toBeUndefined();
  });

  it("clearPassword：proof+nonce——不含明文 PIN", async () => {
    (globalThis.fetch as any)
      .mockResolvedValueOnce(okJson(CHALLENGE))
      .mockResolvedValueOnce(okJson({ ok: true }));
    await clearPassword("123456");
    const calls = (globalThis.fetch as any).mock.calls;
    expect(calls[1][0]).toBe("/api/auth/password");
    expect(calls[1][1].method).toBe("DELETE");
    const body = JSON.parse(calls[1][1].body);
    expect(Object.keys(body).sort()).toEqual(["nonce", "proof"]);
    expectNoPlaintextPin(calls, "123456");
  });
});
