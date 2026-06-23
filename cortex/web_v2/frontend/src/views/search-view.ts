import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { SearchResult, Session } from "../state/types";
import { searchApi } from "../api/search";
import { listSessions, clearSessions, findOrCreateSession } from "../api/sessions";
import { fetchPreview, isFullFilePreview } from "../api/preview";
import type { PageMarker } from "../api/preview";
import "../components/preview-pane";
import "../components/pagination-bar";
import "../components/toast-stack";
import type { ToastStack } from "../components/toast-stack";

@customElement("search-view")
export class SearchView extends LitElement {
  static readonly RESULTS_PANE_WIDTH_KEY = "cortex.resultsPaneWidth";
  static readonly RESULTS_PANE_WIDTH_DEFAULT = 360;
  static readonly RESULTS_PANE_WIDTH_MIN = 280;
  static readonly RESULTS_PANE_WIDTH_MAX = 800;

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
    /* Mobile only (<1024px): when the detail-overlay covers focus-body,
       disable pointer events on focus-body so its (visually-hidden)
       focus-header can't intercept taps. On desktop, detail-overlay is
       display:none, so focus-body is NOT covered and must stay interactive. */
    @media (max-width: 1023px) {
      .focus-body.is-covered { pointer-events: none; }
    }
    .focus-main {
      display: flex;
      flex: 1;
      min-height: 0;
      /* 四周留白：避免结果/预览/分页紧贴 focus-header 下沿和视口边缘 */
      padding: var(--cortex-space-3);
    }
    /* 结果列：search-results + pagination-bar 垂直堆叠，宽度跟随 --results-pane-width */
    .results-col {
      display: flex;
      flex-direction: column;
      flex: 0 0 var(--results-pane-width, 360px);
      min-width: 280px;
      max-width: 800px;
      min-height: 0;
      /* 结果列表与分页栏之间的呼吸空间 */
      gap: var(--cortex-space-2);
    }
    /* 让 search-results 在 .results-col 内填充剩余高度（覆盖其 :host 的 flex: 0 0 auto）。
       !important 是必要的，因为子组件 :host 的特异性 (0,1,0) 高于父级类型选择器 (0,0,1)。 */
    .results-col > search-results {
      flex: 1 1 0 !important;
      min-height: 0;
    }
    /* 移动端：结果列占满全宽，跟随 search-results 的响应式行为 */
    @media (max-width: 1023px) {
      .results-col {
        flex: 1;
        max-width: none;
        min-width: 0;
      }
    }
    .splitter {
      flex: 0 0 4px;
      cursor: col-resize;
      background: var(--cortex-border);
      transition: background 0.15s;
    }
    .splitter:hover, .splitter:active { background: var(--cortex-primary); }
    @media (max-width: 1023px) {
      .splitter { display: none; }
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
    .not-indexed-hint {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      padding: 24px;
      text-align: center;
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
  @state() private previewError: "NOT_INDEXED" | null = null;
  @state() private previewDirty = false;
  @state() private previewWritable = false;
  @state() private previewPages: PageMarker[] | null = null;
  @state() private _resultsPaneWidth = SearchView.RESULTS_PANE_WIDTH_DEFAULT;
  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._loadHistory();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._loadResultsPaneWidth();
    // 消费跨视图会话加载请求（来自 history-view）
    const pending = store.getState().pendingSession;
    if (pending && pending.type === "search") {
      actions.setPendingSession(null);
      this._loadSession(pending);
    }
  }

  private _loadResultsPaneWidth() {
    const saved = localStorage.getItem(SearchView.RESULTS_PANE_WIDTH_KEY);
    if (!saved) return;
    const w = Number(saved);
    if (!Number.isNaN(w)) {
      this._resultsPaneWidth = Math.max(
        SearchView.RESULTS_PANE_WIDTH_MIN,
        Math.min(SearchView.RESULTS_PANE_WIDTH_MAX, w),
      );
    }
  }

  /** Drag handler — bound as a class field so `this` is captured and listeners
   *  added to `document` can be removed by reference on mouseup. */
  private _onSplitterMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this._resultsPaneWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const w = Math.max(
        SearchView.RESULTS_PANE_WIDTH_MIN,
        Math.min(SearchView.RESULTS_PANE_WIDTH_MAX, startWidth + dx),
      );
      if (w !== this._resultsPaneWidth) this._resultsPaneWidth = w;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(
        SearchView.RESULTS_PANE_WIDTH_KEY,
        String(this._resultsPaneWidth),
      );
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

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
    await this._safeAction(async () => {
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
    });
  }

  private get viewState() {
    return store.getState().search;
  }

  private async _submit(e: CustomEvent<{ value: string }> | string) {
    await this._safeAction(async () => {
      // Allow being called directly with a query string (used by tests &
      // any internal caller that doesn't go through the input-box event).
      const query = typeof e === "string" ? e : e.detail.value;
      this.localQuery = query;
      // Reset any previous preview state so auto-preview starts fresh
      store.setState({ detailStack: [] });
      this.previewContent = "";
      this.previewPath = "";
      this.previewError = null;
      this.previewPages = null;
      // 新搜索始终从第 0 页开始（重置 offset）
      actions.setSearchState({ state: "focus", query, results: [], total: 0, offset: 0, limit: 20, source: "fts" });
      this.loading = true;
      try {
        const res = await searchApi({ query, offset: 0, limit: 20 });
        // 立即用搜索结果更新 UI（不等会话写入），避免长时间"空白"
        actions.setSearchState({
          state: "focus",
          query,
          results: res.results,
          total: res.total,
          offset: 0,
          limit: 20,
          source: res.source,
        });
        this._autoPreviewFirstDesktop(res.results);
        // 后台：去重写入历史会话（不阻塞 UI）。即使失败也不影响搜索结果展示。
        void findOrCreateSession({
          type: "search", title: query, preview: query.slice(0, 100),
        }).then((created) => {
          actions.setSearchState({
            currentSession: {
              id: created.id, type: "search", title: query,
              preview: query.slice(0, 100), updated_at: new Date().toISOString(),
              message_count: 0,
            },
          });
          this._loadHistory();
        }).catch((e) => {
          console.warn("find-or-create session failed", e);
        });
      } catch (err) {
        actions.setError(`搜索失败: ${(err as Error).message}`);
      } finally {
        this.loading = false;
      }
    });
  }

  private async _backToInitial() {
    await this._safeAction(() => {
      actions.setSearchState({ state: "initial", currentSession: null, results: [], query: "" });
      this.localQuery = "";
      this._loadHistory();
    });
  }

  /** 切换到指定页码（1-indexed）。no-op if same as current page. */
  private async _goToPage(page: number) {
    const s = store.getState().search;
    if (!s.query || s.state !== "focus") return;
    const limit = s.limit || 20;
    const newOffset = Math.max(0, (page - 1) * limit);
    if (newOffset === s.offset) return;  // 已在该页，no-op
    this.loading = true;
    try {
      const res = await searchApi({ query: s.query, offset: newOffset, limit });
      actions.setSearchState({
        state: "focus",
        query: s.query,
        results: res.results,
        total: res.total,
        offset: res.offset,  // 用后端 clamp 后的值
        limit,
        source: res.source,
      });
      // 翻页后预览面板清空（避免显示前一页的高亮）
      this.previewContent = "";
      this.previewPath = "";
      this.previewLine = null;
    } catch (err) {
      actions.setError(`翻页失败: ${(err as Error).message}`);
    } finally {
      this.loading = false;
    }
  }

  private _onPageChange = (e: CustomEvent<{ page: number }>) => {
    void this._goToPage(e.detail.page);
  };

  private async _onResultSelect(e: CustomEvent<{ result: SearchResult }>) {
    await this._safeAction(async () => {
      const r = e.detail.result;
      actions.pushDetail(r);
      await this._fetchAndShowPreview(r);
    });
  }

  /** Fetches preview content for a result and updates preview-* state.
   *  Pulled out of _onResultSelect so it can be reused by desktop auto-preview
   *  (which doesn't go through the user-click path). */
  private async _fetchAndShowPreview(r: SearchResult) {
    this.previewError = null;
    const line = (r.line as number | null) ?? null;
    const fullFile = isFullFilePreview(r.path);
    // search-hit 范围预览（非 full-file 时只取 line ±10/+20 行）—— fetchPreview
    // 暂不支持 line range，走专用分支。
    let result;
    if (line && !fullFile) {
      result = await this._fetchPreviewRange(r.path, line);
    } else {
      result = await fetchPreview(r.path);
    }
    if (result.ok) {
      this.previewContent = result.content;
      this.previewPath = result.path;
      this.previewLanguage = result.language;
      this.previewLine = line;
      this.previewWritable = result.writable;
      this.previewPages = result.pages;
    } else if (result.notIndexed) {
      this.previewError = "NOT_INDEXED";
      this.previewContent = "";
      this.previewPath = r.path;
      this.previewWritable = false;
      this.previewPages = null;
    }
  }

  /** search-hit 范围预览专用 —— 仅取 line ±10/+20 行。 */
  private async _fetchPreviewRange(
    path: string,
    line: number,
  ): Promise<
    | { ok: true; path: string; content: string; language: string; writable: boolean; pages: PageMarker[] | null }
    | { ok: false; notIndexed: boolean }
  > {
    const params = new URLSearchParams({ path });
    params.set("start_line", String(Math.max(1, line - 10)));
    params.set("end_line", String(line + 20));
    try {
      const res = await fetch(`/api/preview?${params}`);
      if (res.ok) {
        const body = await res.json();
        return {
          ok: true,
          path: body.path,
          content: body.content,
          language: body.language,
          writable: body.writable ?? false,
          pages: body.pages ?? null,
        };
      }
      const err = await res.json().catch(() => ({}));
      return { ok: false, notIndexed: err.code === "NOT_INDEXED" };
    } catch {
      return { ok: false, notIndexed: false };
    }
  }

  /** Desktop-only: auto-preview the first result after a search or session
   *  load, so the preview pane isn't empty.
   *
   *  Does NOT call actions.pushDetail — detailStack is overloaded as the
   *  trigger for the mobile full-screen detail-overlay, so pushing on
   *  desktop would cause the overlay to appear if the user later resizes
   *  the window narrower. We only fetch and populate the preview-* state;
   *  if the user wants the first card highlighted, clicking it does the
   *  normal pushDetail flow. */
  private _autoPreviewFirstDesktop(results: SearchResult[]) {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1024) return;
    if (results.length === 0) return;
    // Fire-and-forget; preview loads in background
    void this._fetchAndShowPreview(results[0]);
  }

  private _discardPreviewEdits() {
    const pp = this.shadowRoot?.querySelector("preview-pane") as any;
    pp?.discard?.();
    this.previewDirty = false;
  }

  private _enterPreviewEdit() {
    const pp = this.shadowRoot?.querySelector(".detail-overlay preview-pane") as any;
    pp?.enterEdit?.();
  }

  private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>) => {
    this.previewDirty = e.detail.dirty;
  };

  private async _safeAction(action: () => void | Promise<void>) {
    if (this.previewDirty) {
      const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
      if (!ok) return;
      this._discardPreviewEdits();
    }
    await action();
  }

  private _onPreviewSaved = () => {
    this.previewDirty = false;
    this._pushToast("已保存", "success", 2500);
  };

  private _onPreviewSaveFailed = (e: CustomEvent<{ message: string }>) => {
    this._pushToast(`保存失败：${e.detail.message}`, "error", 5000);
  };

  private _onPreviewUploadSuccess = (e: CustomEvent<{ path: string }>) => {
    // 清掉可能残留的编辑脏标志（上传可能发生在 edit 模式下），避免
    // 后续切换结果时弹出陈旧的"丢弃修改？"确认框
    this.previewDirty = false;
    this._pushToast(`已覆盖：${e.detail.path}`, "success", 2500);
    // 上传是外部覆盖（不像 PUT /api/preview 已含新内容），必须重新拉取
    this._reloadPreview();
  };

  private _onPreviewUploadFailed = (e: CustomEvent<{ message: string }>) => {
    this._pushToast(`上传失败：${e.detail.message}`, "error", 5000);
  };

  /** 上传成功后用：按当前 previewPath 重新拉取完整预览内容（不缩行范围）。 */
  private async _reloadPreview() {
    if (!this.previewPath) return;
    const r = await fetchPreview(this.previewPath);
    if (r.ok) {
      this.previewContent = r.content;
      this.previewLanguage = r.language;
      this.previewWritable = r.writable;
      this.previewPages = r.pages;
    }
  }

  private _pushToast(message: string, level: "success" | "error" | "info", duration: number) {
    const stack = this.shadowRoot?.querySelector("toast-stack") as ToastStack | null;
    stack?.pushToast(message, level, duration);
  }

  private _popDetail() {
    actions.popDetail();
  }

  private _renderNotIndexedHint(desktopOnly: boolean) {
    const cls = desktopOnly ? "desktop-only not-indexed-hint" : "not-indexed-hint";
    return html`<div class=${cls}>
      该文件未索引，无法预览。<br>请先执行 cortex index 后重试。
    </div>`;
  }

  private async _loadSession(s: Session) {
    // 历史只保存查询关键词，点击 = 用关键词重新执行搜索（拿到最新结果）。
    // 委托给 _submit，复用其去重 + 置顶 + 状态更新 + 历史刷新逻辑。
    await this._submit(s.title);
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
    // loading 时显示"搜索中"，避免误以为"0 条结果"
    const meta = this.loading
      ? "搜索中"
      : `${s.total} 条结果${s.source === "fts" ? "" : ` (${s.source.toUpperCase()})`}`;
    return html`
      <toast-stack></toast-stack>
      <div class="focus-body ${detailTop ? "is-covered" : ""}">
        <focus-header
          back-label="新搜索"
          title=${s.query}
          meta=${meta}
          @back=${this._backToInitial}>
        </focus-header>
        <div class="focus-main" style="--results-pane-width: ${this._resultsPaneWidth}px">
          <div class="results-col">
            <search-results
              .results=${s.results}
              ?loading=${this.loading}
              .activePath=${detailTop?.path ?? this.previewPath ?? null}
              .activeLine=${detailTop?.line ?? this.previewLine ?? null}
              @select=${this._onResultSelect}>
            </search-results>
            ${s.total > s.limit
              ? html`<pagination-bar
                  .total=${s.total}
                  .offset=${s.offset}
                  .limit=${s.limit}
                  ?disabled=${this.loading}
                  @page-change=${this._onPageChange}>
                </pagination-bar>`
              : null}
          </div>
          <div class="splitter"
               role="separator"
               aria-orientation="vertical"
               aria-label="调整搜索结果栏宽度"
               @mousedown=${this._onSplitterMouseDown}></div>
          ${this.previewError === "NOT_INDEXED"
            ? this._renderNotIndexedHint(true)
            : html`<preview-pane
                class="desktop-only"
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${s.query}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}
                @upload-success=${this._onPreviewUploadSuccess}
                @upload-failed=${this._onPreviewUploadFailed}>
              </preview-pane>`}
        </div>
      </div>
      ${detailTop ? html`
        <div class="detail-overlay">
          <focus-header
            back-label="结果"
            title=${detailTop.path}
            .actions=${this.previewWritable
              ? [{ label: "编辑", icon: "✏️", onClick: () => this._enterPreviewEdit() }]
              : []}
            @back=${this._popDetail}>
          </focus-header>
          ${this.previewError === "NOT_INDEXED"
            ? this._renderNotIndexedHint(false)
            : html`<preview-pane
                ?noHeader=${true}
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .line=${this.previewLine}
                .keyword=${s.query}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}
                @upload-success=${this._onPreviewUploadSuccess}
                @upload-failed=${this._onPreviewUploadFailed}>
              </preview-pane>`}
        </div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "search-view": SearchView;
  }
}
