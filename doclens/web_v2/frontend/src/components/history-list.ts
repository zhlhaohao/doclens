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
      padding: 6px var(--cortex-space-6) var(--cortex-space-3);
      flex: 1;
      /* min-height:0 允许在 flex column 容器内收缩到 content 以下，
         配合 overflow-y:auto 实现内部滚动。缺少时 min-height 默认为
         auto(=min-content)，历史会话多时会撑开父容器，把底部 tab-bar
         推出视口。 */
      min-height: 0;
      overflow-y: auto;
      /* 隐藏滚动条：内容溢出时仍可用鼠标滚轮滚动（scrollbar-width: none
         + ::-webkit-scrollbar { display: none } 是 Firefox/Chrome 双覆盖） */
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: var(--cortex-space-2) 0 var(--cortex-space-1) 0;
    }
    .title {
      font-size: var(--cortex-fs-sm);
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--cortex-text-muted);
      font-weight: 500;
    }
    .clear-btn {
      background: transparent;
      border: none;
      padding: 2px 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      transition: color 0.15s, background 0.15s;
    }
    .clear-btn:hover {
      color: var(--cortex-danger);
      background: var(--cortex-surface-muted);
    }
    .clear-btn:disabled {
      color: var(--cortex-text-subtle);
      cursor: not-allowed;
      opacity: 0.6;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
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
        ? html`<div class="empty">暂无历史${this.type === "search" ? "搜索" : "会话"}</div>`
        : this.sessions.map((s) => html`<history-item .session=${s}></history-item>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-list": HistoryList;
  }
}
