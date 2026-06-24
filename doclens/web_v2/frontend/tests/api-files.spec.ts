import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { filesApi } from "../src/api/files";

describe("filesApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("list builds correct URL", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ path: "", entries: [], total: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.list("");
    const [url] = mocked.mock.calls[0];
    expect(url).toBe("/api/files/list?path=&limit=200&offset=0");
  });

  it("stats encodes path", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ path: "a/b", file_count: 0, dir_count: 0, total_size_bytes: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.stats("a/b");
    const [url] = mocked.mock.calls[0];
    expect(url).toBe("/api/files/stats?path=a%2Fb");
  });

  it("mkdir posts JSON", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, path: "x", reindex_triggered: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.mkdir("x");
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("/api/files/mkdir");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ path: "x" }));
  });

  it("move sends from_paths array", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ moved: ["d/a.md"], skipped: [] }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.move(["a.md"], "d", false);
    const [, init] = mocked.mock.calls[0];
    expect(JSON.parse(init?.body as string)).toEqual({
      from_paths: ["a.md"], dest_dir: "d", overwrite: false,
    });
  });

  it("upload sends FormData", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({
        path: "f.md", bytes_written: 1, overwritten: false, reindex_triggered: true,
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const file = new File(["x"], "f.md");
    await filesApi.upload(file, "", false);
    const [, init] = mocked.mock.calls[0];
    expect(init?.body).toBeInstanceOf(FormData);
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBe(file);
    expect(fd.get("dest_dir")).toBe("");
    expect(fd.get("overwrite")).toBe("false");
  });

  it("remove uses DELETE with query", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, deleted: "a", reindex_triggered: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      }),
    );
    await filesApi.remove("a/b");
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("/api/files?path=a%2Fb");
    expect(init?.method).toBe("DELETE");
  });

  it("throws ApiError on non-2xx", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "PROTECTED", detail: "nope" }), {
        status: 403, headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(filesApi.list(".cortex")).rejects.toMatchObject({
      name: "ApiError", status: 403, code: "PROTECTED",
    });
  });
});
