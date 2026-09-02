/** 极简 Hash 路由模块。
 *
 * 职责：作为 URL ↔ store.view 之间的单向桥梁。
 *
 * 不变量：
 *   - URL 是 `view` 的唯一真相源
 *   - `actions.setView()` 只由本模块调用；业务代码必须通过
 *     `router.navigate(view)` 切换视图
 *   - `init()` 用 replaceState 规范化初始 hash（不污染 history 栈）
 *   - `navigate()` 用 `location.hash = ...` 触发 hashchange，由监听器
 *     完成 store 更新
 */
import type { ViewId } from "../state/types";
import { actions, store } from "../state/store";
import { VIEW_TO_HASH, parseHash, DEFAULT_VIEW } from "./route-map";

let initialized = false;

/** 最近访问的主视图（settings/login 之外的页面）——设置页「关闭」按钮的返回目标。 */
let lastMainView: ViewId = DEFAULT_VIEW;

function trackMainView(view: ViewId): void {
  if (view !== "settings" && view !== "login") lastMainView = view;
}

function currentHash(): string {
  return typeof window !== "undefined" ? window.location.hash : "";
}

function normalizeView(): ViewId {
  return parseHash(currentHash()) ?? DEFAULT_VIEW;
}

/** 用 history.replaceState 修改 hash —— 不压入历史栈、不触发 hashchange。 */
function replaceHash(hash: string): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = hash;
  window.history.replaceState(null, "", url);
}

/** 监听器：hash 变化时规范化 + 同步 store。 */
function onHashChange(): void {
  const view = normalizeView();
  const expected = VIEW_TO_HASH[view];
  if (currentHash() !== expected) {
    // 非法 hash：replaceState 修正 URL（不会再次触发 hashchange，无递归）
    replaceHash(expected);
  }
  actions.setView(view);
  trackMainView(view);
}

export const router = {
  /** 应用启动时调用一次：规范化初始 hash + 订阅 hashchange + 同步 store。
   *
   * fallbackView：hash 为空/非法时的回退视图（会话恢复的上次 tab）。
   * URL 显式带 hash 时天然优先；恢复后 replaceState 物化为 #/<view>，
   * 后续刷新走 URL 分支。重复调用安全（内部 `initialized` 标志保护）。
   */
  init(fallbackView?: ViewId): void {
    if (initialized) return;
    initialized = true;

    const view = parseHash(currentHash()) ?? fallbackView ?? DEFAULT_VIEW;
    const expected = VIEW_TO_HASH[view];
    if (currentHash() !== expected) {
      replaceHash(expected);
    }
    actions.setView(view);
    trackMainView(view);

    if (typeof window !== "undefined") {
      window.addEventListener("hashchange", onHashChange);
    }
  },

  /** 切换视图：写入 hash，由 hashchange 监听器完成 store 更新。
   *
   * hash 未变时浏览器不触发 hashchange：此时若 store.view 与目标不一致
   * （曾有调用方绕过 router 直接 setView 造成漂移），兜底直接同步 store，
   * 保证「点当前 hash 对应的 tab」永远不会无响应。
   */
  navigate(view: ViewId): void {
    const hash = VIEW_TO_HASH[view];
    if (currentHash() === hash) {
      if (store.getState().view !== view) actions.setView(view);
      return;
    }
    if (typeof window !== "undefined") {
      window.location.hash = hash;
    }
  },

  /** 读当前视图（基于 hash 解析，非法/空回退 DEFAULT_VIEW）。 */
  current(): ViewId {
    return normalizeView();
  },

  /** 设置页「关闭」的返回目标：最近访问的主视图（未访问过则为 DEFAULT_VIEW）。 */
  lastMain(): ViewId {
    return lastMainView;
  },

  /** 测试专用：移除监听 + 清 initialized 标志。生产代码不应调用。 */
  _reset(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("hashchange", onHashChange);
    }
    initialized = false;
    lastMainView = DEFAULT_VIEW;
  },
};
