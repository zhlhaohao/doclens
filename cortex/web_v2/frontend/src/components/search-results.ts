import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { SearchResult } from "../state/types";

@customElement("search-results")
export class SearchResults extends LitElement {
  static styles = css`
    :host {
      display: flex;
      gap: var(--cortex-space-4);
      flex: 0 0 auto;
      min-height: 0;
    }
    .list-pane {
      flex: 0 0 360px;
      min-width: 280px;
      max-width: 480px;
      background: var(--cortex-surface-muted);
      border-right: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      text-align: center;
      padding: var(--cortex-space-8);
    }
    /* 桌面：双栏，列表 + 预览；移动：单栏，点击触发 push */
    @media (max-width: 1023px) {
      :host { flex-direction: column; flex: 1; }
      .list-pane {
        flex: 1; max-width: none; min-width: 0;
        border-right: none; border-bottom: 1px solid var(--cortex-border);
      }
    }
  `;

  @property({ attribute: false }) results: SearchResult[] = [];
  @property({ attribute: false }) activePath: string | null = null;
  @property({ attribute: false }) activeLine: number | null = null;

  private _onSelect(e: CustomEvent<{ result: SearchResult }>) {
    this.dispatchEvent(new CustomEvent("select", {
      detail: e.detail,
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <div class="list-pane">
        ${this.results.length === 0
          ? html`<div class="empty">无搜索结果</div>`
          : this.results.map((r) => html`
              <result-card
                .result=${r}
                ?active=${this.activePath === r.path && this.activeLine === r.line}
                @select=${this._onSelect}>
              </result-card>`)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "search-results": SearchResults;
  }
}
