/** 侧滑抽屉基座（AP-30）：bookmark-drawer / toc-drawer 此前逐行复制
 *  ~140 行外壳（:host/overlay/panel/keyframes/panel-header/close-btn/Esc 监听，
 *  仅 keyframes 名做了前缀改名的刻意去重）。归一为共享样式 + 共享渲染骨架，
 *  两个抽屉只保留各自的条目渲染与专属事件。 */

import { html, css, nothing, type TemplateResult } from "lit";

/** 抽屉外壳共享样式（两抽屉 shadow DOM 各自 adopted，互不影响）。 */
export const sideDrawerStyles = css`
  :host {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    font-family: var(--cortex-font);
  }
  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.32);
    animation: drawer-fade-in 0.15s ease-out;
  }
  .panel {
    position: relative;
    margin-left: auto;
    width: 280px;
    max-width: 82%;
    background: var(--cortex-surface);
    border-left: 1px solid var(--cortex-border-muted);
    box-shadow: var(--cortex-shadow-lg);
    display: flex;
    flex-direction: column;
    min-height: 0;
    animation: drawer-slide-in 0.18s ease-out;
  }
  @keyframes drawer-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes drawer-slide-in {
    from { transform: translateX(24px); opacity: 0.6; }
    to { transform: translateX(0); opacity: 1; }
  }
  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--cortex-space-3) var(--cortex-space-4);
    border-bottom: 1px solid var(--cortex-border-muted);
    font-size: var(--cortex-fs-sm);
    font-weight: 600;
    color: var(--cortex-text);
    flex-shrink: 0;
  }
  .close-btn {
    border: none;
    background: transparent;
    color: var(--cortex-text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    padding: var(--cortex-space-1);
    border-radius: 50%;
    font-size: 16px;
    transition: background 0.15s, color 0.15s;
  }
  .close-btn:hover {
    background: var(--cortex-surface-muted);
    color: var(--cortex-text);
  }
  .list {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
    padding: var(--cortex-space-2) 0;
  }
`;

/** 抽屉外壳渲染骨架：overlay + panel(header 标题/header 尾部插槽 + list 内容)。
 *  headerTail：header 右侧关闭钮之前的插槽（bookmark 放「收藏当前位置」）；
 *  onClose：遮罩/Esc/关闭钮统一回调（宿主派发 close 事件）。 */
export function renderSideDrawer(opts: {
  ariaLabel: string;
  title: TemplateResult | string;
  headerTail?: TemplateResult | null;
  listTag?: "nav" | "div";
  list: TemplateResult;
  onClose: () => void;
}): TemplateResult {
  const listTag = opts.listTag ?? "div";
  return html`
    <div class="overlay" @click=${opts.onClose}></div>
    <aside class="panel" role="dialog" aria-label=${opts.ariaLabel}>
      <header class="panel-header">
        <span>${opts.title}</span>
        <div style="display:flex;align-items:center;gap:var(--cortex-space-1)">
          ${opts.headerTail ?? nothing}
          <button
            class="close-btn"
            type="button"
            aria-label=${`关闭${opts.ariaLabel}`}
            @click=${opts.onClose}
          ><doclens-icon name="x"></doclens-icon></button>
        </div>
      </header>
      <${listTag} class="list">${opts.list}</${listTag}>
    </aside>
  `;
}
