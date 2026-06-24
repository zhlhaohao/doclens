import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChatMessage } from "../state/types";

@customElement("chat-stream")
export class ChatStream extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      flex: 1;
      padding: var(--cortex-space-4) var(--cortex-space-6);
      overflow-y: auto;
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
      return html`<div class="empty">开始与 Cortex 对话</div>`;
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
