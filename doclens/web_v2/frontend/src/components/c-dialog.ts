/**
 * <c-dialog> —— 原生 <dialog> 对话框外壳（AP-3）。
 *
 *  此前对话框外壳有两族并存：
 *  - **族 A**（about / backup / control-panel / watch-changes / workdir-switch）：
 *    自管 scrim 全屏外壳——`:host` fixed + `:host([open])` 遮罩 + `.scrim`
 *    + **自绘** `<dialog>` 卡片 + `.head`/`.close-btn`，各自管理 Esc。
 *    **未走 top-layer**——遇 PDF portal（document.body 下 z-index:1）
 *    会被压住（preview-pane.ts:382 注释自认「showModal：top layer 全屏
 *    居中——不被 PDF portal 遮挡」）。
 *  - **族 B**（chat-view / files-view / diary-view 三个宿主）：真原生
 *    `<dialog>` + `showModal()`（top-layer），但**样式三份近似复制**
 *    （border-radius-xl + padding:0 + surface + shadow-lg + max-width:90vw
 *    + ::backdrop + `dialog > *` padding），且 23 处宿主各自手动
 *    `showModal()`——files-view 更是用单选 `querySelector("dialog")`
 *    （同页多 dialog 时只有第一个被模态化）。
 *
 *  归一：外壳统一为**原生 `<dialog>` + showModal()**（top-layer 是正解，
 *  z-index 治不了 portal 遮挡），由本组件负责 showModal 时机、
 *  ESC/cancel 事件转发、backdrop、移动端撑满；内容用 slot 承载。
 *
 *  用法：
 *   <c-dialog ?open=${this.open} @cancel=${this._onCancel}>
 *     <div class="head"><h3>标题</h3></div>
 *     ...内容...
 *   </c-dialog>
 *
 *  事件：
 *   - `cancel`：原生 ESC 关闭请求（宿主决定是否关闭——如删轮确认框在
 *     提交中要拦截）
 *   - `close`：原生 dialog 关闭（点 backdrop 或 ESC 生效后）
 *
 *  样式：卡片形态（边框/圆角/阴影/背景）与 backdrop 走
 *  `styles/dialog-frame.ts` 的 `dialogCardStyles`；内容内边距由本组件
 *  的 `.card` 承载（原 `dialog > *` 规则在 slot 投影下会落到 slot 而非
 *  实际内容，故改由内部包裹层承担）。
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { dialogCardStyles } from "../styles/dialog-frame";

@customElement("c-dialog")
export class CDialog extends LitElement {
  static styles = [
    dialogCardStyles,
    css`
      :host {
        display: contents;
      }
      /* 内容包裹层：承载原 dialog > * 的内边距（slot 投影下该规则
         落在 slot 元素上而非实际内容，故由内部层承担） */
      .card {
        display: block;
        padding: var(--cortex-space-6);
      }
      @media (max-width: 1023px) {
        .card {
          padding: var(--cortex-space-4);
        }
      }
    `,
  ];

  /** 是否打开。true 时组件在渲染后调用 showModal() 进 top-layer。 */
  @property({ type: Boolean, reflect: true }) open = false;
  /** 卡片最小宽度（px；0 = 不设）。宿主按需覆盖（如 files-view 360px）。 */
  @property({ type: Number }) minWidth = 0;

  protected updated(changed: Map<string, unknown>) {
    if (!changed.has("open")) return;
    const dlg = this.renderRoot.querySelector("dialog");
    if (!dlg) return;
    if (this.open) {
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) {
      dlg.close();
    }
  }

  /** ESC / 原生 cancel → 派发 cancel（宿主决定是否关闭）。 */
  private _onCancel = (): void => {
    // 不 preventDefault——宿主若要「本次不可关」自行处理；默认让原生
    // 关闭（组件在 updated 里会同步 open 状态）。
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  /** 原生 dialog 关闭（点 backdrop 或 ESC 生效后）→ 派发 close。 */
  private _onClose = (): void => {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  };

  render() {
    if (!this.open) return nothing;
    const style = this.minWidth > 0 ? `min-width:${this.minWidth}px;` : "";
    return html`
      <dialog style=${style} @cancel=${this._onCancel} @close=${this._onClose}>
        <div class="card">
          <slot></slot>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "c-dialog": CDialog;
  }
}
