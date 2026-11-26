import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { TimelineNode } from "../views/chat-timeline";
import { ScrollJumpController, scrollJumpFabStyles } from "../utils/scroll-jump";
import { traceStepsOf } from "./chat-tool-trace";
import "./chat-message";
import "./review-card";
import { emptyStateStyles } from "../styles/empty-state-styles";

/** 展开的折叠条集合（boundarySeq 集合；默认全部折叠，点击展开/收起）。 */
@customElement("chat-stream")
export class ChatStream extends LitElement {
  static styles = [
    scrollJumpFabStyles,
    emptyStateStyles,
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
      /* FAB 槽位（2026-11-18 玻璃压正文修复）：桌面端预留右侧 52px 内边距，
         正文右缘收缩到槽位左侧，悬浮按钮组落在槽内、不再压任何气泡。
         仅桌面生效——移动端三钮组本就 display:none 收进顶栏菜单。 */
      @media (min-width: 1024px) {
        :host { padding-right: 52px; }
      }
      /* 空态在流容器内垂直水平居中（复用公共块 .empty.fill 变体） */
      .empty.fill {
        padding: 0;
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
      /* 转录内错误卡（P1 修复）：流式传输层失败时末尾渲染，role=alert
         即时播报；重试把上一条用户消息回填输入框（reask 通道）。 */
      .error-card {
        align-self: center;
        max-width: 100%;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        border: 1px solid color-mix(in srgb, var(--cortex-danger) 45%, transparent);
        border-left: 3px solid var(--cortex-danger);
        border-radius: var(--cortex-radius-md);
        background: var(--cortex-danger-soft);
        color: var(--cortex-danger);
        font-size: var(--cortex-fs-sm);
      }
      .error-card doclens-icon { flex: 0 0 auto; }
      .error-body { flex: 1; min-width: 0; }
      .error-title { font-weight: 600; color: var(--cortex-danger-strong); }
      .error-msg {
        color: var(--cortex-text-muted);
        font-size: var(--cortex-fs-xs);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .error-retry {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border: 1px solid var(--cortex-border);
        border-radius: 999px;
        background: var(--cortex-surface);
        color: var(--cortex-text);
        font-size: var(--cortex-fs-sm);
        padding: 5px 12px;
        cursor: pointer;
        min-height: 32px;
      }
      .error-retry:hover { border-color: var(--cortex-primary); color: var(--cortex-primary); }
      /* 技术详情（上游原始报文）：默认收起，展开后显示原始码——
         排查需要，但不让裸错误码占据主视线。 */
      .error-detail {
        margin-top: 4px;
        font-size: var(--cortex-fs-xs);
        color: var(--cortex-text-muted);
      }
      .error-detail summary {
        cursor: pointer;
        list-style: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .error-detail summary::-webkit-details-marker { display: none; }
      .error-detail summary::before { content: "▸"; }
      .error-detail[open] summary::before { content: "▾"; }
      .error-detail code {
        display: block;
        margin-top: 4px;
        padding: 6px 8px;
        border-radius: var(--cortex-radius-sm);
        background: var(--cortex-surface);
        border: 1px solid var(--cortex-border-muted);
        font-family: var(--cortex-font-mono, monospace);
        font-size: var(--cortex-fs-xs);
        color: var(--cortex-text-muted);
        word-break: break-word;
        white-space: pre-wrap;
      }
      /* 会话导航三钮组（回顶 / 展开-收起思考过程 / 回底，2026-10-21）：
         仅桌面渲染——移动端上划就是看历史，悬浮钮更占视线且易误触；
         移动端把三个动作收进顶栏「更多」菜单（2026-11-06）。 */
      @media (max-width: 1023px) {
        .scroll-jump-anchor {
          display: none;
        }
      }
      /* 垂直居中（2026-10-21）：按钮组钉在视口高度 50% 处，而非贴底。
         sticky bottom 只能把视口下方的元素钉在下缘，故锚点改放内容**开头**
         （见 render），用 sticky top: 50% —— 静态位置在内容顶部、滚动时被
         钳制在 50% 线；height:0 不占布局，负 margin 抵消 flex gap。 */
      .scroll-jump-anchor {
        top: 50%;
        bottom: auto;
        margin-bottom: calc(-1 * var(--cortex-space-4));
      }
      /* FAB 落位（2026-11-18）：:host 已让出右侧 52px 槽位；按钮组负外边距
         向右探入槽内，与正文彻底分离（不再压正文右缘）。 */
      .scroll-jump-anchor .scroll-jump-fabs {
        /* 锚点 height:0 → 按钮组整体上移自身一半高度，中心对准 50% 线 */
        transform: translateY(-50%);
        padding-right: var(--cortex-space-1);
        margin-right: -40px; /* 探入 :host 让出的 52px 槽位 */
      }
      /* 实心底（2026-11-18 玻璃压正文修复）：正文右缘已让开槽位，无需靠
         毛玻璃透出文字。恢复与 md-viewer / preview-pane 一致的实底 + 描边 +
         柔影，hover 提亮为钴蓝描边；禁用态退为浅描边。 */
      .scroll-jump-anchor .scroll-jump-fab {
        background: var(--cortex-surface);
        border-color: var(--cortex-border);
        color: var(--cortex-text-muted);
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        box-shadow: var(--cortex-shadow-sm);
      }
      .scroll-jump-anchor .scroll-jump-fab:hover,
      .scroll-jump-anchor .scroll-jump-fab:focus-visible {
        background: var(--cortex-surface);
        border-color: var(--cortex-primary);
        color: var(--cortex-primary);
        box-shadow: var(--cortex-shadow-md);
      }
      .scroll-jump-anchor .scroll-jump-fab:disabled,
      .scroll-jump-anchor .scroll-jump-fab:disabled:hover {
        background: var(--cortex-surface);
        border-color: var(--cortex-border-muted);
        color: var(--cortex-text-subtle);
        box-shadow: none;
      }
    `,
  ];

  /** 渲染节点序列（活消息 + 折叠条，mergeTimeline 产物）。 */
  @property({ attribute: false }) nodes: TimelineNode[] = [];
  /** 当前 AI 模型展示名（来自 store.getState().status?.model_name：预设名优先，回退 model id）。
   *  传 null/空串 → 思考中仅显示「思考中...」，不展示模型前缀。 */
  @property({ attribute: false }) modelName: string | null = null;
  /** 流式期间禁用回退钮（重问不受影响）。 */
  @property({ type: Boolean }) rewindDisabled = false;
  /** 插话在途（ADR-0048）：透传给末条消息 trace 的按钮提示态。 */
  @property({ type: Boolean }) interjectPending = false;
  /** 回合生成中（ADR-0048）：透传给消息 trace——插话按钮显隐锚点
   *  （绑 streaming 态而非 running 步骤，防流式间隙闪烁）。 */
  @property({ type: Boolean }) generating = false;
  /** 最近一轮流式失败文案（非 null 时转录末尾渲染错误卡；「重试」把
   *  上一条用户消息回填输入框并聚焦——复用 reask 语义，由宿主处理）。 */
  @property({ attribute: false }) lastError: string | null = null;
  /** 错误卡「技术详情」（上游原始报文，如 `unknown error, 715 (1000)`）：
   *  默认收起——主文案只给可读句子，原始码供排查时展开。 */
  @property({ attribute: false }) lastErrorDetail: string | null = null;
  /** 恢复态（ADR-0028）：末条占位换后台续跑文案（宿主绑轮询激活态）。 */
  @property({ type: Boolean }) recovering = false;
  @state() private _expanded = new Set<number>();
  /** 贴底粘滞（stick-to-bottom，2026-10-05）：仅当用户视口在底部附近时，
   *  流式增量（token / thinking_delta / tool step）才自动跟随滚底。
   *  思考流高频刷新期间用户上滚回看 → 视口冻结，不再被拽回底部
   *  （旧实现 updated() 无条件 scrollTop=scrollHeight 的缺陷）。
   *  程序性滚动自身触发的 scroll 事件不计为用户滚动（_pinned 置位期间忽略）。 */
  private _pinned = true;
  private _scrollRafPending = false;
  /** 强制回底窗口（2026-11-25 历史会话不滚底修复）：scrollToBottom() 调用时
   *  新时间线往往尚未渲染（宿主在 setChatState 后同步调用，内容还在下一帧），
   *  而首帧视口在顶部、距底远超阈值——下方 updated() 的「按位置复核」会把
   *  这次回底当作「用户已上滚」否决，视口就此停在顶部（移动端实测）。
   *  窗口内贴底不受复核否决，且不依赖 Lit 更新（子组件异步长高——代码高亮、
   *  图片——也会跟到新底）；到期或用户主动滚动（触摸/滚轮/指针/按键）即失效，
   *  回到常规「贴底粘滞 + 位置复核」。 */
  private _forceUntil = 0;
  private _forceTimer: number | undefined;
  private static readonly FORCE_SETTLE_MS = 800;
  private static readonly FORCE_TICK_MS = 50;
  private get _forced(): boolean {
    return performance.now() < this._forceUntil;
  }
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
    // 用户主动滚动 → 强制回底窗口作废（触摸/滚轮/指针拖滚动条/滚动键）。
    // 宿主外的输入（点历史条目、输入框）不经过这里，不会误杀刚开的窗口。
    for (const ev of ["touchstart", "wheel", "pointerdown"] as const) {
      this.addEventListener(ev, this._cancelForceBottom, { passive: true });
    }
    this.addEventListener("keydown", this._onScrollKey);
    this._scrollJump.attach(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("scroll", this._onScroll);
    this.removeEventListener("trace-expanded", this._onTraceExpanded as EventListener);
    for (const ev of ["touchstart", "wheel", "pointerdown"] as const) {
      this.removeEventListener(ev, this._cancelForceBottom);
    }
    this.removeEventListener("keydown", this._onScrollKey);
    this._cancelForceBottom();
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

  /** 上次上报的导航态签名（trace 条数 | 是否全部展开）。
   *  宿主（chat-view）凭此渲染移动端「更多」菜单里的思考过程项；只在变化时
   *  通知，避免 chat-view 重渲染 → chat-stream updated → 再通知的回环。 */
  private _navStateSig = "";

  /** 上报导航态（移动端上下文菜单的数据源）。 */
  private _emitNavState(): void {
    const count = this._liveTraceKeys().size;
    const allExpanded = this._allExpanded;
    const sig = `${count}|${allExpanded}`;
    if (sig === this._navStateSig) return;
    this._navStateSig = sig;
    this.dispatchEvent(
      new CustomEvent("chat-nav-state", {
        detail: { traceCount: count, allExpanded },
        bubbles: true,
        composed: true,
      }),
    );
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

  /** 活段 trace 条数（宿主移动端「更多」菜单据此判可用性）。 */
  get traceCount(): number {
    return this._liveTraceKeys().size;
  }

  /** 是否全部 trace 已展开（宿主移动端「更多」菜单据此切换文案）。 */
  get allTracesExpanded(): boolean {
    return this._allExpanded;
  }

  /** 回到顶部（宿主菜单与悬浮三钮组共用）：先脱离贴底粘滞，
   *  否则流式增量一到就把视口拽回底部。 */
  jumpToTop(): void {
    this._cancelForceBottom();
    this._scrollJump.jumpTop();
  }

  /** 回到底部（宿主菜单与悬浮三钮组共用）。 */
  jumpToBottom(): void {
    this._scrollJump.jumpBottom();
  }

  /** 中间钮：全部展开 → 全部收起，否则全部展开。 */
  toggleAllTraces = (): void => {
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
    this._forceUntil = performance.now() + ChatStream.FORCE_SETTLE_MS;
    // 立即滚一次；若同帧有 pending 渲染，updated() 的 rAF 会再补一次对齐。
    // 没有 pending 渲染时（宿主在内容渲染前调用）也要排定 rAF，否则新内容
    // 渲染后无人补滚——这正是历史会话停在顶部的直接原因。
    this.scrollTop = this.scrollHeight;
    if (!this._scrollRafPending) this._scheduleFollow();
    // 窗口内定时贴底：覆盖不触发本组件 updated() 的内容长高
    if (this._forceTimer === undefined) {
      this._forceTimer = window.setTimeout(this._onForceTick, ChatStream.FORCE_TICK_MS);
    }
  }

  /** 强制回底窗口作废（用户主动滚动 / 回顶 / 组件卸载）。 */
  private _cancelForceBottom = (): void => {
    this._forceUntil = 0;
    if (this._forceTimer !== undefined) {
      window.clearTimeout(this._forceTimer);
      this._forceTimer = undefined;
    }
  };

  private _onForceTick = (): void => {
    this._forceTimer = undefined;
    if (!this._forced) return;
    this.scrollTop = this.scrollHeight;
    this._forceTimer = window.setTimeout(this._onForceTick, ChatStream.FORCE_TICK_MS);
  };

  /** 滚动键（方向键 / PageUp·Down / Home·End / Space）视同用户主动滚动。 */
  private _onScrollKey = (e: KeyboardEvent): void => {
    const keys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
    if (keys.includes(e.key)) this._cancelForceBottom();
  };

  /** 排定下一帧的贴底跟随（guard 合并同帧多次 updated 为单次 rAF）。 */
  private _scheduleFollow(): void {
    this._scrollRafPending = true;
    requestAnimationFrame(() => {
      this._scrollRafPending = false;
      const forced = this._forced;
      // rAF 间隙用户上滚：放弃本次跟随（强制回底窗口内不放弃）
      if (!this._pinned && !forced) return;
      // 双保险（移动端滚动回拽修复）：_pinned 由 scroll 事件维护，但
      // iOS/Android 惯性滚动期间 scroll 事件批量滞后，可能在 rAF 排定后
      // 才到达——只信标志会把用户刚滚上去的视口拽回底部（「上去又自动
      // 下来」）。执行前按当前实际位置复核：已离底超过阈值即放弃跟随。
      // 复核只约束「跟随」——scrollToBottom() 的显式回底（切会话/发消息）
      // 正是从离底位置出发的，不受复核否决。
      const distance = this.scrollHeight - this.scrollTop - this.clientHeight;
      if (!forced && distance > ChatStream.PIN_THRESHOLD) return;
      this._pinned = true;
      this.scrollTop = this.scrollHeight;
      this._scrollJump.refresh(); // 滚到底后「回底」钮该消失了
    });
  }

  updated() {
    // 三钮组显隐跟随内容变化：内容变高只改 scrollHeight、视口尺寸不变，
    // ResizeObserver 不触发，须在此显式重算
    this._scrollJump.refresh();
    this._emitNavState();
    // 贴底粘滞：仅 pinned 或强制回底窗口内跟随滚底。延迟到下一帧，等子组件
    // （chat-message → chat-tool-trace）渲染/展开后再算 scrollHeight；
    // guard 合并同帧多次 updated 为单次 rAF
    if (!this._pinned && !this._forced) return;
    if (this._scrollRafPending) return;
    this._scheduleFollow();
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
      return html`<chat-message role=${node.message.role} .message=${node.message} .modelName=${this.modelName} .rewindDisabled=${this.rewindDisabled} .traceExpandOverride=${this._expandOverride} .interjectPending=${this.interjectPending} .generating=${this.generating && isLast} .recovering=${this.recovering && isLast}></chat-message>`;
    }
    if (node.type === "review") {
      // 评审卡（数字员工）：返工指令折叠在卡内，不作为独立气泡
      return html`<review-card .review=${node.review} .order=${node.order} .rework=${node.rework}></review-card>`;
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
                  @click=${this.toggleAllTraces}><doclens-icon name="chevrons-down-up"></doclens-icon></button>
          <button class="scroll-jump-fab" type="button" aria-label="回到底部" title="回到底部"
                  @click=${() => jump.jumpBottom()}><doclens-icon name="arrow-down-to-line"></doclens-icon></button>
        </div>
      </div>
    `;
  }

  /** 错误卡「重试」：回填上一条用户消息到输入框（复用 reask 通道）。 */
  private _onErrorRetry(): void {
    const lastUser = [...this.nodes]
      .reverse()
      .find((n) => n.type === "message" && n.message.role === "user");
    if (!lastUser || lastUser.type !== "message") return;
    const m = lastUser.message;
    this.dispatchEvent(
      new CustomEvent("reask", {
        detail: { content: m.content, images: m.images },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderErrorCard(): ReturnType<typeof html> | null {
    if (!this.lastError) return null;
    return html`
      <div class="error-card" role="alert">
        <doclens-icon name="alert-triangle"></doclens-icon>
        <div class="error-body">
          <div class="error-title">对话失败</div>
          <div class="error-msg">${this.lastError}</div>
          ${this.lastErrorDetail
            ? html`<details class="error-detail">
                <summary>技术详情</summary>
                <code>${this.lastErrorDetail}</code>
              </details>`
            : nothing}
        </div>
        <button class="error-retry" type="button" @click=${this._onErrorRetry}>
          <doclens-icon name="rotate-ccw"></doclens-icon>重试
        </button>
      </div>
    `;
  }

  render() {
    if (this.nodes.length === 0) {
      return html`<div class="empty fill">向助手提出你的第一个问题</div>`;
    }
    // 三钮组放在内容**开头**：sticky top:50% 需要静态位置在内容顶部才能
    // 被钳制到视口中央（放末尾只能配 sticky bottom 钉住下缘）
    return html`${this._renderFabs()}${this.nodes.map((n) => this._renderNode(n))}${this._renderErrorCard()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-stream": ChatStream;
  }
}
