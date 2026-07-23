import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { SystemStatus } from "../src/state/types";

const STATUS: SystemStatus = {
  workdir: "C:/kb",
  indexed_docs: 3,
  index_path: "C:/kb/.cortex/index.db",
  total_size_bytes: 1024,
  file_types: { ".md": 3 },
  watcher: null,
};

describe("status store slice", () => {
  beforeEach(() => {
    store.setState({ ...INITIAL_STATE });
  });

  it("setStatus writes status", () => {
    actions.setStatus(STATUS);
    expect(store.getState().status).toEqual(STATUS);
  });

  it("setStatus replaces (not merges) status", () => {
    actions.setStatus(STATUS);
    actions.setStatus({ ...STATUS, indexed_docs: 10 });
    expect(store.getState().status?.indexed_docs).toBe(10);
  });
});
