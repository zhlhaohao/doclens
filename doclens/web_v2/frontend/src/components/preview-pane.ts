import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./md-viewer";
import "./md-editor";
import "./toc-drawer";
import { savePreview, PreviewSaveError, uploadPreview, PreviewUploadError, isImageFile } from "../api/preview";
import type { PageMarker, PstAttachmentInfo } from "../api/preview";
import { isPstEmailPath, isPstFilePath } from "../api/pst";
import { extractHeadings, type TocItem } from "../utils/toc";
import type { MdEditor } from "./md-editor";
import type { MdViewer } from "./md-viewer";
import {
  ScrollJumpController,
  scrollJumpFabStyles,
  renderScrollJumpFabs,
} from "../utils/scroll-jump";
import { readScrollLine, writeScrollLine } from "../utils/scroll-memory";
import {
  jsbridgeDownloadAvailable,
  downloadFile,
  JsbridgeDownloadError,
} from "../utils/jsbridge";
import { actions } from "../state/store";
import { router } from "../router/router";
import {
  FONT_SCALE_MIN_PCT,
  FONT_SCALE_MAX_PCT,
  FONT_SCALE_STEP_PCT,
  readFontScalePct,
  writeFontScalePct,
  fontScaleFromPct,
} from "../utils/font-scale";

@customElement("preview-pane")
export class PreviewPane extends LitElement {
  static styles = [
    scrollJumpFabStyles,
    css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-card-bg);
      overflow: hidden;
      /* toc-drawer 浮层（absolute inset 0）的定位基准 */
      position: relative;
    }
    /* 移动端全宽预览：内嵌 md-viewer 去掉自身留白与灰底，
       白纸贴屏幕边缘（白纸 padding 控制内容边距）；
       纯文本 .body / 附件区同理收零水平 padding */
    :host([mobile]) md-viewer {
      padding: 0;
      background: transparent;
    }
    :host([mobile]) .body {
      padding-left: var(--cortex-space-3);
      padding-right: var(--cortex-space-3);
    }
    :host([mobile]) .attachments {
      padding-left: var(--cortex-space-3);
      padding-right: var(--cortex-space-3);
    }
    .header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .header .path {
      flex: 1;
      min-width: 0;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .body {
      flex: 1;
      overflow: auto;
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre-wrap;      /* 长行自动折回，不横向滚动 */
      overflow-wrap: anywhere;
    }
    /* 行号悬挂缩进：折行的续行对齐到正文列，不压行号列 */
    .body .line {
      padding-left: 48px;
      text-indent: -48px;
    }
    .body .line-no {
      color: var(--cortex-text-subtle);
      display: inline-block;
      width: 40px;
    }
    /* 搜索命中行高亮 —— SaaS Boutique primary-based（替代旧 amber） */
    .highlight {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    .html-frame {
      flex: 1;
      border: none;
      border-radius: 0;
      width: 100%;
      background: #fff;
      min-height: 0;
    }
    /* PST 邮件附件下载区（markdown 预览底部） */
    .attachments {
      flex-shrink: 0;
      max-height: 30%;
      overflow: auto;
      border-top: 1px solid var(--cortex-border-muted);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-1);
    }
    .attachments-title {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-weight: 500;
      padding: var(--cortex-space-1) 0;
    }
    .attachment {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-primary);
      text-decoration: none;
      padding: var(--cortex-space-1) var(--cortex-space-2);
      border-radius: var(--cortex-radius-md);
      transition: background 0.12s;
      min-width: 0;
    }
    .attachment:hover {
      background: var(--cortex-primary-soft);
    }
    .attachment .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .attachment .size {
      flex-shrink: 0;
      margin-left: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .attachment.disabled {
      color: var(--cortex-text-muted);
      cursor: default;
    }
    .attachment.disabled:hover {
      background: transparent;
    }
    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
    }
    /* 下载中：屏幕中心遮罩（与 files-view 上传遮罩同款视觉）；fixed 覆盖整个视口 */
    .download-overlay {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: var(--cortex-space-4);
      background: color-mix(in srgb, var(--cortex-bg) 72%, transparent);
      backdrop-filter: blur(2px);
      z-index: 9999;
    }
    .download-overlay .ring {
      width: 40px; height: 40px;
      border: 4px solid var(--cortex-border);
      border-top-color: var(--cortex-primary);
      border-radius: 50%;
      animation: cortex-download-spin 0.8s linear infinite;
    }
    .download-overlay .label {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
    @keyframes cortex-download-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .download-overlay .ring { animation: none; }
    }
    /* 次级动作按钮：hairline + radius-sm + muted；hover surface-muted + text */
    button.download-btn,
    button.upload-btn,
    button.highlight-btn,
    button.toc-btn,
    button.edit-btn,
    button.back-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    /* icon + hover 文字（参照 file-list 工具栏）：默认只显图标，hover 时
       文字以 tooltip 浮现于按钮左下方（上方被 app-bar 遮挡），
       不撑宽按钮、无布局抖动 */
    .header button {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
    }
    .header button doclens-icon {
      font-size: 14px;
    }
    .header button .btn-label {
      display: none;
    }
    .header button:hover:not(:disabled) .btn-label {
      display: block;
      position: absolute;
      top: calc(100% + 5px);
      right: 0;
      white-space: nowrap;
      background: var(--cortex-text);
      color: var(--cortex-surface);
      font-size: var(--cortex-fs-xs);
      line-height: 1.4;
      padding: 2px 10px;
      border-radius: var(--cortex-radius-pill);
      z-index: 20;
      pointer-events: none;
    }
    button.download-btn:hover,
    button.upload-btn:hover,
    button.highlight-btn:hover,
    button.toc-btn:hover,
    button.edit-btn:hover,
    button.back-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border-color: var(--cortex-text-subtle);
    }
    /* 高亮输入条/目录抽屉展开中的激活态 */
    button.highlight-btn.active,
    button.toc-btn.active {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    /* 关键词高亮输入条（header / mobile-header 下方展开） */
    .highlight-bar {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      flex-shrink: 0;
    }
    .highlight-bar input {
      flex: 1;
      min-width: 0;
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      background: var(--cortex-card-bg);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      outline: none;
      transition: border-color 0.15s;
    }
    .highlight-bar input:focus {
      border-color: var(--cortex-primary);
    }
    .highlight-bar .highlight-clear {
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      padding: var(--cortex-space-1);
      border-radius: 50%;
      font-size: var(--cortex-fs-base);
      transition: background 0.15s, color 0.15s;
    }
    .highlight-bar .highlight-clear:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    button.back-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    .mobile-header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      flex-shrink: 0;
      position: relative;
    }
    /* 圆形返回 / 更多 / 高亮 / 目录按钮 —— 同 focus-header */
    .mobile-header .mobile-back,
    .mobile-header .mobile-highlight,
    .mobile-header .mobile-toc,
    .mobile-header .mobile-more {
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      touch-action: manipulation;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .mobile-header .mobile-back:hover,
    .mobile-header .mobile-highlight:hover,
    .mobile-header .mobile-toc:hover,
    .mobile-header .mobile-more:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    /* 高亮输入条/目录抽屉展开中的激活态（移动端圆形按钮） */
    .mobile-header .mobile-highlight.active,
    .mobile-header .mobile-toc.active {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .mobile-header .mobile-filename {
      flex: 1;
      min-width: 0;
      text-align: center;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mobile-header .mobile-menu {
      position: absolute;
      top: 100%;
      right: var(--cortex-space-2);
      min-width: 140px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-shadow-lg);
      z-index: 10;
      padding: var(--cortex-space-1) 0;
    }
    .mobile-header .mobile-menu button {
      /* flex 行布局：icon 与文字间以 gap 留出间距（原为 block 内联，两者紧贴） */
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      color: var(--cortex-text);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      cursor: pointer;
      transition: background 0.15s;
    }
    .mobile-header .mobile-menu button:hover {
      background: var(--cortex-surface-muted);
    }
    /* 字号 stepper 行：与 menu button 同高的行内组合，按钮圆形单色。
       选择器须带 .mobile-header 前缀——与 .mobile-header .mobile-menu button
       的 (0,2,1) 同优先级且定义在后，才能覆盖其 display:block / width:100% /
       padding，保住按钮的 inline-flex 垂直居中。 */
    .mobile-header .mobile-menu .font-scale-row {
      display: flex;
      align-items: center;
      /* −/%/+ 三件套紧凑成组：gap 用 space-1（space-2 视觉上太散） */
      gap: var(--cortex-space-1);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      margin-bottom: var(--cortex-space-1);
    }
    .mobile-header .mobile-menu .font-scale-label {
      flex: 1;
      /* 小屏窄菜单下不被压缩换行（"字号"两字竖排）；nowrap 让绝对定位的
         menu 按 max-content 撑宽，而非把 label 挤成两行 */
      flex-shrink: 0;
      white-space: nowrap;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
    }
    .mobile-header .mobile-menu .font-scale-btn {
      flex-shrink: 0;
      width: 26px;
      height: 26px;
      padding: 0;
      border: 1px solid var(--cortex-border);
      border-radius: 50%;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 13px;
      line-height: 1;
      touch-action: manipulation;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .mobile-header .mobile-menu .font-scale-btn:hover:not(:disabled) {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .mobile-header .mobile-menu .font-scale-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .mobile-header .mobile-menu .font-scale-value {
      /* 最小宽度刚好容纳 3 位百分比（"200%"），避免与两侧按钮产生过大空隙 */
      min-width: 34px;
      text-align: center;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
  `,
  ];

  @property() path = "";
  @property() language = "text";
  @property() content = "";
  @property({ attribute: false }) highlights: number[] = [];
  @property({ type: Boolean }) loading = false;
  @property({ type: Number }) line: number | null = null;
  @property() keyword = "";
  @property({ type: Boolean }) writable = false;
  @property({ type: Boolean }) noHeader = false;
  /** 移动端启用顶部 bar（返回 / 文件名 / more 下拉）。与 noHeader 互不冲突：
   *  移动端显示自己的 mobile-header，常规 .header 由 noHeader 控制。 */
  @property({ type: Boolean }) mobile = false;
  @property({ attribute: false }) pages: PageMarker[] | null = null;
  /** PST 派生邮件预览的附件清单（null = 非邮件预览或无元数据）。 */
  @property({ attribute: false }) attachments: PstAttachmentInfo[] | null = null;
  /** 桌面 header 显示返回按钮（如 PST 邮件预览 → 返回邮件列表）。 */
  @property({ type: Boolean }) showBack = false;
  @property() backLabel = "返回";
  /** files-view 启用「重新解析」入口（仅图像文件预览）；search/chat 不传 → 不显示。 */
  @property({ type: Boolean }) enableReparse = false;
  /** files-view 开启「记住上次滚动位置」（localStorage，按 path 记忆源行号锚点）；
   *  search/chat 不传 → 不影响其 line 命中定位。 */
  @property({ type: Boolean }) rememberScroll = false;

  @state() private _mode: "preview" | "edit" = "preview";
  @state() private _content = "";
  @state() private _showMobileMenu = false;
  /** 下载进行中（App 内 jsbridge 通道）——屏幕中心遮罩动画 */
  @state() private _downloading = false;
  /** markdown 正文字号缩放（百分比档位，60–200 步长 10）；持久化 localStorage。 */
  @state() private _fontScalePct = readFontScalePct();
  /** 关键词高亮输入条（仅 markdown 预览分支可用） */
  @state() private _showHighlightBar = false;
  @state() private _highlightInput = "";
  private _highlightDebounce: number | undefined;

  /** 目录抽屉（md/docx/pdf 的 markdown 预览分支）：heading 目录 + 快速跳转 */
  @state() private _showToc = false;
  @state() private _tocItems: TocItem[] = [];
  /** 打开抽屉时的阅读位置（源行号），用于高亮当前章节 */
  @state() private _tocCurrentLine = 1;

  /** 模式切换的位置锚点（源行号）：预览↔编辑共用同一种锚点货币。 */
  private _anchorLine = 1;
  /** 切回预览时抑制 md-viewer 的命中行定位（避免与锚点恢复打架） */
  private _suppressLocate = false;
  /** 外部新文档到达（content prop 变化）→ 跳过一次锚点恢复 */
  private _skipRestoreOnce = false;

  /** 悬浮跳转按钮（纯文本预览分支；markdown 分支由 md-viewer 自治） */
  private _scrollJump = new ScrollJumpController(this, { behavior: "smooth" });

  /** 滚动位置记忆：当前挂监听器的 md-viewer（随分支生灭，需重复挂/摘） */
  private _scrollBoundViewer: MdViewer | null = null;
  private _scrollSaveTimer: number | undefined;
  /** 待落盘写入所属的 path（滚动发生时的旧 path，flush 时 this.path 可能已切走） */
  private _pendingScrollPath = "";

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("path")) {
      // 换文档：清空高亮输入并收起输入条，不残留旧文档的高亮
      this._highlightInput = "";
      this._showHighlightBar = false;
      this._clearHighlightDebounce();
      // 目录抽屉同样不跨文档残留
      this._showToc = false;
      // 切文件：旧文档滚动位置立即落盘（不等 debounce 到期）
      this._flushScrollMemory();
    }
    if (changed.has("content")) {
      this._content = this.content;
      this._tocItems = extractHeadings(this._content);
      this._showToc = false;
      this._mode = "preview";
      // 新文档：锚点失效，不做位置恢复，命中行定位照常
      this._skipRestoreOnce = true;
      this._suppressLocate = false;
      this._anchorLine = 1;
    }
  }

  async updated(changed: Map<string, unknown>) {
    super.updated?.(changed);
    // 纯文本分支的滚动容器 .body 只在该分支存在：在则绑定，不在则解绑
    const body = this.shadowRoot!.querySelector(".body") as HTMLElement | null;
    if (body) this._scrollJump.attach(body);
    else this._scrollJump.detach();

    // 滚动位置记忆：md-viewer 只在 markdown 预览分支存在，跟随分支挂/摘
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    if (this.rememberScroll && viewer && this._mode === "preview") {
      if (this._scrollBoundViewer !== viewer) {
        this._detachScrollMemory(); // 先摘旧的（含 flush）
        viewer.addEventListener("scroll", this._onViewerScroll, { passive: true });
        this._scrollBoundViewer = viewer;
      }
    } else if (this._scrollBoundViewer) {
      this._detachScrollMemory();
    }

    // 位置恢复：独立分支（打开新文件时 _mode 不变，下面的 _mode 分支不执行）。
    // files-view 从不传 .line → 无需 _suppressLocate；行号锚点是尽力而为语义。
    if (this.rememberScroll && changed.has("path")) {
      const saved = readScrollLine(this.path);
      if (saved !== null && saved > 1 && this.language === "markdown" && viewer) {
        const pathAtRestore = this.path;
        await viewer.updateComplete;
        if (this.path !== pathAtRestore) return; // 快速连点：放弃过期恢复
        viewer.scrollToSourceLine(saved, "auto"); // 瞬跳，与锚点恢复一致
      }
    }

    if (!changed.has("_mode")) return;
    if (this._mode === "edit") {
      // 预览 → 编辑：把锚点行恢复为编辑器视口顶部（瞬跳）
      const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
      if (editor) {
        await editor.updateComplete;
        editor.scrollToLine(this._anchorLine);
      }
      return;
    }
    // 编辑 → 预览
    if (this._skipRestoreOnce) {
      this._skipRestoreOnce = false;
      return;
    }
    if (viewer) {
      await viewer.updateComplete;
      viewer.scrollToSourceLine(this._anchorLine, "auto");
    }
    this._suppressLocate = false;
  }

  connectedCallback() {
    super.connectedCallback();
    // 点击 outside 关闭 more 下拉
    document.addEventListener("click", this._onDocClick, true);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick, true);
    this._clearHighlightDebounce();
    this._detachScrollMemory();
    super.disconnectedCallback();
  }

  // ------------------------------------------------------------ 滚动位置记忆

  private _onViewerScroll = () => {
    this._pendingScrollPath = this.path;
    window.clearTimeout(this._scrollSaveTimer);
    this._scrollSaveTimer = window.setTimeout(() => this._flushScrollMemory(), 300);
  };

  /** 把待落盘的滚动位置写入 localStorage（幂等；line<=1 时由 writeScrollLine 删条目）。 */
  private _flushScrollMemory() {
    window.clearTimeout(this._scrollSaveTimer);
    this._scrollSaveTimer = undefined;
    const viewer = this._scrollBoundViewer;
    const path = this._pendingScrollPath;
    this._pendingScrollPath = "";
    if (!viewer || !path) return;
    writeScrollLine(path, viewer.topSourceLine());
  }

  /** 摘除 scroll 监听并 flush 未落盘的写入（幂等）。 */
  private _detachScrollMemory() {
    if (this._scrollBoundViewer) {
      this._scrollBoundViewer.removeEventListener("scroll", this._onViewerScroll);
    }
    this._flushScrollMemory();
    this._scrollBoundViewer = null;
  }

  /** 移动端返回按钮。父组件监听 @back 自行决定如何导航。 */
  private _onMobileBackClick = () => {
    this.dispatchEvent(new CustomEvent("back", {
      bubbles: true,
      composed: true,
    }));
  };

  private _onMobileMoreClick = (e: Event) => {
    e.stopPropagation();
    this._showMobileMenu = !this._showMobileMenu;
  };

  /** 字号 stepper（mobile-menu 内一行）：− 当前% +，连点不关菜单，边界 disabled。 */
  private _renderFontScaleStepper() {
    const atMin = this._fontScalePct <= FONT_SCALE_MIN_PCT;
    const atMax = this._fontScalePct >= FONT_SCALE_MAX_PCT;
    return html`
      <div class="font-scale-row" role="group" aria-label="正文字号">
        <span class="font-scale-label">字号</span>
        <button
          class="font-scale-btn"
          type="button"
          aria-label="缩小字号"
          ?disabled=${atMin}
          @click=${() => this._bumpFontScale(-FONT_SCALE_STEP_PCT)}
        ><doclens-icon name="minus"></doclens-icon></button>
        <span class="font-scale-value">${this._fontScalePct}%</span>
        <button
          class="font-scale-btn"
          type="button"
          aria-label="放大字号"
          ?disabled=${atMax}
          @click=${() => this._bumpFontScale(FONT_SCALE_STEP_PCT)}
        ><doclens-icon name="plus"></doclens-icon></button>
      </div>
    `;
  }

  private _bumpFontScale(delta: number) {
    const next = Math.min(
      FONT_SCALE_MAX_PCT,
      Math.max(FONT_SCALE_MIN_PCT, this._fontScalePct + delta),
    );
    if (next === this._fontScalePct) return;
    this._fontScalePct = next;
    writeFontScalePct(next);
  }

  private _onDocClick = (e: MouseEvent) => {
    if (!this._showMobileMenu) return;
    const path = e.composedPath();
    // 仅在点击 menu 自身或 more 按钮时不关闭；其它位置（含组件 shadow 内
    // 的 preview 内容）一律关闭。原先 path.includes(this) 太宽，导致点
    // preview 内容时不关闭。
    const menu = this.shadowRoot?.querySelector(".mobile-menu");
    const more = this.shadowRoot?.querySelector(".mobile-more");
    if (menu && path.includes(menu)) return;
    if (more && path.includes(more)) return;
    this._showMobileMenu = false;
  };

  private _basename(p: string): string {
    if (!p) return "";
    const i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(i + 1) : p;
  }

  /** PST 路径（物理 .pst 或派生邮件 xxx.pst#entry）：原始文件下载/上传无意义。 */
  private get _isPst(): boolean {
    return isPstEmailPath(this.path) || isPstFilePath(this.path);
  }

  private _renderMobileHeader() {
    return html`
      <div class="mobile-header">
        <button
          class="mobile-back"
          type="button"
          aria-label="返回"
          @click=${this._onMobileBackClick}
        ><doclens-icon name="arrow-left"></doclens-icon></button>
        <span class="mobile-filename" title=${this.path}>${this._basename(this.path)}</span>
        ${this._tocAvailable
          ? html`<button
              class="mobile-toc ${this._showToc ? "active" : ""}"
              type="button"
              aria-label="目录"
              @click=${this._onTocToggle}
            ><doclens-icon name="list-tree"></doclens-icon></button>`
          : null}
        ${this.language === "markdown" && this._mode === "preview"
          ? html`<button
              class="mobile-highlight ${this._showHighlightBar ? "active" : ""}"
              type="button"
              aria-label="关键词高亮"
              @click=${this._onHighlightToggle}
            ><doclens-icon name="highlighter"></doclens-icon></button>`
          : null}
        <button
          class="mobile-more"
          type="button"
          aria-label="更多操作"
          @click=${this._onMobileMoreClick}
        ><doclens-icon name="more-horizontal"></doclens-icon></button>
        ${this._showMobileMenu
          ? html`
              <div class="mobile-menu" role="menu">
                ${this.language === "markdown" && this._mode === "preview"
                  ? this._renderFontScaleStepper()
                  : null}
                ${this.writable
                  ? html`<button
                      type="button"
                      role="menuitem"
                      @click=${() => { this._showMobileMenu = false; this.enterEdit(); }}
                    ><doclens-icon name="pencil"></doclens-icon>编辑</button>`
                  : null}
                ${this._isPst
                  ? null
                  : html`<button
                      type="button"
                      role="menuitem"
                      ?disabled=${this._downloading}
                      @click=${() => { this._showMobileMenu = false; this._onDownloadClick(); }}
                >${this._downloading ? "下载中…" : html`<doclens-icon name="download"></doclens-icon>下载`}</button>
                <button
                  type="button"
                  role="menuitem"
                  @click=${() => { this._showMobileMenu = false; this._onUploadClick(); }}
                ><doclens-icon name="upload"></doclens-icon>上传</button>
                ${this.enableReparse && isImageFile(this.path)
                  ? html`<button
                      type="button"
                      role="menuitem"
                      @click=${() => { this._showMobileMenu = false; this._onReparseClick(); }}
                    ><doclens-icon name="refresh-cw"></doclens-icon>重新解析</button>`
                  : null}`}
              </div>
            `
          : null}
      </div>
    `;
  }

  enterEdit() {
    // 捕获预览视口顶部的源行号作为锚点（块级精度）
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    if (viewer) this._anchorLine = viewer.topSourceLine();
    this._mode = "edit";
  }

  /** 退出编辑前捕获编辑器视口顶部的源行号（编辑后新文本的行号），
   *  并抑制切回预览时 md-viewer 的命中行定位（避免与锚点恢复打架）。 */
  private _captureEditorAnchor() {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    if (editor) this._anchorLine = editor.topLine();
    this._suppressLocate = true;
  }

  private _onEditorCancel = () => {
    this._captureEditorAnchor();
    this._mode = "preview";
  };

  private _onEditorDirty = (e: CustomEvent<{ dirty: boolean }>) => {
    this.dispatchEvent(
      new CustomEvent("dirty-change", { detail: { dirty: e.detail.dirty } }),
    );
  };

  private async _onEditorSave(e: CustomEvent<{ content: string }>) {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    this._captureEditorAnchor();
    try {
      await savePreview(this.path, e.detail.content);
      this._content = e.detail.content;
      this._tocItems = extractHeadings(this._content);
      this._mode = "preview";
      this.dispatchEvent(
        new CustomEvent("saved", { detail: { content: e.detail.content } }),
      );
    } catch (err) {
      const msg =
        err instanceof PreviewSaveError
          ? `${err.code} ${err.message}`
          : (err as Error).message ?? "保存失败";
      editor?.setError(msg);
      this.dispatchEvent(
        new CustomEvent("save-failed", { detail: { message: msg } }),
      );
    }
  }

  /** 公共方法：父组件（search-view）在用户确认"丢弃修改"后调用。 */
  discard() {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    editor?.discard();
    this._mode = "preview";
  }

  /** 触发原始文件下载；文件名由后端 Content-Disposition 决定。 */
  private _onDownloadClick = () => {
    if (!this.path || this._downloading) return;
    const url = `/api/preview/download?path=${encodeURIComponent(this.path)}`;
    // NexBox WebView 内 <a> 下载不可靠（无下载 UI/路径不可见）→ jsbridge 原生通道
    if (jsbridgeDownloadAvailable()) {
      void this._downloadViaJsbridge(url);
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    // 文件名由后端 Content-Disposition 提供，这里不设 download 属性
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /** App 内下载：原生 GET → 流式写 Downloads 目录 + 系统通知（契约见 download_bridge.md） */
  private async _downloadViaJsbridge(url: string) {
    if (this._downloading) return;
    this._downloading = true;
    try {
      const res = await downloadFile({ downloadUrl: `${window.location.origin}${url}` });
      this.dispatchEvent(
        new CustomEvent("download-success", { detail: { name: res.name } }),
      );
    } catch (e) {
      if (e instanceof JsbridgeDownloadError && e.unauthorized) {
        // 与 client.ts 401 钩子行为对齐：跳登录页
        actions.setAuthState({ authenticated: false });
        router.navigate("login");
        return;
      }
      const msg = e instanceof Error ? e.message : "下载失败";
      this.dispatchEvent(new CustomEvent("download-failed", { detail: { message: msg } }));
    } finally {
      this._downloading = false;
    }
  }

  private _renderDownloadBtn() {
    if (this._isPst) return null;
    return html`<button class="download-btn" ?disabled=${this._downloading} @click=${this._onDownloadClick}>${this._downloading ? html`<span class="btn-label">下载中</span>` : html`<doclens-icon name="download"></doclens-icon><span class="btn-label">下载</span>`}</button>`;
  }

  /** 触发「重新解析」：冒泡 reparse 事件给父组件（files-view 挂 reparse-dialog）。 */
  private _onReparseClick = () => {
    if (!this.path) return;
    this.dispatchEvent(new CustomEvent("reparse", {
      detail: { path: this.path },
      bubbles: true,
      composed: true,
    }));
  };

  /** 图像文件 + enableReparse 时显示「重新解析」按钮（复用 download-btn 样式）。 */
  private _renderReparseBtn() {
    if (!this.enableReparse || this._isPst || !isImageFile(this.path)) return null;
    return html`<button class="download-btn" @click=${this._onReparseClick}><doclens-icon name="refresh-cw"></doclens-icon><span class="btn-label">重新解析</span></button>`;
  }

  /** 桌面 header 返回按钮（复用 mobile back 事件，父组件统一监听 @back）。 */
  private _renderBackBtn() {
    if (!this.showBack) return null;
    return html`<button class="back-btn" @click=${this._onMobileBackClick}><doclens-icon name="arrow-left"></doclens-icon><span class="btn-label">${this.backLabel}</span></button>`;
  }

  private _onUploadClick = () => {
    const input = this.shadowRoot?.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    input?.click();
  };

  private async _onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    // 重置 value 允许下次再选同一文件
    input.value = "";
    if (!file) return;
    const ok = window.confirm(`即将上传 '${file.name}' 覆盖原文件，是否继续？`);
    if (!ok) return;
    try {
      const res = await uploadPreview(file);
      this.dispatchEvent(
        new CustomEvent("upload-success", { detail: { path: res.path } }),
      );
    } catch (err) {
      const msg =
        err instanceof PreviewUploadError
          ? `${err.code} ${err.message}`
          : (err as Error).message ?? "上传失败";
      this.dispatchEvent(
        new CustomEvent("upload-failed", { detail: { message: msg } }),
      );
    }
  }

  private _renderUploadBtn() {
    if (this._isPst) return null;
    return html`<button class="upload-btn" @click=${this._onUploadClick}><doclens-icon name="upload"></doclens-icon><span class="btn-label">上传</span></button>`;
  }

  // ------------------------------------------------------------------
  // 关键词高亮（仅 markdown 预览分支）：输入整词（空格分隔多个）→
  // 透传 md-viewer keyword 高亮全部命中，并自动滚动到第一个命中。
  // ------------------------------------------------------------------

  /** 桌面 header 的高亮按钮（图标 + hover 文字）。 */
  private _renderHighlightBtn() {
    return html`<button
      class="highlight-btn ${this._showHighlightBar ? "active" : ""}"
      @click=${this._onHighlightToggle}
    ><doclens-icon name="highlighter"></doclens-icon><span class="btn-label">高亮</span></button>`;
  }

  /** 高亮输入条（桌面 header 下方 / 移动端 mobile-header 下方共用）。 */
  private _renderHighlightBar() {
    if (!this._showHighlightBar) return null;
    return html`
      <div class="highlight-bar">
        <doclens-icon name="highlighter"></doclens-icon>
        <input
          type="text"
          placeholder="输入关键字高亮，空格分隔多个…"
          .value=${this._highlightInput}
          @input=${this._onHighlightInput}
          @keydown=${this._onHighlightKeydown}
        />
        <button
          class="highlight-clear"
          aria-label="清除并关闭"
          @click=${this._onHighlightClear}
        ><doclens-icon name="x"></doclens-icon></button>
      </div>
    `;
  }

  private _onHighlightToggle = async () => {
    this._showHighlightBar = !this._showHighlightBar;
    if (this._showHighlightBar) {
      await this.updateComplete;
      const input = this.shadowRoot?.querySelector(
        ".highlight-bar input",
      ) as HTMLInputElement | null;
      input?.focus();
    }
  };

  private _onHighlightInput = (e: Event) => {
    this._highlightInput = (e.target as HTMLInputElement).value;
    // 输入停顿 300ms 后自动跳到第一个命中（Enter 立即跳）
    this._clearHighlightDebounce();
    if (!this._highlightInput.trim()) return;
    this._highlightDebounce = window.setTimeout(() => {
      this._highlightDebounce = undefined;
      void this._jumpToFirstHit();
    }, 300);
  };

  private _onHighlightKeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      this._clearHighlightDebounce();
      void this._jumpToFirstHit();
    } else if (e.key === "Escape") {
      this._onHighlightClear();
    }
  };

  private _onHighlightClear = () => {
    this._clearHighlightDebounce();
    this._highlightInput = "";
    this._showHighlightBar = false;
  };

  private _clearHighlightDebounce() {
    if (this._highlightDebounce !== undefined) {
      window.clearTimeout(this._highlightDebounce);
      this._highlightDebounce = undefined;
    }
  }

  /** 等 md-viewer 重渲染并完成关键词高亮后，滚动到第一个命中。 */
  private async _jumpToFirstHit() {
    await this.updateComplete;
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    if (!viewer) return;
    await viewer.updateComplete;
    viewer.scrollToFirstKeywordHit();
  }

  // ------------------------------------------------------------------
  // 目录抽屉（md/docx/pdf 的 markdown 预览分支）：header 按钮 →
  // toc-drawer 浮层列出 heading 扁平缩进列表 → 点击平滑滚动跳转并关闭。
  // ------------------------------------------------------------------

  /** 目录抽屉支持的预览类型：md / docx / pdf
   * （pptx/xlsx/邮件/图像解读的 md 不提供——2026-08-21 决议）。 */
  private get _tocSupported(): boolean {
    return /\.(md|markdown|docx|pdf)$/i.test(this.path);
  }

  /** 目录按钮显隐：markdown 预览模式 + 支持的文档类型 + 文档含 heading。 */
  private get _tocAvailable(): boolean {
    return (
      this.language === "markdown" &&
      this._mode === "preview" &&
      this._tocSupported &&
      this._tocItems.length > 0
    );
  }

  /** 桌面 header 的目录按钮（图标 + hover 文字，同 highlight-btn）。 */
  private _renderTocBtn() {
    if (!this._tocAvailable) return null;
    return html`<button
      class="toc-btn ${this._showToc ? "active" : ""}"
      @click=${this._onTocToggle}
    ><doclens-icon name="list-tree"></doclens-icon><span class="btn-label">目录</span></button>`;
  }

  private _onTocToggle = () => {
    if (!this._showToc) {
      // 打开前捕获阅读位置，抽屉据此高亮当前章节
      const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
      this._tocCurrentLine = viewer?.topSourceLine() ?? 1;
    }
    this._showToc = !this._showToc;
  };

  private _onTocClose = () => {
    this._showToc = false;
  };

  /** 点击目录节点：关闭抽屉 + 平滑滚动到标题位置并闪烁定位。 */
  private _onTocJump = (e: CustomEvent<{ line: number }>) => {
    this._showToc = false;
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    viewer?.jumpToSourceLine(e.detail.line, "smooth");
  };

  private _renderTocDrawer() {
    if (!this._showToc) return null;
    return html`<toc-drawer
      .items=${this._tocItems}
      .currentLine=${this._tocCurrentLine}
      @jump=${this._onTocJump}
      @close=${this._onTocClose}
    ></toc-drawer>`;
  }

  private _formatSize(size: number): string {
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.round(size / 1024)} KB`;
    return `${size} B`;
  }

  /** PST 邮件附件下载区：stored 的可点击下载，未落盘的仅展示名称。 */
  private _renderAttachments() {
    if (!this.attachments || this.attachments.length === 0) return null;
    return html`
      <div class="attachments">
        <div class="attachments-title">附件（${this.attachments.length}）</div>
        ${this.attachments.map((a) =>
          a.stored && a.download_url
            ? html`<a
                class="attachment"
                href=${a.download_url}
                title=${a.name}
              ><doclens-icon name="download"></doclens-icon>
                <span class="name">${a.name}</span>
                <span class="size">${this._formatSize(a.size)}</span>
              </a>`
            : html`<span class="attachment disabled" title=${a.name}>
                <span class="name">${a.name}</span>
                <span class="size">${this._formatSize(a.size)} · 未落盘</span>
              </span>`,
        )}
      </div>
    `;
  }

  render() {
    if (this.loading) return html`<div class="empty">加载中...</div>`;
    if (!this._content && !this.content)
      return html`<div class="empty">点击左侧结果查看预览</div>`;

    // 移动端用自己的顶部 bar，常规 .header 不再渲染（避免双 bar）
    const renderMobileBar = this.mobile ? this._renderMobileHeader() : null;
    const showDesktopHeader = !this.mobile && !this.noHeader;

    if (this.language === "markdown" && this._mode === "edit") {
      return html`
        <input type="file" hidden @change=${this._onFileChange}>
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
            ${this._renderReparseBtn()}
          </div>
        ` : null}
        <md-editor
          .path=${this.path}
          .originalContent=${this._content}
          ?mobile=${this.mobile}
          @save=${this._onEditorSave}
          @cancel=${this._onEditorCancel}
          @dirty-change=${this._onEditorDirty}
        ></md-editor>
        ${this._renderDownloadOverlay()}
      `;
    }

    if (this.language === "markdown") {
      return html`
        <input type="file" hidden @change=${this._onFileChange}>
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this.writable
              ? html`<button class="edit-btn" @click=${() => this.enterEdit()}><doclens-icon name="pencil"></doclens-icon><span class="btn-label">编辑</span></button>`
              : null}
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
            ${this._renderTocBtn()}
            ${this._renderHighlightBtn()}
            ${this._renderReparseBtn()}
          </div>
        ` : null}
        ${this._renderHighlightBar()}
        <md-viewer
          .content=${this._content}
          .line=${this.line}
          .keyword=${this._highlightInput || this.keyword}
          .pages=${this.pages}
          .docPath=${this.path}
          .fontScale=${fontScaleFromPct(this._fontScalePct)}
          ?suppressLocate=${this._suppressLocate}
        ></md-viewer>
        ${this._renderAttachments()}
        ${this._renderTocDrawer()}
        ${this._renderDownloadOverlay()}
      `;
    }

    // HTML：iframe srcdoc 渲染原生网页（脚本隔离，不可编辑）
    if (this.language === "html") {
      return html`
        <input type="file" hidden @change=${this._onFileChange}>
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
            ${this._renderReparseBtn()}
          </div>
        ` : null}
        <iframe
          class="html-frame"
          srcdoc=${this._content}
          sandbox="allow-scripts"
          title="HTML 预览"
        ></iframe>
        ${this._renderDownloadOverlay()}
      `;
    }

    // 非 md：现有纯文本 + 行号视图
    const lines = this._content.split("\n");
    return html`
      <input type="file" hidden @change=${this._onFileChange}>
      ${renderMobileBar}
      ${showDesktopHeader ? html`
        <div class="header">
          ${this._renderBackBtn()}
          <span class="path">${this.path}</span>
          ${this._renderDownloadBtn()}
          ${this._renderUploadBtn()}
            ${this._renderReparseBtn()}
        </div>
      ` : null}
      <div class="body">
        ${lines.map((line, i) => {
          const lineNo = i + 1;
          const cls = this.highlights.includes(lineNo) ? "highlight" : "";
          return html`<div class="line ${cls}"><span class="line-no">${lineNo}</span>${line}</div>`;
        })}
        <div class="scroll-jump-anchor">${renderScrollJumpFabs(this._scrollJump)}</div>
      </div>
      ${this._renderDownloadOverlay()}
    `;
  }

  /** 下载中屏幕中心遮罩（与 files-view 上传遮罩同款视觉） */
  private _renderDownloadOverlay() {
    if (!this._downloading) return null;
    return html`<div class="download-overlay" role="status" aria-live="polite">
      <div class="ring"></div>
      <div class="label">下载中…</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "preview-pane": PreviewPane;
  }
}
