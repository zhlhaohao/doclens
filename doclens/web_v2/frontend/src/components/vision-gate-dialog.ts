import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { dialogSlotStyles } from "../utils/dialog-styles";
import { buttonBaseStyles, confirmButtonStyles, buttonRowStyles } from "../styles/button-styles";

/** 视觉能力拦截对话框（ADR-0034 L3，AP-1 从 chat-view 抽出）：当前模型不
 *  支持视觉时弹出，引导跳设置页切换；拦截的消息/图由 chat-view 保留在
 *  草稿与暂存区。确认冒泡 goto-settings，取消/ESC 冒泡 cancel。 */
@customElement("vision-gate-dialog")
export class VisionGateDialog extends LitElement {
  static styles = [
    dialogSlotStyles,
    buttonBaseStyles,
    confirmButtonStyles,
    buttonRowStyles,
    css`
      :host {
        display: block;
        max-width: 360px;
        font-size: var(--cortex-fs-md);
        color: var(--cortex-text);
      }
      h2 { font-size: var(--cortex-fs-lg); margin: 0 0 var(--cortex-space-2); }
      p { margin: 0 0 var(--cortex-space-2); color: var(--cortex-text-muted); line-height: 1.5; }
      .hint { color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm); }
    `,
  ];

  /** 当前对话模型名（展示用，空串 = 未命名）。 */
  @property() modelName = "";

  private _onGoto = (): void => {
    this.dispatchEvent(new CustomEvent("goto-settings", { bubbles: true, composed: true }));
  };

  private _onCancel = (): void => {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  render() {
    return html`
      <h2>当前模型不支持图像</h2>
      <p>这条消息带有图片，但当前对话模型（${this.modelName || "未命名"}）
        未声明视觉能力，发送会被模型忽略或报错。</p>
      <p class="hint">在设置 → 模型中切换到支持视觉的模型预设
        （或编辑当前预设勾选「支持视觉」），切换即时生效，回来重新发送即可。
        消息与图片已保留在输入框。</p>
      <div class="buttons">
        <button type="button" class="plain" @click=${this._onCancel}>取消</button>
        <button class="primary" type="button" @click=${this._onGoto}>前往设置</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "vision-gate-dialog": VisionGateDialog;
  }
}
