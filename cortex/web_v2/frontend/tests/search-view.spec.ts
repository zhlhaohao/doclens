import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import { SearchView } from "../src/views/search-view";
import "../src/views/search-view";
import { store, actions } from "../src/state/store";
import { resetStore } from "./test-utils";

const RESULTS_KEY = "cortex.resultsPaneWidth";

const focusResults = [
  { path: "doc1.md", snippet: "alpha", score: 1, line: 1 } as any,
];

describe("<search-view> splitter", () => {
  beforeEach(() => {
    resetStore(store);
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: focusResults,
      total: 1,
      source: "fts",
    });
    localStorage.removeItem(RESULTS_KEY);
  });
  afterEach(() => {
    localStorage.removeItem(RESULTS_KEY);
  });

  it("renders a splitter element in focus state", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    const splitter = el.shadowRoot!.querySelector(".splitter");
    expect(splitter).toBeTruthy();
    expect(splitter!.getAttribute("role")).toBe("separator");
    expect(splitter!.getAttribute("aria-orientation")).toBe("vertical");
  });

  it("applies --results-pane-width CSS variable on .focus-main", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    const focusMain = el.shadowRoot!.querySelector(".focus-main") as HTMLElement;
    expect(focusMain).toBeTruthy();
    expect(focusMain.style.getPropertyValue("--results-pane-width"))
      .toContain("px");
  });

  it("updates width when dragging the splitter via mousedown + mousemove", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    const splitter = el.shadowRoot!.querySelector(".splitter") as HTMLElement;
    const widthBefore = el["_resultsPaneWidth"] as number;

    splitter.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 200 }));
    await el.updateComplete;

    const widthAfter = el["_resultsPaneWidth"] as number;
    expect(widthAfter).toBe(widthBefore + 100);
  });

  it("clamps width to RESULTS_PANE_WIDTH_MAX on large drag right", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    const splitter = el.shadowRoot!.querySelector(".splitter") as HTMLElement;

    splitter.dispatchEvent(new MouseEvent("mousedown", { clientX: 0, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 5000 }));
    await el.updateComplete;

    expect(el["_resultsPaneWidth"]).toBe(SearchView.RESULTS_PANE_WIDTH_MAX);
  });

  it("clamps width to RESULTS_PANE_WIDTH_MIN on large drag left", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    const splitter = el.shadowRoot!.querySelector(".splitter") as HTMLElement;

    splitter.dispatchEvent(new MouseEvent("mousedown", { clientX: 1000, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 0 }));
    await el.updateComplete;

    expect(el["_resultsPaneWidth"]).toBe(SearchView.RESULTS_PANE_WIDTH_MIN);
  });

  it("persists width to localStorage on mouseup", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    const splitter = el.shadowRoot!.querySelector(".splitter") as HTMLElement;

    splitter.dispatchEvent(new MouseEvent("mousedown", { clientX: 0, bubbles: true }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    await el.updateComplete;

    const saved = localStorage.getItem(RESULTS_KEY);
    expect(saved).toBe(String(360 + 100));
  });

  it("restores saved width from localStorage on connect", async () => {
    localStorage.setItem(RESULTS_KEY, String(500));
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    expect(el["_resultsPaneWidth"]).toBe(500);
  });

  it("ignores invalid (NaN) saved width, falls back to default", async () => {
    localStorage.setItem(RESULTS_KEY, "not-a-number");
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    expect(el["_resultsPaneWidth"]).toBe(SearchView.RESULTS_PANE_WIDTH_DEFAULT);
  });

  it("clamps out-of-range saved width into bounds on load", async () => {
    localStorage.setItem(RESULTS_KEY, String(99999));
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    expect(el["_resultsPaneWidth"]).toBe(SearchView.RESULTS_PANE_WIDTH_MAX);
  });
});

describe("<search-view> auto-preview first result (desktop)", () => {
  let originalInnerWidth: PropertyDescriptor | undefined;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetStore(store);
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [],
      total: 0,
      source: "fts",
    });
    originalInnerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
    fetchSpy = vi.fn(async (url: string) => {
      // Minimal mock for /api/preview only; other endpoints return empty 200
      const u = String(url);
      if (u.startsWith("/api/preview")) {
        return new Response(
          JSON.stringify({ path: "doc1.md", language: "markdown", content: "# Hello", writable: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as any;
    global.fetch = fetchSpy as unknown as typeof fetch;
  });
  afterEach(() => {
    if (originalInnerWidth) Object.defineProperty(window, "innerWidth", originalInnerWidth);
    vi.restoreAllMocks();
  });

  function setViewport(width: number) {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: width,
    });
  }

  it("auto-previews first result on desktop width (>=1024)", async () => {
    setViewport(1440);
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    const results = [
      { path: "doc1.md", snippet: "alpha", score: 1, line: 1 } as any,
      { path: "doc2.md", snippet: "beta", score: 0.5, line: 5 } as any,
    ];
    (el as any)._autoPreviewFirstDesktop(results);
    // Should NOT push to detailStack (that would trigger mobile overlay on resize)
    expect(store.getState().detailStack.length).toBe(0);
    // _fetchAndShowPreview is async — let it settle
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    expect(el["previewContent"]).toBe("# Hello");
    expect(el["previewPath"]).toBe("doc1.md");
  });

  it("does NOT auto-preview on mobile width (<1024)", async () => {
    setViewport(390);
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    const results = [
      { path: "doc1.md", snippet: "alpha", score: 1, line: 1 } as any,
    ];
    (el as any)._autoPreviewFirstDesktop(results);
    // fetch should not have been called for /api/preview
    const previewCalls = fetchSpy.mock.calls.filter((c: any) => String(c[0]).startsWith("/api/preview"));
    expect(previewCalls.length).toBe(0);
  });

  it("does NOT auto-preview when results array is empty", async () => {
    setViewport(1440);
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    (el as any)._autoPreviewFirstDesktop([]);
    const previewCalls = fetchSpy.mock.calls.filter((c: any) => String(c[0]).startsWith("/api/preview"));
    expect(previewCalls.length).toBe(0);
  });
});

describe("<search-view> pagination integration", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    resetStore(store);
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("new search resets offset to 0", async () => {
    // 先把 state 设成"在 page 3"
    actions.setSearchState({
      state: "focus",
      query: "old",
      results: [],
      total: 100,
      offset: 40,  // page 3
      limit: 20,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;

    // mock fetch 拦截 searchApi + sessionsApi
    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      const u = String(url);
      if (u === "/api/search") {
        const body = init && init.body ? JSON.parse(init.body) : {};
        return new Response(
          JSON.stringify({
            results: [{ path: "x.md", snippet: "...", score: 1, line: 1, highlights: [] }],
            total: 5,
            offset: body.offset ?? 0,
            limit: body.limit ?? 20,
            query: body.query,
            elapsed_ms: 10,
            source: "fts",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      // sessions endpoints
      return new Response(
        JSON.stringify({ id: "sess-1", type: "search", title: "new", preview: "new", updated_at: new Date().toISOString(), message_count: 5 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as any;
    global.fetch = fetchSpy as unknown as typeof fetch;

    // 触发新搜索 (as any bypasses TS signature check)
    await (el as any)._submit("new");
    await new Promise((r) => setTimeout(r, 20));

    const s = store.getState().search;
    expect(s.offset).toBe(0);
    expect(s.query).toBe("new");

    vi.unstubAllGlobals();
  });

  it("pagination-bar rendered when total > limit", async () => {
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [],
      total: 100,
      offset: 0,
      limit: 20,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("pagination-bar")).toBeTruthy();
  });

  it("pagination-bar not rendered when total <= limit", async () => {
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [],
      total: 15,
      offset: 0,
      limit: 20,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("pagination-bar")).toBeNull();
  });

  it("_goToPage calls searchApi with new offset", async () => {
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [],
      total: 100,
      offset: 0,
      limit: 20,
      source: "fts",
    });
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;

    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      const u = String(url);
      if (u === "/api/search") {
        const body = init && init.body ? JSON.parse(init.body) : {};
        return new Response(
          JSON.stringify({
            results: [],
            total: 100,
            offset: body.offset ?? 0,
            limit: body.limit ?? 20,
            query: body.query ?? "x",
            elapsed_ms: 5,
            source: "fts",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    }) as any;
    global.fetch = fetchSpy as unknown as typeof fetch;

    await (el as any)._goToPage(3);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.offset).toBe(40);  // (3-1) * 20
    expect(body.limit).toBe(20);

    vi.unstubAllGlobals();
  });
});
