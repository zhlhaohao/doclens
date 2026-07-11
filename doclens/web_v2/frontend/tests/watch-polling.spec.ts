import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { store, INITIAL_STATE } from "../src/state/store";
import { startWatchPolling, stopWatchPolling } from "../src/watch-polling";

function mockWatch(resp: any) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => resp,
  }));
}

describe("watch-polling", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE });
    vi.useFakeTimers();
  });
  afterEach(() => {
    stopWatchPolling();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("first tick writes watcher without dispatching toast event", async () => {
    mockWatch({ enabled: true, watcher: {
      running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 100, last_doc_count: 5, last_success: true } });
    const handler = vi.fn();
    window.addEventListener("cortex:watch-reindexed", handler);

    startWatchPolling();
    await vi.advanceTimersByTimeAsync(0); // 首次立即 tick

    expect(store.getState().watcher?.last_doc_count).toBe(5);
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener("cortex:watch-reindexed", handler);
  });

  it("changed last_reindex_at dispatches reindexed event", async () => {
    mockWatch({ enabled: true, watcher: {
      running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 200, last_doc_count: 6, last_success: true } });
    const handler = vi.fn();
    window.addEventListener("cortex:watch-reindexed", handler);

    startWatchPolling();
    await vi.advanceTimersByTimeAsync(0); // 首次（100→记录，不弹）
    // 切换 mock 为新 last_reindex_at
    mockWatch({ enabled: true, watcher: {
      running: true, reindexing: false, changed_count: 0,
      last_reindex_at: 300, last_doc_count: 7, last_success: true } });
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: true, watcher: {
        running: true, reindexing: false, changed_count: 0,
        last_reindex_at: 300, last_doc_count: 7, last_success: true } }),
    });

    await vi.advanceTimersByTimeAsync(5000); // 第二次 tick → 弹

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail.doc_count).toBe(7);
    window.removeEventListener("cortex:watch-reindexed", handler);
  });

  it("swallows fetch errors silently", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("net")));
    startWatchPolling();
    await vi.advanceTimersByTimeAsync(0);
    // 不抛错即通过；watcher 保持 null
    expect(store.getState().watcher).toBeNull();
  });
});
