import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { marked } from "marked";

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
    .empty {
      color: var(--cortex-text-subtle);
      text-align: center;
      padding: 24px;
    }
    /* Task 5 会用到的 highlight 动画（提前放入，避免后续再改 CSS） */
    .highlight-flash {
      animation: highlight-flash 2s ease-out;
    }
    @keyframes highlight-flash {
      0% { background: rgba(254, 243, 199, 0.8); }
      100% { background: transparent; }
    }
  `;

  @property() content = "";
  /** 1-indexed 目标行；Task 5 会实现 scroll + highlight，当前预留 */
  @property({ type: Number }) line: number | null = null;

  updated(changedProps: Map<string, unknown>) {
    super.updated?.(changedProps);
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

    // scrollIntoView 在某些环境（如 happy-dom）可能缺失，做防御性检查
    if (typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    target.classList.remove("highlight-flash");  // 重置以便动画重放
    // 强制 reflow，让 animation 重新触发
    void target.offsetWidth;
    target.classList.add("highlight-flash");
  }

  render() {
    ensureMdConfigured();
    if (!this.content) {
      return html`<div class="empty">无内容</div>`;
    }
    const raw = marked.parse(this.content, { async: false }) as string;
    return html`<div class="md-body" .innerHTML=${raw}></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "md-viewer": MdViewer;
  }
}
