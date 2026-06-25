import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadPreview } from "../src/api/preview";

describe("uploadPreview", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs multipart form and returns parsed response", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          path: "doc1.md",
          bytes_written: 5,
          reindex_triggered: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const file = new File(["hello"], "doc1_a1b2c3.md", { type: "text/markdown" });
    const result = await uploadPreview(file);

    expect(mocked).toHaveBeenCalledTimes(1);
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("/api/preview/upload");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("file")).toBe(file);
    expect(result).toEqual({
      path: "doc1.md",
      bytes_written: 5,
      reindex_triggered: true,
    });
  });

  it("throws PreviewUploadError with code+message on failure", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ code: "NOT_INDEXED", detail: "hash+stem 不匹配" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    const file = new File(["x"], "wrong_deadbe.md");
    await expect(uploadPreview(file)).rejects.toMatchObject({
      name: "PreviewUploadError",
      code: "NOT_INDEXED",
      message: "hash+stem 不匹配",
      status: 404,
    });
  });

  it("falls back to UNKNOWN code when body is not JSON", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response("plain text", { status: 500 }),
    );

    const file = new File(["x"], "doc1_a1b2c3.md");
    await expect(uploadPreview(file)).rejects.toMatchObject({
      code: "UNKNOWN",
      status: 500,
    });
  });
});
