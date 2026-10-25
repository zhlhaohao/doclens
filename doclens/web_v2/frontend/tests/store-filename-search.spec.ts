import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { IndexedDocument } from "../src/state/types";

const docs: IndexedDocument[] = [
  { path: "docs/README.md", name: "README.md", size: 100, modifiedAt: "2026-06-24T00:00:00Z" },
  { path: "src/b.ts", name: "b.ts", size: 200, modifiedAt: "2026-06-25T00:00:00Z" },
  { path: "a.py", name: "a.py", size: 300, modifiedAt: "2026-06-26T00:00:00Z" },
];

describe("filenameSearch store slice（2026-10-25 服务端化：无 allDocs/docsLoading）", () => {
  beforeEach(() => {
    store.setState({
      ...INITIAL_STATE,
      files: { ...INITIAL_STATE.files, filenameSearch: { ...INITIAL_STATE.files.filenameSearch } },
    });
  });

  it("starts inactive with empty results", () => {
    const s = store.getState().files.filenameSearch;
    expect(s.isActive).toBe(false);
    expect(s.results).toEqual([]);
    expect(s.query).toBe("");
  });

  it("setFilenameSearchQuery activates when query non-empty and selects first result", () => {
    actions.setFilenameSearchQuery({
      query: "ts",
      results: [docs[1]],
      totalMatches: 1,
    });
    const s = store.getState().files.filenameSearch;
    expect(s.isActive).toBe(true);
    expect(s.query).toBe("ts");
    expect(s.selectedPath).toBe("src/b.ts");
    expect(s.totalMatches).toBe(1);
  });

  it("setFilenameSearchQuery with empty query deactivates and clears selectedPath", () => {
    actions.setFilenameSearchQuery({ query: "ts", results: [docs[1]], totalMatches: 1 });
    actions.setFilenameSearchQuery({ query: "  ", results: [], totalMatches: 0 });
    const s = store.getState().files.filenameSearch;
    expect(s.isActive).toBe(false);
    expect(s.selectedPath).toBeNull();
  });

  it("clearFilenameSearch resets search-time fields", () => {
    actions.setFilenameSearchQuery({ query: "a", results: [docs[0]], totalMatches: 1 });
    actions.clearFilenameSearch();
    const s = store.getState().files.filenameSearch;
    expect(s.query).toBe("");
    expect(s.results).toEqual([]);
    expect(s.isActive).toBe(false);
    expect(s.selectedPath).toBeNull();
    expect(s.totalMatches).toBe(0);
  });

  it("selectFilenameSearchResult only updates selectedPath", () => {
    actions.setFilenameSearchQuery({ query: "", results: [], totalMatches: 0 });
    actions.selectFilenameSearchResult("src/b.ts");
    expect(store.getState().files.filenameSearch.selectedPath).toBe("src/b.ts");
    expect(store.getState().files.filenameSearch.query).toBe("");
  });
});
