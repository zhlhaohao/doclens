import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../src/views/search-view";
import "../src/views/chat-view";
import "../src/views/files-view";
import "../src/views/diary-view";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

/* ------------------------------------------------------- 下拉刷新能力分布 */

describe("search/diary 无下拉刷新能力", () => {
  beforeEach(() => resetStore(store));
  afterEach(() => {
    document.body
      .querySelectorAll("search-view, chat-view, diary-view")
      .forEach((e) => e.remove());
  });

  // PTR 控制器靠 capability check（typeof view.refresh === "function"）arm 手势；
  // search/diary 已移除 refresh()/canRefresh()，手势永不 arm。chat 手势仅
  // initial 态开放（2026-10-27），focus 态由 canRefresh() 返回 false 拦截
  // （对话页与顶部滚屏矛盾，2026-09-19 撤下决策维持不变）。
  for (const tag of ["search-view", "diary-view"]) {
    it(`${tag} 不实现 refresh()/canRefresh()`, async () => {
      const el = document.createElement(tag) as any;
      document.body.appendChild(el);
      await el.updateComplete;
      expect(typeof el.refresh).toBe("undefined");
      expect(typeof el.canRefresh).toBe("undefined");
    });
  }
});

describe("chat-view 下拉刷新：initial 态开放，focus 态拦截（2026-10-27）", () => {
  beforeEach(() => resetStore(store));
  afterEach(() => {
    document.body.querySelectorAll("chat-view").forEach((e) => e.remove());
  });

  it("initial 态 canRefresh() 返回 true，refresh() 重拉历史会话", async () => {
    const el = document.createElement("chat-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    // resetStore 后 chat.state 默认 initial
    expect(el.viewState.state).toBe("initial");
    expect(typeof el.canRefresh).toBe("function");
    expect(el.canRefresh()).toBe(true);
    expect(typeof el.refresh).toBe("function");
  });

  it("focus 态 canRefresh() 返回 false（手势不 arm，与顶部滚屏矛盾）", async () => {
    const el = document.createElement("chat-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    actions.setChatState({
      state: "focus",
      currentSession: { id: "s1", type: "chat", title: "t", preview: "", created_at: "", updated_at: "" } as any,
      messages: [],
      streaming: false,
      pendingAsk: null,
    });
    await el.updateComplete;
    expect(el.viewState.state).toBe("focus");
    expect(el.canRefresh()).toBe(false);
  });
});

/* ---------------------------------------------------------------- 文件视图 */

describe("files-view refresh()", () => {
  beforeEach(() => {
    resetStore(store);
  });
  afterEach(() => {
    document.body.querySelectorAll("files-view").forEach((e) => e.remove());
  });

  it("refresh() 使当前目录缓存失效并重拉目录与文档清单", async () => {
    // 预填 treeCache（值为 FileEntry[]），断言 refresh 后当前目录 key 被清掉
    actions.setFilesState({
      currentDir: "docs",
      treeCache: {
        "": [{ name: "docs", path: "docs", is_dir: true } as any],
        docs: [],
      },
    });
    const el = document.createElement("files-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;

    await el.refresh();
    expect(
      Object.keys(store.getState().files.treeCache).includes("docs"),
    ).toBe(false);
  });
});
