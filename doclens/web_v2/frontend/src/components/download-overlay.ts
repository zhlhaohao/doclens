import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <download-overlay> —— 下载中屏幕中心遮罩（preview-pane 与 files-view
 * 的 jsbridge 原生下载共用；与 files-view 上传遮罩同款视觉）。
 *
 * fixed 覆盖整个视口 + ring 旋转动画 + label；open=false 不渲染。
 * 原生下载大文件可达分钟级、且 Android 侧插件未实装时回调挂死——
 * 遮罩是这期间唯一的进行中反馈（见 download_bridge.md）。
 */
@customElement("download-overlay")
export class DownloadOverlay extends LitElement {
  static styles = css`
    .download-overlay {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: var(--cortex-space-4);
      background: color-mix(in srgb, var(--cortex-bg) 72%, transparent);
      backdrop-filter: blur(2px);
      z-index: 9999;
    }
    .ring {
      width: 40px; height: 40px;
      border: 4px solid var(--cortex-border);
      border-top-color: var(--cortex-primary);
      border-radius: 50%;
      animation: cortex-download-spin 0.8s linear infinite;
    }
    .label {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
    @keyframes cortex-download-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .ring { animation: none; }
    }
  `;

  @property({ type: Boolean }) open = false;
  @property() label = "下载中…";

  render() {
    if (!this.open) return null;
    return html`<div class="download-overlay" role="status" aria-live="polite">
      <div class="ring"></div>
      <div class="label">${this.label}</div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "download-overlay": DownloadOverlay;
  }
}
