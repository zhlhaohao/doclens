import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("focus-header")
export class FocusHeader extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      background: var(--cortex-surface-muted);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    .back {
      background: none;
      border: none;
      color: var(--cortex-primary);
      font-weight: 600;
      font-size: var(--cortex-fs-base);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .back:hover { background: var(--cortex-primary-soft); }
    .title {
      font-weight: 600;
      color: var(--cortex-text);
      font-size: var(--cortex-fs-md);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta { color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm); }
  `;

  @property() backLabel = "返回";
  @property() title = "";
  @property() meta = "";

  private _back() {
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <button class="back" @click=${this._back}>← ${this.backLabel}</button>
      <div class="title">${this.title}</div>
      ${this.meta ? html`<div class="meta">${this.meta}</div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "focus-header": FocusHeader;
  }
}
