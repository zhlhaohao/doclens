import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
// pdf.js 官方 viewer 组件层样式（文本层选择/高亮/页面布局）——按 URL 引用
// （独立资产文件，不进主 bundle），文档加载时 fetch + adoptedStyleSheets
// 懒注入 shadow DOM（首屏体积零增量，ADR-0031）。
import viewerCssUrl from "pdfjs-dist/web/pdf_viewer.css?url";
import type { TocItem } from "../utils/toc";
import { encodePdfScrollAnchor, decodePdfScrollAnchor } from "../utils/scroll-memory";
import "./icon";

/**
 * pdf.js 组件层模块的懒加载单例（动态 import → 独立 chunk，主 bundle
 * 不变；首次打开 PDF 才下载，SW cache-first 之后离线可用——ADR-0031）。
 */
type PdfViewerModule = typeof import("pdfjs-dist/web/pdf_viewer.mjs");

let viewerModulePromise: Promise<PdfViewerModule> | null = null;

function loadViewerModule(): Promise<PdfViewerModule> {
  if (!viewerModulePromise) {
    viewerModulePromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerUrl = (
        await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
      ).default;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      return import("pdfjs-dist/web/pdf_viewer.mjs");
    })();
  }
  return viewerModulePromise;
}

/** viewer 组件层样式的懒加载单例（fetch 文本 → CSSStyleSheet）。 */
let viewerSheetPromise: Promise<CSSStyleSheet> | null = null;

function loadViewerStyles(): Promise<CSSStyleSheet> {
  if (!viewerSheetPromise) {
    viewerSheetPromise = (async () => {
      const sheet = new CSSStyleSheet();
      const res = await fetch(viewerCssUrl);
      if (res.ok) sheet.replaceSync(await res.text());
      return sheet;
    })();
  }
  return viewerSheetPromise;
}

/** PDF outline 条目（pdf.js getOutline 原始形态）。 */
interface RawOutlineItem {
  title: string | null;
  dest: unknown;
  items?: RawOutlineItem[];
}

/** dest（命名目的地字符串或显式目的地数组）→ 1-based 页号。 */
async function destToPageNumber(
  pdf: import("pdfjs-dist").PDFDocumentProxy,
  dest: unknown,
): Promise<number | null> {
  try {
    const explicit =
      typeof dest === "string" ? await pdf.getDestination(dest) : dest;
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const pageIndex = await pdf.getPageIndex(explicit[0] as never);
    return pageIndex + 1;
  } catch {
    return null; // 损坏的目的地：条目降级（不产出 TOC 节点）
  }
}

/** outline 树 → TocItem 扁平缩进列表（line 字段承载页号）。 */
async function flattenOutline(
  pdf: import("pdfjs-dist").PDFDocumentProxy,
  items: RawOutlineItem[],
  level: number,
  out: TocItem[],
): Promise<void> {
  for (const item of items) {
    const title = (item.title ?? "").trim();
    const page =
      item.dest == null ? null : await destToPageNumber(pdf, item.dest);
    if (title && page != null) {
      out.push({ text: title, line: page, depth: level });
    }
    if (item.items?.length) {
      await flattenOutline(pdf, item.items, level + 1, out);
    }
  }
}

/** find 事件 state 的公共字段（pdf.js 6.x：PDFFindController 无公开
 *  executeCommand，统一走 eventBus.dispatch("find", state)——type 省略 =
 *  初查（debounce 后跳首个命中），type "again" = 步进 findagain）。 */
interface FindState extends Record<string, unknown> {
  query: string;
  phraseSearch: boolean;
  caseSensitive: boolean;
  entireWord: boolean;
  highlightAll: boolean;
  type?: "" | "again" | "highlightallchange";
  findPrevious?: boolean;
}

/** 命中行号 → 页号（页表二分，与后端 page_starts 同语义）。
 *  抽为纯函数便于单元测试；无页表返回 null（跳页静默降级）。 */
export function lineToPage(line: number, pageStarts: number[] | null): number | null {
  if (!pageStarts || pageStarts.length === 0) return null;
  let lo = 0;
  let hi = pageStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pageStarts[mid] <= line) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/** 缩放上下限（PDFViewer 的 scale 是相对 PDF 原始尺寸的倍率）。 */
const SCALE_MIN = 0.3;
const SCALE_MAX = 5;

/**
 * PDF 原生预览（ADR-0031）：pdf.js 官方 viewer 组件层渲染原始字节。
 *
 * - 适宽默认；移动端双指 pinch / 桌面 Ctrl+滚轮 / ←→ 翻页（Q6 决议）；
 * - keyword prop → PDFFindController（高亮全部命中）；stepKeywordHit
 *   步进（findagain）；updateuistate 驱动 n/m 徽标（匹配导航平移）；
 * - locateLine + pageStarts → 页表二分跳页（搜索命中定位）；
 * - TOC：PDF 原生书签（getOutline）扁平化，line 字段承载页号——
 *   无书签不发 toc-change（preview-pane 隐藏目录按钮）。
 */
@customElement("pdf-viewer")
export class PdfViewer extends LitElement {
  static styles = [
    css`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        background: var(--cortex-surface-muted, #525659);
        outline: none;
        position: relative;
      }
      /* 滚动容器定位：PDFViewer 构造校验要求 container 绝对定位——
         外层 wrapper 承担 flex 占位，内层 .pdf-host absolute inset 0 */
      .pdf-wrap {
        flex: 1;
        min-height: 0;
        position: relative;
      }
      .pdf-host {
        position: absolute;
        inset: 0;
        overflow: auto;
        /* 单指双向平移交给浏览器（pinch 放大后左右横移可用）；浏览器级
           pinch-zoom 仍被排除——双指缩放由组件 touch 处理接管 */
        touch-action: pan-x pan-y;
        overscroll-behavior: contain;
      }
      .status {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--cortex-space-2, 8px);
        color: var(--cortex-text-muted, #666);
        font-size: var(--cortex-fs-base, 14px);
        background: var(--cortex-card-bg, #fff);
      }
      .status doclens-icon {
        animation: spin 1s linear infinite;
      }
      .status.error {
        color: var(--cortex-text, #333);
        text-align: center;
        padding: 0 var(--cortex-space-4, 16px);
        line-height: 1.7;
      }
      .error doclens-icon {
        animation: none;
        color: var(--cortex-text-subtle, #999);
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      /* 匹配导航徽标（右下角 FAB 区上方，与 md-viewer 的 n/m 对齐） */
      .match-badge {
        position: absolute;
        right: 16px;
        bottom: 72px;
        z-index: 5;
        background: var(--cortex-text, #111);
        color: var(--cortex-surface, #fff);
        font-family: var(--cortex-font-mono, monospace);
        font-size: 12px;
        padding: 3px 10px;
        border-radius: 999px;
        opacity: 0.92;
        pointer-events: none;
      }
    `,
  ];

  /** 文档相对路径（workdir 相对）——字节经 /api/preview/pdf 拉取。 */
  @property() docPath = "";
  /** 关键词高亮（匹配导航）：非空 → findController 全量高亮 + 跳首个命中。 */
  @property() keyword = "";
  /** 搜索命中行（索引提取文本行号）→ 经 pageStarts 二分跳页；null 不动作。 */
  @property({ type: Number }) locateLine: number | null = null;
  /** 页表（后端 page_starts）；null = 无页表（跳页静默降级）。 */
  @property({ attribute: false }) pageStarts: number[] | null = null;

  @state() private _loading = true;
  @state() private _error = "";
  /** 匹配导航徽标 n/m（findController updateuistate 驱动）。 */
  @state() private _matchInfo: { selected: number; count: number } | null = null;

  // pdf.js 运行时（加载后填充；类型从模块推导，避免静态 import 进主 chunk）
  private _viewer: import("pdfjs-dist/web/pdf_viewer.mjs").PDFViewer | null = null;
  private _linkService: import("pdfjs-dist/web/pdf_viewer.mjs").PDFLinkService | null = null;
  private _eventBus: import("pdfjs-dist/web/pdf_viewer.mjs").EventBus | null = null;
  private _pdf: import("pdfjs-dist").PDFDocumentProxy | null = null;
  private _loadingTask: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | null = null;

  /** 快速切文档时丢弃过期加载（递增序号守卫）。 */
  private _loadSeq = 0;
  /** 当前生效的查找词（避免 keyword 未变时重复 executeCommand）。 */
  private _activeQuery = "";
  /** pinch 基线（两指初始距离与当时 scale）。 */
  private _pinchBase: { dist: number; scale: number } | null = null;
  /** 初始适宽是否已成功应用（成功前监听容器尺寸，有真实宽度即套用）。 */
  private _initialFitDone = false;
  private _fitObserver: ResizeObserver | null = null;

  async connectedCallback() {
    super.connectedCallback();
    if (this.docPath) void this._loadDocument();
  }

  disconnectedCallback() {
    this._teardown();
    super.disconnectedCallback();
  }

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has("docPath") && this.docPath) {
      void this._loadDocument();
    }
    if (changed.has("keyword")) this._applyKeyword();
    if (changed.has("locateLine") && this.locateLine != null) {
      this.locateToLine(this.locateLine);
    }
  }

  protected render() {
    if (this._error) {
      return html`
        <div class="status error">
          <doclens-icon name="file-x"></doclens-icon>
          <span>${this._error}</span>
        </div>
      `;
    }
    return html`
      ${this._loading
        ? html`<div class="status"><doclens-icon name="loader"></doclens-icon>PDF 加载中…</div>`
        : null}
      <div class="pdf-wrap">
        <div class="pdf-host" part="host">
          <div class="pdfViewer"></div>
        </div>
      </div>
      ${this._matchInfo && this._matchInfo.count > 0
        ? html`<div class="match-badge">${this._matchInfo.selected}/${this._matchInfo.count}</div>`
        : null}
    `;
  }

  protected firstUpdated() {
    const host = this.renderRoot.querySelector(".pdf-host") as HTMLElement | null;
    if (!host) return;
    // PDFViewer 要求滚动容器上有该属性（其内部滚动监听依赖）
    this._bindPinch(host);
    this._bindWheel(host);
    this._bindKeys();
    // 滚动位置记忆：内部容器滚动 re-dispatch（scroll 不冒泡，父组件监听不到）
    host.addEventListener("scroll", () => {
      this.dispatchEvent(new CustomEvent("scroll", { bubbles: true, composed: true }));
    }, { passive: true });
  }

  // ---------------------------------------------------------------- 公共方法

  /** 跳到指定页（1-based；越界钳制）。供 TOC 跳转 / 搜索跳页 / 滚动恢复。 */
  scrollToPage(page: number): void {
    if (!this._viewer) return;
    const total = this._pdf?.numPages ?? 1;
    const n = Math.min(Math.max(1, Math.floor(page)), total);
    this._viewer.scrollPageIntoView({ pageNumber: n });
  }

  /** 命中行 → 页表二分跳页；无页表静默降级（Q5 决议：不定位不兜底）。 */
  locateToLine(line: number): void {
    const page = lineToPage(line, this.pageStarts);
    if (page != null) this.scrollToPage(page);
  }

  /** 匹配导航步进（上一个/下一个；与 md-viewer stepKeywordHit 同名对齐）。 */
  stepKeywordHit(dir: 1 | -1): void {
    if (!this._eventBus || !this._activeQuery) return;
    this._eventBus.dispatch("find", {
      query: this._activeQuery,
      phraseSearch: true,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      type: "again",
      findPrevious: dir === -1,
    } satisfies FindState);
  }

  /** 当前页号（TOC 抽屉的「当前章节」锚点货币：页号）。 */
  topPage(): number {
    return this._viewer?.currentPageNumber ?? 1;
  }

  /** 滚动位置记忆锚点（页号 + 页内偏移比例，编码为正整数——见
   *  scroll-memory 的 encodePdfScrollAnchor）。页 1 近顶编码为 1，
   *  落入 writeScrollLine 的「回顶部 = 清除记忆」语义。 */
  scrollAnchorValue(): number {
    const host = this.renderRoot.querySelector(".pdf-host") as HTMLElement | null;
    const page = this.topPage();
    const pageEl = this.renderRoot.querySelector(
      `.page[data-page-number="${page}"]`,
    ) as HTMLElement | null;
    if (!host || !pageEl || pageEl.offsetHeight === 0) {
      return encodePdfScrollAnchor(page, 0);
    }
    const within = host.scrollTop - pageEl.offsetTop;
    const ratio = Math.min(1, Math.max(0, within / pageEl.offsetHeight));
    return encodePdfScrollAnchor(page, ratio);
  }

  /** 恢复滚动位置锚点：跳页 + 页内偏移。rAF 等一帧让 scrollToPage 的
   *  页面占位先落（缺失时再等一帧重试），按实际页高计算目标 scrollTop
   *  （适宽模式下同文档页高稳定，偏移可复现）。 */
  restoreScrollAnchorValue(value: number): void {
    const { page, ratio } = decodePdfScrollAnchor(value);
    if (!this._viewer) return;
    this.scrollToPage(page);
    const apply = (attempt: number) => {
      const host = this.renderRoot.querySelector(".pdf-host") as HTMLElement | null;
      const pageEl = this.renderRoot.querySelector(
        `.page[data-page-number="${page}"]`,
      ) as HTMLElement | null;
      if (!host || !pageEl) {
        if (attempt < 3) requestAnimationFrame(() => apply(attempt + 1));
        return; // 页占位始终缺失：退化为 scrollToPage 的页顶定位
      }
      host.scrollTop = pageEl.offsetTop + ratio * pageEl.offsetHeight;
    };
    requestAnimationFrame(() => apply(1));
  }

  /** 是否已有可跳转书签目录（preview-pane 据此显隐 TOC 按钮）。 */
  hasOutline(): boolean {
    return this._outlineReady;
  }

  @state() private _outlineReady = false;

  // ---------------------------------------------------------------- 文档加载

  private async _loadDocument(): Promise<void> {
    const seq = ++this._loadSeq;
    this._loading = true;
    this._error = "";
    this._matchInfo = null;
    this._activeQuery = "";
    this._outlineReady = false;
    this._teardownRuntime();

    let mod: PdfViewerModule;
    try {
      mod = await loadViewerModule();
      // viewer 组件层样式懒注入（adoptedStyleSheets 追加，幂等）
      try {
        const sheet = await loadViewerStyles();
        const root = this.shadowRoot!;
        if (sheet.cssRules.length && !root.adoptedStyleSheets.includes(sheet)) {
          root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
        }
      } catch {
        // 样式失败不阻断渲染（文本层视觉降级，正文 canvas 不受影响）
      }
    } catch {
      if (seq !== this._loadSeq) return;
      this._error = "PDF 渲染引擎加载失败，请检查网络后重试";
      this._loading = false;
      return;
    }

    const host = this.renderRoot.querySelector(".pdf-host") as HTMLElement | null;
    const viewerEl = this.renderRoot.querySelector(".pdfViewer") as HTMLDivElement | null;
    if (!host || !viewerEl) return; // 渲染被错误态替换（守卫）

    try {
      const pdfjs = await import("pdfjs-dist");
      const url = `/api/preview/pdf?path=${encodeURIComponent(this.docPath)}`;
      this._loadingTask = pdfjs.getDocument({ url });
      const pdf = await this._loadingTask.promise;
      if (seq !== this._loadSeq) {
        (pdf as unknown as { destroy?: () => void }).destroy?.();
        return;
      }
      this._pdf = pdf;

      const eventBus = new mod.EventBus();
      const linkService = new mod.PDFLinkService({ eventBus });
      const findController = new mod.PDFFindController({ eventBus, linkService });
      const viewer = new mod.PDFViewer({
        container: host as HTMLDivElement,
        viewer: viewerEl,
        eventBus,
        linkService,
        findController,
        textLayerMode: 1, // TextLayerMode.ENABLE：可选择可查找
        removePageBorders: true, // 去掉页周默认 20px 边距——适宽即全宽，
        // 白纸贴容器边（移动端无灰边；窄预览列不浪费 40px 宽度）
      });
      linkService.setViewer(viewer);
      viewer.setDocument(pdf);
      linkService.setDocument(pdf);

      this._linkService = linkService;
      this._eventBus = eventBus;
      this._viewer = viewer;

      // 匹配导航徽标（n/m）：查找引擎状态/计数更新（6.x 事件名——
      // updatefindcontrolstate 携带 state+matchesCount，updatefindmatchescount
      // 在分页扫描进度中持续刷新计数）
      const onCount = (evt: { matchesCount?: { current?: number; total?: number } }) => {
        const mc = evt.matchesCount;
        if (mc && typeof mc.total === "number") {
          this._matchInfo = {
            selected: Math.max(1, mc.current ?? 1),
            count: mc.total,
          };
        }
      };
      eventBus.on("updatefindmatchescount", onCount);
      eventBus.on("updatefindcontrolstate", onCount);

      // 适宽默认（Q6 决议）——挂载瞬间容器宽度可能是中间态（移动端布局
      // 收缩前被内容撑到 793px），此时套 page-width 会得到 ≈1.0 的错值
      // 且 PDFViewer 内建 ResizeObserver 不重算；这里自建观察：尺寸变化
      // 即重套，宽度稳定 300ms 才锁定（锁定后不再干预用户缩放）。
      this._initialFitDone = false;
      viewer.currentScaleValue = "page-width";
      let settleTimer: number | undefined;
      const applyInitialFit = () => {
        if (this._initialFitDone || seq !== this._loadSeq) return;
        // 页对象未建时 page-width 计算落空（scale 停留默认 1.0），跳过等下轮
        if (!this._viewer || host.clientWidth === 0) return;
        if (this._viewer.currentPageNumber < 1) return;
        this._viewer.currentScaleValue = "page-width";
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          if (seq !== this._loadSeq) return;
          this._initialFitDone = true;
          this._fitObserver?.disconnect();
          this._fitObserver = null;
        }, 300);
      };
      this._fitObserver?.disconnect();
      this._fitObserver = new ResizeObserver(applyInitialFit);
      this._fitObserver.observe(host);
      applyInitialFit();

      this._loading = false;
      // 文档就绪（滚动恢复等需要等页视图建立后的时机）——挂 pagesloaded
      //（viewer 的所有页占位 DOM 建立后触发；loading 态收尾不等它）
      eventBus.on("pagesloaded", () => {
        if (seq !== this._loadSeq) return; // 过期加载不通知
        applyInitialFit();
        this.dispatchEvent(new CustomEvent("document-ready", {
          bubbles: true, composed: true,
        }));
      });

      // TOC：原生书签（Q4 决议）——扁平化后交给父组件
      try {
        const outline = (await pdf.getOutline()) as RawOutlineItem[] | null;
        if (outline?.length) {
          const items: TocItem[] = [];
          await flattenOutline(pdf, outline, 1, items);
          if (items.length) {
            this._outlineReady = true;
            this.dispatchEvent(new CustomEvent("toc-change", {
              detail: { items },
              bubbles: true, composed: true,
            }));
          }
        }
      } catch {
        // outline 解析失败不影响正文渲染
      }

      // 外部已就位的 keyword / locateLine（组件挂载晚于 props 到达的场景）。
      // keyword 早到时 _applyKeyword 只记了 _activeQuery 未 dispatch（无
      // eventBus），这里清空后重调以绕过「相同查询」守卫强制执行。
      if (this._activeQuery) {
        this._activeQuery = "";
        this._applyKeyword();
      }
      if (this.locateLine != null) this.locateToLine(this.locateLine);
    } catch (err) {
      if (seq !== this._loadSeq) return;
      this._loading = false;
      const name = (err as { name?: string })?.name ?? "";
      this._error = name.includes("UnexpectedResponse") || name.includes("MissingPDF")
        ? "PDF 文件不在磁盘（可能已被移动或删除），无法预览"
        : `PDF 加载失败：${(err as Error).message || name || "未知错误"}`;
    }
  }

  /** 释放当前文档运行时（切文档 / 组件卸载）。 */
  private _teardownRuntime(): void {
    this._viewer = null;
    this._eventBus = null;
    this._fitObserver?.disconnect();
    this._fitObserver = null;
    this._initialFitDone = false;
    try {
      (this._linkService as unknown as { destroy?: () => void })?.destroy?.();
    } catch { /* destroy 幂等容错 */ }
    this._linkService = null;
    try {
      this._loadingTask?.destroy();
    } catch { /* 同上 */ }
    this._loadingTask = null;
    try {
      (this._pdf as unknown as { destroy?: () => void } | null)?.destroy?.();
    } catch { /* 同上 */ }
    this._pdf = null;
  }

  private _teardown(): void {
    this._loadSeq++; // 使进行中的加载失效
    this._teardownRuntime();
  }

  // ---------------------------------------------------------------- 查找桥接

  private _applyKeyword(): void {
    const q = this.keyword.trim();
    if (!this._eventBus) {
      this._activeQuery = q; // 文档就绪后 _loadDocument 尾部补执行
      return;
    }
    if (!q) {
      // 清空：空查询触发一次 find 以清除高亮
      if (this._activeQuery) {
        this._activeQuery = "";
        this._matchInfo = null;
        this._eventBus.dispatch("find", {
          query: "", phraseSearch: true, caseSensitive: false,
          entireWord: false, highlightAll: true,
        } satisfies FindState);
      }
      return;
    }
    if (q === this._activeQuery) return;
    this._activeQuery = q;
    this._eventBus.dispatch("find", {
      query: q,
      phraseSearch: true,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
    } satisfies FindState);
  }

  // ---------------------------------------------------------------- 缩放交互

  private _bindPinch(host: HTMLElement): void {
    host.addEventListener("touchstart", (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]];
        this._pinchBase = {
          dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          scale: this._viewer?.currentScale ?? 1,
        };
      }
    }, { passive: true });
    host.addEventListener("touchmove", (e: TouchEvent) => {
      if (e.touches.length !== 2 || !this._pinchBase || !this._viewer) return;
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const ratio = dist / (this._pinchBase.dist || 1);
      this._viewer.currentScale = Math.min(
        SCALE_MAX, Math.max(SCALE_MIN, this._pinchBase.scale * ratio),
      );
    }, { passive: false });
    host.addEventListener("touchend", () => {
      this._pinchBase = null;
    }, { passive: true });
  }

  private _bindWheel(host: HTMLElement): void {
    host.addEventListener("wheel", (e: WheelEvent) => {
      if (!e.ctrlKey || !this._viewer) return;
      e.preventDefault();
      const cur = this._viewer.currentScale ?? 1;
      const next = e.deltaY < 0 ? cur * 1.1 : cur / 1.1;
      this._viewer.currentScale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, next));
    }, { passive: false });
  }

  private _bindKeys(): void {
    this.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this._viewer) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        this.scrollToPage(this._viewer.currentPageNumber + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        this.scrollToPage(this._viewer.currentPageNumber - 1);
      }
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pdf-viewer": PdfViewer;
  }
}
