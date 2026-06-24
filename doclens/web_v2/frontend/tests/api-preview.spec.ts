import { describe, it, expect, vi, afterEach } from "vitest";
import { savePreview, PreviewSaveError, fetchPreview, isFullFilePreview } from "../src/api/preview";

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

describe("isFullFilePreview", () => {
  it("returns true for .md/.pdf/.docx/.xlsx/.xlsm/.xltx/.xltm/.csv", () => {
    for (const p of ["x.md", "a.pdf", "b.docx", "c.xlsx", "d.xlsm", "e.xltx", "f.xltm", "g.csv"]) {
      expect(isFullFilePreview(p)).toBe(true);
    }
  });
  it("returns false for other extensions", () => {
    for (const p of ["x.py", "y.txt", "z.html", "noext"]) {
      expect(isFullFilePreview(p)).toBe(false);
    }
  });
  it("is case-insensitive on suffix", () => {
    expect(isFullFilePreview("X.PDF")).toBe(true);
    expect(isFullFilePreview("X.Md")).toBe(true);
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
          line_range: null, highlights: [], writable: true,
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
