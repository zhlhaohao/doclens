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
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      flex-shrink: 0;
      margin-left: var(--cortex-space-2);
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
        ${this.session.title}
      </div>
      <div class="meta">${metaParts.join(" · ")}</div>
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
  }

  disconnectedCallback() {
    this.removeEventListener("click", this._select);
    if (this._copyTimer !== undefined) window.clearTimeout(this._copyTimer);
    super.disconnectedCallback();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "history-item": HistoryItem;
  }
}
