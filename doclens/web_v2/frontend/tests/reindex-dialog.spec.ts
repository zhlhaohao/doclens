import { describe, it, expect, beforeEach, vi } from "vitest";
import { fixture, html, elementUpdated } from "@open-wc/testing";

vi.mock("../src/api/client", () => ({
  streamSSE: vi.fn(),
  ApiError: class extends Error {},
}));

import "../src/components/reindex-dialog";
import type { ReindexDialog } from "../src/components/reindex-dialog";
import { actions, store, INITIAL_STATE } from "../src/state/store";
import { streamSSE } from "../src/api/client";

function makeStream(events: { event: string; data: string }[]) {
  return async function* () {
    for (const e of events) yield e;
  };
}

describe("<reindex-dialog>", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE, reindex: { ...INITIAL_STATE.reindex } });
    (streamSSE as any).mockReset();
  });

  it("renders nothing when closed", async () => {
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.querySelector("dialog[open]")).toBeNull();
  });

  it("confirm stage shows warning + buttons", async () => {
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    expect(el.shadowRoot?.textContent).toContain("强制重建索引");
    expect(el.shadowRoot?.querySelectorAll("button").length).toBeGreaterThanOrEqual(2);
  });

  it("confirm → start streams SSE and reaches done", async () => {
    (streamSSE as any).mockImplementation(makeStream([
      { event: "progress", data: JSON.stringify({ current_file: "a.md", indexed_count: 1 }) },
      { event: "done", data: JSON.stringify({ success: true, doc_count: 2, failed_count: 0 }) },
    ]));
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    const confirmBtn = Array.from(el.shadowRoot!.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("确认重建")) as HTMLButtonElement;
    confirmBtn.click();
    // 等待 async streamSSE 完成
    await new Promise((r) => setTimeout(r, 50));
    await elementUpdated(el);
    expect(store.getState().reindex.dialog).toBe("done");
    expect(store.getState().reindex.result?.doc_count).toBe(2);
  });

  it("progress event updates running stage", async () => {
    (streamSSE as any).mockImplementation(makeStream([
      { event: "progress", data: JSON.stringify({ current_file: "b.md", indexed_count: 5 }) },
    ]));
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    (Array.from(el.shadowRoot!.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("确认重建")) as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    await elementUpdated(el);
    expect(store.getState().reindex.indexed_count).toBe(5);
    expect(el.shadowRoot?.textContent).toContain("5");
  });

  it("error event → error stage", async () => {
    (streamSSE as any).mockImplementation(makeStream([
      { event: "error", data: JSON.stringify({ detail: "boom" }) },
    ]));
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    (Array.from(el.shadowRoot!.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("确认重建")) as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    await elementUpdated(el);
    expect(store.getState().reindex.dialog).toBe("error");
    expect(store.getState().reindex.error).toBe("boom");
  });

  it("heartbeat keeps running stage and refreshes count (AP-48)", async () => {
    (streamSSE as any).mockImplementation(makeStream([
      { event: "progress", data: JSON.stringify({ current_file: "a.md", indexed_count: 3, sub_label: "已解析 2 封邮件" }) },
      { event: "heartbeat", data: JSON.stringify({ indexed_count: 9, elapsed_sec: 120 }) },
    ]));
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    (Array.from(el.shadowRoot!.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("确认重建")) as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    await elementUpdated(el);
    const r = store.getState().reindex;
    expect(r.dialog).toBe("running");        // 静默期不得被判失败
    expect(r.indexed_count).toBe(9);         // 计数随心跳刷新
    expect(r.current_file).toBe("a.md");     // 当前文件/子进度不被心跳清空
    expect(r.sub_label).toBe("已解析 2 封邮件");
  });

  it("done with success:false → error stage (not success)", async () => {
    (streamSSE as any).mockImplementation(makeStream([
      { event: "done", data: JSON.stringify({ success: false, doc_count: 0, failed_count: 3 }) },
    ]));
    actions.openReindexConfirm();
    const el = await fixture<ReindexDialog>(html`<reindex-dialog></reindex-dialog>`);
    await elementUpdated(el);
    (Array.from(el.shadowRoot!.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("确认重建")) as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 50));
    await elementUpdated(el);
    expect(store.getState().reindex.dialog).toBe("error");
    expect(store.getState().reindex.error).toContain("3");
  });
});
