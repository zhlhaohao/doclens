import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("searchFilenames（/files/search 服务端化）", () => {
  const originalFetch = globalThis.fetch;
  let searchFilenames: typeof import("../src/api/documents").searchFilenames;

  beforeEach(async () => {
    globalThis.fetch = vi.fn() as any;
    ({ searchFilenames } = await import("../src/api/documents"));
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("maps snake_case hits to camelCase with defaults", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { path: "docs/a.md", name: "a.md", size: 100, modified_at: "2026-10-25T00:00:00Z" },
          { path: "b.py", name: "b.py", size: 0, modified_at: null, ghost: true },
        ],
        total: 2,
      }),
    });
    const { results, total } = await searchFilenames("a");
    expect(total).toBe(2);
    expect(results[0]).toEqual({
      path: "docs/a.md", name: "a.md", size: 100,
      modifiedAt: "2026-10-25T00:00:00Z", ghost: false,
    });
    // modified_at null（磁盘缺失）→ 空串；ghost 透传
    expect(results[1]).toEqual({
      path: "b.py", name: "b.py", size: 0, modifiedAt: "", ghost: true,
    });
  });

  it("URL-encodes query and passes limit", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ results: [], total: 0 }),
    });
    await searchFilenames("部署 note", 50);
    const [url] = (globalThis.fetch as any).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/files/search?q=");
    expect(url).toContain(encodeURIComponent("部署 note"));
    expect(url).toContain("limit=50");
  });

  it("propagates non-2xx as error", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ code: "INTERNAL", detail: "boom" }),
    });
    await expect(searchFilenames("x")).rejects.toThrow();
  });
});
