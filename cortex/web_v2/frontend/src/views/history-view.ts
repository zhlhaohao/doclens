import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { listSessions } from "../api/sessions";
import { actions } from "../state/store";
import type { Session } from "../state/types";

@customElement("history-view")
export class HistoryView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
    }
  `;

  @state() private sessions: Session[] = [];
  @state() private loading = true;

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private async _load() {
    this.loading = true;
    try {
      const { sessions } = await listSessions({ limit: 100 });
      this.sessions = sessions;
    } catch (e) {
      console.warn("load history failed", e);
    } finally {
      this.loading = false;
    }
  }

  private _onSelect(e: CustomEvent<{ session: Session }>) {
    const s = e.detail.session;
    // 通过 store 信号传递会话，目标 view 在 connectedCallback 中消费
    actions.setPendingSession(s);
    actions.setView(s.type === "search" ? "search" : "chat");
  }

  render() {
    return html`
      <welcome-pane heading="历史会话" subheading="全部搜索与对话历史"></welcome-pane>
      <history-list
        title=${this.loading ? "加载中..." : "最近会话"}
        .sessions=${this.sessions}
        @select=${this._onSelect}>
      </history-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-view": HistoryView;
  }
}
