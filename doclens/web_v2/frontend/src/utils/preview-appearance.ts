/** 预览外观域（AP-1 拆分件）：字号缩放 / 代码主题 / 全屏三块纯呈现态，
 *  此前内联在 preview-pane（God Object 职责域之一，2026-11-15 迁出，
 *  台账 antipatterns/frontend-file-preview.md AP-1 批 1）。
 *
 *  三块共同特征：零出块依赖（各自 localStorage / DOM class）、无外部事件、
 *  无宿主 prop 交叠——按 bookmarks-controller 范式拆分：状态私有化于
 *  controller，宿主经只读 getter 消费、经方法驱动动作。 */

import { ReactiveController, ReactiveControllerHost } from "lit";

/** 百分比档位状态机（md 正文字号 / 行号视图字号各一实例；持久化函数注入）。
 *  min/max/default/step 由注入的存取模块携带（font-scale / code-font-scale）。 */
export class FontScaleController implements ReactiveController {
  private host: ReactiveControllerHost;
  private _pct: number;

  constructor(
    host: ReactiveControllerHost,
    private readonly io: {
      read: () => number;
      write: (pct: number) => void;
      min: number;
      max: number;
      defaultPct: number;
      step: number;
    },
  ) {
    this.host = host;
    this._pct = io.read();
    host.addController(this);
  }

  hostConnected?(): void {}
  hostDisconnected?(): void {}

  get pct(): number { return this._pct; }
  get atMin(): boolean { return this._pct <= this.io.min; }
  get atMax(): boolean { return this._pct >= this.io.max; }

  bump(delta: number): void {
    const next = Math.min(this.io.max, Math.max(this.io.min, this._pct + delta));
    if (next === this._pct) return;
    this._pct = next;
    this.io.write(next);
    this.host.requestUpdate();
  }

  /** 点击百分比回默认 100%（对齐 PDF 缩放组「点击回适宽」惯例）。 */
  reset(): void {
    if (this._pct === this.io.defaultPct) return;
    this._pct = this.io.defaultPct;
    this.io.write(this.io.defaultPct);
    this.host.requestUpdate();
  }

  stepMinus(): void { this.bump(-this.io.step); }
  stepPlus(): void { this.bump(this.io.step); }
}

/** 代码主题三态循环（ADR-0036/0043：auto=跟随应用 ⇄ 浅 ⇄ 深），即选即生效
 *  + 落盘（auto 落盘 = 清除记录）。 */
export class CodeThemeController<T extends string> implements ReactiveController {
  private host: ReactiveControllerHost;
  private _theme: T;

  constructor(
    host: ReactiveControllerHost,
    private readonly io: {
      read: () => T;
      write: (t: T) => void;
      order: readonly T[];
    },
  ) {
    this.host = host;
    this._theme = io.read();
    host.addController(this);
  }

  hostConnected?(): void {}
  hostDisconnected?(): void {}

  get theme(): T { return this._theme; }

  toggle(): void {
    const { order } = this.io;
    const next = order[(order.indexOf(this._theme) + 1) % order.length];
    this._theme = next;
    this.io.write(next);
    this.host.requestUpdate();
  }
}

/** 预览全屏（类视频全屏）：CSS 覆盖层形态——不用原生 Fullscreen API
 *  （pdf-viewer 的 portal 挂 document.body，全屏顶层元素是本组件时 portal
 *  会被排除在外导致 PDF 白屏）。body class 联动提升 portal z-index。
 *  Esc 退出（keydown 冒泡阶段，避免与输入框内 Esc 冲突时被拦截）。 */
export class FullscreenController implements ReactiveController {
  private host: ReactiveControllerHost;
  private _on = false;

  constructor(
    host: ReactiveControllerHost,
    private readonly hostEl: HTMLElement,
  ) {
    this.host = host;
    host.addController(this);
  }

  get on(): boolean { return this._on; }

  hostConnected(): void {
    document.addEventListener("keydown", this._onKeydown);
  }

  hostDisconnected(): void {
    document.removeEventListener("keydown", this._onKeydown);
    this._on = false;
  }

  /** keep-alive 复挂载：全屏 class 若残留（断连重建）复位（宿主
   *  connectedCallback 调用——与 controller 自身 hostConnected 顺序无约定，
   *  幂等安全）。 */
  resetIfStale(): void {
    if (this._on) {
      this._on = false;
      this._apply();
    }
  }

  toggle(): void {
    this._on = !this._on;
    this._apply();
  }

  private _onKeydown = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && this._on) {
      this._on = false;
      this._apply();
    }
  };

  private _apply(): void {
    this.hostEl.classList.toggle("preview-fullscreen", this._on);
    document.body.classList.toggle("cortex-preview-fs", this._on);
    this.host.requestUpdate();
  }
}
