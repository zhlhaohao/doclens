import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/** 全屏图片查看器：overlay + 手势/滚轮缩放 + 拖拽平移 + ESC 关闭。
 *
 * 用法：设置 src 属性即显示；dispatch `close` 事件时父组件移除。
 * 支持桌面（滚轮缩放 + 鼠标拖拽 + 双击切换 1x/2x）和
 * 移动端（双指缩放 + 单指拖拽）。
 */
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
    return html`
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
          src=${this.src}
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
