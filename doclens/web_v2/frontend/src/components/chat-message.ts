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
    /* 结构化引用卡片：path 来自检索工具结果（非 AI 正文），任意扩展名/格式都可点 */
    .references {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--cortex-border-muted);
    }
    .references-title {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-bottom: 4px;
    }
    .references ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .ref-link {
      color: var(--cortex-primary);
      text-decoration: underline;
      cursor: pointer;
      font-size: var(--cortex-fs-sm);
      word-break: break-all;
    }
    .ref-link:hover { opacity: 0.8; }
    .thinking { opacity: 0.6; }
    .trace-sep { border-top: 1px dashed var(--cortex-border); margin: 7px 0; }
    .error {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      margin-top: 4px;
    }
  `;

  @property({ reflect: true }) role: "user" | "assistant" = "user";
  @property({ attribute: false }) message: ChatMessage | null = null;
  @property() error: string | null = null;

  firstUpdated() {
    this.addEventListener("click", this._onClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this._onClick);
  }

  /** 事件委托：命中 .ref-link 时派发 reference-click（供 chat-view 打开预览）。 */
  private _onClick = (e: MouseEvent): void => {
    const target = e.composedPath().find(
      (n): n is HTMLElement =>
        n instanceof HTMLElement && n.classList.contains("ref-link"),
    );
    if (!target) return;
    e.preventDefault();
    const path = target.getAttribute("data-path") ?? "";
    this.dispatchEvent(
      new CustomEvent("reference-click", {
        detail: { path },
        bubbles: true,
        composed: true,
      }),
    );
  };

  /** assistant: markdown 渲染；user: 纯文本（保留换行）；空内容显示思考占位 */
  private renderBubble(content: string) {
    if (content === "") return html`<span class="thinking">思考中...</span>`;
    if (this.role === "assistant") {
      const htmlstr = marked.parse(content, { async: false }) as string;
      return html`<div class="md-body" .innerHTML=${htmlstr}></div>`;
    }
    return content;
  }

  /** 结构化引用卡片：每条 path 渲染为可点击 .ref-link（点击由 _onClick 委托派发）。 */
  private renderReferences() {
    const refs = this.message?.references;
    if (!refs || refs.length === 0) return null;
    return html`<div class="references">
      <div class="references-title">📎 参考资料</div>
      <ul>
        ${refs.map((r) => html`<li><a class="ref-link" data-path=${r.path} href="#">${r.path}</a></li>`)}
      </ul>
    </div>`;
  }

  render() {
    if (!this.message) return null;
    const steps = this.message.tool_steps;
    const showTrace = this.role === "assistant" && steps && steps.length > 0;
    return html`
      <div class="bubble">
        ${showTrace
          ? html`<chat-tool-trace .steps=${steps}></chat-tool-trace><div class="trace-sep"></div>`
          : null}
        ${this.renderBubble(this.message.content)}
        ${this.role === "assistant" ? this.renderReferences() : null}
        ${this.error ? html`<div class="error">⚠️ ${this.error}</div>` : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-message": ChatMessageEl;
  }
}
