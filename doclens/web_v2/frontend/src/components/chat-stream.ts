import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChatMessage } from "../state/types";

@customElement("chat-stream")
export class ChatStream extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4);
      flex: 1;
      padding: var(--cortex-space-4);
      overflow-y: auto;
      background: var(--cortex-chat-bg);
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    :host::-webkit-scrollbar {
      display: none;
    }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      text-align: center;
      align-self: center;
      margin: auto;
    }
  `;

  @property({ attribute: false }) messages: ChatMessage[] = [];
  /** 当前 AI 模型 id（来自 store.getState().status?.model_name）。
   *  传 null/空串 → 思考中仅显示「思考中...」，不展示模型前缀。 */
  @property({ attribute: false }) modelName: string | null = null;
  private _scrollRafPending = false;

  updated() {
    // 自动滚动到底部：延迟到下一帧，等子组件（chat-message → chat-tool-trace）
    // 渲染/展开后再算 scrollHeight；guard 合并同帧多次 updated 为单次 rAF
    if (this._scrollRafPending) return;
    this._scrollRafPending = true;
    requestAnimationFrame(() => {
      this._scrollRafPending = false;
      this.scrollTop = this.scrollHeight;
    });
  }

  render() {
    if (this.messages.length === 0) {
      return html`<div class="empty">开始与 Doclens 对话</div>`;
    }
    return html`
      ${this.messages.map((m) => html`<chat-message role=${m.role} .message=${m} .modelName=${this.modelName}></chat-message>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-stream": ChatStream;
  }
}
