import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "./icon";
import { store, actions } from "../state/store";
import { watchStatusLabel } from "../utils/watch-status";

/**
 * 控制面板对话框（系统菜单「控制面板」入口）：收纳低频维护操作，
 * 精简系统菜单一级空间。三个操作行：
 * - 刷新页面 → dispatch close + window.location.reload()（整页重载，
 *   解决 PWA 旧 bundle 不换新的问题；重载后面板自然消失）
 * - 强制重建索引 → dispatch close + actions.openReindexConfirm()。
 *   reindex-dialog 是 app.ts 根级全局 store 驱动组件（z-1000），会盖在
 *   本面板之上；reindex.dialog 非 closed 时行禁用（幂等守卫 UI 化）
 * - 文件监控 → dispatch close + dispatch open-watch，由宿主 app-bar 打开
 *   watch-changes-dialog（不内嵌不叠层——SSE 列表已封装在那边）
 *
 * 协议同 about-dialog / watch-changes-dialog：宿主持布尔 state → .open 属性
 * 传入；Esc / 点 scrim / ✕ 三路关闭 → dispatch close 事件回写。
 */
@customElement("control-panel-dialog")
export class ControlPanelDialog extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      pointer-events: none;
    }
    /* 仅在 open 时显示遮罩并捕获点击（modal 行为） */
    :host([open]) {
      background: rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    .scrim {
      position: absolute;
      inset: 0;
    }
    dialog {
      position: relative;
      pointer-events: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 380px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-4) var(--cortex-space-6);
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .head h3 {
      margin: 0;
      font-size: var(--cortex-fs-md);
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--cortex-text);
    }
    .close-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: var(--cortex-fs-lg);
      line-height: 1;
      color: var(--cortex-text-muted);
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .close-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    .body {
      padding: var(--cortex-space-4) var(--cortex-space-6) var(--cortex-space-6);
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
    }
    /* 操作行：结构复刻 app-bar .menu-item（icon + text{label,hint}） */
    .action-row {
      display: flex;
      align-items: flex-start;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border: none;
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
      transition: background 0.15s;
      background: transparent;
      width: 100%;
      text-align: left;
      font-family: inherit;
    }
    .action-row:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .action-row:disabled { opacity: 0.5; cursor: not-allowed; }
    .action-row .icon {
      font-size: 18px;
      flex-shrink: 0;
      width: 24px;
      text-align: center;
      color: var(--cortex-text-muted);
    }
    .action-row .text { flex: 1; min-width: 0; }
    .action-row .label {
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
      color: var(--cortex-text);
      display: block;
    }
    .action-row .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      display: block;
      margin-top: 2px;
    }
    .action-row .label.dot { color: var(--cortex-success, #16a34a); }
    .action-row .label.busy { color: var(--cortex-primary); }
    .action-row .label.warn { color: var(--cortex-warning); }
    @media (max-width: 1023px) {
      dialog {
        min-width: 0;
        width: calc(100vw - 16px);
        max-width: calc(100vw - 16px);
      }
    }
  `;

  @property({ type: Boolean, reflect: true })
  open = false;

  private _unsub?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    // 面板打开期间 watcher 状态 / reindex 状态实时反映（行禁用与监控副文案）
    this._unsub = store.subscribe(() => this.requestUpdate());
    document.addEventListener("keydown", this._onKeydown);
  }

  disconnectedCallback(): void {
    this._unsub?.();
    document.removeEventListener("keydown", this._onKeydown);
    super.disconnectedCallback();
  }

  private _onKeydown = (e: KeyboardEvent): void => {
    if (this.open && e.key === "Escape") {
      e.preventDefault();
      this._close();
    }
  };

  private _close(): void {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  private _onRefreshClick(): void {
    this._close();
    window.location.reload();
  }

  private _onReindexClick(): void {
    // 幂等守卫（行禁用为主，此处双保险防 race）
    if (store.getState().reindex.dialog !== "closed") return;
    this._close();
    actions.openReindexConfirm();
  }

  private _onWatchClick(): void {
    this._close();
    this.dispatchEvent(
      new CustomEvent("open-watch", { bubbles: true, composed: true }),
    );
  }

  render() {
    if (!this.open) return nothing;
    const s = store.getState();
    const reindexBusy = s.reindex.dialog !== "closed";
    const { cls, label } = watchStatusLabel(s.watcher);
    const changeCount = s.watchRecentChanges.length;
    const watchHint =
      changeCount > 0 ? `${label} ·近期变化 ${changeCount}` : label;
    return html`
      <div class="scrim" @click=${this._close}></div>
      <dialog open>
        <div class="head">
          <h3>控制面板</h3>
          <button class="close-btn" type="button" @click=${this._close} aria-label="关闭">✕</button>
        </div>
        <div class="body">
          <button class="action-row" type="button" data-testid="refresh-row" @click=${this._onRefreshClick}>
            <doclens-icon class="icon" name="refresh-cw"></doclens-icon>
            <span class="text">
              <span class="label">重载页面</span>
              <span class="hint">重新加载应用，获取最新版本</span>
            </span>
          </button>
          <button
            class="action-row"
            type="button"
            data-testid="reindex-row"
            ?disabled=${reindexBusy}
            @click=${this._onReindexClick}
          >
            <doclens-icon class="icon" name="refresh-ccw"></doclens-icon>
            <span class="text">
              <span class="label">强制重建索引</span>
              <span class="hint">全量重建耗时较长，期间搜索不可用</span>
            </span>
          </button>
          <button class="action-row" type="button" data-testid="watch-row" @click=${this._onWatchClick}>
            <doclens-icon class="icon" name="folder"></doclens-icon>
            <span class="text">
              <span class="label ${cls}">文件监控</span>
              <span class="hint">${watchHint}</span>
            </span>
          </button>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "control-panel-dialog": ControlPanelDialog;
  }
}
