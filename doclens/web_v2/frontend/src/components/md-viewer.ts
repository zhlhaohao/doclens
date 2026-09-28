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
import { bustRawImages } from "./image-viewer";
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

/** 每行起始偏移的前缀表（lineStarts[n] = 第 n+1 行在 currentSrc 中的起始偏移）。
 *  preprocess 时随 currentSrc 一起 O(n) 构建；行计数从逐块
 *  slice(0, idx).match(/\n/g)（O(块数×全文长) 的二次方，万行文档 ~400ms）
 *  换成二分查找（对数复杂度）。 */
let lineStarts: number[] = [0];

function buildLineStarts(src: string): void {
  const starts = [0];
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10) starts.push(i + 1);
  }
  lineStarts = starts;
}

/** currentSrc 偏移 → 1-indexed 行号；二分找最后一个 ≤ idx 的行起始。 */
function lineAt(idx: number): number {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= idx) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** 在 currentSrc 中查找 raw 的起始位置，返回 1-indexed 行号（全文绝对） */
function lineOf(raw: string | undefined): number {
  if (!raw) return 0;
  const idx = currentSrc.indexOf(raw, cursor);
  if (idx === -1) {
    // 降级：从头查找（处理罕见的乱序情况）
    const idx0 = currentSrc.indexOf(raw);
    if (idx0 === -1) return 0;
    return lineAt(idx0) + currentOffset;
  }
  const line = lineAt(idx);
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
  /* table / hr 与 marked 默认 renderer 同构，仅注入 data-source-line 锚点。
   * 缺锚点的块（默认 renderer 输出）会从锚点序列中消失，导致 _blockSpan
   * 把其行跨度并入前一个锚块——高大表格下 topSourceLine 插值严重 overshoot
   * （预览↔编辑切换首行漂移）。html 块是原文透传，无法安全注入，保持无锚点。 */
  table(token: any) {
    const line = lineOf(token.raw);
    let cell = "";
    for (const headerCell of token.header) cell += (this as any).tablecell(headerCell);
    const header = (this as any).tablerow({ text: cell });
    let body = "";
    for (const row of token.rows) {
      cell = "";
      for (const rowCell of row) cell += (this as any).tablecell(rowCell);
      body += (this as any).tablerow({ text: cell });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return `<table data-source-line="${line}">\n<thead>\n${header}</thead>\n${body}</table>\n`;
  },
  hr(token: any) {
    const line = lineOf(token.raw);
    return `<hr data-source-line="${line}">\n`;
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
        buildLineStarts(src);
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

/** 匹配导航粗跳阈值（px）：目标距离超过此值时第一段用瞬跳（auto）粗定位，
 *  避免 smooth 全程滚动期间懒渲染页密集插入导致的高度持续塌变压垮收敛。 */
const MATCH_NAV_ROUGH_JUMP_PX = 50000;

/** 匹配导航的源文本索引：逐行跑与 _highlightKeyword 相同口径的正则
 *  （空格分词 + escape + join("|")，大小写不敏感），返回每个匹配起始所在的
 *  源行号（1-indexed，升序）。**源文本口径是导航真相源**——懒渲染文档
 *  未渲染页的匹配不存在于 DOM，DOM <mark> 只是视觉呈现。
 *  零宽命中防御性跳过（同 _highlightKeyword）。 */
export function buildMatchLines(content: string, keyword: string): number[] {
  const words = (keyword ?? "").split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0 || !content) return [];
  const re = new RegExp(
    words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "gi",
  );
  const lines: number[] = [];
  content.split("\n").forEach((line, i) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      lines.push(i + 1);
      if (m[0].length === 0) re.lastIndex++; // 防御零宽匹配死循环
    }
  });
  return lines;
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
      /* 正文字号基准：随 --md-font-scale 缩放（移动端 More 菜单字号控制）。
         标题 h1-h4 用 em 相对字号、inline code 0.9em、line-height 无单位，
         均基于此基准自动等比缩放；copy-btn 等按钮 chrome 用固定 token 不缩放。 */
      --md-font-scale: 1;
      font-size: calc(var(--cortex-fs-base) * var(--md-font-scale));
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
      font-size: calc(var(--cortex-fs-sm) * var(--md-font-scale));
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
      font-size: var(--cortex-fs-xs);
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
      font-size: calc(var(--cortex-fs-sm) * var(--md-font-scale));
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
      font-size: calc(var(--cortex-fs-sm) * var(--md-font-scale));
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
    /* 视口外块跳过 layout/paint——大文档（epub 14 万行 / 数万块）滚动
       性能关键。contain-intrinsic-size 的 auto 前缀让浏览器记住每块
       最后渲染的真实尺寸（重复滚动越来越准）；从未渲染过的远处块按
       500px 估高，锚点跳转到该类块存在一次性偏差（scrollToSourceLine
       的 rAF 二次校准吸收）。选择器覆盖单块（.md-body > div）与分页
       卡片（.page-card > div）两种 innerHTML 容器的直接块级子元素。 */
    .md-body > div > *,
    .page-card > div > * {
      content-visibility: auto;
      contain-intrinsic-size: auto 500px;
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
      font-size: var(--cortex-fs-sm);
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
    /* 匹配导航（keyword 非空时替代跳顶/跳底 FAB，2026-09-28 决议）：
       计数徽标 n/m + 上/下步进两钮，复用 .scroll-jump-anchor 的 sticky
       定位与 .scroll-jump-fab 外观；不受滚动距离门槛约束（出现 = 高亮激活）。 */
    .match-fabs {
      transform: translateY(-100%);  /* 同 .scroll-jump-fabs：锚点上移到锚点线之上 */
      padding-right: var(--cortex-space-1);
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--cortex-space-2);
      pointer-events: none;  /* 仅按钮可点，容器不拦截正文 */
    }
    .match-fabs .scroll-jump-fab {
      pointer-events: auto;
    }
    .match-fabs .match-count {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill);
      padding: 1px 8px;
      box-shadow: var(--cortex-shadow-md);
      white-space: nowrap;
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
  /** 正文字号缩放系数（1 = 默认）；经 --md-font-scale 乘进正文/代码块/表格/图注，
   *  标题等 em 相对字号自动跟随；按钮等 UI chrome 不缩放。 */
  @property({ attribute: "font-scale", type: Number }) fontScale = 1;
  /** 全屏图片查看 */
  @state() private _viewerSrc = "";
  /** 全文复制反馈 */
  @state() private _copied = false;
  /** 跳过 line/content 变化触发的命中行定位（preview-pane 模式切换做
   *  位置恢复期间置 true，避免定位打架） */
  @property({ type: Boolean }) suppressLocate = false;

  /** 悬浮跳转按钮（跳首行/跳尾行）：scroller = :host 自身 */
  private _scrollJump = new ScrollJumpController(this, { behavior: "smooth" });

  // ---------------------------------------------------------------- 匹配导航
  // keyword 非空（高亮条输入 / 父组件搜索词透传**两源等价**）时，右下角
  // 「跳顶/跳底」FAB 让位为「上一个/下一个匹配」（2026-09-28 决议）。
  // 索引走源文本口径（buildMatchLines）——懒渲染文档未渲染页的匹配不在
  // DOM，DOM <mark> 只是视觉呈现，不是导航真相源。
  /** 源文本匹配索引（keyword/content 变化时重建）：每项 = 匹配起始源行号（升序）。 */
  private _matchLines: number[] = [];
  /** 徽标当前序号（1-based，随导航/滚动派生更新；0 = 无匹配）。 */
  @state() private _matchIndex = 0;
  /** 最近一次导航目标（0-based；-1 = 无）——步进时吸收平滑滚动未到位的
   *  中间态（连点不丢步）；滚动落定后由 _updateMatchIndex 同步为视口实况。 */
  private _navIdx = -1;
  /** 最近一次导航落点元素（<mark> 或块）——**粘性锚**：仍在视口内时步进
   *  基准粘住导航目标（一行多匹配也能逐一推进；topSourceLine 的块内像素
   *  插值对块中部匹配会低报行号，纯视口推导会卡簇）；滚离视口或 DOM 重建
   *  （keyword/content 变化销毁旧 mark）自动失效，回退视口行号推导。 */
  private _navAnchor: HTMLElement | null = null;
  /** 徽标滚动更新 debounce（滚动停顿 120ms 后刷新）。 */
  private _badgeTimer: number | undefined;
  /** 终校准代数：新的导航使进行中的 settle 循环失效（连点竞争）。 */
  private _settleGen = 0;

  // ---------------------------------------------------------------- 分页懒渲染
  // 大文档（epub 14 万行）分页卡片不做全量 parse+insert——骨架先行，
  // 滚动接近（observer 提前量）才渲染该页内容；跳转/定位先展开目标页。
  /** _splitByPages 的缓存（content/pages 变化时重算，render 与 _renderPage 共用）。 */
  private _pagedChunks: Array<{ label: string; md: string; offset: number }> | null = null;
  /** 已渲染页的 index 集合（content/pages 变化时整体作废）。 */
  private _renderedPages = new Set<number>();
  private _pageObserver: IntersectionObserver | null = null;

  /** 页内容估高（骨架占位，渲染后移除）：行数 × 28px 粗估。 */
  private _estHeight(md: string): number {
    return Math.max(120, (md.split("\n").length) * 28);
  }

  private _pageCard(i: number): HTMLElement | null {
    return this.shadowRoot?.querySelector(`.page-card[data-page-index="${i}"]`) ?? null;
  }

  /** 渲染第 i 页内容（幂等）：parse + sanitize + 塞入骨架，并跑该页的后处理。 */
  private _renderPage(i: number): void {
    if (!this._pagedChunks || this._renderedPages.has(i)) return;
    const c = this._pagedChunks[i];
    const holder = this._pageCard(i)?.querySelector<HTMLElement>(".page-content");
    if (!c || !holder) return;
    currentOffset = c.offset;
    holder.innerHTML = sanitizeHtml(marked.parse(c.md, { async: false }) as string);
    holder.removeAttribute("style"); // 移除估高占位
    this._renderedPages.add(i);
    this._resolveImageUrls(holder);
    this._applyIconSizing(holder);
    this._bindImageClicks(holder);
    this._bindCopyButtons(holder);
    if (this.keyword.trim()) this._highlightKeyword(holder);
  }

  /** 确保源行 line 所在页已渲染（跳转/定位入口调用，未渲染则同步展开）。 */
  private _ensurePageForLine(line: number): void {
    if (!this.pages?.length) return;
    let idx = 0;
    for (let i = 0; i < this.pages.length; i++) {
      if (this.pages[i].line_start <= line) idx = i;
      else break;
    }
    this._renderPage(idx);
  }

  /** content/pages 变化后（骨架已 commit）启动懒渲染：首页立即渲染 + observer 观察其余页。 */
  private _startLazyPages(): void {
    this._pageObserver?.disconnect();
    this._pageObserver = null;
    const chunks = this._pagedChunks;
    if (!chunks?.length) return;
    // Lit 按位置复用卡片 DOM：清掉旧文档残留内容并恢复估高占位
    // （_renderedPages 已在 willUpdate 清空，此处重置 DOM 与其一致）
    chunks.forEach((c, i) => {
      const holder = this._pageCard(i)?.querySelector<HTMLElement>(".page-content");
      if (holder) {
        holder.innerHTML = "";
        holder.setAttribute("style", `min-height:${this._estHeight(c.md)}px`);
      }
    });
    this._renderPage(0);
    if (typeof IntersectionObserver === "undefined") return; // 测试/老环境兜底：只渲染首页
    this._pageObserver = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const card = (e.target as HTMLElement).closest(".page-card");
          const idx = Number(card?.getAttribute("data-page-index"));
          this._renderPage(idx);
          this._pageObserver?.unobserve(e.target);
        }
      },
      { root: this, rootMargin: "2000px 0px" },
    );
    chunks.forEach((_, i) => {
      if (!this._renderedPages.has(i)) {
        const holder = this._pageCard(i)?.querySelector(".page-content");
        if (holder) this._pageObserver!.observe(holder);
      }
    });
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("cortex:image-rotated", this._onImageRotated);
    // :host 自身是滚动容器：直接挂 scroll 监听（匹配导航徽标派生更新）
    this.addEventListener("scroll", this._onBadgeScroll, { passive: true });
  }

  disconnectedCallback() {
    window.removeEventListener("cortex:image-rotated", this._onImageRotated);
    this.removeEventListener("scroll", this._onBadgeScroll);
    window.clearTimeout(this._badgeTimer);
    this._badgeTimer = undefined;
    this._pageObserver?.disconnect();
    this._pageObserver = null;
    super.disconnectedCallback();
  }

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("content") || changed.has("pages")) {
      // 分页文档：重算分块缓存；已渲染页作废（render 后由 _startLazyPages 重新启动）
      this._pagedChunks = this.pages?.length
        ? this._splitByPages(this.content, this.pages)
        : null;
      this._renderedPages.clear();
    }
  }

  /** 图片旋转落盘（判向自动 ADR-0017 / 预览期手动 ADR-0029）：
   *  刷新正文里指向该图的原图 <img>，防旧方向缓存。 */
  private _onImageRotated = (e: Event) => {
    const path = (e as CustomEvent).detail?.path as string | undefined;
    if (path) bustRawImages(this.shadowRoot, path);
  };

  firstUpdated() {
    this._scrollJump.attach(this);
  }

  updated(changedProps: Map<string, unknown>) {
    super.updated?.(changedProps);
    if (changedProps.has("fontScale")) {
      this.style.setProperty("--md-font-scale", String(this.fontScale || 1));
    }
    // content/keyword 变化都需重新高亮（content 变化时 render 重建 .md-body，
    // 旧 <mark> 随之销毁；仅 keyword 变化时 .innerHTML 绑定同值跳过、DOM 不重建，
    // 需先剥掉旧 <mark>——否则残留旧高亮且 TreeWalker 跳过 MARK 子树会漏判）
    if (changedProps.has("content") || changedProps.has("keyword")) {
      // 匹配导航索引重建（源文本口径，与 DOM 无关；先于徽标派生更新）
      this._matchLines = buildMatchLines(this.content, this.keyword);
      this._navIdx = -1;
      this._navAnchor = null; // 旧 mark 已随高亮重建销毁
      if (changedProps.has("keyword") && !changedProps.has("content")) {
        this._stripKeywordMarks();
      }
      this._highlightKeyword();
      this._updateMatchIndex();
    }
    if (
      changedProps.has("content") ||
      changedProps.has("pages") ||
      changedProps.has("docPath")
    ) {
      if (changedProps.has("content") || changedProps.has("pages")) {
        // 骨架已 commit：启动懒渲染（首页立即渲染，其余页挂 observer）
        this._startLazyPages();
      }
      // docPath 单独变化（content 未变）：对已渲染页补图片 URL 重写与绑定
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
   *  在 _applyIconSizing 之前执行：重写后的 URL 不带 dw，自然走 naturalWidth 兜底。
   *  root 参数供懒渲染对新页根单独执行（缺省 = 全组件树）。 */
  private _resolveImageUrls(root: ParentNode = this.shadowRoot!) {
    if (!this.docPath) return;
    const imgs = root.querySelectorAll<HTMLImageElement>("img");
    imgs.forEach((img) => {
      const raw = img.getAttribute("src") ?? "";
      const url = resolveDocImageUrl(this.docPath, raw);
      if (url) img.src = url;
    });
  }

  /** 为渲染后的 img 绑定点击 → 全屏查看（marked innerHTML 的图片无法用 @click 模板绑定） */
  private _bindImageClicks(root: ParentNode = this.shadowRoot!) {
    const imgs = root.querySelectorAll<HTMLImageElement>("img");
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
  private _bindCopyButtons(root: ParentNode = this.shadowRoot!) {
    const btns = root.querySelectorAll<HTMLButtonElement>(".copy-btn");
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
  private _applyIconSizing(root: ParentNode = this.shadowRoot!) {
    const imgs = root.querySelectorAll("img");
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

  /** 收集全部锚点块（DOM 顺序；块级元素 renderer 注入 data-source-line）。 */
  private _anchorBlocks(): HTMLElement[] {
    return Array.from(
      this.shadowRoot!.querySelectorAll<HTMLElement>("[data-source-line]"),
    );
  }

  /** 找 data-source-line <= line 的最后一个块 = 该源行所在的 markdown 块 */
  private _findBlockAtLine(line: number): HTMLElement | null {
    // 懒渲染：目标行所在页可能尚未渲染，先同步展开（幂等）再查块
    this._ensurePageForLine(line);
    const blocks = this._anchorBlocks();
    let best: HTMLElement | null = null;
    for (const el of blocks) {
      const ls = Number(el.getAttribute("data-source-line"));
      if (ls <= line && (!best || ls > Number(best.getAttribute("data-source-line")))) {
        best = el;
      }
    }
    return best;
  }

  /** 块覆盖的源行跨度 = 该块起始行 → 下一块起始行（末块 → 文档末行 +1）。
   *  行级锚点插值的分母：块内像素位置按此跨度换算源行偏移。 */
  private _blockSpan(el: HTMLElement, blocks: HTMLElement[]): number {
    const start = Number(el.getAttribute("data-source-line")) || 1;
    const idx = blocks.indexOf(el);
    const next =
      idx >= 0 && idx + 1 < blocks.length
        ? Number(blocks[idx + 1].getAttribute("data-source-line")) || start
        : this.content.split("\n").length + 1;
    return Math.max(1, next - start);
  }

  /** 视口顶部所在的源行号（1-indexed，行级精度）；无块时返回 1。
   *  视口顶侵入块内部时按像素比例插值（折行/图片按视觉比例），否则为块起始行。
   *  供 preview-pane 在预览→编辑切换时捕获位置锚点，与 md-editor.topLine() 同精度。 */
  topSourceLine(): number {
    const blocks = this._anchorBlocks();
    if (blocks.length === 0) return 1;
    const hostRect = this.getBoundingClientRect();
    for (const el of blocks) {
      const elRect = el.getBoundingClientRect();
      if (elRect.bottom > hostRect.top + 1) {
        const start = Number(el.getAttribute("data-source-line")) || 1;
        if (elRect.height <= 0) return start;
        const pxInto = Math.max(0, hostRect.top - elRect.top);
        if (pxInto <= 0) return start;
        const span = this._blockSpan(el, blocks);
        const offset = Math.min(span - 1, Math.round((pxInto / elRect.height) * span));
        return start + offset;
      }
    }
    const last = blocks[blocks.length - 1];
    return Number(last.getAttribute("data-source-line")) || 1;
  }

  /** 滚动使源行 line 贴顶（默认瞬跳，行级精度：块内按跨度比例像素偏移）。
   *  供 preview-pane 在编辑→预览切换时恢复位置锚点，与 md-editor.scrollToLine()
   *  同精度；不触发闪烁动画。 */
  scrollToSourceLine(line: number, behavior: ScrollBehavior = "auto") {
    const scrollOnce = () => {
      const blocks = this._anchorBlocks();
      const target = this._findBlockAtLine(line);
      if (!target) return;
      // 仅滚动 md-viewer 自身（:host 是 overflow:auto 的滚动容器）。
      // 不能用 target.scrollIntoView —— 它会沿滚动链传播到 window，
      // 把外层 detail-overlay 顶部的 focus-header（返回键）推出视口。
      const hostRect = this.getBoundingClientRect();
      if (hostRect.height <= 0) return;
      const targetRect = target.getBoundingClientRect();
      // 块内行偏移 → 像素偏移（与 topSourceLine 的插值互逆，保证切换往返一致）
      const start = Number(target.getAttribute("data-source-line")) || 1;
      const span = this._blockSpan(target, blocks);
      const offset = Math.max(0, Math.min(span - 1, line - start));
      const pxInto = targetRect.height > 0 ? (offset / span) * targetRect.height : 0;
      this.scrollTo({
        top: targetRect.top + pxInto - hostRect.top + this.scrollTop,
        behavior,
      });
    };
    scrollOnce();
    // content-visibility：目标块首次进入视口才真实渲染，估高（500px）与实高
    // 有偏差；两帧后（渲染完成、尺寸为实值）再校准一次，吸收该偏差。
    requestAnimationFrame(() => requestAnimationFrame(scrollOnce));
  }

  /** 组件渲染树内的 Selection（Chromium 提供 ShadowRoot.getSelection，
   *  标准 TS DOM lib 未收录——运行时探测）；回退 window 级（open shadow
   *  的选区节点同样暴露在 document selection 中）。 */
  private _shadowSelection(): Selection | null {
    const shadowSel = (this.shadowRoot as unknown as {
      getSelection?: () => Selection | null;
    })?.getSelection?.();
    return shadowSel ?? window.getSelection();
  }

  /** 块覆盖的源行闭区间（from = 锚行，to = 下一锚块起始行-1 / 文档末行）。 */
  private _blockSourceLines(el: HTMLElement): { from: number; to: number } {
    const from = Number(el.getAttribute("data-source-line")) || 1;
    const blocks = this._anchorBlocks();
    const idx = blocks.indexOf(el);
    const next =
      idx >= 0 && idx + 1 < blocks.length
        ? Number(blocks[idx + 1].getAttribute("data-source-line")) || from
        : this.content.split("\n").length + 1;
    return { from, to: Math.max(from, next - 1) };
  }

  /** 行号（1-indexed）行首在 content 中的绝对字符偏移。 */
  private _lineStartOffset(n: number): number {
    const lines = this.content.split("\n");
    let off = 0;
    for (let i = 0; i < Math.min(n - 1, lines.length); i++) off += lines[i].length + 1;
    return off;
  }

  /** 块内渲染文本总长（TreeWalker 累计文本节点；含 copy-btn 文本，
   *  与捕获方向的 Range.toString 对称）。 */
  private _domTextLength(el: HTMLElement): number {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let len = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) len += (n as Text).length;
    return len;
  }

  /** 块渲染文本第 k 字符的 DOM 位置（(node, offset)；超界钳块尾文本节点）。 */
  private _domLocate(el: HTMLElement, k: number): { node: Node; offset: number } | null {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let remain = Math.max(0, k);
    let last: Text | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n as Text;
      if (remain <= t.length) return { node: t, offset: remain };
      remain -= t.length;
      last = t;
    }
    return last ? { node: last, offset: last.length } : null;
  }

  /** 块内源文本（覆盖行 join）；同时返回块首绝对偏移。 */
  private _blockSourceText(el: HTMLElement): { abs: number; text: string } {
    const { from, to } = this._blockSourceLines(el);
    return {
      abs: this._lineStartOffset(from),
      text: this.content.split("\n").slice(from - 1, to).join("\n"),
    };
  }

  /** 当前 DOM 选区 → 源文本字符偏移（与 md-editor 的 selectionStart/End
   *  同一坐标系，字符级精度——修复行级映射的「选区放大」：选一个词切到
   *  编辑器不再变成整块几十行）。块内偏移按 渲染文本/源文本 长度比例
   *  映射，吸收行内语法（**、`、链接渲染后消失）的长度差。选区不在
   *  渲染树内或已 collapse 返回 null。 */
  selectionSourceOffsets(): { start: number; end: number } | null {
    const sel = this._shadowSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    const root = this.shadowRoot!;
    const blockOf = (node: Node | null): HTMLElement | null => {
      for (let n: Node | null = node; n && n !== root; n = n.parentNode) {
        const el = n as Element;
        if (el.getAttribute?.("data-source-line")) return el as HTMLElement;
      }
      return null; // 走到 shadowRoot 边界仍未命中锚块
    };
    const a = blockOf(range.startContainer);
    const b = blockOf(range.endContainer);
    if (!a || !b) return null;
    const toSrc = (block: HTMLElement, container: Node, off: number): number => {
      const { abs, text } = this._blockSourceText(block);
      let k = 0;
      try {
        const r = document.createRange();
        r.setStart(block, 0);
        r.setEnd(container, off);
        k = r.toString().length;
      } catch {
        return abs; // 边界异常兜底：块首
      }
      const lDom = this._domTextLength(block);
      if (lDom <= 0 || text.length <= 0) return abs;
      const kSrc = Math.min(text.length, Math.round((k / lDom) * text.length));
      return abs + kSrc;
    };
    const s = toSrc(a, range.startContainer, range.startOffset);
    const e = toSrc(b, range.endContainer, range.endOffset);
    return s <= e ? { start: s, end: e } : { start: e, end: s };
  }

  /** 在视口中央选 1 个字符（WebView 模式的编辑切换视野锚点兜底）。
   *
   *  背景：WebView 内核对 textarea 行高取整与镜像 div 不一致，镜像
   *  测量的 scrollTop 锚点有累积偏差。此方法在切编辑前于视野中央
   *  造一个单字符选区，走既有选区保持链路（selectionSourceOffsets →
   *  md-editor.selectOffsets + focus 原生 reveal-selection）——滚动
   *  执行者是浏览器自己（同引擎坐标），免疫测量误差。
   *  视野中央所在块的文本中部定位；失败（无块/无文本）静默返回 false。 */
  selectCharAtViewportCenter(): boolean {
    const blocks = this._anchorBlocks();
    if (blocks.length === 0) return false;
    const hostRect = this.getBoundingClientRect();
    if (hostRect.height <= 0) return false;
    const cy = hostRect.top + hostRect.height / 2;
    let target: HTMLElement | null = null;
    for (const el of blocks) {
      if (el.getBoundingClientRect().bottom > cy) {
        target = el;
        break;
      }
    }
    target ??= blocks[blocks.length - 1]; // 中央在全块之上（文首）的防御
    const lDom = this._domTextLength(target);
    if (lDom <= 0) return false;
    const pos = this._domLocate(target, Math.min(Math.floor(lDom / 2), lDom - 1));
    if (!pos) return false;
    const node = pos.node as Text;
    if (node.length === 0) return false;
    const sel = this._shadowSelection();
    if (!sel) return false;
    try {
      const range = document.createRange();
      // 单字符选区（offset 钳到节点末字符内）
      const at = Math.min(pos.offset, node.length - 1);
      range.setStart(node, at);
      range.setEnd(node, at + 1);
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  }

  /** 源文本字符偏移 → DOM 选区（比例映射逆运算，与
   *  selectionSourceOffsets 尽力互逆；误差字符级）。 */
  selectSourceOffsets(start: number, end: number) {
    const text = this.content;
    const lineOf = (x: number): number =>
      (text.slice(0, Math.min(x, text.length)).match(/\n/g)?.length ?? 0) + 1;
    const locate = (x: number): { node: Node; offset: number } | null => {
      const block = this._findBlockAtLine(lineOf(x));
      if (!block) return null;
      const { abs, text: srcText } = this._blockSourceText(block);
      const lDom = this._domTextLength(block);
      if (lDom <= 0 || srcText.length <= 0) return null;
      const k = Math.max(0, Math.min(srcText.length, x - abs));
      return this._domLocate(
        block,
        Math.min(lDom, Math.round((k / srcText.length) * lDom)),
      );
    };
    const s = locate(Math.min(start, end));
    const e = locate(Math.max(start, end));
    if (!s || !e) return;
    const sel = this._shadowSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStart(s.node, s.offset);
    r.setEnd(e.node, e.offset);
    sel.removeAllRanges();
    sel.addRange(r);
  }

  /** 视口是否已滚到底部。供 preview-pane 的「底部锚点」语义：
   *  目标行下方内容不足一屏时贴顶物理上不可能，改为对齐文档尾部视野。
   *  无需滚动（内容不足一屏）时不算贴底——行号锚点本来就可达。 */
  isAtBottom(): boolean {
    if (this.scrollHeight <= this.clientHeight) return false;
    return this.scrollTop + this.clientHeight >= this.scrollHeight - 8;
  }

  /** 滚到底部。配合 isAtBottom 实现预览↔编辑的底部锚点互通。 */
  scrollToBottom(behavior: ScrollBehavior = "auto") {
    this.scrollTo({ top: this.scrollHeight - this.clientHeight, behavior });
  }

  /** 滚动到第一个关键词命中（源文本口径的第一个匹配），并闪烁定位。
   *  供 preview-pane 的高亮输入条在用户输入后自动定位。无命中时静默返回。 */
  scrollToFirstKeywordHit(behavior: ScrollBehavior = "smooth") {
    if (this._matchLines.length === 0) return;
    this._gotoMatch(0, behavior);
  }

  // ---------------------------------------------------------------- 匹配导航
  // （2026-09-28 决议）keyword 非空时右下角 FAB = 上一个/下一个匹配：
  // 循环、视口位置起算（无独立索引状态）、徽标 n/m；懒渲染文档先同步
  // 展开目标页再定位。详见 CONTEXT.md「匹配导航」。

  /** 滚动监听：滚动停顿 120ms 后按视口位置派生更新徽标（与导航基准同源）。 */
  private _onBadgeScroll = () => {
    if (!this.keyword.trim() || this._matchLines.length === 0) return;
    window.clearTimeout(this._badgeTimer);
    this._badgeTimer = window.setTimeout(() => {
      this._badgeTimer = undefined;
      this._updateMatchIndex();
    }, 120);
  };

  /** 粘性锚是否有效（存在、已挂载、在视口内）。 */
  private _anchorVisible(): boolean {
    const a = this._navAnchor;
    if (!a || !a.isConnected) return false;
    const hostRect = this.getBoundingClientRect();
    if (hostRect.height <= 0) return false;
    const r = a.getBoundingClientRect();
    return r.top < hostRect.bottom && r.bottom > hostRect.top;
  }

  /** 视口位置 → 当前匹配序号（0-based；-1 = 视口在首匹配之前）：
   *  粘性锚在视口内 → 直接采用导航目标；否则行号 <= 视口顶部源行的
   *  最后一个匹配（"正站着或刚越过"的那个）。 */
  private _currentMatchIdx(): number {
    if (this._anchorVisible()) return this._navIdx;
    const top = this.topSourceLine();
    let cur = -1;
    for (let i = 0; i < this._matchLines.length; i++) {
      if (this._matchLines[i] <= top) cur = i;
      else break;
    }
    return cur;
  }

  /** 徽标与导航基准的统一刷新点：粘性锚有效 → 徽标钉在导航目标；
   *  否则视口实况派生 n 并同步 _navIdx（清掉未到位/已滚离的导航目标）。 */
  private _updateMatchIndex(): void {
    const total = this._matchLines.length;
    if (total === 0) {
      this._matchIndex = 0;
      this._navIdx = -1;
      this._navAnchor = null;
      return;
    }
    if (this._anchorVisible()) {
      this._matchIndex = this._navIdx + 1;
      return;
    }
    this._navAnchor = null;
    const cur = this._currentMatchIdx();
    this._matchIndex = Math.max(1, Math.min(total, cur + 1));
    this._navIdx = cur;
  }

  /** 匹配导航：步进到上一个/下一个关键词命中（循环）。dir=1 下一个，
   *  -1 上一个。无匹配静默返回（零匹配时按钮置灰，此为兜底）。
   *  起算 = 视口位置派生的当前匹配；平滑滚动未到位时以最近导航目标
   *  为当前（连点步进不丢步）。 */
  stepKeywordHit(dir: 1 | -1): void {
    const total = this._matchLines.length;
    if (total === 0) return;
    const cur = this._currentMatchIdx();
    const base =
      this._navIdx >= 0
        ? dir > 0
          ? Math.max(cur, this._navIdx)
          : Math.min(cur, this._navIdx)
        : cur;
    const idx =
      dir > 0 ? (base + 1) % total : base <= 0 ? total - 1 : base - 1;
    this._gotoMatch(idx);
  }

  /** 定位到第 idx 个匹配（0-based）：懒渲染先展开目标页；滚动使匹配贴
   *  视口顶（与 TOC / 命中行定位 / 锚点恢复全应用统一的 top 语义），
   *  highlight-flash 闪 <mark> 本身（一行多匹配时连点可见闪烁移动；
   *  源文本命中但 DOM 无 mark（alt 文本等）回退闪块）。 */
  private _gotoMatch(idx: number, behavior: ScrollBehavior = "smooth") {
    const line = this._matchLines[idx];
    if (line === undefined) return;
    this._matchIndex = idx + 1; // 徽标立即指向目的地（滚动动画中即更新）
    this._navIdx = idx;
    const block = this._findBlockAtLine(line); // 内部先 _ensurePageForLine 同步展开
    if (!block) return;
    const mark = this._markForMatch(block, idx);
    const target = mark ?? block;
    this._navAnchor = target; // 粘性锚：视口内时步进基准钉在落点
    const gen = ++this._settleGen; // 使进行中的旧 settle 循环失效
    const scrollOnce = (b: ScrollBehavior = behavior): number => {
      // 仅滚动 md-viewer 自身（:host 是滚动容器），不用 scrollIntoView——
      // 会沿滚动链传播把外层容器顶出去
      const hostRect = this.getBoundingClientRect();
      if (hostRect.height <= 0) return 0;
      const tRect = target.getBoundingClientRect();
      const top = tRect.top - hostRect.top + this.scrollTop;
      const delta = Math.abs(top - this.scrollTop);
      this.scrollTo({ top, behavior: b });
      return delta; // 修正量（收敛循环的判定依据）
    };
    const flash = () => {
      target.classList.remove("highlight-flash"); // 重置以便动画重放
      void target.offsetWidth;                    // 强制 reflow，让 animation 重新触发
      target.classList.add("highlight-flash");
    };
    const rough = scrollOnce();
    // 超大跨度（目标常在从未渲染的懒渲染区）：全程 smooth 滚动需途经数十
    // 页，页密集插入使高度持续塌变、收敛窗口压不住——第一段改瞬跳粗定位
    //（估高位置），落定后收敛循环再精调
    if (rough > MATCH_NAV_ROUGH_JUMP_PX) {
      scrollOnce("auto");
    }
    // content-visibility / 新渲染页估高偏差：两帧后（尺寸为实值）再校准一次
    //（同 scrollToSourceLine 的既有模式）
    requestAnimationFrame(() => requestAnimationFrame(() => { scrollOnce(); }));
    flash(); // 即时反馈（滚动动画中即开始闪）
    // 滚动落定后的终校准（远距离跳转两帧校准仍会漂移，见 _settleTo）
    this._settleTo(gen, scrollOnce, flash);
  }

  /** 等 scrollTop 稳定（连续 5 帧不动）后校准，**循环至收敛**再重放闪烁。
   *  远距离跳转：途经懒渲染页陆续插入 + content-visibility 估高塌变，
   *  单轮校准本身又引起新滚动、滚动又触发页插入——高度持续变，一次性
   *  校准不够（症状：连点/大跨度跳转后页面"看似无高亮"，回退再进——
   *  那时页已渲染、高度稳定——才正确）。收敛判据 = 稳定后的修正量
   *  ≤1px（此时落点已精确）。gen 不匹配（被更新的导航取代）立即退出；
   *  300 帧（~5s）超时兜底。 */
  private _settleTo(gen: number, scrollOnce: () => number, flash: () => void) {
    let last = -1;
    let stable = 0;
    let frames = 0;
    const check = () => {
      if (gen !== this._settleGen || !this.isConnected) return;
      if (frames++ > 300) {
        flash();
        return;
      }
      const cur = this.scrollTop;
      if (Math.abs(cur - last) <= 1) {
        stable++;
        if (stable >= 5) {
          const delta = scrollOnce();
          if (delta <= 1) {
            flash(); // 落点已精确，重放闪烁
            return;
          }
          stable = 0; // 修正量大 → 引起新滚动/页插入，继续等下一轮稳定
        }
      } else {
        stable = 0;
      }
      last = cur;
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  /** 第 idx 个匹配在块内对应的 <mark>：块内第 k 个匹配 = 块内 DOM 序第
   *  k 个 mark（DOM 文本序 ≈ 块内源序）。块内序号 = idx 去掉块外前置匹配
   *  （行号 < 块起始行的都是块外）。失配（块内无 mark / 越界）返回 null
   *  → 调用方回退闪块。 */
  private _markForMatch(block: HTMLElement, idx: number): HTMLElement | null {
    const from = Number(block.getAttribute("data-source-line")) || 1;
    let before = 0;
    for (let i = 0; i < idx; i++) {
      if (this._matchLines[i] < from) before++;
    }
    const marks = block.querySelectorAll<HTMLElement>("mark.keyword-hit");
    return marks[idx - before] ?? null;
  }

  /** 滚动到源行所在块并闪烁定位（目录抽屉跳转用）。
   *  与 _locateAndHighlight 的差别只在入口：这是父组件主动触发的一次性跳转，
   *  不经过 line property。 */
  jumpToSourceLine(line: number, behavior: ScrollBehavior = "smooth") {
    const target = this._findBlockAtLine(line);
    if (!target) return;

    this.scrollToSourceLine(line, behavior);
    // 闪烁节点第一行所在的块（不再回退到 <mark.keyword-hit>：
    // 即便 target 不含 keyword——典型如 xlsx 的 sheet 标题，
    // keyword 命中在内部 table 单元格——闪烁位置始终锚定在节点起始处，
    // 让用户明确感知到「这里就是节点开头」）。
    target.classList.remove("highlight-flash");  // 重置以便动画重放
    void target.offsetWidth;                     // 强制 reflow，让 animation 重新触发
    target.classList.add("highlight-flash");
  }

  private _locateAndHighlight() {
    if (this.line === null || this.line === undefined) return;
    this.jumpToSourceLine(this.line, "smooth");
  }

  /** 在渲染后的正文里高亮搜索关键字（按空格分词，每个命中词包裹 <mark>）。
   *  使用 TreeWalker 遍历文本节点，避免对 HTML 结构做字符串替换引入 XSS。
   *  scope 参数供懒渲染对新渲染页单独执行（缺省 = 正文容器全量）。 */
  private _highlightKeyword(scope?: ParentNode) {
    const root = (scope ?? this.shadowRoot?.querySelector(".md-body-paged, .md-body")) as HTMLElement | null;
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
        // re 带 g 标志：test 会推进 lastIndex 且跨节点残留——上一节点
        // 命中后，本节点段首的目标词会被跳过而整节点漏高亮（实测：
        // 「城主松平广忠…」ACCEPT 后，「广忠大怒…」被 REJECT）。每次重置。
        re.lastIndex = 0;
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
    // 分页模式：每段 = 一张卡片（懒渲染——骨架先行，滚动接近才 parse+insert 该页）
    if (this.pages && this.pages.length > 0) {
      const chunks = this._pagedChunks ?? [];
      return html`
        <div class="md-body md-body-paged">
          <div class="copy-bar-top">${this._renderCopyBtn()}</div>
          ${chunks.map((c, i) => html`
            <section class="page-card" data-page-index="${i}">
              <header class="page-card-header">${c.label}</header>
              <div
                class="page-content"
                style="min-height:${this._estHeight(c.md)}px"
              ></div>
            </section>
          `)}
        </div>
        ${this._renderFloatNav()}
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
      ${this._renderFloatNav()}
      ${this._viewerSrc ? html`<image-viewer
        .src=${this._viewerSrc}
        @close=${() => this._viewerSrc = ""}></image-viewer>` : null}
    `;
  }

  /** 右下角悬浮导航：keyword 非空 → 匹配导航（上一个/下一个 + n/m 徽标），
   *  替代跳顶/跳底 FAB（2026-09-28 决议；不受滚动距离门槛约束——出现 =
   *  高亮激活）；keyword 空 → 原跳顶/跳底 FAB（含 300px 显隐门槛）。 */
  private _renderFloatNav() {
    if (this.keyword.trim()) {
      const total = this._matchLines.length;
      const none = total === 0;
      return html`
        <div class="scroll-jump-anchor">
          <div class="match-fabs" role="group" aria-label="匹配导航">
            <span class="match-count">${none ? "0/0" : `${this._matchIndex}/${total}`}</span>
            <button
              class="scroll-jump-fab"
              type="button"
              aria-label="上一个匹配"
              title="上一个匹配"
              ?disabled=${none}
              @click=${() => this.stepKeywordHit(-1)}
            ><doclens-icon name="chevron-up"></doclens-icon></button>
            <button
              class="scroll-jump-fab"
              type="button"
              aria-label="下一个匹配"
              title="下一个匹配"
              ?disabled=${none}
              @click=${() => this.stepKeywordHit(1)}
            ><doclens-icon name="chevron-down"></doclens-icon></button>
          </div>
        </div>
      `;
    }
    return html`
      <div class="scroll-jump-anchor">${renderScrollJumpFabs(this._scrollJump)}</div>
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
