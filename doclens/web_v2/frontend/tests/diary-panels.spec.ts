import { describe, it, expect } from "vitest";
import { fixture, html } from "@open-wc/testing";
import "../src/components/diary-record-panel";
import "../src/components/diary-review-panel";
import type { DiaryRecordPanel } from "../src/components/diary-record-panel";
import type { DiaryReviewPanel } from "../src/components/diary-review-panel";
import type { DiaryEntry } from "../src/state/types";

const rawEntry: DiaryEntry = {
  date: "2026-08-01",
  state: "raw",
  fragments: [
    { fid: "a", time: "09:15", kind: "text", text: "早上喝了咖啡", image_url: null },
    { fid: "b", time: "18:30", kind: "photo", text: "晚霞", image_url: "/api/preview/raw?path=x" },
  ],
  content: "",
};

const summarizedEntry: DiaryEntry = {
  date: "2026-07-31",
  state: "summarized",
  fragments: [],
  content: "今天过得很充实。",
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
});

describe("diary-review-panel", () => {
  it("renders raw entry as fragment timeline with hint", async () => {
    const el = await fixture<DiaryReviewPanel>(html`
      <diary-review-panel
        date="2026-08-01"
        today="2026-08-01"
        .entry=${rawEntry}></diary-review-panel>
    `);
    expect(el.shadowRoot!.textContent).toContain("今天的片段将在明天自动整理成日记");
    expect(el.shadowRoot!.querySelectorAll(".frag").length).toBe(2);
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
