import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { Session } from "../state/types";
import { chatStream } from "../api/chat";
import { createSession, appendSession, listSessions, clearSessions } from "../api/sessions";
import { fetchPreview } from "../api/preview";
import type { PageMarker } from "../api/preview";
import "../components/preview-pane";
import "../components/toast-stack";
import type { ToastStack } from "../components/toast-stack";

@customElement("chat-view")
export class ChatView extends LitElement {
  static readonly PREVIEW_PANE_WIDTH_KEY = "cortex.chatPreviewWidth";
  static readonly PREVIEW_PANE_WIDTH_DEFAULT = 420;
  static readonly PREVIEW_PANE_WIDTH_MIN = 300;
  static readonly PREVIEW_PANE_WIDTH_MAX = 900;

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
    .focus-main {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
    }
    /* 桌面 preview 关闭：chat-stream 居中（现状） */
    @media (min-width: 1024px) {
      .focus-main:not(.has-preview) chat-stream {
        max-width: 800px;
        margin: 0 auto;
        width: 100%;
      }
    }
    /* 桌面 preview 打开：水平排布，chat-stream 让位 */
    @media (min-width: 1024px) {
      .focus-main.has-preview {
        flex-direction: row;
        padding: var(--cortex-space-3);
      }
      .focus-main.has-preview chat-stream {
        flex: 1 1 0;
        min-width: 0;
        max-width: none;
      }
    }
    .focus-main .splitter {
      flex: 0 0 4px;
      cursor: col-resize;
      background: var(--cortex-border);
      transition: background 0.15s;
    }
    .focus-main .splitter:hover,
    .focus-main .splitter:active {
      background: var(--cortex-primary);
    }
    .focus-main .preview-pane-wrap {
      flex: 0 0 var(--preview-pane-width, 420px);
      min-width: 300px;
      max-width: 900px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      position: relative;
    }
    .focus-main .preview-close {
      position: absolute;
      top: 6px;
      right: 8px;
      z-index: 2;
      border: none;
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .focus-main .not-indexed-hint {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      padding: 24px;
      text-align: center;
    }
    /* 移动端：桌面 splitter / preview-pane-wrap 隐藏 */
    @media (max-width: 1023px) {
      .focus-main .splitter,
      .focus-main .preview-pane-wrap,
      .focus-main .desktop-only {
        display: none;
      }
    }
    /* 移动端预览 overlay */
    .preview-overlay {
      position: absolute;
      inset: 0;
      background: var(--cortex-surface);
      display: flex;
      flex-direction: column;
      z-index: 10;
    }
    @media (min-width: 1024px) {
      .preview-overlay {
        display: none;
      }
    }
    @media (min-width: 1024px) {
      /* 桌面端：居中列布局，避免全宽拉伸 */
      .initial-stack {
        max-width: 720px;
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
  @state() private previewOpen = false;
  @state() private previewContent = "";
  @state() private previewPath = "";
  @state() private previewLanguage = "text";
  @state() private previewPages: PageMarker[] | null = null;
  @state() private previewWritable = false;
  @state() private previewError: "NOT_INDEXED" | null = null;
  @state() private previewDirty = false;
  @state() private _previewPaneWidth = ChatView.PREVIEW_PANE_WIDTH_DEFAULT;
  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._loadHistory();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._loadPreviewPaneWidth();
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

  private _loadPreviewPaneWidth(): void {
    const saved = localStorage.getItem(ChatView.PREVIEW_PANE_WIDTH_KEY);
    if (!saved) return;
    const w = Number(saved);
    if (!Number.isNaN(w)) {
      this._previewPaneWidth = Math.max(
        ChatView.PREVIEW_PANE_WIDTH_MIN,
        Math.min(ChatView.PREVIEW_PANE_WIDTH_MAX, w),
      );
    }
  }

  private _onSplitterMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this._previewPaneWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(
        ChatView.PREVIEW_PANE_WIDTH_MIN,
        Math.min(ChatView.PREVIEW_PANE_WIDTH_MAX, startWidth + (ev.clientX - startX)),
      );
      if (w !== this._previewPaneWidth) this._previewPaneWidth = w;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(ChatView.PREVIEW_PANE_WIDTH_KEY, String(this._previewPaneWidth));
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  private get _previewKeyword(): string {
    const msgs = store.getState().chat.messages;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") return msgs[i].content;
    }
    return "";
  }

  private async _onReferenceClick(e: CustomEvent<{ path: string }>): Promise<void> {
    await this._safeAction(async () => {
      const path = e.detail.path;
      this.previewError = null;
      const result = await fetchPreview(path);
      if (result.ok) {
        this.previewContent = result.content;
        this.previewPath = result.path;
        this.previewLanguage = result.language;
        this.previewWritable = result.writable;
        this.previewPages = result.pages;
        this.previewOpen = true;
      } else if (result.notIndexed) {
        this.previewError = "NOT_INDEXED";
        this.previewContent = "";
        this.previewPath = path;
        this.previewWritable = false;
        this.previewPages = null;
        this.previewOpen = true;
      } else {
        this._pushToast(`预览失败：${result.message}`, "error", 5000);
      }
    });
  }

  private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>): void => {
    this.previewDirty = e.detail.dirty;
  };

  private _closePreview = async (): Promise<void> => {
    await this._safeAction(() => {
      this.previewOpen = false;
    });
  };

  private async _safeAction(action: () => void | Promise<void>): Promise<void> {
    if (this.previewDirty) {
      const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
      if (!ok) return;
      const pp = this.shadowRoot?.querySelector("preview-pane") as any;
      pp?.discard?.();
      this.previewDirty = false;
    }
    await action();
  }

  private _pushToast(message: string, level: "success" | "error" | "info", duration: number): void {
    const stack = this.shadowRoot?.querySelector("toast-stack") as ToastStack | null;
    stack?.pushToast(message, level, duration);
  }

  private _renderNotIndexedHint(): unknown {
    return html`<div class="not-indexed-hint">
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`;
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
    const hasPreview = this.previewOpen;
    const previewPane = (noHeader: boolean) => html`<preview-pane
      ?noHeader=${noHeader}
      path=${this.previewPath}
      language=${this.previewLanguage}
      content=${this.previewContent}
      .keyword=${this._previewKeyword}
      ?writable=${this.previewWritable}
      .pages=${this.previewPages}
      @dirty-change=${this._onPreviewDirty}>
    </preview-pane>`;
    return html`
      <toast-stack></toast-stack>
      <div class="focus-body">
        <focus-header
          back-label="新对话"
          title=${s.currentSession?.title ?? ""}
          meta=${`${s.messages.length} 条消息`}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main ${hasPreview ? "has-preview" : ""}"
             style="--preview-pane-width: ${this._previewPaneWidth}px">
          <chat-stream
            .messages=${s.messages}
            @reference-click=${this._onReferenceClick}>
          </chat-stream>
          ${hasPreview ? html`
            <div class="splitter desktop-only"
                 role="separator"
                 aria-orientation="vertical"
                 aria-label="调整预览栏宽度"
                 @mousedown=${this._onSplitterMouseDown}></div>
            <div class="preview-pane-wrap desktop-only">
              <button class="preview-close" type="button" aria-label="关闭预览"
                      @click=${this._closePreview}>✕</button>
              ${this.previewError === "NOT_INDEXED"
                ? this._renderNotIndexedHint()
                : previewPane(false)}
            </div>` : null}
        </div>
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
      ${hasPreview ? html`
        <div class="preview-overlay">
          <focus-header
            back-label="返回"
            title=${this.previewPath}
            @back=${this._closePreview}>
          </focus-header>
          ${this.previewError === "NOT_INDEXED"
            ? this._renderNotIndexedHint()
            : previewPane(true)}
        </div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-view": ChatView;
  }
}
