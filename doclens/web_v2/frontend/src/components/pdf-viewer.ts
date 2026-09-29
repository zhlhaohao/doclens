import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
// pdf.js 官方 viewer 组件层样式（文本层选择/高亮/页面布局）——按 URL 引用
// （独立资产文件，不进主 bundle），文档加载时 fetch + adoptedStyleSheets
// 懒注入 document（首屏体积零增量，ADR-0031）。
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

/** viewer 组件层样式的懒加载单例（fetch 文本 → document 级注入）。
 *  组件样式（light DOM 选择器限定）+ viewer CSS 一并挂
 *  document.adoptedStyleSheets——document 级 adopted 只作用于 light 树，
 *  本组件恰为 light 渲染，其他 shadow 组件不受影响。 */
let viewerSheetPromise: Promise<void> | null = null;

function loadViewerStyles(): Promise<void> {
  if (!viewerSheetPromise) {
    viewerSheetPromise = (async () => {
      const sheet = new CSSStyleSheet();
      const res = await fetch(viewerCssUrl);
      // 失败降级：仅组件样式（正文 canvas 渲染不受影响，textLayer 视觉降级）
      sheet.replaceSync(
        (res.ok ? await res.text() : "") + COMPONENT_CSS,
      );
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
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

/** 主文档侧样式（portal 子树专用——portal 挂 document.body，document
 *  adopted sheet 可正常命中）。组件自身/占位/状态徽标等 shadow 树内
 *  元素用 inline style（document 级 CSS 跨不过 preview-pane 的 shadow
 *  边界，匹配不到它们）。 */
const COMPONENT_CSS = `
.cortex-pdf-portal {
  position: fixed;
  /* 尺寸/位置由组件按占位 rect 同步（left/top/width/height 内联） */
  z-index: 1;
  overflow: hidden;
  background: var(--cortex-surface-muted, #525659);
}
.cortex-pdf-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.cortex-pdf-host {
  position: absolute;
  inset: 0;
  overflow: auto;
  /* 单指双向平移交给浏览器（pinch 放大后左右横移可用）；浏览器级
     pinch-zoom 仍被排除——双指缩放由组件 touch 处理接管 */
  touch-action: pan-x pan-y;
  overscroll-behavior: contain;
}
/* 页间零缝（覆盖 viewer 的 .page 底 margin 10px——白纸紧挨成连续长图，
   不露灰底；特异性同级、同 sheet 内声明在后者胜） */
.cortex-pdf-host .pdfViewer .page {
  margin: 0;
}
/* 匹配导航 FAB 组（keyword 非空时显示）——布局与视觉对齐 md-viewer 的
 * .match-fabs：垂直堆叠（徽标在上、上/下步进两钮），白底 pill 徽标，
 * chevron-up/down 图标（与 scroll-jump FAB 同族） */
.cortex-pdf-fabs {
  position: absolute;
  right: 16px;
  bottom: 72px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--cortex-space-2, 8px);
  pointer-events: none;
}
.cortex-pdf-fab {
  pointer-events: auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--cortex-border);
  background: var(--cortex-surface);
  color: var(--cortex-text-muted);
  box-shadow: var(--cortex-shadow-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  cursor: pointer;
  touch-action: manipulation;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.cortex-pdf-fab:hover:not(:disabled) {
  background: var(--cortex-primary-soft);
  color: var(--cortex-primary);
  border-color: var(--cortex-primary);
}
.cortex-pdf-fab:disabled {
  opacity: 0.4;
  cursor: default;
}
.cortex-pdf-fab:disabled:hover {
  background: var(--cortex-surface);
  color: var(--cortex-text-muted);
  border-color: var(--cortex-border);
}
.cortex-pdf-fab doclens-icon {
  font-size: 16px;
}
.cortex-pdf-fab-num {
  font-family: var(--cortex-font-mono, monospace);
  font-size: var(--cortex-fs-xs, 12px);
  color: var(--cortex-text-muted);
  background: var(--cortex-surface);
  border: 1px solid var(--cortex-border);
  border-radius: 999px;
  padding: 1px 8px;
  box-shadow: var(--cortex-shadow-md);
  white-space: nowrap;
  pointer-events: none;
}
`;

/** 组件自身与 shadow 树内元素的 inline 布局样式（connected 时套用）。 */
const HOST_INLINE_STYLE =
  "display:flex;flex-direction:column;flex:1;min-height:0;position:relative;outline:none;background:var(--cortex-surface-muted,#525659)";

/** 占位元素 inline 样式（flex 撑满组件，portal 对齐其 rect）。 */
const ANCHOR_INLINE_STYLE = "flex:1;min-height:0;";

/** 状态层 inline 样式（loading / error）。 */
const STATUS_INLINE_STYLE =
  "flex:1;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--cortex-text-muted,#666);font-size:var(--cortex-fs-base,14px);background:var(--cortex-card-bg,#fff);text-align:center;line-height:1.7;padding:0 16px";

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
  /** light DOM 渲染：pdf.js 的 textLayer 选区（::selection 绘制）在
   *  shadow DOM 内不渲染（Chromium 已知缺陷，实测选中/未选中截图逐字节
   *  相同）；官方 viewer 即 light DOM 形态——选区/打印等原生行为全通。
   *  样式经 document.adoptedStyleSheets 注入，作用域由 `pdf-viewer`
   *  元素选择器限定（document 级 adopted 不穿透其他组件 shadow）。 */
  protected createRenderRoot(): HTMLElement {
    return this;
  }

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

  protected willUpdate(changed: Map<string, unknown>) {
    if (changed.has("docPath") && this.docPath) {
      this._loadWhenVisible();
    }
    if (changed.has("keyword")) this._applyKeyword();
    if (changed.has("locateLine") && this.locateLine != null) {
      this.locateToLine(this.locateLine);
    }
  }

  /** 组件不可见（keep-alive 视图隐藏 / 移动端布局未完成 / 挂载中间态）
   *  时延迟加载：0 尺寸容器上初始化 pdf.js 会把适宽 scale 钉成 0——
   *  页面 0 尺寸、loading 正常收尾、无异常，表现为真机移动浏览器灰屏
   *  （2026-09-29 修复：对话页参考资料 PDF 灰屏）。rAF 轮询等 rect
   *  非零（布局就位）再加载；代数守卫防连续切文档的竞态。顺带消除
   *  keep-alive 隐藏实例的并发下载（同文档此前会加载 3 份）。 */
  private _loadWhenVisible(): void {
    const seq = ++this._loadSeq; // 占代数：作废进行中的旧加载与旧轮询
    const check = () => {
      if (seq !== this._loadSeq) return;
      const rect = this.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        void this._loadDocument();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  }

  protected render() {
    if (this._error) {
      return html`
        <div style=${STATUS_INLINE_STYLE}>
          <doclens-icon name="file-x"></doclens-icon>
          <span>${this._error}</span>
        </div>
      `;
    }
    return html`
      ${this._loading
        ? html`<div style=${STATUS_INLINE_STYLE}><doclens-icon name="loader"></doclens-icon>PDF 加载中…</div>`
        : null}
      <div class="cortex-pdf-anchor" style=${ANCHOR_INLINE_STYLE} part="host"></div>
    `;
  }

  /** portal 渲染层（document.body 下，随组件生灭）：
   *  textLayer 必须在主文档树内——pdf.js 的选区绘制（::selection）在
   *  shadow 树内不渲染（Chromium 已知缺陷），而本组件必然嵌在
   *  preview-pane 的 shadow 里，任何「light 渲染」都逃不出那棵 shadow
   *  树。portal 容器 fixed 定位实时对齐组件占位 rect。 */
  private _portal: HTMLDivElement | null = null;
  /** portal 内匹配导航 FAB 组（上一个/下一个 + n/m 徽标）。 */
  private _fabs: HTMLDivElement | null = null;

  /** 同步 FAB 组：keyword 非空显示；计数驱动徽标与禁用态（零匹配 0/0
   *  置灰——与 md-viewer 匹配导航决议语义一致）。 */
  private _syncFabs(): void {
    const fabs = this._fabs;
    if (!fabs) return;
    if (!this.keyword.trim()) {
      fabs.style.display = "none";
      return;
    }
    const selected = this._matchInfo?.selected ?? 1;
    const count = this._matchInfo?.count ?? 0;
    if (fabs.style.display === "none" || !fabs.childElementCount) {
      // 首次构建（对齐 md-viewer .match-fabs 结构）：徽标在上，
      // 「上一个」chevron-up、「下一个」chevron-down 竖排
      fabs.innerHTML = "";
      const mk = (label: string, icon: string, dir: 1 | -1) => {
        const b = document.createElement("button");
        b.className = "cortex-pdf-fab";
        b.type = "button";
        b.setAttribute("aria-label", label);
        b.title = label;
        const ic = document.createElement("doclens-icon");
        ic.setAttribute("name", icon);
        b.appendChild(ic);
        b.addEventListener("click", () => this.stepKeywordHit(dir));
        return b;
      };
      const num = document.createElement("span");
      num.className = "cortex-pdf-fab-num";
      const prev = mk("上一个匹配", "chevron-up", -1);
      const next = mk("下一个匹配", "chevron-down", 1);
      fabs.append(num, prev, next);
    }
    fabs.style.display = "";
    const [num, prev, next] = fabs.children as unknown as [HTMLSpanElement, HTMLButtonElement, HTMLButtonElement];
    // 零匹配显示 0/0（匹配导航决议语义），非零时 selected 从 1 起
    num.textContent = count === 0 ? "0/0" : `${selected}/${count}`;
    const disabled = count === 0;
    prev.disabled = disabled;
    next.disabled = disabled;
  }
  /** rAF 持续对齐循环句柄（_destroyPortal 取消）。 */
  private _portalRaf = 0;
  /** 上次对齐的 rect 缓存（无变化跳过赋值——rAF 循环零成本稳态）。 */
  private _portalLastRect = "";

  private _ensurePortal(): HTMLDivElement {
    if (this._portal && this._portal.isConnected) return this._portal;
    const portal = document.createElement("div");
    portal.className = "cortex-pdf-portal";
    portal.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "cortex-pdf-wrap";
    const host = document.createElement("div");
    host.className = "cortex-pdf-host";
    const viewer = document.createElement("div");
    viewer.className = "pdfViewer";
    host.appendChild(viewer);
    wrap.appendChild(host);
    portal.appendChild(wrap);
    // 匹配导航 FAB 组（上一个/下一个 + n/m 徽标；keyword 非空时显示）
    const fabs = document.createElement("div");
    fabs.className = "cortex-pdf-fabs";
    fabs.style.display = "none";
    portal.appendChild(fabs);
    this._fabs = fabs;
    document.body.appendChild(portal);
    this._portal = portal;

    // 占位 rect 对齐：**rAF 持续对齐**而非 ResizeObserver——RO 只报尺寸
    // 变化，首次渲染的布局中间态稳定后组件常只有「位移」无「尺寸变化」
    // （上方 header/mobile-header 布局晚于本组件落位），RO 不触发，portal
    // 停在中间态位置（症状：顶部灰边，拖一下分隔条才纠正）。rAF 每帧读
    // 一次 rect（浏览器布局缓存，无重排成本），与缓存比对无变化即跳过。
    const anchor = () => this.renderRoot.querySelector(".cortex-pdf-anchor") as HTMLElement | null;
    const sync = () => {
      const a = anchor();
      if (!a) return;
      const r = a.getBoundingClientRect();
      // 坐标系补偿：getBoundingClientRect 是 visual viewport 坐标，而
      // position:fixed 定位基准是 layout viewport——iOS Safari 动态工具栏
      // /pinch 缩放下两者偏移，portal 会被对到屏幕外（canvas 正常渲染但
      // 不可见 = 真机灰屏，2026-09-29 修复）。桌面两者重合（offset 0）。
      const vv = window.visualViewport;
      const vvL = vv?.offsetLeft ?? 0;
      const vvT = vv?.offsetTop ?? 0;
      const key = `${r.left},${r.top},${r.width},${r.height},${vvL},${vvT}`;
      if (key === this._portalLastRect) return;
      this._portalLastRect = key;
      if (r.width === 0 || r.height === 0) {
        portal.style.display = "none";
        return;
      }
      portal.style.display = "";
      portal.style.left = `${r.left + vvL}px`;
      portal.style.top = `${r.top + vvT}px`;
      portal.style.width = `${r.width}px`;
      portal.style.height = `${r.height}px`;
    };
    const loop = () => {
      sync();
      this._portalRaf = requestAnimationFrame(loop);
    };
    this._portalRaf = requestAnimationFrame(loop);
    sync();
    this._syncFabs();
    return portal;
  }

  private _destroyPortal(): void {
    cancelAnimationFrame(this._portalRaf);
    this._portalRaf = 0;
    this._portalLastRect = "";
    this._portal?.remove();
    this._portal = null;
    this._fabs = null;
  }

  /** portal 内的滚动容器（PDFViewer 的 container）。 */
  private _portalHost(): HTMLElement | null {
    return this._portal?.querySelector(".cortex-pdf-host") ?? null;
  }

  /** portal 内的 .pdfViewer 元素（PDFViewer 的 viewer 参数）。 */
  private _portalViewerEl(): HTMLDivElement | null {
    return this._portal?.querySelector(".pdfViewer") ?? null;
  }

  protected firstUpdated() {
    this._bindKeys();
  }

  connectedCallback() {
    super.connectedCallback();
    // shadow 树内元素吃不到 document CSS——布局样式 inline 套用
    this.setAttribute("style", HOST_INLINE_STYLE);
    // 已有文档路径的复挂载（keep-alive 视图切回）：portal 重建 + 重载
    //（经 _loadWhenVisible：视图刚切回时布局未完成，0 尺寸直接加载会灰屏）
    if (this.docPath) this._loadWhenVisible();
  }

  disconnectedCallback() {
    this._teardown();
    this._destroyPortal();
    super.disconnectedCallback();
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

  /** 缩放：放大一档（×1.1，与 Ctrl+滚轮同一步长，SCALE 边界钳制）。 */
  zoomIn(): void {
    if (!this._viewer) return;
    this._viewer.currentScale = Math.min(
      SCALE_MAX, this._viewer.currentScale * 1.1,
    );
  }

  /** 缩放：缩小一档（÷1.1）。 */
  zoomOut(): void {
    if (!this._viewer) return;
    this._viewer.currentScale = Math.max(
      SCALE_MIN, this._viewer.currentScale / 1.1,
    );
  }

  /** 回到适宽（page-width 预设；用户缩放后的一键还原）。 */
  fitWidth(): void {
    if (this._viewer) this._viewer.currentScaleValue = "page-width";
  }

  /** 当前缩放是否已达上限/下限（控件禁用态）。 */
  atZoomMin(): boolean {
    return (this._viewer?.currentScale ?? 1) <= SCALE_MIN + 1e-6;
  }

  atZoomMax(): boolean {
    return (this._viewer?.currentScale ?? 1) >= SCALE_MAX - 1e-6;
  }

  /** 滚动位置记忆锚点（页号 + 页内偏移比例，编码为正整数——见
   *  scroll-memory 的 encodePdfScrollAnchor）。页 1 近顶编码为 1，
   *  落入 writeScrollLine 的「回顶部 = 清除记忆」语义。 */
  scrollAnchorValue(): number {
    const host = this._portalHost();
    const page = this.topPage();
    const pageEl = this._portal?.querySelector(
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
      const host = this._portalHost();
      const pageEl = this._portal?.querySelector(
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
      // 组件样式 + viewer CSS 懒注入 document（幂等单例）
      try {
        await loadViewerStyles();
      } catch {
        // 样式失败不阻断渲染（文本层视觉降级，正文 canvas 不受影响）
      }
    } catch {
      if (seq !== this._loadSeq) return;
      this._error = "PDF 渲染引擎加载失败，请检查网络后重试";
      this._loading = false;
      return;
    }

    // portal 先建（document.body，主文档树）——textLayer 选区绘制的前提
    this._ensurePortal();
    const host = this._portalHost();
    const viewerEl = this._portalViewerEl();
    if (!host || !viewerEl) return; // portal 构建异常（守卫）

    // portal 内滚动容器的交互绑定（每次重建 portal 后重挂）
    this._bindPinch(host);
    this._bindWheel(host);
    host.addEventListener("scroll", () => {
      this.dispatchEvent(new CustomEvent("scroll", { bubbles: true, composed: true }));
    }, { passive: true });

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
          this._syncFabs();
        }
      };
      eventBus.on("updatefindmatchescount", onCount);
      eventBus.on("updatefindcontrolstate", onCount);

      // 缩放状态外播（preview-pane 的缩放控件显示「适宽」/百分比）
      const onScale = (evt: { scale?: number; presetValue?: string }) => {
        const label = evt.presetValue === "page-width"
          ? "适宽"
          : `${Math.round((evt.scale ?? 1) * 100)}%`;
        this.dispatchEvent(new CustomEvent("zoom-change", {
          detail: { label },
          bubbles: true, composed: true,
        }));
      };
      eventBus.on("scalechanging", onScale);

      // 适宽默认（Q6 决议）——挂载瞬间容器宽度可能是中间态（移动端布局
      // 收缩前被内容撑到 793px），此时套 page-width 会得到 ≈1.0 的错值
      // 且 PDFViewer 内建 ResizeObserver 不重算；这里自建常驻观察：
      // - 初始阶段：尺寸变化即重套，宽度稳定 300ms 锁定；
      // - 锁定后：容器再变（拖拽预览栏分隔条 / 窗口 resize）且用户仍处
      //   适宽模式（currentScaleValue 保持 "page-width"——pinch/Ctrl+滚轮
      //   走数字赋值会把它变成数字串）→ 防抖 80ms 重套；用户手动缩放
      //   过则不干预。pdf.js 对同值赋值有 #isSameScale 短路，零成本。
      this._initialFitDone = false;
      // 0 宽容器（portal 对齐首帧未完成 / 布局中间态）不设 page-width——
      // pdf.js 会把适宽 scale 算成 0（页面 0 尺寸 = 灰屏），交给下方
      // applyInitialFit 的 ResizeObserver 在宽度就位后补套
      if (host.clientWidth > 0) viewer.currentScaleValue = "page-width";
      let settleTimer: number | undefined;
      let refitTimer: number | undefined;
      const applyInitialFit = () => {
        if (this._initialFitDone || seq !== this._loadSeq) return;
        // 页对象未建时 page-width 计算落空（scale 停留默认 1.0），跳过等下轮
        if (!this._viewer || host.clientWidth === 0) return;
        if (this._viewer.currentPageNumber < 1) return;
        this._viewer.currentScaleValue = "page-width";
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          if (seq === this._loadSeq) this._initialFitDone = true;
        }, 300);
      };
      const onResize = () => {
        if (seq !== this._loadSeq || !this._viewer) return;
        if (!this._initialFitDone) {
          applyInitialFit();
          return;
        }
        // 锁定后：仅适宽模式下跟随容器宽度（拖拽分隔条实时重适配）
        if (this._viewer.currentScaleValue !== "page-width") return;
        window.clearTimeout(refitTimer);
        refitTimer = window.setTimeout(() => {
          if (seq === this._loadSeq && this._viewer
              && this._viewer.currentScaleValue === "page-width") {
            this._viewer.currentScaleValue = "page-width";
          }
        }, 80);
      };
      this._fitObserver?.disconnect();
      this._fitObserver = new ResizeObserver(onResize);
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
    this._syncFabs();
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
