import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
