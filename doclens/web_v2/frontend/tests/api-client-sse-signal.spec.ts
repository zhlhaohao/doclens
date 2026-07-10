import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { streamSSE } from "../src/api/client";

describe("streamSSE signal passthrough", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes signal to fetch when provided", async () => {
    const ctrl = new AbortController();
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
    });

    try {
      for await (const _ev of streamSSE("/api/x", {}, ctrl.signal)) { void _ev; break; }
    } catch { /* aborted/empty ok */ }

    const callInit = (globalThis.fetch as any).mock.calls[0][1] as RequestInit;
    expect(callInit.signal).toBe(ctrl.signal);
  });

  it("omits signal when not provided (no regression)", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      body: { getReader: () => ({ read: async () => ({ done: true, value: undefined }) }) },
    });
    try {
      for await (const _ev of streamSSE("/api/x", {})) { void _ev; break; }
    } catch { /* ok */ }
    const callInit = (globalThis.fetch as any).mock.calls[0][1] as RequestInit;
    expect(callInit.signal).toBeUndefined();
  });
});
