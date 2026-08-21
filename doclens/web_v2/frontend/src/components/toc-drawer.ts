import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { activeTocIndex, type TocItem } from "../utils/toc";
import "./icon";

/**
 * <toc-drawer> —— 预览目录抽屉。
 *
 * 覆盖在 preview-pane 上的浮层（:host absolute inset 0）：半透明遮罩 +
 * 右侧滑出面板。面板内是 heading 的扁平缩进列表（depth 决定缩进与字重），
 * 当前阅读位置所在章节高亮（最后一个 line <= currentLine 的条目）。
 *
 * 事件：
 *   @jump  detail: { line }  点击目录项（父组件负责滚动定位并关闭抽屉）
 *   @close                   遮罩点击 / Esc / 关闭按钮
 */
@customElement("toc-drawer")
export class TocDrawer extends LitElement {
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
      animation: toc-fade-in 0.15s ease-out;
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
      animation: toc-slide-in 0.18s ease-out;
    }
    @keyframes toc-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes toc-slide-in {
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
    .close-btn {
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
    .close-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    .list {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding: var(--cortex-space-2) 0;
    }
    .item {
      display: block;
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      font-family: inherit;
      color: var(--cortex-text);
      cursor: pointer;
      padding: var(--cortex-space-2) var(--cortex-space-4);
      font-size: var(--cortex-fs-sm);
      line-height: 1.5;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: background 0.12s, color 0.12s;
      /* 层级缩进：depth 1 顶格，每深一级缩进 14px（内联 style 设置） */
    }
    .item:hover {
      background: var(--cortex-surface-muted);
    }
    .item.depth-1 { font-weight: 600; }
    .item.depth-2 { font-weight: 500; }
    .item.depth-3,
    .item.depth-4,
    .item.depth-5,
    .item.depth-6 {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .item.active {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      font-weight: 600;
    }
  `;

  @property({ attribute: false }) items: TocItem[] = [];
  /** 当前阅读位置的源行号（1-indexed），用于高亮所在章节 */
  @property({ type: Number }) currentLine = 1;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this._onKeydown, true);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._onKeydown, true);
    super.disconnectedCallback();
  }

  firstUpdated() {
    // 打开时把当前章节滚进可视区（nearest 避免已可见时不必要的滚动）
    const active = this.shadowRoot?.querySelector(".item.active");
    active?.scrollIntoView({ block: "nearest" });
  }

  private _onKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      this._emitClose();
    }
  };

  private _emitClose() {
    this.dispatchEvent(new CustomEvent("close"));
  }

  private _onItemClick(item: TocItem) {
    this.dispatchEvent(
      new CustomEvent("jump", { detail: { line: item.line } }),
    );
  }

  render() {
    const active = activeTocIndex(this.items, this.currentLine);
    return html`
      <div class="overlay" @click=${this._emitClose}></div>
      <aside class="panel" role="dialog" aria-label="目录">
        <header class="panel-header">
          <span>目录</span>
          <button
            class="close-btn"
            type="button"
            aria-label="关闭目录"
            @click=${this._emitClose}
          ><doclens-icon name="x"></doclens-icon></button>
        </header>
        <nav class="list">
          ${this.items.map(
            (item, i) => html`
              <button
                class="item depth-${item.depth} ${i === active ? "active" : ""}"
                style="padding-left: calc(var(--cortex-space-4) + ${(item.depth - 1) * 14}px)"
                title=${item.text}
                @click=${() => this._onItemClick(item)}
              >${item.text}</button>
            `,
          )}
        </nav>
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "toc-drawer": TocDrawer;
  }
}
