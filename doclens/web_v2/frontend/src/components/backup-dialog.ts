import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  listSessionBackups,
  restoreSessionBackup,
  type SessionBackupInfo,
  type CorruptFileInfo,
} from "../api/sessions";
import "./icon";

/**
 * 会话备份对话框（控制面板「会话备份」行入口，ADR-0047）：列出 sessions.db
 * 整库备份（时间 + 大小 + 会话数），点击恢复弹确认（对比当前会话数），
 * 确认后整体替换库文件。损坏库改名残留（.corrupt-*）只读展示。
 *
 * 恢复成功由后端经 SSE sessions_restored 广播（watch-stream 派发
 * cortex:sessions-restored），本对话框只负责本地状态收尾与提示。
 */
@customElement("backup-dialog")
export class BackupDialog extends LitElement {
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
      width: min(520px, 90vw);
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
      gap: var(--cortex-space-3);
      overflow-y: auto;
    }
    .muted {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .backup-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-md);
    }
    .backup-row .when {
      flex: 1;
      min-width: 0;
    }
    .backup-row .ts {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      display: block;
    }
    .backup-row .meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      display: block;
      margin-top: 2px;
    }
    .restore-btn {
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-xs);
      padding: 4px 10px;
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
      flex-shrink: 0;
    }
    .restore-btn:hover {
      background: var(--cortex-surface-muted);
    }
    .restore-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .corrupt-block {
      border-top: 1px dashed var(--cortex-border-muted);
      padding-top: var(--cortex-space-3);
    }
    .corrupt-block .title {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-warning);
      font-weight: 600;
      display: block;
      margin-bottom: var(--cortex-space-2);
    }
    .confirm-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .confirm-card {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: var(--cortex-space-5);
      width: min(400px, 85vw);
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-3);
      box-shadow: var(--cortex-shadow-lg);
    }
    .confirm-card p {
      margin: 0;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      line-height: 1.55;
    }
    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-3);
    }
    .btn {
      border: none;
      border-radius: var(--cortex-radius-sm);
      padding: 6px 14px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
    }
    .btn.cancel {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    .btn.danger {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-fg);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .empty {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      text-align: center;
      padding: var(--cortex-space-6) 0;
    }
    @media (max-width: 1023px) {
      dialog {
        width: calc(100vw - 16px);
      }
    }
  `;

  @property({ type: Boolean, reflect: true })
  open = false;

  @state() private _backups: SessionBackupInfo[] = [];
  @state() private _corrupt: CorruptFileInfo[] = [];
  @state() private _currentCount: number | null = null;
  @state() private _loading = false;
  @state() private _confirming: SessionBackupInfo | null = null;
  @state() private _restoring = false;
  @state() private _error = "";

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this._onKeydown);
  }

  disconnectedCallback(): void {
    document.removeEventListener("keydown", this._onKeydown);
    super.disconnectedCallback();
  }

  private _onKeydown = (e: KeyboardEvent): void => {
    if (this.open && e.key === "Escape" && !this._confirming) {
      e.preventDefault();
      this._close();
    }
  };

  private _close(): void {
    this._confirming = null;
    this._error = "";
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  protected async updated(changed: Map<string, unknown>): Promise<void> {
    if (changed.has("open") && this.open) await this._load();
  }

  private async _load(): Promise<void> {
    this._loading = true;
    this._error = "";
    try {
      const res = await listSessionBackups();
      this._backups = res.backups;
      this._corrupt = res.corrupt_files;
      this._currentCount = res.current_session_count;
    } catch (e) {
      this._error = e instanceof Error ? e.message : "加载备份清单失败";
    } finally {
      this._loading = false;
    }
  }

  private async _doRestore(): Promise<void> {
    if (!this._confirming) return;
    this._restoring = true;
    this._error = "";
    try {
      await restoreSessionBackup(this._confirming.file);
      this._confirming = null;
      // 会话列表刷新与 toast 由 SSE sessions_restored 事件驱动（watch-stream）
      this._close();
    } catch (e) {
      this._error = e instanceof Error ? e.message : "恢复失败";
    } finally {
      this._restoring = false;
    }
  }

  private _fmtSize(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  private _fmtTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  }

  render() {
    if (!this.open) return nothing;
    return html`
      <div class="scrim" @click=${this._close}></div>
      <dialog open>
        <div class="head">
          <h3>会话备份</h3>
          <button class="close-btn" type="button" @click=${this._close} aria-label="关闭">✕</button>
        </div>
        <div class="body">
          ${this._error
            ? html`<div class="muted" style="color:var(--cortex-warning)">${this._error}</div>`
            : nothing}
          ${this._loading
            ? html`<div class="empty">加载中…</div>`
            : this._backups.length === 0
              ? html`<div class="empty">暂无备份（下次启动时自动创建）</div>`
              : html`
                  <div class="muted">
                    当前会话数：${this._currentCount ?? "?"} · 恢复将整体替换会话库，当前库中比备份新的对话将丢失
                  </div>
                  ${this._backups.map(
                    (b) => html`
                      <div class="backup-row" data-testid="backup-row">
                        <span class="when">
                          <span class="ts">${this._fmtTime(b.created_at)}</span>
                          <span class="meta">
                            ${this._fmtSize(b.size_bytes)} · ${b.session_count ?? "?"} 个会话
                          </span>
                        </span>
                        <button
                          class="restore-btn"
                          type="button"
                          ?disabled=${this._restoring}
                          @click=${() => {
                            this._confirming = b;
                          }}
                        >
                          恢复
                        </button>
                      </div>
                    `,
                  )}
                `}
          ${this._corrupt.length > 0
            ? html`
                <div class="corrupt-block">
                  <span class="title">损坏库残留（自动恢复时改名保留，供事后抢救）</span>
                  ${this._corrupt.map(
                    (c) => html`
                      <div class="muted">
                        ${c.file} · ${this._fmtSize(c.size_bytes)} · ${this._fmtTime(c.created_at)}
                      </div>
                    `,
                  )}
                </div>
              `
            : nothing}
        </div>
        ${this._confirming
          ? html`
              <div class="confirm-overlay">
                <div class="confirm-card">
                  <p>
                    将把会话库整体恢复到
                    <strong>${this._fmtTime(this._confirming.created_at)}</strong>
                    时点（${this._confirming.session_count ?? "?"} 个会话）。 当前库中此后的对话将丢失；当前库会改名保留，不会消失。
                  </p>
                  <div class="confirm-actions">
                    <button class="btn cancel" type="button" ?disabled=${this._restoring} @click=${() => {
                      this._confirming = null;
                    }}>
                      取消
                    </button>
                    <button
                      class="btn danger"
                      type="button"
                      data-testid="confirm-restore"
                      ?disabled=${this._restoring}
                      @click=${this._doRestore}
                    >
                      ${this._restoring ? "恢复中…" : "确认恢复"}
                    </button>
                  </div>
                </div>
              </div>
            `
          : nothing}
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "backup-dialog": BackupDialog;
  }
}
