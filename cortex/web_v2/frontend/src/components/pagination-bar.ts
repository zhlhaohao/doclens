import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <pagination-bar> —— 搜索结果页码分页。
 *
 * Props:
 *   - total: 过滤后总匹配数
 *   - offset: 当前页起始（0-indexed）
 *   - limit: 每页大小
 *   - disabled: 加载中时禁用所有按钮
 *
 * Events:
 *   - page-change: { page: number }（1-indexed 页码）
 */
@customElement("pagination-bar")
export class PaginationBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
    }
    .meta {
      color: var(--cortex-text-subtle);
      text-align: center;
    }
    .pages {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    button {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      min-width: 28px;
      height: 28px;
      padding: 0 8px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
    }
    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    button.current {
      background: var(--cortex-primary);
      color: white;
      border-color: var(--cortex-primary);
    }
    .ellipsis {
      padding: 0 4px;
      color: var(--cortex-text-subtle);
    }
  `;

  @property({ type: Number }) total = 0;
  @property({ type: Number }) offset = 0;
  @property({ type: Number }) limit = 20;
  @property({ type: Boolean }) disabled = false;

  get currentPage(): number {
    if (this.limit <= 0) return 1;
    return Math.floor(this.offset / this.limit) + 1;
  }

  get totalPages(): number {
    if (this.limit <= 0) return 1;
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  private _emitPage(page: number) {
    if (this.disabled) return;
    if (page < 1 || page > this.totalPages) return;
    this.dispatchEvent(
      new CustomEvent("page-change", { detail: { page } }),
    );
  }

  /**
   * 生成要渲染的页码槽位数组。
   * 数字 = 具体页码；"..." = 省略号。
   * totalPages <= 7：渲染全部。
   * 否则：始终显示第 1 页、最后一页、当前页 ±1；中间用 "..." 折叠。
   */
  private _pageSlots(): Array<number | "..."> {
    const tp = this.totalPages;
    const cp = this.currentPage;
    if (tp <= 7) {
      return Array.from({ length: tp }, (_, i) => i + 1);
    }
    const slots: Array<number | "..."> = [1];
    const start = Math.max(2, cp - 1);
    const end = Math.min(tp - 1, cp + 1);
    if (start > 2) slots.push("...");
    for (let i = start; i <= end; i++) slots.push(i);
    if (end < tp - 1) slots.push("...");
    slots.push(tp);
    return slots;
  }

  render() {
    if (this.total <= this.limit) return html``;  // 单页不渲染
    const slots = this._pageSlots();
    return html`
      <div class="meta">
        共 ${this.total} 条 · 第 ${this.currentPage}/${this.totalPages} 页
      </div>
      <div class="pages">
        <button
          ?disabled=${this.disabled || this.currentPage === 1}
          @click=${() => this._emitPage(this.currentPage - 1)}
          aria-label="上一页">‹</button>
        ${slots.map((s) =>
          s === "..."
            ? html`<span class="ellipsis">…</span>`
            : html`<button
                class=${s === this.currentPage ? "current" : ""}
                ?disabled=${this.disabled}
                @click=${() => this._emitPage(s as number)}>${s}</button>`,
        )}
        <button
          ?disabled=${this.disabled || this.currentPage === this.totalPages}
          @click=${() => this._emitPage(this.currentPage + 1)}
          aria-label="下一页">›</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pagination-bar": PaginationBar;
  }
}
