import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import appLogoSvg from "../assets/app_icon.svg?raw";

import "./toast-stack";
import "./control-panel-dialog";
import "./watch-changes-dialog";
import "./about-dialog";
import { store, actions } from "../state/store";
import type { ViewId, SettingsScope, GitSyncStatus, WatcherStatus } from "../state/types";
import { logout } from "../api/auth";
import { router } from "../router/router";
import { watchStatusLabel } from "../utils/watch-status";

@customElement("app-bar")
export class AppBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 56px;
      padding: 0 calc(var(--cortex-space-2) + 4px);
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
      font-family: inherit;
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 999px;
      background: var(--cortex-surface-muted);
      white-space: nowrap;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      transition: background 0.15s, border-color 0.15s;
    }
    .watch-badge:hover {
      background: var(--cortex-surface);
      border-color: var(--cortex-primary);
    }
    .watch-badge:focus-visible {
      outline: 2px solid var(--cortex-primary);
      outline-offset: 1px;
    }
    .watch-badge.dot { color: var(--cortex-success); }
    .watch-badge.busy { color: var(--cortex-primary); }
    .watch-badge.warn { color: var(--cortex-warning); }
    /* Git 同步徽标：非交互（纯状态展示），复用 watch-badge 视觉 */
    .sync-badge { cursor: default; }
    .sync-badge:hover { background: var(--cortex-surface-muted); border-color: var(--cortex-border); }
    @media (max-width: 1023px) {
      /* 移动端右侧空间紧张：watch-badge 隐藏（状态移入用户菜单）。 */
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
  `;

  @property() activeView: ViewId = "search";

  @state() private _menuOpen = false;
  @state() private _showSaveAndRevert = false;
  /** 登录闸门生效且已登录时，菜单显示“注销登录” */
  @state() private _showLogout = false;
  /** watch 变化对话框开关（点击 watch 徽标打开 / 控制面板「文件监控」行） */
  @state() private _watchDialogOpen = false;
  /** 控制面板对话框开关（用户菜单「控制面板」：收纳刷新/重建索引/文件监控） */
  @state() private _panelOpen = false;
  /** 关于对话框开关（用户菜单「关于」）：显示前后端构建版本 */
  @state() private _aboutOpen = false;
  private _unsubStore?: () => void;

  private _onWatchReindexed: (e: Event) => void = (e: Event) => {
    const detail = (e as CustomEvent).detail as { doc_count?: number | null; failed_count?: number };
    const stack = this.shadowRoot?.querySelector("toast-stack") as
      (HTMLElement & { pushToast?: (m: string, l?: string, d?: number) => void }) | null;
    const n = detail?.doc_count;
    const failed = detail?.failed_count ?? 0;
    if (failed > 0) {
      stack?.pushToast?.(
        n != null ? `索引完成：${n} 文档，${failed} 个文件失败` : `索引完成：${failed} 个文件失败`,
        "error", 5000,
      );
    } else {
      stack?.pushToast?.(n != null ? `索引已更新：${n} 文档` : "索引已更新", "success", 3000);
    }
  };

  /** 上传图片后台判向旋转完成（ADR-0017）：toast 告知用户文件已被自动转正。 */
  private _onImageRotated: (e: Event) => void = (e: Event) => {
    const detail = (e as CustomEvent).detail as { path?: string };
    const stack = this.shadowRoot?.querySelector("toast-stack") as
      (HTMLElement & { pushToast?: (m: string, l?: string, d?: number) => void }) | null;
    const name = (detail?.path ?? "").split("/").pop() || "图片";
    stack?.pushToast?.(`已自动旋转：${name}`, "info", 4000);
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

  /** 菜单「控制面板」：打开维护操作面板（刷新 / 强制重建索引 / 文件监控）。 */
  private _onControlPanelClick() {
    this._menuOpen = false;
    this._panelOpen = true;
  }

  /** 面板「文件监控」行 → 关面板开 watch 变化对话框。 */
  private _onPanelOpenWatch() {
    this._panelOpen = false;
    this._watchDialogOpen = true;
  }

  /** 菜单「关于」：打开构建版本对话框（测试时确认前后端均为最新构建）。 */
  private _onAboutMenuClick() {
    this._menuOpen = false;
    this._aboutOpen = true;
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

  private async _onLogoutClick() {
    this._menuOpen = false;
    try {
      await logout();
    } catch {
      /* 网络错误也照旧跳登录页 */
    }
    actions.setAuthState({ authenticated: false });
    router.navigate("login");
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onDocClick);
    window.addEventListener("cortex:watch-reindexed", this._onWatchReindexed as EventListener);
    window.addEventListener("cortex:image-rotated", this._onImageRotated as EventListener);
    this._syncFromStore();
    this._unsubStore = store.subscribe(() => this._syncFromStore());
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick);
    window.removeEventListener("cortex:watch-reindexed", this._onWatchReindexed as EventListener);
    window.removeEventListener("cortex:image-rotated", this._onImageRotated as EventListener);
    this._unsubStore?.();
    super.disconnectedCallback();
  }

  private _syncFromStore() {
    const s = store.getState();
    this._showSaveAndRevert = s.view === "settings" && s.settings.dirty;
    this._showLogout = s.auth.required === true && s.auth.authenticated;
    this.requestUpdate();
  }

  private _openWatchDialog() {
    this._watchDialogOpen = true;
  }

  /** Git 同步徽标（ADR-0006）：仅同步循环运行中或有弱提醒时出现；
   *  整体停摆（非 git 根/无 remote）不渲染——功能关闭不是错误，不制造噪音。 */
  private _renderSyncBadge(s: GitSyncStatus | null) {
    if (!s || (!s.running && !s.message)) return nothing;
    const warn = s.message !== "" || s.last_success === false;
    const cls = warn ? "warn" : "dot";
    const label = warn ? `⚠${s.message || "同步失败"}` : "●同步";
    return html`
      <span
        class="watch-badge sync-badge ${cls}"
        role="status"
        aria-label="Git 同步状态"
        title=${s.message || "知识库 Git 同步运行中"}
      ><doclens-icon name="globe"></doclens-icon>${label}</span>
    `;
  }

  /** watch 状态文案/色调：顶栏徽标用（与控制面板文件监控行共用 utils/watch-status）。 */
  private _watchStatus(w: WatcherStatus | null): { cls: string; label: string } {
    return watchStatusLabel(w);
  }

  private _renderWatchBadge(w: WatcherStatus | null) {
    const { cls, label } = this._watchStatus(w);
    return html`
      <button
        class="watch-badge ${cls}"
        type="button"
        aria-label="文件监控状态"
        title="点击查看近期文件变化"
        @click=${this._openWatchDialog}
      ><doclens-icon name="folder"></doclens-icon>${label}</button>
    `;
  }

  render() {
    return html`
      <div class="brand">
        <span class="logo">${unsafeSVG(appLogoSvg)}</span>
        <span>Doclens</span>
      </div>
      <div class="right-cluster">
        ${this._renderSyncBadge(store.getState().syncStatus)}
        ${this._renderWatchBadge(store.getState().watcher)}
        <button class="avatar-btn" @click=${this._onAvatarClick} aria-label="用户菜单">
          <span class="avatar"><doclens-icon name="user" style="font-size:18px"></doclens-icon></span>
        </button>
        <div class="user-menu ${this._menuOpen ? "open" : ""}">
          <button class="menu-item" type="button" @click=${() => this._onScopeSelect("global")}>
            <doclens-icon class="icon" name="globe"></doclens-icon>
            <span class="text">
              <span class="label">全局配置</span>
            </span>
          </button>
          <button class="menu-item" type="button" data-testid="control-panel-item" @click=${this._onControlPanelClick}>
            <doclens-icon class="icon" name="sliders-horizontal"></doclens-icon>
            <span class="text">
              <span class="label">控制面板</span>
            </span>
          </button>
          <button class="menu-item" type="button" data-testid="about-item" @click=${this._onAboutMenuClick}>
            <doclens-icon class="icon" name="info"></doclens-icon>
            <span class="text">
              <span class="label">关于</span>
            </span>
          </button>
          ${this._showSaveAndRevert ? html`
            <button class="menu-item" type="button" @click=${this._onRevertClick}>
              <doclens-icon class="icon" name="rotate-ccw"></doclens-icon>
              <span class="text">
                <span class="label">放弃修改</span>
              </span>
            </button>
          ` : nothing}
          ${this._showLogout ? html`
            <button class="menu-item" type="button" data-testid="logout-item" @click=${this._onLogoutClick}>
              <doclens-icon class="icon" name="log-out"></doclens-icon>
              <span class="text">
                <span class="label">注销登录</span>
              </span>
            </button>
          ` : nothing}
        </div>
      </div>
      <toast-stack></toast-stack>
      <control-panel-dialog
        .open=${this._panelOpen}
        @close=${() => { this._panelOpen = false; }}
        @open-watch=${this._onPanelOpenWatch}
      ></control-panel-dialog>
      <watch-changes-dialog
        .open=${this._watchDialogOpen}
        @close=${() => { this._watchDialogOpen = false; }}
      ></watch-changes-dialog>
      <about-dialog
        .open=${this._aboutOpen}
        @close=${() => { this._aboutOpen = false; }}
      ></about-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-bar": AppBar;
  }
}
