import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { ReindexState } from "../src/state/types";

const FRESH: ReindexState = {
  dialog: "closed", current_file: null, indexed_count: 0, result: null, error: null,
};

describe("reindex store slice", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE, reindex: { ...FRESH } });
  });

  it("starts closed", () => {
    expect(store.getState().reindex.dialog).toBe("closed");
  });

  it("openReindexConfirm → confirm", () => {
    actions.openReindexConfirm();
    expect(store.getState().reindex.dialog).toBe("confirm");
  });

  it("startReindex resets progress and sets running", () => {
    actions.openReindexConfirm();
    actions.startReindex();
    const r = store.getState().reindex;
    expect(r.dialog).toBe("running");
    expect(r.indexed_count).toBe(0);
    expect(r.result).toBeNull();
  });

  it("setReindexProgress updates only when running", () => {
    actions.startReindex();
    actions.setReindexProgress({ current_file: "a.md", indexed_count: 3 });
    expect(store.getState().reindex).toMatchObject({ current_file: "a.md", indexed_count: 3 });
    // 非 running 阶段忽略
    actions.finishReindex({ success: true, doc_count: 5, failed_count: 0 });
    actions.setReindexProgress({ current_file: "x.md", indexed_count: 9 });
    expect(store.getState().reindex.current_file).toBe("a.md");
  });

  it("finishReindex → done with result", () => {
    actions.startReindex();
    actions.finishReindex({ success: true, doc_count: 7, failed_count: 1 });
    const r = store.getState().reindex;
    expect(r.dialog).toBe("done");
    expect(r.result).toEqual({ success: true, doc_count: 7, failed_count: 1 });
  });

  it("failReindex → error", () => {
    actions.startReindex();
    actions.failReindex("boom");
    expect(store.getState().reindex).toMatchObject({ dialog: "error", error: "boom" });
  });

  it("closeReindex resets to closed", () => {
    actions.finishReindex({ success: true, doc_count: 1, failed_count: 0 });
    actions.closeReindex();
    expect(store.getState().reindex).toEqual(FRESH);
  });
});
