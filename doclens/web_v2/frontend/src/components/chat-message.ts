import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { marked } from "marked";
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
      word-break: break-word;
    }
    :host([role="user"]) .bubble {
      background: var(--cortex-primary);
      color: #fff;
      border-bottom-right-radius: 4px;
      /* 用户输入按纯文本展示：保留换行、不解析 markdown */
      white-space: pre-wrap;
    }
    :host([role="assistant"]) .bubble {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border: 1px solid var(--cortex-border);
      border-bottom-left-radius: 4px;
    }
    /* assistant 回复的 markdown 渲染（紧凑气泡风格） */
    .md-body > :first-child { margin-top: 0; }
    .md-body > :last-child { margin-bottom: 0; }
    .md-body p { margin: 0.4em 0; }
    .md-body h1, .md-body h2, .md-body h3 {
      margin: 0.6em 0 0.3em;
      line-height: 1.3;
    }
    .md-body h1 { font-size: 1.2em; }
    .md-body h2 { font-size: 1.1em; }
    .md-body h3 { font-size: 1em; }
    .md-body ul, .md-body ol { margin: 0.4em 0; padding-left: 1.4em; }
    .md-body li { margin: 0.15em 0; }
    .md-body pre {
      background: var(--cortex-surface);
      padding: 8px 10px;
      border-radius: 6px;
      overflow-x: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      margin: 0.5em 0;
    }
    .md-body code {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
    }
    .md-body :not(pre) > code {
      background: var(--cortex-surface);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .md-body blockquote {
      border-left: 3px solid var(--cortex-border);
      padding-left: 10px;
      margin: 0.4em 0;
      color: var(--cortex-text-muted);
    }
    .md-body table {
      border-collapse: collapse;
      margin: 0.5em 0;
      font-size: var(--cortex-fs-sm);
      display: block;
      overflow-x: auto;  /* 宽表横向滚动，避免撑破气泡 */
    }
    .md-body th, .md-body td {
      border: 1px solid var(--cortex-border);
      padding: 4px 8px;
      text-align: left;
      vertical-align: top;
    }
    .md-body th {
      background: var(--cortex-surface);
      font-weight: 600;
    }
    .thinking { opacity: 0.6; }
    .error {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      margin-top: 4px;
    }
  `;

  @property({ reflect: true }) role: "user" | "assistant" = "user";
  @property({ attribute: false }) message: ChatMessage | null = null;
  @property() error: string | null = null;

  /** assistant: markdown 渲染；user: 纯文本（保留换行）；空内容显示思考占位 */
  private renderBubble(content: string) {
    if (content === "") return html`<span class="thinking">思考中...</span>`;
    if (this.role === "assistant") {
      const htmlstr = marked.parse(content, { async: false }) as string;
      return html`<div class="md-body" .innerHTML=${htmlstr}></div>`;
    }
    return content;
  }

  render() {
    if (!this.message) return null;
    return html`
      <div class="bubble">${this.renderBubble(this.message.content)}</div>
      ${this.error ? html`<div class="error">⚠️ ${this.error}</div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-message": ChatMessageEl;
  }
}
