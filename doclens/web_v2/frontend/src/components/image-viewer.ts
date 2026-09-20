import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { rotatePreviewImage } from "../api/preview";

/** 全屏图片查看器：overlay + 手势/滚轮缩放 + 拖拽平移 + ESC 关闭。
 *
 * 用法：设置 src 属性即显示；dispatch `close` 事件时父组件移除。
 * 支持桌面（滚轮缩放 + 鼠标拖拽 + 双击切换 1x/2x）和
 * 移动端（双指缩放 + 单指拖拽）。
 *
 * 手动旋转（ADR-0029）：src 指向 /api/preview/raw 的知识库图像文件
 * （jpg/jpeg/png/webp）时显示旋转钮，点击顺时针 90° 落盘并即时刷新；
 * /api/preview/asset（文档内嵌图，ImageStore 提取产物）不提供。
 */

/** 可手动旋转的图像扩展名（与后端 ORIENTABLE_IMAGE_EXTS 对齐，仅 4 种）。 */
const ROTATABLE_EXTS = new Set(["jpg", "jpeg", "png", "webp"]);

/** 判定查看器 src 是否可手动旋转（ADR-0029）。
 *
 *  仅 /api/preview/raw 服务的知识库图像文件可转；返回其 workdir 相对
 *  路径，否则 null。pathname 用 endsWith 判定（容忍反向代理 base path）。 */
export function rotatablePathFromSrc(src: string): string | null {
  try {
    const url = new URL(src, window.location.href);
    if (!url.pathname.endsWith("/api/preview/raw")) return null;
    const path = url.searchParams.get("path");
    if (!path) return null;
    const dot = path.lastIndexOf(".");
    if (dot < 0) return null;
    return ROTATABLE_EXTS.has(path.slice(dot + 1).toLowerCase()) ? path : null;
  } catch {
    return null; // 相对/非 URL src 不参与
  }
}

/** 刷新 root 内指向 path 的 /api/preview/raw <img>（旋转落盘后防旧方向缓存）。
 *
 *  md-viewer 正文内嵌图与日记缩略图共用（ADR-0029）；asset 内嵌图不受影响。 */
export function bustRawImages(root: ParentNode | null, path: string): void {
  root?.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    try {
      const url = new URL(img.src, window.location.href);
      if (!url.pathname.endsWith("/api/preview/raw")) return;
      if (url.searchParams.get("path") !== path) return;
      url.searchParams.set("_rb", String(performance.now()));
      img.src = url.toString();
    } catch {
      // 非 URL 忽略
    }
  });
}

@customElement("image-viewer")
export class ImageViewer extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.92);
      overflow: hidden;
      touch-action: none;
      cursor: grab;
    }
    :host(:active) { cursor: grabbing; }
    .close-btn {
      position: fixed;
      top: calc(16px + env(safe-area-inset-top));
      right: 16px;
      z-index: 1;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .close-btn:hover { background: rgba(255, 255, 255, 0.3); }
    .rotate-btn {
      position: fixed;
      top: calc(16px + env(safe-area-inset-top));
      right: 68px;
      z-index: 1;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rotate-btn:hover { background: rgba(255, 255, 255, 0.3); }
    .rotate-btn:disabled { opacity: 0.5; cursor: wait; }
    .rotate-btn.failed { background: rgba(220, 38, 38, 0.55); }
    img {
      max-width: 92vw;
      max-height: 92vh;
      transform-origin: center center;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }
  `;

  @property() src = "";

  @state() private _scale = 1;
  @state() private _x = 0;
  @state() private _y = 0;
  /** 旋转进行中（禁用按钮防连点） */
  @state() private _rotating = false;
  /** 旋转失败的内联反馈（短暂红态，替代全局 toast） */
  @state() private _rotateFailed = false;
  /** 旋转成功后的 cache-bust 计数（拼进 img src 强制重载） */
  private _bust = 0;

  private _dragging = false;
  private _sx = 0;
  private _sy = 0;
  private _ox = 0;
  private _oy = 0;
  private _pinchDist = 0;
  private _pinchScale = 1;

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this._onKey);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._onKey);
    super.disconnectedCallback();
  }

  private _onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this._close();
  };

  private _close() {
    this._scale = 1;
    this._x = 0;
    this._y = 0;
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  // --- 手动旋转（ADR-0029）：点即转、不确认；连点累加角度 ---
  private get _rotatePath(): string | null {
    return rotatablePathFromSrc(this.src);
  }

  private async _onRotate() {
    const path = this._rotatePath;
    if (!path || this._rotating) return;
    this._rotating = true;
    this._rotateFailed = false;
    try {
      await rotatePreviewImage(path);
      this._bust += 1;
      this._scale = 1; // 方向已变，重置缩放/平移视图
      this._x = 0;
      this._y = 0;
    } catch {
      this._rotateFailed = true;
      setTimeout(() => { this._rotateFailed = false; }, 2000);
    } finally {
      this._rotating = false;
    }
  }

  // --- 滚轮缩放（桌面） ---
  private _onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    this._scale = Math.max(0.5, Math.min(5, this._scale + delta));
  }

  // --- 背景点击关闭 ---
  private _onBgClick(e: MouseEvent) {
    if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "DIV") {
      this._close();
    }
  }

  // --- 双击切换 ---
  private _onDbl() {
    if (this._scale > 1.5) { this._scale = 1; this._x = 0; this._y = 0; }
    else { this._scale = 2.5; }
  }

  // --- 鼠标拖拽 ---
  private _md(e: MouseEvent) {
    e.preventDefault();
    this._dragging = true;
    this._sx = e.clientX; this._sy = e.clientY;
    this._ox = this._x; this._oy = this._y;
  }
  private _mm(e: MouseEvent) {
    if (!this._dragging) return;
    this._x = this._ox + (e.clientX - this._sx);
    this._y = this._oy + (e.clientY - this._sy);
  }
  private _mu() { this._dragging = false; }

  // --- 触摸（单指拖拽 + 双指缩放） ---
  private _ts(e: TouchEvent) {
    if (e.touches.length === 1) {
      this._dragging = true;
      this._sx = e.touches[0].clientX; this._sy = e.touches[0].clientY;
      this._ox = this._x; this._oy = this._y;
    } else if (e.touches.length === 2) {
      this._dragging = false;
      this._pinchDist = this._dist(e.touches);
      this._pinchScale = this._scale;
    }
  }
  private _tm(e: TouchEvent) {
    e.preventDefault();
    if (e.touches.length === 1 && this._dragging) {
      this._x = this._ox + (e.touches[0].clientX - this._sx);
      this._y = this._oy + (e.touches[0].clientY - this._sy);
    } else if (e.touches.length === 2 && this._pinchDist > 0) {
      const ratio = this._dist(e.touches) / this._pinchDist;
      this._scale = Math.max(0.5, Math.min(5, this._pinchScale * ratio));
    }
  }
  private _te() { this._dragging = false; this._pinchDist = 0; }

  private _dist(t: TouchList): number {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }

  render() {
    const rotatePath = this._rotatePath;
    // 旋转成功后拼 cache-bust 参数强制重载（src 一定带 ?path=… 查询串）
    const imgSrc = this._bust > 0 && rotatePath
      ? `${this.src}&_rb=${this._bust}`
      : this.src;
    return html`
      ${rotatePath ? html`
        <button
          class="rotate-btn${this._rotateFailed ? " failed" : ""}"
          title="顺时针旋转 90° 并保存"
          ?disabled=${this._rotating}
          @click=${this._onRotate}
        >${this._rotateFailed ? "✕" : "⟳"}</button>
      ` : null}
      <button class="close-btn" @click=${this._close}>✕</button>
      <div
        style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;"
        @click=${this._onBgClick}
        @wheel=${this._onWheel}
        @dblclick=${this._onDbl}
        @mousedown=${this._md} @mousemove=${this._mm} @mouseup=${this._mu} @mouseleave=${this._mu}
        @touchstart=${this._ts} @touchmove=${this._tm} @touchend=${this._te}
      >
        <img
          src=${imgSrc}
          alt=""
          draggable="false"
          style="transform: translate(${this._x}px, ${this._y}px) scale(${this._scale})"
        />
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "image-viewer": ImageViewer; }
}
