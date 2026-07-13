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
      flex: 0 0 var(--results-pane-width, 360px);
      min-width: 280px;
      max-width: 800px;
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
    .loading {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-base);
      text-align: center;
      padding: var(--cortex-space-8);
    }
    .loading::after {
      content: "";
      display: inline-block;
      width: 14px;
      height: 14px;
      margin-left: 8px;
      border: 2px solid var(--cortex-border);
      border-top-color: var(--cortex-primary);
      border-radius: 50%;
      vertical-align: middle;
      animation: cortex-spin 0.8s linear infinite;
    }
    @keyframes cortex-spin { to { transform: rotate(360deg); } }
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
  /** 当前激活的 SearchResult 引用（来自父组件 detailStack 顶部）。
   *  用引用比较而非 path+line，是为了避开 LIKE/ripgrep 降级场景下
   *  line=null 导致的歧义：null === null 会误激活同文件多卡片；
   *  而用 r.line != null 守卫又会让被点击的 line=null 卡片永远不加亮。
   *  引用比较天然唯一：detailTop 就是用户点击的那张 result 引用，
   *  其他同文件卡片哪怕 line=null，引用也不同，不会被加亮。 */
  @property({ attribute: false }) activeResult: SearchResult | null = null;
  @property({ type: Boolean }) loading = false;

  render() {
    return html`
      <div class="list-pane">
        ${this.loading && this.results.length === 0
          ? html`<div class="loading">搜索中</div>`
          : this.results.length === 0
            ? html`<div class="empty">无搜索结果</div>`
            : this.results.map((r) => html`
                <result-card
                  .result=${r}
                  ?active=${this.activeResult === r}>
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
