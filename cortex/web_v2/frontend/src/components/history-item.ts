import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Session } from "../state/types";

@customElement("history-item")
export class HistoryItem extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 10px 14px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    :host(:hover) { border-color: var(--cortex-primary); }
    .name { font-size: var(--cortex-fs-md); color: var(--cortex-text); font-weight: 500; }
    .meta { font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); }
  `;

  @property({ attribute: false }) session: Session | null = null;

  private _select() {
    if (!this.session) return;
    this.dispatchEvent(new CustomEvent("select", {
      detail: { session: this.session },
      bubbles: true, composed: true,
    }));
  }

  render() {
    if (!this.session) return null;
    return html`
      <div class="name">${this.session.title}</div>
      <div class="meta">${this.session.message_count} · ${new Date(this.session.updated_at).toLocaleDateString()}</div>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this._select);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._select);
    super.disconnectedCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-item": HistoryItem;
  }
}
