import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { Session, ChatMessage, Reference, ToolStep } from "../state/types";
import { chatStream } from "../api/chat";
import type { ChatStreamEvent } from "../api/chat";
import { createSession, appendSession, listSessions, clearSessions } from "../api/sessions";
import { fetchPreview } from "../api/preview";
import type { PageMarker } from "../api/preview";
import "../components/preview-pane";
import "../components/toast-stack";
import type { ToastStack } from "../components/toast-stack";

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
  if (ev.type === "references") {
    return [...head, { ...last, references: ev.items }];
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

/** 把后端 session_items 映射为 ChatMessage[]；tool_calls → tool_steps，老数据向后兼容。 */
export function mapSessionItemsToMessages(
  items: Array<{ kind: string; payload: string }>,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const it of items) {
    let payload: any;
    try {
      payload = JSON.parse(it.payload);
    } catch {
      continue;
    }
    if (it.kind === "message_user") {
      messages.push({ role: "user", content: payload.content ?? "" });
    } else if (it.kind === "message_ai") {
      const tool_steps: ToolStep[] = (payload.tool_calls ?? []).map((tc: any) => ({
        tool_use_id: tc.tool_use_id ?? "",
        name: tc.name ?? "",
        input: tc.input ?? {},
        output: tc.output,
        is_error: tc.is_error,
        duration_ms: tc.duration_ms,
        status: tc.is_error ? ("error" as const) : ("done" as const),
      }));
      const references: Reference[] = (payload.references ?? [])
        .map((r: any) => ({ path: String(r?.path ?? "") }))
        .filter((r: Reference) => r.path.length > 0);
      const msg: ChatMessage = { role: "assistant", content: payload.content ?? "" };
      if (tool_steps.length) msg.tool_steps = tool_steps;
      if (references.length) msg.references = references;
      messages.push(msg);
    }
  }
  return messages;
}

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
      background: var(--cortex-view-bg);
    }
    .initial-stack {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      /* 顶部蓝色光晕：让白色卡片从背景中浮出，增加层次感 */
      background:
        radial-gradient(720px 280px at 50% -80px, rgba(0, 82, 255, 0.08), transparent 70%);
    }
    .input-row {
      padding: 6px var(--cortex-space-6) 18px;
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
      background: var(--cortex-view-bg);
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
        max-width: 820px;
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
      background: var(--cortex-border-muted);
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
      background: var(--cortex-card-bg);
      border-radius: var(--cortex-radius-lg);
      border: 1px solid var(--cortex-border-muted);
    }
    .focus-main .preview-close {
      position: absolute;
      top: 6px;
      right: 8px;
      z-index: 2;
      width: 26px;
      height: 26px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      padding: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .focus-main .preview-close:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .focus-main .not-indexed-hint {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-md);
      color: var(--cortex-text-muted);
      padding: var(--cortex-space-6);
      margin: var(--cortex-space-3);
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
      background: var(--cortex-card-bg);
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
        max-width: 760px;
        margin: 0 auto;
        width: 100%;
      }
      .input-bar {
        max-width: 820px;
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
    this._resetPreview();
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
        } else if (ev.type === "toast") {
          this._pushToast(ev.detail, ev.level, 5000);
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
          { kind: "message_ai", payload: JSON.stringify({ content: aiMsg.content, tool_calls: aiMsg.tool_steps ?? [], references: aiMsg.references ?? [] }) },
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
    this._resetPreview();
    actions.setChatState({ state: "initial", currentSession: null, messages: [] });
    this._loadHistory();
  }

  /** 清空预览 pane 的全部状态（导航离开当前对话时调用，避免残留旧文档）。
   *  不重置 _previewPaneWidth（用户偏好，持久）。 */
  private _resetPreview(): void {
    this.previewOpen = false;
    this.previewContent = "";
    this.previewPath = "";
    this.previewLanguage = "text";
    this.previewPages = null;
    this.previewWritable = false;
    this.previewError = null;
    this.previewDirty = false;
  }

  private async _loadSession(s: Session) {
    this._resetPreview();
    actions.setChatState({
      state: "focus",
      currentSession: s,
      messages: [],
    });
    try {
      const res = await fetch(`/api/sessions/${s.id}`);
      if (res.ok) {
        const body = await res.json();
        const messages = mapSessionItemsToMessages(body.items || []);
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
        Math.min(ChatView.PREVIEW_PANE_WIDTH_MAX, startWidth - (ev.clientX - startX)),
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

  /** 把 AI 给的参考资料格式规范化为 fetchPreview 可解析的 path。
   *  处理：markdown 链接 [text](url) → url；剥 file:// 前缀；URL decode。
   *  兼容 AI 偶发用 markdown 链接或 file URL 的情况（治本，让 click 永远能打开）。 */
  private _normalizeReferencePath(raw: string): string {
    let p = (raw ?? "").trim();
    if (!p) return "";
    // 1) 剥 markdown 链接 [text](url) → url
    const md = p.match(/^\[.*?\]\((.*?)\)$/);
    if (md) p = md[1].trim();
    // 2) 剥 file:// 前缀（file:// 或 file:/// 都处理）
    p = p.replace(/^file:\/\/\/?/i, "");
    // 3) URL decode（处理 %20 等）
    try { p = decodeURIComponent(p); } catch { /* leave as-is */ }
    return p;
  }

  private async _onReferenceClick(e: CustomEvent<{ path: string }>): Promise<void> {
    await this._safeAction(async () => {
      const path = this._normalizeReferencePath(e.detail.path);
      if (!path) {
        this._pushToast("参考路径为空", "error", 5000);
        return;
      }
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

  private _onPreviewSaved = (): void => {
    this.previewDirty = false;
    this._pushToast("已保存", "success", 2500);
  };

  private _onPreviewSaveFailed = (e: CustomEvent<{ message: string }>): void => {
    this._pushToast(`保存失败：${e.detail.message}`, "error", 5000);
  };

  private _onPreviewUploadSuccess = (e: CustomEvent<{ path: string }>): void => {
    // 清掉可能残留的编辑脏标志（上传可能发生在 edit 模式下），避免
    // 后续切换结果时弹出陈旧的"丢弃修改？"确认框
    this.previewDirty = false;
    this._pushToast(`已覆盖：${e.detail.path}`, "success", 2500);
    // 上传是外部覆盖（不像 PUT /api/preview 已含新内容），必须重新拉取
    void this._reloadPreview();
  };

  private _onPreviewUploadFailed = (e: CustomEvent<{ message: string }>): void => {
    this._pushToast(`上传失败：${e.detail.message}`, "error", 5000);
  };

  /** 上传成功后用：按当前 previewPath 重新拉取完整预览内容（不缩行范围）。 */
  private async _reloadPreview(): Promise<void> {
    if (!this.previewPath) return;
    const r = await fetchPreview(this.previewPath);
    if (r.ok) {
      this.previewContent = r.content;
      this.previewLanguage = r.language;
      this.previewWritable = r.writable;
      this.previewPages = r.pages;
    }
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
          <welcome-pane
            variant="onboarding"
            heading="与你的知识库对话"
            subheading="用自然语言提问，AI 会自动检索当前工作目录{workdir} 的知识库并引用原文回答"
            .modes=${[
              { label: "自动检索", icon: "🔍" },
              { label: "引用原文", icon: "📑" },
            ]}
            .examples=${[
              "总结上周写过的所有技术文档",
              "找出所有提到 X 的段落并对比",
              "这篇文章的核心观点是什么？",
            ]}
            .workdir=${store.getState().status?.workdir ?? ""}
          ></welcome-pane>
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
              .buttonLabel=${"知识库对话"}
              style="--cortex-input-btn-reserve: 112px"
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
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}>
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
            .modelName=${store.getState().status?.model_name ?? null}
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
            .buttonLabel=${"知识库对话"}
            style="--cortex-input-btn-reserve: 112px"
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
