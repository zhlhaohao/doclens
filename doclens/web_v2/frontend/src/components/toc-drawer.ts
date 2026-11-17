import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { activeTocIndex, type TocItem } from "../utils/toc";
import { sideDrawerStyles, renderSideDrawer } from "../utils/side-drawer";
import "./icon";

/**
 * <toc-drawer> —— 预览目录抽屉。
 *
 * 外壳骨架复用 utils/side-drawer（与 bookmark-drawer 共享 overlay/panel/Esc
 * 行为，AP-30 归一）；本组件只保留 heading 缩进列表与当前章节高亮。
 *
 * 事件：
 *   @jump  detail: { line }  点击目录项（父组件负责滚动定位并关闭抽屉）
 *   @close                   遮罩点击 / Esc / 关闭按钮
 */
@customElement("toc-drawer")
export class TocDrawer extends LitElement {
  static styles = [
    sideDrawerStyles,
    css`
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
  `,
  ];

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
    return renderSideDrawer({
      ariaLabel: "目录",
      title: "目录",
      listTag: "nav",
      list: html`${this.items.map(
        (item, i) => html`
          <button
            class="item depth-${item.depth} ${i === active ? "active" : ""}"
            style="padding-left: calc(var(--cortex-space-4) + ${(item.depth - 1) * 14}px)"
            title=${item.text}
            @click=${() => this._onItemClick(item)}
            >${item.text}</button>
        `,
      )}`,
      onClose: () => this._emitClose(),
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "toc-drawer": TocDrawer;
  }
}
