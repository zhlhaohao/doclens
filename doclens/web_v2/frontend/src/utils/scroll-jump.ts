import { html, css } from "lit";
import type { ReactiveController, ReactiveControllerHost } from "lit";

/**
 * scroll-jump —— 「跳转到第一行 / 跳转到最后一行」悬浮按钮的共享逻辑。
 *
 * 三个消费方（滚动容器各不相同）：
 * - md-viewer   : scroller = :host 自身（overflow-y: auto）
 * - cm-editor   : scroller = CM6 内部 .cm-scroller（内核自管滚动，本组件不消费）
 * - preview-pane: scroller = 纯文本预览的 .body div
 * - chat-stream : scroller = :host 自身；threshold=1000 + unify（三钮组统一显隐，
 *                 中间钮是「展开/收起思考过程」，非滚动动作）
 *
 * controller 负责：显隐状态（按滚动位置条件显示）、scroll/resize 监听、
 * 默认跳转动作。消费方各自渲染按钮（renderScrollJumpFabs）并引入
 * scrollJumpFabStyles，按钮定位（sticky / absolute）由消费方 CSS 决定。
 */

/** 距顶/底超过该值（px）才显示对应按钮；短文档（无需滚动）两个都不显示 */
export const SCROLL_JUMP_THRESHOLD = 300;

export interface ScrollJumpOptions {
  /** 滚动动画：预览用 smooth（有位置感）；编辑器用 auto 瞬跳（对齐 Ctrl+Home 手感） */
  behavior?: ScrollBehavior;
  /** 覆盖默认「跳到顶」动作（如编辑器移动光标 + focus） */
  onJumpTop?: (scroller: HTMLElement) => void;
  /** 覆盖默认「跳到底」动作 */
  onJumpBottom?: (scroller: HTMLElement) => void;
  /** 距顶/距底超过该值才显示按钮（默认 SCROLL_JUMP_THRESHOLD）。
   *  长会话（chat-stream）用更大的门槛，避免短对话也挂按钮。 */
  threshold?: number;
  /** 组内统一显隐：任一方向过门槛 → 显示全部按钮（含消费方额外按钮），
   *  而不是各方向独立显隐。chat-stream 三钮组（回顶/展开/回底）依赖此模式。 */
  unify?: boolean;
}

export class ScrollJumpController implements ReactiveController {
  showTop = false;
  showBottom = false;

  private _scroller: HTMLElement | null = null;
  private _ro: ResizeObserver | null = null;
  private _opts: ScrollJumpOptions;

  constructor(
    private host: ReactiveControllerHost,
    opts: ScrollJumpOptions = {},
  ) {
    this.host.addController(this);
    this._opts = opts;
  }

  hostDisconnected() {
    this.detach();
  }

  /** 绑定滚动容器。重复绑定同一元素是 no-op。 */
  attach(scroller: HTMLElement) {
    if (this._scroller === scroller) return;
    this.detach();
    this._scroller = scroller;
    scroller.addEventListener("scroll", this._onScroll, { passive: true });
    // 视口尺寸变化（窗口缩放 / splitter 拖动）→ 重算显隐
    this._ro = new ResizeObserver(this._onScroll);
    this._ro.observe(scroller);
    this.refresh();
  }

  detach() {
    if (this._scroller) {
      this._scroller.removeEventListener("scroll", this._onScroll);
      this._scroller = null;
    }
    this._ro?.disconnect();
    this._ro = null;
  }

  /** 重算显隐状态。内容变化（新文档渲染完）后消费方应主动调用。 */
  refresh() {
    const el = this._scroller;
    if (!el) return;
    const threshold = this._opts.threshold ?? SCROLL_JUMP_THRESHOLD;
    const canScroll = el.scrollHeight - el.clientHeight > 8;
    let nextTop = canScroll && el.scrollTop > threshold;
    let nextBottom =
      canScroll &&
      el.scrollHeight - el.scrollTop - el.clientHeight > threshold;
    // 统一组模式：任一方向够远 → 整组显形（含中间的非滚动按钮）
    if (this._opts.unify && (nextTop || nextBottom)) {
      nextTop = true;
      nextBottom = true;
    }
    if (nextTop !== this.showTop || nextBottom !== this.showBottom) {
      this.showTop = nextTop;
      this.showBottom = nextBottom;
      this.host.requestUpdate();
    }
  }

  jumpTop() {
    const el = this._scroller;
    if (!el) return;
    if (this._opts.onJumpTop) {
      this._opts.onJumpTop(el);
      return;
    }
    el.scrollTo({ top: 0, behavior: this._opts.behavior ?? "smooth" });
  }

  jumpBottom() {
    const el = this._scroller;
    if (!el) return;
    if (this._opts.onJumpBottom) {
      this._opts.onJumpBottom(el);
      return;
    }
    el.scrollTo({
      top: el.scrollHeight - el.clientHeight,
      behavior: this._opts.behavior ?? "smooth",
    });
  }

  private _onScroll = () => {
    this.refresh();
  };
}

/** FAB 样式片段 —— 消费方拼进自己的 static styles。
 *  提供两种定位方式：
 *  1. .scroll-jump-anchor（sticky 锚点）—— 作为滚动内容的最后一个子元素
 *     渲染（height:0 不占布局），FAB 固定在滚动视口右下角不随内容滚走。
 *     适用：md-viewer :host、preview-pane .body（自身即滚动容器）。
 *  2. absolute 覆盖 —— 消费方自行给 .scroll-jump-fabs 加 position 规则。
 *     适用：已无（cm-editor 用 CM6 内核滚动，不再需要 FAB 覆盖层）。 */
export const scrollJumpFabStyles = css`
  .scroll-jump-anchor {
    position: sticky;
    bottom: var(--cortex-space-3);
    height: 0;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;  /* height:0 容器防止 stretch 压扁按钮组 */
    z-index: 2;
  }
  .scroll-jump-anchor .scroll-jump-fabs {
    /* height:0 锚点：把按钮组整体上移到锚点线之上（translate 不影响滚动范围） */
    transform: translateY(-100%);
    padding-right: var(--cortex-space-1);
  }
  .scroll-jump-fabs {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--cortex-space-2);
    /* 容器可能覆盖在文本上方：默认不拦截指针，仅按钮本体可点 */
    pointer-events: none;
  }
  .scroll-jump-fab {
    pointer-events: auto;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 50%;
    border: 1px solid var(--cortex-border);
    background: var(--cortex-surface);
    color: var(--cortex-text-muted);
    box-shadow: var(--cortex-shadow-md);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    cursor: pointer;
    touch-action: manipulation;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .scroll-jump-fab:hover {
    background: var(--cortex-primary-soft);
    color: var(--cortex-primary);
    border-color: var(--cortex-primary);
  }
  /* 禁用态（匹配导航零匹配时置灰，2026-09-28 匹配导航决议） */
  .scroll-jump-fab:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .scroll-jump-fab:disabled:hover {
    background: var(--cortex-surface);
    color: var(--cortex-text-muted);
    border-color: var(--cortex-border);
  }
  .scroll-jump-fab:focus-visible {
    outline: none;
    box-shadow: var(--cortex-focus-ring);
  }
`;

/** 渲染悬浮按钮组（都不该显示时返回 null）。 */
export function renderScrollJumpFabs(ctrl: ScrollJumpController) {
  if (!ctrl.showTop && !ctrl.showBottom) return null;
  return html`
    <div class="scroll-jump-fabs">
      ${ctrl.showTop
        ? html`<button
            class="scroll-jump-fab"
            type="button"
            aria-label="跳转到第一行"
            title="跳转到第一行"
            @click=${() => ctrl.jumpTop()}
          ><doclens-icon name="arrow-up-to-line"></doclens-icon></button>`
        : null}
      ${ctrl.showBottom
        ? html`<button
            class="scroll-jump-fab"
            type="button"
            aria-label="跳转到最后一行"
            title="跳转到最后一行"
            @click=${() => ctrl.jumpBottom()}
          ><doclens-icon name="arrow-down-to-line"></doclens-icon></button>`
        : null}
    </div>
  `;
}
