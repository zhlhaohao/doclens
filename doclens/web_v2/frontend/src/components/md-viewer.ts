import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import katex from "katex";
// shadow DOM 隔离全局样式，KaTeX CSS 必须以内联方式注入组件 styles；
// Vite 会重写其中字体 url() 为构建产物路径（woff2 按 @font-face 按需加载）。
import katexStyles from "katex/dist/katex.min.css?inline";
import { sanitizeHtml } from "../utils/sanitize";
import { cjkInlineMath } from "../utils/marked-math";
import type { PageMarker } from "../api/preview";
import "./image-viewer";
import "./icon";
import {
  ScrollJumpController,
  scrollJumpFabStyles,
  renderScrollJumpFabs,
} from "../utils/scroll-jump";

/**
 * 块级元素 renderer —— 给每个块注入 data-source-line（1-indexed）
 *
 * marked v18 的 token 对象没有 `line` 字段，因此采用 preprocess hook
 * 缓存当前 markdown 源文本，renderer 内通过 token.raw 在源文本中的
 * 顺序位置反推起始行号（cursor 递增保证多次调用不回退匹配）。
 *
 * 分页模式（xlsx/pdf/pptx）：每个分块走一次 marked.parse，preprocess 会
 * 重置 currentSrc/cursor，使行号变成「分块内 1-indexed」。_splitByPages
 * 在调用前显式设置 currentOffset = chunk 的起始行偏移，lineOf 把分块
 * 内行号加上偏移，得到「全文 1-indexed」的绝对行号。
 */
let currentSrc = "";
let cursor = 0;
let currentOffset = 0;

/** 在 currentSrc 中查找 raw 的起始位置，返回 1-indexed 行号（全文绝对） */
function lineOf(raw: string | undefined): number {
  if (!raw) return 0;
  const idx = currentSrc.indexOf(raw, cursor);
  if (idx === -1) {
    // 降级：从头查找（处理罕见的乱序情况）
    const idx0 = currentSrc.indexOf(raw);
    if (idx0 === -1) return 0;
    return (currentSrc.slice(0, idx0).match(/\n/g) ?? []).length + 1 + currentOffset;
  }
  const line = (currentSrc.slice(0, idx).match(/\n/g) ?? []).length + 1;
  cursor = idx + raw.length;
  return line + currentOffset;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
}

/** 底层像素 ≤ 此值的图片视为 icon，按原始尺寸显示（不放大）。
 *  依据：样本扫描（6 docx / 90 图）显示 icon 底层像素普遍 ≤400，
 *  大图通常 1000+，500 是干净断层。 */
export const ICON_PX_THRESHOLD = 500;

/** 根据图片 naturalWidth 返回应设置的 width 样式值；无需调整时返回 null。
 *  抽为纯函数便于单元测试。 */
export function iconWidthStyle(naturalWidth: number): string | null {
  if (naturalWidth > 0 && naturalWidth <= ICON_PX_THRESHOLD) {
    return `${naturalWidth}px`;
  }
  return null;
}

/** 协议/绝对 URL 判定（http:、https:、data:、blob: 等） */
const _HAS_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** 把 md 里的相对图片 src 解析为 /api/preview/raw 可服务的 URL。
 *
 *  md 原文写的是相对文档的路径（如 `![备注](images/2026-08-01/x.webp)`），
 *  浏览器会相对页面 URL 解析 → 404。这里相对**文档所在目录**解析成
 *  workdir 相对路径，再交给 /api/preview/raw 服务原文件。
 *
 *  返回 null 表示无需重写（绝对路径、带协议、锚点、或越出 workdir 根）。 */
export function resolveDocImageUrl(docPath: string, src: string): string | null {
  if (!docPath || !src) return null;
  if (src.startsWith("/") || src.startsWith("#") || _HAS_SCHEME_RE.test(src)) return null;
  // 剥掉查询串/锚点参与路径解析，重写时再拼回
  const m = src.match(/^([^?#]*)([?#].*)?$/);
  const relPath = m?.[1] ?? src;
  const suffix = m?.[2] ?? "";
  if (!relPath) return null;

  const dirSegs = docPath.split("/").slice(0, -1); // 文档所在目录
  for (const seg of relPath.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (dirSegs.length === 0) return null; // 越出 workdir 根，不重写
      dirSegs.pop();
    } else {
      dirSegs.push(seg);
    }
  }
  const resolved = dirSegs.map(encodeURIComponent).join("/");
  return `/api/preview/raw?path=${resolved}${suffix}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const blockRenderer: any = {
  heading(token: any) {
    const text = (this as any).parser.parseInline(token.tokens);
    const line = lineOf(token.raw);
    return `<h${token.depth} data-source-line="${line}">${text}</h${token.depth}>\n`;
  },
  paragraph(token: any) {
    const text = (this as any).parser.parseInline(token.tokens);
    const line = lineOf(token.raw);
    return `<p data-source-line="${line}">${text}</p>\n`;
  },
  code(token: any) {
    const line = lineOf(token.raw);
    const escaped = escapeHtml(token.text);
    const langAttr = token.lang ? ` class="language-${escapeHtml(token.lang)}"` : "";
    return `<pre data-source-line="${line}"><button class="copy-btn" title="复制代码">复制</button><code${langAttr}>${escaped}</code></pre>\n`;
  },
  list(token: any) {
    const line = lineOf(token.raw);
    let body = "";
    for (const item of token.items) body += (this as any).listitem(item);
    const tag = token.ordered ? "ol" : "ul";
    const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
    return `<${tag}${startAttr} data-source-line="${line}">\n${body}</${tag}>\n`;
  },
  blockquote(token: any) {
    const line = lineOf(token.raw);
    const body = (this as any).parser.parse(token.tokens);
    return `<blockquote data-source-line="${line}">\n${body}</blockquote>\n`;
  },
};

/**
 * 图片 renderer —— 把 ![alt](url) 渲染成带 loading="lazy" 的 <img>。
 * marked v18 image renderer 接收 token 对象（{href, title, text, tokens}）。
 * 直接挂在 blockRenderer 上，保持单个 renderer（不新建 marked.use 避免 clobber）。
 */
blockRenderer.image = function (token: any) {
  const href = escapeHtml(token.href || "");
  const titleAttr = token.title ? ` title="${escapeHtml(token.title)}"` : "";
  const alt = escapeHtml(token.text || "");
  const caption = alt && alt !== "照片" ? `<figcaption>${alt}</figcaption>` : "";
  return `<figure><img src="${href}" alt="${alt}"${titleAttr} loading="lazy">${caption}</figure>\n`;
};

/** 单行 `$$...$$` 块级公式扩展（marked-katex-extension 只认定界符独占一行）。
 *
 *  arxiv 转换的 md 常写成单行 `$$ $A$ ( $B$ ) $$`，且内部嵌套 `$...$`
 *  （LaTeX→md 转换残留）。自定义 block tokenizer 整行匹配、不改写源文本
 *  （改写会打乱 data-source-line 与后端行号对齐）；renderer 剥掉内层 `$`
 *  后按 displayMode 渲染。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const singleLineDisplayMath: any = {
  name: "singleLineDisplayMath",
  level: "block",
  start(src: string) {
    return src.indexOf("$$");
  },
  tokenizer(src: string) {
    const m = /^\$\$([^\n]+?)\$\$\s*(?:\n|$)/.exec(src);
    if (!m) return undefined;
    return { type: "singleLineDisplayMath", raw: m[0], text: m[1].trim() };
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderer(token: any) {
    const line = lineOf(token.raw);
    const body = katex.renderToString(token.text.replace(/\$/g, ""), {
      displayMode: true,
      throwOnError: false,
    });
    return `<div data-source-line="${line}">${body}</div>\n`;
  },
};

/** 标记是否已 use 过（避免重复 use） */
let mdConfigured = false;
function ensureMdConfigured(): void {
  if (mdConfigured) return;
  mdConfigured = true;
  marked.use({
    hooks: {
      preprocess(src: string) {
        currentSrc = src;
        cursor = 0;
        return src;
      },
    },
    renderer: blockRenderer,
  });
  // KaTeX 公式：$...$ 行内 / $$...$$ 块级；throwOnError:false 非法公式渲染为
  // 红色源码而非抛错。扩展 tokenizer 先于默认规则命中，可阻止公式内 `_` 被
  // emphasis 误解析。
  marked.use(markedKatex({ throwOnError: false }));
  // CJK 语境行内公式兜底（type-$l$ / $...$（ / $...$； 等标准规则漏判的写法，
  // 见 marked-math.ts）。须在 markedKatex 之后注册（marked 同级扩展 unshift，
  // 后注册先尝试）。
  marked.use({ extensions: [cjkInlineMath] });
  // 单行 $$...$$ 兜底（扩展 tokenizer 返回 undefined 才轮到它，不抢标准块级语法）
  marked.use({ extensions: [singleLineDisplayMath] });
}

@customElement("md-viewer")
export class MdViewer extends LitElement {
  static styles = [
    scrollJumpFabStyles,
    unsafeCSS(katexStyles),
    css`
    :host { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    :host {
      display: block;
      padding: var(--cortex-space-4);
      background: var(--cortex-surface-muted);   /* surface-soft 底：白画布上让白纸浮起 */
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-base);
      line-height: 1.7;
      color: var(--cortex-text);
      overflow-y: auto;
      /* 作为 preview-pane (flex column) 的 flex item，必须用 flex 填充
         而非 height: 100%。height: 100% + overflow: auto 在 iOS Safari
         中会触发 flexbox 触摸滚动 bug，导致手指滑动无法滚动内容。 */
      flex: 1 1 0;
      min-height: 0;
    }
    :host h1, :host h2, :host h3, :host h4 {
      margin: 1em 0 0.5em;
      line-height: 1.3;
      color: var(--cortex-text);
    }
    :host h1, :host h2 {
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    :host h3, :host h4 {
      font-weight: 600;
    }
    :host h1 { font-size: 1.4em; }
    :host h2 { font-size: 1.2em; }
    :host h3 { font-size: 1.05em; }
    :host p { margin: 0.5em 0; color: var(--cortex-text); }
    /* 链接：primary + 无下划线；hover 下划线 */
    :host a { color: var(--cortex-primary); text-decoration: none; }
    :host a:hover { text-decoration: underline; }
    :host ul, :host ol { margin: 0.5em 0; padding-left: 1.5em; }
    :host li { margin: 0.2em 0; }
    /* 代码块：surface-muted + hairline + radius-md；长行自动折行不横向滚动 */
    :host pre {
      position: relative;
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      overflow-x: hidden;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    .copy-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      padding: 2px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm, 6px);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 12px;
      font-family: var(--cortex-font);
      opacity: 0;
      transition: opacity 0.15s;
    }
    pre:hover .copy-btn { opacity: 1; }
    .copy-btn:hover { color: var(--cortex-primary); border-color: var(--cortex-primary); }
    /* pre 内 code 重置 inline 样式 */
    :host pre code {
      background: transparent;
      padding: 0;
      font-size: inherit;
    }
    /* inline code：mono + surface-muted + radius-sm */
    :host code {
      font-family: var(--cortex-font-mono);
      font-size: 0.9em;
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-sm);
      padding: 0 4px;
    }
    /* 引用：primary 左边框 + primary-soft 底 + radius 右侧 */
    :host blockquote {
      border-left: 3px solid var(--cortex-primary);
      background: var(--cortex-primary-soft);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-radius: 0 var(--cortex-radius-md) var(--cortex-radius-md) 0;
      color: var(--cortex-text-muted);
      margin: 0.5em 0;
    }
    /* md 表格：之前缺规则导致浏览器默认无边框，分隔线不可见 */
    :host table {
      border-collapse: collapse;
      margin: 0.75em 0;
      font-size: var(--cortex-fs-sm);
      display: block;
      overflow-x: auto;  /* 宽表横向滚动，避免撑破预览面板 */
    }
    :host th, :host td {
      border: 1px solid var(--cortex-border);
      padding: var(--cortex-space-2);
      text-align: left;
      vertical-align: top;
    }
    :host th {
      background: var(--cortex-surface-muted);
      font-weight: 600;
    }
    :host tbody tr:nth-child(even) {
      background: var(--cortex-surface-muted);
    }
    /* 图片：inline-block 流式排列——小图（icon，设了固定 width）从左到右排成行，
       大图（max-width:100%）自然占满一行。连续图片由后端用空格 join 进同一段落，
       渲染后成为同 <p> 内的 inline <img>，从而横向流动换行。 */
    :host figure {
      margin: 0 0 var(--cortex-space-2) 0;
      display: inline-block;
    }
    :host img {
      max-width: 100%;
      height: auto;
      border-radius: var(--cortex-radius-md);
      display: block;
    }
    :host figcaption {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      text-align: center;
      margin-top: var(--cortex-space-1, 4px);
      line-height: 1.4;
    }
    /* 单块预览（docx/md）= 一张白纸；max-width 居中，宽屏不撑满 */
    .md-body {
      position: relative;
      background: var(--cortex-surface);
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-shadow-sm);
      padding: var(--cortex-space-8) var(--cortex-space-8);
      max-width: 820px;
      margin: 0 auto;
    }
    /* 分页容器（pdf/pptx/excel）：覆盖 .md-body 白纸为透明，
       仅保留居中 —— 让子 .page-card 当"多张纸"而非"一张大纸包多页"。
       必须在 .md-body 之后定义才能覆盖。 */
    .md-body-paged {
      background: transparent;
      box-shadow: none;
      padding: 0;
      border-radius: 0;
      max-width: 820px;
      margin: 0 auto;
    }
    .empty {
      color: var(--cortex-text-subtle);
      text-align: center;
      padding: var(--cortex-space-6);
    }
    /* 全文复制按钮：贴纸面右上角（absolute，不受 padding 影响） */
    .copy-bar-top {
      position: absolute;
      top: 8px;
      right: 12px;
      z-index: 5;
    }
    .doc-copy {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 32px;
      padding: 0 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 13px;
      font-family: var(--cortex-font);
      opacity: 0.7;
      transition: opacity 0.15s;
    }
    .doc-copy:hover { opacity: 1; color: var(--cortex-primary); }
    /* icon-only：文字 hover 时以 tooltip 浮现于按钮左下方（同 preview-pane header） */
    .doc-copy .btn-label {
      display: none;
    }
    .doc-copy:hover .btn-label {
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
    /* 定位块的闪烁动画（"你滚到这里了"指示）
       使用 box-shadow 而不是 background，避免和 <mark class="keyword-hit">
       的 primary 底色叠加产生视觉混乱（xlsx 场景下 scrollTo 可能是 mark）。
       primary-based rgba 对齐 SaaS Boutique Electric Blue。 */
    .highlight-flash {
      animation: highlight-flash 2s ease-out;
    }
    @keyframes highlight-flash {
      0% { box-shadow: 0 0 0 4px rgba(0, 100, 224, 0.12); }
      100% { box-shadow: 0 0 0 4px transparent; }
    }
    /* 搜索关键字命中高亮（primary-soft 底，类似浏览器 Ctrl+F）
       SaaS Boutique：旧 amber #FEF3C7 已替换为 primary-based rgba。 */
    :host mark.keyword-hit {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    /* 分页卡片：白纸，靠阴影区分（去 border） */
    .page-card {
      background: var(--cortex-surface);
      border: none;
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-shadow-md);
      margin: 0 0 var(--cortex-space-4);
      padding: var(--cortex-space-6) var(--cortex-space-8);
    }
    .page-card-header {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-weight: 500;
      letter-spacing: 0.02em;
      padding-bottom: var(--cortex-space-2);
      margin-bottom: var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    /* 卡片内部标题更紧凑 */
    .page-card h1, .page-card h2, .page-card h3 {
      margin-top: 0.5em;
    }
    /* 移动端：纸张边距收紧 */
    @media (max-width: 768px) {
      :host { padding: var(--cortex-space-2); }
      .md-body, .page-card {
        padding: var(--cortex-space-4);
        border-radius: var(--cortex-radius-md);
      }
    }
  `,
  ];

  @property() content = "";
  /** 1-indexed 目标行；用于滚动到命中块并闪烁定位 */
  @property({ type: Number }) line: number | null = null;
  /** 搜索关键字（按空格分词，在渲染后的正文里高亮所有命中词） */
  @property() keyword = "";
  /** 分页标记（PDF/PPTX/XLSX）；为 null 时走单块渲染 */
  @property({ attribute: false }) pages: PageMarker[] | null = null;
  /** 文档相对 workdir 的路径（如 日记/2026.md）；设置后相对图片 src 重写到 /api/preview/raw */
  @property({ attribute: "doc-path" }) docPath = "";
  /** 全屏图片查看 */
  @state() private _viewerSrc = "";
  /** 全文复制反馈 */
  @state() private _copied = false;
  /** 跳过 line/content 变化触发的命中行定位（preview-pane 模式切换做
   *  位置恢复期间置 true，避免定位打架） */
  @property({ type: Boolean }) suppressLocate = false;

  /** 悬浮跳转按钮（跳首行/跳尾行）：scroller = :host 自身 */
  private _scrollJump = new ScrollJumpController(this, { behavior: "smooth" });

  firstUpdated() {
    this._scrollJump.attach(this);
  }

  updated(changedProps: Map<string, unknown>) {
    super.updated?.(changedProps);
    // content/keyword 变化都需重新高亮（content 变化时 render 重建 .md-body，
    // 旧 <mark> 随之销毁；仅 keyword 变化时 .innerHTML 绑定同值跳过、DOM 不重建，
    // 需先剥掉旧 <mark>——否则残留旧高亮且 TreeWalker 跳过 MARK 子树会漏判）
    if (changedProps.has("content") || changedProps.has("keyword")) {
      if (changedProps.has("keyword") && !changedProps.has("content")) {
        this._stripKeywordMarks();
      }
      this._highlightKeyword();
    }
    if (
      changedProps.has("content") ||
      changedProps.has("pages") ||
      changedProps.has("docPath")
    ) {
      this._resolveImageUrls();
      this._applyIconSizing();
      this._bindImageClicks();
      this._bindCopyButtons();
    }
    if (changedProps.has("line") || changedProps.has("content")) {
      if (!this.suppressLocate) this._locateAndHighlight();
    }
    // 内容变化后滚动范围可能改变 → 重算悬浮按钮显隐
    this._scrollJump.refresh();
  }

  /** 相对文档目录的图片 src → /api/preview/raw URL（仅当 docPath 已设置）。
   *  在 _applyIconSizing 之前执行：重写后的 URL 不带 dw，自然走 naturalWidth 兜底。 */
  private _resolveImageUrls() {
    if (!this.docPath) return;
    const imgs = this.shadowRoot!.querySelectorAll<HTMLImageElement>("img");
    imgs.forEach((img) => {
      const raw = img.getAttribute("src") ?? "";
      const url = resolveDocImageUrl(this.docPath, raw);
      if (url) img.src = url;
    });
  }

  /** 为渲染后的 img 绑定点击 → 全屏查看（marked innerHTML 的图片无法用 @click 模板绑定） */
  private _bindImageClicks() {
    const imgs = this.shadowRoot!.querySelectorAll<HTMLImageElement>("img");
    imgs.forEach((img) => {
      if (img.dataset.bound) return;
      img.dataset.bound = "true";
      img.style.cursor = "zoom-in";
      img.addEventListener("click", () => {
        this._viewerSrc = img.src;
      });
    });
  }

  /** 为代码块的复制按钮绑定点击 → 写入剪贴板 */
  private _bindCopyButtons() {
    const btns = this.shadowRoot!.querySelectorAll<HTMLButtonElement>(".copy-btn");
    btns.forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = "true";
      btn.addEventListener("click", () => {
        const code = btn.parentElement?.querySelector("code");
        if (code) {
          navigator.clipboard.writeText(code.textContent || "").then(() => {
            btn.textContent = "已复制";
            setTimeout(() => { btn.textContent = "复制"; }, 1500);
          }).catch(() => {});
        }
      });
    });
  }

  /** 从图片 URL 的 dw 查询参数读显示宽（px），无则返回 null。
   *  方案 B：后端把文档内显示宽编进 src（&dw=<px>），前端据此立即布局，
   *  无需等图片加载即可判定 icon（消除 lazy 闪烁）。 */
  private _dispWidthFromSrc(src: string): number | null {
    try {
      const dw = new URL(src, window.location.href).searchParams.get("dw");
      if (!dw) return null;
      const n = Number(dw);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  }

  /** icon 按文档显示尺寸（dw）或底层像素（naturalWidth）显示，不被 max-width:100% 拉伸。
   *
   *  优先用 src 的 dw 查询参数（方案 B：后端注入的显示宽，准确、立即布局无闪烁）；
   *  无 dw 时退回 naturalWidth（方案 A 兜底，覆盖旧索引，需等图片加载）。
   *  ≤阈值的设 style.width 固定原尺寸；大图不设 width，继续 max-width:100% 铺满。 */
  private _applyIconSizing() {
    const imgs = this.shadowRoot!.querySelectorAll("img");
    imgs.forEach((img) => {
      const dw = this._dispWidthFromSrc(img.src);
      if (dw !== null) {
        const style = iconWidthStyle(dw);
        if (style) img.style.width = style;
        return;
      }
      const apply = () => {
        try {
          const style = iconWidthStyle(img.naturalWidth);
          if (style) img.style.width = style;
        } catch {
          // naturalWidth 读取异常（同源 /api/preview/asset 场景理论上不会触发）：兜底不设
        }
      };
      if (img.complete && img.naturalWidth > 0) apply();
      else img.addEventListener("load", apply, { once: true });
    });
  }

  /** 找 data-source-line <= line 的最后一个块 = 该源行所在的 markdown 块 */
  private _findBlockAtLine(line: number): HTMLElement | null {
    const blocks = Array.from(
      this.shadowRoot!.querySelectorAll<HTMLElement>("[data-source-line]"),
    );
    if (blocks.length === 0) return null;
    return blocks.reduce<HTMLElement | null>((best, el) => {
      const ls = Number(el.getAttribute("data-source-line"));
      if (ls <= line && (!best || ls > Number(best.getAttribute("data-source-line")))) {
        return el;
      }
      return best;
    }, null);
  }

  /** 视口顶部第一个可见块的源行号（1-indexed）；无块时返回 1。
   *  供 preview-pane 在预览→编辑切换时捕获位置锚点。 */
  topSourceLine(): number {
    const blocks = Array.from(
      this.shadowRoot!.querySelectorAll<HTMLElement>("[data-source-line]"),
    );
    if (blocks.length === 0) return 1;
    const hostRect = this.getBoundingClientRect();
    for (const el of blocks) {
      if (el.getBoundingClientRect().bottom > hostRect.top + 1) {
        return Number(el.getAttribute("data-source-line")) || 1;
      }
    }
    const last = blocks[blocks.length - 1];
    return Number(last.getAttribute("data-source-line")) || 1;
  }

  /** 滚动使源行 line 所在块贴顶（默认瞬跳）。供 preview-pane 在编辑→预览
   *  切换时恢复位置锚点；不触发闪烁动画。 */
  scrollToSourceLine(line: number, behavior: ScrollBehavior = "auto") {
    const target = this._findBlockAtLine(line);
    if (!target) return;
    // 仅滚动 md-viewer 自身（:host 是 overflow:auto 的滚动容器）。
    // 不能用 target.scrollIntoView —— 它会沿滚动链传播到 window，
    // 把外层 detail-overlay 顶部的 focus-header（返回键）推出视口。
    const hostRect = this.getBoundingClientRect();
    if (hostRect.height <= 0) return;
    const targetRect = target.getBoundingClientRect();
    this.scrollTo({
      top: targetRect.top - hostRect.top + this.scrollTop,
      behavior,
    });
  }

  /** 滚动到第一个关键词命中（<mark class="keyword-hit">），并闪烁其所在块。
   *  供 preview-pane 的高亮输入条在用户输入后自动定位。无命中时静默返回。 */
  scrollToFirstKeywordHit(behavior: ScrollBehavior = "smooth") {
    const mark = this.shadowRoot?.querySelector("mark.keyword-hit") as HTMLElement | null;
    if (!mark) return;
    // 仅滚动 md-viewer 自身（:host 是 overflow:auto 的滚动容器），
    // 不能用 scrollIntoView —— 会沿滚动链传播把外层容器顶出去。
    const hostRect = this.getBoundingClientRect();
    if (hostRect.height <= 0) return;
    const markRect = mark.getBoundingClientRect();
    this.scrollTo({
      top: markRect.top - hostRect.top + this.scrollTop,
      behavior,
    });
    // 闪烁首个命中所在的块级元素，增强定位感知
    const block = mark.closest("[data-source-line]") as HTMLElement | null;
    const flashTarget = block ?? mark;
    flashTarget.classList.remove("highlight-flash"); // 重置以便动画重放
    void flashTarget.offsetWidth;                    // 强制 reflow，让 animation 重新触发
    flashTarget.classList.add("highlight-flash");
  }

  private _locateAndHighlight() {
    if (this.line === null || this.line === undefined) return;
    const target = this._findBlockAtLine(this.line);
    if (!target) return;

    this.scrollToSourceLine(this.line, "smooth");
    // 闪烁节点第一行所在的块（不再回退到 <mark.keyword-hit>：
    // 即便 target 不含 keyword——典型如 xlsx 的 sheet 标题，
    // keyword 命中在内部 table 单元格——闪烁位置始终锚定在节点起始处，
    // 让用户明确感知到「这里就是节点开头」）。
    target.classList.remove("highlight-flash");  // 重置以便动画重放
    void target.offsetWidth;                     // 强制 reflow，让 animation 重新触发
    target.classList.add("highlight-flash");
  }

  /** 在渲染后的正文里高亮搜索关键字（按空格分词，每个命中词包裹 <mark>）。
   *  使用 TreeWalker 遍历文本节点，避免对 HTML 结构做字符串替换引入 XSS。 */
  private _highlightKeyword() {
    const root = this.shadowRoot?.querySelector(".md-body-paged, .md-body") as HTMLElement | null;
    if (!root) return;
    const words = (this.keyword ?? "").split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) return;
    const re = new RegExp(words.map((w) => this._escapeRegExp(w)).join("|"), "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = (node as Text).parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        // 跳过脚本/样式/已标记节点，避免重复嵌套
        if (tag === "SCRIPT" || tag === "STYLE" || tag === "MARK") {
          return NodeFilter.FILTER_REJECT;
        }
        return re.test(node.nodeValue ?? "") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const targets: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) targets.push(n as Text);
    for (const text of targets) {
      re.lastIndex = 0;
      const value = text.nodeValue ?? "";
      const frag = document.createDocumentFragment();
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(value)) !== null) {
        if (m.index > last) {
          frag.appendChild(document.createTextNode(value.slice(last, m.index)));
        }
        const mark = document.createElement("mark");
        mark.textContent = m[0];
        mark.className = "keyword-hit";
        frag.appendChild(mark);
        last = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++; // 防御零宽匹配死循环
      }
      if (last < value.length) {
        frag.appendChild(document.createTextNode(value.slice(last)));
      }
      text.parentNode?.replaceChild(frag, text);
    }
  }

  /** 剥掉正文里的全部 <mark class="keyword-hit">（还原为纯文本节点并 normalize 合并）。
   *  mark 只包裹单个文本节点片段（_highlightKeyword 逐文本节点替换），剥离安全。 */
  private _stripKeywordMarks() {
    const root = this.shadowRoot?.querySelector(".md-body-paged, .md-body") as HTMLElement | null;
    if (!root) return;
    root.querySelectorAll("mark.keyword-hit").forEach((m) => {
      m.replaceWith(document.createTextNode(m.textContent ?? ""));
    });
    root.normalize();
  }

  private _escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** 按 pages 的 line_start 把 md content 切成 N 段。
   *  line_start 是 1-indexed；返回 [{label, md, offset}, ...]，
   *  offset = 该分块第一行在全文中的 0-indexed 偏移（供分页渲染时校准行号）。 */
  private _splitByPages(
    content: string,
    pages: PageMarker[],
  ): Array<{ label: string; md: string; offset: number }> {
    const lines = content.split("\n");
    const chunks: Array<{ label: string; md: string; offset: number }> = [];
    for (let i = 0; i < pages.length; i++) {
      const start = pages[i].line_start - 1;  // 转 0-indexed
      const end = i + 1 < pages.length ? pages[i + 1].line_start - 1 : lines.length;
      const md = lines.slice(Math.max(0, start), Math.max(0, end)).join("\n");
      chunks.push({ label: pages[i].label, md, offset: start });
    }
    return chunks;
  }

  render() {
    ensureMdConfigured();
    if (!this.content) {
      return html`<div class="empty">无内容</div>`;
    }
    // 分页模式：每段 = 一张卡片
    if (this.pages && this.pages.length > 0) {
      const chunks = this._splitByPages(this.content, this.pages);
      return html`
        <div class="md-body md-body-paged">
          <div class="copy-bar-top">${this._renderCopyBtn()}</div>
          ${chunks.map((c) => {
            // 在调 marked.parse 前先设偏移，renderer 把分块内行号加上 offset 得绝对行号
            currentOffset = c.offset;
            const chunkHtml = sanitizeHtml(marked.parse(c.md, { async: false }) as string);
            return html`
              <section class="page-card">
                <header class="page-card-header">${c.label}</header>
                <div .innerHTML=${chunkHtml}></div>
              </section>
            `;
          })}
        </div>
        <div class="scroll-jump-anchor">${renderScrollJumpFabs(this._scrollJump)}</div>
        ${this._viewerSrc ? html`<image-viewer .src=${this._viewerSrc} @close=${() => this._viewerSrc = ""}></image-viewer>` : null}
      `;
    }
    // 回归：单块渲染
    // 必须重置 currentOffset：分页模式（PDF/PPTX/XLSX）会在每个 chunk 渲染前
    // 把 currentOffset 设成 chunk 起始偏移，渲染完不会清零。若上一次是分页文档，
    // 这里不重置会让 lineOf 把单块文档的每个 data-source-line 都加上残留偏移，
    // 导致 _locateAndHighlight 用正确的 line 找不到匹配块（dsl 全部偏大），
    // 表现为「先点 PDF 再点 docx/md，预览定位失效」。
    currentOffset = 0;
    const raw = sanitizeHtml(marked.parse(this.content, { async: false }) as string);
    return html`
      <div class="md-body">
        <div class="copy-bar-top">${this._renderCopyBtn()}</div>
        <div .innerHTML=${raw}></div>
      </div>
      <div class="scroll-jump-anchor">${renderScrollJumpFabs(this._scrollJump)}</div>
      ${this._viewerSrc ? html`<image-viewer
        .src=${this._viewerSrc}
        @close=${() => this._viewerSrc = ""}></image-viewer>` : null}
    `;
  }

  private _renderCopyBtn() {
    return html`<button class="doc-copy" @click=${this._copyAll}>
      ${this._copied
        ? "✓ 已复制"
        : html`<doclens-icon name="copy" style="font-size:14px"></doclens-icon><span class="btn-label">复制全文</span>`}
    </button>`;
  }

  private _copyAll = () => {
    navigator.clipboard.writeText(this.content).then(() => {
      this._copied = true;
      setTimeout(() => { this._copied = false; }, 1500);
    }).catch(() => {});
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "md-viewer": MdViewer;
  }
}
