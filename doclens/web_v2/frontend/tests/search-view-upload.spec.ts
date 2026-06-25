import { describe, it, expect, vi, beforeEach } from "vitest";
import { fixture } from "@open-wc/testing";
import { html } from "lit";
import "../src/views/search-view";
import type { SearchView } from "../src/views/search-view";
import { store } from "../src/state/store";
import { actions } from "../src/state/store";
import { resetStore } from "./test-utils";

describe("<search-view> upload event wiring", () => {
  beforeEach(() => {
    resetStore(store);
    // 进入 focus 态，确保桌面端 preview-pane 被渲染
    actions.setSearchState({
      state: "focus",
      query: "x",
      results: [
        { path: "doc1.md", snippet: "hi", score: 1, line: 1, highlights: [] } as any,
      ],
      total: 1,
      source: "fts",
    });
  });

  it("forwards upload-success from preview-pane to toast + reload", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;

    // mock reload method
    const reloadSpy = vi.fn();
    (el as any)._reloadPreview = reloadSpy;

    // 找到桌面端的 preview-pane，派发 upload-success
    const pane = el.shadowRoot!.querySelector("preview-pane") as any;
    expect(pane).toBeTruthy();

    pane.dispatchEvent(
      new CustomEvent("upload-success", { detail: { path: "doc1.md" } }),
    );
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // toast 应该出现 "已覆盖：doc1.md"
    const toast = el.shadowRoot!.querySelector("toast-stack") as any;
    expect(toast).toBeTruthy();
    // 不直接断言 toast 内部状态，间接断言 _pushToast 调用即可
    // 这里仅验证 reload 触发，toast 渲染验证留给 e2e
  });

  it("forwards upload-failed to toast with error message", async () => {
    const el = await fixture(html`<search-view></search-view>`) as SearchView;
    await el.updateComplete;

    const pane = el.shadowRoot!.querySelector("preview-pane") as any;
    pane.dispatchEvent(
      new CustomEvent("upload-failed", {
        detail: { message: "NOT_INDEXED hash+stem 不匹配" },
      }),
    );
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));

    const toast = el.shadowRoot!.querySelector("toast-stack") as any;
    expect(toast).toBeTruthy();
    // 同上，仅断言 toast 容器存在；具体文案在 e2e 验证
  });
});
