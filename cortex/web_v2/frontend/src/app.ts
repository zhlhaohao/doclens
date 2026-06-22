import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import { store, actions } from "./state/store";
import type { ViewId } from "./state/types";

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
import "./components/chat-stream";
import "./views/search-view";
import "./views/chat-view";
import "./views/settings-view";
import "./views/files-view";
import "./components/app-bar";

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
    // 订阅 store —— view 切换时触发重新渲染
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private _navigate(e: CustomEvent<{ view: ViewId; scope?: "local" | "global" }>) {
    actions.setView(e.detail.view);
    if (e.detail.view === "settings" && e.detail.scope) {
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cortex-app": CortexApp;
  }
}
