import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { Session } from "../state/types";
import { chatStream } from "../api/chat";
import { createSession, appendSession, listSessions } from "../api/sessions";

@customElement("chat-view")
export class ChatView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
    }
    .initial-stack {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .input-row {
      padding: var(--cortex-space-4) var(--cortex-space-6);
      flex-shrink: 0;
    }
    .focus-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .input-bar {
      padding: var(--cortex-space-3) var(--cortex-space-6);
      border-top: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
  `;

  @state() private draft = "";
  @state() private historySessions: Session[] = [];
  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._loadHistory();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    // 消费跨视图会话加载请求（来自 history-view）
    const pending = store.getState().pendingSession;
    if (pending && pending.type === "chat") {
      actions.setPendingSession(null);
      this._loadSession(pending);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  private async _loadHistory() {
    try {
      const { sessions } = await listSessions({ type: "chat", limit: 20 });
      this.historySessions = sessions;
    } catch (e) {
      console.warn("load history failed", e);
    }
  }

  private get viewState() {
    return store.getState().chat;
  }

  private async _submit(e: CustomEvent<{ value: string }>) {
    const message = e.detail.value;
    this.draft = "";

    // 转入 focus 态
    if (this.viewState.state === "initial") {
      const created = await createSession({ type: "chat", title: message.slice(0, 60), preview: message.slice(0, 100) });
      actions.setChatState({
        state: "focus",
        currentSession: {
          id: created.id, type: "chat", title: message.slice(0, 60),
          preview: message.slice(0, 100), updated_at: new Date().toISOString(),
          message_count: 0,
        },
        messages: [{ role: "user", content: message }],
        streaming: true,
      });
    } else {
      actions.setChatState({
        messages: [...this.viewState.messages, { role: "user", content: message }],
        streaming: true,
      });
    }

    const sessionId = store.getState().chat.currentSession!.id;

    // 添加 assistant 占位
    actions.setChatState({
      messages: [...store.getState().chat.messages, { role: "assistant", content: "" }],
    });

    try {
      let aiText = "";
      for await (const ev of chatStream({ message, session_id: sessionId })) {
        if (ev.type === "token") {
          aiText += ev.text;
          const msgs = [...store.getState().chat.messages];
          msgs[msgs.length - 1] = { role: "assistant", content: aiText };
          actions.setChatState({ messages: msgs });
        } else if (ev.type === "error") {
          const msgs = [...store.getState().chat.messages];
          msgs[msgs.length - 1] = { role: "assistant", content: aiText + `\n\n⚠️ ${ev.detail}` };
          actions.setChatState({ messages: msgs });
        }
      }

      // 持久化
      await appendSession(sessionId, [
        { kind: "message_user", payload: JSON.stringify({ content: message }) },
        { kind: "message_ai", payload: JSON.stringify({ content: aiText }) },
      ], store.getState().chat.messages.length);
      this._loadHistory();
    } catch (err) {
      actions.setError(`对话失败: ${(err as Error).message}`);
    } finally {
      actions.setChatState({ streaming: false });
    }
  }

  private _backToInitial() {
    actions.setChatState({ state: "initial", currentSession: null, messages: [] });
    this._loadHistory();
  }

  private async _loadSession(s: Session) {
    actions.setChatState({
      state: "focus",
      currentSession: s,
      messages: [],
    });
    try {
      const res = await fetch(`/api/sessions/${s.id}`);
      if (res.ok) {
        const body = await res.json();
        const messages = (body.items || []).map((i: any) => {
          const payload = JSON.parse(i.payload);
          return { role: i.kind === "message_user" ? "user" : "assistant", content: payload.content };
        });
        actions.setChatState({ messages });
      }
    } catch (e) {
      console.warn("load session failed", e);
    }
  }

  private _onHistorySelect(e: CustomEvent<{ session: Session }>) {
    this._loadSession(e.detail.session);
  }

  render() {
    const s = this.viewState;
    if (s.state === "initial") {
      return html`
        <div class="initial-stack">
          <welcome-pane heading="Cortex" subheading="与你的知识库对话"></welcome-pane>
          <history-list
            title="历史会话"
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder="问 Cortex 任何问题..."
              button-label="→"
              multiline
              .value=${this.draft}
              @input-change=${(e: any) => (this.draft = e.detail.value)}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;
    }
    return html`
      <div class="focus-body">
        <focus-header
          back-label="新对话"
          title=${s.currentSession?.title ?? ""}
          meta=${`${s.messages.length} 条消息`}
          @back=${this._backToInitial}>
        </focus-header>
        <chat-stream .messages=${s.messages}></chat-stream>
        <div class="input-bar">
          <input-box
            placeholder="继续对话..."
            button-label="→"
            multiline
            ?disabled=${s.streaming}
            .value=${this.draft}
            @input-change=${(e: any) => (this.draft = e.detail.value)}
            @submit=${this._submit}>
          </input-box>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-view": ChatView;
  }
}
