import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import { store, actions } from "./state/store";
import type { ViewId, Session } from "./state/types";

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
import "./views/history-view";

@customElement("cortex-app")
export class CortexApp extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      height: 100dvh;
      overflow: hidden;
      background: var(--cortex-bg);
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
      :host { flex-direction: column; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    // 监听跨 view 跳转（来自 history-view）
    window.addEventListener("cortex:open-session", this._onOpenSession as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener("cortex:open-session", this._onOpenSession as EventListener);
    super.disconnectedCallback();
  }

  private _onOpenSession = (e: Event) => {
    // 由对应 view 自行处理加载（search-view / chat-view 监听此事件）
    const detail = (e as CustomEvent<{ session: Session }>).detail;
    if (detail.session.type === "search") {
      actions.setView("search");
    } else {
      actions.setView("chat");
    }
    // 触发对应 view 加载（在 view 内部 connectedCallback 已加载；
    // 这里通过 store 切到 focus 态以便 view 自动处理）
    const ev = new CustomEvent("cortex:load-session", {
      detail: { session: detail.session },
      bubbles: true, composed: true,
    });
    setTimeout(() => this.dispatchEvent(ev), 0);
  };

  private _navigate(e: CustomEvent<{ view: ViewId }>) {
    actions.setView(e.detail.view);
  }

  private _renderView() {
    const view = store.getState().view;
    if (view === "search") return html`<search-view></search-view>`;
    if (view === "chat") return html`<chat-view></chat-view>`;
    return html`<history-view></history-view>`;
  }

  render() {
    const view = store.getState().view;
    return html`
      <activity-bar .active=${view} @navigate=${this._navigate}></activity-bar>
      <div class="main">
        ${this._renderView()}
      </div>
      <tab-bar .active=${view} @navigate=${this._navigate}></tab-bar>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cortex-app": CortexApp;
  }
}
