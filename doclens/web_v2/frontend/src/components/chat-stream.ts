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
  private _scrollRafPending = false;

  updated() {
    // 自动滚动到底部：延迟到下一帧，等子组件（chat-message → chat-tool-trace）
    // 渲染/展开后再算 scrollHeight；guard 合并同帧多次 updated 为单次 rAF
    if (this._scrollRafPending) return;
    this._scrollRafPending = true;
    requestAnimationFrame(() => {
      this._scrollRafPending = false;
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
