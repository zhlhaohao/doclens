import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./md-viewer";
import "./md-editor";
import "./toc-drawer";
import "./pdf-viewer";
import "./skill-toolbox-dialog";
import "./skill-run-dialog";
import { savePreview, PreviewSaveError, isImageFile } from "../api/preview";
import type { PageMarker, PstAttachmentInfo } from "../api/preview";
import { isPstEmailPath, isPstFilePath } from "../api/pst";
import { fetchSkills, type SkillInfo } from "../api/skills";
import { recordSkillUse } from "../state/recent-skills";
import { extractHeadings, activeTocIndex, type TocItem } from "../utils/toc";
import type { MdEditor } from "./md-editor";
import type { MdViewer } from "./md-viewer";
import type { PdfViewer } from "./pdf-viewer";
import {
  ScrollJumpController,
  scrollJumpFabStyles,
  renderScrollJumpFabs,
} from "../utils/scroll-jump";
import { readScrollLine, writeScrollLine } from "../utils/scroll-memory";
import {
  addBookmark,
  bookmarksFor,
  removeBookmark,
  type ReadingBookmark,
} from "../utils/bookmarks";
import "./bookmark-drawer";
import "./download-overlay";
import { isWebviewContainer } from "../utils/jsbridge";
import { downloadServerFile } from "../utils/download";
import {
  FONT_SCALE_MIN_PCT,
  FONT_SCALE_MAX_PCT,
  FONT_SCALE_STEP_PCT,
  readFontScalePct,
  writeFontScalePct,
  fontScaleFromPct,
} from "../utils/font-scale";

/** CJK 字符（汉字 / 假名 / 谚文基础区）——用于高亮输入条的分词判定。 */
const CJK_RE = /[一-鿿぀-ヿ가-힯]/;

/** 高亮输入条手动输入的关键词归一化（2026-09-28 决议）：
 *  含 CJK → 去空格**整串匹配**（中文没有空格分词习惯——输入法确认词组
 *  敲出的空格不是语义分隔，「松平 广忠」的意图是整词「松平广忠」；
 *  按空格分词会把人名拆成「松平」「广忠」两支，落到「松平信定」这类
 *  单字命中上，找不到目标整词）；纯 ASCII → 原样返回（保留空格分词的
 *  英文多词语义，与 search 透传同口径——后端 tokenize_query 的
 *  queryWords 契约不受影响，那条链路不经过本函数）。 */
export function normalizeHighlightKeyword(input: string): string {
  return CJK_RE.test(input) ? input.replace(/\s+/g, "") : input;
}

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
    /* 行选择（2026-10-05 决议）：行号可点击（toggle 选中/反选）；选中行
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
      background: rgba(0, 100, 224, 0.08);
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
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    /* 服务端语法分词 8 类配色（ADR-0032；亮色 Meta 画布，克制不花哨）：
       c注释=stone 灰 / k关键字=ink 深蓝黑 / s字符串=森林绿 / n数字=赭棕 /
       f函数=靛蓝 / t类型=青蓝 / o操作符=steel / p标点=slate。未归类 run
       不挂 class（正文色 --cortex-text）。 */
    .tk-c { color: var(--cortex-text-subtle); font-style: italic; }
    .tk-k { color: #0a3d91; font-weight: 500; }
    .tk-s { color: #0a7d33; }
    .tk-n { color: #a05a1f; }
    .tk-f { color: #4b3fd4; }
    .tk-t { color: #0b7285; }
    .tk-o { color: var(--cortex-text-caption); }
    .tk-p { color: var(--cortex-text-muted); }
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
    /* 次级动作按钮：hairline + radius-sm + muted；hover surface-muted + text */
    button.download-btn,
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
    button.highlight-btn:hover,
    button.toc-btn:hover,
    button.edit-btn:hover,
    button.back-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border-color: var(--cortex-text-subtle);
    }
    /* PDF 缩放组（header 内 − 比例 + 三件套，pill 联排） */
    .zoom-group {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill);
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .zoom-group .zoom-btn,
    .zoom-group .zoom-label {
      border: none;
      background: transparent;
      cursor: pointer;
      font-family: inherit;
      color: var(--cortex-text-muted);
      transition: background 0.15s, color 0.15s;
    }
    .zoom-group .zoom-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 24px;
      font-size: 13px;
    }
    .zoom-group .zoom-label {
      min-width: 52px;
      height: 24px;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      border-left: 1px solid var(--cortex-border-muted);
      border-right: 1px solid var(--cortex-border-muted);
    }
    .zoom-group .zoom-btn:hover:not(:disabled),
    .zoom-group .zoom-label:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    .zoom-group .zoom-btn:disabled {
      opacity: 0.35;
      cursor: default;
    }
    /* 技能工具箱对话框（showModal：top layer 全屏居中——不被 PDF portal
       （document.body z-index 1）遮挡、不受预览栏 overflow 裁剪；
       样式对齐 files-view 的 dialog） */
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      box-sizing: border-box;
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 360px;
      max-width: 90vw;
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.4);
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
  /** 服务端语法分词（ADR-0032）：逐行 [[kind, text], ...] run 数组，与
   *  content 的 \n 切分一一对应；kind 8 类（c/k/s/n/f/t/o/p），空串=正文色。
   *  null = 后端未下发（md/pdf/html/txt/未知后缀/超限）→ 纯文本渲染。 */
  @property({ attribute: false }) tokens: string[][][] | null = null;
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
  /** PDF 原生预览（ADR-0031）：页表（后端 page_starts），命中行跳页依据。 */
  @property({ attribute: false }) pageStarts: number[] | null = null;
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

  /** PDF 缩放控件显示（「适宽」/百分比；pdf-viewer scalechanging 驱动）。 */
  @state() private _pdfZoomLabel = "适宽";

  /** 技能工具箱（预览文件 → AI 技能处理）：对话框态与数据源。 */
  @state() private _toolbox: "list" | "run" | null = null;
  @state() private _toolboxSkills: SkillInfo[] | null = null;
  @state() private _toolboxError: string | null = null;
  @state() private _pickedSkill: SkillInfo | null = null;

  /** 行选择（2026-10-05 决议）：行号视图点击行号 toggle 选中/反选；多选
   *  升序合并为区间（"12-40,88-120"），经工具箱链路以 path:区间 后缀进消息。
   *  生命周期：path 变化 / 发送后 / 手动清除钮 三处清空；滚动与开关
   *  工具箱对话框不清——选行是「读码时随手标记」的持久态。 */
  @state() private _selectedLines = new Set<number>();

  /** 选中行集合 → 升序合并区间串（"12-40,88-120"）；空集返回 ""。 */
  private get _lineRanges(): string {
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

  private _onLineNoClick = (lineNo: number) => {
    const next = new Set(this._selectedLines);
    if (next.has(lineNo)) next.delete(lineNo);
    else next.add(lineNo);
    this._selectedLines = next;
  };

  /** 工具箱消息拼装用的路径：有选中行时附 `:区间` 后缀（code-explain 定位
   *  协议原生消费；其他技能视为无害路径变体）。 */
  private get _pathWithRanges(): string {
    const ranges = this._lineRanges;
    return ranges ? `${this.path}:${ranges}` : this.path;
  }

  /** 目录抽屉（md/docx/pdf 的 markdown 预览分支）：heading 目录 + 快速跳转 */
  @state() private _showToc = false;
  @state() private _tocItems: TocItem[] = [];
  /** 打开抽屉时的阅读位置（源行号），用于高亮当前章节 */
  @state() private _tocCurrentLine = 1;

  /** 阅读书签抽屉（2026-10-01 决议）：显隐 + 当前文件书签列表 */
  @state() private _showBookmarks = false;
  @state() private _bookmarkItems: ReadingBookmark[] = [];

  /** 模式切换的位置锚点（源行号）：预览↔编辑共用同一种锚点货币。 */
  private _anchorLine = 1;
  /** 锚点语义为「贴底」：目标行在对方视口无法贴顶时（下方内容不足一屏），
   *  改为对齐文档尾部视野——否则行号锚点在文末附近必然漂移。 */
  private _anchorAtBottom = false;
  /** 模式切换的选区锚点（源文本字符偏移，字符级）：预览侧块内比例映射 ↔
   *  编辑器 selectionStart/End 精确落地。cancel/discard 回滚文本后不恢复
   *  （偏移已失配）；换文档清空。 */
  private _selOffsets: { start: number; end: number } | null = null;
  /** 切回预览时抑制 md-viewer 的命中行定位（避免与锚点恢复打架） */
  private _suppressLocate = false;
  /** 外部新文档到达（content prop 变化）→ 跳过一次锚点恢复 */
  private _skipRestoreOnce = false;

  /** 悬浮跳转按钮（纯文本预览分支；markdown 分支由 md-viewer 自治） */
  private _scrollJump = new ScrollJumpController(this, { behavior: "smooth" });

  /** 滚动位置记忆：当前挂监听器的预览组件（md-viewer / pdf-viewer，随分支生灭） */
  private _scrollBoundViewer: HTMLElement | null = null;
  /** 绑定时刻的锚点读取函数（md=行号 / pdf=页号）。 */
  private _scrollAnchorFn: (() => number) | null = null;
  private _scrollSaveTimer: number | undefined;
  /** 待落盘写入所属的 path（滚动发生时的旧 path，flush 时 this.path 可能已切走） */
  private _pendingScrollPath = "";

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("path")) {
      // 换文档：清空高亮输入并收起输入条，不残留旧文档的高亮
      this._highlightInput = "";
      this._showHighlightBar = false;
      this._clearHighlightDebounce();
      // 目录抽屉同样不跨文档残留（pdf 的 content 恒空串，content 变化
      // 分支不触发，须在 path 变化时清书签条目）
      this._showToc = false;
      this._tocItems = [];
      // 书签抽屉同样不跨文档残留；列表换 path 重读
      this._showBookmarks = false;
      this._bookmarkItems = bookmarksFor(this.path);
      // 行选择不跨文档残留（防 A 文件行号配 B 文件）
      this._selectedLines = new Set();
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
      this._anchorAtBottom = false;
      this._selOffsets = null;
      // 新内容行集合已变，选中行号随之失效
      this._selectedLines = new Set();
    }
  }

  async updated(changed: Map<string, unknown>) {
    super.updated?.(changed);
    // 工具箱对话框以 showModal 打开（top layer，防 PDF portal 遮挡、
    // 不受预览栏裁剪）；list↔run 切换时 dialog 节点重建，需重新 showModal
    if (changed.has("_toolbox") && this._toolbox) {
      const dlg = this.shadowRoot!.querySelector("dialog") as HTMLDialogElement | null;
      if (dlg && !dlg.open) dlg.showModal();
    }
    // 纯文本分支的滚动容器 .body 只在该分支存在：在则绑定，不在则解绑
    const body = this.shadowRoot!.querySelector(".body") as HTMLElement | null;
    if (body) this._scrollJump.attach(body);
    else this._scrollJump.detach();

    // 滚动位置记忆：md-viewer（markdown 分支）/ pdf-viewer（pdf 分支，
    // ADR-0031——内部容器 re-dispatch scroll）跟随分支挂/摘
    const viewer = this._activePreviewViewer();
    if (this.rememberScroll && viewer && this._mode === "preview") {
      if (this._scrollBoundViewer !== viewer.el) {
        this._detachScrollMemory(); // 先摘旧的（含 flush）
        viewer.el.addEventListener("scroll", this._onViewerScroll, { passive: true });
        this._scrollBoundViewer = viewer.el;
        this._scrollAnchorFn = viewer.top;
      }
    } else if (this._scrollBoundViewer) {
      this._detachScrollMemory();
    }

    // 位置恢复：独立分支（打开新文件时 _mode 不变，下面的 _mode 分支不执行）。
    // files-view 从不传 .line → 无需 _suppressLocate；行号锚点是尽力而为语义。
    // pdf 分支的恢复由 @document-ready 处理（渲染管线就绪时机在 lit 更新之后）。
    if (this.rememberScroll && changed.has("path")) {
      const saved = readScrollLine(this.path);
      if (saved !== null && saved > 1 && this.language === "markdown" && viewer?.kind === "md") {
        const pathAtRestore = this.path;
        await viewer.el.updateComplete;
        if (this.path !== pathAtRestore) return; // 快速连点：放弃过期恢复
        (viewer.el as MdViewer).scrollToSourceLine(saved, "auto"); // 瞬跳，与锚点恢复一致
      }
    }

    if (!changed.has("_mode")) return;
    if (this._mode === "edit") {
      // 预览 → 编辑：把锚点行恢复为编辑器视口顶部（瞬跳；贴底锚点则对齐尾部视野）
      const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
      if (editor) {
        await editor.updateComplete;
        if (this._anchorAtBottom) editor.scrollToBottom();
        else editor.scrollToLine(this._anchorLine);
        if (this._selOffsets) {
          // WebView：reveal 保留 focus 原生 reveal-selection 兜底视野
          editor.selectOffsets(this._selOffsets.start, this._selOffsets.end, isWebviewContainer());
        }
      }
      return;
    }
    // 编辑 → 预览（编辑只在 markdown 分支发生，恢复目标恒为 md-viewer）
    if (this._skipRestoreOnce) {
      this._skipRestoreOnce = false;
      return;
    }
    const mdViewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    if (mdViewer) {
      await mdViewer.updateComplete;
      if (this._anchorAtBottom) mdViewer.scrollToBottom("auto");
      else mdViewer.scrollToSourceLine(this._anchorLine, "auto");
      if (this._selOffsets) mdViewer.selectSourceOffsets(this._selOffsets.start, this._selOffsets.end);
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

  /** 当前活跃预览组件的滚动锚点（md-viewer=源行号 / pdf-viewer=页号+
   *  页内偏移编码值，ADR-0031）。 */
  private _activePreviewViewer():
    | { kind: "md"; el: MdViewer; top: () => number }
    | { kind: "pdf"; el: PdfViewer; top: () => number }
    | null {
    const md = this.shadowRoot?.querySelector("md-viewer") as MdViewer | null;
    if (md) return { kind: "md", el: md, top: () => md.topSourceLine() };
    const pdf = this.shadowRoot?.querySelector("pdf-viewer") as PdfViewer | null;
    if (pdf) return { kind: "pdf", el: pdf, top: () => pdf.scrollAnchorValue() };
    return null;
  }

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
    const top = this._scrollAnchorFn;
    const path = this._pendingScrollPath;
    this._pendingScrollPath = "";
    if (!viewer || !top || !path) return;
    writeScrollLine(path, top());
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

  /** PDF 缩放 stepper（mobile-menu 内一行，复用 font-scale-row 样式）：
   *  − 适宽/百分比 +；点击中值回适宽。 */
  private _renderPdfZoomStepper() {
    const pdf = this.shadowRoot?.querySelector("pdf-viewer") as PdfViewer | null;
    return html`
      <div class="font-scale-row" role="group" aria-label="缩放">
        <span class="font-scale-label">缩放</span>
        <button
          class="font-scale-btn"
          type="button"
          aria-label="缩小"
          ?disabled=${pdf?.atZoomMin()}
          @click=${() => this._pdfZoom(-1)}
        ><doclens-icon name="minus"></doclens-icon></button>
        <button
          class="font-scale-value"
          type="button"
          style="background:transparent;border:none;cursor:pointer;font-family:inherit;color:var(--cortex-text-muted)"
          title="点击回到适宽"
          @click=${() => this._pdfZoom("fit")}
        >${this._pdfZoomLabel}</button>
        <button
          class="font-scale-btn"
          type="button"
          aria-label="放大"
          ?disabled=${pdf?.atZoomMax()}
          @click=${() => this._pdfZoom(1)}
        ><doclens-icon name="plus"></doclens-icon></button>
      </div>
    `;
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
        ${this._bookmarkAvailable
          ? html`<button
              class="mobile-toc mobile-bookmark ${this._showBookmarks ? "active" : ""}"
              type="button"
              aria-label="书签"
              @click=${this._onBookmarksToggle}
            ><doclens-icon name="star"></doclens-icon></button>`
          : null}
        ${(this.language === "markdown" || this.language === "pdf") && this._mode === "preview"
          ? html`<button
              class="mobile-highlight ${this._showHighlightBar ? "active" : ""}"
              type="button"
              aria-label="关键词高亮"
              @click=${this._onHighlightToggle}
            ><doclens-icon name="search"></doclens-icon></button>`
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
                ${this.language === "pdf" && this._mode === "preview"
                  ? this._renderPdfZoomStepper()
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
                  @click=${() => { this._showMobileMenu = false; void this._onToolboxOpen(); }}
                ><doclens-icon name="sparkles"></doclens-icon>工具箱</button>
                ${this.path
                  ? html`<button
                      type="button"
                      role="menuitem"
                      @click=${() => { this._showMobileMenu = false; this._onCopyPathClick(); }}
                    ><doclens-icon name="copy"></doclens-icon>拷贝路径</button>`
                  : null}
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
    // 捕获预览视口顶部的源行号作为锚点（行级精度；贴底时记录底部锚点）
    // 与文本选区（源文本字符偏移），切换后两侧各自恢复
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    if (viewer) {
      this._anchorLine = viewer.topSourceLine();
      this._anchorAtBottom = viewer.isAtBottom();
      // WebView：用户未选文字时在视野中央自动选 1 字——编辑器侧用
      // focus 的原生 reveal-selection 兜底视野（浏览器自己的坐标计算，
      // 免疫镜像行高测量在 WebView 内核的累积偏差）
      if (isWebviewContainer() && viewer.selectionSourceOffsets() === null) {
        viewer.selectCharAtViewportCenter();
      }
      this._selOffsets = viewer.selectionSourceOffsets();
    }
    this._mode = "edit";
  }

  /** 退出编辑前捕获编辑器视口顶部的源行号（编辑后新文本的行号）与
   *  文本选区，并抑制切回预览时 md-viewer 的命中行定位（避免与锚点恢复打架）。 */
  private _captureEditorAnchor() {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    if (editor) {
      this._anchorLine = editor.topLine();
      this._anchorAtBottom = editor.isAtBottom();
      this._selOffsets = editor.selectionOffsets();
    }
    this._suppressLocate = true;
  }

  private _onEditorCancel = () => {
    // cancel 回滚文本：放弃选区保持（编辑文本的行号已与原文失配），
    // 但保留锚点（视野位置按原文本行号尽力恢复）
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    if (editor) {
      this._anchorLine = editor.topLine();
      this._anchorAtBottom = editor.isAtBottom();
    }
    this._selOffsets = null;
    this._suppressLocate = true;
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

  /** 触发原始文件下载（WebView 内 jsbridge 原生通道，浏览器 `<a>` 兜底，
   *  编排见 utils/download.ts）；文件名由后端 Content-Disposition 决定。 */
  private _onDownloadClick = () => {
    if (!this.path || this._downloading) return;
    void (async () => {
      this._downloading = true;
      try {
        const r = await downloadServerFile(this.path!);
        if (r.via !== "jsbridge") return;
        if (r.name) {
          this.dispatchEvent(
            new CustomEvent("download-success", { detail: { name: r.name } }),
          );
        } else if (r.error) {
          this.dispatchEvent(new CustomEvent("download-failed", { detail: { message: r.error } }));
        }
        // 两字段皆空 = unauthorized 已在公共编排内跳登录，此处静默
      } finally {
        this._downloading = false;
      }
    })();
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

  // ------------------------------------------------------------------
  // 关键词高亮（仅 markdown 预览分支）：输入整词（空格分隔多个）→
  // 透传 md-viewer keyword 高亮全部命中，并自动滚动到第一个命中。
  // ------------------------------------------------------------------

  /** md-viewer 生效的关键词：手动输入经 normalizeHighlightKeyword 归一化
   *  （含 CJK 去空格整串）；未手动输入时透传父组件 keyword 原样。 */
  private get _effectiveKeyword(): string {
    return this._highlightInput.trim()
      ? normalizeHighlightKeyword(this._highlightInput)
      : this.keyword;
  }

  /** 桌面 header 的高亮按钮（图标 + hover 文字）。 */
  private _renderHighlightBtn() {
    return html`<button
      class="highlight-btn ${this._showHighlightBar ? "active" : ""}"
      @click=${this._onHighlightToggle}
    ><doclens-icon name="search"></doclens-icon><span class="btn-label">高亮</span></button>`;
  }

  /** 高亮输入条（桌面 header 下方 / 移动端 mobile-header 下方共用）。 */
  private _renderHighlightBar() {
    if (!this._showHighlightBar) return null;
    return html`
      <div class="highlight-bar">
        <doclens-icon name="search"></doclens-icon>
        <input
          type="text"
          placeholder="输入关键字高亮（中文整词匹配，英文空格分隔多个）"
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
      // Enter=下一个 / Shift+Enter=上一个（匹配导航，2026-09-28 决议，
      // 浏览器 find bar 手感）。关键词变化后的自动首跳由输入 debounce 负责。
      this._clearHighlightDebounce();
      void this._stepHit(e.shiftKey ? -1 : 1);
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

  /** 等 md-viewer 重渲染并完成关键词高亮后，滚动到第一个命中。
   *  pdf 分支无需处理：findController 的 find 命令默认选中首个命中。 */
  private async _jumpToFirstHit() {
    if (this.language === "pdf") return;
    await this.updateComplete;
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    if (!viewer) return;
    await viewer.updateComplete;
    viewer.scrollToFirstKeywordHit();
  }

  /** 步进匹配导航（高亮输入条 Enter/Shift+Enter）：
   *  md-viewer 源文本预计算索引 / pdf-viewer findagain（ADR-0031 平移）。 */
  private async _stepHit(dir: 1 | -1) {
    await this.updateComplete;
    if (this.language === "pdf") {
      const pdf = this.shadowRoot?.querySelector("pdf-viewer") as PdfViewer | null;
      pdf?.stepKeywordHit(dir);
      return;
    }
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    if (!viewer) return;
    await viewer.updateComplete;
    viewer.stepKeywordHit(dir);
  }

  // ------------------------------------------------------------------
  // 目录抽屉（md/docx/pdf 的 markdown 预览分支）：header 按钮 →
  // toc-drawer 浮层列出 heading 扁平缩进列表 → 点击平滑滚动跳转并关闭。
  // ------------------------------------------------------------------

  /** 目录抽屉支持的预览类型：md / docx / pdf
   * （pptx/xlsx/邮件/图像解读的 md 不提供——2026-08-21 决议；
   * pdf 数据源为原生书签，无书签无条目 → 按钮隐藏，ADR-0031）。 */
  private get _tocSupported(): boolean {
    return /\.(md|markdown|docx|pdf)$/i.test(this.path);
  }

  /** 目录按钮显隐：预览模式 + 支持的文档类型 + 有目录条目
   *  （md/docx 来自 heading 提取；pdf 来自 pdf-viewer 的 toc-change 书签）。 */
  private get _tocAvailable(): boolean {
    return (
      (this.language === "markdown" || this.language === "pdf") &&
      this._mode === "preview" &&
      this._tocSupported &&
      this._tocItems.length > 0
    );
  }

  /** pdf-viewer 书签目录就位（无书签不触发，按钮保持隐藏）。 */
  private _onPdfTocChange = (e: CustomEvent<{ items: TocItem[] }>) => {
    if (this.language !== "pdf") return;
    this._tocItems = e.detail.items;
  };

  /** pdf-viewer 缩放状态变化（缩放控件显示「适宽」/百分比）。 */
  private _onPdfZoomChange = (e: CustomEvent<{ label: string }>) => {
    if (this.language !== "pdf") return;
    this._pdfZoomLabel = e.detail.label;
  };

  /** PDF 缩放操作（透传 pdf-viewer；view 事件绑定需箭头包装保持 this）。 */
  private _pdfZoom(delta: 1 | -1 | "fit") {
    const pdf = this.shadowRoot?.querySelector("pdf-viewer") as PdfViewer | null;
    if (!pdf) return;
    if (delta === "fit") pdf.fitWidth();
    else if (delta === 1) pdf.zoomIn();
    else pdf.zoomOut();
  }

  /** 桌面 header 的 PDF 缩放组（− 比例 +；点击比例回适宽）。 */
  private _renderPdfZoomGroup() {
    if (this.language !== "pdf" || this._mode !== "preview") return null;
    const pdf = this.shadowRoot?.querySelector("pdf-viewer") as PdfViewer | null;
    return html`
      <div class="zoom-group" role="group" aria-label="缩放">
        <button
          class="zoom-btn"
          type="button"
          aria-label="缩小"
          ?disabled=${pdf?.atZoomMin()}
          @click=${() => this._pdfZoom(-1)}
        ><doclens-icon name="minus"></doclens-icon></button>
        <button
          class="zoom-label"
          type="button"
          title="点击回到适宽"
          @click=${() => this._pdfZoom("fit")}
        >${this._pdfZoomLabel}</button>
        <button
          class="zoom-btn"
          type="button"
          aria-label="放大"
          ?disabled=${pdf?.atZoomMax()}
          @click=${() => this._pdfZoom(1)}
        ><doclens-icon name="plus"></doclens-icon></button>
      </div>
    `;
  }

  /** pdf 文档就绪：滚动位置恢复（页号+页内偏移锚点；渲染管线就绪晚于
   *  lit 更新。≤1 = 无记忆/回顶部清除语义）。 */
  private _onPdfDocumentReady = () => {
    if (!this.rememberScroll || this.language !== "pdf") return;
    const saved = readScrollLine(this.path);
    if (saved === null || saved <= 1) return;
    const pdf = this.shadowRoot?.querySelector("pdf-viewer") as PdfViewer | null;
    pdf?.restoreScrollAnchorValue(saved);
  };

  /** 桌面 header 的目录按钮（图标 + hover 文字，同 highlight-btn）。 */
  private _renderTocBtn() {
    if (!this._tocAvailable) return null;
    return html`<button
      class="toc-btn ${this._showToc ? "active" : ""}"
      @click=${this._onTocToggle}
    ><doclens-icon name="list-tree"></doclens-icon><span class="btn-label">目录</span></button>`;
  }

  // ------------------------------------------------------------------
  // 阅读书签（2026-10-01 决议）：显式收藏阅读位置，md-viewer 链路
  // （md/epub/docx，源行号锚点）+ pdf-viewer 链路（pdf，页号+页内偏移
  // 锚点）。与滚动记忆（隐式自动）分工并存；与 PDF 原生书签（TOC）无关。
  // ------------------------------------------------------------------

  /** 书签支持的扩展名（按预览链路划定：md-viewer 链路 md/epub/docx +
   *  pdf-viewer 链路 pdf；pptx/xlsx/邮件/图像等不提供）。 */
  private static readonly BOOKMARK_EXTS = /\.(md|markdown|epub|docx|pdf)$/i;

  /** 书签入口可用：预览模式 + 支持的扩展名 + 有 path 且非 PST。 */
  private get _bookmarkAvailable(): boolean {
    return (
      !!this.path &&
      !this._isPst &&
      this._mode === "preview" &&
      PreviewPane.BOOKMARK_EXTS.test(this.path)
    );
  }

  /** 书签自动标签（2026-10-01 决议：纯锚点 + 自动标签，无用户命名）：
   *  md 链路 = 当前所在 heading（activeTocIndex 同口径），无 heading 时
   *  用「第 N 行」；pdf 链路 = 「第 N 页」。 */
  private _bookmarkLabel(kind: "md" | "pdf", anchor: number): string {
    if (kind === "pdf") {
      const page = Math.max(1, Math.floor(anchor / 10000));
      return `第 ${page} 页`;
    }
    const idx = activeTocIndex(this._tocItems, anchor);
    return idx >= 0 ? this._tocItems[idx].text : `第 ${anchor} 行`;
  }

  /** 收藏当前位置（header 圆钮一键动作）：捕获当前锚点 + 生成自动标签。
   *  幂等命中 / 满员经 toast 反馈（bookmark-added 事件，宿主视图 toast，
   *  与 download-success 同模式）。 */
  private _onBookmarkAdd = () => {
    if (!this._bookmarkAvailable) return;
    const viewer = this._activePreviewViewer();
    if (!viewer) return;
    const kind = viewer.kind;
    const anchor = Math.max(1, Math.floor(viewer.top()));
    const label = this._bookmarkLabel(kind, anchor);
    const result = addBookmark({ path: this.path, anchor, kind, label });
    if (!result.ok) {
      this.dispatchEvent(new CustomEvent("bookmark-full", { bubbles: true, composed: true }));
      return;
    }
    this._bookmarkItems = bookmarksFor(this.path);
    if (result.duplicate) {
      this.dispatchEvent(new CustomEvent("bookmark-duplicate", { bubbles: true, composed: true }));
    } else {
      this.dispatchEvent(new CustomEvent("bookmark-added", { bubbles: true, composed: true }));
    }
  };

  private _onBookmarksToggle = () => {
    if (!this._showBookmarks) {
      this._bookmarkItems = bookmarksFor(this.path);
    }
    this._showBookmarks = !this._showBookmarks;
  };

  private _onBookmarksClose = () => {
    this._showBookmarks = false;
  };

  /** 点击书签条目：关闭抽屉 + 跳转（md：平滑滚到源行号；pdf：restore
   *  页号+页内偏移——与滚动记忆恢复同路径）。 */
  private _onBookmarkJump = (e: CustomEvent<{ bookmark: ReadingBookmark }>) => {
    const b = e.detail.bookmark;
    this._showBookmarks = false;
    if (b.kind === "pdf") {
      const pdf = this.shadowRoot?.querySelector("pdf-viewer") as PdfViewer | null;
      pdf?.restoreScrollAnchorValue(b.anchor);
      return;
    }
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    viewer?.scrollToSourceLine(b.anchor, "smooth");
  };

  /** 删除书签：本地移除并刷新列表（抽屉不关闭，可连续删）。 */
  private _onBookmarkRemove = (e: CustomEvent<{ bookmark: ReadingBookmark }>) => {
    const b = e.detail.bookmark;
    removeBookmark(b.path, b.anchor);
    this._bookmarkItems = bookmarksFor(this.path);
  };

  /** 桌面 header 的书签按钮（图标 + hover 文字，同 toc-btn）：点击打开
   *  抽屉（收藏动作在抽屉内——右键入口不可发现，2026-10-01 修正）。 */
  private _renderBookmarkBtn() {
    if (!this._bookmarkAvailable) return null;
    return html`<button
      class="toc-btn ${this._showBookmarks ? "active" : ""}"
      title="书签列表"
      @click=${this._onBookmarksToggle}
    ><doclens-icon name="star"></doclens-icon><span class="btn-label">书签</span></button>`;
  }

  private _renderBookmarkDrawer() {
    if (!this._showBookmarks) return null;
    return html`<bookmark-drawer
      .items=${this._bookmarkItems}
      .canAdd=${this._bookmarkAvailable}
      @add=${this._onBookmarkAdd}
      @jump=${this._onBookmarkJump}
      @remove=${this._onBookmarkRemove}
      @close=${this._onBookmarksClose}
    ></bookmark-drawer>`;
  }

  // ------------------------------------------------------------------
  // 技能工具箱（对当前预览文件跑 AI 技能）：流程内嵌本组件（对话框
  // 组件复用 files 页同款），完成后发 skill-chat 组合事件由 cortex-app
  // 统一消费（新建技能会话 + 切 chat），三个宿主视图零改动。
  // ------------------------------------------------------------------

  /** 工具箱入口可用：有预览文件且非 PST（派生路径非真实文件）。 */
  private get _toolboxAvailable(): boolean {
    return !!this.path && !this._isPst;
  }

  private async _onToolboxOpen() {
    if (!this._toolboxAvailable) return;
    this._pickedSkill = null;
    this._toolbox = "list";
    this._toolboxSkills = null;
    this._toolboxError = null;
    try {
      this._toolboxSkills = await fetchSkills();
    } catch (e) {
      this._toolboxError = (e as Error)?.message || "技能列表加载失败";
    }
  }

  private _onSkillPick = (e: CustomEvent<{ skill: SkillInfo }>) => {
    this._pickedSkill = e.detail.skill;
    this._toolbox = "run";
  };

  /** 确认「开始对话」：拼消息 → skill-chat 事件（app 层建会话切 chat）。
   *  有选中行时文件路径附 `:区间` 后缀（行选择，2026-10-05 决议）。 */
  private _onSkillRunSubmit = (e: CustomEvent<{ prompt: string }>) => {
    const skill = this._pickedSkill;
    this._toolbox = null;
    if (!skill) return;
    const lines = [
      `/${skill.name} 按技能指引处理以下文件`,
      "",
      "文件：",
      `- ${this._pathWithRanges}`,
      "",
      `补充要求：${e.detail.prompt || "无"}`,
    ];
    recordSkillUse(skill.name);
    const firstFile = this.path.split("/").pop() ?? this.path;
    this._selectedLines = new Set(); // 已发送：选区消费完毕，不残留旧区间
    this.dispatchEvent(new CustomEvent("skill-chat", {
      detail: {
        message: lines.join("\n"),
        title: `${skill.name} · ${firstFile}`,
      },
      bubbles: true, composed: true,
    }));
  };

  /** 工具箱按钮（桌面 header，sparkles 图标与 files 工具栏同款）。 */
  private _renderToolboxBtn() {
    if (!this._toolboxAvailable) return null;
    return html`<button
      class="toc-btn"
      title="技能工具箱（对当前文件运行 AI 技能）"
      @click=${() => void this._onToolboxOpen()}
    ><doclens-icon name="sparkles"></doclens-icon><span class="btn-label">工具箱</span></button>`;
  }

  /** 拷贝当前预览路径（相对 workdir）到剪贴板；结果经 path-copied 事件
   *  由宿主视图 toast（与 download-success 同模式，移动/桌面一致）。 */
  private _onCopyPathClick = () => {
    if (!this.path) return;
    navigator.clipboard.writeText(this.path).then(
      () => this.dispatchEvent(new CustomEvent("path-copied", {
        detail: { ok: true, path: this.path },
        bubbles: true, composed: true,
      })),
      () => this.dispatchEvent(new CustomEvent("path-copied", {
        detail: { ok: false, path: this.path },
        bubbles: true, composed: true,
      })),
    );
  };

  /** 拷贝路径按钮（桌面 header）。 */
  private _renderCopyPathBtn() {
    if (!this.path) return null;
    return html`<button
      class="toc-btn"
      title="拷贝路径（相对知识库根目录）"
      @click=${this._onCopyPathClick}
    ><doclens-icon name="copy"></doclens-icon><span class="btn-label">拷贝路径</span></button>`;
  }

  /** 工具箱对话框组（list → run 两段式，与 files 页同组件同交互）。
   *  showModal 渲染（top layer）：见 updated() 的打开时机。 */
  private _renderToolboxDialogs() {
    if (this._toolbox === "list") {
      return html`<dialog @cancel=${(e: Event) => { e.preventDefault(); this._toolbox = null; }}>
        <skill-toolbox-dialog
          .skills=${this._toolboxSkills}
          .error=${this._toolboxError}
          @pick=${this._onSkillPick}
          @cancel=${() => { this._toolbox = null; }}
        ></skill-toolbox-dialog>
      </dialog>`;
    }
    if (this._toolbox === "run" && this._pickedSkill) {
      return html`<dialog @cancel=${(e: Event) => { e.preventDefault(); this._toolbox = null; }}>
        <skill-run-dialog
          .skill=${this._pickedSkill}
          .filePaths=${[this.path]}
          @submit=${this._onSkillRunSubmit}
          @cancel=${() => { this._toolbox = null; }}
        ></skill-run-dialog>
      </dialog>`;
    }
    return null;
  }

  private _onTocToggle = () => {
    if (!this._showToc) {
      // 打开前捕获阅读位置，抽屉据此高亮当前章节（md=行号锚点 / pdf=页号锚点）
      this._tocCurrentLine = this._activePreviewViewer()?.top() ?? 1;
    }
    this._showToc = !this._showToc;
  };

  private _onTocClose = () => {
    this._showToc = false;
  };

  /** 点击目录节点：关闭抽屉 + 跳转（md：平滑滚到标题行；pdf：line=页号，
   *  跳到对应页——原生书签目的地，ADR-0031）。 */
  private _onTocJump = (e: CustomEvent<{ line: number }>) => {
    this._showToc = false;
    if (this.language === "pdf") {
      const pdf = this.shadowRoot?.querySelector("pdf-viewer") as PdfViewer | null;
      pdf?.scrollToPage(e.detail.line);
      return;
    }
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
    // 空态守卫不含 pdf——PDF 原生预览的 content 恒为空串（轻量标记
    // 响应，ADR-0031），空串是正常态而非「无预览」
    if (this.language !== "pdf" && !this._content && !this.content)
      return html`<div class="empty">点击左侧结果查看预览</div>`;

    // 移动端用自己的顶部 bar，常规 .header 不再渲染（避免双 bar）
    const renderMobileBar = this.mobile ? this._renderMobileHeader() : null;
    const showDesktopHeader = !this.mobile && !this.noHeader;

    if (this.language === "markdown" && this._mode === "edit") {
      return html`
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderReparseBtn()}
            ${this._renderToolboxBtn()}
            ${this._renderCopyPathBtn()}
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
        ${this._renderToolboxDialogs()}
      `;
    }

    if (this.language === "markdown") {
      return html`
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this.writable
              ? html`<button class="edit-btn" @click=${() => this.enterEdit()}><doclens-icon name="pencil"></doclens-icon><span class="btn-label">编辑</span></button>`
              : null}
            ${this._renderDownloadBtn()}
            ${this._renderTocBtn()}
            ${this._renderBookmarkBtn()}
            ${this._renderHighlightBtn()}
            ${this._renderReparseBtn()}
            ${this._renderToolboxBtn()}
            ${this._renderCopyPathBtn()}
          </div>
        ` : null}
        ${this._renderHighlightBar()}
        <md-viewer
          .content=${this._content}
          .line=${this.line}
          .keyword=${this._effectiveKeyword}
          .pages=${this.pages}
          .docPath=${this.path}
          .fontScale=${fontScaleFromPct(this._fontScalePct)}
          ?suppressLocate=${this._suppressLocate}
        ></md-viewer>
        ${this._renderAttachments()}
        ${this._renderTocDrawer()}
        ${this._renderBookmarkDrawer()}
        ${this._renderDownloadOverlay()}
        ${this._renderToolboxDialogs()}
      `;
    }

    // PDF：原生预览（ADR-0031）——pdf.js 组件层渲染原始字节；页表跳页、
    // 书签 TOC、findController 匹配导航均在 pdf-viewer 内闭环
    if (this.language === "pdf") {
      return html`
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this._renderPdfZoomGroup()}
            ${this._renderDownloadBtn()}
            ${this._renderTocBtn()}
            ${this._renderBookmarkBtn()}
            ${this._renderHighlightBtn()}
            ${this._renderReparseBtn()}
            ${this._renderToolboxBtn()}
            ${this._renderCopyPathBtn()}
          </div>
        ` : null}
        ${this._renderHighlightBar()}
        <pdf-viewer
          .docPath=${this.path}
          .keyword=${this._effectiveKeyword}
          .locateLine=${this.line}
          .pageStarts=${this.pageStarts}
          @toc-change=${this._onPdfTocChange}
          @zoom-change=${this._onPdfZoomChange}
          @document-ready=${this._onPdfDocumentReady}
        ></pdf-viewer>
        ${this._renderTocDrawer()}
        ${this._renderBookmarkDrawer()}
        ${this._renderDownloadOverlay()}
        ${this._renderToolboxDialogs()}
      `;
    }

    // HTML：iframe srcdoc 渲染原生网页（脚本隔离，不可编辑）
    if (this.language === "html") {
      return html`
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderReparseBtn()}
            ${this._renderToolboxBtn()}
            ${this._renderCopyPathBtn()}
          </div>
        ` : null}
        <iframe
          class="html-frame"
          srcdoc=${this._content}
          sandbox="allow-scripts"
          title="HTML 预览"
        ></iframe>
        ${this._renderDownloadOverlay()}
        ${this._renderToolboxDialogs()}
      `;
    }

    // 非 md：纯文本 + 行号视图（代码文件按服务端分词 tokens 着色，ADR-0032）
    const lines = this._content.split("\n");
    const tokLines = this.tokens;
    const tokensAligned = tokLines !== null && tokLines.length === lines.length;
    return html`
      ${renderMobileBar}
      ${showDesktopHeader ? html`
        <div class="header">
          ${this._renderBackBtn()}
          <span class="path">${this.path}</span>
          ${this._renderDownloadBtn()}
            ${this._renderReparseBtn()}
            ${this._renderToolboxBtn()}
            ${this._renderCopyPathBtn()}
        </div>
      ` : null}
      <div class="body">
        ${lines.map((line, i) => {
          const lineNo = i + 1;
          const cls = this.highlights.includes(lineNo) ? "highlight" : "";
          const sel = this._selectedLines.has(lineNo);
          const runs = tokensAligned ? tokLines[i] : null;
          return html`<div class="line ${sel ? "line-selected" : ""}"><span
            class="line-no clickable ${cls}"
            title="点击选中/取消选中该行（选中区间可经工具箱带给 AI 技能）"
            @click=${() => this._onLineNoClick(lineNo)}
          >${lineNo}</span>${runs
            ? runs.map(([kind, text]) => (kind ? html`<span class="tk-${kind}">${text}</span>` : text))
            : line}</div>`;
        })}
        ${this._selectedLines.size > 0
          ? html`<button
              class="line-clear-btn"
              type="button"
              @click=${() => { this._selectedLines = new Set(); }}
            >清除选中（${this._lineRanges}）</button>`
          : null}
        <div class="scroll-jump-anchor">${renderScrollJumpFabs(this._scrollJump)}</div>
      </div>
      ${this._renderDownloadOverlay()}
        ${this._renderToolboxDialogs()}
    `;
  }

  /** 下载中屏幕中心遮罩（公共组件 download-overlay，与 files-view 共用）。
   *  显隐由组件 open 属性自理（false 不渲染），不再条件挂载——漏传
   *  open 即「preview 没转圈」回归的根因。 */
  private _renderDownloadOverlay() {
    return html`<download-overlay ?open=${this._downloading} label="下载中…"></download-overlay>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "preview-pane": PreviewPane;
  }
}
