/** 单输入框对话框基类（AP-28）：mkdir / new-file / rename / session-rename
 *  四件套此前各自复制同一段外壳（样式 60 行逐字相同 + label/input/err/actions
 *  骨架 + _onInput/_cancel/Enter 提交）。归一为 InputDialogBase：
 *  子类只提供 校验器 / label / placeholder / maxlength / 预填 / submitLabel
 *  与 _submitDetail()（决定 submit 事件的 detail 形状）。
 *  事件契约不变：submit（detail 由子类定）/ cancel，均冒泡+穿透。
 *
 *  视觉改版（2026-11-17，截图复盘）：修正三处「未交互即报错」的惊悚感——
 *  ① **未交互不报错**：预填后不再立即校验（此前一打开就是红框 + 红字
 *     「标题未变化」，用户什么都没做就被判错）；校验在首次输入后启动。
 *  ② **错误分级**：「未变化」这类「尚未修改」不是错误，降为中性提示
 *     （muted 灰字，不红框）；真正的非法输入（非法字符 / 非法文件名 /
 *     缺扩展名）仍是 danger 级（红字 + 红框）。
 *  ③ **禁用态可辨**：主按钮禁用时不再套 `opacity 0.4`——墨色按钮被压成
 *     灰砖看起来像坏掉；改用低对比但形态清晰的禁用态（描边 + 弱化文字）。
 *  另收紧排版间距，消除输入框与按钮排之间的大片空白。
 */

import { LitElement, html, css, nothing } from "lit";
import { buttonBaseStyles, buttonRowStyles } from "../styles/button-styles";
import { state } from "lit/decorators.js";
import { formStyles } from "../styles/form-styles";

/**
 * 校验结果分级：两级都**阻断提交**（值不可提交时按钮禁用），
 * 区别只在**呈现**——
 *  - error：真错误（非法字符 / 缺扩展名 / 为空）→ 红字 + 红框，警示级；
 *  - hint：非错误的中性状态（「标题未变化」= 尚未修改）→ 灰字，无红框。
 * 区分的意义：不是所有「不能提交」都该惊悚——用户刚打开对话框什么都没做，
 * 就给红框红字是误伤。
 */
export type ValidationResult =
  | string
  | { message: string; level: "error" | "hint" };

export abstract class InputDialogBase extends LitElement {
  static styles = [buttonBaseStyles, buttonRowStyles, formStyles, css`
    :host { display: block; min-width: 360px; }
    .row { margin-bottom: var(--cortex-space-4); }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin-bottom: var(--cortex-space-2);
    }
    /* 单输入框：对话框场景字号略大（本地覆盖，形态走公共块 formStyles） */
    input {
      width: 100%;
      padding: var(--cortex-space-2) var(--cortex-space-3);
      font-size: var(--cortex-fs-base);
    }
    input.invalid { border-color: var(--cortex-danger); }
    input.invalid:focus { box-shadow: var(--cortex-focus-ring-danger); }
    /* 错误（阻断级）：红字 + 左侧警示条 */
    .err {
      display: flex;
      align-items: flex-start;
      gap: var(--cortex-space-2);
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      margin-top: var(--cortex-space-2);
      padding-left: var(--cortex-space-2);
      border-left: 2px solid var(--cortex-danger);
    }
    /* 提示（未变化等中性状态）：灰字，不惊悚 */
    .hint {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin-top: var(--cortex-space-2);
    }
    .actions { margin-top: 0; }
    /* 禁用态主按钮：描边 + 弱化文字（不再用 opacity——墨色被压成灰砖，
       看起来像坏掉的按钮）；hover 反馈同步关闭 */
    button.primary:disabled {
      background: transparent;
      border: 1px solid var(--cortex-border);
      color: var(--cortex-text-muted);
      opacity: 1;
      cursor: not-allowed;
    }
    button.primary:disabled:hover { opacity: 1; }
    @media (max-width: 1023px) {
      :host { min-width: 0; max-width: 100%; }
      input { font-size: 16px; padding: 10px; }
    }
  `];;

  @state() protected _value = "";
  @state() protected _err = "";
  /** 校验级别（error / hint）——「未变化」为 hint，其余为 error。 */
  @state() protected _errLevel: "error" | "hint" = "error";
  /** 用户是否已交互——未交互前不做校验（避免一打开就红字）。 */
  @state() protected _touched = false;

  /** 输入框 label（可用模板，如含父目录路径）。 */
  protected abstract get inputLabel(): unknown;
  /** 校验：返回错误文案，合法返回 ""。
   *  可返回 { message, level } 细分级别——level:"hint" 为中性提示
   *  （如「标题未变化」：不是错误，只是尚未修改）。 */
  protected abstract validate(v: string): ValidationResult;
  /** submit 事件的 detail（子类决定形状，如 { path } / { newName } / { title }）。 */
  protected abstract submitDetail(v: string): Record<string, unknown>;
  /** 主按钮文案。 */
  protected get submitLabel(): string { return "确定"; }
  /** 输入框 placeholder（空则不渲染属性）。 */
  protected get placeholder(): string { return ""; }
  /** 输入框 maxlength（0 则不渲染属性）。 */
  protected get maxlength(): number { return 0; }
  /** 预填值（"" 不预填）。 */
  protected get prefill(): string { return ""; }

  connectedCallback() {
    super.connectedCallback();
    if (this.prefill) this._value = this.prefill;
    // 预填后校验一次——决定「主按钮是否可点」（值未变化 → 禁用）。
    // 但**不展示**提示（未交互）：展示由 _touched 闸门控制。
    this._applyValidation(this.validate(this._value));
  }

  /** 校验结果归一：字符串 → error 级；对象 → 按 level。 */
  private _applyValidation(res: ValidationResult): void {
    if (!res) {
      this._err = "";
      this._errLevel = "error";
    } else if (typeof res === "string") {
      this._err = res;
      this._errLevel = "error";
    } else {
      this._err = res.message;
      this._errLevel = res.level;
    }
  }

  private _onInput(e: Event) {
    this._value = (e.target as HTMLInputElement).value;
    this._touched = true;
    this._applyValidation(this.validate(this._value));
  }

  private _submit() {
    this._applyValidation(this.validate(this._value));
    if (this._invalid) return;
    this.dispatchEvent(new CustomEvent("submit", {
      detail: this.submitDetail(this._value),
      bubbles: true, composed: true,
    }));
  }

  /** 存在阻断性校验失败——error 与 hint 两级都阻断提交（值不可提交）。 */
  private get _invalid(): boolean {
    return !!this._err;
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    const showErr = this._touched && !!this._err;
    const blocking = this._errLevel === "error";
    return html`
      <div class="row">
        <label>${this.inputLabel}</label>
        <input
          autofocus
          class=${showErr && blocking ? "invalid" : ""}
          .value=${this._value}
          placeholder=${this.placeholder || nothing}
          maxlength=${this.maxlength ? String(this.maxlength) : nothing}
          @input=${this._onInput}
          @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this._submit()}
        />
        ${showErr
          ? (blocking
              ? html`<div class="err">${this._err}</div>`
              : html`<div class="hint">${this._err}</div>`)
          : nothing}
      </div>
      <div class="actions">
        <button class="plain" @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${this._invalid} @click=${this._submit}>${this.submitLabel}</button>
      </div>
    `;
  }
}
