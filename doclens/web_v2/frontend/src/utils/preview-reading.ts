/** 预览阅读域（AP-1 拆分件）：目录抽屉 / 滚动位置记忆，此前内联在
 *  preview-pane（2026-11-15 迁出，台账 antipatterns/frontend-file-preview.md
 *  AP-1 批 3）。
 *
 *  两块此前强耦合于 _activePreviewViewer（md/pdf viewer 定位）——拆出时
 *  把「活跃 viewer 查询」也收敛为 ActiveViewerController 统一持有，
 *  滚动记忆 / TOC / 书签锚点捕获都经它取，preview-pane 不再各自
 *  querySelector。 */

import { ReactiveController, ReactiveControllerHost } from "lit";

/** 活跃预览 viewer 登记（AP-1 批 3）：子组件句柄登记制——render 时由
 *  模板 ref 登记当前活跃的 md-viewer / pdf-viewer，取代散布在宿主的
 *  ~18 处 querySelector 直查（Feature Envy 治理）。
 *  一个时刻至多一个活跃 viewer（render 五分支互斥）。 */
export interface ActiveViewerEntry {
  kind: "md" | "pdf";
  el: HTMLElement;
  /** 滚动锚点读取（md=源行号 / pdf=页号+页内偏移编码值）。 */
  top: () => number;
  /** md-viewer 专有跳转接口（typed 访问器由宿主注入）。 */
  asMd: () => {
    topSourceLine(): number;
    isAtBottom(): boolean;
    selectionSourceOffsets(): { start: number; end: number } | null;
    selectCharAtViewportCenter(): boolean;
    scrollToSourceLine(line: number, behavior?: ScrollBehavior): Promise<void> | void;
    jumpToSourceLine(line: number, behavior?: ScrollBehavior): void;
    reLocate(): Promise<void> | void;
    scrollToFirstKeywordHit(): void;
    stepKeywordHit(dir: 1 | -1): void;
    scrollToBottom(behavior?: ScrollBehavior): void;
    selectSourceOffsets(start: number, end: number): void;
  } | null;
  /** pdf-viewer 专有接口。 */
  asPdf: () => {
    scrollAnchorValue(): number;
    restoreScrollAnchorValue(v: number): void;
    scrollToPage(page: number): void;
    atZoomMin(): boolean;
    atZoomMax(): boolean;
    zoomIn(): void;
    zoomOut(): void;
    fitWidth(): void;
    stepKeywordHit(dir: 1 | -1): void;
  } | null;
}

/** 目录抽屉（md/docx/pdf/epub 的预览分支）：显隐 + 当前阅读位置捕获 +
 *  跳转（跳转目标经注入回调，md/pdf 分派在宿主）。条目数据（_tocItems）
 *  双源写入（content 提取 / pdf toc-change），仍归宿主持有。 */
export class TocDrawerController implements ReactiveController {
  private host: ReactiveControllerHost;
  private _show = false;
  private _currentLine = 1;

  /** 打开前捕获当前阅读位置（宿主注入）。 */
  captureAnchor: () => number = () => 1;
  /** 跳转分派（宿主注入：md=jumpToSourceLine / pdf=scrollToPage）。 */
  onJump: ((line: number) => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected?(): void {}
  hostDisconnected?(): void { this._show = false; }

  get show(): boolean { return this._show; }
  get currentLine(): number { return this._currentLine; }

  /** 换文档：收起抽屉（条目由宿主清理）。 */
  onPathChanged(): void {
    this._show = false;
    this.host.requestUpdate();
  }

  /** 编辑→预览回切：收起（编辑态无抽屉）。 */
  onEnterEdit(): void {
    this._show = false;
  }

  toggle(): void {
    if (!this._show) {
      // 打开前捕获阅读位置，抽屉据此高亮当前章节
      this._currentLine = this.captureAnchor();
    }
    this._show = !this._show;
    this.host.requestUpdate();
  }

  close(): void {
    this._show = false;
    this.host.requestUpdate();
  }

  /** 点击目录节点：关闭 + 跳转。 */
  jump(line: number): void {
    this._show = false;
    this.host.requestUpdate();
    this.onJump?.(line);
  }
}

/** 滚动位置记忆（files-view rememberScroll）：跟随活跃 viewer 分支挂/摘
 *  scroll 监听，debounce 落盘 localStorage（scroll-memory）。
 *  挂摘时机由宿主 updated() 驱动（viewer 元素随 render 分支生灭）。 */
export class ScrollMemoryController implements ReactiveController {
  private _bound: HTMLElement | null = null;
  private _anchorFn: (() => number) | null = null;
  private _saveTimer: number | undefined;
  /** 待落盘写入所属的 path（滚动发生时的旧 path，flush 时可能已切走）。 */
  private _pendingPath = "";

  /** 落盘间隔（ms）。 */
  static readonly SAVE_DEBOUNCE_MS = 300;

  /** 宿主注入：是否启用（rememberScroll prop）。 */
  enabled: () => boolean = () => false;
  /** 宿主注入：当前 path。 */
  path: () => string = () => "";
  /** 宿主注入：滚动锚点读取（活跃 viewer 的 top）。 */
  anchor: () => (() => number) | null = () => null;
  /** 宿主注入：落盘（writeScrollLine）。 */
  write: ((path: string, line: number) => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
  }

  hostConnected?(): void {}
  hostDisconnected(): void { this.detach(); }

  /** updated() 驱动：绑定活跃 viewer（el 变化才重挂）。 */
  sync(el: HTMLElement | null): void {
    if (!this.enabled() || !el) {
      this.detach();
      return;
    }
    if (this._bound === el) return;
    this.detach(); // 先摘旧的（含 flush）
    el.addEventListener("scroll", this._onScroll, { passive: true });
    this._bound = el;
    this._anchorFn = this.anchor();
  }

  /** 换文档：立即落盘旧位置（不等 debounce）。 */
  flushOnPathChange(): void {
    this._flush();
  }

  private _onScroll = () => {
    this._pendingPath = this.path();
    window.clearTimeout(this._saveTimer);
    this._saveTimer = window.setTimeout(
      () => this._flush(),
      ScrollMemoryController.SAVE_DEBOUNCE_MS,
    );
  };

  /** 把待落盘的滚动位置写入（幂等）。 */
  private _flush(): void {
    window.clearTimeout(this._saveTimer);
    this._saveTimer = undefined;
    const top = this._anchorFn;
    const path = this._pendingPath;
    this._pendingPath = "";
    if (!this._bound || !top || !path) return;
    this.write?.(path, top());
  }

  /** 摘除 scroll 监听并 flush 未落盘的写入（幂等）。 */
  detach(): void {
    if (this._bound) {
      this._bound.removeEventListener("scroll", this._onScroll);
    }
    this._flush();
    this._bound = null;
    this._anchorFn = null;
  }
}
