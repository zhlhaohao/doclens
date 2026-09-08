import type { ReactiveController, ReactiveControllerHost } from "lit";
import { isCoarsePointer } from "./device";
import type { PullRefreshIndicator } from "../components/pull-refresh-indicator";

/** 下拉刷新触发阈值（px，阻尼前手势位移） */
export const PTR_THRESHOLD = 64;
/** 下拉阻尼：指示器行程 = 手势位移 × 0.5 */
const PTR_DAMPING = 0.5;
/** 指示器最大行程（px，阻尼后） */
const PTR_MAX_TRAVEL = 44;
/** 未 arm 前忽略的水平/垂直抖动（px） */
const PTR_ARM_SLOP = 8;
/** 刷新态最短展示（ms），防网络快回时闪烁 */
const PTR_MIN_SPIN = 400;

/** 移动端视口断点（与 CSS breakpoints.css 的 tab-bar 断点一致） */
const PTR_MOBILE_QUERY = "(max-width: 1023px)";

/** 支持下拉刷新的 view 协议（capability check，无需注册表） */
export interface RefreshableView extends HTMLElement {
  refresh(): Promise<void> | void;
  /** 返回 false 时手势不 arm（如 chat 流式进行中）。缺省视为 true。 */
  canRefresh?(): boolean;
}

/** view 宿主标签（app.ts keep-alive 常驻的五个 view） */
const VIEW_TAGS = new Set([
  "search-view",
  "chat-view",
  "files-view",
  "diary-view",
  "settings-view",
]);

/** 手势黑名单标签：这些元素内触摸不进入下拉刷新（大写 tagName 比较） */
const BLOCKED_TAGS = new Set(["DIALOG", "IMAGE-VIEWER", "TEXTAREA", "INPUT"]);

/**
 * 全局下拉刷新手势控制器（移动端 pull-to-refresh）。
 *
 * 挂在 document 上（touch 事件 composed，穿透全部 shadow boundary 一次覆盖），
 * 宿主为 cortex-app。滚动容器发现用 composedPath 自内向外找第一个
 * overflow-y: auto|scroll 的元素——天然穿透 shadow DOM；keep-alive 的
 * hidden view（display:none）不接收触摸，不会出现在事件 path 中。
 *
 * 事件流程：
 * - touchstart（passive，常驻）：移动端闸门 → 黑名单 → scroller 在顶 →
 *   view 有 refresh 能力 → 通过则惰性 attach touchmove（non-passive）
 * - touchmove：未 arm 阶段上滑/横滑/scrollTop>0 即放弃；dy>slop 后 arm，
 *   preventDefault 阻止原生滚动并驱动指示器跟手
 * - touchend：超过阈值触发 view.refresh()，否则回弹
 */
export class PullToRefreshController implements ReactiveController {
  private _state: "idle" | "tracking" | "refreshing" = "idle";
  private _armed = false;
  private _pull = 0;
  private _startX = 0;
  private _startY = 0;
  private _view: RefreshableView | null = null;

  constructor(
    private host: ReactiveControllerHost,
    private _indicator: () => PullRefreshIndicator | null,
  ) {
    this.host.addController(this);
  }

  hostConnected() {
    document.addEventListener("touchstart", this._onTouchStart, {
      passive: true,
    });
  }

  hostDisconnected() {
    document.removeEventListener("touchstart", this._onTouchStart);
    this._detachTracking();
    this._reset();
  }

  /** composedPath 中自内向外第一个纵向可滚动元素（穿透 shadow DOM）。 */
  findScroller(els: HTMLElement[]): HTMLElement | null {
    for (const el of els) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return el;
    }
    return null;
  }

  /** composedPath 中找 view 宿主，且须实现 RefreshableView 协议。 */
  findView(els: HTMLElement[]): RefreshableView | null {
    for (const el of els) {
      if (!VIEW_TAGS.has(el.tagName.toLowerCase())) continue;
      const view = el as RefreshableView;
      return typeof view.refresh === "function" ? view : null;
    }
    return null;
  }

  /** 黑名单：模态 dialog / 图片查看器 / 输入控件 / data-ptr-off 显式 opt-out。 */
  isBlockedPath(els: HTMLElement[]): boolean {
    for (const el of els) {
      if (BLOCKED_TAGS.has(el.tagName)) return true;
      if (el.hasAttribute?.("data-ptr-off")) return true;
    }
    return false;
  }

  private _isMobile(): boolean {
    return (
      window.matchMedia(PTR_MOBILE_QUERY).matches && isCoarsePointer()
    );
  }

  private _onTouchStart = (e: TouchEvent) => {
    if (this._state !== "idle") return;
    if (e.touches.length !== 1) return;
    if (!this._isMobile()) return;
    const els = this._elementsOf(e);
    if (els.length === 0 || this.isBlockedPath(els)) return;
    const scroller = this.findScroller(els);
    if (!scroller || scroller.scrollTop > 0) return;
    const view = this.findView(els);
    if (!view || view.canRefresh?.() === false) return;
    // 候选手势成立：记录起点，惰性挂载 tracking 监听
    this._view = view;
    this._startX = e.touches[0].clientX;
    this._startY = e.touches[0].clientY;
    this._state = "tracking";
    this._armed = false;
    this._pull = 0;
    document.addEventListener("touchmove", this._onTouchMove, {
      passive: false,
    });
    document.addEventListener("touchend", this._onTouchEnd);
    document.addEventListener("touchcancel", this._onTouchCancel);
  };

  private _onTouchMove = (e: TouchEvent) => {
    if (this._state !== "tracking") return;
    if (e.touches.length !== 1) {
      this._release(false);
      return;
    }
    const t = e.touches[0];
    const dy = t.clientY - this._startY;
    const dx = t.clientX - this._startX;
    if (!this._armed) {
      // 上滑、横滑为主或容器已滚离顶部 → 放弃，交还原生滚动
      if (dy <= 0 || Math.abs(dx) > dy) {
        this._release(false);
        return;
      }
      if (dy < PTR_ARM_SLOP) return;
      this._armed = true;
    }
    if (e.cancelable) e.preventDefault();
    this._pull = dy;
    const travel = Math.min(dy * PTR_DAMPING, PTR_MAX_TRAVEL);
    this._indicator()?.showPull(travel, dy >= PTR_THRESHOLD);
  };

  private _onTouchEnd = () => {
    this._release(this._armed && this._pull >= PTR_THRESHOLD);
  };

  private _onTouchCancel = () => {
    this._release(false);
  };

  /** 松手统一出口：trigger=true 触发刷新，否则指示器回弹。 */
  private async _release(trigger: boolean) {
    this._detachTracking();
    const view = this._view;
    if (!trigger || !view) {
      this._indicator()?.hide();
      this._reset();
      return;
    }
    this._state = "refreshing";
    const indicator = this._indicator();
    indicator?.showRefreshing();
    try {
      // 下拉途中切 tab：view 已隐藏/断连则不触发
      if (!view.hidden && view.isConnected) await view.refresh();
    } finally {
      const elapsed = PTR_MIN_SPIN;
      await new Promise((r) => setTimeout(r, elapsed));
      indicator?.hide();
      this._reset();
    }
  }

  private _detachTracking() {
    document.removeEventListener("touchmove", this._onTouchMove);
    document.removeEventListener("touchend", this._onTouchEnd);
    document.removeEventListener("touchcancel", this._onTouchCancel);
  }

  private _reset() {
    this._state = "idle";
    this._armed = false;
    this._pull = 0;
    this._view = null;
  }

  /** composedPath 过滤出 HTMLElement（ShadowRoot/Document 等剔除）。 */
  private _elementsOf(e: TouchEvent): HTMLElement[] {
    if (typeof e.composedPath !== "function") return [];
    return e.composedPath().filter(
      (n): n is HTMLElement => n instanceof HTMLElement,
    );
  }

  /** view 切换时由宿主调用：丢弃进行中的候选手势（不触发刷新）。 */
  hostRequestUpdate() {
    if (this._state === "tracking") {
      this._release(false);
    }
  }
}
