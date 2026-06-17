import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { clearSessions, listSessions } from "../api/sessions";
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
  @state() private _clearing = false;

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

  private async _onClear() {
    this._clearing = true;
    this.requestUpdate();
    try {
      await clearSessions();  // 不传 type，清全部
      await this._load();
    } catch (e) {
      console.warn("clear sessions failed", e);
    } finally {
      this._clearing = false;
      this.requestUpdate();
    }
  }

  render() {
    return html`
      <welcome-pane heading="历史会话" subheading="全部搜索与对话历史"></welcome-pane>
      <history-list
        title=${this.loading ? "加载中..." : "最近会话"}
        ?clearing=${this._clearing}
        .sessions=${this.sessions}
        @select=${this._onSelect}
        @clear=${this._onClear}>
      </history-list>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-view": HistoryView;
  }
}
