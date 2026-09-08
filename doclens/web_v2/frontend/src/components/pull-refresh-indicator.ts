import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

/** 下拉刷新浮层指示器（移动端 pull-to-refresh）。
 *
 * 命令式 API（同 toast-stack.pushToast 范式）：触摸高频路径由
 * PullToRefreshController 直调方法、内部直写 style.transform，
 * 不走 Lit 响应式更新，保证跟手 60fps。
 *
 * 视觉：Material 风格胶囊，初始藏在 app-bar 后（z-index 低于其 50），
 * 下拉时从 app-bar 下沿滑出；armed 后箭头翻转 180° 并变钴蓝；
 * refreshing 态换 spinner（视觉配方同 search-results 的 cortex-spin）。
 */
@customElement("ptr-indicator")
export class PullRefreshIndicator extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 50%;
      z-index: 40; /* 低于 app-bar 的 50：初始位置藏在其后 */
      transform: translate(-50%, -110%);
      transition: none; /* 跟手阶段由 JS 直写 transform，无过渡 */
      pointer-events: none;
    }
    /* 松手回弹/收起阶段启用过渡 */
    :host(.settle) {
      transition:
        transform var(--cortex-duration) var(--cortex-ease),
        opacity var(--cortex-duration-fast) linear;
    }
    .pill {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-2);
      padding: 6px var(--cortex-space-4);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill);
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-md);
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
      color: var(--cortex-text-muted);
      white-space: nowrap;
    }
    .arrow {
      color: var(--cortex-text-subtle);
      transition: transform var(--cortex-duration) var(--cortex-ease),
        color var(--cortex-duration-fast) linear;
    }
    :host([armed]) .arrow {
      transform: rotate(180deg);
      color: var(--cortex-primary);
    }
    /* 刷新中 spinner：视觉配方同 search-results 的 loading::after */
    .ring {
      display: none;
      width: 14px;
      height: 14px;
      border: 2px solid var(--cortex-border);
      border-top-color: var(--cortex-primary);
      border-radius: 50%;
    }
    :host([refreshing]) .ring {
      display: inline-block;
      animation: ptr-spin 0.8s linear infinite;
    }
    :host([refreshing]) .arrow { display: none; }
    @keyframes ptr-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .ring { animation: none; }
      .arrow,
      :host(.settle) { transition: none; }
    }
  `;

  /** 跟手阶段：指示器跟随下拉距离滑出。px 为阻尼后行程，armed 表示已达触发阈值。 */
  showPull(px: number, armed: boolean) {
    this.classList.remove("settle");
    this.removeAttribute("refreshing");
    this._setMode("pull", armed ? "松开刷新" : "下拉刷新");
    if (armed) this.setAttribute("armed", "");
    else this.removeAttribute("armed");
    this.style.transform = `translate(-50%, ${Math.max(0, px)}px)`;
  }

  /** 刷新执行中：spinner 停驻在顶部。 */
  showRefreshing() {
    this.classList.remove("settle");
    this.setAttribute("refreshing", "");
    this.removeAttribute("armed");
    this._setMode("pull", "刷新中…");
    this.style.transform = "translate(-50%, 8px)";
  }

  /** 收起：带过渡滑回 app-bar 后。 */
  hide() {
    if (!this.classList.contains("settle") && this.style.transform === "") return;
    this.removeAttribute("armed");
    this.removeAttribute("refreshing");
    this.classList.add("settle");
    this.style.transform = "translate(-50%, -110%)";
  }

  /** 拉动文案切换：仅当文案变化时才反射属性，避免高频无谓渲染。 */
  private _setMode(_mode: "pull", label: string) {
    if (this._label !== label) {
      this._label = label;
      this.requestUpdate();
    }
  }

  private _label = "下拉刷新";

  protected render() {
    return html`
      <div class="pill" part="pill">
        <svg class="arrow" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 3v10M8 13l-4-4M8 13l4-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="ring" aria-hidden="true"></span>
        <span class="label">${this._label}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ptr-indicator": PullRefreshIndicator;
  }
}
