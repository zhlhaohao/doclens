import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { store, INITIAL_STATE } from "../src/state/store";
import { startWatchStream, stopWatchStream } from "../src/watch-stream";

const encode = (s: string): Uint8Array => new TextEncoder().encode(s);
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** 把若干 SSE 事件块喂给 streamSSE：mock fetch 返回一个可控 reader。
 *  队列消费完后 read() 挂起，直到 abort 才 reject（模拟长连接被客户端断开）。 */
function mockSSEChunks(chunks: string[]) {
  const queue = [...chunks];
  const fn = vi.fn((_path: string, init: RequestInit) => {
    const signal = init.signal as AbortSignal | undefined;
    return Promise.resolve({
      ok: true,
      body: {
        getReader: () => ({
          read: () => {
            if (signal?.aborted) return Promise.reject(new Error("aborted"));
            if (queue.length) {
              return Promise.resolve({ value: encode(queue.shift() as string), done: false });
            }
            return new Promise((_resolve, reject) => {
              signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
            });
          },
        }),
      },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("watch-stream", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE });
  });
  afterEach(() => {
    stopWatchStream();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("status event writes watcher + recent_changes to store", async () => {
    const snapshot = {
      enabled: true,
      watcher: {
        running: true, reindexing: false, changed_count: 2,
        last_reindex_at: 100, last_doc_count: 5, last_success: true,
      },
      recent_changes: [{ path: "a/b.md", name: "b.md", ts: 50 }],
    };
    mockSSEChunks([`event: status\ndata: ${JSON.stringify(snapshot)}\n\n`]);

    startWatchStream();
    await flush();

    const s = store.getState();
    expect(s.watcher?.last_doc_count).toBe(5);
    expect(s.watcher?.changed_count).toBe(2);
    expect(s.watchRecentChanges).toHaveLength(1);
    expect(s.watchRecentChanges[0].name).toBe("b.md");
  });

  it("reindexed event dispatches cortex:watch-reindexed with doc_count", async () => {
    mockSSEChunks([
      `event: status\ndata: ${JSON.stringify({ watcher: null, recent_changes: [] })}\n\n`,
      `event: reindexed\ndata: ${JSON.stringify({ success: true, doc_count: 9, failed_count: 0 })}\n\n`,
    ]);
    const handler = vi.fn();
    window.addEventListener("cortex:watch-reindexed", handler);

    startWatchStream();
    await flush();

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail.doc_count).toBe(9);
    window.removeEventListener("cortex:watch-reindexed", handler);
  });

  it("reconnects after a network error (streamSSE throws)", async () => {
    vi.useFakeTimers();
    const fn = vi.fn((_p: string, _i: RequestInit) => Promise.reject(new Error("net down")));
    vi.stubGlobal("fetch", fn);

    startWatchStream();
    await vi.advanceTimersByTimeAsync(0); // 首次尝试失败
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000); // 退避后重连
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stopWatchStream halts the loop (no reconnect)", async () => {
    const fn = mockSSEChunks([
      `event: status\ndata: ${JSON.stringify({
        watcher: {
          running: true, reindexing: false, changed_count: 0,
          last_reindex_at: 1, last_doc_count: 3, last_success: true,
        },
        recent_changes: [],
      })}\n\n`,
    ]);

    startWatchStream();
    await flush();
    expect(store.getState().watcher?.last_doc_count).toBe(3);

    stopWatchStream();
    await new Promise((r) => setTimeout(r, 20)); // 真实等待，确认不再 fetch
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
