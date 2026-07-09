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
    .md-body .ref-link {
      color: var(--cortex-primary);
      text-decoration: underline;
      cursor: pointer;
    }
    .md-body .ref-link:hover {
      opacity: 0.8;
    }
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

  updated(changed: Map<string, unknown>) {
    if (changed.has("message") && this.role === "assistant") {
      this._processReferences();
    }
  }

  /** 后处理：把「## 参考资料」后的路径包裹成可点击 .ref-link。幂等。
   *  兼容 AI 多种格式：<ol>/<ul> 的 <li>；[N] path 或 N. path 文本段落；
   *  [text](url) markdown 链接（data-path 取 url，由 chat-view 清洗 file://）。 */
  private _processReferences(): void {
    const body = this.renderRoot.querySelector(".md-body");
    if (!body) return;
    const headings = Array.from(body.querySelectorAll("h2"));
    const refHeading = headings.find((h) => (h.textContent ?? "").includes("参考资料"));
    if (!refHeading) return;

    // 从参考资料标题后，遍历所有兄弟元素直到下一个 h2（或末尾）
    let el: Element | null = refHeading.nextElementSibling;
    while (el && el.tagName !== "H2") {
      this._wrapPathsInElement(el);
      el = el.nextElementSibling;
    }
  }

  /** 在单个元素内把路径包裹成 .ref-link。
   *  - <ol>/<ul>：处理每个 <li>（路径 = li 全文去编号前缀）
   *  - 其他（<p> 等）：按行匹配 [N] path / N. path / 纯 path，或 [text](url) markdown 链接 */
  private _wrapPathsInElement(el: Element): void {
    if (el.querySelector(".ref-link")) return; // 已处理（幂等）

    if (el.tagName === "OL" || el.tagName === "UL") {
      el.querySelectorAll("li").forEach((li) => this._wrapLi(li as HTMLElement));
      return;
    }

    // 段落/文本：遍历子节点（含 <a> markdown 链接 + 文本节点）
    const nodes = Array.from(el.childNodes);
    for (const node of nodes) {
      if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "A") {
        // 已是 markdown 链接 <a href="...">text</a>：保留，加 .ref-link + data-path=url（decode）
        const a = node as HTMLAnchorElement;
        if (a.classList.contains("ref-link")) continue;
        const raw = a.getAttribute("href") ?? "";
        if (!raw) continue;
        let url = raw;
        try { url = decodeURIComponent(raw); } catch { /* leave */ }
        a.classList.add("ref-link");
        a.setAttribute("data-path", url);
        continue;
      }
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const text = node.textContent ?? "";
      // 文本可能含多行（如 "[1] a.md\n[2] b.md" 在一个 <p> 内），按行拆分处理
      const lines = text.split("\n");
      if (lines.length <= 1) {
        const a = this._makeRefLinkFromText(text);
        if (a) el.replaceChild(a, node);
        continue;
      }
      // 多行：用 <span> 包裹多个 .ref-link（每行一个），保留行间 <br>
      const frag = document.createDocumentFragment();
      let made = false;
      lines.forEach((line, i) => {
        if (i > 0) frag.appendChild(document.createElement("br"));
        const a = this._makeRefLinkFromText(line);
        if (a) { frag.appendChild(a); made = true; }
        else if (line.trim()) frag.appendChild(document.createTextNode(line));
      });
      if (made) el.replaceChild(frag, node);
    }
  }

  /** 从单行文本提取路径并建 .ref-link。匹配 [N] path / N. path / 纯 path。
   *  path 须像文档路径（含 . 扩展名 或 / 或 \）。无匹配返回 null。 */
  private _makeRefLinkFromText(text: string): HTMLAnchorElement | null {
    const m = text.match(/^\s*(?:\[\d+\]\s*|\d+[.)]\s*)?(.+\.md|.+(?:\/|\\).+)\s*$/);
    if (!m) return null;
    const path = m[1].trim();
    if (!path) return null;
    const a = document.createElement("a");
    a.className = "ref-link";
    a.setAttribute("data-path", path);
    a.setAttribute("href", "#");
    a.textContent = path;
    return a;
  }

  /** <li> 内容可能是纯路径、[N] path、N. path、或 [text](url) 链接 */
  private _wrapLi(li: HTMLElement): void {
    if (li.querySelector(".ref-link")) return;
    // 若 li 内已有 <a>（markdown 链接），复用
    const innerA = li.querySelector("a");
    if (innerA) {
      const url = innerA.getAttribute("href") ?? "";
      if (url) {
        innerA.classList.add("ref-link");
        innerA.setAttribute("data-path", url);
        return;
      }
    }
    const text = (li.textContent ?? "").trim();
    // 去编号前缀 [N] / N. / N)
    const path = text.replace(/^\[\d+\]\s*/, "").replace(/^\d+[.)]\s*/, "").trim();
    if (!path) return;
    const a = document.createElement("a");
    a.className = "ref-link";
    a.setAttribute("data-path", path);
    a.setAttribute("href", "#");
    a.textContent = path;
    li.textContent = "";
    li.appendChild(a);
  }

  /** 事件委托：命中 .ref-link 时派发 reference-click。 */
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
