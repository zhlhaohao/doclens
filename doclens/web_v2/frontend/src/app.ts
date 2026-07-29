import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "./state/store";
import type { ViewId } from "./state/types";
import { router } from "./router/router";
import { getStatus } from "./api/status";
import { setUnauthorizedHandler } from "./api/client";
import { getAuthStatus } from "./api/auth";

import "./components/activity-bar";
import "./components/tab-bar";
import "./components/welcome-pane";
import "./components/focus-header";
import "./components/history-list";
import "./components/history-item";
import "./components/input-box";
import "./components/result-card";
import "./components/search-results";
import "./components/preview-pane";
import "./components/chat-message";
import "./components/chat-tool-trace";
import "./components/chat-stream";
import "./views/search-view";
import "./views/chat-view";
import "./views/settings-view";
import "./views/files-view";
import "./views/login-view";
import "./components/app-bar";
import "./components/reindex-dialog";
import { startWatchStream, stopWatchStream } from "./watch-stream";

@customElement("cortex-app")
export class CortexApp extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      overflow: hidden;
      background: var(--cortex-bg);
    }
    .app-body {
      flex: 1;
      display: flex;
      flex-direction: row;
      min-height: 0;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      position: relative;
    }
    /* keep-alive：各 view 常驻 DOM，用 [hidden] 切换显隐。
       各 view 自身 :host { display:flex } 与 UA [hidden]{display:none}
       特异度相同会覆盖掉 hidden，这里用 !important 压住，确保隐藏生效。 */
    .main > [hidden] { display: none !important; }
    /* 移动端：纵向布局（activity-bar 隐藏，tab-bar 在底部） */
    @media (max-width: 1023px) {
      .app-body { flex-direction: column; }
    }
  `;

  private _unsubscribe?: () => void;
  private _unsubAuth?: () => void;
  /** 主界面轮询/状态是否已启动（登录前不启动，登录成功后由订阅触发一次） */
  private _mainStarted = false;
  /** keep-alive：已挂载过的 view 集合。首次访问某 view 才挂载，之后常驻 DOM
   *  用 [hidden] 切换，view 实例不销毁 → 本地状态（预览内容/滚动位置/草稿等）保留。 */
  @state() private _mountedViews = new Set<ViewId>();

  protected willUpdate() {
    // 首次访问某 view 时才加入挂载集合（惰性：未访问的 view 不触发其 connectedCallback 副作用）
    const view = store.getState().view;
    if (view !== "login" && !this._mountedViews.has(view)) {
      this._mountedViews = new Set(this._mountedViews).add(view);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    // 启动 URL ↔ store 双向同步：初始 hash 规范化 + 订阅 hashchange
    router.init();
    // 订阅 store —— view 切换时触发重新渲染
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    // 401 统一处理：除登录页外，任何请求 401 → 跳登录页
    setUnauthorizedHandler(() => {
      if (store.getState().view !== "login") {
        actions.setAuthState({ authenticated: false });
        router.navigate("login");
      }
    });
    // 登录成功（authenticated false→true）后启动主界面轮询（幂等）
    this._unsubAuth = store.subscribeSelector(
      (s) => s.auth.authenticated,
      (authed) => { if (authed) this._startMain(); },
    );
    // 启动时探测登录闸门：需要登录且未认证 → 只渲染登录页，不启动轮询
    void this._probeAuth();
  }

  private async _probeAuth() {
    try {
      const s = await getAuthStatus();
      actions.setAuthState({
        required: s.required,
        authenticated: s.authenticated,
        hasPassword: s.has_password,
      });
      if (s.required && !s.authenticated) {
        router.navigate("login");
        return;
      }
    } catch {
      // 探测失败按免登录处理（后端异常时不把用户锁在门外）
      actions.setAuthState({ required: false, authenticated: true });
    }
    this._startMain();
  }

  private _startMain() {
    if (this._mainStarted) return;
    this._mainStarted = true;
    // 启动 watcher 状态 SSE 订阅（/api/watch/events，状态变化实时下发）
    startWatchStream();
    // 拉取一次 /api/status：
    //  - 模型名给 chat-view 渲染「思考中」用；
    //  - workdir / indexed_docs / file_types 给 welcome-pane（onboarding）渲染底部胶囊。
    // 失败静默：这些字段非关键，不阻塞 UI。
    void this._loadStatus();
  }

  private async _loadStatus() {
    try {
      const s = await getStatus();
      actions.setStatus(s);
    } catch {
      /* 静默失败：模型名 / workdir 非关键 */
    }
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    this._unsubAuth?.();
    setUnauthorizedHandler(null);
    // 停止 watcher 状态 SSE 订阅
    stopWatchStream();
    super.disconnectedCallback();
  }

  private _navigate(e: CustomEvent<{ view: ViewId; scope?: "local" | "global" }>) {
    // URL 是 view 的唯一真相源：通过 router 写 hash，hashchange 监听器再同步 store
    router.navigate(e.detail.view);
    if (e.detail.view === "settings" && e.detail.scope) {
      // scope 不进 URL（用户已确认"仅 tab 子路径"），仍走 store
      actions.setSettingsScope(e.detail.scope);
    }
  }

  private _renderView() {
    const view = store.getState().view;
    // keep-alive：已挂载的 view 全部常驻 DOM，用 [hidden] 切换；
    // 未挂载的（首次未访问）不输出，保持惰性。
    return html`
      ${this._mountedViews.has("search") ? html`<search-view ?hidden=${view !== "search"}></search-view>` : null}
      ${this._mountedViews.has("chat") ? html`<chat-view ?hidden=${view !== "chat"}></chat-view>` : null}
      ${this._mountedViews.has("files") ? html`<files-view ?hidden=${view !== "files"}></files-view>` : null}
      ${this._mountedViews.has("settings") ? html`<settings-view ?hidden=${view !== "settings"}></settings-view>` : null}
    `;
  }

  render() {
    const view = store.getState().view;
    // 登录页全屏独占：不渲染 app-bar / activity-bar / tab-bar / reindex-dialog
    if (view === "login") {
      return html`<login-view></login-view>`;
    }
    return html`
      <app-bar
        .activeView=${view}
        @navigate=${this._navigate}
      ></app-bar>
      <div class="app-body">
        <activity-bar .active=${view} @navigate=${this._navigate}></activity-bar>
        <div class="main">
          ${this._renderView()}
        </div>
        <tab-bar .active=${view} @navigate=${this._navigate}></tab-bar>
      </div>
      <reindex-dialog></reindex-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cortex-app": CortexApp;
  }
}
