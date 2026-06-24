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
import { actions } from "../state/store";
import { VIEW_TO_HASH, parseHash, DEFAULT_VIEW } from "./route-map";

let initialized = false;

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
}

export const router = {
  /** 应用启动时调用一次：规范化初始 hash + 订阅 hashchange + 同步 store。
   *
   * 重复调用安全（内部 `initialized` 标志保护）。
   */
  init(): void {
    if (initialized) return;
    initialized = true;

    const view = normalizeView();
    const expected = VIEW_TO_HASH[view];
    if (currentHash() !== expected) {
      replaceHash(expected);
    }
    actions.setView(view);

    if (typeof window !== "undefined") {
      window.addEventListener("hashchange", onHashChange);
    }
  },

  /** 切换视图：写入 hash，由 hashchange 监听器完成 store 更新。
   *
   * 若 hash 未变，直接 return（天然 no-op，浏览器也不触发 hashchange）。
   */
  navigate(view: ViewId): void {
    const hash = VIEW_TO_HASH[view];
    if (currentHash() === hash) return;
    if (typeof window !== "undefined") {
      window.location.hash = hash;
    }
  },

  /** 读当前视图（基于 hash 解析，非法/空回退 DEFAULT_VIEW）。 */
  current(): ViewId {
    return normalizeView();
  },

  /** 测试专用：移除监听 + 清 initialized 标志。生产代码不应调用。 */
  _reset(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("hashchange", onHashChange);
    }
    initialized = false;
  },
};
