import { LitElement, html, css } from "lit";
import { customElement, state, property } from "lit/decorators.js";

const ILLEGAL = /[\\/:*?"<>|]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

@customElement("rename-dialog")
export class RenameDialog extends LitElement {
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
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
      box-sizing: border-box;
      font-family: inherit;
    }
    input.invalid { border-color: var(--cortex-danger); }
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
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-primary);
      color: white;
      border-color: var(--cortex-primary);
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
  `;

  @property({ type: String }) currentName = "";
  @state() private _name = "";
  @state() private _err = "";

  connectedCallback() {
    super.connectedCallback();
    this._name = this.currentName;
    // 预填后立即校验一次，使"名称未变化"在初始状态即可禁用提交
    this._err = this._validate(this._name);
  }

  private _validate(v: string): string {
    if (!v) return "名称不能为空";
    if (v === this.currentName) return "名称未变化";
    if (v.startsWith(".")) return "不能以点开头";
    if (ILLEGAL.test(v)) return '含非法字符 / \\ : * ? " < > |';
    if (RESERVED.test(v)) return "Windows 保留名";
    return "";
  }

  private _onInput(e: Event) {
    this._name = (e.target as HTMLInputElement).value;
    this._err = this._validate(this._name);
  }

  private _submit() {
    if (this._err) return;
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { newName: this._name },
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
        <label>重命名</label>
        <input
          autofocus
          class=${invalid ? "invalid" : ""}
          .value=${this._name}
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
  interface HTMLElementTagNameMap { "rename-dialog": RenameDialog; }
}
