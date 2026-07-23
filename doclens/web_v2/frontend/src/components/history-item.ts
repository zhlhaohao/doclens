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
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 10px 12px;
      cursor: pointer;
      box-shadow: var(--cortex-shadow-sm);
      transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    }
    :host(:hover) {
      background: var(--cortex-surface);
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-shadow-md);
      transform: translateY(-1px);
    }
    .name {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      font-weight: 500;
    }
    .meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
    }
    .mode-tag {
      display: inline-flex;
      align-items: center;
      margin-right: 6px;
      font-size: var(--cortex-fs-xs);
      font-family: var(--cortex-font-mono);
      color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
      border-radius: var(--cortex-radius-sm);
      padding: 0 4px;
      line-height: 1.5;
    }
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
    // search 历史只保留关键词（不再保存结果数量）；chat 仍显示消息数。
    const metaParts: string[] = [];
    if (this.session.type === "chat") {
      metaParts.push(String(this.session.message_count));
    }
    metaParts.push(new Date(this.session.updated_at).toLocaleDateString());
    return html`
      <div class="name">
        ${this.session.mode === "grep" ? html`<span class="mode-tag" title="正则 grep">grep</span>` : null}
        ${this.session.title}
      </div>
      <div class="meta">${metaParts.join(" · ")}</div>
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
