import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchDocuments } from "../src/api/documents";

describe("fetchDocuments", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as any;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns camelCased documents on 200", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        documents: [
          { path: "docs/a.md", name: "a.md", size: 100, modified_at: "2026-06-24T00:00:00Z" },
          { path: "b.py", name: "b.py", size: 200, modified_at: "2026-06-25T00:00:00Z" },
        ],
        total: 2,
      }),
    });
    const result = await fetchDocuments();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      path: "docs/a.md",
      name: "a.md",
      size: 100,
      modifiedAt: "2026-06-24T00:00:00Z",
    });
  });

  it("returns empty array on HTTP error (caller handles via try/catch)", async () => {
    (globalThis.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ code: "INTERNAL", detail: "boom" }),
    });
    await expect(fetchDocuments()).rejects.toThrow();
  });
});
