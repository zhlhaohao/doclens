import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { SearchResult } from "../state/types";

@customElement("result-card")
export class ResultCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    :host([active]) {
      border-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
    }
    :host(:hover) { border-color: var(--cortex-primary); }
    .path { font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted); font-family: var(--cortex-font-mono); }
    .snippet {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      margin-top: 4px;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .score {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      margin-top: 2px;
    }
    mark {
      background: #FEF3C7;
      color: inherit;
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

  render() {
    if (!this.result) return null;
    const scorePct = Math.round(this.result.score * 100);
    return html`
      <div class="path">${this.result.path}${this.result.line ? `:${this.result.line}` : ""}</div>
      <div class="snippet">${this.result.snippet}</div>
      <div class="score">评分: ${scorePct}%</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "result-card": ResultCard;
  }
}
