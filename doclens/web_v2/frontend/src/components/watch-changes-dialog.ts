import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { store } from "../state/store";
import type { WatchChange } from "../state/types";

/** 点击 watch 徽标弹出的「近期文件变化」对话框。
 *
 * 数据源：store.watchRecentChanges（由 watch-stream 的 SSE status 快照写入）。
 * 打开期间订阅 store 实时刷新列表；Esc / 点遮罩 / 关闭按钮 → 派发 close。 */
@customElement("watch-changes-dialog")
export class WatchChangesDialog extends LitElement {
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
    .list {
      overflow-y: auto;
      padding: var(--cortex-space-2) var(--cortex-space-6) var(--cortex-space-4);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
    }
    .item {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--cortex-space-3);
      padding: 6px 0;
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .item:last-child {
      border-bottom: none;
    }
    .item .path {
      color: var(--cortex-text);
      word-break: break-all;
    }
    .item .ts {
      color: var(--cortex-text-muted);
      flex-shrink: 0;
      white-space: nowrap;
      font-size: var(--cortex-fs-xs);
    }
    .empty {
      padding: var(--cortex-space-6);
      text-align: center;
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
    }
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
    // 打开期间实时刷新列表（SSE 可能持续推新变化）
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

  private _formatRelative(ts: number): string {
    const diff = Math.max(0, Math.floor(Date.now() / 1000 - ts));
    if (diff < 60) return `${diff}s 前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m 前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h 前`;
    return `${Math.floor(diff / 86400)}d 前`;
  }

  private _renderList(changes: readonly WatchChange[]) {
    if (changes.length === 0) {
      return html`<div class="empty">暂无近期文件变化</div>`;
    }
    // 后端按「最旧→最新」返回，对话框展示「最新在最上」更直观
    return html`
      <div class="list">
        ${[...changes].reverse().map(
          (c) => html`
            <div class="item">
              <span class="path">${c.path}</span>
              <span class="ts">${this._formatRelative(c.ts)}</span>
            </div>
          `,
        )}
      </div>
    `;
  }

  render() {
    if (!this.open) return nothing;
    const changes = store.getState().watchRecentChanges;
    return html`
      <div class="scrim" @click=${this._close}></div>
      <dialog open>
        <div class="head">
          <h3>📁 近期文件变化</h3>
          <button class="close-btn" type="button" @click=${this._close} aria-label="关闭">✕</button>
        </div>
        ${this._renderList(changes)}
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "watch-changes-dialog": WatchChangesDialog;
  }
}
