import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getWatchStatus, getStatus } from "../src/api/status";

describe("api/status", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getWatchStatus parses enabled + watcher snapshot", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: true,
        watcher: {
          running: true, reindexing: false, changed_count: 2,
          last_reindex_at: 1234.5, last_doc_count: 42, last_success: true,
        },
      }),
    });
    const res = await getWatchStatus();
    expect(res.enabled).toBe(true);
    expect(res.watcher?.running).toBe(true);
    expect(res.watcher?.changed_count).toBe(2);
  });

  it("getWatchStatus handles watcher:null", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ enabled: false, watcher: null }),
    });
    const res = await getWatchStatus();
    expect(res.watcher).toBeNull();
    expect(res.enabled).toBe(false);
  });

  it("getWatchStatus throws on non-ok", async () => {
    (globalThis.fetch as any).mockResolvedValue({ ok: false, statusText: "err" });
    await expect(getWatchStatus()).rejects.toThrow();
  });

  it("getStatus parses full status incl watcher", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        indexed_docs: 3, index_path: "/x", workdir: "/Users/me/docs",
        total_size_bytes: 10, file_types: { ".md": 3 },
        watcher: { enabled: true, running: false, reindexing: false,
          changed_count: 0, last_reindex_at: null, last_doc_count: null, last_success: null },
      }),
    });
    const res = await getStatus();
    expect(res.indexed_docs).toBe(3);
    expect(res.watcher?.enabled).toBe(true);
    expect(res.workdir).toBe("/Users/me/docs");
  });
});
