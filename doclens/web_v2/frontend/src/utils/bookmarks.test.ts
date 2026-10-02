import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addBookmark,
  bookmarksFor,
  loadBookmarks,
  removeBookmark,
} from "./bookmarks";

const KEY = "cortex.files.readingBookmarks";

function seed(entries: unknown[]) {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("loadBookmarks（容错读取）", () => {
  it("空存储返回空数组", () => {
    expect(loadBookmarks()).toEqual([]);
  });

  it("JSON 损坏返回空数组不抛错", () => {
    localStorage.setItem(KEY, "{oops");
    expect(loadBookmarks()).toEqual([]);
  });

  it("非数组 / 字段非法条目被过滤", () => {
    seed([
      "junk",
      null,
      { path: "a.md", anchor: 5, kind: "md", label: "x", createdAt: 1 },
      { path: "b.md", anchor: NaN, kind: "md", label: "x", createdAt: 2 },
      { path: "c.md", anchor: 5, kind: "bogus", label: "x", createdAt: 3 },
      { path: "d.md", anchor: 5, kind: "pdf", label: "x", createdAt: "no" },
    ]);
    expect(loadBookmarks()).toHaveLength(1);
    expect(loadBookmarks()[0].path).toBe("a.md");
  });
});

describe("addBookmark（收藏 + 幂等 + 满员）", () => {
  it("成功插入头部（最新在前）", () => {
    addBookmark({ path: "a.md", anchor: 10, kind: "md", label: "第一章" });
    const r = addBookmark({ path: "b.md", anchor: 20, kind: "md", label: "第二章" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.duplicate).toBe(false);
    const all = loadBookmarks();
    expect(all.map((b) => b.path)).toEqual(["b.md", "a.md"]);
  });

  it("同文件 md 锚点行距 ≤3 幂等命中（不新增）", () => {
    addBookmark({ path: "a.md", anchor: 100, kind: "md", label: "x" });
    const near = addBookmark({ path: "a.md", anchor: 102, kind: "md", label: "y" });
    expect(near.ok).toBe(true);
    if (near.ok) expect(near.duplicate).toBe(true);
    expect(loadBookmarks()).toHaveLength(1);
  });

  it("行距 >3 视为不同书签", () => {
    addBookmark({ path: "a.md", anchor: 100, kind: "md", label: "x" });
    const far = addBookmark({ path: "a.md", anchor: 104, kind: "md", label: "y" });
    if (far.ok) expect(far.duplicate).toBe(false);
    expect(loadBookmarks()).toHaveLength(2);
  });

  it("pdf 锚点同页且比例差 <0.1 幂等；跨页不幂等", () => {
    // 编码 = page*10000 + ratio*9999（encodePdfScrollAnchor 同体系）
    const a = 5 * 10000 + Math.round(0.5 * 9999);
    const b = 5 * 10000 + Math.round(0.55 * 9999);
    const c = 6 * 10000 + Math.round(0.5 * 9999);
    addBookmark({ path: "a.pdf", anchor: a, kind: "pdf", label: "第 5 页" });
    const near = addBookmark({ path: "a.pdf", anchor: b, kind: "pdf", label: "第 5 页" });
    if (near.ok) expect(near.duplicate).toBe(true);
    const other = addBookmark({ path: "a.pdf", anchor: c, kind: "pdf", label: "第 6 页" });
    if (other.ok) expect(other.duplicate).toBe(false);
    expect(loadBookmarks()).toHaveLength(2);
  });

  it("不同链路同 path 不互相幂等（kind 参与判定）", () => {
    addBookmark({ path: "x", anchor: 10000, kind: "md", label: "x" });
    const r = addBookmark({ path: "x", anchor: 10000, kind: "pdf", label: "第 1 页" });
    if (r.ok) expect(r.duplicate).toBe(false);
    expect(loadBookmarks()).toHaveLength(2);
  });

  it("总量满 200 报 full，不静默逐出（显式资产决议）", () => {
    seed(
      Array.from({ length: 200 }, (_, i) => ({
        path: `f${i}.md`,
        anchor: i + 1,
        kind: "md" as const,
        label: `l${i}`,
        createdAt: i,
      })),
    );
    const r = addBookmark({ path: "new.md", anchor: 1, kind: "md", label: "n" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("full");
    expect(loadBookmarks()).toHaveLength(200);
  });

  it("无效输入不落库", () => {
    const r = addBookmark({ path: "", anchor: 1, kind: "md", label: "x" });
    expect(r.ok).toBe(false);
    expect(loadBookmarks()).toHaveLength(0);
  });
});

describe("bookmarksFor / removeBookmark", () => {
  it("按 path 过滤", () => {
    addBookmark({ path: "a.md", anchor: 1, kind: "md", label: "x" });
    addBookmark({ path: "b.md", anchor: 2, kind: "md", label: "y" });
    addBookmark({ path: "a.md", anchor: 99, kind: "md", label: "z" });
    const a = bookmarksFor("a.md");
    expect(a).toHaveLength(2);
    expect(bookmarksFor("nope.md")).toEqual([]);
  });

  it("按 path+anchor 精确删除，其余保留", () => {
    addBookmark({ path: "a.md", anchor: 1, kind: "md", label: "x" });
    addBookmark({ path: "a.md", anchor: 99, kind: "md", label: "z" });
    removeBookmark("a.md", 1);
    const left = bookmarksFor("a.md");
    expect(left).toHaveLength(1);
    expect(left[0].anchor).toBe(99);
  });
});
