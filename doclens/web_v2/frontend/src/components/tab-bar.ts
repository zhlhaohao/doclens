import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ViewId } from "../state/types";

@customElement("tab-bar")
export class TabBar extends LitElement {
  static styles = css`
    :host {
      display: var(--cortex-show-tab-bar, none);
      flex-direction: row;
      height: var(--cortex-tab-bar-height);
      background: var(--cortex-surface);
      border-top: 1px solid var(--cortex-border);
      padding-bottom: env(safe-area-inset-bottom);
      flex-shrink: 0;
    }
    .tab {
      flex: 1;
      position: relative;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      font-size: var(--cortex-fs-xs);
      padding: 8px 0 6px;
      transition: background 0.15s, color 0.15s;
    }
    .tab:hover { background: var(--cortex-surface-muted); }
    .tab.active {
      background: transparent;   /* 激活 tab 无底色（覆盖移动端 :hover 残留灰底） */
      color: var(--cortex-nav-active);  /* 深红，非纯红 */
      font-weight: 700;
    }
    .tab .icon {
      font-size: 22px;
      line-height: 1;
      transition: color var(--cortex-duration-fast);
    }
    /* 激活 tab：图标也变深红（无背景、无胶囊） */
    .tab.active .icon {
      color: var(--cortex-nav-active);
    }
  `;

  @property() active: ViewId = "search";

  private _items: Array<{ id: ViewId; icon: string; label: string }> = [
    { id: "search", icon: "search", label: "搜索" },
    { id: "chat", icon: "message-circle", label: "对话" },
    { id: "diary", icon: "book-open", label: "日记" },
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
          class="tab ${this.active === it.id ? "active" : ""}"
          @click=${() => this._select(it.id)}>
          <doclens-icon class="icon ${this.active === it.id ? "filled" : ""}" name=${it.icon}></doclens-icon>
          <span>${it.label}</span>
        </button>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tab-bar": TabBar;
  }
}
