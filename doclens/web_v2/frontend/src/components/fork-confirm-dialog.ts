import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { dialogSlotStyles } from "../utils/dialog-styles";

/** 孪生复制确认框（2026-10-10）：说明复制语义（原会话保留、副本继承全部
 *  对话继续干活、加星不继承）；确认冒泡 fork-confirm，取消/ESC 冒泡
 *  cancel；执行由 chat-view 负责。
 *  样式走 utils/dialog-styles 共享层（AP-27/29：本组件是 compact-confirm
 *  的静态单态子集，不并入其四态机——防 DRY Misuse，仅收敛重复样式）。 */
@customElement("fork-confirm-dialog")
export class ForkConfirmDialog extends LitElement {
  static styles = [
    dialogSlotStyles,
    css`
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
    `,
  ];

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
