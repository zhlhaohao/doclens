import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { marked } from "marked";
import type { SearchResult } from "../state/types";

@customElement("result-card")
export class ResultCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--cortex-card-bg);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: 12px 16px;
      cursor: pointer;
      box-shadow: var(--cortex-shadow-sm);
      transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    :host([active]) {
      border-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
    }
    :host(:hover) {
      border-color: var(--cortex-primary);
    }
    .path {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
    }
    .badge {
      display: inline-block;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
      border-radius: var(--cortex-radius-sm);
      padding: 0 4px;
      margin-right: 4px;
    }
    .snippet {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      margin-top: 4px;
      line-height: 1.5;
    }
    /* 卡片是片段预览（snippet 已截断到 ~300 字符），让块级 md 元素
       自然展开即可，不再用 line-clamp 强行压成 4 行（块级 + 嵌套元素
       下 line-clamp 行为不一致，且 md 结构需要更多垂直空间）。 */
    .snippet h1, .snippet h2, .snippet h3, .snippet h4 {
      font-size: inherit;
      font-weight: 600;
      margin: 0;
      display: inline;
    }
    .snippet h1::before, .snippet h2::before,
    .snippet h3::before, .snippet h4::before {
      content: " ";
    }
    .snippet p { margin: 0; }
    .snippet p + p { margin-top: 4px; }
    .snippet ul, .snippet ol {
      margin: 4px 0;
      padding-left: 1.4em;
    }
    .snippet li { margin: 1px 0; }
    .snippet code {
      font-family: var(--cortex-font-mono);
      font-size: 0.9em;
      background: var(--cortex-surface-muted);
      padding: 0 3px;
      border-radius: var(--cortex-radius-sm);
    }
    .snippet pre {
      background: var(--cortex-surface-muted);
      padding: 6px 8px;
      border-radius: var(--cortex-radius-sm);
      overflow-x: auto;
      margin: 4px 0;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    .snippet pre code {
      background: transparent;
      padding: 0;
    }
    .snippet blockquote {
      border-left: 3px solid var(--cortex-border);
      padding-left: 8px;
      color: var(--cortex-text-muted);
      margin: 4px 0;
    }
    .snippet a {
      color: var(--cortex-primary);
      text-decoration: none;
    }
    .snippet hr {
      border: none;
      border-top: 1px solid var(--cortex-border);
      margin: 6px 0;
    }
    .snippet table {
      border-collapse: collapse;
      font-size: var(--cortex-fs-sm);
      margin: 4px 0;
    }
    .snippet th, .snippet td {
      border: 1px solid var(--cortex-border);
      padding: 2px 6px;
    }
    .score {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      margin-top: 4px;
    }
    mark {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
  `;

  @property({ attribute: false }) result: SearchResult | null = null;
  @property({ type: Boolean, reflect: true }) active = false;

  private _select() {
    if (!this.result) return;
    this.dispatchEvent(new CustomEvent("select", {
      detail: { result: this.result },
      bubbles: true, composed: true,
    }));
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this._select);
  }
  disconnectedCallback() {
    this.removeEventListener("click", this._select);
    super.disconnectedCallback();
  }

  /** 把 snippet 当 markdown 渲染。snippet 来源于用户索引的文档，
   *  与 md-viewer 一致：信任来源，不做额外 sanitization
   *  （marked 本身会转义 markdown 中的 HTML 字符如 `<script>`）。 */
  private _renderSnippet() {
    const snippet = this.result?.snippet ?? "";
    if (!snippet) return null;
    const rendered = marked.parse(snippet, { async: false }) as string;
    return html`<div class="snippet" .innerHTML=${rendered}></div>`;
  }

  render() {
    if (!this.result) return null;
    const scorePct = Math.round(this.result.score * 100);
    return html`
      <div class="path">
        ${this.result.kind === "path" ? html`<span class="badge">路径</span>` : null}
        ${this.result.path}${this.result.line ? `:${this.result.line}` : ""}
      </div>
      ${this._renderSnippet()}
      <div class="score">评分: ${scorePct}%</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "result-card": ResultCard;
  }
}