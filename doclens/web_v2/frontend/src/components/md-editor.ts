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
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    .toolbar .path {
      flex: 1;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
    .toolbar .dirty {
      color: #d97706;
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
    }
    .toolbar .error-msg {
      color: #dc2626;
      font-size: var(--cortex-fs-sm);
      flex: 1;
    }
    button {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: 4px;
      cursor: pointer;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.save-btn {
      background: var(--cortex-primary);
      color: #fff;
      border-color: var(--cortex-primary);
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }
    .line-col {
      flex-shrink: 0;
      padding: 8px 6px 8px 0;
      text-align: right;
      color: var(--cortex-text-subtle);
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
      padding: 8px 12px;
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      background: var(--cortex-surface);
      color: inherit;
      white-space: pre;
      overflow: auto;
    }
  `;

  @property() path = "";
  @property() originalContent = "";

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
        <span class="path">${this.path}</span>
        ${this._error
          ? html`<span class="error-msg">⚠ ${this._error}</span>`
          : this._dirty
          ? html`<span class="dirty">●未保存</span>`
          : null}
        <button class="save-btn" ?disabled=${!this._dirty} @click=${this._onSaveClick}>
          💾 保存
        </button>
        <button class="cancel-btn" @click=${this._onCancelClick}>✖ 取消</button>
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
