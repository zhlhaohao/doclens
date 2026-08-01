import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { diaryApi } from "../src/api/diary";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200, headers: { "Content-Type": "application/json" },
  });

describe("diaryApi", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("today builds correct URL", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(ok({ today: "2026-08-01", entry: { date: "2026-08-01", state: "empty", fragments: [], content: "" } }));
    await diaryApi.today();
    expect(mocked.mock.calls[0][0]).toBe("/api/diary/today");
  });

  it("entry encodes date", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(ok({ date: "2026-08-01", state: "empty", fragments: [], content: "" }));
    await diaryApi.entry("2026-08-01");
    expect(mocked.mock.calls[0][0]).toBe("/api/diary/entry?date=2026-08-01");
  });

  it("calendar builds month query", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(ok({ month: "2026-08", dates: [] }));
    await diaryApi.calendar("2026-08");
    expect(mocked.mock.calls[0][0]).toBe("/api/diary/calendar?month=2026-08");
  });

  it("addText posts JSON", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(ok({ fragment: { fid: "x", time: "09:15", kind: "text", text: "hi", image_url: null } }));
    await diaryApi.addText("hi");
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("/api/diary/fragments");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ text: "hi" }));
  });

  it("uploadPhoto sends FormData with caption", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(ok({ fragment: { fid: "x", time: "18:30", kind: "photo", text: "晚霞", image_url: "/api/preview/raw?path=x" } }));
    const file = new File(["img"], "p.jpg", { type: "image/jpeg" });
    await diaryApi.uploadPhoto(file, "晚霞");
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("/api/diary/photos");
    expect(init?.method).toBe("POST");
    const fd = init?.body as FormData;
    expect(fd.get("file")).toBe(file);
    expect(fd.get("caption")).toBe("晚霞");
  });

  it("removeFragment uses DELETE with date query", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(ok({ deleted: true }));
    await diaryApi.removeFragment("2026-08-01", "091500-ab12");
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("/api/diary/fragments/091500-ab12?date=2026-08-01");
    expect(init?.method).toBe("DELETE");
  });

  it("throws ApiError on non-2xx", async () => {
    const mocked = vi.mocked(fetch);
    mocked.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "INVALID_INPUT", detail: "bad" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      }),
    );
    await expect(diaryApi.entry("bad")).rejects.toMatchObject({
      name: "ApiError", status: 400, code: "INVALID_INPUT",
    });
  });
});
