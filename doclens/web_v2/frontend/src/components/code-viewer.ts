import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  ScrollJumpController,
  scrollJumpFabStyles,
  renderScrollJumpFabs,
} from "../utils/scroll-jump";
import {
  readCodeTheme,
  type CodeTheme,
} from "../utils/code-theme";
import {
  readAppTheme,
  onAppThemeChange,
  type AppTheme,
} from "../utils/app-theme";
import {
  codeSurfaceLight,
  codeSurfaceDark,
  codeTokensLight,
  codeTokensDark,
} from "../utils/code-palette";
import {
  CODE_FONT_SCALE_DEFAULT_PCT,
} from "../utils/code-font-scale";

/**
 * <code-viewer> —— 行号视图（纯文本 + 行号 + 可选服务端分词着色）。
 *
 * 从 preview-pane 迁出的第四渲染分支（2026-10-19 P1-1 拆分）：代码文件、
 * txt、未知后缀、超限兜底文本共用（按渲染路径划定，不按文件类型设闸）。
 * 自治能力：
 * - 服务端语法分词着色（ADR-0032）：tokens 与 content 行数失配时整体放弃
 *   高亮（防御异常 lexer）；
 * - 行选择（2026-10-05 决议）：行号点击 toggle、Shift+click 区间（IDE 惯例），
 *   升序合并为区间串（"12-40,88-120"）经 selection-change 事件上抛；
 * - 跳顶/跳底 FAB（ScrollJumpController）；
 * - 代码主题三态（ADR-0036/0043）与字号档位（60–200 步长 10）。
 *
 * 对外接口：
 * - properties: content / tokens / highlights / fontScalePct / theme
 * - events: selection-change { ranges: string }（选区变化；空串 = 清空）
 * - 方法: clearSelection()（发送后消费）、lineRanges()（当前区间串）
 */
@customElement("code-viewer")
export class CodeViewer extends LitElement {
  static styles = [
    scrollJumpFabStyles,
    css`
    :host {
      display: block;
      flex: 1;
      min-height: 0;
    }
    /* 行号视图双表面 token（utils/code-palette.ts；ADR-0043 三态代码主题） */
    .body {
      --code-tok-c: ${unsafeCSS(codeTokensLight.c)};
      --code-tok-k: ${unsafeCSS(codeTokensLight.k)};
      --code-tok-s: ${unsafeCSS(codeTokensLight.s)};
      --code-tok-n: ${unsafeCSS(codeTokensLight.n)};
      --code-tok-f: ${unsafeCSS(codeTokensLight.f)};
      --code-tok-t: ${unsafeCSS(codeTokensLight.t)};
      --code-tok-o: ${unsafeCSS(codeTokensLight.o)};
      --code-tok-p: ${unsafeCSS(codeTokensLight.p)};
      --code-surface-canvas: ${unsafeCSS(codeSurfaceLight.canvas)};
      --code-surface-ink: ${unsafeCSS(codeSurfaceLight.ink)};
      --code-surface-line-no: ${unsafeCSS(codeSurfaceLight.lineNo)};
      --code-surface-line-no-hover: ${unsafeCSS(codeSurfaceLight.lineNoHover)};
      --code-surface-selected-bg: ${unsafeCSS(codeSurfaceLight.selectedBg)};
      --code-surface-selected-bar: ${unsafeCSS(codeSurfaceLight.selectedBar)};
      --code-surface-hit-bg: ${unsafeCSS(codeSurfaceLight.hitBg)};
      --code-surface-hit-ink: ${unsafeCSS(codeSurfaceLight.hitInk)};
      --code-surface-clear-bg: ${unsafeCSS(codeSurfaceLight.clearBtnBg)};
      --code-surface-clear-ink: ${unsafeCSS(codeSurfaceLight.clearBtnInk)};
    }
    .body.dark {
      --code-tok-c: ${unsafeCSS(codeTokensDark.c)};
      --code-tok-k: ${unsafeCSS(codeTokensDark.k)};
      --code-tok-s: ${unsafeCSS(codeTokensDark.s)};
      --code-tok-n: ${unsafeCSS(codeTokensDark.n)};
      --code-tok-f: ${unsafeCSS(codeTokensDark.f)};
      --code-tok-t: ${unsafeCSS(codeTokensDark.t)};
      --code-tok-o: ${unsafeCSS(codeTokensDark.o)};
      --code-tok-p: ${unsafeCSS(codeTokensDark.p)};
      --code-surface-canvas: ${unsafeCSS(codeSurfaceDark.canvas)};
      --code-surface-ink: ${unsafeCSS(codeSurfaceDark.ink)};
      --code-surface-line-no: ${unsafeCSS(codeSurfaceDark.lineNo)};
      --code-surface-line-no-hover: ${unsafeCSS(codeSurfaceDark.lineNoHover)};
      --code-surface-selected-bg: ${unsafeCSS(codeSurfaceDark.selectedBg)};
      --code-surface-selected-bar: ${unsafeCSS(codeSurfaceDark.selectedBar)};
      --code-surface-hit-bg: ${unsafeCSS(codeSurfaceDark.hitBg)};
      --code-surface-hit-ink: ${unsafeCSS(codeSurfaceDark.hitInk)};
      --code-surface-clear-bg: ${unsafeCSS(codeSurfaceDark.clearBtnBg)};
      --code-surface-clear-ink: ${unsafeCSS(codeSurfaceDark.clearBtnInk)};
    }
    .body {
      --code-font-scale: 1;
      font-size: calc(var(--cortex-fs-sm) * var(--code-font-scale));
      font-family: var(--cortex-font-mono);
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre-wrap;      /* 长行自动折回，不横向滚动 */
      overflow-wrap: anywhere;
      box-sizing: border-box;
      padding: var(--cortex-space-4) var(--cortex-space-5);
      overflow-y: auto;
      height: 100%;
    }
    /* 行号悬挂缩进：折行的续行对齐到正文列，不压行号列。
       宽度用 em（相对本 .body 字号）——档位缩放后 40px 定宽会容不下
       行号数字且悬挂缩进错位；1em≈2.86 数字位 + 0.4em 间隙。 */
    .body .line {
      padding-left: 2.86em;
      text-indent: -2.86em;
    }
    .body .line-no {
      color: var(--cortex-text-subtle);
      display: inline-block;
      width: 2.4em;
      /* 悬挂缩进（.line 的 text-indent 负值）会继承进本 inline-block（块容器）
         使数字再左移落到滚动容器裁剪区外——行号「DOM 在而不可见」的
         根因。此处显式归零，行号回到 .line 左缘的悬挂位。 */
      text-indent: 0;
    }
    /* 行选择（2020-10-05 决议）：行号可点击（toggle 选中/反选）；选中行
       整行高亮。与搜索命中 .highlight（命中词着色）语义不同、视觉并存。 */
    .body .line-no.clickable {
      cursor: pointer;
      user-select: none;
    }
    .body .line-no.clickable:hover {
      color: var(--cortex-primary);
      text-decoration: underline;
    }
    .body .line.line-selected {
      background: color-mix(in srgb, var(--cortex-primary) 8%, transparent);
      box-shadow: inset 2px 0 0 var(--cortex-primary);
    }
    .line-clear-btn {
      position: sticky;
      bottom: var(--cortex-space-2);
      float: right;
      margin-top: var(--cortex-space-2);
      padding: 4px 12px;
      border: 1px solid var(--cortex-border);
      border-radius: 100px;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
    }
    .line-clear-btn:hover { color: var(--cortex-primary); border-color: var(--cortex-primary); }
    /* 搜索命中行高亮 —— SaaS Boutique primary-based（替代旧 amber） */
    .highlight {
      background: color-mix(in srgb, var(--cortex-primary) 15%, transparent);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    /* 服务端语法分词 8 类配色（ADR-0032）：未归类 run 不挂 class（正文色）。 */
    .tk-c { color: var(--code-tok-c); font-style: italic; }
    .tk-k { color: var(--code-tok-k); font-weight: 500; }
    .tk-s { color: var(--code-tok-s); }
    .tk-n { color: var(--code-tok-n); }
    .tk-f { color: var(--code-tok-f); }
    .tk-t { color: var(--code-tok-t); }
    .tk-o { color: var(--code-tok-o); }
    .tk-p { color: var(--code-tok-p); }
    /* 深色代码主题（ADR-0036，GitHub dark 基准）：仅行号视图整体换肤。 */
    .body.dark {
      background: var(--code-surface-canvas);
      color: var(--code-surface-ink);
      transition: background 0.15s, color 0.15s;
    }
    .body.dark .line-no {
      color: var(--code-surface-line-no);
    }
    .body.dark .line-no.clickable:hover {
      color: var(--code-surface-line-no-hover);
    }
    .body.dark .line.line-selected {
      background: var(--code-surface-selected-bg);
      box-shadow: inset 2px 0 0 var(--code-surface-selected-bar);
    }
    .body.dark .highlight {
      background: var(--code-surface-hit-bg);
      color: var(--code-surface-hit-ink);
    }
    .body.dark .line-clear-btn {
      background: var(--code-surface-clear-bg);
      color: var(--code-surface-clear-ink);
      border-color: var(--code-surface-clear-ink);
    }
    .body.dark .line-clear-btn:hover {
      color: var(--code-surface-line-no-hover);
      border-color: var(--code-surface-line-no-hover);
    }
    `,
  ];

  /** 预览正文（纯文本）。 */
  @property() content = "";
  /** 服务端分词（ADR-0032）：[[kind, text], ...] 逐行；null = 纯文本渲染。 */
  @property({ attribute: false }) tokens: string[][][] | null = null;
  /** 搜索命中行（行号着色 .highlight）。 */
  @property({ type: Array }) highlights: number[] = [];
  /** 字号档位百分比（受控：preview-pane header stepper 驱动）。 */
  @property({ type: Number }) fontScalePct = CODE_FONT_SCALE_DEFAULT_PCT;
  /** 代码主题三态（受控）：auto=跟随应用主题。 */
  @property({ attribute: false }) theme: CodeTheme = readCodeTheme();

  /** 行选择集合 + Shift 区间锚点（IDE 惯例；无锚点退化普通点击）。 */
  @state() private _selectedLines = new Set<number>();
  private _lineAnchor: number | null = null;

  /** 代码主题 auto 态的跟随源（应用主题）。 */
  @state() private _appTheme: AppTheme = readAppTheme();
  private _offAppThemeChange?: () => void;

  /** 跳顶/跳底 FAB（scroller = .body）。 */
  private _scrollJump = new ScrollJumpController(this, { behavior: "smooth" });

  connectedCallback() {
    super.connectedCallback();
    this._offAppThemeChange = onAppThemeChange((t) => { this._appTheme = t; });
  }

  disconnectedCallback() {
    this._offAppThemeChange?.();
    this._offAppThemeChange = undefined;
    super.disconnectedCallback();
  }

  protected firstUpdated() {
    const body = this.shadowRoot!.querySelector(".body") as HTMLElement | null;
    if (body) this._scrollJump.attach(body);
  }

  protected updated(changed: Map<string, unknown>) {
    super.updated?.(changed);
    // 换内容/path：选中行号已失效，清空选区（防 A 文件行号配 B 文件）
    if (changed.has("content")) {
      this._selectedLines = new Set();
      this._lineAnchor = null;
    }
  }

  /** 行号视图实际渲染表面：auto 解析为跟随当前应用主题。 */
  private get _dark(): boolean {
    if (this.theme === "dark") return true;
    if (this.theme === "light") return false;
    return this._appTheme === "dark";
  }

  /** 选中行集合 → 升序合并区间串（"12-40,88-120"）；空集返回 ""。 */
  lineRanges(): string {
    if (this._selectedLines.size === 0) return "";
    const sorted = [...this._selectedLines].sort((a, b) => a - b);
    const parts: string[] = [];
    let start = sorted[0], prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      const n = sorted[i];
      if (n !== prev + 1) {
        parts.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = n;
      }
      prev = n;
    }
    return parts.join(",");
  }

  /** 外部清空选区（发送后消费 / 宿主清理）。 */
  clearSelection() {
    if (this._selectedLines.size === 0 && this._lineAnchor === null) return;
    this._selectedLines = new Set();
    this._lineAnchor = null;
    this._emitSelection();
  }

  private _emitSelection() {
    this.dispatchEvent(new CustomEvent("selection-change", {
      detail: { ranges: this.lineRanges() },
      bubbles: true, composed: true,
    }));
  }

  private _onLineNoClick = (lineNo: number, shift: boolean) => {
    if (shift && this._lineAnchor !== null) {
      const next = new Set(this._selectedLines);
      const [a, b] = this._lineAnchor <= lineNo
        ? [this._lineAnchor, lineNo]
        : [lineNo, this._lineAnchor];
      for (let n = a; n <= b; n++) next.add(n);
      this._selectedLines = next;
      this._emitSelection();
      return; // 锚点不动：连续 Shift+click 可重设段尾
    }
    this._lineAnchor = lineNo;
    const next = new Set(this._selectedLines);
    if (next.has(lineNo)) next.delete(lineNo);
    else next.add(lineNo);
    this._selectedLines = next;
    this._emitSelection();
  };

  render() {
    const lines = this.content.split("\n");
    const tokLines = this.tokens;
    const tokensAligned = tokLines !== null && tokLines.length === lines.length;
    const dark = this._dark;
    return html`
      <div
        part="body"
        class="body ${dark ? "dark" : ""}"
        style=${`--code-font-scale: ${this.fontScalePct / 100}`}
      >
        ${lines.map((line, i) => {
          const lineNo = i + 1;
          const cls = this.highlights.includes(lineNo) ? "highlight" : "";
          const sel = this._selectedLines.has(lineNo);
          const runs = tokensAligned ? tokLines[i] : null;
          return html`<div class="line ${sel ? "line-selected" : ""}"><span
            class="line-no clickable ${cls}"
            title="点击选中/取消选中该行；Shift+点击选区间"
            @click=${(ev: MouseEvent) => this._onLineNoClick(lineNo, ev.shiftKey)}
          >${lineNo}</span>${runs
            ? runs.map(([kind, text]) => (kind ? html`<span class="tk-${kind}">${text}</span>` : text))
            : line}</div>`;
        })}
        ${this._selectedLines.size > 0
          ? html`<button
              class="line-clear-btn"
              type="button"
              @click=${() => this.clearSelection()}
            >清除选中（${this.lineRanges()}）</button>`
          : null}
        <div class="scroll-jump-anchor">${renderScrollJumpFabs(this._scrollJump)}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "code-viewer": CodeViewer;
  }
}
