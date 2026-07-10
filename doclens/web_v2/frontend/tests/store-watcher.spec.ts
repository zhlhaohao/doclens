import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { WatcherStatus } from "../src/state/types";

const W: WatcherStatus = {
  running: true, reindexing: false, changed_count: 0,
  last_reindex_at: null, last_doc_count: 5, last_success: true,
};

describe("watcher store slice", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE, watcher: INITIAL_STATE.watcher });
  });

  it("initial watcher is null", () => {
    expect(store.getState().watcher).toBeNull();
  });

  it("setWatcherStatus immutably updates watcher", () => {
    actions.setWatcherStatus(W);
    expect(store.getState().watcher).toEqual(W);
  });

  it("setWatcherStatus(null) clears", () => {
    actions.setWatcherStatus(W);
    actions.setWatcherStatus(null);
    expect(store.getState().watcher).toBeNull();
  });
});
