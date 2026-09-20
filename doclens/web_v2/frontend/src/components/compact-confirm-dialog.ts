import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

/** 压缩上下文确认框（ADR-0026 手动压缩入口的用户确认步骤）。
 *  说明压缩语义（摘要替换上下文、展示不变、耗时数十秒）；确认冒泡
 *  compact-confirm，取消/ESC 冒泡 cancel；执行由 chat-view 负责。 */
@customElement("compact-confirm-dialog")
export class CompactConfirmDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-width: 340px;
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
    }
    h2 {
      font-size: var(--cortex-fs-lg);
      margin: 0 0 var(--cortex-space-4);
    }
    p {
      margin: 0 0 var(--cortex-space-3);
      line-height: 1.6;
    }
    .muted {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
    }
    .note {
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
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    button {
      padding: 8px 18px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
    }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
    }
    button.primary:hover { opacity: 0.9; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .buttons { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .buttons button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;

  private _onConfirm = (): void => {
    this.dispatchEvent(new CustomEvent("compact-confirm", {
      bubbles: true, composed: true,
    }));
  };

  private _onCancel = (): void => {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  render() {
    return html`
      <h2>压缩上下文</h2>
      <p>AI 将把当前会话历史总结为一份摘要，之后的对话基于摘要继续，可显著降低上下文占用。</p>
      <p class="muted">聊天记录展示不变，仍然完整可见；生成摘要约需几十秒。</p>
      <div class="note"><doclens-icon name="info"></doclens-icon>
        <span>与上下文占用达到阈值时的自动压缩是同一机制，此处为手动提前执行。</span>
      </div>
      <div class="buttons">
        <button type="button" @click=${this._onCancel}>取消</button>
        <button class="primary" type="button" @click=${this._onConfirm}>确认压缩</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "compact-confirm-dialog": CompactConfirmDialog;
  }
}
