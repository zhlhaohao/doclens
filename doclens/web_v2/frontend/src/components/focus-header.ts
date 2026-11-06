import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export interface FocusHeaderAction {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  /** 横排展示（2026-11-06）：true = 图标钮，与其余 row 项并排成一行
   *  （菜单顶部快捷条），不进入下方竖排文字项列表。 */
  row?: boolean;
}

@customElement("focus-header")
export class FocusHeader extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: 10px 16px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      /* backdrop-filter 使 :host 成为层叠上下文；须显式给 z-index，
         否则层叠级别为 0，会被 DOM 序靠后的 position:relative 兄弟
         （如 detail-overlay 里的 preview-pane）整体盖住——more 菜单
         即便内部 z-index:60 也抬不出本上下文。 */
      position: relative;
      z-index: 10;
    }
    .back {
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      transition: transform 0.15s, background 0.15s, color 0.15s, border-color 0.15s;
      /* Disable iOS Safari double-tap-zoom detection: without this, the first
         tap is held for ~300ms to see if a second tap follows, which surfaces
         as "needs 2 clicks" on touch devices. */
      touch-action: manipulation;
    }
    .back:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .back:active { transform: scale(0.94); }
    .title {
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--cortex-text);
      font-size: var(--cortex-fs-md);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
    }
    .meta {
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      flex-shrink: 0;
    }
    .more-wrap { position: relative; }
    .more-btn {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      color: var(--cortex-text-muted);
      font-family: inherit;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      touch-action: manipulation;
    }
    .more-btn:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .more-btn:active { opacity: 0.7; }
    .more-btn .kebab {
      font-size: 18px;
      line-height: 1;
      font-weight: 600;
      letter-spacing: 1px;
    }
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
    /* 横排快捷条（2026-11-06）：与竖排文字项分组，等宽三钮一行。
       min-width 200px 的菜单里每钮约 60px，够 36px 触摸目标。 */
    .menu-row {
      display: flex;
      gap: var(--cortex-space-1);
      padding-bottom: var(--cortex-space-1);
      margin-bottom: var(--cortex-space-1);
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .menu-row + .menu-list { display: block; }
    .menu-row-btn {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 0;
      border: none;
      border-radius: var(--cortex-radius-md);
      background: transparent;
      color: var(--cortex-text);
      font-family: inherit;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      touch-action: manipulation;
    }
    .menu-row-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-primary);
    }
    .menu-row-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu-row-btn:disabled:hover { background: transparent; color: var(--cortex-text); }
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

  private get _rowActions(): FocusHeaderAction[] {
    return this.actions.filter((a) => a.row);
  }

  private get _listActions(): FocusHeaderAction[] {
    return this.actions.filter((a) => !a.row);
  }

  /** 横排快捷条（图标钮）：与竖排文字项同菜单，但共用一行。 */
  private _renderRow() {
    const items = this._rowActions;
    if (items.length === 0) return null;
    return html`
      <div class="menu-row" role="group">
        ${items.map((a) => html`
          <button
            class="menu-row-btn"
            type="button"
            role="menuitem"
            aria-label=${a.label}
            title=${a.label}
            ?disabled=${a.disabled ?? false}
            @click=${() => this._onItemClick(a)}
          >${a.icon ? html`<doclens-icon name=${a.icon}></doclens-icon>` : html`<span class="label">${a.label}</span>`}</button>
        `)}
      </div>
    `;
  }

  render() {
    return html`
      <button class="back" aria-label=${this.backLabel} title=${this.backLabel} @click=${this._back}>‹</button>
      <div class="title">${this.title}</div>
      ${this.meta ? html`<div class="meta">${this.meta}</div>` : null}
      ${this.actions.length > 0 ? html`
        <div class="more-wrap">
          <button
            class="more-btn"
            type="button"
            aria-label="更多"
            title="更多"
            aria-haspopup="true"
            aria-expanded=${this._menuOpen ? "true" : "false"}
            @click=${this._onMoreClick}
          >
            <doclens-icon class="kebab" aria-hidden="true" name=${this._menuOpen ? "more-horizontal" : "more-vertical"}></doclens-icon>
          </button>
          <div class="menu ${this._menuOpen ? "open" : ""}" role="menu">
            ${this._renderRow()}
            <div class="menu-list">
              ${this._listActions.map((a) => html`
                <button
                  class="menu-item"
                  type="button"
                  role="menuitem"
                  ?disabled=${a.disabled ?? false}
                  @click=${() => this._onItemClick(a)}
                >
                  ${a.icon ? html`<doclens-icon class="icon" name=${a.icon}></doclens-icon>` : null}
                  <span class="label">${a.label}</span>
                </button>
              `)}
            </div>
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
