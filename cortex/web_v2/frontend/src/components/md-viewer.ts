import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { marked } from "marked";
import type { PageMarker } from "../api/preview";

/**
 * 块级元素 renderer —— 给每个块注入 data-source-line（1-indexed）
 *
 * marked v18 的 token 对象没有 `line` 字段，因此采用 preprocess hook
 * 缓存当前 markdown 源文本，renderer 内通过 token.raw 在源文本中的
 * 顺序位置反推起始行号（cursor 递增保证多次调用不回退匹配）。
 */
let currentSrc = "";
let cursor = 0;

/** 在 currentSrc 中查找 raw 的起始位置，返回 1-indexed 行号 */
function lineOf(raw: string | undefined): number {
  if (!raw) return 0;
  const idx = currentSrc.indexOf(raw, cursor);
  if (idx === -1) {
    // 降级：从头查找（处理罕见的乱序情况）
    const idx0 = currentSrc.indexOf(raw);
    if (idx0 === -1) return 0;
    return (currentSrc.slice(0, idx0).match(/\n/g) ?? []).length + 1;
  }
  const line = (currentSrc.slice(0, idx).match(/\n/g) ?? []).length + 1;
  cursor = idx + raw.length;
  return line;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
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
    return `<pre data-source-line="${line}"><code${langAttr}>${escaped}</code></pre>\n`;
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
}

@customElement("md-viewer")
export class MdViewer extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 12px 16px;
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-base);
      line-height: 1.7;
      color: var(--cortex-text);
      overflow: auto;
      height: 100%;
    }
    :host h1, :host h2, :host h3 {
      margin: 1em 0 0.5em;
      line-height: 1.3;
    }
    :host h1 { font-size: 1.4em; }
    :host h2 { font-size: 1.2em; }
    :host h3 { font-size: 1.05em; }
    :host p { margin: 0.5em 0; }
    :host ul, :host ol { margin: 0.5em 0; padding-left: 1.5em; }
    :host li { margin: 0.2em 0; }
    :host pre {
      background: var(--cortex-surface-muted);
      padding: 8px 12px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    :host code {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    :host blockquote {
      border-left: 3px solid var(--cortex-border);
      padding-left: 12px;
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
      padding: 6px 12px;
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
    .empty {
      color: var(--cortex-text-subtle);
      text-align: center;
      padding: 24px;
    }
    /* 定位块的闪烁动画（"你滚到这里了"指示） */
    .highlight-flash {
      animation: highlight-flash 2s ease-out;
    }
    @keyframes highlight-flash {
      0% { background: rgba(254, 243, 199, 0.8); }
      100% { background: transparent; }
    }
    /* 搜索关键字命中高亮（持久黄底，类似浏览器 Ctrl+F） */
    :host mark.keyword-hit {
      background: #FEF3C7;
      color: inherit;
      padding: 0 2px;
      border-radius: 2px;
    }
    /* 分页卡片 */
    .page-card {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
      margin: 16px 8px;
      padding: 14px 20px;
    }
    .page-card-header {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      font-weight: 500;
      letter-spacing: 0.02em;
      padding-bottom: 8px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--cortex-border);
    }
    /* 卡片内部标题更紧凑 */
    .page-card h1, .page-card h2, .page-card h3 {
      margin-top: 0.5em;
    }
  `;

  @property() content = "";
  /** 1-indexed 目标行；用于滚动到命中块并闪烁定位 */
  @property({ type: Number }) line: number | null = null;
  /** 搜索关键字（按空格分词，在渲染后的正文里高亮所有命中词） */
  @property() keyword = "";
  /** 分页标记（PDF/PPTX/XLSX）；为 null 时走单块渲染 */
  @property({ attribute: false }) pages: PageMarker[] | null = null;

  updated(changedProps: Map<string, unknown>) {
    super.updated?.(changedProps);
    // content/keyword 变化都需重新高亮（render 会重建 .md-body，旧 <mark> 随之销毁）
    if (changedProps.has("content") || changedProps.has("keyword")) {
      this._highlightKeyword();
    }
    if (changedProps.has("line") || changedProps.has("content")) {
      this._locateAndHighlight();
    }
  }

  private _locateAndHighlight() {
    if (this.line === null || this.line === undefined) return;
    const blocks = Array.from(
      this.shadowRoot!.querySelectorAll<HTMLElement>("[data-source-line]")
    );
    if (blocks.length === 0) return;

    // 找 data-source-line <= this.line 的最后一个块
    const target = blocks.reduce<HTMLElement | null>((best, el) => {
      const ls = Number(el.getAttribute("data-source-line"));
      if (ls <= this.line! && (!best || ls > Number(best.getAttribute("data-source-line")))) {
        return el;
      }
      return best;
    }, null);
    if (!target) return;

    // 仅滚动 md-viewer 自身（:host 是 overflow:auto 的滚动容器）。
    // 不能用 target.scrollIntoView —— 它会沿滚动链传播到 window，
    // 把外层 detail-overlay 顶部的 focus-header（返回键）推出视口。
    const hostRect = this.getBoundingClientRect();
    if (hostRect.height > 0) {
      const targetRect = target.getBoundingClientRect();
      const targetContentTop = targetRect.top - hostRect.top + this.scrollTop;
      this.scrollTo({
        top: targetContentTop - hostRect.height / 2 + targetRect.height / 2,
        behavior: "smooth",
      });
    }
    target.classList.remove("highlight-flash");  // 重置以便动画重放
    // 强制 reflow，让 animation 重新触发
    void target.offsetWidth;
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

  private _escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /** 按 pages 的 line_start 把 md content 切成 N 段。
   *  line_start 是 1-indexed；返回 [{label, md}, ...]。 */
  private _splitByPages(
    content: string,
    pages: PageMarker[],
  ): Array<{ label: string; md: string }> {
    const lines = content.split("\n");
    const chunks: Array<{ label: string; md: string }> = [];
    for (let i = 0; i < pages.length; i++) {
      const start = pages[i].line_start - 1;  // 转 0-indexed
      const end = i + 1 < pages.length ? pages[i + 1].line_start - 1 : lines.length;
      const md = lines.slice(Math.max(0, start), Math.max(0, end)).join("\n");
      chunks.push({ label: pages[i].label, md });
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
      return html`<div class="md-body md-body-paged">
        ${chunks.map((c) => html`
          <section class="page-card">
            <header class="page-card-header">${c.label}</header>
            <div .innerHTML=${marked.parse(c.md, { async: false }) as string}></div>
          </section>
        `)}
      </div>`;
    }
    // 回归：单块渲染
    const raw = marked.parse(this.content, { async: false }) as string;
    return html`<div class="md-body" .innerHTML=${raw}></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "md-viewer": MdViewer;
  }
}
