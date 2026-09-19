import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { fetchRewindPreview } from "../api/sessions";
import type { RewindFilesPlan } from "../api/sessions";

/**
 * <rewind-dialog> —— 回退确认框（ADR-0027）。
 *
 * 打开时拉取 GET /api/sessions/{id}/rewind/preview 展示文件三态清单：
 * 对话回退固定（不可关），文件恢复勾选默认开；危险提示「恢复会覆盖现内容」。
 * 确认后冒泡 rewind-confirm {pointSeq, restoreFiles}，执行与刷新由
 * chat-view 负责；取消/ESC 冒泡 cancel。
 */
@customElement("rewind-dialog")
export class RewindDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
    }
    h2 {
      font-size: var(--cortex-fs-lg);
      margin: 0 0 var(--cortex-space-4);
    }
    .anchor {
      background: var(--cortex-surface-muted);
      border-left: 3px solid var(--cortex-primary);
      border-radius: var(--cortex-radius-sm);
      padding: 8px 10px;
      margin: 0 0 var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 5.2em;
      overflow: hidden;
    }
    .dead-count {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      margin-bottom: var(--cortex-space-4);
    }
    .files {
      border-top: 1px solid var(--cortex-border-muted);
      padding-top: var(--cortex-space-3);
      margin-bottom: var(--cortex-space-3);
    }
    .files-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .file-list {
      margin: 0 0 6px;
      padding: 0;
      list-style: none;
      font-size: var(--cortex-fs-sm);
      max-height: 180px;
      overflow-y: auto;
    }
    .file-list li {
      display: flex;
      gap: 6px;
      align-items: baseline;
      padding: 2px 0;
      word-break: break-all;
    }
    .tag {
      flex-shrink: 0;
      font-size: var(--cortex-fs-xs);
      padding: 1px 6px;
      border-radius: var(--cortex-radius-full, 999px);
      border: 1px solid var(--cortex-border);
      color: var(--cortex-text-muted);
      white-space: nowrap;
    }
    .tag.restore { color: var(--cortex-primary); border-color: var(--cortex-primary); }
    .tag.delete { color: var(--cortex-danger, #c0392b); border-color: var(--cortex-danger, #c0392b); }
    .none {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
    }
    .warn {
      display: flex;
      gap: 6px;
      align-items: flex-start;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-sm);
      padding: 8px 10px;
      margin-bottom: var(--cortex-space-4);
    }
    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
    }
    .checkbox-row input {
      accent-color: var(--cortex-primary);
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-2);
    }
    button.primary {
      background: var(--cortex-text);
      color: var(--cortex-surface);
      border: none;
      border-radius: 999px;
      padding: 8px 18px;
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      cursor: pointer;
    }
    button.primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button.plain {
      background: transparent;
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 999px;
      padding: 8px 18px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
    }
    .loading, .error {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      padding: var(--cortex-space-3) 0;
    }
    .error { color: var(--cortex-danger, #c0392b); }
  `;

  @property() sessionId = "";
  @property({ type: Number }) pointSeq = -1;
  /** 锚点消息内容（确认框预览 + 回填输入框由 chat-view 执行） */
  @property() anchorContent = "";
  /** 将被折叠的消息条数（含锚点；chat-view 从当前消息流算出） */
  @property({ type: Number }) deadCount = 0;

  @state() private _loading = true;
  @state() private _error: string | null = null;
  @state() private _plan: RewindFilesPlan | null = null;
  @state() private _restoreFiles = true;
  @state() private _submitting = false;

  connectedCallback() {
    super.connectedCallback();
    void this._loadPreview();
  }

  private async _loadPreview(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      this._plan = await fetchRewindPreview(this.sessionId, this.pointSeq);
    } catch (e) {
      this._error = (e as Error)?.message || "预览加载失败";
    } finally {
      this._loading = false;
    }
  }

  private _onToggleRestore = (): void => {
    this._restoreFiles = !this._restoreFiles;
  };

  private _onConfirm = (): void => {
    if (this._submitting) return;
    this._submitting = true;
    this.dispatchEvent(
      new CustomEvent("rewind-confirm", {
        detail: { pointSeq: this.pointSeq, restoreFiles: this._restoreFiles },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private _onCancel = (): void => {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  private _renderFiles() {
    if (this._loading) return html`<div class="loading">正在获取文件恢复清单…</div>`;
    if (this._error) {
      return html`<div class="error">${this._error}</div>`;
    }
    const plan = this._plan;
    if (!plan) return nothing;
    const hasAny =
      plan.restored.length > 0 || plan.deleted.length > 0 || plan.skipped.length > 0;
    if (!hasAny) {
      return html`<div class="none">无文件改动需要恢复。</div>`;
    }
    return html`
      <label class="checkbox-row">
        <input type="checkbox" .checked=${this._restoreFiles} @change=${this._onToggleRestore} />
        同时恢复文件（默认开）
      </label>
      <ul class="file-list">
        ${plan.restored.map((p) => html`<li><span class="tag restore">恢复</span><span>${p}</span></li>`)}
        ${plan.deleted.map((p) => html`<li><span class="tag delete">删除</span><span>${p}</span></li>`)}
        ${plan.skipped.map((s) => html`<li><span class="tag">跳过</span><span>${s.path}（${s.reason}）</span></li>`)}
      </ul>
    `;
  }

  render() {
    const excerpt = this.anchorContent.slice(0, 160) || "（空消息）";
    return html`
      <h2>回退到这条消息</h2>
      <div class="anchor">${excerpt}</div>
      <div class="dead-count">回退后，此后 ${this.deadCount} 条消息将折叠（这条提问会回到输入框，可编辑后重发）。</div>
      <div class="files">
        <div class="files-title"><doclens-icon name="history"></doclens-icon> 文件恢复</div>
        ${this._renderFiles()}
      </div>
      ${this._restoreFiles && (this._plan?.restored.length ?? 0) + (this._plan?.deleted.length ?? 0) > 0
        ? html`<div class="warn"><doclens-icon name="alert-triangle"></doclens-icon>
            <span>文件恢复会<b>覆盖当前内容</b>（恢复项）/ 删除回退点后才创建的文件（删除项），此操作不可撤销。</span></div>`
        : nothing}
      <div class="buttons">
        <button class="plain" type="button" @click=${this._onCancel}>取消</button>
        <button class="primary" type="button" ?disabled=${this._loading || !!this._error || this._submitting} @click=${this._onConfirm}>
          ${this._submitting ? "回退中…" : "回退"}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "rewind-dialog": RewindDialog;
  }
}
