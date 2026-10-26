import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { Session } from "../state/types";
import "./icon";

@customElement("history-item")
export class HistoryItem extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      /* 弱化：去卡片化，改透明行 + 细分隔线 */
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--cortex-border-muted);
      border-radius: 0;
      padding: 7px 4px;
      cursor: pointer;
      transition: background var(--cortex-duration-fast);
    }
    :host(:hover) {
      background: var(--cortex-surface-muted);
    }
    /* 上次会话高亮（重启恢复的纯展示态，与 diary 子 tab active 视觉一致） */
    :host([active]) {
      background: var(--cortex-primary-soft);
    }
    :host([active]) .name {
      color: var(--cortex-primary);
      font-weight: 500;
    }
    :host(:last-child) {
      border-bottom: none;
    }
    .name {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      font-weight: 400;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      display: flex;
      align-items: center;
    }
    /* 标题文本：**溢出时尾锚定 + 左端渐隐**（2026-10-26 用户决议：会话
       标题关键信息常在末尾，窄屏下最后面的内容必须显示）。
       两态切换（JS 测量加 .over，见 _measureOverflow）：
       - 不溢出：正常左对齐（与旧行为一致，无视觉变化）；
       - 溢出：justify-content:flex-end 内容贴右、头部被裁，
         左端 24px mask 渐隐当视觉省略号。
       （纯 CSS 无条件 flex-end 会让短标题也贴右留白——第一版被用户
       否决；direction:rtl 左截断在块级 nowrap 容器不可靠——第 0 版
       实测无效。） */
    .name-text {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      white-space: nowrap;
    }
    .name-text.over {
      display: flex;
      justify-content: flex-end;
      -webkit-mask-image: linear-gradient(to right, transparent 0, black 24px);
      mask-image: linear-gradient(to right, transparent 0, black 24px);
    }
    .name-text-inner {
      display: inline-block; /* scrollWidth = 内容真实宽（测量依据）；
                                .over 态作 flex item 同样工作 */
      flex: 0 0 auto;
      min-width: 0;
    }
    .meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      flex-shrink: 0;
      margin-left: var(--cortex-space-2);
    }
    /* 移动端横向空间紧张：隐藏条目数与时间，仅留标题与操作钮。
       断点与 src/styles/breakpoints.css 移动段一致（<1024px）。 */
    @media (max-width: 1023px) {
      .meta { display: none; }
    }
    .mode-tag {
      display: inline-flex;
      align-items: center;
      margin-right: 6px;
      font-size: var(--cortex-fs-xs);
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text-muted);
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-sm);
      padding: 0 4px;
      line-height: 1.5;
      flex-shrink: 0; /* .name 是 flex 行：tag 不被压缩，截断由 .name-text 承担 */
    }
    /* 加星按钮（2026-09-17）：常显淡色描边星；加星后实心主题色。
       加星即置顶 + 删除保护，故常显（不做 hover 才显现）。 */
    .star-btn {
      background: transparent;
      border: none;
      padding: 2px;
      margin-left: var(--cortex-space-1);
      cursor: pointer;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      border-radius: var(--cortex-radius-sm);
      flex-shrink: 0;
      line-height: 0;
      transition: color 0.15s, transform 0.15s;
    }
    .star-btn:hover {
      color: var(--cortex-primary);
      transform: scale(1.15);
    }
    .star-btn.starred {
      color: var(--cortex-primary);
    }
    /* 复制标题按钮（2026-10-05）：与 star-btn 同款常显图标钮，位于其左侧；
       复制成功 copy→check 变主题色 1.5s 反馈（同 chat-message 复制钮）。 */
    .copy-btn {
      background: transparent;
      border: none;
      padding: 2px;
      margin-left: var(--cortex-space-1);
      cursor: pointer;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      border-radius: var(--cortex-radius-sm);
      flex-shrink: 0;
      line-height: 0;
      transition: color 0.15s, transform 0.15s;
    }
    .copy-btn:hover {
      color: var(--cortex-primary);
      transform: scale(1.15);
    }
    .copy-btn.copied {
      color: var(--cortex-primary);
    }
    /* 孪生复制按钮（2026-10-10）：复制整个会话为孪生会话继续干活，原会话
       保留；仅 chat 会话显示（search 历史只是关键词记录，无复制意义）。 */
    .fork-btn {
      background: transparent;
      border: none;
      padding: 2px;
      margin-left: var(--cortex-space-1);
      cursor: pointer;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      border-radius: var(--cortex-radius-sm);
      flex-shrink: 0;
      line-height: 0;
      transition: color 0.15s, transform 0.15s;
    }
    .fork-btn:hover {
      color: var(--cortex-primary);
      transform: scale(1.15);
    }
  `;

  @property({ attribute: false }) session: Session | null = null;
  /** 上次会话高亮（重启恢复态；非当前打开的会话） */
  @property({ type: Boolean, reflect: true }) active = false;

  /** 复制成功后的瞬时反馈：图标由 copy 变 check，1.5s 后恢复 */
  @state() private _copied = false;
  private _copyTimer?: number;

  private _select() {
    if (!this.session) return;
    this.dispatchEvent(new CustomEvent("select", {
      detail: { session: this.session },
      bubbles: true, composed: true,
    }));
  }

  private _toggleStar(e: Event) {
    // 星标点击不触发行选中
    e.stopPropagation();
    if (!this.session) return;
    this.dispatchEvent(new CustomEvent("toggle-star", {
      detail: { session: this.session, starred: !this.session.starred },
      bubbles: true, composed: true,
    }));
  }

  /** 点击「复制」：标题纯文本写入剪贴板，图标短暂变 check 反馈；失败冒泡 toast。 */
  private _onCopy = async (e: Event): Promise<void> => {
    // 复制点击不触发行选中
    e.stopPropagation();
    const text = this.session?.title ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this._copied = true;
      if (this._copyTimer !== undefined) window.clearTimeout(this._copyTimer);
      this._copyTimer = window.setTimeout(() => { this._copied = false; }, 1500);
    } catch {
      this.dispatchEvent(
        new CustomEvent("copy-failed", { bubbles: true, composed: true }),
      );
    }
  };

  /** 点击「孪生复制」：冒泡给宿主（chat-view）调 API 复制会话并进入孪生。
   *  stopPropagation：行级 _select 也在监听 click，不拦会先跳进源会话
   *  （focus 分支不渲染确认框，表现为「返回后才见到确认框」）。 */
  private _onFork(e: Event) {
    e.stopPropagation();
    if (!this.session) return;
    this.dispatchEvent(new CustomEvent("fork", {
      detail: { session: this.session },
      bubbles: true, composed: true,
    }));
  }

  render() {
    if (!this.session) return null;
    // search 历史只保留关键词（不再保存结果数量）；chat 仍显示消息数。
    const metaParts: string[] = [];
    if (this.session.type === "chat") {
      metaParts.push(String(this.session.message_count));
    }
    metaParts.push(new Date(this.session.updated_at).toLocaleDateString());
    const starred = !!this.session.starred;
    return html`
      <div class="name">
        ${this.session.mode === "grep" ? html`<span class="mode-tag" title="正则 grep">grep</span>` : null}
        <span class="name-text" title=${this.session.title}><span class="name-text-inner">${this.session.title}</span></span>
      </div>
      <div class="meta">${metaParts.join(" · ")}</div>
      ${this.session.type === "chat" ? html`
        <button
          class="fork-btn"
          title="复制会话：创建孪生会话继续对话，原会话保留"
          aria-label="复制会话"
          @click=${this._onFork}>
          <doclens-icon name="copy-plus"></doclens-icon>
        </button>` : null}
      <button
        class="copy-btn ${this._copied ? "copied" : ""}"
        title=${this._copied ? "已复制" : "复制标题"}
        aria-label=${this._copied ? "已复制" : "复制标题"}
        @click=${this._onCopy}>
        <doclens-icon name=${this._copied ? "check" : "copy"}></doclens-icon>
      </button>
      <button
        class="star-btn ${starred ? "starred" : ""}"
        title=${starred ? "取消加星" : "加星（置顶并防止被清空）"}
        aria-label=${starred ? "取消加星" : "加星"}
        aria-pressed=${starred ? "true" : "false"}
        @click=${this._toggleStar}>
        <doclens-icon name="star" class=${starred ? "filled" : ""}></doclens-icon>
      </button>
    `;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this._select);
    // 容器宽度变化（旋转/分栏拖动/断点切换）重测溢出态
    this._ro = new ResizeObserver(() => this._measureOverflow());
    this._ro.observe(this);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._select);
    this._ro?.disconnect();
    this._ro = undefined;
    if (this._copyTimer !== undefined) window.clearTimeout(this._copyTimer);
    super.disconnectedCallback();
  }

  /** 溢出态测量（标题尾部保可见的两态开关）：
   *  inner 内容宽 > outer 容器宽 → 加 .over（尾锚定 + 左渐隐）；
   *  否则移除（正常左对齐）。mask/flex-end 只在 .over 生效，短标题
   *  无视觉变化。 */
  private _measureOverflow(): void {
    const outer = this.shadowRoot?.querySelector(".name-text") as HTMLElement | null;
    const inner = outer?.querySelector(".name-text-inner") as HTMLElement | null;
    if (!outer || !inner) return;
    // flex-end 态下 inner 贴右溢出，比较内容宽与容器 clientWidth
    const over = inner.scrollWidth > outer.clientWidth;
    outer.classList.toggle("over", over);
  }

  protected override updated(changed: Map<string | number | symbol, unknown>): void {
    super.updated(changed);
    if (changed.has("session")) {
      // 标题变化后测量（渲染完成后 DOM 可测）
      this._measureOverflow();
    }
  }

  private _ro?: ResizeObserver;
}

declare global {
  interface HTMLElementTagNameMap {
    "history-item": HistoryItem;
  }
}
