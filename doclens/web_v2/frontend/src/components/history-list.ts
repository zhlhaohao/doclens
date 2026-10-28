import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { Session } from "../state/types";

@customElement("history-list")
export class HistoryList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 0;
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
      font-size: var(--cortex-fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--cortex-text-subtle);
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
    .import-btn {
      background: transparent;
      border: none;
      padding: 2px 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      transition: color 0.15s, background 0.15s;
      margin-right: 2px;
    }
    .import-btn:hover {
      color: var(--cortex-text);
      background: var(--cortex-surface-muted);
    }
    .pin-btn {
      background: transparent;
      border: none;
      padding: 2px 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      transition: color 0.15s, background 0.15s;
      margin-right: 2px;
    }
    .pin-btn:hover {
      color: var(--cortex-text);
      background: var(--cortex-surface-muted);
    }
    .pin-btn.on {
      color: var(--cortex-primary, var(--cortex-text));
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 2px;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
      text-align: center;
      padding: var(--cortex-space-6);
    }
    .pager {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) 0 var(--cortex-space-3);
    }
    .pager button {
      background: transparent;
      border: 1px solid var(--cortex-border);
      padding: 4px 12px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      transition: color 0.15s, background 0.15s, border-color 0.15s;
    }
    .pager button:hover:not(:disabled) {
      color: var(--cortex-text);
      background: var(--cortex-surface-muted);
    }
    .pager button:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
    .pager .page-info {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      min-width: 48px;
      text-align: center;
    }
  `;

  @property() title = "历史会话";
  @property({ attribute: false }) sessions: Session[] = [];
  /** 调用方类型，仅作文档化用；实际清空范围由父组件决定 */
  @property() type?: "search" | "chat";
  /** 显示「导入」按钮（ADR-0038 会话导入入口；search 历史不提供） */
  @property({ type: Boolean }) importable = false;
  /** 清空中状态：禁用按钮 + 文字变化 */
  @property({ type: Boolean }) clearing = false;
  /** 高亮条目 id（重启恢复的「上次会话」纯展示高亮） */
  @property({ attribute: false }) activeId: string | null = null;
  /** 当前页码（1-based）；仅当 hasMore=true 时展示翻页器 */
  @property({ type: Number }) page = 1;
  /** 是否还有更早的会话（上一页方向：page > 1；下一页方向：本页满 200 条） */
  @property({ type: Boolean }) hasMore = false;
  /** 星标置顶开关（父组件持有真实状态并负责排序与持久化） */
  @property({ type: Boolean }) starPin = true;

  private _onClear() {
    if (this.clearing) return;
    this.dispatchEvent(new CustomEvent("clear", {
      bubbles: true, composed: true,
    }));
  }

  private _onImport() {
    this.dispatchEvent(new CustomEvent("import", {
      bubbles: true, composed: true,
    }));
  }

  private _onPage(page: number) {
    this.dispatchEvent(new CustomEvent("page-change", {
      detail: { page }, bubbles: true, composed: true,
    }));
  }

  private _onToggleStarPin() {
    this.dispatchEvent(new CustomEvent("star-pin-change", {
      detail: { value: !this.starPin }, bubbles: true, composed: true,
    }));
  }

  render() {
    const showBtn = this.sessions.length > 0;
    return html`
      <div class="header">
        <div class="title">${this.title}</div>
        <div class="actions">
          <button
            class="pin-btn ${this.starPin ? "on" : ""}"
            title=${this.starPin
              ? "加星条目置顶中，点击后加星与其他条目同等排序"
              : "加星条目按时间混排中，点击恢复加星置顶"}
            @click=${this._onToggleStarPin}>
            ${this.starPin ? "★ 置顶" : "★ 混排"}
          </button>
          ${this.importable ? html`
            <button
              class="import-btn"
              title="从导出文件导入会话（跨实例记忆转移）"
              @click=${this._onImport}>
              导入
            </button>` : null}
          ${showBtn ? html`
            <button
              class="clear-btn"
              ?disabled=${this.clearing}
              @click=${this._onClear}>
              ${this.clearing ? "清空中..." : "清空"}
            </button>` : null}
        </div>
      </div>
      ${this.sessions.length === 0
        ? html`<div class="empty">暂无历史${this.type === "search" ? "搜索" : "会话"}</div>`
        : repeat(
            this.sessions,
            (s) => s.id,
            (s) => html`<history-item .session=${s} ?active=${s.id === this.activeId}></history-item>`
          )}
      ${this.hasMore
        ? html`<div class="pager">
            <button
              ?disabled=${this.page <= 1}
              @click=${() => this._onPage(this.page - 1)}>
              上一页
            </button>
            <span class="page-info">${this.page}</span>
            <button @click=${() => this._onPage(this.page + 1)}>
              下一页
            </button>
          </div>`
        : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-list": HistoryList;
  }
}
