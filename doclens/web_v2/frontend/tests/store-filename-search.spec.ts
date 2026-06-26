import { describe, it, expect, beforeEach } from "vitest";
import { store, actions, INITIAL_STATE } from "../src/state/store";
import type { IndexedDocument } from "../src/state/types";

const docs: IndexedDocument[] = [
  { path: "docs/README.md", name: "README.md", size: 100, modifiedAt: "2026-06-24T00:00:00Z" },
  { path: "src/b.ts", name: "b.ts", size: 200, modifiedAt: "2026-06-25T00:00:00Z" },
  { path: "a.py", name: "a.py", size: 300, modifiedAt: "2026-06-26T00:00:00Z" },
];

describe("filenameSearch store slice", () => {
  beforeEach(() => {
    store.setState({
      ...INITIAL_STATE,
      files: { ...INITIAL_STATE.files, filenameSearch: { ...INITIAL_STATE.files.filenameSearch } },
    });
  });

  it("starts inactive with docsLoading=true", () => {
    const s = store.getState().files.filenameSearch;
    expect(s.isActive).toBe(false);
    expect(s.docsLoading).toBe(true);
    expect(s.results).toEqual([]);
  });

  it("loadIndexedDocuments populates allDocs and clears loading", () => {
    actions.loadIndexedDocuments(docs);
    const s = store.getState().files.filenameSearch;
    expect(s.allDocs).toHaveLength(3);
    expect(s.docsLoading).toBe(false);
    expect(s.docsError).toBeNull();
  });

  it("setFilenameSearchQuery activates when query non-empty and selects first result", () => {
    actions.loadIndexedDocuments(docs);
    actions.setFilenameSearchQuery({
      query: "ts",
      results: [docs[1]],
      totalMatches: 1,
    });
    const s = store.getState().files.filenameSearch;
    expect(s.isActive).toBe(true);
    expect(s.query).toBe("ts");
    expect(s.selectedPath).toBe("src/b.ts");
  });

  it("setFilenameSearchQuery with empty query deactivates and clears selectedPath", () => {
    actions.setFilenameSearchQuery({ query: "ts", results: [docs[1]], totalMatches: 1 });
    actions.setFilenameSearchQuery({ query: "  ", results: [], totalMatches: 0 });
    const s = store.getState().files.filenameSearch;
    expect(s.isActive).toBe(false);
    expect(s.selectedPath).toBeNull();
  });

  it("clearFilenameSearch resets search-time fields but preserves allDocs", () => {
    actions.loadIndexedDocuments(docs);
    actions.setFilenameSearchQuery({ query: "a", results: [docs[0]], totalMatches: 1 });
    actions.clearFilenameSearch();
    const s = store.getState().files.filenameSearch;
    expect(s.query).toBe("");
    expect(s.results).toEqual([]);
    expect(s.isActive).toBe(false);
    expect(s.selectedPath).toBeNull();
    expect(s.allDocs).toHaveLength(3);
  });

  it("selectFilenameSearchResult only updates selectedPath", () => {
    actions.loadIndexedDocuments(docs);
    actions.setFilenameSearchQuery({ query: "", results: [], totalMatches: 0 });
    actions.selectFilenameSearchResult("src/b.ts");
    expect(store.getState().files.filenameSearch.selectedPath).toBe("src/b.ts");
    expect(store.getState().files.filenameSearch.query).toBe("");
  });

  it("setFilenameSearchDocsError sets docsError and clears loading", () => {
    actions.setFilenameSearchDocsError("boom");
    const s = store.getState().files.filenameSearch;
    expect(s.docsError).toBe("boom");
    expect(s.docsLoading).toBe(false);
  });
});
