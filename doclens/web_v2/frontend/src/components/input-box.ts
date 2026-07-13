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
      border: 1px solid var(--cortex-chat-input-border);
      border-radius: var(--cortex-radius-lg);
      background: var(--cortex-chat-input-bg);
      min-height: var(--min-h);
      padding: 0 var(--cortex-input-btn-reserve, calc(var(--min-h) + 6px)) 0 18px;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .wrapper:focus-within {
      border-color: var(--cortex-primary);
      background: var(--cortex-surface);
      box-shadow: var(--cortex-focus-ring);
    }
    input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      border-radius: var(--cortex-radius-md);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      /* Shadow DOM 不继承全局 box-sizing，必须显式声明，否则 padding 会把
         height 撑大 2 倍（44px height + 22px padding = 66px 高，移动端 ≈ 2.5 字）。 */
      box-sizing: border-box;
      /* 单行输入框：显式 height + 等高 line-height → 文字 100% 垂直居中 */
      height: var(--min-h);
      line-height: var(--min-h);
      padding: 0;
    }
    textarea {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      border-radius: var(--cortex-radius-md);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      resize: none;
      /* Shadow DOM 内必须显式声明 box-sizing，否则 min-height 是 content-box
         高度，padding 会叠加在外部导致总高度 = min-height + padding。 */
      box-sizing: border-box;
      /* 多行输入框：min-height 保证 1 行时总高度（含 padding）= wrapper 高度；
         line-height + padding 组合让单行文本视觉上居中（22.5px 文字在 24px
         内容区里 ≈ 完美居中）。实际高度由 _autoResize 按 scrollHeight 撑开。 */
      min-height: var(--min-h);
      line-height: 1.5;
      padding: 11px 0;
    }
    /* multiline 自动扩充：默认单行高度，换行后随内容增高，超出上限内部滚动 */
    textarea {
      max-height: 200px;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    textarea::-webkit-scrollbar {
      display: none;
    }
    input::placeholder, textarea::placeholder { color: var(--cortex-text-subtle); }
    button {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      background: var(--cortex-primary-gradient);
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-lg);
      min-width: calc(var(--min-h) - 12px);
      height: calc(var(--min-h) - 12px);
      padding: 0 14px;
      font-size: var(--cortex-fs-md);
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      box-shadow: var(--cortex-primary-glow);
      transition: filter 0.15s, transform 0.1s;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
    button:hover:not(:disabled) { filter: brightness(1.05); }
    button:active:not(:disabled) { transform: translateY(-50%) scale(0.96); }
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
      border-radius: var(--cortex-radius-lg) 0 0 var(--cortex-radius-lg);
      /* 分裂按钮：primary 与 caret 拼成单一控件，必须共享同一 elevation；
         抑制主按钮的 glow，避免左半 "漂浮" 而右半扁平的不对称视觉。 */
      box-shadow: none;
    }
    .actions.split .primary:active:not(:disabled) { transform: scale(0.96); }
    .caret {
      box-sizing: border-box;
      position: static;
      top: auto;
      right: auto;
      transform: none;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 0 var(--cortex-radius-md) var(--cortex-radius-md) 0;
      box-shadow: none;
      height: calc(var(--min-h) - 12px);
      min-width: 28px;
      padding: 0 10px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .caret:hover:not(:disabled) { background: var(--cortex-surface-muted); filter: none; }
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
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-shadow-lg);
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
    .menu-item.active { background: var(--cortex-primary-soft); }
    .menu-item.active:hover { background: var(--cortex-primary-soft); }
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

  updated(changedProps: Map<string, unknown>) {
    super.updated?.(changedProps);
    // value 外部更新（如提交后清空）或多行态切换时，重新计算高度
    if (changedProps.has("value") || changedProps.has("multiline")) {
      this._autoResize();
    }
  }

  /** textarea 按内容自动扩充高度：单行起步，换行后增高，超上限内部滚动 */
  private _autoResize() {
    const ta = this.renderRoot.querySelector("textarea");
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
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
    this._autoResize();
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    // multiline：Enter 发送、Shift+Enter 换行；非 multiline：Enter 始终发送
    if (e.shiftKey && this.multiline) return;
    e.preventDefault();
    this._submit();
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
