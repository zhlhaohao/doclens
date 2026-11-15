/** 单输入框对话框基类（AP-28）：mkdir / new-file / rename / session-rename
 *  四件套此前各自复制同一段外壳（样式 60 行逐字相同 + label/input/err/actions
 *  骨架 + _onInput/_cancel/Enter 提交）。归一为 InputDialogBase：
 *  子类只提供 校验器 / label / placeholder / maxlength / 预填 / submitLabel
 *  与 _submitDetail()（决定 submit 事件的 detail 形状）。
 *  事件契约不变：submit（detail 由子类定）/ cancel，均冒泡+穿透。 */

import { LitElement, html, css, nothing } from "lit";
import { state } from "lit/decorators.js";

export abstract class InputDialogBase extends LitElement {
  static styles = css`
    :host { display: block; min-width: 360px; }
    .row { margin: var(--cortex-space-3) 0; }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin-bottom: 4px;
    }
    input {
      width: 100%; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-base);
      box-sizing: border-box;
      font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    input.invalid { border-color: var(--cortex-danger); }
    input.invalid:focus { box-shadow: var(--cortex-focus-ring-danger); }
    .err {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      margin-top: 4px;
    }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      input { font-size: 16px; padding: 10px; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;

  @state() protected _value = "";
  @state() protected _err = "";

  /** 输入框 label（可用模板，如含父目录路径）。 */
  protected abstract get inputLabel(): unknown;
  /** 校验：返回错误文案，合法返回 ""。 */
  protected abstract validate(v: string): string;
  /** submit 事件的 detail（子类决定形状，如 { path } / { newName } / { title }）。 */
  protected abstract submitDetail(v: string): Record<string, unknown>;
  /** 主按钮文案。 */
  protected get submitLabel(): string { return "确定"; }
  /** 输入框 placeholder（空则不渲染属性）。 */
  protected get placeholder(): string { return ""; }
  /** 输入框 maxlength（0 则不渲染属性）。 */
  protected get maxlength(): number { return 0; }
  /** 预填值（"" 不预填）；预填后立即校验一次，使「未变化」类错误初始即禁用提交。 */
  protected get prefill(): string { return ""; }

  connectedCallback() {
    super.connectedCallback();
    if (this.prefill) {
      this._value = this.prefill;
      this._err = this.validate(this._value);
    }
  }

  private _onInput(e: Event) {
    this._value = (e.target as HTMLInputElement).value;
    this._err = this.validate(this._value);
  }

  private _submit() {
    if (this._err) return;
    this.dispatchEvent(new CustomEvent("submit", {
      detail: this.submitDetail(this._value),
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    const invalid = !!this._err;
    return html`
      <div class="row">
        <label>${this.inputLabel}</label>
        <input
          autofocus
          class=${invalid ? "invalid" : ""}
          .value=${this._value}
          placeholder=${this.placeholder || nothing}
          maxlength=${this.maxlength ? String(this.maxlength) : nothing}
          @input=${this._onInput}
          @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this._submit()}
        />
        ${invalid ? html`<div class="err">${this._err}</div>` : ""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${invalid} @click=${this._submit}>${this.submitLabel}</button>
      </div>
    `;
  }
}
