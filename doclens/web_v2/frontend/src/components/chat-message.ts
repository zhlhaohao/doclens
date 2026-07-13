import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { marked } from "marked";
import type { ChatMessage } from "../state/types";

@customElement("chat-message")
export class ChatMessageEl extends LitElement {
  static styles = css`
    :host {
      display: block;
      max-width: 78%;
    }
    :host([role="user"]) { align-self: flex-end; }
    :host([role="assistant"]) { align-self: flex-start; width: 100%; max-width: 100%; }
    .bubble {
      padding: 10px 14px;
      border-radius: var(--cortex-radius-lg);
      font-size: var(--cortex-fs-md);
      line-height: 1.6;
      word-break: break-word;
      box-shadow: var(--cortex-shadow-sm);
    }
    /* 用户气泡：电蓝色底（--cortex-chat-bubble-user token） */
    :host([role="user"]) .bubble {
      display: flex;
      align-items: center;   /* 显式垂直居中：单行文字/匿名文本节点居中显示 */
      background: var(--cortex-chat-bubble-user);
      color: var(--cortex-chat-bubble-user-text);
      border: 1px solid var(--cortex-chat-bubble-user-border);
      border-bottom-right-radius: 6px;
      /* 用户输入按纯文本展示：保留换行、不解析 markdown */
      white-space: pre-wrap;
      /* user 气泡收紧：单行纯文本不需要 .bubble 通用的 10px 内边距与 1.6 行高，
         否则短消息气泡偏高（≈44px → ≈35px）。AI 气泡保留宽松值以适配多行 markdown。 */
      padding: 7px 12px;
      line-height: 1.4;
    }
    /* 用户气泡下方的小时间戳（17:08 风格） */
    .ts {
      display: block;
      text-align: right;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-top: 4px;
      padding-right: 4px;
    }
    /* AI 气泡：白底 + 极浅边框（更轻盈）。多子元素（trace / md / error）
       仍用普通文档流堆叠。 */
    :host([role="assistant"]) .bubble {
      background: var(--cortex-chat-bubble-ai);
      color: var(--cortex-text);
      border: 1px solid var(--cortex-chat-bubble-ai-border);
      border-bottom-left-radius: 6px;
      width: 100%;
      box-sizing: border-box;  /* outer 宽度计入 padding+border，不溢出 host */
    }
    /* assistant 回复的 markdown 渲染（紧凑气泡风格） */
    .md-body > :first-child { margin-top: 0; }
    .md-body > :last-child { margin-bottom: 0; }
    .md-body p { margin: 0.5em 0; }
    /* 结构化日程里的 section header：示例里是「?【周立松总经理】（今天）日程安排」
       这种带 ? 前缀的 H2 行内突出渲染为蓝色块标题 */
    .md-body h1, .md-body h2, .md-body h3, .md-body h4 {
      margin: 0.7em 0 0.4em;
      line-height: 1.4;
      color: var(--cortex-chat-section);
      font-weight: 600;
    }
    .md-body h1 { font-size: 1.05em; }
    .md-body h2 { font-size: 1em; }
    .md-body h3 { font-size: 0.95em; }
    .md-body h4 { font-size: 0.92em; }
    /* H2 内若以 ? 开头，去掉 ? 显示 + 让整行更醒目（贴近示例效果） */
    .md-body h2::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 1em;
      background: var(--cortex-chat-section);
      border-radius: 2px;
      margin-right: 8px;
      vertical-align: -2px;
    }
    .md-body ul, .md-body ol { margin: 0.4em 0; padding-left: 1.4em; }
    .md-body li { margin: 0.2em 0; }
    /* 结构化日程的"时间 + 描述"行：示例里是 09:00 日常工作 / 14:00 ... */
    .md-body li:has(> code),
    .md-body p > code:first-child {
      font-family: var(--cortex-font-mono);
    }
    .md-body pre {
      background: var(--cortex-surface-muted);
      padding: 8px 10px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      margin: 0.5em 0;
      border: 1px solid var(--cortex-border-muted);
    }
    .md-body code {
      font-family: var(--cortex-font-mono);
      font-size: 0.92em;
      color: var(--cortex-chat-section);
      background: var(--cortex-surface-muted);
      padding: 1px 6px;
      border-radius: var(--cortex-radius-sm);
    }
    .md-body :not(pre) > code {
      background: var(--cortex-surface-muted);
      padding: 0 3px;
      border-radius: var(--cortex-radius-sm);
    }
    .md-body blockquote {
      border-left: 3px solid var(--cortex-primary);
      padding-left: 12px;
      margin: 0.5em 0;
      color: var(--cortex-text-muted);
      background: var(--cortex-primary-soft);
      border-radius: 0 6px 6px 0;
      padding-top: 6px;
      padding-bottom: 6px;
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
      background: var(--cortex-surface-muted);
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
      text-decoration: none;
      cursor: pointer;
      font-weight: 500;
      font-size: var(--cortex-fs-sm);
      border-radius: var(--cortex-radius-sm);
      word-break: break-all;
    }
    .md-body .ref-link:hover {
      background: var(--cortex-primary-soft);
      text-decoration: underline;
    }
    .thinking {
      color: var(--cortex-text-subtle);
      font-style: italic;
    }
    .trace-sep {
      border-top: 1px dashed var(--cortex-border);
      margin: 8px 0;
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
      return html`<div class="md-body" .innerHTML=${this.linkifyReferences(htmlstr)}></div>`;
    }
    return content;
  }

  /** 把正文「## 参考资料」章节的路径列表项渲染为可点击 .ref-link。
   *  marked 把「数字. 路径」渲染为 <h2>参考资料</h2><ol><li>path</li></ol>；
   *  这里把章节内 <li> 的路径文本包成 <a class="ref-link" data-path>，点击由 _onClick 委托。
   *  仅处理该章节，不影响正文其它列表；路径合法性由后端 evaluate_round 校验。 */
  private linkifyReferences(html: string): string {
    // 匹配 <ol>（数字列表 1.）或 <ul>（破折号列表 -），兼容 AI 不同列表写法；
    // [^>]* 容忍 marked renderer 给标签加的属性（如 data-source-line）
    const sectionRe = /(<h2[^>]*>\s*参考资料\s*<\/h2>)\s*(<(?:ol|ul)[^>]*>[\s\S]*?<\/(?:ol|ul)>)/i;
    return html.replace(sectionRe, (_m, h2: string, list: string) => {
      const linkified = list.replace(/<li>([^<]+?)<\/li>/g, (_li: string, path: string) => {
        const p = path.trim();
        const attr = p.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return `<li><a class="ref-link" data-path="${attr}" href="#">${p}</a></li>`;
      });
      return `${h2}${linkified}`;
    });
  }

  render() {
    if (!this.message) return null;
    const steps = this.message.tool_steps;
    const showTrace = this.role === "assistant" && steps && steps.length > 0;
    // user 气泡走紧凑模板：render() 模板的换行+缩进会被 white-space: pre-wrap
    // 原样渲染成多余空行（textContent 混入 "\n    "，一行消息被撑成 4 行）。
    // assistant 气泡内部是 .md-body 等 block 元素，缩进空白无视觉影响，保留可读缩进。
    if (this.role === "user") {
      return html`<div class="bubble">${this.renderBubble(this.message.content)}${this.error
        ? html`<div class="error">⚠️ ${this.error}</div>`
        : null}</div>`;
    }
    return html`
      <div class="bubble">
        ${showTrace
          ? html`<chat-tool-trace .steps=${steps}></chat-tool-trace><div class="trace-sep"></div>`
          : null}
        ${this.renderBubble(this.message.content)}
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
