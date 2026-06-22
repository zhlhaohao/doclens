import { describe, it, expect, beforeEach } from "vitest";
import "../src/components/file-detail";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

describe("file-detail", () => {
  beforeEach(() => resetStore(store));

  it("shows placeholder when no selection", async () => {
    const el = document.createElement("file-detail") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("选择");
    document.body.removeChild(el);
  });

  it("renders detail when one selected", async () => {
    actions.setFilesState({
      selectedPaths: ["a.md"],
      detail: {
        name: "a.md", path: "a.md", is_dir: false, size: 100,
        modified_at: "2026-06-22T00:00:00Z", indexed: true, writable: true,
        created_at: "2026-06-20T00:00:00Z", extension: ".md", is_protected: false,
      } as any,
    });
    const el = document.createElement("file-detail") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("a.md");
    expect(el.shadowRoot.textContent).toContain(".md");
    document.body.removeChild(el);
  });

  it("shows multi-select placeholder when 2+ selected", async () => {
    actions.setFilesState({ selectedPaths: ["a.md", "b.md"] });
    const el = document.createElement("file-detail") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("2");
    expect(el.shadowRoot.textContent).toContain("项已选中");
    document.body.removeChild(el);
  });

  it("shows loading text when detailLoading is true", async () => {
    actions.setFilesState({
      selectedPaths: ["a.md"],
      detailLoading: true,
      detail: null,
    });
    const el = document.createElement("file-detail") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot.textContent).toContain("加载中");
    document.body.removeChild(el);
  });
});
