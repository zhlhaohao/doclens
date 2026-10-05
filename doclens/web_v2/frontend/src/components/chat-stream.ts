import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { TimelineNode } from "../views/chat-timeline";
import "./chat-message";

/** 展开的折叠条集合（boundarySeq 集合；默认全部折叠，点击展开/收起）。 */
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
      background: var(--cortex-view-bg);
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
    /* 回退折叠条（ADR-0027）：纯查看的已回退段。 */
    .rewind-divider {
      align-self: center;
      max-width: 100%;
      border: 1px dashed var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
      padding: 6px 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    .rewind-divider:hover {
      border-color: var(--cortex-primary);
      color: var(--cortex-text-muted);
    }
    .rewind-dead {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4);
      opacity: 0.55;
      filter: saturate(0.6);
      padding-left: 12px;
      border-left: 2px solid var(--cortex-border-muted);
      margin-left: 10px;
    }
  `;

  /** 渲染节点序列（活消息 + 折叠条，mergeTimeline 产物）。 */
  @property({ attribute: false }) nodes: TimelineNode[] = [];
  /** 当前 AI 模型 id（来自 store.getState().status?.model_name）。
   *  传 null/空串 → 思考中仅显示「思考中...」，不展示模型前缀。 */
  @property({ attribute: false }) modelName: string | null = null;
  /** 流式期间禁用回退钮（重问不受影响）。 */
  @property({ type: Boolean }) rewindDisabled = false;
  @state() private _expanded = new Set<number>();
  /** 贴底粘滞（stick-to-bottom，2026-10-05）：仅当用户视口在底部附近时，
   *  流式增量（token / thinking_delta / tool step）才自动跟随滚底。
   *  思考流高频刷新期间用户上滚回看 → 视口冻结，不再被拽回底部
   *  （旧实现 updated() 无条件 scrollTop=scrollHeight 的缺陷）。
   *  程序性滚动自身触发的 scroll 事件不计为用户滚动（_pinned 置位期间忽略）。 */
  private _pinned = true;
  private _scrollRafPending = false;
  /** 距底判定阈值（px）：容差视口高度的小比例，容纳字体缩放/最后一行渲染抖动 */
  private static readonly PIN_THRESHOLD = 80;

  /** 粘滞态只读出口（测试/调试观测用；写状态仅经 scroll 事件与 scrollToBottom）。 */
  get pinned(): boolean {
    return this._pinned;
  }

  firstUpdated() {
    // 程序性滚动（跟随滚底）也会触发 scroll 事件——只有非 pinned 的
    // 用户滚动才更新粘滞状态，避免跟随动作本身把自己顶下线
    this.addEventListener("scroll", this._onScroll, { passive: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("scroll", this._onScroll);
  }

  private _onScroll = (): void => {
    // 程序性跟随滚动期间（_pinned=true 且本次 updated 已排定 rAF）忽略：
    // 本方法只在用户滚动导致离开/回到底部时翻转 _pinned
    if (this._scrollRafPending) return;
    const distance = this.scrollHeight - this.scrollTop - this.clientHeight;
    this._pinned = distance <= ChatStream.PIN_THRESHOLD;
  };

  /** 强制脱离粘滞判定，无条件滚到底。发送新消息/切换会话时调用
   *  （新内容在底部，用户意图明确指向底部，无视当前滚动位置）。 */
  scrollToBottom(): void {
    this._pinned = true;
    // 立即滚一次；若同帧有 pending 渲染，updated() 的 rAF 会再补一次对齐
    this.scrollTop = this.scrollHeight;
  }

  updated() {
    // 贴底粘滞：仅 pinned 时跟随滚底。延迟到下一帧，等子组件
    // （chat-message → chat-tool-trace）渲染/展开后再算 scrollHeight；
    // guard 合并同帧多次 updated 为单次 rAF
    if (!this._pinned) return;
    if (this._scrollRafPending) return;
    this._scrollRafPending = true;
    requestAnimationFrame(() => {
      this._scrollRafPending = false;
      if (!this._pinned) return; // rAF 间隙用户上滚：放弃本次跟随
      this.scrollTop = this.scrollHeight;
    });
  }

  private _toggleDivider = (boundarySeq: number): void => {
    const next = new Set(this._expanded);
    if (next.has(boundarySeq)) next.delete(boundarySeq);
    else next.add(boundarySeq);
    this._expanded = next;
  };

  private _renderNode(node: TimelineNode) {
    if (node.type === "message") {
      return html`<chat-message role=${node.message.role} .message=${node.message} .modelName=${this.modelName} .rewindDisabled=${this.rewindDisabled}></chat-message>`;
    }
    const expanded = this._expanded.has(node.boundarySeq);
    return html`
      <div class="rewind-divider" role="button" tabindex="0"
           aria-expanded=${expanded}
           @click=${() => this._toggleDivider(node.boundarySeq)}
           @keydown=${(e: KeyboardEvent) => {
             if (e.key === "Enter" || e.key === " ") this._toggleDivider(node.boundarySeq);
           }}>
        <doclens-icon name="history"></doclens-icon>
        ${expanded
          ? html`收起已回退的 ${node.dead.length} 条消息`
          : html`已回退 · ${node.dead.length} 条消息已折叠`}
      </div>
      ${expanded
        ? html`<div class="rewind-dead">${node.dead.map(
            (m) => html`<chat-message role=${m.role} .message=${m}></chat-message>`,
          )}</div>`
        : null}
    `;
  }

  render() {
    if (this.nodes.length === 0) {
      return html`<div class="empty">开始与 Doclens 对话</div>`;
    }
    return html`${this.nodes.map((n) => this._renderNode(n))}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-stream": ChatStream;
  }
}
