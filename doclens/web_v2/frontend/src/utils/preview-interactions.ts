/** 预览交互域（AP-1 拆分件）：下载 / 关键词高亮 / PDF 翻译三块，
 *  此前内联在 preview-pane（2026-11-15 迁出，台账
 *  antipatterns/frontend-file-preview.md AP-1 批 2）。
 *
 *  共同特征：状态私有 + 依赖宿主环境经注入回调获取（path/language/
 *  viewer 定位），结果经事件派发回调上抛——沿 bookmarks-controller 范式。 */

import { ReactiveController, ReactiveControllerHost } from "lit";

/** 原始文件下载：进行中遮罩态 + jsbridge/a 兜底编排（utils/download.ts）。
 *  文件名由后端 Content-Disposition 决定；unauthorized 已在公共编排内
 *  跳登录，controller 静默。 */
export class DownloadController implements ReactiveController {
  private host: ReactiveControllerHost;
  private _downloading = false;

  /** 宿主注入：当前预览 path（空 = 不可下载）。 */
  path: () => string = () => "";
  /** 下载编排（宿主注入 downloadServerFile）。 */
  download: ((path: string) => Promise<{ via: string; name?: string; error?: string }>) | null = null;
  /** 结果反馈事件派发（宿主注入——download-success/failed）。 */
  onFeedback: ((detail: { name: string } | { message: string }) => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected?(): void {}
  hostDisconnected?(): void {}

  get downloading(): boolean { return this._downloading; }

  click(): void {
    const path = this.path();
    if (!path || this._downloading) return;
    void (async () => {
      this._downloading = true;
      this.host.requestUpdate();
      try {
        const r = await this.download!(path);
        if (r.via !== "jsbridge") return;
        if (r.name) this.onFeedback?.({ name: r.name });
        else if (r.error) this.onFeedback?.({ message: r.error });
        // 两字段皆空 = unauthorized 已在公共编排内跳登录，此处静默
      } finally {
        this._downloading = false;
        this.host.requestUpdate();
      }
    })();
  }
}

/** 关键词高亮（仅 markdown/pdf 预览分支）：输入整词（空格分隔多个）→
 *  透传 md-viewer keyword 高亮全部命中，并自动滚动到第一个命中。
 *  手动输入经 normalizeHighlightKeyword 归一化（含 CJK 去空格整串）；
 *  未手动输入时透传父组件 keyword 原样。 */
export class KeywordHighlightController implements ReactiveController {
  private host: ReactiveControllerHost;
  private _show = false;
  private _input = "";
  private _debounce: number | undefined;

  /** 宿主注入：归一化函数（normalizeHighlightKeyword）。 */
  normalize: ((kw: string) => string) | null = null;
  /** 宿主注入：透传基线关键词（父组件 keyword prop 原样）。 */
  fallbackKeyword: () => string = () => "";
  /** 宿主注入：语言（pdf 分支 findController 自理首个命中）。 */
  language: () => string = () => "text";
  /** 宿主注入：聚焦输入框（宿主渲染后找 .highlight-bar input focus）。 */
  focusInput: (() => Promise<void>) | null = null;
  /** 宿主注入：跳首个命中（md 分支）。 */
  jumpToFirstHit: (() => Promise<void>) | null = null;
  /** 宿主注入：步进命中（md=源文本索引 / pdf=findagain）。 */
  stepHit: ((dir: 1 | -1) => Promise<void>) | null = null;

  /** 输入停顿 debounce（ms）。 */
  static readonly DEBOUNCE_MS = 300;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected?(): void {}
  hostDisconnected(): void { this.clearDebounce(); }

  get show(): boolean { return this._show; }
  get input(): string { return this._input; }

  /** md-viewer 生效的关键词。 */
  get effectiveKeyword(): string {
    return this._input.trim()
      ? this.normalize!(this._input)
      : this.fallbackKeyword();
  }

  /** 换文档：清空输入并收起输入条，不残留旧文档的高亮。 */
  onPathChanged(): void {
    this._input = "";
    this._show = false;
    this.clearDebounce();
    this.host.requestUpdate();
  }

  async toggle(): Promise<void> {
    this._show = !this._show;
    this.host.requestUpdate();
    if (this._show) await this.focusInput?.();
  }

  onInput(value: string): void {
    this._input = value;
    // 输入停顿 300ms 后自动跳到第一个命中（Enter 立即跳）
    this.clearDebounce();
    if (!this._input.trim()) {
      this.host.requestUpdate();
      return;
    }
    this._debounce = window.setTimeout(() => {
      this._debounce = undefined;
      void this.jumpToFirstHit?.();
    }, KeywordHighlightController.DEBOUNCE_MS);
    this.host.requestUpdate();
  }

  /** Enter=下一个 / Shift+Enter=上一个（浏览器 find bar 手感）。 */
  onKeydown(e: KeyboardEvent): void {
    if (e.key === "Enter") {
      this.clearDebounce();
      void this.stepHit?.(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      this.clearAll();
    }
  }

  clearAll(): void {
    this.clearDebounce();
    this._input = "";
    this._show = false;
    this.host.requestUpdate();
  }

  clearDebounce(): void {
    if (this._debounce !== undefined) {
      window.clearTimeout(this._debounce);
      this._debounce = undefined;
    }
  }
}

/** PDF 翻译弹框（ADR-0039）：纯显隐态 + 产物路径反馈事件。
 *  语言/页码/产物形态选择与后台串行队列都在 translate-dialog 组件内。 */
export class TranslateController implements ReactiveController {
  private host: ReactiveControllerHost;
  private _show = false;

  /** 宿主注入：入口可用判定（预览模式 + pdf + 有 path + 非 PST + 非译本）。 */
  available: () => boolean = () => false;
  /** 完成反馈事件派发（宿主注入——translate-finished）。 */
  onFinished: ((paths: string[]) => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected?(): void {}
  hostDisconnected?(): void { this._show = false; }

  get show(): boolean { return this._show; }
  get visible(): boolean { return this.available() && this._show; }

  toggle(): void {
    if (!this.available()) return;
    this._show = !this._show;
    this.host.requestUpdate();
  }

  /** 翻译完成：关弹框（toast 由宿主事件消费方出）。 */
  done(paths: string[]): void {
    this._show = false;
    this.host.requestUpdate();
    this.onFinished?.(paths);
  }
}
