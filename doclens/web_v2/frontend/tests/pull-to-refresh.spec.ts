import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../src/components/pull-refresh-indicator";
import "../src/views/search-view";
import "../src/views/settings-view";
import {
  PullToRefreshController,
  PTR_THRESHOLD,
} from "../src/utils/pull-to-refresh";
import type { RefreshableView } from "../src/utils/pull-to-refresh";
import { PullRefreshIndicator } from "../src/components/pull-refresh-indicator";

/** 构造伪宿主（ReactiveControllerHost 最小实现） */
function fakeHost() {
  return {
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  };
}

/** 构造伪 touch 事件（jsdom 无 TouchEvent，结构类型即可） */
function fakeTouchEvent(
  type: string,
  x: number,
  y: number,
  path: HTMLElement[],
  cancelable = true,
) {
  return {
    type,
    touches: [{ clientX: x, clientY: y }],
    cancelable,
    composedPath: () => path,
    preventDefault: vi.fn(),
  } as unknown as TouchEvent;
}

/** 构造带 refresh 能力的 view 宿主元素 */
function fakeView(tag = "search-view", overrides: Partial<RefreshableView> = {}) {
  const el = document.createElement(tag);
  const refresh = vi.fn().mockResolvedValue(undefined);
  Object.assign(el, { refresh, canRefresh: () => true, ...overrides });
  return { el, refresh };
}

/** 每个测试结束后清理 makePath 挂进 document 的临时节点 */
function cleanupPaths() {
  document.body.querySelectorAll("div > search-view, div > chat-view").forEach(
    (v) => v.parentElement?.remove(),
  );
}

/** 构造滚动容器（overflow-y 由 inline style 提供，getComputedStyle 可读） */
function fakeScroller(scrollTop = 0) {
  const el = document.createElement("div");
  el.style.overflowY = "auto";
  el.scrollTop = scrollTop;
  return el;
}

/** 完整 path：scroller → view → main div（view 需连入 document 才能 isConnected） */
function makePath(scroller: HTMLElement, view: HTMLElement) {
  const main = document.createElement("div");
  document.body.appendChild(main);
  main.appendChild(view);
  view.appendChild(scroller);
  return [scroller, view, main, document.body, document.documentElement];
}

describe("PullToRefreshController（seam 判定）", () => {
  let host: ReturnType<typeof fakeHost>;
  let indicator: { showPull: ReturnType<typeof vi.fn>; showRefreshing: ReturnType<typeof vi.fn>; hide: ReturnType<typeof vi.fn> };
  let ctrl: PullToRefreshController;
  const listeners = new Map<string, EventListener>();

  beforeEach(() => {
    vi.useFakeTimers();
    host = fakeHost();
    indicator = {
      showPull: vi.fn(),
      showRefreshing: vi.fn(),
      hide: vi.fn(),
    };
    ctrl = new PullToRefreshController(host, () => indicator as any);
    const add = vi
      .spyOn(document, "addEventListener")
      .mockImplementation((type, listener) => {
        listeners.set(type, listener as EventListener);
      });
    vi.spyOn(document, "removeEventListener").mockImplementation((type) => {
      listeners.delete(type);
    });
    ctrl.hostConnected();
    add.mockRestore();
    // 惰性 attach 的监听也要捕获：重新 spy（hostConnected 已跑过）
    vi.spyOn(document, "addEventListener").mockImplementation((type, listener) => {
      listeners.set(type, listener as EventListener);
    });
  });

  afterEach(() => {
    cleanupPaths();
    vi.restoreAllMocks();
    listeners.clear();
    vi.useRealTimers();
  });

  it("findScroller 自内向外命中第一个 overflow-y: auto 元素", () => {
    const inner = fakeScroller();
    const outer = fakeScroller();
    expect(ctrl.findScroller([inner, outer])).toBe(inner);
    expect(ctrl.findScroller([outer, inner])).toBe(outer);
  });

  it("findScroller 无可滚动元素时返回 null", () => {
    const plain = document.createElement("div");
    expect(ctrl.findScroller([plain])).toBeNull();
  });

  it("findView 命中实现 refresh 协议的 view 宿主", () => {
    const { el } = fakeView();
    const plain = document.createElement("div");
    expect(ctrl.findView([el, plain])).toBe(el);
  });

  it("findView 对无 refresh 方法的 view（如 settings-view）返回 null", () => {
    const el = document.createElement("settings-view");
    expect(ctrl.findView([el])).toBeNull();
  });

  it("isBlockedPath 拦截 dialog / 输入控件 / image-viewer / data-ptr-off", () => {
    const dialog = document.createElement("dialog");
    const textarea = document.createElement("textarea");
    const viewer = document.createElement("image-viewer");
    const off = document.createElement("div");
    off.setAttribute("data-ptr-off", "");
    const view = document.createElement("search-view");
    expect(ctrl.isBlockedPath([dialog, view])).toBe(true);
    expect(ctrl.isBlockedPath([textarea, view])).toBe(true);
    expect(ctrl.isBlockedPath([viewer, view])).toBe(true);
    expect(ctrl.isBlockedPath([off, view])).toBe(true);
    expect(ctrl.isBlockedPath([view])).toBe(false);
  });

  it("完整手势：touchstart → touchmove 下拉超阈值 → touchend 触发 refresh", async () => {
    vi.spyOn(ctrl as any, "_isMobile").mockReturnValue(true);

    const { el: view, refresh } = fakeView();
    const scroller = fakeScroller();
    const path = makePath(scroller, view);

    (ctrl as any)._onTouchStart(fakeTouchEvent("touchstart", 200, 300, path));
    // 下拉 100px（阻尼后 50，超过指示器行程 44 封顶）
    (ctrl as any)._onTouchMove(
      fakeTouchEvent("touchmove", 200, 400, path),
    );
    (ctrl as any)._onTouchEnd();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(indicator.showRefreshing).toHaveBeenCalled();
    // 等待 MIN_SPIN + refresh 完成
    await vi.advanceTimersByTimeAsync(500);
    expect(indicator.hide).toHaveBeenCalled();
  });

  it("未达阈值（touchend 拉距 < 64px）不触发 refresh", () => {
    vi.spyOn(ctrl as any, "_isMobile").mockReturnValue(true);
    const { el: view, refresh } = fakeView();
    const scroller = fakeScroller();
    const path = makePath(scroller, view);

    (ctrl as any)._onTouchStart(fakeTouchEvent("touchstart", 200, 300, path));
    // 仅下拉 30px
    (ctrl as any)._onTouchMove(fakeTouchEvent("touchmove", 200, 330, path));
    (ctrl as any)._onTouchEnd();

    expect(refresh).not.toHaveBeenCalled();
    expect(indicator.hide).toHaveBeenCalled();
  });

  it("canRefresh() === false 时手势不成立", () => {
    vi.spyOn(ctrl as any, "_isMobile").mockReturnValue(true);
    const { el: view, refresh } = fakeView("chat-view", {
      canRefresh: () => false,
    });
    const scroller = fakeScroller();
    const path = makePath(scroller, view);

    (ctrl as any)._onTouchStart(fakeTouchEvent("touchstart", 200, 300, path));
    (ctrl as any)._onTouchMove(fakeTouchEvent("touchmove", 200, 400, path));
    (ctrl as any)._onTouchEnd();

    expect(refresh).not.toHaveBeenCalled();
  });

  it("scroller.scrollTop > 0 时不进入手势（正常滚动）", () => {
    vi.spyOn(ctrl as any, "_isMobile").mockReturnValue(true);
    const { el: view, refresh } = fakeView();
    const scroller = fakeScroller(50);
    const path = makePath(scroller, view);

    (ctrl as any)._onTouchStart(fakeTouchEvent("touchstart", 200, 300, path));
    (ctrl as any)._onTouchMove(fakeTouchEvent("touchmove", 200, 400, path));
    (ctrl as any)._onTouchEnd();

    expect(refresh).not.toHaveBeenCalled();
  });

  it("桌面视口（_isMobile false）手势不成立", () => {
    vi.spyOn(ctrl as any, "_isMobile").mockReturnValue(false);
    const { el: view, refresh } = fakeView();
    const scroller = fakeScroller();
    const path = makePath(scroller, view);

    (ctrl as any)._onTouchStart(fakeTouchEvent("touchstart", 200, 300, path));
    (ctrl as any)._onTouchMove(fakeTouchEvent("touchmove", 200, 400, path));
    (ctrl as any)._onTouchEnd();

    expect(refresh).not.toHaveBeenCalled();
  });

  it("armed 后 touchmove 调用 preventDefault（cancelable 时）", () => {
    vi.spyOn(ctrl as any, "_isMobile").mockReturnValue(true);
    const { el: view } = fakeView();
    const scroller = fakeScroller();
    const path = makePath(scroller, view);

    (ctrl as any)._onTouchStart(fakeTouchEvent("touchstart", 200, 300, path));
    const move = fakeTouchEvent("touchmove", 200, 400, path);
    (ctrl as any)._onTouchMove(move);
    expect(move.preventDefault).toHaveBeenCalled();
    expect(indicator.showPull).toHaveBeenCalledWith(
      Math.min(100 * 0.5, 44),
      100 >= PTR_THRESHOLD,
    );
  });

  it("hostRequestUpdate 在 tracking 态丢弃手势且不刷新", () => {
    vi.spyOn(ctrl as any, "_isMobile").mockReturnValue(true);
    const { el: view, refresh } = fakeView();
    const scroller = fakeScroller();
    const path = makePath(scroller, view);

    (ctrl as any)._onTouchStart(fakeTouchEvent("touchstart", 200, 300, path));
    (ctrl as any)._onTouchMove(fakeTouchEvent("touchmove", 200, 400, path));
    ctrl.hostRequestUpdate();
    (ctrl as any)._onTouchEnd();

    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("<ptr-indicator>", () => {
  it("showPull 直写 transform 并在阈值时反射 armed", async () => {
    const el = document.createElement("ptr-indicator") as PullRefreshIndicator;
    document.body.appendChild(el);
    await el.updateComplete;

    el.showPull(20, false);
    expect(el.style.transform).toBe("translate(-50%, 20px)");
    expect(el.hasAttribute("armed")).toBe(false);

    el.showPull(44, true);
    expect(el.hasAttribute("armed")).toBe(true);
    document.body.removeChild(el);
  });

  it("showRefreshing 反射 refreshing 属性并停驻顶部", async () => {
    const el = document.createElement("ptr-indicator") as PullRefreshIndicator;
    document.body.appendChild(el);
    await el.updateComplete;

    el.showRefreshing();
    expect(el.hasAttribute("refreshing")).toBe(true);
    expect(el.style.transform).toBe("translate(-50%, 8px)");
    document.body.removeChild(el);
  });

  it("hide 加 settle 过渡类滑回隐藏位", async () => {
    const el = document.createElement("ptr-indicator") as PullRefreshIndicator;
    document.body.appendChild(el);
    await el.updateComplete;

    el.showPull(30, false);
    el.hide();
    expect(el.classList.contains("settle")).toBe(true);
    expect(el.style.transform).toBe("translate(-50%, -110%)");
    document.body.removeChild(el);
  });

  it("styles：不拦截指针、reduced-motion 降级、含 spin keyframes", () => {
    const cssText = PullRefreshIndicator.styles.cssText;
    expect(cssText).toContain("pointer-events: none");
    expect(cssText).toContain("prefers-reduced-motion");
    expect(cssText).toContain("ptr-spin");
  });
});
