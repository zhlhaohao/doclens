import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { store } from "../state/store";
import type { ViewId, SettingsScope } from "../state/types";

@customElement("app-bar")
export class AppBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 var(--cortex-space-6);
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      position: relative;
      z-index: 50;
      font-family: var(--cortex-font);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-weight: 600;
      font-size: var(--cortex-fs-md);
    }
    .brand .logo {
      width: 28px; height: 28px;
      background: var(--cortex-primary);
      border-radius: var(--cortex-radius-md);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 16px;
    }
    .right-cluster {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      position: relative;
    }
    .avatar-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 4px 8px 4px 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 999px;
      cursor: pointer;
      font-family: inherit;
      color: var(--cortex-text);
      transition: background 0.15s, border-color 0.15s;
    }
    .avatar-btn:hover {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-border);
    }
    .avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0D9488, #0F766E);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: var(--cortex-fs-sm);
    }
    .name { font-size: var(--cortex-fs-sm); }
    .chev { color: var(--cortex-text-muted); font-size: 12px; }

    .user-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 280px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: 0 8px 24px rgba(0,0,0,0.10);
      padding: var(--cortex-space-2);
      display: none;
      z-index: 60;
    }
    .user-menu.open { display: block; }
    .save-btn {
      padding: 6px 14px;
      background: var(--cortex-primary);
      color: #fff;
      border: 1px solid var(--cortex-primary);
      border-radius: var(--cortex-radius-md);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
      cursor: pointer;
      min-height: var(--cortex-touch-target, 44px);
    }
    .save-btn:hover { background: var(--cortex-primary-hover); border-color: var(--cortex-primary-hover); }
    .menu-header {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      margin-bottom: var(--cortex-space-2);
    }
    .menu-header .email {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
    }
    .menu-item {
      display: flex;
      align-items: flex-start;
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
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item .icon {
      font-size: 18px;
      flex-shrink: 0;
      width: 24px;
      text-align: center;
    }
    .menu-item .text { flex: 1; min-width: 0; }
    .menu-item .label {
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
      color: var(--cortex-text);
      display: block;
    }
    .menu-item .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      display: block;
      margin-top: 2px;
    }
  `;

  @property() activeView: ViewId = "search";

  @state() private _menuOpen = false;
  @state() private _showSaveAndRevert = false;
  private _unsubStore?: () => void;

  private _onDocClick: (e: MouseEvent) => void = (e: MouseEvent) => {
    if (!this._menuOpen) return;
    const path = e.composedPath();
    if (!path.includes(this)) {
      this._menuOpen = false;
    }
  };

  private _onAvatarClick(e: Event) {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
  }

  private _onScopeSelect(scope: SettingsScope) {
    this._menuOpen = false;
    this.dispatchEvent(new CustomEvent("navigate", {
      detail: { view: "settings", scope },
      bubbles: true,
      composed: true,
    }));
  }

  private _onSaveClick() {
    window.dispatchEvent(new CustomEvent("cortex:save-settings"));
  }

  private _onRevertClick() {
    this._menuOpen = false;
    window.dispatchEvent(new CustomEvent("cortex:revert-settings"));
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onDocClick);
    this._syncFromStore();
    this._unsubStore = store.subscribe(() => this._syncFromStore());
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick);
    this._unsubStore?.();
    super.disconnectedCallback();
  }

  private _syncFromStore() {
    const s = store.getState();
    this._showSaveAndRevert = s.view === "settings" && s.settings.dirty;
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="brand">
        <span class="logo">🧠</span>
        <span>Cortex</span>
      </div>
      <div class="right-cluster">
        ${this._showSaveAndRevert ? html`
          <button class="save-btn" type="button" @click=${this._onSaveClick}>💾 保存</button>
        ` : nothing}
        <button class="avatar-btn" @click=${this._onAvatarClick}>
          <span class="avatar">L</span>
          <span class="name">Liang</span>
          <span class="chev">▾</span>
        </button>
        <div class="user-menu ${this._menuOpen ? "open" : ""}">
          <div class="menu-header">
            <div style="font-size: var(--cortex-fs-sm); font-weight: 500;">Liang</div>
            <div class="email">liang@example.com</div>
          </div>
          <button class="menu-item" type="button" @click=${() => this._onScopeSelect("local")}>
            <span class="icon">📁</span>
            <span class="text">
              <span class="label">本地配置</span>
              <span class="desc">仅当前工作目录</span>
            </span>
          </button>
          <button class="menu-item" type="button" @click=${() => this._onScopeSelect("global")}>
            <span class="icon">🌍</span>
            <span class="text">
              <span class="label">全局配置</span>
              <span class="desc">所有项目共用</span>
            </span>
          </button>
          ${this._showSaveAndRevert ? html`
            <button class="menu-item" type="button" @click=${this._onRevertClick}>
              <span class="icon">↩</span>
              <span class="text">
                <span class="label">放弃修改</span>
                <span class="desc">恢复到 .env 当前值</span>
              </span>
            </button>
          ` : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-bar": AppBar;
  }
}
