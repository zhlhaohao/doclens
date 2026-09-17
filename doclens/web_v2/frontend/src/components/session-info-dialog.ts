import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

/** 会话信息对话框（2026-09-17）：展示当前会话的上下文窗口占用 + 累计缓存命中率。
 *  数据来自 SSE usage 事件 / 会话详情 items 里的 kind="usage" 条目
 *  （占用口径 = 最近一次 LLM 调用的总输入 tokens；命中率口径 = 全会话
 *  Σcache_read ÷ Σ总输入，2026-09-17 与 LLM trace 落盘同期加）。 */
@customElement("session-info-dialog")
export class SessionInfoDialog extends LitElement {
  static styles = css`
    :host { display: block; min-width: 340px; }
    .row { margin: var(--cortex-space-3) 0; }
    .label {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      margin-bottom: 6px;
    }
    .value {
      font-size: var(--cortex-fs-lg);
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
    }
    .value-sm {
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text-muted);
    }
    .bar {
      height: 6px;
      margin-top: 8px;
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-full, 100px);
      overflow: hidden;
    }
    .bar > .fill {
      height: 100%;
      background: var(--cortex-primary);
      border-radius: inherit;
      transition: width 0.3s;
    }
    .bar > .fill.warn { background: var(--cortex-warning); }
    .hint {
      margin-top: 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
    }
    .hint.warn { color: var(--cortex-warning); }
    .empty {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-3) 0;
    }
    .actions {
      display: flex; justify-content: flex-end;
      margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
      font-family: inherit;
    }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;

  /** 已占用 tokens（最近一次调用的总输入）；null = 暂无数据 */
  @property({ type: Number }) used: number | null = null;
  /** 上下文窗口上限 */
  @property({ type: Number }) contextWindow = 0;
  /** 全会话累计 cache_read tokens；null = 暂无数据（隐藏命中率行） */
  @property({ type: Number }) cacheReadTotal: number | null = null;
  /** 全会话累计总输入 tokens（input + cache_read + cache_creation） */
  @property({ type: Number }) inputTotal: number | null = null;
  /** 全会话 LLM 调用次数 */
  @property({ type: Number }) calls = 0;

  /** 压缩阈值（与后端 compact_threshold = context_window × 0.8 对齐） */
  private static readonly COMPACT_RATIO = 0.8;

  private _close() {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  private _fmt(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  }

  render() {
    if (this.used === null || !this.contextWindow) {
      return html`
        <div class="row">
          <div class="label">上下文占用</div>
          <div class="empty">暂无上下文数据——发送首轮后显示</div>
        </div>
        <div class="actions">
          <button @click=${this._close}>关闭</button>
        </div>`;
    }
    const pct = this.used / this.contextWindow;
    const warn = pct >= SessionInfoDialog.COMPACT_RATIO;
    // 累计缓存命中率 = Σcache_read ÷ Σ总输入（每条 usage 一个样本）；
    // 缓存概念缺失的端点两字段为 0，比率显示 0%（如实反映）
    const hitPct =
      this.cacheReadTotal !== null && this.inputTotal
        ? Math.round((this.cacheReadTotal / this.inputTotal) * 100)
        : null;
    return html`
      <div class="row">
        <div class="label">上下文占用</div>
        <div class="value">
          ${this._fmt(this.used)} / ${this._fmt(this.contextWindow)}
          （${Math.round(pct * 100)}%）
        </div>
        <div class="bar">
          <div class="fill ${warn ? "warn" : ""}" style="width: ${Math.min(100, pct * 100)}%"></div>
        </div>
        <div class="hint ${warn ? "warn" : ""}">
          ${warn
            ? "已达压缩阈值，下一轮将自动压缩历史"
            : `达到 ${SessionInfoDialog.COMPACT_RATIO * 100}% 将自动压缩历史`}
        </div>
      </div>
      ${hitPct !== null
        ? html`
          <div class="row">
            <div class="label">缓存命中率（全会话累计）</div>
            <div class="value">${hitPct}%</div>
            <div class="value-sm">
              cache_read ${this._fmt(this.cacheReadTotal!)} /
              总输入 ${this._fmt(this.inputTotal!)} · ${this.calls} 次调用
            </div>
          </div>`
        : ""}
      <div class="actions">
        <button @click=${this._close}>关闭</button>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap { "session-info-dialog": SessionInfoDialog; }
}
