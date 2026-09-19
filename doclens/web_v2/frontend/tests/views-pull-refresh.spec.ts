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
  // search/diary 已移除 refresh()/canRefresh()，手势永不 arm。chat 手势
  // 与顶部滚屏矛盾已撤（见下方 chat-view 块——refresh() 保留供 more 菜单，
  // 但不在 VIEW_TAGS 白名单，findView 不会命中）
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

describe("chat-view 下拉刷新手势关闭（2026-09-19 短暂开启后撤）", () => {
  beforeEach(() => resetStore(store));
  afterEach(() => {
    document.body.querySelectorAll("chat-view").forEach((e) => e.remove());
  });

  it("不实现 canRefresh()（手势协议不 arm），refresh() 保留供 more 菜单", async () => {
    const el = document.createElement("chat-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(typeof el.canRefresh).toBe("undefined");
    // more 菜单「刷新会话」入口仍调用 refresh()
    expect(typeof el.refresh).toBe("function");
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
