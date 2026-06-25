import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Session } from "../state/types";

@customElement("history-list")
export class HistoryList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-3) var(--cortex-space-6);
      flex: 1;
      /* min-height:0 允许在 flex column 容器内收缩到 content 以下，
         配合 overflow-y:auto 实现内部滚动。缺少时 min-height 默认为
         auto(=min-content)，历史会话多时会撑开父容器，把底部 tab-bar
         推出视口。 */
      min-height: 0;
      overflow-y: auto;
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0 0 var(--cortex-space-2) 0;
    }
    .title {
      font-size: var(--cortex-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--cortex-text-subtle);
    }
    .clear-btn {
      background: transparent;
      border: none;
      padding: 2px 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      cursor: pointer;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }
    .clear-btn:hover {
      color: #dc2626;
      background: rgba(220, 38, 38, 0.08);
    }
    .clear-btn:disabled {
      color: var(--cortex-text-subtle);
      cursor: not-allowed;
      opacity: 0.6;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      text-align: center;
      padding: var(--cortex-space-6);
    }
  `;

  @property() title = "历史会话";
  @property({ attribute: false }) sessions: Session[] = [];
  /** 调用方类型，仅作文档化用；实际清空范围由父组件决定 */
  @property() type?: "search" | "chat";
  /** 清空中状态：禁用按钮 + 文字变化 */
  @property({ type: Boolean }) clearing = false;

  private _onClear() {
    if (this.clearing) return;
    this.dispatchEvent(new CustomEvent("clear", {
      bubbles: true, composed: true,
    }));
  }

  render() {
    const showBtn = this.sessions.length > 0;
    return html`
      <div class="header">
        <div class="title">${this.title}</div>
        ${showBtn ? html`
          <button
            class="clear-btn"
            ?disabled=${this.clearing}
            @click=${this._onClear}>
            ${this.clearing ? "清空中..." : "清空"}
          </button>` : null}
      </div>
      ${this.sessions.length === 0
        ? html`<div class="empty">暂无历史会话</div>`
        : this.sessions.map((s) => html`<history-item .session=${s}></history-item>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-list": HistoryList;
  }
}
