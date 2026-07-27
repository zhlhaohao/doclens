import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

const DEBOUNCE_MS = 80;
const DEFAULT_PLACEHOLDER = "按文件名搜索…";

@customElement("file-search-box")
export class FileSearchBox extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      background: var(--cortex-surface);
      flex-shrink: 0;
    }
    .box {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
    }
    .box:focus-within {
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .box:has(input:disabled) {
      background: var(--cortex-surface-muted);
    }
    .icon { color: var(--cortex-text-subtle); font-size: 16px; }
    input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      color: var(--cortex-text);
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
    }
    input::placeholder { color: var(--cortex-text-subtle); }
    input:disabled { opacity: 0.5; cursor: not-allowed; }
    button.clear {
      border: none;
      background: transparent;
      color: var(--cortex-text-subtle);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0 4px;
      border-radius: var(--cortex-radius-sm);
    }
    button.clear:hover { color: var(--cortex-text); background: var(--cortex-surface-muted); }
  `;

  @state() private _value = "";
  @state() private _isComposing = false;

  /** 父组件根据 store 错误态/空文档态 disable 输入。 */
  @property({ type: Boolean }) disabled = false;
  /** 父组件根据状态传入提示语（默认值为 "按文件名搜索…"）。 */
  @property() placeholder = DEFAULT_PLACEHOLDER;
  /** 当前查询词。父组件传入以保证重挂载（如移动端返回 tree 面板）后输入框内容不丢。 */
  @property({ type: String }) value = "";

  private _timer: any = null;

  connectedCallback() {
    super.connectedCallback();
    // 重挂载时（如移动端返回 tree 面板）从外部 value 恢复输入框内容。
    // 避免在 updated/willUpdate 中再设 _value（会触发 Lit 的 change-in-update 警告）。
    if (this.value) {
      this._value = this.value;
    }
  }

  disconnectedCallback() {
    if (this._timer) clearTimeout(this._timer);
    super.disconnectedCallback();
  }

  private _emitSearch() {
    this.dispatchEvent(new CustomEvent("search", {
      detail: { query: this._value },
      bubbles: true,
      composed: true,
    }));
  }

  private _scheduleEmit() {
    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this._timer = null;
      if (!this._isComposing) this._emitSearch();
    }, DEBOUNCE_MS);
  }

  private _emitClear() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._value = "";
    // 强制同步 DOM input.value，避免外部直接修改 DOM 后 state 无变化导致 Lit 不重渲染
    const input = this.shadowRoot?.querySelector("input") as HTMLInputElement | null;
    if (input) input.value = "";
    this.dispatchEvent(new CustomEvent("clear", {
      bubbles: true,
      composed: true,
    }));
  }

  private _onInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    this._value = input.value;
    if (this._value.trim() === "") {
      // 空输入直接清空（不走防抖），让中栏立即恢复 file-list
      this._emitClear();
      return;
    }
    this._scheduleEmit();
  };

  private _onCompositionStart = () => {
    this._isComposing = true;
  };

  private _onCompositionEnd = () => {
    this._isComposing = false;
    // composition 结束后立即触发一次（中文输入法确认后再搜）
    this._scheduleEmit();
  };

  private _onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      this._emitClear();
    }
  };

  private _onClearClick = () => {
    this._emitClear();
    // 清空后焦点回到 input
    const input = this.shadowRoot?.querySelector("input") as HTMLInputElement | null;
    input?.focus();
  };

  render() {
    return html`
      <div class="box">
        <doclens-icon class="icon" name="search"></doclens-icon>
        <input
          type="text"
          ?disabled=${this.disabled}
          placeholder=${this.placeholder}
          .value=${this._value}
          @input=${this._onInput}
          @compositionstart=${this._onCompositionStart}
          @compositionend=${this._onCompositionEnd}
          @keydown=${this._onKeyDown}
        />
        ${this._value
          ? html`<button class="clear" title="清空" @click=${this._onClearClick}>×</button>`
          : ""}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-search-box": FileSearchBox; }
}
