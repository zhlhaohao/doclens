import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface FocusHeaderAction {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
}

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
      position: relative;
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
    .more-wrap { position: relative; }
    .more-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: transparent;
      border: 1px solid var(--cortex-border);
      color: var(--cortex-text);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 4px 10px;
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
    }
    .more-btn:hover { background: var(--cortex-surface); }
    .more-btn .chev { transition: transform 0.15s; display: inline-block; }
    .more-btn[aria-expanded="true"] .chev { transform: rotate(180deg); }
    .menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 200px;
      max-width: 280px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: 0 8px 24px rgba(0,0,0,0.10);
      padding: var(--cortex-space-2);
      display: none;
      z-index: 60;
    }
    .menu.open { display: block; }
    .menu-item {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
      transition: background 0.15s;
      border: none;
      background: transparent;
      width: 100%;
      text-align: left;
      font-family: inherit;
      color: var(--cortex-text);
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu-item .icon { font-size: 16px; flex-shrink: 0; }
    .menu-item .label { font-size: var(--cortex-fs-sm); font-weight: 500; }
  `;

  @property() backLabel = "返回";
  @property() title = "";
  @property() meta = "";
  @property({ attribute: false }) actions: FocusHeaderAction[] = [];

  @state() private _menuOpen = false;

  private _back() {
    this.dispatchEvent(new CustomEvent("back", { bubbles: true, composed: true }));
  }

  private _onMoreClick(e: Event) {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
  }

  private _onItemClick(action: FocusHeaderAction) {
    if (action.disabled) return;
    this._menuOpen = false;
    action.onClick();
  }

  private _onDocClick: (e: MouseEvent) => void = (e: MouseEvent) => {
    if (!this._menuOpen) return;
    const path = e.composedPath();
    if (!path.includes(this)) {
      this._menuOpen = false;
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onDocClick);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick);
    super.disconnectedCallback();
  }

  render() {
    return html`
      <button class="back" @click=${this._back}>← ${this.backLabel}</button>
      <div class="title">${this.title}</div>
      ${this.meta ? html`<div class="meta">${this.meta}</div>` : null}
      ${this.actions.length > 0 ? html`
        <div class="more-wrap">
          <button
            class="more-btn"
            type="button"
            aria-haspopup="true"
            aria-expanded=${this._menuOpen ? "true" : "false"}
            @click=${this._onMoreClick}
          >
            更多 <span class="chev">▾</span>
          </button>
          <div class="menu ${this._menuOpen ? "open" : ""}" role="menu">
            ${this.actions.map((a) => html`
              <button
                class="menu-item"
                type="button"
                role="menuitem"
                ?disabled=${a.disabled ?? false}
                @click=${() => this._onItemClick(a)}
              >
                ${a.icon ? html`<span class="icon">${a.icon}</span>` : null}
                <span class="label">${a.label}</span>
              </button>
            `)}
          </div>
        </div>
      ` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "focus-header": FocusHeader;
  }
}
