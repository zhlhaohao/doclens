import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ViewId } from "../state/types";

@customElement("activity-bar")
export class ActivityBar extends LitElement {
  static styles = css`
    :host {
      display: var(--cortex-show-activity-bar, none);
      flex-direction: column;
      align-items: center;
      width: var(--cortex-activity-bar-width);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-right: 1px solid var(--cortex-border);
      padding: var(--cortex-space-4) 0;
      gap: var(--cortex-space-4);
      flex-shrink: 0;
    }
    button {
      width: 36px; height: 36px;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: background 0.15s, color 0.15s;
    }
    button:hover { background: var(--cortex-surface-muted); color: var(--cortex-text); }
    button.active { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
  `;

  @property() active: ViewId = "search";

  private _items: Array<{ id: ViewId; icon: string; label: string }> = [
    { id: "search", icon: "🔍", label: "搜索" },
    { id: "chat", icon: "💬", label: "对话" },
    { id: "files", icon: "📁", label: "文件" },
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
          @click=${() => this._select(it.id)}>
          ${it.icon}
        </button>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "activity-bar": ActivityBar;
  }
}
