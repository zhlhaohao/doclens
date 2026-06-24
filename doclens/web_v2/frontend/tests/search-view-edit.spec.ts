import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import type { SearchView } from "../src/views/search-view";
import "../src/views/search-view";
import { store, actions } from "../src/state/store";
import { resetStore } from "./test-utils";

describe("<search-view> edit flow integration", () => {
  let confirmSpy: any;

  beforeEach(async () => {
    resetStore(store);
    confirmSpy = vi.spyOn(window, "confirm");
  });
  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("preview-pane editable when writable=true in focus state", async () => {
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [
        { path: "doc1.md", snippet: "hi", score: 1, line: 1, highlights: [] } as any,
      ],
      total: 1,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    // mock fetch GET /api/preview 返回带 writable=true 的响应
    const origFetch = global.fetch;
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ path: "doc1.md", language: "markdown", content: "# T", writable: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    try {
      const result = el.shadowRoot!.querySelector("search-results") as any;
      result.dispatchEvent(
        new CustomEvent("select", {
          detail: { result: { path: "doc1.md", snippet: "hi", score: 1, line: 1, highlights: [] } },
        }),
      );
      await new Promise((r) => setTimeout(r, 50));
      await el.updateComplete;
      const pp = el.shadowRoot!.querySelector("preview-pane") as any;
      expect(pp).toBeTruthy();
      expect(pp.writable).toBe(true);
    } finally {
      global.fetch = origFetch;
    }
  });

  it("previewDirty blocks result switch with confirm dialog", async () => {
    confirmSpy.mockReturnValue(false); // user cancels
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [
        { path: "a.md", snippet: "a", score: 1, line: 1, highlights: [] } as any,
        { path: "b.md", snippet: "b", score: 1, line: 1, highlights: [] } as any,
      ],
      total: 2,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    (el as any).previewDirty = true;
    // 触发 _onResultSelect —— 因为 dirty=true，应该弹 confirm 并因 false 而放弃
    await (el as any)._onResultSelect({
      detail: { result: { path: "b.md", snippet: "b", score: 1, line: 1, highlights: [] } },
    } as any);
    expect(confirmSpy).toHaveBeenCalled();
    // previewPath 没有切换到 b
    expect((el as any).previewPath).not.toBe("b.md");
  });
});