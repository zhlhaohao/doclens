import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/**
 * <turn-delete-dialog> —— 删除对话对确认框（2026-10-29）。
 *
 * 删除粒度是**整轮**（该 user 消息 + 其后的工具轨迹与 AI 回复），用于清理
 * 无用轮次、压短上下文。确认后冒泡 turn-delete-confirm {pointSeq}，执行与
 * 刷新由 chat-view 负责；取消/ESC 冒泡 cancel。
 */
@customElement("turn-delete-dialog")
export class TurnDeleteDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-width: 340px;
      max-width: 460px;
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 var(--cortex-space-3);
      font-size: var(--cortex-fs-lg);
    }
    h2 doclens-icon { color: var(--cortex-danger); }
    .anchor {
      border-left: 3px solid var(--cortex-border);
      background: var(--cortex-surface-muted);
      border-radius: 0 var(--cortex-radius-sm) var(--cortex-radius-sm) 0;
      padding: 8px 10px;
      margin-bottom: var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 6em;
      overflow: hidden;
    }
    .detail {
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      margin-bottom: var(--cortex-space-3);
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
    .warn doclens-icon { color: var(--cortex-danger); flex: none; }
    .error { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); margin-bottom: var(--cortex-space-2); }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
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
    button.danger {
      background: var(--cortex-danger);
      color: var(--cortex-on-danger);
      border: none;
      border-radius: 999px;
      padding: 8px 18px;
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      cursor: pointer;
    }
    button.danger:disabled { opacity: 0.5; cursor: not-allowed; }
  `;

  /** 锚点（该 user 消息）seq */
  @property({ type: Number }) pointSeq = -1;
  /** 锚点消息内容（确认框预览） */
  @property() anchorContent = "";
  /** 将被删除的本轮消息条数（user + AI） */
  @property({ type: Number }) turnMessageCount = 0;
  /** 提交中（防重复点击；失败时由 chat-view 回填 errorMessage） */
  @property() submitting = false;
  @property() errorMessage = "";

  @state() private _submittingLocal = false;

  private get _busy(): boolean {
    return this.submitting || this._submittingLocal;
  }

  private _onConfirm = (): void => {
    if (this._busy) return;
    this._submittingLocal = true;
    this.dispatchEvent(
      new CustomEvent("turn-delete-confirm", {
        detail: { pointSeq: this.pointSeq },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private _onCancel = (): void => {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  render() {
    const excerpt = this.anchorContent.slice(0, 160) || "（空消息）";
    const n = this.turnMessageCount;
    return html`
      <h2><doclens-icon name="trash-2"></doclens-icon>删除这一轮对话</h2>
      <div class="anchor">${excerpt}</div>
      <div class="detail">
        将删除这条提问及其后的${n > 1 ? ` ${n} 条消息` : "回答"}（含工具调用轨迹），
        后续对话不受影响。
      </div>
      <div class="warn"><doclens-icon name="alert-triangle"></doclens-icon>
        <span>删除<b>不可撤销</b>，且会改变本会话的上下文（模型不再看到这部分内容）。</span>
      </div>
      ${this.errorMessage ? html`<div class="error">${this.errorMessage}</div>` : null}
      <div class="buttons">
        <button class="plain" type="button" @click=${this._onCancel}>取消</button>
        <button class="danger" type="button" ?disabled=${this._busy} @click=${this._onConfirm}>
          ${this._busy ? "删除中…" : "删除"}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "turn-delete-dialog": TurnDeleteDialog;
  }
}
