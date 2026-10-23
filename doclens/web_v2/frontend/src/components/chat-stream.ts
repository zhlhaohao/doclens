import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { TimelineNode } from "../views/chat-timeline";
import { ScrollJumpController, scrollJumpFabStyles } from "../utils/scroll-jump";
import { traceStepsOf } from "./chat-tool-trace";
import "./chat-message";

/** 展开的折叠条集合（boundarySeq 集合；默认全部折叠，点击展开/收起）。 */
@customElement("chat-stream")
export class ChatStream extends LitElement {
  static styles = [
    css`
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
      /* 会话导航三钮组（回顶 / 展开-收起思考过程 / 回底，2026-10-21）：
         仅桌面渲染——移动端上划就是看历史，悬浮钮更占视线且易误触。 */
      @media (max-width: 1023px) {
        .scroll-jump-anchor {
          display: none;
        }
      }
    `,
    scrollJumpFabStyles,
  ];

  /** 渲染节点序列（活消息 + 折叠条，mergeTimeline 产物）。 */
  @property({ attribute: false }) nodes: TimelineNode[] = [];
  /** 当前 AI 模型 id（来自 store.getState().status?.model_name）。
   *  传 null/空串 → 思考中仅显示「思考中...」，不展示模型前缀。 */
  @property({ attribute: false }) modelName: string | null = null;
  /** 流式期间禁用回退钮（重问不受影响）。 */
  @property({ type: Boolean }) rewindDisabled = false;
  /** 插话在途（ADR-0048）：透传给末条消息 trace 的按钮提示态。 */
  @property({ type: Boolean }) interjectPending = false;
  /** 回合生成中（ADR-0048）：透传给消息 trace——插话按钮显隐锚点
   *  （绑 streaming 态而非 running 步骤，防流式间隙闪烁）。 */
  @property({ type: Boolean }) generating = false;
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
  /** 三钮组显隐门槛（px）：远大于预览页的 300px——会话滚动空间本就长，
   *  短对话挂按钮反而碍眼（2026-10-21 决议：1000px）。 */
  private static readonly FAB_THRESHOLD = 1000;

  /** 右下角三钮组（回顶 / 展开-收起思考过程 / 回底）。
   *  unify：整组同显同隐（三个按钮一起出现，中间钮不是滚动动作也要跟着走）。 */
  private _scrollJump = new ScrollJumpController(this, {
    threshold: ChatStream.FAB_THRESHOLD,
    unify: true,
    // 回顶：先脱离贴底粘滞——否则流式增量一到就把视口拽回底部
    onJumpTop: (scroller) => {
      this._pinned = false;
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    },
    // 回底：强制重贴底（instant——流式内容持续增长时 smooth 追不上）
    onJumpBottom: () => this.scrollToBottom(),
  });

  /** 全局展开指令（三钮组中间钮）：null = 各 trace 自动管理（运行中展开、
   *  结束收起）；true/false = 强制全部展开/收起，压过自动行为。
   *  失效条件：用户单点某条 trace（手动即接管）、发新消息/切换会话（宿主重置）。 */
  private _expandOverride: boolean | null = null;
  /** 各 trace 上报的展开态（首步 tool_use_id → expanded）：仅用于算中间钮
   *  文案——任一条收起 → 「展开全部」，全部已展开 → 「收起全部」。 */
  private _traceExpanded = new Map<string, boolean>();

  /** 粘滞态只读出口（测试/调试观测用；写状态仅经 scroll 事件与 scrollToBottom）。 */
  get pinned(): boolean {
    return this._pinned;
  }

  firstUpdated() {
    // 程序性滚动（跟随滚底）也会触发 scroll 事件——只有非 pinned 的
    // 用户滚动才更新粘滞状态，避免跟随动作本身把自己顶下线
    this.addEventListener("scroll", this._onScroll, { passive: true });
    this.addEventListener("trace-expanded", this._onTraceExpanded as EventListener);
    this._scrollJump.attach(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("scroll", this._onScroll);
    this.removeEventListener("trace-expanded", this._onTraceExpanded as EventListener);
  }

  willUpdate(changed: Map<string, unknown>) {
    // 节点变化后清掉已不存在的 trace 记录（回退死段折叠/会话切换），
    // 防表无限增长；render 只读活段键，故无需额外重渲染
    if (!changed.has("nodes") || this._traceExpanded.size === 0) return;
    const live = this._liveTraceKeys();
    for (const key of [...this._traceExpanded.keys()]) {
      if (!live.has(key)) this._traceExpanded.delete(key);
    }
  }

  /** 当前时间线活段内的 trace 键（首步 tool_use_id，会话内唯一）。
   *  已回退死段默认折叠、不收全局指令，故不计入。 */
  private _liveTraceKeys(): Set<string> {
    const keys = new Set<string>();
    for (const node of this.nodes) {
      if (node.type !== "message") continue;
      const steps = traceStepsOf(node.message.tool_steps);
      if (steps.length > 0) keys.add(steps[0].tool_use_id);
    }
    return keys;
  }

  /** 是否全部 trace 已展开（混合态算「未全展开」→ 中间钮显示「展开全部」）。 */
  private get _allExpanded(): boolean {
    const keys = this._liveTraceKeys();
    if (keys.size === 0) return false;
    if (this._expandOverride !== null) return this._expandOverride;
    for (const key of keys) {
      if (this._traceExpanded.get(key) !== true) return false;
    }
    return true;
  }

  /** trace 上报展开态。manual=true（用户单点标题栏）= 接管：全局指令作废，
   *  其余 trace 保持各自现状，中间钮文案按实际状态重算。 */
  private _onTraceExpanded = (e: Event): void => {
    const detail = (e as CustomEvent<{ key: string; expanded: boolean; manual: boolean }>).detail;
    if (!detail?.key) return;
    const { key, expanded, manual } = detail;
    if (manual) this._expandOverride = null;
    if (this._traceExpanded.get(key) === expanded && !manual) return;
    this._traceExpanded.set(key, expanded);
    this.requestUpdate();
  };

  /** 中间钮：全部展开 → 全部收起，否则全部展开。 */
  private _toggleAllTraces = (): void => {
    const next = !this._allExpanded;
    this._expandOverride = next;
    // 乐观更新：同帧内各 trace 收到指令后会各自上报，避免文案闪一帧
    for (const key of this._liveTraceKeys()) this._traceExpanded.set(key, next);
    this.requestUpdate();
  };

  /** 清空全局展开指令（发新消息/切换会话时由 chat-view 调用）：
   *  新内容回到「自动」——不因上一次的「收起全部」而看不到新回复的执行进度。 */
  resetTraceExpand(): void {
    if (this._expandOverride === null && this._traceExpanded.size === 0) return;
    this._expandOverride = null;
    this._traceExpanded.clear();
    this.requestUpdate();
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
    // 三钮组显隐跟随内容变化：内容变高只改 scrollHeight、视口尺寸不变，
    // ResizeObserver 不触发，须在此显式重算
    this._scrollJump.refresh();
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
      this._scrollJump.refresh(); // 滚到底后「回底」钮该消失了
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
      // generating 只给末条（流式占位 / 恢复态占位）——历史消息的 trace
      // 不亮插话按钮（它们不是当前回合）
      const isLast = this.nodes[this.nodes.length - 1] === node;
      return html`<chat-message role=${node.message.role} .message=${node.message} .modelName=${this.modelName} .rewindDisabled=${this.rewindDisabled} .traceExpandOverride=${this._expandOverride} .interjectPending=${this.interjectPending} .generating=${this.generating && isLast}></chat-message>`;
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

  /** 会话导航三钮组（回顶 / 展开-收起思考过程 / 回底）。
   *  组显隐由 controller 统一判定（1000px 门槛 + unify）；无 trace 时中间钮
   *  置灰占位（位置不抽动，title 说明原因）。 */
  private _renderFabs() {
    const jump = this._scrollJump;
    if (!jump.showTop && !jump.showBottom) return null;
    const hasTrace = this._liveTraceKeys().size > 0;
    const allExpanded = this._allExpanded;
    const toggleLabel = !hasTrace
      ? "本会话没有思考过程"
      : allExpanded
        ? "收起全部思考过程"
        : "展开全部思考过程";
    return html`
      <div class="scroll-jump-anchor">
        <div class="scroll-jump-fabs" role="group" aria-label="会话导航">
          <button class="scroll-jump-fab" type="button" aria-label="回到顶部" title="回到顶部"
                  @click=${() => jump.jumpTop()}><doclens-icon name="arrow-up-to-line"></doclens-icon></button>
          <button class="scroll-jump-fab" type="button" ?disabled=${!hasTrace}
                  aria-label=${toggleLabel} title=${toggleLabel}
                  @click=${this._toggleAllTraces}><doclens-icon name="chevrons-down-up"></doclens-icon></button>
          <button class="scroll-jump-fab" type="button" aria-label="回到底部" title="回到底部"
                  @click=${() => jump.jumpBottom()}><doclens-icon name="arrow-down-to-line"></doclens-icon></button>
        </div>
      </div>
    `;
  }

  render() {
    if (this.nodes.length === 0) {
      return html`<div class="empty">向助手提出你的第一个问题</div>`;
    }
    return html`${this.nodes.map((n) => this._renderNode(n))}${this._renderFabs()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-stream": ChatStream;
  }
}
