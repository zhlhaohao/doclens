import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  parseHash,
  VIEW_TO_HASH,
  HASH_TO_VIEW,
  DEFAULT_VIEW,
} from "../src/router/route-map";
import { router } from "../src/router/router";
import { store, INITIAL_STATE } from "../src/state/store";

/** 测试夹具：每个用例前重置 router / location.hash / store 单例。 */
function resetLocationHash() {
  // jsdom 支持通过 history.replaceState 改 hash，且不会触发 hashchange
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState(null, "", url);
}

beforeEach(() => {
  router._reset();
  resetLocationHash();
  store.setState({ ...INITIAL_STATE });
});

describe("route-map", () => {
  it("VIEW_TO_HASH covers all 4 views", () => {
    expect(Object.keys(VIEW_TO_HASH).sort()).toEqual(
      ["chat", "files", "search", "settings"].sort(),
    );
  });

  it("HASH_TO_VIEW is the inverse of VIEW_TO_HASH", () => {
    for (const [view, hash] of Object.entries(VIEW_TO_HASH)) {
      expect(HASH_TO_VIEW[hash]).toBe(view);
    }
  });

  it("DEFAULT_VIEW is 'search'", () => {
    expect(DEFAULT_VIEW).toBe("search");
  });
});

describe("parseHash", () => {
  it("returns the matching ViewId for each known hash", () => {
    expect(parseHash("#/search")).toBe("search");
    expect(parseHash("#/chat")).toBe("chat");
    expect(parseHash("#/files")).toBe("files");
    expect(parseHash("#/settings")).toBe("settings");
  });

  it("returns null for empty string", () => {
    expect(parseHash("")).toBeNull();
  });

  it("returns null for unknown hash", () => {
    expect(parseHash("#/foobar")).toBeNull();
    expect(parseHash("#/chat/abc")).toBeNull(); // 未来子路径也算未知
  });

  it("tolerates future query string after the path", () => {
    expect(parseHash("#/search?foo=bar")).toBe("search");
    expect(parseHash("#/chat?sessionId=abc")).toBe("chat");
  });
});

describe("router.current", () => {
  it("returns the view matching current hash", () => {
    window.history.replaceState(null, "", "#/files");
    expect(router.current()).toBe("files");
  });

  it("falls back to DEFAULT_VIEW when hash is empty", () => {
    expect(router.current()).toBe("search");
  });

  it("falls back to DEFAULT_VIEW when hash is invalid", () => {
    window.history.replaceState(null, "", "#/nope");
    expect(router.current()).toBe("search");
  });
});

describe("router.init", () => {
  it("sets hash to #/search via replaceState when hash is empty", () => {
    router.init();
    expect(window.location.hash).toBe("#/search");
    expect(store.getState().view).toBe("search");
  });

  it("keeps valid hash unchanged and syncs store", () => {
    window.history.replaceState(null, "", "#/chat");
    router.init();
    expect(window.location.hash).toBe("#/chat");
    expect(store.getState().view).toBe("chat");
  });

  it("rewrites invalid hash to #/search and renders search", () => {
    window.history.replaceState(null, "", "#/foobar");
    router.init();
    expect(window.location.hash).toBe("#/search");
    expect(store.getState().view).toBe("search");
  });

  it("subscribes hashchange listener only once on repeated init", () => {
    const spy = vi.spyOn(window, "addEventListener");
    router.init();
    router.init();
    router.init();
    const hashchangeCalls = spy.mock.calls.filter(
      ([type]) => type === "hashchange",
    );
    expect(hashchangeCalls.length).toBe(1);
    spy.mockRestore();
  });

  it("updates store.view when hashchange fires", async () => {
    router.init();
    expect(store.getState().view).toBe("search");
    // 模拟用户/外部修改 hash（jsdom 会异步派发 hashchange）
    window.location.hash = "#/chat";
    await vi.waitFor(() => expect(store.getState().view).toBe("chat"));
  });
});

describe("router.navigate", () => {
  it("updates hash and store when navigating to a different view", async () => {
    router.init();
    expect(store.getState().view).toBe("search");

    router.navigate("chat");
    // jsdom 异步派发 hashchange
    await vi.waitFor(() => {
      expect(window.location.hash).toBe("#/chat");
      expect(store.getState().view).toBe("chat");
    });
  });

  it("is a no-op when navigating to the current view", () => {
    router.init();
    expect(window.location.hash).toBe("#/search");

    const setStateSpy = vi.spyOn(store, "setState");
    router.navigate("search");
    // hash 未变 → 浏览器不发 hashchange → store.setState 不应被 navigate 间接触发
    // （setState 可能被其他订阅者调用，这里只验证没产生 view 相关的 setState）
    const viewSetCalls = setStateSpy.mock.calls.filter(
      ([patch]) => patch && typeof patch === "object" && "view" in patch,
    );
    expect(viewSetCalls.length).toBe(0);
    expect(window.location.hash).toBe("#/search");
    setStateSpy.mockRestore();
  });

  it("supports browser back via history by leaving a trail", async () => {
    router.init();
    router.navigate("chat");
    await vi.waitFor(() => expect(store.getState().view).toBe("chat"));
    router.navigate("files");
    await vi.waitFor(() => expect(store.getState().view).toBe("files"));

    // 后退一步：应回到 chat
    window.history.back();
    await vi.waitFor(() => {
      expect(window.location.hash).toBe("#/chat");
      expect(store.getState().view).toBe("chat");
    });
  });
});
