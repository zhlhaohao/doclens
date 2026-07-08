import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { Session, ChatMessage, ToolStep } from "../state/types";
import { chatStream } from "../api/chat";
import type { ChatStreamEvent } from "../api/chat";
import { createSession, appendSession, listSessions, clearSessions } from "../api/sessions";

/** 将一个流式事件不可变地应用到 messages，返回新数组；非 assistant 末条则原样返回。 */
export function applyStreamEvent(messages: ChatMessage[], ev: ChatStreamEvent): ChatMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== "assistant") return messages;
  const head = messages.slice(0, -1);

  if (ev.type === "token") {
    return [...head, { ...last, content: last.content + ev.text }];
  }
  if (ev.type === "tool_call") {
    const step: ToolStep = { tool_use_id: ev.tool_use_id, name: ev.name, input: ev.input, status: "running" };
    return [...head, { ...last, tool_steps: [...(last.tool_steps ?? []), step] }];
  }
  if (ev.type === "tool_result") {
    const tool_steps = (last.tool_steps ?? []).map((s) =>
      s.tool_use_id === ev.tool_use_id
        ? { ...s, output: ev.output, is_error: ev.is_error, duration_ms: ev.duration_ms,
            status: (ev.is_error ? "error" : "done") as ToolStep["status"] }
        : s
    );
    return [...head, { ...last, tool_steps }];
  }
  return messages;
}

/** 流式中断（连接断开 / 异常）时调用：把残留 running 步骤标记为 error（output「（已中断）」）。
 *  无 running 步骤则原样返回同一引用。 */
export function finalizeInterruptedMessages(messages: ChatMessage[]): ChatMessage[] {
  const hasRunning = messages.some(
    (m) => m.role === "assistant" && (m.tool_steps ?? []).some((s) => s.status === "running"),
  );
  if (!hasRunning) return messages;
  return messages.map((m) => {
    if (m.role !== "assistant" || !m.tool_steps) return m;
    return {
      ...m,
      tool_steps: m.tool_steps.map((s) =>
        s.status === "running"
          ? { ...s, status: "error" as const, is_error: true, output: s.output ?? "（已中断）" }
          : s,
      ),
    };
  });
}

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
    @media (min-width: 1024px) {
      /* 桌面端：居中列布局，避免全宽拉伸 */
      .initial-stack {
        max-width: 720px;
        margin: 0 auto;
        width: 100%;
      }
      chat-stream {
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
      }
      .input-bar {
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
      }
    }
  `;

  @state() private draft = "";
  @state() private historySessions: Session[] = [];
  @state() private _clearing = false;
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

  private async _onClearHistory() {
    this._clearing = true;
    this.requestUpdate();
    try {
      await clearSessions("chat");
      this.historySessions = [];
    } catch (e) {
      console.warn("clear sessions failed", e);
    } finally {
      this._clearing = false;
      this.requestUpdate();
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

    // assistant 占位 + 起始 messages（不可变）
    const placeholder: ChatMessage = { role: "assistant", content: "" };
    let messages = [...store.getState().chat.messages, placeholder];
    actions.setChatState({ messages });

    try {
      for await (const ev of chatStream({ message, session_id: sessionId })) {
        if (ev.type === "error") {
          messages = applyStreamEvent(messages, { type: "token", text: `\n\n⚠️ ${ev.detail}` });
          actions.setChatState({ messages });
        } else if (ev.type !== "done") {
          messages = applyStreamEvent(messages, ev);
          actions.setChatState({ messages });
        }
      }

      const aiMsg = messages[messages.length - 1];
      await appendSession(
        sessionId,
        [
          { kind: "message_user", payload: JSON.stringify({ content: message }) },
          { kind: "message_ai", payload: JSON.stringify({ content: aiMsg.content, tool_calls: aiMsg.tool_steps ?? [] }) },
        ],
        messages.length,
      );
      this._loadHistory();
    } catch (err) {
      // 连接中断 / 异常：保留已收到内容，把残留 running 步骤标记为中断
      messages = finalizeInterruptedMessages(messages);
      actions.setChatState({ messages });
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
          <welcome-pane heading="Doclens" subheading="与你的知识库对话"></welcome-pane>
          <history-list
            title="历史会话"
            type="chat"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}
            @clear=${this._onClearHistory}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder="问 Doclens 任何问题..."
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
