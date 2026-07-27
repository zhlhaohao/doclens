import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ViewId } from "../state/types";

@customElement("activity-bar")
export class ActivityBar extends LitElement {
  static styles = css`
    :host {
      display: var(--cortex-show-activity-bar, none);
      flex-direction: column;
      align-items: stretch;
      width: max-content;
      min-width: max-content;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-right: 1px solid var(--cortex-border-muted);
      padding: var(--cortex-space-4) var(--cortex-space-2);
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    button {
      width: max-content;
      min-width: 100%;
      min-height: 40px;
      padding: var(--cortex-space-2) var(--cortex-space-4);
      /* 对齐 tab-bar：无边框、透明底、muted 文字 */
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-md);
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: var(--cortex-space-3);
      transition: background var(--cortex-duration-fast), color var(--cortex-duration-fast);
      white-space: nowrap;
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
    }
    button:hover { background: var(--cortex-surface-muted); }
    button.active {
      /* 对齐 tab-bar：激活无底色，深红文字 + 加粗（写在 :hover 之后以覆盖残留灰底） */
      background: transparent;
      color: var(--cortex-nav-active);
      font-weight: 700;
    }
    .icon {
      font-size: 22px;        /* 对齐 tab-bar 图标尺寸 */
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      transition: color var(--cortex-duration-fast);
    }
    /* 激活项图标：深红（搭配 .filled 实心填充，与 tab-bar 完全一致） */
    button.active .icon { color: var(--cortex-nav-active); }
    .label { font-size: var(--cortex-fs-sm); }
  `;

  @property() active: ViewId = "search";

  private _items: Array<{ id: ViewId; icon: string; label: string }> = [
    { id: "search", icon: "search", label: "搜索" },
    { id: "chat", icon: "message-circle", label: "对话" },
    { id: "files", icon: "folder", label: "文件" },
  ];

  private _select(id: ViewId) {
    this.dispatchEvent(new CustomEvent("navigate", {
      detail: { view: id },
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      ${this._items.map((it) => html`
        <button
          class=${this.active === it.id ? "active" : ""}
          title=${it.label}
          aria-label=${it.label}
          @click=${() => this._select(it.id)}>
          <doclens-icon class="icon ${this.active === it.id ? "filled" : ""}" name=${it.icon}></doclens-icon>
          <span class="label">${it.label}</span>
        </button>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "activity-bar": ActivityBar;
  }
}
