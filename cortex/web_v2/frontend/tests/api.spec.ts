import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchApi } from "../src/api/search";
import { streamSSE } from "../src/api/client";

describe("searchApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("builds POST /api/search request and parses response", async () => {
    const mockResponse = {
      results: [{ path: "a.py", snippet: "x", score: 0.5, line: 1, highlights: [] }],
      total: 1,
      query: "x",
      elapsed_ms: 5,
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await searchApi({ query: "x" });
    expect(result.total).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/search",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws ApiError on non-ok response", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ code: "VALIDATION_ERROR", detail: "bad" }),
    });
    await expect(searchApi({ query: "" })).rejects.toThrow();
  });
});

describe("streamSSE", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("parses events terminated by \\r\\n\\r\\n (sse-starlette default)", async () => {
    const chunks = [
      new TextEncoder().encode('event: token\r\ndata: {"text":"hi"}\r\n\r\n'),
      new TextEncoder().encode('event: done\r\ndata: {}\r\n\r\n'),
    ];
    let call = 0;
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: async () =>
            call < chunks.length
              ? { value: chunks[call++], done: false }
              : { value: undefined, done: true },
        }),
      },
    });

    const events = [];
    for await (const ev of streamSSE("/api/chat", { message: "hi" })) {
      events.push(ev);
    }

    expect(events).toEqual([
      { event: "token", data: '{"text":"hi"}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("parses events terminated by \\n\\n (plain LF)", async () => {
    const chunks = [
      new TextEncoder().encode('event: token\ndata: {"text":"a"}\n\n'),
      new TextEncoder().encode('event: token\ndata: {"text":"b"}\n\n'),
    ];
    let call = 0;
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: async () =>
            call < chunks.length
              ? { value: chunks[call++], done: false }
              : { value: undefined, done: true },
        }),
      },
    });

    const events = [];
    for await (const ev of streamSSE("/api/chat", { message: "hi" })) {
      events.push(ev);
    }

    expect(events.length).toBe(2);
    expect(events[0]).toEqual({ event: "token", data: '{"text":"a"}' });
  });

  it("handles payloads split across chunks", async () => {
    const full =
      'event: token\r\ndata: {"text":"hello world"}\r\n\r\n';
    // Split the bytes at arbitrary boundaries
    const mid = 10;
    const chunks = [full.slice(0, mid), full.slice(mid)].map((s) =>
      new TextEncoder().encode(s),
    );
    let call = 0;
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: async () =>
            call < chunks.length
              ? { value: chunks[call++], done: false }
              : { value: undefined, done: true },
        }),
      },
    });

    const events = [];
    for await (const ev of streamSSE("/api/chat", { message: "hi" })) {
      events.push(ev);
    }

    expect(events).toEqual([
      { event: "token", data: '{"text":"hello world"}' },
    ]);
  });

  it("throws ApiError when response is not ok", async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      body: null,
    });
    await expect(
      (async () => {
        for await (const _ev of streamSSE("/api/chat", { message: "hi" })) {
          // no-op
        }
      })(),
    ).rejects.toThrow();
  });
});
