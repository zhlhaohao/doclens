import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import appLogoSvg from "../assets/app_icon.svg?raw";

import "./toast-stack";
import { store, actions } from "../state/store";
import type { ViewId, SettingsScope, WatcherStatus } from "../state/types";

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
      border-radius: var(--cortex-radius-md);
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .brand .logo svg { width: 100%; height: 100%; display: block; }
    .right-cluster {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      position: relative;
    }
    .watch-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      padding: 4px 10px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 999px;
      background: var(--cortex-surface-muted);
      white-space: nowrap;
    }
    .watch-badge.dot { color: var(--cortex-success); }
    .watch-badge.busy { color: var(--cortex-primary); }
    .watch-badge.warn { color: var(--cortex-warning); }
    /* 移动端刷新按钮：圆形描边按钮，点击派发 cortex:refresh 事件，
       各 view 可监听并自行决定如何刷新（默认不做事，硬刷新由调用方决定）。
       桌面端默认隐藏，移动端（≤1023px）显示。 */
    .refresh-btn {
      display: none;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid var(--cortex-border);
      border-radius: 50%;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
      /* 同 focus-header 返回按钮：disable iOS Safari 双击缩放检测 */
      touch-action: manipulation;
    }
    .refresh-btn:hover {
      background: var(--cortex-primary-soft);
      border-color: var(--cortex-primary);
      color: var(--cortex-primary);
    }
    .refresh-btn:active { transform: scale(0.94); }
    .refresh-btn .icon {
      font-size: 16px;
      line-height: 1;
      font-weight: 600;
      display: inline-block;
      transition: transform 0.4s ease;
    }
    .refresh-btn.spinning .icon {
      animation: cortex-refresh-spin 0.6s linear;
    }
    @keyframes cortex-refresh-spin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .refresh-btn.spinning .icon { animation: none; }
    }
    @media (max-width: 1023px) {
      .refresh-btn { display: inline-flex; }
      /* 移动端右侧空间紧张：watch-badge 隐藏（刷新按钮已显示状态）。 */
      .watch-badge { display: none; }
    }
    .avatar-btn {
      display: inline-flex;
      align-items: center;
      padding: 4px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 50%;
      cursor: pointer;
      font-family: inherit;
      color: var(--cortex-text);
      transition: background 0.15s, border-color 0.15s;
    }
    .avatar-btn:hover {
      background: var(--cortex-primary-soft);
      border-color: var(--cortex-border);
    }
    .avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: var(--cortex-primary);
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: var(--cortex-fs-sm);
    }

    .user-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      width: 280px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-shadow-md);
      padding: var(--cortex-space-2);
      display: none;
      z-index: 60;
    }
    .user-menu.open { display: block; }
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
  /** 刷新按钮旋转动画进行中标记：旋转期间禁用再次点击，避免动画错乱 */
  @state() private _refreshing = false;
  private _unsubStore?: () => void;

  private _onWatchReindexed: (e: Event) => void = (e: Event) => {
    const detail = (e as CustomEvent).detail as { doc_count?: number | null };
    const stack = this.shadowRoot?.querySelector("toast-stack") as
      (HTMLElement & { pushToast?: (m: string, l?: string, d?: number) => void }) | null;
    const n = detail?.doc_count;
    stack?.pushToast?.(n != null ? `索引已更新：${n} 文档` : "索引已更新", "success", 3000);
  };

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

  /** 移动端刷新按钮：硬刷新页面（location.reload）。
   *  - 让 SW 按 network-first 拉新 index.html，再按 cache-first 命中新的 hash 资源
   *  - 解决"新 build 的 JS 没被加载"的问题（之前只派发 cortex:refresh 事件，
   *    那是软刷新——只让 view 重载数据，不会重新加载 bundle，所以 tab-bar 标签
   *    之类写死在 JS 里的内容不会更新）
   *  - 旋转动画期间禁用按钮，避免动画期间被反复点击 */
  private _onRefreshClick() {
    if (this._refreshing) return;
    this._refreshing = true;
    window.setTimeout(() => {
      // 用 location.reload() 而不是 replace()，保留返回栈
      window.location.reload();
    }, 400);  // 让用户看到完整旋转动画再触发刷新
  }

  private _onScopeSelect(scope: SettingsScope) {
    this._menuOpen = false;
    this.dispatchEvent(new CustomEvent("navigate", {
      detail: { view: "settings", scope },
      bubbles: true,
      composed: true,
    }));
  }

  private _onRevertClick() {
    this._menuOpen = false;
    window.dispatchEvent(new CustomEvent("cortex:revert-settings"));
  }

  private _onReindexClick() {
    if (store.getState().reindex.dialog !== "closed") return;
    this._menuOpen = false;
    actions.openReindexConfirm();
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onDocClick);
    window.addEventListener("cortex:watch-reindexed", this._onWatchReindexed as EventListener);
    this._syncFromStore();
    this._unsubStore = store.subscribe(() => this._syncFromStore());
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick);
    window.removeEventListener("cortex:watch-reindexed", this._onWatchReindexed as EventListener);
    this._unsubStore?.();
    super.disconnectedCallback();
  }

  private _syncFromStore() {
    const s = store.getState();
    this._showSaveAndRevert = s.view === "settings" && s.settings.dirty;
    this.requestUpdate();
  }

  private _renderWatchBadge(w: WatcherStatus | null) {
    const n = w?.last_doc_count;
    const nStr = n != null ? ` ${n}` : "";
    if (!w || !w.running) return html`<span class="watch-badge"><doclens-icon name="folder"></doclens-icon>${nStr} ○监控关</span>`;
    if (w.reindexing) return html`<span class="watch-badge busy"><doclens-icon name="folder"></doclens-icon>${nStr} ⟳更新中…</span>`;
    if (w.changed_count > 0)
      return html`<span class="watch-badge warn"><doclens-icon name="folder"></doclens-icon>${nStr} ·待更新 ${w.changed_count}</span>`;
    const warn = w.last_success === false;
    return html`<span class="watch-badge ${warn ? "warn" : "dot"}"><doclens-icon name="folder"></doclens-icon>${nStr} ●监控</span>`;
  }

  render() {
    return html`
      <div class="brand">
        <span class="logo">${unsafeSVG(appLogoSvg)}</span>
        <span>Doclens</span>
      </div>
      <div class="right-cluster">
        ${this._renderWatchBadge(store.getState().watcher)}
        <button
          class="refresh-btn ${this._refreshing ? "spinning" : ""}"
          type="button"
          aria-label="刷新"
          title="刷新"
          ?disabled=${this._refreshing}
          @click=${this._onRefreshClick}
        >
          <doclens-icon class="icon" name="refresh-cw" aria-hidden="true"></doclens-icon>
        </button>
        <button class="avatar-btn" @click=${this._onAvatarClick} aria-label="用户菜单">
          <span class="avatar">L</span>
        </button>
        <div class="user-menu ${this._menuOpen ? "open" : ""}">
          <div class="menu-header">
            <div style="font-size: var(--cortex-fs-sm); font-weight: 500;">Liang</div>
            <div class="email">liang@example.com</div>
          </div>
          <button class="menu-item" type="button" @click=${() => this._onScopeSelect("global")}>
            <doclens-icon class="icon" name="globe"></doclens-icon>
            <span class="text">
              <span class="label">全局配置</span>
              <span class="desc">所有项目共用</span>
            </span>
          </button>
          <button class="menu-item" type="button" @click=${this._onReindexClick}>
            <doclens-icon class="icon" name="refresh-ccw"></doclens-icon>
            <span class="text">
              <span class="label">强制重建索引</span>
              <span class="desc">全量重扫工作目录</span>
            </span>
          </button>
          ${this._showSaveAndRevert ? html`
            <button class="menu-item" type="button" @click=${this._onRevertClick}>
              <doclens-icon class="icon" name="rotate-ccw"></doclens-icon>
              <span class="text">
                <span class="label">放弃修改</span>
                <span class="desc">恢复到 .env 当前值</span>
              </span>
            </button>
          ` : nothing}
        </div>
      </div>
      <toast-stack></toast-stack>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-bar": AppBar;
  }
}
