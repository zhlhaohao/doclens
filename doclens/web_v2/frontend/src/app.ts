import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import { store, actions } from "./state/store";
import type { ViewId } from "./state/types";
import { router } from "./router/router";
import { getStatus } from "./api/status";

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
    /* 移动端：纵向布局（activity-bar 隐藏，tab-bar 在底部） */
    @media (max-width: 1023px) {
      .app-body { flex-direction: column; }
    }
  `;

  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    // 启动 URL ↔ store 双向同步：初始 hash 规范化 + 订阅 hashchange
    router.init();
    // 订阅 store —— view 切换时触发重新渲染
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
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
    if (view === "chat") return html`<chat-view></chat-view>`;
    if (view === "settings") return html`<settings-view></settings-view>`;
    if (view === "files") return html`<files-view></files-view>`;
    return html`<search-view></search-view>`;
  }

  render() {
    const view = store.getState().view;
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
