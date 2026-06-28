import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { SearchMode } from "../state/types";

@customElement("input-box")
export class InputBox extends LitElement {
  static styles = css`
    :host {
      display: block;
      --min-h: 48px;
    }
    .wrapper {
      position: relative;
      display: flex;
      align-items: center;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface-muted);
      min-height: var(--min-h);
      padding: 0 calc(var(--min-h) + 8px) 0 14px;
    }
    .wrapper:focus-within {
      border-color: var(--cortex-primary);
      box-shadow: 0 0 0 2px rgba(13, 148, 136, 0.15);
    }
    input, textarea {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      resize: none;
      min-height: calc(var(--min-h) - 12px);
      line-height: 1.4;
    }
    input::placeholder, textarea::placeholder { color: var(--cortex-text-subtle); }
    button {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      background: var(--cortex-primary);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-sm);
      min-width: var(--cortex-touch-target);
      height: calc(var(--min-h) - 8px);
      padding: 0 12px;
      font-size: var(--cortex-fs-md);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button:hover:not(:disabled) { background: var(--cortex-primary-hover); }
    /* 分裂按钮：主体 + caret 拼成单一控件（模式选择器） */
    .actions.split {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
    }
    .actions.split .primary {
      position: static;
      top: auto;
      right: auto;
      transform: none;
      border-radius: var(--cortex-radius-sm) 0 0 var(--cortex-radius-sm);
    }
    .caret {
      position: static;
      top: auto;
      right: auto;
      transform: none;
      background: var(--cortex-primary);
      color: #fff;
      border: none;
      border-left: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 0 var(--cortex-radius-sm) var(--cortex-radius-sm) 0;
      height: calc(var(--min-h) - 8px);
      min-width: 24px;
      padding: 0 8px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .caret:hover:not(:disabled) { background: var(--cortex-primary-hover); }
    .caret:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu {
      position: absolute;
      /* 向上展开：input-box（带模式选择器）只用在 search 初始态，位于页面底端，
         向下展开会落到视口之外不可见。 */
      bottom: calc(100% + 4px);
      right: 6px;
      z-index: 20;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
      overflow: hidden;
    }
    .menu-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item-title { font-size: var(--cortex-fs-md); color: var(--cortex-text); font-weight: 500; white-space: nowrap; }
    .menu-item-desc { font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); white-space: nowrap; }
    .menu-item.active .menu-item-title { color: var(--cortex-primary); font-weight: 600; }
    @media (max-width: 1023px) {
      :host { --min-h: 44px; }
    }
  `;

  @property() value = "";
  @property() placeholder = "";
  @property() buttonLabel = "搜索";
  @property() buttonIcon = "";
  @property({ type: Boolean }) multiline = false;
  @property({ type: Boolean }) disabled = false;

  /** 模式选择器：提供 .mode + .modes 时渲染分裂按钮 + caret 下拉；
   *  不提供时为遗留单一按钮（chat/files 等消费者不受影响）。 */
  @property() mode: SearchMode = "keyword";
  @property({ attribute: false }) modes: Record<SearchMode, { label: string; icon?: string; description?: string }> | null = null;
  @state() private _menuOpen = false;

  @query("input, textarea") private inputEl!: HTMLInputElement | HTMLTextAreaElement;

  /** Focus the inner input/textarea element. */
  focus(): void {
    this.inputEl?.focus();
  }

  private get trimmed() {
    return this.value.trim();
  }

  private _onInput(e: Event) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent("input-change", { detail: { value: this.value } }));
    // 同步更新按钮 disabled 状态，避免 Lit 异步渲染期间 disabled 按钮拦截 click 事件
    const btn = this.renderRoot.querySelector("button");
    if (btn) btn.disabled = !this.trimmed || this.disabled;
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this._submit();
    }
    if (e.key === "Enter" && !this.multiline && !e.shiftKey) {
      e.preventDefault();
      this._submit();
    }
  }

  private _submit() {
    if (!this.trimmed || this.disabled) return;
    this.dispatchEvent(new CustomEvent("submit", { detail: { value: this.trimmed } }));
  }

  private get _hasModes(): boolean {
    return !!this.modes && this.mode in this.modes;
  }

  private _toggleMenu(e: Event) {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
    if (this._menuOpen) {
      document.addEventListener("click", this._onDocClick);
    }
  }

  private _onDocClick = () => {
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
  };

  private _selectMode(key: SearchMode) {
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
    this.dispatchEvent(new CustomEvent("mode-change", { detail: { mode: key } }));
  }

  private _renderButton() {
    if (!this._hasModes) {
      // 遗留单一按钮：与改造前完全一致
      return html`
        <button @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
          ${this.buttonIcon ? html`<span aria-hidden="true">${this.buttonIcon}</span>` : null}
          <span>${this.buttonLabel}</span>
        </button>`;
    }
    const cur = this.modes![this.mode];
    return html`
      <div class="actions split">
        <button class="primary" @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
          ${cur?.icon ? html`<span aria-hidden="true">${cur.icon}</span>` : null}
          <span>${cur?.label ?? this.buttonLabel}</span>
        </button>
        <button class="caret" @click=${this._toggleMenu} ?disabled=${this.disabled}
                aria-label="切换搜索模式" aria-expanded=${this._menuOpen}>▾</button>
      </div>`;
  }

  private _renderMenu() {
    if (!this._hasModes || !this._menuOpen) return null;
    return html`
      <div class="menu" role="menu">
        ${(Object.keys(this.modes!) as SearchMode[]).map((key) => {
          const m = this.modes![key];
          return html`
            <div class="menu-item ${key === this.mode ? "active" : ""}" role="menuitem"
                 @click=${() => this._selectMode(key)}>
              <span class="menu-item-title">
                ${m.icon ? html`<span aria-hidden="true">${m.icon}</span>` : null}${m.label}
              </span>
              ${m.description ? html`<span class="menu-item-desc">${m.description}</span>` : null}
            </div>`;
        })}
      </div>`;
  }

  render() {
    const field = this.multiline
      ? html`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`
      : html`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          @input=${this._onInput} @keydown=${this._onKeydown} />`;
    return html`
      <div class="wrapper">
        ${field}
        ${this._renderButton()}
        ${this._renderMenu()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "input-box": InputBox;
  }
}
