import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChatMessage } from "../state/types";

@customElement("chat-stream")
export class ChatStream extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
      flex: 1;
      padding: 20px 18px 12px;
      overflow-y: auto;
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
      margin-top: var(--cortex-space-8);
    }
  `;

  @property({ attribute: false }) messages: ChatMessage[] = [];

  updated() {
    // 自动滚动到底部
    this.scrollTop = this.scrollHeight;
  }

  render() {
    if (this.messages.length === 0) {
      return html`<div class="empty">开始与 Doclens 对话</div>`;
    }
    return html`
      ${this.messages.map((m) => html`<chat-message role=${m.role} .message=${m}></chat-message>`)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-stream": ChatStream;
  }
}
