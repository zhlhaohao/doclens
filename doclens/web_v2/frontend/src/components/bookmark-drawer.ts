import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ReadingBookmark } from "../utils/bookmarks";
import "./icon";

/**
 * <bookmark-drawer> —— 阅读书签抽屉（2026-10-01 决议）。
 *
 * 复用 toc-drawer 的交互骨架：覆盖在 preview-pane 上的浮层（:host
 * absolute inset 0）+ 半透明遮罩 + 右侧滑出面板。面板内是当前文件的
 * 书签列表（创建时间倒序，最新在前）：点击条目跳回收藏位置；条目右侧
 * 删除钮移除该条。面板头部「收藏当前位置」按钮把当前阅读位置加为书签
 * （唯一收藏入口，桌面/移动一致——右键/长按隐藏入口已否决）。
 *
 * 事件：
 *   @add                      头部「收藏当前位置」按钮（父组件捕获锚点）
 *   @jump   detail: { bookmark }  点击条目（父组件负责跳转并关闭抽屉）
 *   @remove detail: { bookmark }  点击删除钮（不关闭抽屉，可连续删）
 *   @close                       遮罩点击 / Esc / 关闭按钮
 */
@customElement("bookmark-drawer")
export class BookmarkDrawer extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      z-index: 30;
      display: flex;
      font-family: var(--cortex-font);
    }
    .overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.32);
      animation: bm-fade-in 0.15s ease-out;
    }
    .panel {
      position: relative;
      margin-left: auto;
      width: 280px;
      max-width: 82%;
      background: var(--cortex-surface);
      border-left: 1px solid var(--cortex-border-muted);
      box-shadow: var(--cortex-shadow-lg);
      display: flex;
      flex-direction: column;
      min-height: 0;
      animation: bm-slide-in 0.18s ease-out;
    }
    @keyframes bm-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes bm-slide-in {
      from { transform: translateX(24px); opacity: 0.6; }
      to { transform: translateX(0); opacity: 1; }
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--cortex-space-3) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text);
      flex-shrink: 0;
    }
    .close-btn,
    .del-btn {
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      padding: var(--cortex-space-1);
      border-radius: 50%;
      font-size: 16px;
      transition: background 0.15s, color 0.15s;
    }
    .close-btn:hover,
    .del-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    .del-btn:hover {
      color: var(--cortex-danger, #dc2626);
    }
    .add-btn {
      border: none;
      background: transparent;
      color: var(--cortex-primary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      padding: var(--cortex-space-1) var(--cortex-space-2);
      border-radius: var(--cortex-radius-md, 6px);
      font-size: var(--cortex-fs-xs);
      font-family: inherit;
      transition: background 0.15s;
    }
    .add-btn:hover {
      background: var(--cortex-primary-soft);
    }
    .list {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding: var(--cortex-space-2) 0;
    }
    .empty {
      padding: var(--cortex-space-6) var(--cortex-space-4);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      text-align: center;
      line-height: 1.6;
    }
    .item {
      display: flex;
      align-items: center;
      width: 100%;
      box-sizing: border-box; /* shadow DOM 不继承全局规则；content-box 下 padding 会使宽 >100% 把删除钮推出面板 */
      text-align: left;
      border: none;
      background: transparent;
      font-family: inherit;
      cursor: pointer;
      padding: 0 0 0 var(--cortex-space-4);
      transition: background 0.12s;
    }
    .item:hover {
      background: var(--cortex-surface-muted);
    }
    .item-main {
      flex: 1;
      min-width: 0;
      padding: var(--cortex-space-2) var(--cortex-space-2) var(--cortex-space-2) 0;
    }
    .item-label {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      line-height: 1.5;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  /** 当前文件的书签（创建时间倒序，最新在前）。 */
  @property({ attribute: false }) items: ReadingBookmark[] = [];

  /** 收藏按钮可用（父组件书签入口可用即可收藏）。 */
  @property({ type: Boolean }) canAdd = true;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this._onKeydown, true);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._onKeydown, true);
    super.disconnectedCallback();
  }

  private _onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      this.dispatchEvent(new CustomEvent("close"));
    }
  };

  private _onItemClick(b: ReadingBookmark) {
    this.dispatchEvent(new CustomEvent("jump", { detail: { bookmark: b } }));
  }

  private _onRemoveClick(e: Event, b: ReadingBookmark) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("remove", { detail: { bookmark: b } }));
  }

  private _formatTime(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  render() {
    return html`
      <div class="overlay" @click=${() => this.dispatchEvent(new CustomEvent("close"))}></div>
      <aside class="panel" role="dialog" aria-label="书签">
        <header class="panel-header">
          <span>书签（${this.items.length}）</span>
          <div style="display:flex;align-items:center;gap:var(--cortex-space-1)">
            ${this.canAdd
              ? html`<button
                  class="add-btn"
                  type="button"
                  title="把当前阅读位置收藏为书签"
                  @click=${() => this.dispatchEvent(new CustomEvent("add"))}
                ><doclens-icon name="plus"></doclens-icon>收藏当前位置</button>`
              : null}
            <button
              class="close-btn"
              type="button"
              aria-label="关闭书签"
              @click=${() => this.dispatchEvent(new CustomEvent("close"))}
            ><doclens-icon name="x"></doclens-icon></button>
          </div>
        </header>
        <div class="list">
          ${this.items.length === 0
            ? html`<div class="empty">暂无书签<br/>点击预览顶部的书签按钮收藏当前位置</div>`
            : this.items.map(
                (b) => html`
                  <div
                    class="item"
                    role="button"
                    tabindex="0"
                    title=${b.label}
                    @click=${() => this._onItemClick(b)}
                    @keydown=${(e: KeyboardEvent) => {
                      if (e.key === "Enter") this._onItemClick(b);
                    }}
                  >
                    <div class="item-main">
                      <div class="item-label">${b.label}</div>
                      <div class="item-meta">${this._formatTime(b.createdAt)}</div>
                    </div>
                    <button
                      class="del-btn"
                      type="button"
                      aria-label="删除书签"
                      @click=${(e: Event) => this._onRemoveClick(e, b)}
                    ><doclens-icon name="trash-2"></doclens-icon></button>
                  </div>
                `,
              )}
        </div>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bookmark-drawer": BookmarkDrawer;
  }
}
