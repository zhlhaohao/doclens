import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchApi } from "../src/api/search";
import { streamSSE, StreamIdleTimeoutError } from "../src/api/client";

describe("searchApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("builds POST /api/search request and parses response", async () => {
    const mockResponse = {
      groups: [{ path: "a.py", best_score: 0.9, total_matches: 1, matches: [{ line: 1, text: "x", spans: [] }], kind: "content", truncated: false }],
      total: 1,
      total_matches: 1,
      query: "x",
      elapsed_ms: 5,
    };
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await searchApi({ query: "x" });
    expect(result.total).toBe(1);
    expect(result.groups[0].path).toBe("a.py");
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

  it("skips SSE comment/keep-alive blocks (no event/data fields)", async () => {
    // sse_starlette 的保活 ping 是注释行 ": ping - <ts>"，无字段语义
    const chunks = [
      new TextEncoder().encode(": ping - 2026-11-17T00:00:00Z\r\n\r\n"),
      new TextEncoder().encode('event: token\r\ndata: {"text":"hi"}\r\n\r\n'),
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

    expect(events).toEqual([{ event: "token", data: '{"text":"hi"}' }]);
  });

  it("半开连接静默超时：取消底层 reader 并抛出专用错误", async () => {
    vi.useFakeTimers();
    try {
      const cancel = vi.fn(async () => {});
      const releaseLock = vi.fn();
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () => new Promise(() => {}), // 不报错也不 done，模拟 5G 半开连接
            cancel,
            releaseLock,
          }),
        },
      });
      const consume = (async () => {
        for await (const _ev of streamSSE("/api/chat", {}, undefined, 45_000)) { /* 不应产出 */ }
      })();
      const assertion = expect(consume).rejects.toBeInstanceOf(StreamIdleTimeoutError);
      await vi.advanceTimersByTimeAsync(45_000);
      await assertion;
      expect(cancel).toHaveBeenCalledOnce();
      expect(releaseLock).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("纯注释 ping 虽不产出业务事件，也刷新静默超时", async () => {
    vi.useFakeTimers();
    try {
      let reads = 0;
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              reads++;
              if (reads === 1) return { value: new TextEncoder().encode(": ping\r\n\r\n"), done: false };
              return new Promise(() => {});
            },
            cancel: async () => {},
            releaseLock: () => {},
          }),
        },
      });
      const consume = (async () => {
        for await (const _ev of streamSSE("/api/chat", {}, undefined, 45_000)) { /* ping 不产出 */ }
      })();
      const assertion = expect(consume).rejects.toBeInstanceOf(StreamIdleTimeoutError);
      // 第一次 ping 到达前的 44.999s 不计入 ping 后的新静默窗口。
      await vi.advanceTimersByTimeAsync(44_999);
      await vi.advanceTimersByTimeAsync(44_999);
      expect(reads).toBe(2);
      await vi.advanceTimersByTimeAsync(1);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("未启用静默超时的其他 SSE 消费方保持原行为", async () => {
    vi.useFakeTimers();
    try {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => ({ read: () => new Promise(() => {}), releaseLock: () => {} }) },
      });
      let settled = false;
      const consume = (async () => {
        for await (const _ev of streamSSE("/api/x", {})) { void _ev; }
      })().finally(() => { settled = true; });
      void consume;
      await vi.advanceTimersByTimeAsync(120_000);
      expect(settled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
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
