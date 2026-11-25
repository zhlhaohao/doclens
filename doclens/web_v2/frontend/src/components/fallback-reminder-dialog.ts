import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { dialogSlotStyles } from "../utils/dialog-styles";
import { buttonBaseStyles, confirmButtonStyles, buttonRowStyles } from "../styles/button-styles";

/** 兜底切换后的下一回合提醒（ADR-0061 补充）：上一回合主模型额度耗尽、
 *  自动切到了兜底模型，而激活预设至今未变——发下一条消息前提醒用户：
 *  继续发送会先再撞一次主模型耗尽（然后再次切换），或先去设置页换模型。
 *  「继续发送」冒泡 proceed，「前往设置」冒泡 goto-settings，取消/ESC 冒泡 cancel。 */
@customElement("fallback-reminder-dialog")
export class FallbackReminderDialog extends LitElement {
  static styles = [
    dialogSlotStyles,
    buttonBaseStyles,
    confirmButtonStyles,
    buttonRowStyles,
    css`
      :host {
        display: block;
        max-width: 380px;
        font-size: var(--cortex-fs-md);
        color: var(--cortex-text);
      }
      h2 { font-size: var(--cortex-fs-lg); margin: 0 0 var(--cortex-space-2); }
      p { margin: 0 0 var(--cortex-space-2); color: var(--cortex-text-muted); line-height: 1.5; }
      .hint { color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm); }
      b { color: var(--cortex-text); }
    `,
  ];

  /** 上一回合的主模型（被切换掉的，展示用）。 */
  @property() baseModel = "";
  /** 上一回合切到的兜底模型（展示用）。 */
  @property() fallbackModel = "";

  private _onProceed = (): void => {
    this.dispatchEvent(new CustomEvent("proceed", { bubbles: true, composed: true }));
  };

  private _onGoto = (): void => {
    this.dispatchEvent(new CustomEvent("goto-settings", { bubbles: true, composed: true }));
  };

  private _onCancel = (): void => {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  render() {
    return html`
      <h2>主模型可能仍不可用</h2>
      <p>上一回合 <b>${this.baseModel || "主模型"}</b> 额度耗尽，已自动切换到兜底模型
        <b>${this.fallbackModel || "兜底"}</b> 完成；当前激活的模型预设至今未变。</p>
      <p class="hint">继续发送会先尝试主模型——若额度仍未恢复，会再次自动切换（多等几秒）。
        若想直接换模型，去设置 → 模型切换预设后回来重发，消息已保留在输入框。</p>
      <div class="buttons">
        <button type="button" @click=${this._onCancel}>取消</button>
        <button type="button" @click=${this._onGoto}>前往设置</button>
        <button class="primary" type="button" @click=${this._onProceed}>继续发送</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fallback-reminder-dialog": FallbackReminderDialog;
  }
}
