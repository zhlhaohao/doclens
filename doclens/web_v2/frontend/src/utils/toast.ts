/** toast 单一入口（AP-39）：六个组件各自复制的 _pushToast 帮助方法归一于此。
 *
 *  两个通道：
 *  - pushLocalToast：组件自身 shadow 内的 <toast-stack>（search-view /
 *    chat-view / settings-view / reindex-dialog / app-bar 的本地实例，
 *    toast 显示在该组件区域内——保持原视觉位置不变）。
 *  - pushToast：全局实例（app-bar shadow 内，app.ts 同范式挂载；
 *    translate-dialog 等自身无本地实例的组件使用）。 */

type ToastStackEl = HTMLElement & {
  pushToast?: (m: string, l?: string, d?: number) => void;
};

export type ToastLevel = "success" | "error" | "info";

/** 在组件自身 shadowRoot 内找本地 toast-stack 推送；无实例时静默丢弃。 */
export function pushLocalToast(
  host: HTMLElement,
  message: string,
  level: ToastLevel = "info",
  duration = 2500,
): void {
  const stack = host.shadowRoot?.querySelector("toast-stack") as ToastStackEl | null;
  stack?.pushToast?.(message, level, duration);
}

/** 推送到全局 toast-stack（app-bar shadow 内唯一实例）；无实例时静默丢弃。 */
export function pushToast(
  message: string,
  level: ToastLevel = "info",
  duration = 2500,
): void {
  const stack = document
    .querySelector("app-bar")
    ?.shadowRoot?.querySelector("toast-stack") as ToastStackEl | null;
  stack?.pushToast?.(message, level, duration);
}
