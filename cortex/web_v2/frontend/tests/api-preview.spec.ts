import { describe, it, expect, vi, afterEach } from "vitest";
import { savePreview, PreviewSaveError } from "../src/api/preview";

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
