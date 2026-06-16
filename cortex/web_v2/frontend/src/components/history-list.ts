import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { Session } from "../state/types";

@customElement("history-list")
export class HistoryList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-3) var(--cortex-space-6);
      flex: 1;
      overflow-y: auto;
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--cortex-text-subtle);
      margin: 0 0 var(--cortex-space-2) 0;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: 13px;
      text-align: center;
      padding: var(--cortex-space-6);
    }
  `;

  @property() title = "历史会话";
  @property({ attribute: false }) sessions: Session[] = [];

  private _onSelect(e: CustomEvent<{ session: Session }>) {
    this.dispatchEvent(new CustomEvent("select", {
      detail: e.detail,
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <div class="title">${this.title}</div>
      ${this.sessions.length === 0
        ? html`<div class="empty">暂无历史会话</div>`
        : this.sessions.map((s) => html`<history-item .session=${s} @select=${this._onSelect}></history-item>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-list": HistoryList;
  }
}
