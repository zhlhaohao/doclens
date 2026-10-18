import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileGroup, SearchHit } from "../state/types";
import "./file-card";

@customElement("search-results")
export class SearchResults extends LitElement {
  static styles = css`
    :host {
      display: flex;
      gap: var(--cortex-space-4);
      flex: 0 0 auto;
      min-height: 0;
      /* shadow 内不受全局 border-box reset 影响，须显式声明：
         content-box 下 .list-pane 的 flex-basis 不含 padding/border，
         面板会右溢 25px，卡片右边框被相邻预览区裁掉 */
      box-sizing: border-box;
    }
    *, *::before, *::after { box-sizing: border-box; }
    .list-pane {
      flex: 0 0 var(--results-pane-width, 360px);
      min-width: 280px;
      max-width: 800px;
      background: var(--cortex-view-bg);
      padding: var(--cortex-space-3) var(--cortex-space-2);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
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
        border-right: none;
      }
    }
  `;

  @property({ attribute: false }) groups: FileGroup[] = [];
  /** 当前激活命中（detailStack 顶部引用）——path+line 匹配对应行加亮。 */
  @property({ attribute: false }) activeHit: SearchHit | null = null;
  @property({ type: Boolean }) loading = false;

  private _onHitSelect(e: CustomEvent<{ hit: SearchHit }>) {
    this.dispatchEvent(new CustomEvent("hit-select", {
      detail: e.detail,
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <div class="list-pane">
        ${this.loading && this.groups.length === 0
          ? html`<div class="loading">搜索中</div>`
          : this.groups.length === 0
            ? html`<div class="empty">无搜索结果</div>`
            : this.groups.map((g) => html`
                <file-card
                  .group=${g}
                  .activeHit=${this.activeHit}
                  ?expanded=${false}
                  @hit-select=${this._onHitSelect}>
                </file-card>`)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "search-results": SearchResults;
  }
}
