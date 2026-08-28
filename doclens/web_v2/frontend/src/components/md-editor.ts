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
      this._scaleCache = null;
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
    // parseFloat("") = NaN（部分引擎/jsdom 对未布局属性返回空串）：按 0 兜底
    const contentWidth =
      ta.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
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

  /** 行高比例校准：textarea 实际渲染总高 / 镜像 div 测量总高。
   *
   *  WebView 内核对 textarea（表单控件独立渲染路径）的行高做取整/规范化，
   *  与普通 div（保留小数行高）每行差零点几像素，随行数线性累积——
   *  千行文档 scrollToLine 会往后漂移几十行。桌面 Chromium 两者一致，
   *  比值恒为 1，行为不变。
   *
   *  实际总高取 ta.scrollHeight - 上下 padding（可滚动时 scrollHeight 即
   *  内容总高 + padding）；镜像总高用 ta.value 完整渲染（与 textarea
   *  逐字节一致，含尾换行产生的空行盒）。内容不足一屏时 scrollHeight
   *  = clientHeight 无参考意义（短文档行号锚点本就可达），返回 1。 */
  private _measureLineHeightScale(): number {
    const ta = this._textarea;
    const m = this._syncMirror();
    if (!ta || !m) return 1;
    if (ta.scrollHeight <= ta.clientHeight + 1) return 1;
    const cs = getComputedStyle(ta);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const actual = ta.scrollHeight - padY;
    if (!(actual > 0)) return 1;
    m.textContent = ta.value;
    const mirror = m.offsetHeight;
    m.textContent = "";
    if (!(mirror > 0)) return 1;
    const scale = actual / mirror;
    return Math.min(1.5, Math.max(0.5, scale));
  }

  /** 缓存的行高比例：scrollToLine/topLine 复用同一系数保持互逆——
   *  逐次重测的亚像素舍入抖动会让「滚到行 n」反查出 n-1。
   *  文本变化时失效（originalContent 更新 / 用户输入）。 */
  private _scaleCache: number | null = null;

  private _lineHeightScale(): number {
    if (this._scaleCache === null) {
      this._scaleCache = this._measureLineHeightScale();
    }
    return this._scaleCache;
  }

  /** 校准后的行前高度（整数像素）。scrollTop 只存整数：小数换算值赋给
   *  scrollTop 会被内核舍入，破坏 scrollToLine/topLine 的相等性互逆
   *  （滚到行 n 反查出 n-1），两处统一在此取整。 */
  private _scaledHeightBeforeLine(n: number): number {
    return Math.round(this._heightBeforeLine(n) * this._lineHeightScale());
  }

  /** 视口顶部所在的源行号（1-indexed）。折行下行高不固定，用二分反查。
   *  与 scrollToLine 共用 _scaledHeightBeforeLine（同系数同取整，保持互逆）。
   *  供 preview-pane 在编辑→预览切换时捕获位置锚点。 */
  topLine(): number {
    const ta = this._textarea;
    if (!ta) return 1;
    const st = ta.scrollTop;
    let lo = 1;
    let hi = this._lines.length;
    // 找最大 n 使 heightBeforeLine(n) <= scrollTop，即顶部落在第 n 行
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._scaledHeightBeforeLine(mid) <= st) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** 滚动使源行 n（1-indexed）贴顶（瞬跳）。
   *  与 topLine 共用 _scaledHeightBeforeLine（同系数同取整，保持互逆）。
   *  供 preview-pane 在预览→编辑切换时恢复位置锚点。 */
  scrollToLine(n: number) {
    const ta = this._textarea;
    if (!ta) return;
    ta.scrollTop = this._scaledHeightBeforeLine(n);
  }

  /** 选中源文本字符偏移区间（与 md-viewer.selectionSourceOffsets 同一
   *  坐标系，字符级精度——修复行级映射的「选区放大」：预览选一个词切到
   *  编辑器不再变成整块几十行）。
   *  focus 使选区高亮可见（部分 WebView 失焦不渲染选区）；随后恢复
   *  scrollTop，避免 focus 把 caret 滚进视口破坏视野锚点。
   *  reveal=true（WebView 中央字锚点）时不恢复 scrollTop——保留 focus
   *  的原生 reveal-selection，把选区滚进视口（浏览器自己的坐标计算，
   *  免疫镜像行高测量的累积偏差；与先行的 scrollToLine 近似定位配合：
   *  偏差小于一屏不动，漂出视野则拉回）。 */
  selectOffsets(start: number, end: number, reveal = false) {
    const ta = this._textarea;
    if (!ta) return;
    const s = Math.max(0, Math.min(start, end));
    const e = Math.min(this._text.length, Math.max(start, end));
    ta.setSelectionRange(s, e);
    const st = ta.scrollTop;
    ta.focus();
    if (!reveal) ta.scrollTop = st;
  }

  /** 当前选区偏移（selectionStart/End 原值）；无选区返回 null。
   *  供 preview-pane 在编辑→预览切换时捕获选区锚点。 */
  selectionOffsets(): { start: number; end: number } | null {
    const ta = this._textarea;
    if (!ta || ta.selectionStart === ta.selectionEnd) return null;
    return { start: ta.selectionStart, end: ta.selectionEnd };
  }

  /** 视口是否已滚到底部。供 preview-pane 的「底部锚点」语义：
   *  目标行下方内容不足一屏时贴顶物理上不可能，改为对齐文档尾部视野。
   *  无需滚动（内容不足一屏）时不算贴底——行号锚点本来就可达。 */
  isAtBottom(): boolean {
    const ta = this._textarea;
    if (!ta) return false;
    if (ta.scrollHeight <= ta.clientHeight) return false;
    return ta.scrollTop + ta.clientHeight >= ta.scrollHeight - 8;
  }

  /** 滚到底部（瞬跳）。配合 isAtBottom 实现预览↔编辑的底部锚点互通。 */
  scrollToBottom() {
    const ta = this._textarea;
    if (!ta) return;
    ta.scrollTop = ta.scrollHeight - ta.clientHeight;
  }

  private _onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    this._text = ta.value;
    this._error = null;
    this._scaleCache = null;
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
