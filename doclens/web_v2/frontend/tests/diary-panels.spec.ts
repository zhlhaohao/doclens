import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fixture, html } from "@open-wc/testing";
import "../src/components/diary-record-panel";
import "../src/components/diary-review-panel";
import "../src/views/diary-view";
import type { DiaryRecordPanel } from "../src/components/diary-record-panel";
import type { DiaryReviewPanel } from "../src/components/diary-review-panel";
import type { DiaryEntry } from "../src/state/types";
import { store, actions, INITIAL_STATE } from "../src/state/store";

const rawEntry: DiaryEntry = {
  date: "2026-08-01",
  state: "raw",
  fragments: [
    { fid: "a", time: "09:15", kind: "text", text: "早上喝了咖啡", image_url: null },
    { fid: "b", time: "18:30", kind: "photo", text: "晚霞", image_url: "/api/preview/raw?path=x" },
  ],
  content: "",
  city: "",
};

const summarizedEntry: DiaryEntry = {
  date: "2026-07-31",
  state: "summarized",
  fragments: [],
  content: "今天过得很充实。",
  city: "",
};

describe("diary-record-panel", () => {
  it("renders fragments newest first", async () => {
    const el = await fixture<DiaryRecordPanel>(html`
      <diary-record-panel .entry=${rawEntry}></diary-record-panel>
    `);
    const times = [...el.shadowRoot!.querySelectorAll(".frag .time")].map((t) => t.textContent);
    expect(times).toEqual(["18:30", "09:15"]); // 最新在上
  });

  it("delete needs two taps (confirm state)", async () => {
    const el = await fixture<DiaryRecordPanel>(html`
      <diary-record-panel .entry=${rawEntry}></diary-record-panel>
    `);
    const deleted: string[] = [];
    el.addEventListener("delete-fragment", (e) => {
      deleted.push((e as CustomEvent<{ fid: string }>).detail.fid);
    });
    const delBtn = el.shadowRoot!.querySelector<HTMLButtonElement>(".del-btn")!;
    delBtn.click(); // 第一次：进入确认态
    expect(deleted).toEqual([]);
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>(".del-btn")!.click(); // 第二次：真删
    expect(deleted).toEqual(["b"]); // 最新在上的第一条是 fid=b
  });

  it("shows empty hint when no fragments", async () => {
    const el = await fixture<DiaryRecordPanel>(html`
      <diary-record-panel .entry=${{ ...rawEntry, fragments: [] }}></diary-record-panel>
    `);
    expect(el.shadowRoot!.textContent).toContain("今天还没有记录");
  });

  // ---- 拍照/相册双路径（浏览器 input vs webview jsbridge） ----

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as unknown as { jsbridge?: unknown }).jsbridge;
    delete (window as unknown as { Android?: unknown }).Android;
  });

  it("browser: photo buttons click hidden file inputs", async () => {
    const el = await fixture<DiaryRecordPanel>(html`
      <diary-record-panel .entry=${rawEntry}></diary-record-panel>
    `);
    const captureInput = el.shadowRoot!.querySelector<HTMLInputElement>("input[data-capture]")!;
    const galleryInput = el.shadowRoot!.querySelector<HTMLInputElement>("input[data-gallery]")!;
    const captureClick = vi.spyOn(captureInput, "click").mockImplementation(() => {});
    const galleryClick = vi.spyOn(galleryInput, "click").mockImplementation(() => {});
    [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(".photo-btn")]
      .find((b) => b.textContent!.includes("拍照"))!.click();
    [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(".photo-btn")]
      .find((b) => b.textContent!.includes("相册"))!.click();
    expect(captureClick).toHaveBeenCalledTimes(1);
    expect(galleryClick).toHaveBeenCalledTimes(1);
  });

  it("webview: photo buttons route to jsbridge instead of file inputs", async () => {
    (window as unknown as { Android: unknown }).Android = { messageSend: vi.fn() };
    const takePhoto = vi.fn((h: { success?: (r: unknown) => void }) =>
      h.success?.({ code: 0, base64: "AAAA", mimeType: "image/jpeg", width: 1, height: 1, size: 3 }));
    const pickPhotos = vi.fn();
    (window as unknown as { jsbridge?: unknown }).jsbridge = { takePhoto, pickPhotos };

    const el = await fixture<DiaryRecordPanel>(html`
      <diary-record-panel .entry=${rawEntry}></diary-record-panel>
    `);
    const captureInput = el.shadowRoot!.querySelector<HTMLInputElement>("input[data-capture]")!;
    const captureClick = vi.spyOn(captureInput, "click").mockImplementation(() => {});
    [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(".photo-btn")]
      .find((b) => b.textContent!.includes("拍照"))!.click();

    expect(takePhoto).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r));  // 等 async success 分支
    await el.updateComplete;
    expect(captureClick).not.toHaveBeenCalled();  // 不走 input
    expect(el.shadowRoot!.querySelector(".pending-photo")).toBeTruthy();  // 已进待传预览
  });

  it("webview: jsbridge fail bubbles photo-error event", async () => {
    (window as unknown as { Android: unknown }).Android = { messageSend: vi.fn() };
    const takePhoto = vi.fn((h: { fail?: (r: unknown) => void }) =>
      h.fail?.({ code: 2, error: "denied" }));
    (window as unknown as { jsbridge?: unknown }).jsbridge = { takePhoto, pickPhotos: vi.fn() };

    const errors: string[] = [];
    const el = await fixture<DiaryRecordPanel>(html`
      <diary-record-panel .entry=${rawEntry} @photo-error=${(e: Event) => {
        errors.push((e as CustomEvent<{ message: string }>).detail.message);
      }}></diary-record-panel>
    `);
    [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(".photo-btn")]
      .find((b) => b.textContent!.includes("拍照"))!.click();
    await el.updateComplete;
    await new Promise((r) => setTimeout(r));  // 等 async 分支
    expect(errors[0]).toContain("权限");
  });
});

describe("diary-review-panel", () => {
  it("renders raw entry as 'not yet summarized' empty state (no fragments)", async () => {
    const el = await fixture<DiaryReviewPanel>(html`
      <diary-review-panel
        date="2026-08-01"
        today="2026-08-01"
        .entry=${rawEntry}></diary-review-panel>
    `);
    // 回顾页只看成文：raw 不展示原始片段，仅空态提示
    expect(el.shadowRoot!.textContent).toContain("尚未整理成文");
    expect(el.shadowRoot!.querySelectorAll(".frag").length).toBe(0);
  });

  it("renders summarized entry via md-viewer", async () => {
    const el = await fixture<DiaryReviewPanel>(html`
      <diary-review-panel
        date="2026-07-31"
        today="2026-08-01"
        .entry=${summarizedEntry}></diary-review-panel>
    `);
    await el.updateComplete;
    const viewer = el.shadowRoot!.querySelector("md-viewer");
    expect(viewer).toBeTruthy();
  });

  it("renders empty state", async () => {
    const el = await fixture<DiaryReviewPanel>(html`
      <diary-review-panel
        date="2026-07-01"
        today="2026-08-01"
        .entry=${{ date: "2026-07-01", state: "empty", fragments: [], content: "" }}></diary-review-panel>
    `);
    expect(el.shadowRoot!.textContent).toContain("这一天没有日记");
  });

  it("disables next-day button on today", async () => {
    const el = await fixture<DiaryReviewPanel>(html`
      <diary-review-panel
        date="2026-08-01"
        today="2026-08-01"
        .entry=${rawEntry}></diary-review-panel>
    `);
    const navBtns = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(".nav-btn")];
    expect(navBtns[0].disabled).toBe(false); // 前一天可用
    expect(navBtns[1].disabled).toBe(true);  // 后一天禁用（已是今天）
  });
});
describe("diary-view 启动恢复：reviewDate 让位逻辑", () => {
  let originalFetch: typeof fetch;
  let entryCalls: string[];

  beforeEach(() => {
    originalFetch = global.fetch;
    entryCalls = [];
    global.fetch = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/api/diary/today")) {
        return new Response(JSON.stringify({ today: "2026-08-28", entry: null }), {
          status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (/\/api\/diary\/entry\?/.test(u)) {
        entryCalls.push(new URL(u, "http://x").searchParams.get("date") ?? "");
        return new Response(JSON.stringify({ date: "2026-08-20", deleted: false, fragments: [] }), {
          status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ month: "2026-08", dates: [] }), {
        status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    // 完整重置 store（resetStore 不含 diary slice）
    store.setState({ ...INITIAL_STATE });
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("store 已有 reviewDate（恢复值）→ 用恢复日期而非昨天", async () => {
    actions.setDiaryState({ reviewDate: "2026-08-20" });
    const el = document.createElement("diary-view");
    document.body.appendChild(el);
    await (el as any).updateComplete;
    await new Promise((r) => setTimeout(r, 30));
    document.body.removeChild(el);
    expect(entryCalls).toContain("2026-08-20");
    expect(entryCalls).not.toContain("2026-08-27"); // 不是默认昨天
  });

  it("reviewDate 为空 → 默认昨天（today-1）", async () => {
    const el = document.createElement("diary-view");
    document.body.appendChild(el);
    await (el as any).updateComplete;
    await new Promise((r) => setTimeout(r, 30));
    document.body.removeChild(el);
    expect(entryCalls).toContain("2026-08-27");
  });
});
