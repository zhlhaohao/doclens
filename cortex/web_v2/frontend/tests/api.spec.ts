import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchApi } from "../src/api/search";

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
