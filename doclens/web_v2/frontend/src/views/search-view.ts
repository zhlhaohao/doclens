import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { SearchMode, FileGroup, SearchHit, Session } from "../state/types";
import { searchApi } from "../api/search";
import { grepApi } from "../api/grep";
import { listSessions, clearSessions, findOrCreateSession, starSession } from "../api/sessions";
import { isPstFilePath, isPstEmailPath } from "../api/pst";
import "../components/pst-email-list";
import "../components/preview-pane";
import "../components/pagination-bar";
import "../components/toast-stack";
import type { ToastStack } from "../components/toast-stack";
import {
  PreviewController,
  mapLineViaPredecessor,
} from "../utils/preview-controller";

@customElement("search-view")
export class SearchView extends LitElement {
  static readonly RESULTS_PANE_WIDTH_KEY = "cortex.resultsPaneWidth";
  static readonly RESULTS_PANE_WIDTH_DEFAULT = 360;
  static readonly RESULTS_PANE_WIDTH_MIN = 280;
  static readonly RESULTS_PANE_WIDTH_MAX = 800;
  static readonly SEARCH_MODE_KEY = "cortex.searchMode";
  static readonly SEARCH_MODES: Record<SearchMode, { label: string; icon?: string; description?: string }> = {
    keyword: { label: "搜索", description: "拆分关键词匹配" },
    grep: { label: "grep", description: "正则表达式匹配" },
  };

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
      /* 顶部蓝色光晕：让白色卡片从 view-bg 中浮出 */
      background: radial-gradient(720px 280px at 50% -80px, color-mix(in srgb, var(--cortex-primary) 8%, transparent), transparent 70%);
    }
    .input-row {
      padding: var(--cortex-space-4) var(--cortex-space-6);
      flex-shrink: 0;
      background: transparent;
    }
    /* 输入框对齐日记记录页的紧凑尺寸（默认 ≈48px/11px 偏大） */
    .text-input {
      --min-h: calc(var(--cortex-fs-md) * 1.5 + 14px);   /* ≈36px，随字号缩放 */
      --cortex-input-pad-y: 6px;
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
      /* 预览 overlay 打开时隐藏搜索顶栏（chat-view 同款）：focus-header
         因 backdrop-filter 带 z-index:10，detail-overlay 去掉 z-index 后
         （2026-10-19 PDF portal 修复）会浮在 overlay 之上露出搜索头部；
         预览层的返回由 preview-pane 自带 mobile-header 承担。 */
      .focus-body.is-covered > focus-header { display: none; }
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
      flex: 0 1 var(--results-pane-width, 360px);
      min-width: 180px;
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
      background: var(--cortex-border-muted);
      transition: background 0.15s;
    }
    .splitter:hover, .splitter:active { background: var(--cortex-primary); }
    @media (max-width: 1023px) {
      .splitter { display: none; }
    }
    /* 移动端：详情整页推入覆盖。**不得设 z-index**（2026-10-19 修复：移动端
       点搜索结果开 PDF 预览白屏——只剩 portal 灰底、无文字）——z-index 会
       创建层叠上下文，把 document.body 下 z-index:1 的 pdf-viewer portal
       整个压在下面（canvas 已画好但被 overlay 挡死）。去掉后：overlay
       （absolute 定位）仍画在静态结果列表之上（覆盖语义不变），而 portal
       （fixed + z:1）反超 overlay（z:auto）显露 canvas；preview-pane 内
       toc-drawer（z:30）等浮层在根上下文直接比较，仍正确盖住 canvas。
       与 chat-view .preview-overlay 的 2026-09-29 修复同构。 */
    .detail-overlay {
      position: absolute;
      inset: 0;
      background: var(--cortex-card-bg);
      display: flex;
      flex-direction: column;
    }
    .not-indexed-hint {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-md);
      color: var(--cortex-text-muted);
      padding: var(--cortex-space-6);
      text-align: center;
    }
    /* 移动端（<1024px）：隐藏桌面端独占的预览栏，预览由 detail-overlay 全屏覆盖 */
    @media (max-width: 1023px) {
      .desktop-only { display: none; }
      /* 输入框贴近屏幕左右（原 space-6=24px 留白偏宽） */
      .input-row { padding-left: var(--cortex-space-2); padding-right: var(--cortex-space-2); }
    }
    @media (min-width: 1024px) {
      .detail-overlay { display: none; }
      /* 桌面端：初始内容居中，避免全宽拉伸的"手机浏览器"观感。
         列宽统一走 --content-max-width（与 chat 初始/focus、diary 同宽，
         三视图两侧留白一致且状态切换不跳变） */
      .initial-stack {
        max-width: var(--content-max-width, 1080px);
        margin: 0 auto;
        width: 100%;
      }
    }
  `;

  @state() private localQuery = "";
  @state() private loading = false;
  @state() private previewLine: number | null = null;
  @state() private historySessions: Session[] = [];
  @state() private _clearing = false;
  /** 点击命中行带来的字面高亮词（spans 还原；优先于 queryWords——
   *  grep 正则词项不可字面搜，findController/md-viewer 会零命中）。 */
  @state() private previewHl = "";

  /** 预览状态机（P1-2 收敛：三宿主共用 controller；行定位/高亮词是
   *  search 特有态，留在视图）。兼容 getter 转发保持渲染层零改动。 */
  private _preview = new PreviewController(this, {
    getPane: () => this.shadowRoot?.querySelector("preview-pane") ?? null,
  });
  private get previewContent() { return this._preview.content; }
  private get previewPath() { return this._preview.path; }
  private get previewLanguage() { return this._preview.language; }
  private get previewError() { return this._preview.notIndexed ? "NOT_INDEXED" as const : null; }
  private get previewWritable() { return this._preview.writable; }
  private get previewPages() { return this._preview.pages; }
  private get previewAttachments() { return this._preview.attachments; }
  private get previewPageStarts() { return this._preview.pageStarts; }
  private get previewTokens() { return this._preview.tokens; }
  @state() private _resultsPaneWidth = SearchView.RESULTS_PANE_WIDTH_DEFAULT;
  @state() private searchMode: SearchMode = "keyword";
  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._loadHistory();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._loadResultsPaneWidth();
    this._loadSearchMode();
    // 消费跨视图会话加载请求（来自 history-view）
    const pending = store.getState().pendingSession;
    if (pending && pending.type === "search") {
      actions.setPendingSession(null);
      this._loadSession(pending);
    }
    // 启动恢复：上次提交的关键词回填输入框（从 store 读——恢复值已由
    // applySessionRestore 写入；不自动搜索，用户点「搜索」才执行）
    if (!this.localQuery) {
      this.localQuery = store.getState().search.query || "";
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

  private _loadSearchMode() {
    const saved = localStorage.getItem(SearchView.SEARCH_MODE_KEY);
    if (saved === "keyword" || saved === "grep") {
      this.searchMode = saved;
    }
  }

  private _onModeChange = (e: CustomEvent<{ mode: SearchMode }>) => {
    this.searchMode = e.detail.mode;
    localStorage.setItem(SearchView.SEARCH_MODE_KEY, e.detail.mode);
  };

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
        const res = await clearSessions("search");
        // 加星会话受保护：后端跳过，本地保留
        this.historySessions = this.historySessions.filter((s) => s.starred);
        if (res.skipped_starred > 0) {
          this._pushToast(
            `已清空 ${res.deleted_count} 条，${res.skipped_starred} 条加星搜索保留`,
            "info", 3500);
        }
      } catch (e) {
        console.warn("clear sessions failed", e);
      } finally {
        this._clearing = false;
        this.requestUpdate();
      }
    });
  }

  /** 历史列表星标切换（2026-09-17）：乐观更新（本地翻转+重排），失败回滚。 */
  private _onToggleStar = async (e: CustomEvent<{ session: Session; starred: boolean }>) => {
    const { session, starred } = e.detail;
    const prev = this.historySessions;
    this.historySessions = prev
      .map((s) => (s.id === session.id ? { ...s, starred } : s))
      .sort((a, b) =>
        (Number(b.starred ?? false) - Number(a.starred ?? false)) ||
        b.updated_at.localeCompare(a.updated_at));
    try {
      await starSession(session.id, starred);
    } catch (err) {
      this.historySessions = prev;
      this._pushToast(`加星失败：${(err as Error)?.message || err}`, "error", 5000);
    }
  };

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
      this._preview.clear();
      this.previewHl = "";
      // 新搜索始终从第 0 页开始（重置 offset）
      actions.setSearchState({ state: "focus", query, queryWords: [], groups: [], total: 0, totalMatches: 0, offset: 0, limit: 20, source: "fts" });
      this.loading = true;
      try {
        const res = this.searchMode === "grep"
          ? await grepApi({ pattern: query, offset: 0, limit: 20 })
          : await searchApi({ query, offset: 0, limit: 20 });
        // 引擎层异常（HTTP 200 但 error 非空）与结果不完整附注（notes）
        // 透出到错误区——区分「无结果」与「出错了/不完整」
        if (res.error) {
          actions.setError(`搜索失败: ${res.error}`);
        } else if (res.notes?.length) {
          actions.setError(`注意: ${res.notes.join(" ")}`);
        }
        // 立即用搜索结果更新 UI（不等会话写入），避免长时间"空白"
        actions.setSearchState({
          state: "focus",
          query,
          queryWords: res.query_words ?? [],
          groups: res.groups,
          total: res.total,
          totalMatches: res.total_matches,
          offset: 0,
          limit: 20,
          source: res.source,
        });
        this._autoPreviewFirstDesktop(res.groups);
        // 后台：去重写入历史会话（不阻塞 UI）。即使失败也不影响搜索结果展示。
        void findOrCreateSession({
          type: "search", title: query, preview: query.slice(0, 100),
          mode: this.searchMode === "grep" ? "grep" : "keyword",
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
      actions.setSearchState({ state: "initial", currentSession: null, groups: [], query: "", queryWords: [], totalMatches: 0 });
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
      const res = this.searchMode === "grep"
        ? await grepApi({ pattern: s.query, offset: newOffset, limit })
        : await searchApi({ query: s.query, offset: newOffset, limit });
      if (res.error) {
        actions.setError(`翻页失败: ${res.error}`);
      } else if (res.notes?.length) {
        actions.setError(`注意: ${res.notes.join(" ")}`);
      }
      actions.setSearchState({
        state: "focus",
        query: s.query,
        groups: res.groups,
        total: res.total,
        totalMatches: res.total_matches,
        offset: res.offset,  // 用后端 clamp 后的值
        limit,
        source: res.source,
      });
      // 翻页后预览面板清空（避免显示前一页的高亮）
      this._preview.clear();
      this.previewLine = null;
      this.previewHl = "";
    } catch (err) {
      actions.setError(`翻页失败: ${(err as Error).message}`);
    } finally {
      this.loading = false;
    }
  }

  private _onPageChange = (e: CustomEvent<{ page: number }>) => {
    void this._goToPage(e.detail.page);
  };

  private async _onHitSelect(e: CustomEvent<{ hit: SearchHit }>) {
    await this._safeAction(async () => {
      const hit = e.detail.hit;
      actions.pushDetail(hit);
      // 同一命中行重复点击：previewLine 赋同值不会触发 md-viewer updated()
      // → 不重新定位（用户滚走阅读后再点命中行无反应）。先清空强制
      // 下一次赋值产生属性变化（2026-10-18 E2E 复现修复）。
      const sameHit = this.previewLine === hit.line && this.previewPath === hit.path;
      if (sameHit) {
        this.previewLine = null;
      }
      await this._fetchAndShowPreview(hit);
      // Lit 属性去重竞态（2026-10-19）：null→同值在同一轮批处理中被合并为
      // 「值未变」，md-viewer updated() 完全不触发（content/path 也全同）。
      // 同文件同行重击时显式调用 reLocate 兜底；嵌套组件（preview-pane →
      // md-viewer）的属性传递异步排队——先等 md-viewer 自身 updateComplete
      // 才能保证 reLocate 读到最新 line。
      if (sameHit && this.previewLanguage === "markdown") {
        const pp = this.shadowRoot?.querySelector("preview-pane") as any;
        await pp?.updateComplete;
        const mdv = pp?.shadowRoot?.querySelector("md-viewer") as any;
        await mdv?.updateComplete;
        mdv?.reLocate?.();
      }
    });
  }

  /** Fetches preview content for a hit (path + line) and updates preview state.
   *  Pulled out of _onHitSelect so it can be reused by desktop auto-preview
   *  (which doesn't go through the user-click path). */
  private async _fetchAndShowPreview(r: SearchHit) {
    this.previewHl = r.hl ?? "";
    this.previewLine = null;
    const line = (r.line as number | null) ?? null;
    const state = await this._preview.openHit(r.path, line);
    // 行定位（search 特有）：合成 md 用 lineMap 前驱换算（BUG-F3：命中行
    // 常落在块内部，前驱 heading 即所属块）；普通文本 r.line 即文件行号；
    // 范围片段/PST 列表/错误态 lineMap 为 null——直接用原行号或不定位。
    if (state.status === "ok" && line !== null) {
      this.previewLine = state.doc.lineMap
        ? mapLineViaPredecessor(state.doc.lineMap, line)
        : line;
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
  private _autoPreviewFirstDesktop(groups: FileGroup[]) {
    if (typeof window === "undefined") return;
    if (window.innerWidth < 1024) return;
    const first = groups[0];
    if (!first) return;
    // Fire-and-forget; preview loads in background
    void this._fetchAndShowPreview({ path: first.path, line: first.matches[0]?.line ?? null });
  }

private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>) => {
    this._preview.onDirtyChange(e.detail.dirty);
  };

  /** dirty 门与保存回填已收敛 preview-controller（P1-2）。 */
  private _safeAction(action: () => void | Promise<void>) {
    return this._preview.safeAction(action);
  }

  private _onPreviewSaved = (e: CustomEvent<{ content: string }>) => {
    void this._preview.onSaved(e.detail.content);
    this._pushToast("已保存", "success", 2500);
  }

  private _onPreviewSaveFailed = (e: CustomEvent<{ message: string }>) => {
    this._pushToast(`保存失败：${e.detail.message}`, "error", 5000);
  };

  /** 预览 pane 下载成功（App 内 jsbridge 通道） */
  private _onPreviewDownloadSuccess = (e: CustomEvent<{ name: string }>) => {
    this._pushToast(`已保存到下载目录：${e.detail.name}`, "success", 2500);
  };

  /** 预览 pane 拷贝路径结果（clipboard 不可用时可见失败）。 */
  private _onPathCopied = (e: CustomEvent<{ ok: boolean }>) => {
    if (e.detail.ok) this._pushToast("已复制路径", "success", 2500);
    else this._pushToast("复制失败（剪贴板不可用）", "error", 5000);
  };

  private _onPreviewDownloadFailed = (e: CustomEvent<{ message: string }>) => {
    this._pushToast(`下载失败：${e.detail.message}`, "error", 5000);
  };

  /** 预览 pane 阅读书签收藏反馈（added / duplicate / full）。 */
  private _onBookmarkAdded = () => this._pushToast("已收藏书签", "success", 2500);
  private _onBookmarkDuplicate = () => this._pushToast("此处已有书签", "info", 2500);
  private _onBookmarkFull = () => this._pushToast("书签已满（200 条），请先清理", "error", 5000);

  /** PST 邮件列表行点击 → 打开派生邮件预览（与点击命中行同路径）。 */
  private _onOpenPstEmail = async (e: CustomEvent<{ path: string }>) => {
    await this._safeAction(async () => {
      const hit: SearchHit = { path: e.detail.path, line: null };
      actions.pushDetail(hit);
      await this._fetchAndShowPreview(hit);
    });
  };

  /** 桌面预览区返回：PST 派生邮件 → 回到该 PST 的邮件列表（页码由组件缓存恢复）。 */
  private _onBackToPstList = async () => {
    if (!isPstEmailPath(this.previewPath)) return;
    await this._safeAction(async () => {
      actions.popDetail();
      await this._fetchAndShowPreview({
        path: this.previewPath.split("#")[0],
        line: null,
      });
    });
  };

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
      该文件未索引，无法预览。<br>请先执行 doclens index 后重试。
    </div>`;
  }

  private async _loadSession(s: Session) {
    // 历史条目携带模式：按其记录的引擎重放（grep → /api/grep，否则关键词搜索）。
    this.searchMode = s.mode === "grep" ? "grep" : "keyword";
    localStorage.setItem(SearchView.SEARCH_MODE_KEY, this.searchMode);
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
          <welcome-pane
            variant="onboarding"
            heroicon="search"
            heading="在你的文档中搜索"
            subheading="对当前工作目录{workdir} 的所有文件进行全文检索"
            .modes=${[
              { label: "自然语言", icon: "sparkles" },
              { label: "正则", icon: "regex" },
            ]}
            .examples=${[
              "「人工智能发展」",
              "「量子 计算」",
              "「tcp.*timeout」",
              "「Python 装饰器」",
            ]}
            .workdir=${store.getState().status?.workdir ?? ""}
          ></welcome-pane>
          <history-list
            title="历史搜索"
            type="search"
            ?clearing=${this._clearing}
            .sessions=${this.historySessions}
            @select=${this._onHistorySelect}
            @toggle-star=${this._onToggleStar}
            @clear=${this._onClearHistory}>
          </history-list>
          <div class="input-row">
            <input-box
              class="text-input"
              placeholder=${this.searchMode === "grep" ? "输入正则表达式..." : "输入搜索关键词..."}
              button-label="搜索"
              button-icon="search"
              .mode=${this.searchMode}
              .modes=${SearchView.SEARCH_MODES}
              ?disabled=${this.loading}
              .value=${this.localQuery}
              @input-change=${(e: any) => (this.localQuery = e.detail.value)}
              @mode-change=${this._onModeChange}
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
      : `${s.total} 个文件 · ${s.totalMatches} 处命中${s.source === "fts" ? "" : ` (${s.source.toUpperCase()})`}`;
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
              .groups=${s.groups}
              ?loading=${this.loading}
              .activeHit=${detailTop ?? null}
              @hit-select=${this._onHitSelect}>
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
            : isPstFilePath(this.previewPath)
              ? html`<pst-email-list
                  class="desktop-only"
                  .pstPath=${this.previewPath}
                  @open-email=${this._onOpenPstEmail}>
                </pst-email-list>`
              : html`<preview-pane
                class="desktop-only"
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .tokens=${this.previewTokens}
                .line=${this.previewLine}
                .keyword=${this.previewHl || (s.queryWords.length ? s.queryWords.join(" ") : s.query)}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                .pageStarts=${this.previewPageStarts}
                .attachments=${this.previewAttachments}
                ?showBack=${isPstEmailPath(this.previewPath)}
                backLabel="邮件列表"
                @back=${this._onBackToPstList}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}
                @download-success=${this._onPreviewDownloadSuccess}
                @path-copied=${this._onPathCopied}
                @download-failed=${this._onPreviewDownloadFailed}
                @bookmark-added=${this._onBookmarkAdded}
                @bookmark-duplicate=${this._onBookmarkDuplicate}
                @bookmark-full=${this._onBookmarkFull}>
              </preview-pane>`}
        </div>
      </div>
      ${detailTop ? html`
        <div class="detail-overlay" data-ptr-off>
          ${this.previewError === "NOT_INDEXED"
            ? html`
                <focus-header
                  back-label="结果"
                  title=${detailTop.path}
                  @back=${this._popDetail}>
                </focus-header>
                ${this._renderNotIndexedHint(false)}`
            : isPstFilePath(this.previewPath)
              ? html`
                  <focus-header
                    back-label="结果"
                    title=${detailTop.path}
                    @back=${this._popDetail}>
                  </focus-header>
                  <pst-email-list
                    .pstPath=${this.previewPath}
                    @open-email=${this._onOpenPstEmail}>
                  </pst-email-list>`
              /* 常规预览：移动端用 preview-pane 自带的 mobile-header
                 （返回/目录/高亮/more=字号·编辑·下载·上传），与文件 tab
                 移动端、桌面端头部能力对齐；不再用 focus-header + noHeader
                 的组合（那样只剩「编辑」一个入口） */
              : html`<preview-pane
                ?mobile=${true}
                path=${this.previewPath}
                language=${this.previewLanguage}
                content=${this.previewContent}
                .tokens=${this.previewTokens}
                .line=${this.previewLine}
                .keyword=${this.previewHl || (s.queryWords.length ? s.queryWords.join(" ") : s.query)}
                ?writable=${this.previewWritable}
                .pages=${this.previewPages}
                .pageStarts=${this.previewPageStarts}
                .attachments=${this.previewAttachments}
                @back=${this._popDetail}
                @dirty-change=${this._onPreviewDirty}
                @saved=${this._onPreviewSaved}
                @save-failed=${this._onPreviewSaveFailed}
                @download-success=${this._onPreviewDownloadSuccess}
                @path-copied=${this._onPathCopied}
                @download-failed=${this._onPreviewDownloadFailed}
                @bookmark-added=${this._onBookmarkAdded}
                @bookmark-duplicate=${this._onBookmarkDuplicate}
                @bookmark-full=${this._onBookmarkFull}>
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
