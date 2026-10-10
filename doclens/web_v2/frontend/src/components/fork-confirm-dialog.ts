import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

/** 孪生复制确认框（2026-10-10）：说明复制语义（原会话保留、副本继承全部
 *  对话继续干活、加星不继承）；确认冒泡 fork-confirm，取消/ESC 冒泡
 *  cancel；执行由 chat-view 负责。 */
@customElement("fork-confirm-dialog")
export class ForkConfirmDialog extends LitElement {
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

  /** 源会话标题（展示用）。 */
  @property() sessionTitle = "";

  private _onConfirm = (): void => {
    this.dispatchEvent(new CustomEvent("fork-confirm", {
      bubbles: true, composed: true,
    }));
  };

  private _onCancel = (): void => {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  render() {
    return html`
      <h2>复制会话</h2>
      <p>将创建「${this.sessionTitle} (副本)」，继承全部对话内容，可在其中继续提问。</p>
      <p class="muted">原会话完整保留，不受任何影响。</p>
      <div class="note"><doclens-icon name="info"></doclens-icon>
        <span>副本不继承加星状态；文件回退快照不随副本迁移。</span>
      </div>
      <div class="buttons">
        <button type="button" @click=${this._onCancel}>取消</button>
        <button class="primary" type="button" @click=${this._onConfirm}>确认复制</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fork-confirm-dialog": ForkConfirmDialog;
  }
}
