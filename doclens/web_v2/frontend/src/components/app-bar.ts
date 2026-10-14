import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";

import appLogoSvg from "../assets/app_icon.svg?raw";

import "./toast-stack";
import "./control-panel-dialog";
import "./watch-changes-dialog";
import "./about-dialog";
import "./workdir-switch-dialog";
import { store, actions } from "../state/store";
import type { ViewId, SettingsScope, GitSyncStatus, WatcherStatus } from "../state/types";
import { logout } from "../api/auth";
import { closeWebview, isWebviewContainer } from "../utils/jsbridge";
import { router } from "../router/router";
import { watchStatusLabel } from "../utils/watch-status";
import {
  APP_THEME_LABELS,
  APP_THEME_ORDER,
  cycleAppTheme,
  onAppThemeChange,
  readAppTheme,
  type AppTheme,
} from "../utils/app-theme";

@customElement("app-bar")
export class AppBar extends LitElement {
  static styles = css`
    :host {
      /* 三列：左（X/品牌）｜中（宿主标题）｜右（徽标+头像）——中列 1fr 使标题
       * 光学居中且被截断时不挤两侧；toast-stack 与对话框为 fixed 脱流不占格。 */
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
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
      grid-column: 1;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-weight: 600;
      font-size: var(--cortex-fs-md);
    }
    /* 宿主标题（CONTEXT.md）：webview 内中央单行展示，超长省略号截断 */
    .center-title {
      grid-column: 2;
      min-width: 0;
      text-align: center;
      font-weight: 600;
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0 var(--cortex-space-2);
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
    /* WebView 容器内左侧关闭钮（替代 logo/标题）：视觉语言对齐 avatar-btn */
    .close-btn {
      grid-column: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      font-size: 20px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 50%;
      color: var(--cortex-text);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
    }
    .close-btn:hover {
      background: var(--cortex-primary-soft);
      border-color: var(--cortex-border);
    }
    .close-btn:focus-visible {
      outline: 2px solid var(--cortex-primary);
      outline-offset: 1px;
    }
    .right-cluster {
      grid-column: 3;
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
    /* ADR-0043 工作目录指示器：brand 旁的目录名 pill，点击弹切换面板。
       只显示目录末段名，全长在 title；超长省略号。 */
    .workdir-indicator {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      max-width: 220px;
      padding: 4px 10px;
      font-size: var(--cortex-fs-xs);
      font-family: inherit;
      color: var(--cortex-text);
      border: 1px solid var(--cortex-border);
      border-radius: 999px;
      background: var(--cortex-surface-muted);
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      transition: background 0.15s, border-color 0.15s;
    }
    .workdir-indicator:hover { background: var(--cortex-surface); border-color: var(--cortex-primary); }
    .workdir-indicator:focus-visible { outline: 2px solid var(--cortex-primary); outline-offset: 1px; }
    .workdir-indicator .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
    }
    /* 应用主题快捷钮（ADR-0043）：视觉同 watch-badge 的 icon-only pill */
    .theme-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      background: transparent;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 15px;
      transition: background 0.15s, border-color 0.15s;
    }
    .theme-btn:hover {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-primary);
      color: var(--cortex-primary);
    }
    @media (max-width: 1023px) {
      /* 移动端右侧空间紧张：watch-badge 隐藏（状态移入用户菜单）；
         主题快捷钮由 JS 条件渲染（_isMobileViewport，菜单项接管入口），
         此规则作 SSR/竞态兜底。 */
      .watch-badge { display: none; }
      /* 工作目录指示器保留但收窄（它是全局上下文，移动端同样需要） */
      .workdir-indicator { max-width: 120px; }
      .theme-btn { display: none; }
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
      color: var(--cortex-on-primary);
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
    .menu-item .desc {
      display: block;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-top: 2px;
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
  /** 工作目录切换对话框开关（ADR-0043：顶栏工作目录指示器点击） */
  @state() private _workdirDialogOpen = false;
  /** 应用主题（ADR-0043）：app-bar 快捷钮循环切换；订阅外部变更（设置页色卡）同步图标。 */
  @state() private _appTheme: AppTheme = readAppTheme();
  private _offAppThemeChange?: () => void;
  /** 移动视口（≤1023px，与 theme-btn/watch-badge 断点同口径）：主题入口只在
   *  用户菜单显示（header 钮隐藏省空间）；桌面反之——菜单项不重复。 */
  @state() private _isMobileViewport = AppBar._probeMobileViewport();
  private _mqList?: MediaQueryList;
  private _onMqChange = () => { this._isMobileViewport = AppBar._probeMobileViewport(); };

  private static _probeMobileViewport(): boolean {
    return typeof window.matchMedia === "function"
      && window.matchMedia("(max-width: 1023px)").matches;
  }
  /** 宿主标题（CONTEXT.md）：Android 宿主经 URL query `?title=`（URL 编码）
   *  传入，启动读一次（SPA 导航 query 保留，刷新重读）；trim 后空串视为
   *  未传。仅 webview 内渲染于 app bar 中央。 */
  private readonly _hostTitle: string | null = (() => {
    const t = new URLSearchParams(window.location.search).get("title")?.trim();
    return t ? t : null;
  })();
  private _unsubStore?: () => void;

  private _onWatchReindexed: (e: Event) => void = (e: Event) => {
    const detail = (e as CustomEvent).detail as { doc_count?: number | null; failed_count?: number };
    const n = detail?.doc_count;
    const failed = detail?.failed_count ?? 0;
    if (failed > 0) {
      this._pushToast(
        n != null ? `索引完成：${n} 文档，${failed} 个文件失败` : `索引完成：${failed} 个文件失败`,
        "error", 5000,
      );
    } else {
      this._pushToast(n != null ? `索引已更新：${n} 文档` : "索引已更新", "success", 3000);
    }
  };

  /** 图片旋转落盘完成：判向自动（ADR-0017）toast「已自动旋转」；
   *  预览期手动（ADR-0029）toast「已旋转」（用户刚点的，非自动）。 */
  private _onImageRotated: (e: Event) => void = (e: Event) => {
    const detail = (e as CustomEvent).detail as { path?: string; manual?: boolean };
    const name = (detail?.path ?? "").split("/").pop() || "图片";
    const verb = detail?.manual ? "已旋转" : "已自动旋转";
    this._pushToast(`${verb}：${name}`, "info", 4000);
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

  /** 菜单「重载页面」：整页 reload（解决 PWA 旧 bundle 不换新；
   *  从控制面板提升为一级入口，2026-10-14）。 */
  private _onReloadClick() {
    this._menuOpen = false;
    window.location.reload();
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
    // WebView 内该项语义为「退出」：关闭当前 WebView 退回 Android 宿主
    // （原生插件 closeHtmlPage），不做登出——App 内会话由 cookie 维持，
    // 下次进入仍是登录态
    if (this._inWebview) {
      this._exitWebview();
      return;
    }
    try {
      await logout();
    } catch {
      /* 网络错误也照旧跳登录页 */
    }
    actions.setAuthState({ authenticated: false });
    router.navigate("login");
  }

  /** 关闭 WebView 退回宿主（顶栏 X 与用户菜单「退出」共用；closeHtmlPage 同步通道） */
  private _exitWebview() {
    this._menuOpen = false;
    const fired = closeWebview((msg) => this._pushToast(`退出失败：${msg}`, "error", 5000));
    if (!fired) this._pushToast("当前环境不支持退出，请使用系统返回", "info", 4000);
  }

  /** 运行在 App WebView 容器内（顶栏左侧 logo/标题换关闭 X；菜单末项语义切换：注销登录 → 退出） */
  private get _inWebview(): boolean {
    return isWebviewContainer();
  }

  private _pushToast(message: string, level: "success" | "error" | "info", duration: number): void {
    const stack = this.shadowRoot?.querySelector("toast-stack") as
      (HTMLElement & { pushToast?: (m: string, l?: string, d?: number) => void }) | null;
    stack?.pushToast?.(message, level, duration);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onDocClick);
    window.addEventListener("cortex:watch-reindexed", this._onWatchReindexed as EventListener);
    window.addEventListener("cortex:image-rotated", this._onImageRotated as EventListener);
    this._appTheme = readAppTheme();
    this._offAppThemeChange = onAppThemeChange((t) => { this._appTheme = t; });
    this._mqList = typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 1023px)")
      : undefined;
    this._mqList?.addEventListener("change", this._onMqChange);
    this._syncFromStore();
    this._unsubStore = store.subscribe(() => this._syncFromStore());
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick);
    window.removeEventListener("cortex:watch-reindexed", this._onWatchReindexed as EventListener);
    window.removeEventListener("cortex:image-rotated", this._onImageRotated as EventListener);
    this._mqList?.removeEventListener("change", this._onMqChange);
    this._mqList = undefined;
    this._offAppThemeChange?.();
    this._offAppThemeChange = undefined;
    this._unsubStore?.();
    super.disconnectedCallback();
  }

  /** 应用主题快捷钮（ADR-0043）：循环三主题 + toast 反馈当前主题名；
   *  菜单内入口点击后收起菜单（同其他菜单项惯例）。 */
  private _cycleAppTheme(fromMenu = false) {
    if (fromMenu) this._menuOpen = false;
    const next = cycleAppTheme();
    const idx = APP_THEME_ORDER.indexOf(next);
    const seq = APP_THEME_ORDER.map((t, i) => (i === idx ? `【${APP_THEME_LABELS[t]}】` : APP_THEME_LABELS[t])).join(" → ");
    this._pushToast(`主题：${seq}`, "info", 2200);
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

  /** WebView 顶栏左侧关闭钮（替代 logo/标题）：关闭当前 WebView 退回 Android 宿主。 */
  private _renderWebviewClose() {
    return html`
      <button
        class="close-btn"
        type="button"
        data-testid="webview-close"
        aria-label="关闭"
        title="关闭并返回 App"
        @click=${this._exitWebview}
      ><doclens-icon name="x"></doclens-icon></button>
    `;
  }

  /** ADR-0043 工作目录指示器：显示当前目录末段名，点击弹切换面板。
   *  status 未返回时不渲染（onboarding 阶段无目录概念）。 */
  private _renderWorkdirIndicator() {
    const workdir = store.getState().status?.workdir;
    if (!workdir) return nothing;
    const name = workdir.replace(/[\\/]+/g, "/").split("/").filter(Boolean).pop() || workdir;
    return html`
      <button
        class="workdir-indicator"
        type="button"
        title="${workdir} — 点击切换工作目录"
        aria-label="切换工作目录"
        @click=${() => { this._workdirDialogOpen = true; }}
      ><doclens-icon name="folder"></doclens-icon><span class="name">${name}</span></button>
    `;
  }

  render() {
    return html`
      ${this._inWebview ? this._renderWebviewClose() : html`
        <div class="brand">
          <span class="logo">${unsafeSVG(appLogoSvg)}</span>
          ${this._renderWorkdirIndicator()}
        </div>
      `}
      ${this._inWebview && this._hostTitle
        ? html`<div class="center-title">${this._hostTitle}</div>`
        : nothing}
      <div class="right-cluster">
        ${!this._isMobileViewport ? html`
          <button
            class="theme-btn"
            type="button"
            aria-label=${`切换主题（当前：${APP_THEME_LABELS[this._appTheme]}）`}
            title=${`主题：${APP_THEME_LABELS[this._appTheme]}（点击切换）`}
            @click=${() => this._cycleAppTheme()}
          ><doclens-icon name="palette"></doclens-icon></button>
        ` : nothing}
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
          ${this._isMobileViewport ? html`
            <button class="menu-item" type="button" data-testid="theme-item" @click=${() => this._cycleAppTheme(true)}>
              <doclens-icon class="icon" name="palette"></doclens-icon>
              <span class="text">
                <span class="label">切换主题</span>
                <span class="desc">${APP_THEME_LABELS[this._appTheme]}（点击切换）</span>
              </span>
            </button>
          ` : nothing}
          <button class="menu-item" type="button" data-testid="control-panel-item" @click=${this._onControlPanelClick}>
            <doclens-icon class="icon" name="sliders-horizontal"></doclens-icon>
            <span class="text">
              <span class="label">控制面板</span>
            </span>
          </button>
          <button class="menu-item" type="button" data-testid="reload-item" @click=${this._onReloadClick}>
            <doclens-icon class="icon" name="refresh-cw"></doclens-icon>
            <span class="text">
              <span class="label">重载页面</span>
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
          ${this._inWebview || this._showLogout ? html`
            <button class="menu-item" type="button" data-testid="logout-item" @click=${this._onLogoutClick}>
              <doclens-icon class="icon" name="log-out"></doclens-icon>
              <span class="text">
                <span class="label">${this._inWebview ? "退出" : "注销登录"}</span>
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
      <workdir-switch-dialog
        .open=${this._workdirDialogOpen}
        .currentWorkdir=${store.getState().status?.workdir ?? ""}
        @close=${() => { this._workdirDialogOpen = false; }}
        @swap-start=${this._onSwapStart}
      ></workdir-switch-dialog>
    `;
  }

  /** 切换请求已发出（ADR-0043）：立即通知 app 层显示遮罩——不等 SSE
   *  终态事件（swap 窗口期 503 会挡住 status 轮询，遮罩必须先置位）。
   *  对话框保持打开（submitting 态显示「切换中…」）：失败时用户可原地
   *  修正重试；成功则页面整体 reload，对话框随之消失。 */
  private _onSwapStart = (e: Event) => {
    const target = (e as CustomEvent).detail?.target ?? "";
    window.dispatchEvent(new CustomEvent("cortex:workdir-swap-start", {
      detail: { target },
    }));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "app-bar": AppBar;
  }
}
