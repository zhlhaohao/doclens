import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiError, request, setUnauthorizedHandler, streamSSE } from "../src/api/client";

const unauthorized = () => ({
  ok: false,
  status: 401,
  json: async () => ({ code: "UNAUTHORIZED", detail: "需要登录" }),
});

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  setUnauthorizedHandler(null);
});

describe("401 unauthorized handler", () => {
  it("request() calls handler on 401 then still throws ApiError", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    (globalThis.fetch as any).mockResolvedValueOnce(unauthorized());

    await expect(request("/api/status")).rejects.toThrow(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("request() does not call handler on other errors", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ code: "INTERNAL_ERROR", detail: "boom" }),
    });

    await expect(request("/api/status")).rejects.toThrow(ApiError);
    expect(handler).not.toHaveBeenCalled();
  });

  it("request() works without a registered handler", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce(unauthorized());
    await expect(request("/api/status")).rejects.toThrow(ApiError);
  });

  it("streamSSE() calls handler on 401 then throws", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    (globalThis.fetch as any).mockResolvedValueOnce({ ...unauthorized(), body: null });

    const gen = streamSSE("/api/chat", {});
    await expect(gen.next()).rejects.toThrow(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
