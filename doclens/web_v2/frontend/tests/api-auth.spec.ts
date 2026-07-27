import { describe, it, expect, vi, beforeEach } from "vitest";
import { clearPassword, getAuthStatus, login, logout, setPassword } from "../src/api/auth";

const okJson = (body: unknown) => ({ ok: true, json: async () => body });

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("auth api client", () => {
  it("getAuthStatus GETs /api/auth/status", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(
      okJson({ required: true, authenticated: false, has_password: true }),
    );
    const s = await getAuthStatus();
    expect(s).toEqual({ required: true, authenticated: false, has_password: true });
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/auth/status", expect.anything());
  });

  it("login POSTs password", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(okJson({ ok: true }));
    await login("123456");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ password: "123456" }),
      }),
    );
  });

  it("logout POSTs without body", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(okJson({ ok: true }));
    await logout();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("setPassword PUTs old/new password", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(okJson({ ok: true }));
    await setPassword("111111", "222222");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/password",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ old_password: "111111", new_password: "222222" }),
      }),
    );
  });

  it("setPassword allows null old password (首次设置)", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(okJson({ ok: true }));
    await setPassword(null, "222222");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/password",
      expect.objectContaining({
        body: JSON.stringify({ old_password: null, new_password: "222222" }),
      }),
    );
  });

  it("clearPassword DELETEs with current password", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(okJson({ ok: true }));
    await clearPassword("123456");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/auth/password",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ password: "123456" }),
      }),
    );
  });
});
