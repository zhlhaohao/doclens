import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/**
 * <md-editor> — textarea + 行号 + dirty 状态 + 键盘事件。
 *
 * 设计为纯 UI 组件：
 * - 不调用任何 API（save 由父组件处理）
 * - 不弹任何 confirm 对话框
 * - 通过事件向父组件汇报 dirty / save / cancel
 */
@customElement("md-editor")
export class MdEditor extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
      border-radius: var(--cortex-radius-lg);
      overflow: hidden;
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .toolbar .path {
      flex: 1;
      min-width: 0;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .toolbar .dirty {
      color: var(--cortex-warning);
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
    }
    .toolbar .error-msg {
      color: var(--cortex-danger);
      background: rgba(220, 38, 38, 0.06);
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-1) var(--cortex-space-2);
      border-radius: var(--cortex-radius-sm);
      flex: 1;
    }
    /* 次级按钮：hairline + radius-sm + muted */
    button {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    button:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border-color: var(--cortex-text-subtle);
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }
    /* 主按钮：保存 = primary gradient + glow */
    button.save-btn {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.save-btn:hover {
      opacity: 0.9;
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
    }
    button.save-btn:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    /* 行号列（gutter）：surface-muted + subtle + mono + border-right */
    .line-col {
      flex-shrink: 0;
      padding: var(--cortex-space-3) var(--cortex-space-2);
      text-align: right;
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      user-select: none;
      overflow: hidden;
      background: var(--cortex-surface-muted);
      border-right: 1px solid var(--cortex-border-muted);
      min-width: 32px;
    }
    .line-col .line-no {
      display: block;
    }
    textarea {
      flex: 1;
      resize: none;
      border: none;
      outline: none;
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      background: var(--cortex-surface);
      color: var(--cortex-text);
      white-space: pre;
      overflow: auto;
    }
  `;

  @property() path = "";
  @property() originalContent = "";
  /** 移动端隐藏文件名（顶部 bar 已经显示）。 */
  @property({ type: Boolean }) mobile = false;

  @state() private _text = "";
  @state() private _dirty = false;
  @state() private _error: string | null = null;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("originalContent")) {
      this._text = this.originalContent;
      this._dirty = false;
      this._error = null;
    }
  }

  private get _lineCount(): number {
    // "a\nb\nc" → 3 行；"a\nb" → 2 行；"" → 1 行
    if (this._text === "") return 1;
    return (this._text.match(/\n/g) ?? []).length + 1;
  }

  private _onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    this._text = ta.value;
    this._error = null;
    this._updateDirty();
  }

  private _onScroll(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    const lineCol = this.shadowRoot!.querySelector(".line-col") as HTMLElement;
    if (lineCol) lineCol.scrollTop = ta.scrollTop;
  }

  private _onKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (this._dirty) this._emitSave();
    }
  }

  private _updateDirty() {
    const next = this._text !== this.originalContent;
    if (next !== this._dirty) {
      this._dirty = next;
      this.dispatchEvent(
        new CustomEvent("dirty-change", { detail: { dirty: next } }),
      );
    }
  }

  private _emitSave() {
    this.dispatchEvent(
      new CustomEvent("save", { detail: { content: this._text } }),
    );
  }

  private _onSaveClick = () => {
    if (this._dirty) this._emitSave();
  };

  private _onCancelClick = () => {
    this.discard();
  };

  /** 强制重置为 originalContent，并 emit cancel。供父组件在用户确认"丢弃"后调用。 */
  discard() {
    this._text = this.originalContent;
    this._dirty = false;
    this._error = null;
    this._updateDirty();
    this.dispatchEvent(new CustomEvent("cancel", {}));
  }

  /** 设置错误信息（由父组件在保存失败时调用）。下一次输入会自动清除。 */
  setError(msg: string) {
    this._error = msg;
  }

  render() {
    const lines: number[] = [];
    for (let i = 1; i <= this._lineCount; i++) lines.push(i);
    return html`
      <div class="toolbar">
        ${this.mobile
          ? null
          : html`<span class="path">${this.path}</span>`}
        ${this._error
          ? html`<span class="error-msg"><doclens-icon name="alert-triangle"></doclens-icon> ${this._error}</span>`
          : this._dirty
          ? html`<span class="dirty">●未保存</span>`
          : null}
        <button class="save-btn" ?disabled=${!this._dirty} @click=${this._onSaveClick}>
          <doclens-icon name="save"></doclens-icon>保存
        </button>
        <button class="cancel-btn" @click=${this._onCancelClick}><doclens-icon name="x"></doclens-icon>取消</button>
      </div>
      <div class="body">
        <div class="line-col">
          ${lines.map((n) => html`<span class="line-no">${n}</span>`)}
        </div>
        <textarea
          spellcheck="false"
          .value=${this._text}
          @input=${this._onInput}
          @scroll=${this._onScroll}
          @keydown=${this._onKeyDown}
        ></textarea>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "md-editor": MdEditor;
  }
}
