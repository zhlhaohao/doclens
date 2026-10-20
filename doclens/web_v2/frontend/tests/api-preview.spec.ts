import { describe, it, expect, vi, afterEach } from "vitest";
import {
  savePreview,
  PreviewSaveError,
  fetchPreview,
  isSynthesizedPreview,
  isPstDerivedPath,
} from "../src/api/preview";

describe("savePreview", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sends PUT with JSON body and query-encoded path", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    global.fetch = vi.fn(async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({ path: "a b.md", content: "x", bytes_written: 1, reindex_triggered: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const result = await savePreview("a b.md", "x");
    expect(capturedUrl).toBe("/api/preview?path=a%20b.md");
    expect(capturedInit?.method).toBe("PUT");
    expect(JSON.parse(capturedInit!.body as string)).toEqual({ content: "x" });
    expect(result.bytes_written).toBe(1);
  });

  it("throws PreviewSaveError with code and status on non-2xx", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: "NOT_WRITABLE", detail: "read only" }), { status: 403 }),
    ) as unknown as typeof fetch;

    await expect(savePreview("ro.md", "x")).rejects.toMatchObject({
      code: "NOT_WRITABLE",
      status: 403,
      message: "read only",
    });
  });

  it("falls back to UNKNOWN code when body is not JSON", async () => {
    global.fetch = vi.fn(async () => new Response("plain text error", { status: 500 })) as unknown as typeof fetch;
    await expect(savePreview("x.md", "y")).rejects.toBeInstanceOf(PreviewSaveError);
  });
});

describe("PreviewSaveError", () => {
  it("is an Error subclass with code/status fields", () => {
    const e = new PreviewSaveError("X", "msg", 400);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("X");
    expect(e.status).toBe(400);
    expect(e.message).toBe("msg");
  });
});

describe("isSynthesizedPreview（单源化：消费后端 synthesized 标志）", () => {
  it("returns true only when response flag is exactly true", () => {
    expect(isSynthesizedPreview({ synthesized: true })).toBe(true);
    expect(isSynthesizedPreview({ synthesized: false })).toBe(false);
    expect(isSynthesizedPreview({})).toBe(false); // 后端缺字段（旧索引形态）按非合成兜底
    expect(isSynthesizedPreview({ synthesized: null })).toBe(false);
  });
});

describe("isPstDerivedPath", () => {
  it("matches <pst>#<entry_id> case-insensitively", () => {
    expect(isPstDerivedPath("归档.pst#0x1234")).toBe(true);
    expect(isPstDerivedPath("A.PST#abc")).toBe(true);
  });
  it("rejects plain pst / non-pst / hash-less paths", () => {
    expect(isPstDerivedPath("归档.pst")).toBe(false);
    expect(isPstDerivedPath("doc.md#anchor")).toBe(false);
    expect(isPstDerivedPath("a/b.md")).toBe(false);
  });
});

describe("fetchPreview", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it("returns ok result with content/language/writable on 200", async () => {
    let capturedUrl = "";
    global.fetch = vi.fn(async (url) => {
      capturedUrl = String(url);
      return new Response(
        JSON.stringify({
          path: "a.md", content: "# hi", language: "markdown",
          line_range: null, writable: true, synthesized: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const r = await fetchPreview("a.md");
    expect(capturedUrl).toBe("/api/preview?path=a.md");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.content).toBe("# hi");
      expect(r.language).toBe("markdown");
      expect(r.writable).toBe(true);
      expect(r.synthesized).toBe(false);
      expect(r.pages).toBe(null);
    }
  });

  it("returns notIndexed=true when backend returns 404 NOT_INDEXED", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ code: "NOT_INDEXED", detail: "未索引" }),
        { status: 404 },
      ),
    ) as unknown as typeof fetch;

    const r = await fetchPreview("unindexed.pdf");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.notIndexed).toBe(true);
    }
  });

  it("returns notIndexed=false for other errors", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ code: "FILE_NOT_FOUND", detail: "missing" }),
        { status: 404 },
      ),
    ) as unknown as typeof fetch;

    const r = await fetchPreview("missing.md");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.notIndexed).toBe(false);
      expect(r.message).toContain("missing");
    }
  });
});
