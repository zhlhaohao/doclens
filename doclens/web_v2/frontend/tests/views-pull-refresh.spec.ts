import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../src/views/search-view";
import "../src/views/chat-view";
import "../src/views/files-view";
import "../src/views/diary-view";
import { resetStore } from "./test-utils";
import { store, actions } from "../src/state/store";

/* ---------------------------------------------------------------- 搜索视图 */

describe("search-view refresh()", () => {
  beforeEach(() => {
    resetStore(store);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        // POST /api/search 返回合法 SearchResponse（source 必填，
        // 否则 focus 态 render 拼 `${s.source.toUpperCase()}` 会崩）
        if (init?.method === "POST") {
          return {
            ok: true,
            json: async () => ({
              results: [],
              total: 0,
              offset: 0,
              limit: 20,
              query: "",
              query_words: [],
              elapsed_ms: 1,
              source: "fts",
            }),
          };
        }
        return { ok: true, json: async () => ({ sessions: [] }) };
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.querySelectorAll("search-view").forEach((e) => e.remove());
  });

  it("initial 态下拉刷新只重拉历史会话", async () => {
    const el = document.createElement("search-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;

    await el.refresh();
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => String(c[0]),
    );
    expect(calls.some((u) => u.includes("/api/sessions"))).toBe(true);
    expect(calls.some((u) => u.includes("/api/search"))).toBe(false);
  });

  it("focus 态下拉刷新以当前 offset 重发搜索请求", async () => {
    actions.setSearchState({
      state: "focus",
      query: "alpha",
      results: [],
      total: 40,
      offset: 20,
      limit: 20,
      // source 非 fts 时 render 会拼 `${s.source.toUpperCase()}`，需合法值
      source: "fts",
    });
    const el = document.createElement("search-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;

    await el.refresh();
    const searchCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[1] as RequestInit | undefined)
      .filter((init) => init?.method === "POST");
    const bodies = searchCalls.map((init) => String(init!.body));
    expect(
      bodies.some((b) => b.includes('"query"') && b.includes("20")),
    ).toBe(true);
  });
});

/* ---------------------------------------------------------------- 对话视图 */

describe("chat-view canRefresh()/refresh()", () => {
  beforeEach(() => {
    resetStore(store);
  });
  afterEach(() => {
    document.body.querySelectorAll("chat-view").forEach((e) => e.remove());
  });

  it("流式进行中 canRefresh() 为 false", async () => {
    actions.setChatState({ streaming: true });
    const el = document.createElement("chat-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.canRefresh()).toBe(false);
  });

  it("悬置问答中 canRefresh() 为 false", async () => {
    actions.setChatState({
      pendingAsk: { requestId: "r1", prompt: "q", options: [] } as any,
    });
    const el = document.createElement("chat-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.canRefresh()).toBe(false);
  });

  it("空闲态 canRefresh() 为 true", async () => {
    const el = document.createElement("chat-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.canRefresh()).toBe(true);
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

/* ---------------------------------------------------------------- 日记视图 */

describe("diary-view refresh()", () => {
  beforeEach(() => {
    resetStore(store);
    actions.setDiaryState({ tab: "record", submitting: false });
  });
  afterEach(() => {
    document.body.querySelectorAll("diary-view").forEach((e) => e.remove());
  });

  it("record tab 拉今日记录", async () => {
    const el = document.createElement("diary-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;

    await el.refresh();
    expect(store.getState().diary.recordLoading).toBe(false);
  });

  it("submitting 中 refresh 直接跳过（不打接口）", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    actions.setDiaryState({ submitting: true });
    const el = document.createElement("diary-view") as any;
    document.body.appendChild(el);
    await el.updateComplete;
    // 等 connectedCallback 的 _init 风暴（today/review/calendar）全部落地
    await new Promise((r) => setTimeout(r, 50));
    fetchSpy.mockClear();

    await el.refresh();
    // submitting 态被 guard 挡住：refresh 不新增任何日记请求
    expect(
      fetchSpy.mock.calls.filter((c) => String(c[0]).includes("/api/diary")).length,
    ).toBe(0);
    vi.unstubAllGlobals();
  });
});
