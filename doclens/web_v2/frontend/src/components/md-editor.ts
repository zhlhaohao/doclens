import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  ScrollJumpController,
  scrollJumpFabStyles,
  renderScrollJumpFabs,
} from "../utils/scroll-jump";

/**
 * <md-editor> — textarea（自动折行）+ dirty 状态 + 键盘事件。
 *
 * 设计为纯 UI 组件：
 * - 不调用任何 API（save 由父组件处理）
 * - 不弹任何 confirm 对话框
 * - 通过事件向父组件汇报 dirty / save / cancel
 *
 * 折行（pre-wrap）决策（2026-08-01）：长行自动折回不横向滚动；
 * 因此移除了旧行号列（折行后「一源行 = 一固定行高」不成立，行号必然错位）。
 * 位置锚点改用隐藏镜像 div 测量：topLine() / scrollToLine() 供
 * preview-pane 做预览↔编辑切换的位置保持。
 */
@customElement("md-editor")
export class MdEditor extends LitElement {
  static styles = [
    scrollJumpFabStyles,
    css`
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
      position: relative;  /* FAB absolute 定位上下文 */
    }
    /* 悬浮跳转按钮：覆盖在 textarea 右下角 */
    .body > .scroll-jump-fabs {
      position: absolute;
      right: var(--cortex-space-3);
      bottom: var(--cortex-space-3);
    }
    /* 隐藏镜像 div：与 textarea 同宽同字体，用于折行下的行号↔像素换算 */
    .mirror {
      position: absolute;
      top: 0;
      left: 0;
      visibility: hidden;
      pointer-events: none;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      z-index: -1;
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
      white-space: pre-wrap;  /* 长行自动折回，不横向滚动 */
      overflow: auto;
    }
  `,
  ];

  @property() path = "";
  @property() originalContent = "";
  /** 移动端隐藏文件名（顶部 bar 已经显示）。 */
  @property({ type: Boolean }) mobile = false;

  @state() private _text = "";
  @state() private _dirty = false;
  @state() private _error: string | null = null;

  /** 悬浮跳转按钮：瞬跳 + 光标移动到文首/文末（对齐 Ctrl+Home/Ctrl+End 手感） */
  private _scrollJump = new ScrollJumpController(this, {
    behavior: "auto",
    onJumpTop: (el) => this._jumpToEdge(el as HTMLTextAreaElement, 0),
    onJumpBottom: (el) => {
      const ta = el as HTMLTextAreaElement;
      this._jumpToEdge(ta, ta.value.length);
    },
  });

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("originalContent")) {
      this._text = this.originalContent;
      this._dirty = false;
      this._error = null;
    }
  }

  firstUpdated() {
    const ta = this.shadowRoot!.querySelector("textarea");
    if (ta) this._scrollJump.attach(ta);
  }

  updated() {
    // 内容/尺寸变化后重算悬浮按钮显隐
    this._scrollJump.refresh();
  }

  private get _textarea(): HTMLTextAreaElement | null {
    return this.shadowRoot!.querySelector("textarea");
  }

  private _jumpToEdge(ta: HTMLTextAreaElement, pos: number) {
    ta.focus();
    ta.setSelectionRange(pos, pos);
    // 光标就位后浏览器会把 caret 滚进视口；显式设定确保贴边
    ta.scrollTop = pos === 0 ? 0 : ta.scrollHeight - ta.clientHeight;
  }

  private get _lines(): string[] {
    return this._text.split("\n");
  }

  /** 同步镜像 div 的宽度/字体到 textarea 内容区，返回镜像元素 */
  private _syncMirror(): HTMLDivElement | null {
    const ta = this._textarea;
    const m = this.shadowRoot!.querySelector(".mirror") as HTMLDivElement | null;
    if (!ta || !m) return null;
    const cs = getComputedStyle(ta);
    const contentWidth =
      ta.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    m.style.width = `${contentWidth}px`;
    m.style.fontFamily = cs.fontFamily;
    m.style.fontSize = cs.fontSize;
    m.style.lineHeight = cs.lineHeight;
    m.style.letterSpacing = cs.letterSpacing;
    return m;
  }

  /** 源行 n（1-indexed）之前的所有行在折行渲染下的视觉总高度（px）。
   *  join 不含尾换行：pre-wrap 下每条源行的视觉高度自然累加。 */
  private _heightBeforeLine(n: number): number {
    if (n <= 1) return 0;
    const m = this._syncMirror();
    if (!m) return 0;
    const lines = this._lines;
    m.textContent = lines.slice(0, Math.min(n - 1, lines.length)).join("\n");
    const h = m.offsetHeight;
    m.textContent = "";
    return h;
  }

  /** 视口顶部所在的源行号（1-indexed）。折行下行高不固定，用二分反查。
   *  供 preview-pane 在编辑→预览切换时捕获位置锚点。 */
  topLine(): number {
    const ta = this._textarea;
    if (!ta) return 1;
    const st = ta.scrollTop;
    const total = this._lines.length;
    let lo = 1;
    let hi = total;
    // 找最大 n 使 heightBeforeLine(n) <= scrollTop，即顶部落在第 n 行
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._heightBeforeLine(mid) <= st) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** 滚动使源行 n（1-indexed）贴顶（瞬跳）。
   *  供 preview-pane 在预览→编辑切换时恢复位置锚点。 */
  scrollToLine(n: number) {
    const ta = this._textarea;
    if (!ta) return;
    ta.scrollTop = this._heightBeforeLine(n);
  }

  private _onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    this._text = ta.value;
    this._error = null;
    this._updateDirty();
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
        <div class="mirror" aria-hidden="true"></div>
        <textarea
          spellcheck="false"
          .value=${this._text}
          @input=${this._onInput}
          @keydown=${this._onKeyDown}
        ></textarea>
        ${renderScrollJumpFabs(this._scrollJump)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "md-editor": MdEditor;
  }
}
