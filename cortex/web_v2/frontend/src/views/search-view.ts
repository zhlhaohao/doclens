import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { SearchResult, Session } from "../state/types";
import { searchApi } from "../api/search";
import { createSession, appendSession, listSessions, clearSessions } from "../api/sessions";

@customElement("search-view")
export class SearchView extends LitElement {
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
      background: var(--cortex-surface);
    }
    .focus-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .focus-main {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .focus-input-bar {
      padding: var(--cortex-space-3) var(--cortex-space-6);
      border-top: 1px solid var(--cortex-border-muted);
      background: var(--cortex-surface);
      flex-shrink: 0;
    }
    /* 移动端：详情整页推入覆盖 */
    .detail-overlay {
      position: absolute;
      inset: 0;
      background: var(--cortex-surface);
      display: flex;
      flex-direction: column;
      z-index: 10;
    }
    /* 移动端（<1024px）：隐藏桌面端独占的预览栏，预览由 detail-overlay 全屏覆盖 */
    @media (max-width: 1023px) {
      .desktop-only { display: none; }
    }
    @media (min-width: 1024px) {
      .detail-overlay { display: none; }
      /* 桌面端：初始内容居中，避免全宽拉伸的"手机浏览器"观感 */
      .initial-stack {
        max-width: 720px;
        margin: 0 auto;
        width: 100%;
      }
      .focus-input-bar {
        max-width: 720px;
        margin: 0 auto;
        width: 100%;
      }
    }
  `;

  @state() private localQuery = "";
  @state() private loading = false;
  @state() private previewContent = "";
  @state() private previewPath = "";
  @state() private previewLanguage = "text";
  @state() private previewLine: number | null = null;
  @state() private historySessions: Session[] = [];
  @state() private _clearing = false;
  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._loadHistory();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    // 消费跨视图会话加载请求（来自 history-view）
    const pending = store.getState().pendingSession;
    if (pending && pending.type === "search") {
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
      const { sessions } = await listSessions({ type: "search", limit: 20 });
      this.historySessions = sessions;
    } catch (e) {
      console.warn("load history failed", e);
    }
  }

  private async _onClearHistory() {
    this._clearing = true;
    this.requestUpdate();
    try {
      await clearSessions("search");
      this.historySessions = [];
    } catch (e) {
      console.warn("clear sessions failed", e);
    } finally {
      this._clearing = false;
      this.requestUpdate();
    }
  }

  private get viewState() {
    return store.getState().search;
  }

  private async _submit(e: CustomEvent<{ value: string }>) {
    const query = e.detail.value;
    this.localQuery = query;
    actions.setSearchState({ state: "focus", query, results: [], total: 0 });
    this.loading = true;
    try {
      const res = await searchApi({ query });
      const created = await createSession({ type: "search", title: query, preview: query.slice(0, 100) });
      actions.setSearchState({
        state: "focus",
        query,
        results: res.results,
        total: res.total,
        currentSession: {
          id: created.id, type: "search", title: query,
          preview: query.slice(0, 100), updated_at: new Date().toISOString(),
          message_count: res.total,
        },
      });
      await appendSession(created.id, res.results.map((r) => ({
        kind: "result",
        payload: JSON.stringify(r),
      })), res.total);
      this._loadHistory();
    } catch (err) {
      actions.setError(`搜索失败: ${(err as Error).message}`);
    } finally {
      this.loading = false;
    }
  }

  private _backToInitial() {
    actions.setSearchState({ state: "initial", currentSession: null, results: [], query: "" });
    this.localQuery = "";
    this._loadHistory();
  }

  private async _onResultSelect(e: CustomEvent<{ result: SearchResult }>) {
    const r = e.detail.result;
    actions.pushDetail(r);
    // 拉取预览
    try {
      const params = new URLSearchParams({ path: r.path });
      // markdown 走 md-viewer 渲染：需要全文件以保持 data-source-line 与绝对行号一致，
      // 否则 md-viewer 的行号映射会偏移，scroll-to-line 定位错误。
      // 非 markdown（纯文本视图）保留 30 行窗口切片以节省渲染。
      const isMarkdown = r.path.toLowerCase().endsWith(".md");
      if (r.line && !isMarkdown) {
        params.set("start_line", String(Math.max(1, r.line - 10)));
        params.set("end_line", String(r.line + 20));
      }
      const res = await fetch(`/api/preview?${params}`);
      if (res.ok) {
        const body = await res.json();
        this.previewContent = body.content;
        this.previewPath = body.path;
        this.previewLanguage = body.language;
        this.previewLine = (r.line as number | null) ?? null;
      }
    } catch (e) {
      console.warn("preview failed", e);
    }
  }

  private _popDetail() {
    actions.popDetail();
  }

  private async _loadSession(s: Session) {
    actions.setSearchState({
      state: "focus",
      currentSession: s,
      query: s.title,
    });
    // 从后端加载会话内容
    try {
      const res = await fetch(`/api/sessions/${s.id}`);
      if (res.ok) {
        const body = await res.json();
        const results = (body.items || [])
          .filter((i: any) => i.kind === "result")
          .map((i: any) => JSON.parse(i.payload));
        actions.setSearchState({ results, total: results.length });
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
          <welcome-pane heading="Cortex" subheading="结构感知文档检索"></welcome-pane>
          <history-list
            title="历史会话"
            type="search"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}
            @clear=${this._onClearHistory}>
          </history-list>
          <div class="input-row">
            <input-box
              placeholder="输入搜索关键词..."
              button-label="搜索"
              button-icon="🔍"
              ?disabled=${this.loading}
              .value=${this.localQuery}
              @input-change=${(e: any) => (this.localQuery = e.detail.value)}
              @submit=${this._submit}>
            </input-box>
          </div>
        </div>
      `;
    }
    // focus 状态
    const detailTop = store.getState().detailStack[store.getState().detailStack.length - 1];
    return html`
      <div class="focus-body">
        <focus-header
          back-label="新搜索"
          title=${s.query}
          meta=${`${s.total} 条结果`}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main">
          <search-results
            .results=${s.results}
            .activePath=${detailTop?.path ?? null}
            @select=${this._onResultSelect}>
          </search-results>
          <preview-pane
            class="desktop-only"
            path=${this.previewPath}
            language=${this.previewLanguage}
            content=${this.previewContent}
            .line=${this.previewLine}>
          </preview-pane>
        </div>
        <div class="focus-input-bar">
          <input-box
            placeholder="重新搜索..."
            button-label="🔍"
            ?disabled=${this.loading}
            .value=${this.localQuery}
            @input-change=${(e: any) => (this.localQuery = e.detail.value)}
            @submit=${this._submit}>
          </input-box>
        </div>
      </div>
      ${detailTop ? html`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${detailTop.path}
            @back=${this._popDetail}>
          </focus-header>
          <preview-pane
            path=${this.previewPath}
            language=${this.previewLanguage}
            content=${this.previewContent}
            .line=${this.previewLine}>
          </preview-pane>
        </div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "search-view": SearchView;
  }
}
