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
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-md);
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: var(--cortex-space-3);
      transition: background 0.15s, color 0.15s, box-shadow 0.15s;
      white-space: nowrap;
    }
    button:hover { background: var(--cortex-surface-muted); color: var(--cortex-text); }
    button.active {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      font-weight: 600;
      box-shadow: inset 3px 0 0 var(--cortex-primary);
    }
    .icon { font-size: 18px; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: 22px; }
    .label { font-size: var(--cortex-fs-sm); }
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
          aria-label=${it.label}
          @click=${() => this._select(it.id)}>
          <span class="icon">${it.icon}</span>
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
