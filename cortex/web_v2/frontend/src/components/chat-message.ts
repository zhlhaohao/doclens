import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { ChatMessage } from "../state/types";

@customElement("chat-message")
export class ChatMessageEl extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 75%;
    }
    :host([role="user"]) { align-self: flex-end; }
    :host([role="assistant"]) { align-self: flex-start; }
    .bubble {
      padding: 10px 14px;
      border-radius: 12px;
      font-size: var(--cortex-fs-md);
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }
    :host([role="user"]) .bubble {
      background: var(--cortex-primary);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    :host([role="assistant"]) .bubble {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border: 1px solid var(--cortex-border);
      border-bottom-left-radius: 4px;
    }
    .error {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      margin-top: 4px;
    }
  `;

  @property({ reflect: true }) role: "user" | "assistant" = "user";
  @property({ attribute: false }) message: ChatMessage | null = null;
  @property() error: string | null = null;

  render() {
    if (!this.message) return null;
    return html`
      <div class="bubble">${this.message.content}${this.message.content === "" ? html`<span style="opacity:0.6">思考中...</span>` : null}</div>
      ${this.error ? html`<div class="error">⚠️ ${this.error}</div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-message": ChatMessageEl;
  }
}
