import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { dialogSlotStyles } from "../utils/dialog-styles";
import { formStyles } from "../styles/form-styles";

/** 插话输入对话框（ADR-0048 决策 7，AP-1 从 chat-view 抽出）：向正在执行
 *  的 AI 提问或下达临时指令（当前步骤完成后送达，不打断原任务）。
 *  提交冒泡 submit（detail.text），取消/ESC 冒泡 cancel；API 调用与
 *  结果 toast 由 chat-view 负责。 */
@customElement("interject-dialog")
export class InterjectDialog extends LitElement {
  static styles = [
    formStyles,
    dialogSlotStyles,
    css`
      :host {
        display: block;
        max-width: 380px;
        font-size: var(--cortex-fs-md);
        color: var(--cortex-text);
      }
      h2 { font-size: var(--cortex-fs-lg); margin: 0 0 var(--cortex-space-2); }
      .hint {
        margin: 0 0 var(--cortex-space-3);
        color: var(--cortex-text-subtle);
        font-size: var(--cortex-fs-sm);
        line-height: 1.5;
      }
      /* 插话输入区：字号略大（本地尺寸覆盖，形态走公共块） */
      textarea {
        width: 100%;
        font-size: var(--cortex-fs-md);
        font-family: var(--cortex-font);
      }
    `,
  ];

  @state() private _draft = "";

  private _submit = (): void => {
    const text = this._draft.trim();
    if (!text) return;
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { text }, bubbles: true, composed: true,
    }));
  };

  private _onCancel = (): void => {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  render() {
    return html`
      <h2>插话</h2>
      <p class="hint">向正在执行的 AI 提问或下达临时指令。当前步骤
        完成后送达，AI 只做文字汇报并继续原任务，不会被打断。</p>
      <textarea
        rows="4"
        placeholder="例如：现在进度汇报一下 / 改用方案 B / 已读文件里有线索吗"
        .value=${this._draft}
        @input=${(e: InputEvent) => {
          this._draft = (e.target as HTMLTextAreaElement).value;
        }}
        @keydown=${(e: KeyboardEvent) => {
          // Ctrl/Cmd+Enter 快捷提交（Enter 留给多行输入）
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            this._submit();
          }
        }}></textarea>
      <div class="buttons">
        <button type="button" @click=${this._onCancel}>取消</button>
        <button class="primary" type="button" ?disabled=${!this._draft.trim()}
                @click=${this._submit}>插入</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "interject-dialog": InterjectDialog;
  }
}
