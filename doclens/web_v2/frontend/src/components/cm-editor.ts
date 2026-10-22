import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./icon";
import { langLoaderFor } from "../utils/cm-langs";
import {
  codeSurfaceLight,
  codeSurfaceDark,
} from "../utils/code-palette";
import {
  readCodeTheme,
  onCodeThemeChange,
  type CodeTheme,
} from "../utils/code-theme";
import { readAppTheme, onAppThemeChange, type AppTheme } from "../utils/app-theme";

/**
 * <cm-editor> — CodeMirror 6 编辑器（ADR-0046 编辑器内核）。
 *
 * 对外契约与被取代的 `<md-editor>` **完全一致**：
 * - 事件：`dirty-change {dirty}` / `save {content}` / `cancel {}`
 * - 公共方法：`topLine` / `scrollToLine` / `selectionOffsets` / `selectOffsets`
 *   / `isAtBottom` / `scrollToBottom` / `discard` / `setError`
 * 宿主视图（preview-pane）不感知内核，只认这套契约。
 *
 * 与 md-editor 的关键差异：
 * - 内核自带视口虚拟化（只渲染可见行）→ 大文件不卡；
 * - 语法高亮在**前端本地**（Lezer），后端不送 token 流（那条链路只服务
 *   预览态行号视图，ADR-0032）；
 * - 脏状态是 `docChanged` 布尔标志，不是逐字符全串比较；
 * - 布局/滚动由内核管，不再需要镜像 div 行高测量那套补偿。
 *
 * **CM6 核心是懒加载的**（`utils/cm-core.ts` 动态 import）：编辑是可选
 * 功能，只读会话不该为此付首屏代价。组件先渲染工具条（保存/取消/格式化
 * 按钮），内核到位后再挂载编辑器。
 *
 * 组件本身**不调任何 API**（保存由父组件处理）、**不弹确认框**。
 */
@customElement("cm-editor")
export class CmEditor extends LitElement {
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
      display: flex;
      align-items: center;
      gap: var(--cortex-space-1);
    }
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
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    button:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }
    button.save-btn {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.save-btn:hover {
      opacity: 0.9;
      background: var(--cortex-btn-primary-bg);
    }
    button.save-btn:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }
    /* markdown 格式化工具条：toolbar 下方一行 icon 按钮 */
    .fmt-bar {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
      overflow-x: auto;
    }
    .fmt-btn {
      border: none;
      background: transparent;
      padding: var(--cortex-space-1);
      border-radius: var(--cortex-radius-sm);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .fmt-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    .fmt-sep {
      width: 1px;
      height: 16px;
      background: var(--cortex-border-muted);
      margin: 0 var(--cortex-space-1);
      flex-shrink: 0;
    }
    .body {
      flex: 1;
      min-height: 0;
      position: relative;
      overflow: hidden;
    }
    /* CM6 挂载点：内核自行管理尺寸与滚动 */
    .cm-host {
      position: absolute;
      inset: 0;
    }
    .cm-host .cm-editor {
      height: 100%;
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    .cm-host .cm-editor.cm-focused {
      outline: none;
    }
    .cm-host .cm-scroller {
      font-family: var(--cortex-font-mono);
      line-height: 1.7;
    }
    .cm-host .cm-gutters {
      background: var(--cortex-surface);
      color: var(--cortex-text-subtle);
      border-right: 1px solid var(--cortex-border-muted);
    }
    .cm-host .cm-activeLine,
    .cm-host .cm-activeLineGutter {
      background: color-mix(in srgb, var(--cortex-primary) 6%, transparent);
    }
    .cm-host .cm-selectionBackground,
    .cm-host .cm-content ::selection {
      background: color-mix(in srgb, var(--cortex-primary) 18%, transparent);
    }
    .cm-host .cm-cursor {
      border-left-color: var(--cortex-text);
    }
    .cm-host .cm-placeholder {
      color: var(--cortex-text-subtle);
    }
    /* 内核懒加载中：占位（避免工具条下方出现空白无反馈） */
    .loading {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
    }
  `;

  /** 文件路径（工具条展示；移动端隐藏）。 */
  @property() path = "";

  /** 原始内容：变化即重置编辑器内容与脏状态。 */
  @property({ attribute: false }) originalContent = "";

  /** 移动端：隐藏工具条里的文件名（外层 bar 已显示）。 */
  @property({ type: Boolean }) mobile = false;

  /** 是否 Markdown（决定是否渲染格式化工具条）。 */
  @property({ type: Boolean }) markdown = false;

  @state() private _dirty = false;
  @state() private _error: string | null = null;
  /** 内核是否已就绪（懒加载完成）。 */
  @state() private _ready = false;

  /** CM6 视图实例（懒加载完成后才有）。 */
  private _view: import("@codemirror/view").EditorView | null = null;
  /** CM6 核心模块（动态 import 的结果）。 */
  private _core: typeof import("../utils/cm-core") | null = null;
  /** 语言扩展的隔间：语言包懒加载完成后用 reconfigure 注入。 */
  private _langCompartment: import("@codemirror/state").Compartment | null = null;
  private _themeCompartment: import("@codemirror/state").Compartment | null = null;
  /** 原始内容快照：脏状态判定基准（CM6 只给 docChanged 布尔，不给内容）。 */
  private _original = "";
  private _codeTheme: CodeTheme = readCodeTheme();
  private _appTheme: AppTheme = readAppTheme();
  private _offAppThemeChange: (() => void) | null = null;
  private _offCodeThemeChange: (() => void) | null = null;
  /** 挂载内核时的内容同步锁（避免自身写回触发脏状态）。 */
  private _updating = false;
  /** 内核加载失败的提示（展示给用户，不静默失败）。 */
  private _loadError: string | null = null;

  /** 挂载后加载 CM6 核心（懒加载）。 */
  async firstUpdated() {
    this._original = this.originalContent;
    this._offAppThemeChange = onAppThemeChange((t) => {
      this._appTheme = t;
      this._applyTheme();
    });
    this._offCodeThemeChange = onCodeThemeChange((t) => {
      this._codeTheme = t;
      this._applyTheme();
    });
    await this._loadCore();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._offAppThemeChange?.();
    this._offAppThemeChange = null;
    this._offCodeThemeChange?.();
    this._offCodeThemeChange = null;
    this._view?.destroy?.();
    this._view = null;
  }

  /** 动态 import CM6 核心并挂载编辑器。 */
  private async _loadCore() {
    try {
      const core = await import("../utils/cm-core");
      this._core = core;
      this._langCompartment = new core.Compartment();
      this._themeCompartment = new core.Compartment();
      const host = this.shadowRoot!.querySelector(".cm-host");
      if (!host) return;
      this._view = new core.EditorView({
        state: core.EditorState.create({
          doc: this.originalContent,
          extensions: core.buildBaseExtensions({
            onDocChanged: () => this._onDocChanged(),
            onSave: () => this._emitSave(),
            langCompartment: this._langCompartment,
            themeCompartment: this._themeCompartment,
          }),
        }),
        parent: host as HTMLElement,
      });
      this._ready = true;
      await this.updateComplete;
      this._loadLang();
      this._applyTheme();
    } catch (e) {
      console.error("[cm-editor] 编辑器内核加载失败", e);
      this._loadError = "编辑器加载失败，请刷新重试";
      this._error = this._loadError;
    }
  }

  /** originalContent 变化 → 重置内容与脏状态（与 md-editor 同语义）。 */
  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("originalContent")) {
      this._original = this.originalContent;
      this._dirty = false;
      this._error = null;
      const view = this._view;
      if (view && view.state.doc.toString() !== this.originalContent) {
        this._updating = true;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: this.originalContent },
        });
        this._updating = false;
      }
    }
  }

  /** 懒加载语言包；加载完成用 reconfigure 注入（不重建编辑器）。 */
  private async _loadLang() {
    const view = this._view;
    if (!view) return;
    const loader = langLoaderFor(this.path || "");
    if (!loader) return;
    try {
      const result = await loader();
      const view = this._view;
      const comp = this._langCompartment;
      if (!view || !comp || !this._core) return;
      const ext = this._core.toExtension(result);
      view.dispatch({
        effects: comp.reconfigure([ext, this._highlightExt()]),
      });
    } catch (e) {
      // 语言包加载失败 → 退回无高亮纯文本（不阻断编辑）
      console.warn("[cm-editor] 语言包加载失败", e);
    }
  }

  /** 依据代码主题三态算出深浅。 */
  private get _codeDark(): boolean {
    // markdown 编辑态跟随应用主题，**不**消费「代码配色」（ADR-0043 作用范围：
    // 代码主题只管行号视图；md 文档的代码块/编辑态一律跟随应用主题）。
    // 否则行号视图里点过「深色」后，md 编辑器被永久锁成深底——而 md 预览
    // header 没有配色按钮（那只在行号视图出现），用户没有任何入口改回。
    if (this.markdown) return this._appTheme === "dark";
    if (this._codeTheme === "dark") return true;
    if (this._codeTheme === "light") return false;
    return this._appTheme === "dark";
  }

  /** 高亮扩展（委托给懒加载的核心模块）。 */
  private _highlightExt() {
    if (!this._core) return [];
    return [this._core.buildHighlightExt(this._codeDark)];
  }

  /** 应用主题（代码主题三态）→ 背景/前景 + 高亮样式。 */
  private _applyTheme() {
    const view = this._view;
    if (!view || !this._core) return;
    const dark = this._codeDark;
    // markdown：表面恒用 token 版（codeSurfaceLight 的 canvas/ink 是
    // var(--cortex-bg)/var(--cortex-text)）——应用主题切到深夜时 token 自己
    // 变深，天然跟随；行号视图才用 codeSurfaceDark 那套硬编码 GitHub dark。
    const surface = dark && !this.markdown ? codeSurfaceDark : codeSurfaceLight;
    view.dom.style.background = surface.canvas;
    view.dom.style.color = surface.ink;
    const comp = this._themeCompartment;
    if (!comp) return;
    view.dispatch({
      effects: comp.reconfigure(this._highlightExt()),
    });
  }

  /** 文档变化 → 脏状态（比较内容快照，不用逐字符 diff）。 */
  private _onDocChanged() {
    if (this._updating) return;
    const view = this._view;
    if (!view) return;
    const next = view.state.doc.toString() !== this._original;
    if (next !== this._dirty) {
      this._dirty = next;
      this.dispatchEvent(
        new CustomEvent("dirty-change", { detail: { dirty: next } }),
      );
    }
    if (this._error) this._error = null;
  }

  // ------------------------------------------------------------------
  // 公共方法（契约同 md-editor）
  // ------------------------------------------------------------------

  /**
   * 等待内核就绪（懒加载）。
   *
   * 宿主（preview-pane）在切到编辑态后需要**等内核挂载**才能恢复位置锚点
   * 与选区——核心是动态 import，那一刻视图还不存在。宿主调此方法等待，
   * 避免锚点静默丢失。
   */
  async whenReady(): Promise<void> {
    for (let i = 0; i < 200 && !this._view; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  /** 视口顶部所在的源行号（1-indexed）。 */
  topLine(): number {
    const view = this._view;
    if (!view) return 1;
    return view.state.doc.lineAt(view.viewport.from).number;
  }

  /** 滚动使源行 n（1-indexed）贴顶。 */
  scrollToLine(n: number) {
    const view = this._view;
    if (!view || !this._core) return;
    const line = view.state.doc.line(Math.max(1, Math.min(n, view.state.doc.lines)));
    view.dispatch({
      selection: this._core.EditorSelection.cursor(line.from),
      effects: this._core.EditorView.scrollIntoView(line.from, { y: "start" }),
    });
  }

  /** 当前选区偏移（无选区返回 null）。 */
  selectionOffsets(): { start: number; end: number } | null {
    const view = this._view;
    if (!view) return null;
    const sel = view.state.selection.main;
    if (sel.empty) return null;
    return { start: sel.from, end: sel.to };
  }

  /** 选中源文本字符偏移区间。 */
  selectOffsets(start: number, end: number) {
    const view = this._view;
    if (!view || !this._core) return;
    const len = view.state.doc.length;
    const s = Math.max(0, Math.min(start, end, len));
    const e = Math.max(0, Math.min(Math.max(start, end), len));
    view.dispatch({ selection: this._core.EditorSelection.range(s, e) });
    view.focus();
  }

  /**
   * 视口是否已滚到底部。
   *
   * 语义与被取代的 md-editor 一致：**内容不足一屏时不算贴底**——此时行号
   * 锚点本来就可达，判成贴底会让预览侧改用「对齐尾部视野」语义，把短文档
   * 拉到奇怪的位置。
   *
   * CM6 的 viewport 是「可见行区间」而非像素，故按行数判：视口末行之后
   * 还有可见行就不算贴底。
   */
  isAtBottom(): boolean {
    const view = this._view;
    if (!view) return false;
    const { viewport } = view;
    const total = view.state.doc.lines;
    // 全文只有这些行 → 一屏装得下 → 不算贴底
    if (viewport.to - viewport.from + 1 >= total) return false;
    return viewport.to >= total;
  }

  /** 滚到底部。 */
  scrollToBottom() {
    const view = this._view;
    if (!view || !this._core) return;
    view.dispatch({
      effects: this._core.EditorView.scrollIntoView(view.state.doc.length, { y: "end" }),
    });
  }

  /** 强制重置为 originalContent，并 emit cancel。 */
  discard() {
    const view = this._view;
    if (view) {
      this._updating = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: this._original },
      });
      this._updating = false;
    }
    this._dirty = false;
    this._error = null;
    this.dispatchEvent(new CustomEvent("cancel", {}));
  }

  /** 设置错误信息（父组件在保存失败时调用）。 */
  setError(msg: string) {
    this._error = msg;
  }

  // ------------------------------------------------------------------
  // Markdown 格式化操作（fmt-bar）
  // ------------------------------------------------------------------

  /**
   * 应用编辑：把 [from, to) 区间替换为 text，并把选区落到 [selStart, selEnd)。
   *
   * 区间语义（而非「替换当前选区」）是刻意的：格式化操作改的是**整行**，
   * 而用户的选区可能只是行内几个字。若以选区为替换范围，替换文本就得是
   * 整个文档——既低效又会把选区外的行重复一遍。
   */
  private _applyEdit(
    from: number,
    to: number,
    text: string,
    selStart: number,
    selEnd: number,
  ) {
    const view = this._view;
    if (!view || !this._core) return;
    view.dispatch({
      changes: { from, to, insert: text },
      selection: this._core.EditorSelection.range(selStart, selEnd),
    });
    view.focus();
  }

  /** 当前选区覆盖的行的起止偏移。 */
  private _selectedLineRange(): { lineStart: number; lineEnd: number } {
    const view = this._view!;
    const sel = view.state.selection.main;
    const doc = view.state.doc;
    const lineStart = doc.lineAt(sel.from).from;
    const lineEnd = doc.lineAt(sel.to).to;
    return { lineStart, lineEnd };
  }

  /** 行级前缀操作（引用）：对选区覆盖的每一行加/删前缀。 */
  private _linePrefixAction(prefix: string) {
    const view = this._view;
    if (!view) return;
    const { lineStart, lineEnd } = this._selectedLineRange();
    const text = view.state.doc.sliceString(lineStart, lineEnd);
    const lines = text.split("\n");
    const allHave = lines.every((l) => l.startsWith(prefix));
    const next = lines
      .map((l) => (allHave ? l.slice(prefix.length) : prefix + l))
      .join("\n");
    this._applyEdit(lineStart, lineEnd, next, lineStart, lineStart + next.length);
  }

  /** 标题：循环升级 H1→H2→…→H6→无标题。 */
  private _toggleHeading() {
    const view = this._view;
    if (!view) return;
    const { lineStart, lineEnd } = this._selectedLineRange();
    const text = view.state.doc.sliceString(lineStart, lineEnd);
    const lines = text.split("\n");
    const first = lines[0].match(/^(#{1,6})\s+/);
    const cur = first ? first[1].length : 0;
    const nextLevel = cur >= 6 ? 0 : cur + 1;
    const strip = (l: string) => l.replace(/^#{1,6}\s+/, "");
    const next = lines
      .map((l) =>
        nextLevel === 0
          ? strip(l)
          : "#".repeat(nextLevel) + " " + strip(l),
      )
      .join("\n");
    this._applyEdit(lineStart, lineEnd, next, lineStart, lineStart + next.length);
  }

  /** 行内包裹（粗体/斜体/行内代码/链接）：已包裹则解包。 */
  private _wrapAction(
    before: string,
    after: string,
    placeholder: string,
  ) {
    const view = this._view;
    if (!view) return;
    const sel = view.state.selection.main;
    const value = view.state.doc.toString();
    const s = sel.from;
    const e = sel.to;
    const body = value.slice(s, e);
    if (
      body &&
      body.startsWith(before) &&
      body.endsWith(after) &&
      body.length >= before.length + after.length
    ) {
      const inner = body.slice(before.length, body.length - after.length);
      this._applyEdit(s, e, inner, s, s + inner.length);
      return;
    }
    const text = body || placeholder;
    const next = before + text + after;
    this._applyEdit(
      s,
      e,
      next,
      s + before.length,
      s + before.length + text.length,
    );
  }

  /** 块插入（围栏/表格/分割线）：插入完整块，前后补空行隔离。 */
  private _blockInsert(block: string, caretOffsetInBlock: number) {
    const view = this._view;
    if (!view) return;
    const sel = view.state.selection.main;
    const value = view.state.doc.toString();
    const lineStart = view.state.doc.lineAt(sel.from).from;
    const before = value.slice(0, lineStart);
    const after = value.slice(lineStart);
    const needsLead = before !== "" && !before.endsWith("\n\n");
    const lead = needsLead ? "\n" : "";
    const needsTrail = after !== "" && !after.startsWith("\n");
    const trail = needsTrail ? "\n" : "";
    const insertAt = before.length + lead.length;
    this._applyEdit(
      lineStart,
      lineStart,
      lead + block + trail,
      insertAt + caretOffsetInBlock,
      insertAt + caretOffsetInBlock,
    );
  }

  /** 列表动作：行首加 mark + 新增一行 + 光标切到新行行首。 */
  private _listAction(markOf: (n: number) => string) {
    const view = this._view;
    if (!view) return;
    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.from);
    const lineStart = line.from;
    const lineEnd = line.to;
    const firstMark = markOf(1);
    const stem = firstMark.replace(/^(\d+\.)/, "\\d+\\.").replace("[ ] ", "");
    const hasMark = new RegExp(`^${stem}`).test(line.text);
    const marked = hasMark ? line.text : firstMark + line.text;
    // 替换当前行 → 标记行 + 换行（行尾之后的其余内容原样保留）
    const caret = lineStart + marked.length + 1;
    this._applyEdit(lineStart, lineEnd, marked + "\n", caret, caret);
  }

  /** 有序列表自动续号：光标行之前的同级序号 + 1。 */
  private _nextOrderedNumber(): number {
    const view = this._view;
    if (!view) return 1;
    const sel = view.state.selection.main;
    const lineStart = view.state.doc.lineAt(sel.from).from;
    const before = view.state.doc.sliceString(0, lineStart);
    const nums = [...before.matchAll(/(?:^|\n)(\d+)\. /g)].map((m) =>
      parseInt(m[1], 10),
    );
    return nums.length ? nums[nums.length - 1] + 1 : 1;
  }

  private _onHeading = () => this._toggleHeading();
  private _onBold = () => this._wrapAction("**", "**", "粗体文本");
  private _onItalic = () => this._wrapAction("*", "*", "斜体");
  private _onInlineCode = () => this._wrapAction("`", "`", "代码");
  private _onCodeFence = () => this._blockInsert("```\n\n```", 4);
  private _onBulletList = () => this._listAction(() => "- ");
  private _onOrderedList = () =>
    this._listAction((n) => `${this._nextOrderedNumber() + n - 1}. `);
  private _onTaskList = () => this._listAction(() => "- [ ] ");
  private _onQuote = () => this._linePrefixAction("> ");
  private _onHr = () => this._blockInsert("---\n", 0);
  private _onTable = () => {
    const cols = 3;
    const header =
      `| ${Array.from({ length: cols }, (_, i) => `列${i + 1}`).join(" | ")} |\n`;
    const sep = `| ${Array.from({ length: cols }, () => "---").join(" | ")} |\n`;
    const rows = Array.from(
      { length: 5 },
      () => `| ${Array.from({ length: cols }, () => "").join(" | ")} |\n`,
    ).join("");
    this._blockInsert(header + sep + rows, header.length + sep.length + 2);
  };
  private _onLink = () => this._wrapAction("[", "](https://)", "链接文字");

  private _onKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (this._dirty) this._emitSave();
    }
  }

  private _emitSave() {
    const view = this._view;
    if (!view) return;
    this.dispatchEvent(
      new CustomEvent("save", { detail: { content: view.state.doc.toString() } }),
    );
  }

  private _onSaveClick = () => {
    if (this._dirty) this._emitSave();
  };

  private _onCancelClick = () => {
    this.discard();
  };

  render() {
    return html`
      <div class="toolbar">
        ${this.mobile
          ? nothing
          : html`<span class="path">${this.path}</span>`}
        ${this._error
          ? html`<span class="error-msg"><doclens-icon name="alert-triangle"></doclens-icon> ${this._error}</span>`
          : this._dirty
          ? html`<span class="dirty">●未保存</span>`
          : nothing}
        <button class="save-btn" ?disabled=${!this._dirty} @click=${this._onSaveClick}>
          <doclens-icon name="save"></doclens-icon>保存
        </button>
        <button class="cancel-btn" @click=${this._onCancelClick}><doclens-icon name="x"></doclens-icon>取消</button>
      </div>
      ${this.markdown
        ? html`
            <div class="fmt-bar" role="toolbar" aria-label="Markdown 格式化">
              <button class="fmt-btn" type="button" title="标题（循环 H1–H6，再按移除）" @click=${this._onHeading}><doclens-icon name="heading"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="粗体" @click=${this._onBold}><doclens-icon name="bold"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="斜体" @click=${this._onItalic}><doclens-icon name="italic"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="代码围栏" @click=${this._onCodeFence}><doclens-icon name="code"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="行内代码" @click=${this._onInlineCode}><doclens-icon name="code"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="无序列表" @click=${this._onBulletList}><doclens-icon name="list"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="有序列表" @click=${this._onOrderedList}><doclens-icon name="list-ordered"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="任务清单" @click=${this._onTaskList}><doclens-icon name="list-checks"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="引用块" @click=${this._onQuote}><doclens-icon name="quote"></doclens-icon></button>
              <span class="fmt-sep" aria-hidden="true"></span>
              <button class="fmt-btn" type="button" title="超链接" @click=${this._onLink}><doclens-icon name="link"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="表格" @click=${this._onTable}><doclens-icon name="table"></doclens-icon></button>
              <button class="fmt-btn" type="button" title="分割线" @click=${this._onHr}><doclens-icon name="minus"></doclens-icon></button>
            </div>
          `
        : nothing}
      <div class="body" @keydown=${this._onKeyDown}>
        <div class="cm-host"></div>
        ${this._ready
          ? nothing
          : html`<div class="loading">${this._loadError ?? "加载编辑器…"}</div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cm-editor": CmEditor;
  }
}
