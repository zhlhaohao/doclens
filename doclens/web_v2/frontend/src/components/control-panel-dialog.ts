import { LitElement, html, css, nothing } from "lit";
import { dialogHeadStyles } from "../styles/dialog-frame";
import { customElement, property } from "lit/decorators.js";

import "./icon";
import { store, actions } from "../state/store";
import { watchStatusLabel } from "../utils/watch-status";
import "./c-dialog";

/**
 * 控制面板对话框（系统菜单「控制面板」入口）：收纳低频维护操作，
 * 精简系统菜单一级空间。三个操作行：
 * - 强制重建索引 → dispatch close + actions.openReindexConfirm()。
 *   reindex-dialog 是 app.ts 根级全局 store 驱动组件（z-1000），会盖在
 *   本面板之上；reindex.dialog 非 closed 时行禁用（幂等守卫 UI 化）
 * - 文件监控 → dispatch close + dispatch open-watch，由宿主 app-bar 打开
 *   watch-changes-dialog（不内嵌不叠层——SSE 列表已封装在那边）
 * - 会话备份（ADR-0047）→ dispatch close + dispatch open-backup，由宿主
 *   app-bar 打开 backup-dialog（清单/恢复/损坏残留展示）
 * （「重载页面」已提升到系统菜单一级入口，2026-10-14）
 *
 * 协议同 about-dialog / watch-changes-dialog：宿主持布尔 state → .open 属性
 * 传入；Esc / 点 scrim / ✕ 三路关闭 → dispatch close 事件回写。
 */
@customElement("control-panel-dialog")
export class ControlPanelDialog extends LitElement {
  static styles = css`${dialogHeadStyles} 
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
    .action-row .label.dot { color: var(--cortex-success); }
    .action-row .label.busy { color: var(--cortex-primary); }
    .action-row .label.warn { color: var(--cortex-warning); }
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

  private _onBackupClick(): void {
    this._close();
    this.dispatchEvent(
      new CustomEvent("open-backup", { bubbles: true, composed: true }),
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
      <c-dialog ?open=${true} @cancel=${this._close}>
        <div class="head">
          <h3>控制面板</h3>
          <button class="close-btn" type="button" @click=${this._close} aria-label="关闭">✕</button>
        </div>
        <div class="body">
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
          <button class="action-row" type="button" data-testid="backup-row" @click=${this._onBackupClick}>
            <doclens-icon class="icon" name="archive"></doclens-icon>
            <span class="text">
              <span class="label">会话备份</span>
              <span class="hint">查看备份并恢复会话库</span>
            </span>
          </button>
        </div>
      </c-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "control-panel-dialog": ControlPanelDialog;
  }
}
