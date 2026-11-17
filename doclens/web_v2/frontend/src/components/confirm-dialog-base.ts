/** 确认类对话框基类（AP-4）。
 *
 *  六个确认框（compact / fork / import / turn-delete / rewind / delete）
 *  此前共用同一外壳骨架：h2 标题 → 说明段 → .note / .warn 提示块 →
 *  .anchor 锚点摘录 → 错误行 → 按钮排 → 提交中禁用。但每件各自复制
 *  一遍外壳与状态机（_busy / _submitting / errorMessage 回填）。
 *
 *  归一为 **ConfirmDialogBase**（对标既有 InputDialogBase 范式）：
 *  基类承担外壳骨架 + 提交中状态 + 错误回填 + 按钮语义；子类只提供
 *  标题/正文/警示/危险语义与提交动作。
 *
 *  **不主张把六件合成一件**（防 DRY Misuse）——各件的状态机确有差异：
 *  - compact 是四态机（confirm/running/done/error），running 态是整屏
 *    进度视图而非确认视图；
 *  - import 是三态机（confirm/exists/busy），exists 态提供「作为副本导入」
 *    第二确认语义；
 *  - delete 有异步 stats 加载态 + checkbox 门控（未勾选不能提交）；
 *  - turn-delete / rewind / fork 是单态确认 + 提交中禁用。
 *  基类只抽取**共有的单态确认外壳**（renderConfirm），多态件覆写
 *  render() 自行分派。
 *
 *  事件契约不变：各件原有的事件名（compact-confirm / fork-confirm /
 *  import-confirm / turn-delete-confirm / rewind-confirm / submit）与
 *  cancel 均冒泡 + 穿透，宿主无需改动。
 */

import { LitElement, html, css, nothing } from "lit";
import { state } from "lit/decorators.js";
import {
  buttonBaseStyles,
  confirmButtonStyles,
  buttonRowStyles,
} from "../styles/button-styles";
import { confirmStyles } from "../styles/confirm-styles";

export abstract class ConfirmDialogBase extends LitElement {
  static styles = [
    buttonBaseStyles,
    confirmButtonStyles,
    buttonRowStyles,
    confirmStyles,
    css`
      :host {
        display: block;
        min-width: 340px;
        max-width: 460px;
        font-size: var(--cortex-fs-md);
        color: var(--cortex-text);
      }
    `,
  ];

  /** 提交中（防重复点击；按钮禁用 + 文案切换）。 */
  @state() protected _submitting = false;
  /** 提交失败文案（宿主回填）。 */
  @state() protected _errorMessage = "";

  /** 实际生效的「提交中」状态——子类可覆写为 prop 形式
   *  （如 turn-delete 的 submitting 由宿主回传，属单一真相源，
   *  见 AP-36：confirm 派发是同步的，宿主随即置 true 回传）。 */
  protected get isSubmitting(): boolean { return this._submitting; }
  /** 实际生效的错误文案——子类可覆写为 prop 形式。 */
  protected get submitError(): string { return this._errorMessage; }
  /** 主按钮是否可点——默认与「提交中」互斥；子类可加额外前置条件
   *  （如 rewind 的「预览未加载完 / 预览失败时不可提交」）。 */
  protected get canSubmit(): boolean { return !this.isSubmitting; }

  /** 标题（可含图标模板）——不叫 title：与 HTMLElement.title 冲突。 */
  protected abstract get dialogTitle(): unknown;
  /** 正文说明（说明段 + 可选提示块 / 警示块 / 摘录块）。 */
  protected abstract renderBody(): unknown;
  /** 主按钮文案。 */
  protected abstract get confirmLabel(): string;
  /** 提交动作：派发确认事件（子类实现）。 */
  protected abstract confirm(): void;
  /** 主按钮是否危险语义（danger 变体）。 */
  protected get danger(): boolean { return false; }
  /** 取消动作：派发 cancel 事件。 */
  protected cancel(): void {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  /** 默认渲染单态确认外壳（多态件覆写 render() 自行分派）。 */
  render(): unknown {
    return this.renderConfirm();
  }

  /** 单态确认外壳（多态件覆写 render() 自行分派）。 */
  protected renderConfirm(): unknown {
    return html`
      <h2>${this.dialogTitle}</h2>
      ${this.renderBody()}
      ${this.submitError ? html`<div class="error">${this.submitError}</div>` : nothing}
      <div class="buttons">
        <button class="plain" type="button" @click=${this.cancel}>取消</button>
        <button
          class=${this.danger ? "danger" : "primary"}
          type="button"
          ?disabled=${!this.canSubmit}
          @click=${this.confirm}
        >
          ${this.isSubmitting ? `${this.confirmLabel}中…` : this.confirmLabel}
        </button>
      </div>
    `;
  }
}
