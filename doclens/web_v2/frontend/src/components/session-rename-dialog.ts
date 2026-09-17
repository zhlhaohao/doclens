import { LitElement, html, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";

/** 会话标题改名对话框（2026-09-17）。
 *  外壳仿 rename-dialog，但校验规则不同：标题是自由文本（可含任意字符），
 *  仅要求非空 + 有变化；长度上限 60 与 chat 创建时的 slice(0, 60) 对齐。 */
@customElement("session-rename-dialog")
export class SessionRenameDialog extends LitElement {
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
    .err { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); margin-top: 4px; }
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

  @property({ type: String }) currentTitle = "";
  @state() private _title = "";
  @state() private _err = "";

  connectedCallback() {
    super.connectedCallback();
    this._title = this.currentTitle;
    // 预填后立即校验一次，使"标题未变化"在初始状态即可禁用提交
    this._err = this._validate(this._title);
  }

  private _validate(v: string): string {
    if (!v.trim()) return "标题不能为空";
    if (v === this.currentTitle) return "标题未变化";
    return "";
  }

  private _onInput(e: Event) {
    this._title = (e.target as HTMLInputElement).value;
    this._err = this._validate(this._title);
  }

  private _submit() {
    if (this._err) return;
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { title: this._title.trim() },
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
        <label>会话标题</label>
        <input
          autofocus
          maxlength="60"
          class=${invalid ? "invalid" : ""}
          .value=${this._title}
          @input=${this._onInput}
          @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this._submit()}
        />
        ${invalid ? html`<div class="err">${this._err}</div>` : ""}
      </div>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${invalid} @click=${this._submit}>重命名</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "session-rename-dialog": SessionRenameDialog; }
}
