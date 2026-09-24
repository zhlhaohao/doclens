import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { splitRecommended } from "../api/ask";
import type { AskAnswer, AskQuestionPayload } from "../api/ask";

/** 门禁确认卡本地超时（毫秒）：比后端 GUARD_TIMEOUT_SECONDS（120s）多 2s
 *  缓冲——后端先超时（fail-closed 拒绝、流恢复），前端到点把交互卡转为
 *  「已超时拒绝」摘要（保留至流结束，明确交代结果而非无声消失）。
 *  仅 guard 卡片适用（模型提问保持 300s）。 */
const GUARD_CARD_DISMISS_MS = 122_000;

/**
 * ask_user_question 交互卡片。
 *
 * 三态：
 * - pending   悬置中：渲染问题列表（单选 radio / 多选 checkbox / Other 兜底输入），
 *             提交按钮在「每问至少有一个选择或 Other 非空」前禁用
 * - answered  已回答：实时条幅（ask 载荷仍在）卡片消失，结果经 ask-done 事件
 *             （detail.toast）由宿主弹 toast 轻提示；历史回看（仅
 *             resolvedAnswers）保留完整「问题 → 所选答案」记录
 * - expired   已失效：request_id 已超时/被消费（respond 返回 submitted=false），
 *             guard 超时态明确交代「已按拒绝处理」（fail-closed）
 *
 * 历史回看复用 answered 态（只读渲染用户当次的选择）。
 */
@customElement("ask-card")
export class AskCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      box-sizing: border-box;
      /* 悬置卡钉在消息区与输入栏之间（flex 子项）：多问堆叠超高时自身
         限高内部滚动，不再把消息区压穿、溢出到屏外不可操作。overflow
         非 visible 同时解除 flex 自动最小尺寸（= 内容高度），使卡片可被
         容器剩余空间压缩；overscroll 防滚动穿透到底层页面。 */
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: thin;
    }
    .card {
      border: 1px solid var(--cortex-border, #d0d7de);
      border-radius: 10px;
      padding: 12px 14px;
      background: var(--cortex-surface, #fafbfc);
      font-size: var(--cortex-fs-md, 14px);
    }
    /* 外部访问门禁确认（ADR-0021）：与模型提问严格视觉区分——
       guard 载荷只由后端门禁代码构造，模型无法伪造此形态 */
    .card.guard {
      border: 2px solid var(--cortex-danger, #c62828);
      background: var(--cortex-surface, #fafbfc);
    }
    .guard-banner {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--cortex-fs-xs, 11px);
      font-weight: 600;
      color: var(--cortex-danger, #c62828);
      margin-bottom: 10px;
    }
    .q {
      margin: 0 0 10px;
    }
    .q:last-of-type {
      margin-bottom: 4px;
    }
    .q-title {
      font-weight: 600;
      margin: 0 0 6px;
      line-height: 1.5;
    }
    .q-header {
      display: inline-block;
      font-size: var(--cortex-fs-xs, 11px);
      font-weight: 600;
      color: var(--cortex-text-subtle, #6a737d);
      border: 1px solid var(--cortex-border, #d0d7de);
      border-radius: 999px;
      padding: 1px 8px;
      margin-right: 6px;
      vertical-align: 1px;
    }
    .opt {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      cursor: pointer;
    }
    .opt:hover {
      background: var(--cortex-surface-muted, #eef1f4);
    }
    .opt input {
      margin-top: 3px;
      flex: none;
    }
    .opt-body {
      min-width: 0;
    }
    .opt-label {
      font-weight: 500;
    }
    .opt-desc {
      color: var(--cortex-text-subtle, #6a737d);
      font-size: var(--cortex-fs-sm, 13px);
      margin-top: 2px;
      line-height: 1.45;
    }
    .badge {
      display: inline-block;
      font-size: var(--cortex-fs-xs, 11px);
      color: var(--cortex-accent-text, #0064e0);
      border: 1px solid currentColor;
      border-radius: 999px;
      padding: 0 6px;
      margin-left: 6px;
      vertical-align: 1px;
    }
    .other-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 8px;
    }
    .other-row input[type="text"] {
      flex: 1;
      min-width: 0;
      padding: 4px 8px;
      border: 1px solid var(--cortex-border, #d0d7de);
      border-radius: 6px;
      font: inherit;
    }
    /* 提交按钮常驻可见：卡片内部滚动时 sticky 钉在可视底部，免「滚到底
       才能提交」。负 margin 拉通卡片全宽并吃掉 .card 底 padding，配不透
       明背景防滚动内容从按钮下透出；未滚动时视觉与原布局等价。 */
    .actions {
      position: sticky;
      bottom: 0;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin: 0 -14px -12px;
      padding: 8px 14px 10px;
      background: var(--cortex-surface, #fafbfc);
      border-radius: 0 0 9px 9px;
    }
    button.primary {
      padding: 6px 18px;
      border-radius: 999px;
      border: none;
      background: #111;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
    button.primary:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    /* 折叠/失效摘要态 */
    .summary {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      border: 1px solid var(--cortex-border, #d0d7de);
      border-radius: 10px;
      padding: 8px 12px;
      background: var(--cortex-surface, #fafbfc);
    }
    .summary .icon {
      flex: none;
      font-size: 15px;
      line-height: 1.5;
    }
    .summary-body {
      min-width: 0;
      flex: 1;
    }
    .summary-line {
      line-height: 1.6;
    }
    .summary-line .q-h {
      font-weight: 600;
      margin-right: 4px;
    }
    .summary-line .a {
      color: var(--cortex-accent-text, #0064e0);
    }
    .expired-note {
      color: var(--cortex-danger, #c62828);
      font-size: var(--cortex-fs-sm, 13px);
    }
  `;

  /** 悬置问题载荷（requestId + questions） */
  @property({ attribute: false }) ask: {
    requestId: string;
    questions: AskQuestionPayload[];
  } | null = null;

  /** answered 态预填的答案（历史回看） */
  @property({ attribute: false }) resolvedAnswers: AskAnswer[] | null = null;

  @state() private _selected: string[][] = [];
  @state() private _others: (string | null)[] = [];
  @state() private _status: "pending" | "answered" | "expired" = "pending";
  @state() private _answers: AskAnswer[] = [];
  @state() private _submitting = false;
  private _dismissTimer: ReturnType<typeof setTimeout> | null = null;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("ask") && this.ask) {
      // 仅「新悬置问题」（requestId 变化）才重置内部状态。
      // 同一 requestId 的重复赋值（父组件重渲染导致引用变化，如流恢复后
      // 的密集 token/tool_result 事件）不得把已 answered 的卡片复活成
      // pending——否则提交后选项仍可再选。
      const prev = changed.get("ask") as { requestId?: string } | null | undefined;
      if (!prev || prev.requestId !== this.ask.requestId) {
        this._selected = this.ask.questions.map(() => []);
        this._others = this.ask.questions.map(() => null);
        this._status = "pending";
        this._answers = [];
        this._armGuardTimeout();
      }
    }
    if (changed.has("resolvedAnswers") && this.resolvedAnswers) {
      this._status = "answered";
      this._answers = this.resolvedAnswers;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._clearTimeoutTimer();
  }

  /** guard 卡超时计时：到点仍在 pending（用户未交互）则转超时摘要。 */
  private _armGuardTimeout() {
    this._clearTimeoutTimer();
    if (!this.ask?.questions.some((q) => q.guard)) return;
    this._dismissTimer = setTimeout(() => {
      this._dismissTimer = null;
      if (this._status !== "pending") return; // 已提交/失效，不覆盖
      this._status = "expired";
      // 通知 chat-view 解除输入禁用（卡片保留超时摘要至流结束）
      this.dispatchEvent(
        new CustomEvent("ask-done", {
          detail: { requestId: this.ask?.requestId ?? "" },
          bubbles: true,
          composed: true,
        }),
      );
    }, GUARD_CARD_DISMISS_MS);
  }

  private _clearTimeoutTimer() {
    if (this._dismissTimer !== null) {
      clearTimeout(this._dismissTimer);
      this._dismissTimer = null;
    }
  }

  /** 每问至少一个选择（选项或 Other 文本）才允许提交 */
  private get _canSubmit(): boolean {
    if (!this.ask) return false;
    return this.ask.questions.every((q, i) => {
      const hasSel = this._selected[i]?.length ?? 0;
      const other = (this._others[i] ?? "").trim();
      const otherPicked = this._others[i] !== null && other.length > 0;
      void q;
      return hasSel > 0 || otherPicked;
    });
  }

  private _toggle(i: number, label: string, multi: boolean) {
    const cur = [...this._selected];
    const list = cur[i] ?? [];
    cur[i] = multi
      ? list.includes(label)
        ? list.filter((l) => l !== label)
        : [...list, label]
      : list.includes(label)
        ? []
        : [label];
    // 单选切换到 Other 时清空 Other 标记（Other 与选项互斥占位）
    this._selected = cur;
  }

  private _onOtherInput(i: number, value: string) {
    const others = [...this._others];
    others[i] = value;
    this._others = others;
  }

  private async _submit() {
    if (!this.ask || !this._canSubmit || this._submitting) return;
    this._submitting = true;
    const answers: AskAnswer[] = this.ask.questions.map((q, i) => ({
      question: q.question,
      selected: this._selected[i] ?? [],
      other: (this._others[i] ?? "").trim() || null,
    }));
    let toast: string | null = null;
    try {
      const { respondAsk } = await import("../api/ask");
      const { submitted } = await respondAsk({
        request_id: this.ask.requestId,
        answers,
      });
      this._status = submitted ? "answered" : "expired";
      this._answers = answers;
      // 已答结果走 toast 轻提示（由宿主弹出）——卡片本身不再保留摘要
      if (submitted) {
        toast = this.ask.questions.some((q) => q.guard)
          ? "安全确认已处理"
          : "已回答";
      }
    } catch (err) {
      console.warn("[ask-card] respond failed:", err);
      this._status = "expired";
      this._answers = answers;
    } finally {
      this._submitting = false;
      // 事件派发放到状态落定之后，且只派一次（避免 catch/finally 重入）
      this._dispatchDone(toast);
    }
  }

  private _dispatchDone(toast: string | null = null) {
    this.dispatchEvent(
      new CustomEvent("ask-done", {
        detail: { requestId: this.ask?.requestId ?? "", toast },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderQuestion(q: AskQuestionPayload, i: number) {
    const selected = this._selected[i] ?? [];
    const other = this._others[i] ?? null;
    return html`
      <div class="q">
        <p class="q-title">
          ${q.header ? html`<span class="q-header">${q.header}</span>` : nothing}
          ${q.question}
        </p>
        ${q.options.map((opt) => {
          const [label, recommended] = splitRecommended(opt.label);
          const checked = selected.includes(opt.label);
          return html`
            <label class="opt">
              <input
                type=${q.multiSelect ? "checkbox" : "radio"}
                name="q-${this.ask?.requestId}-${i}"
                .checked=${checked}
                @change=${() => this._toggle(i, opt.label, q.multiSelect)}
              />
              <span class="opt-body">
                <span class="opt-label">${label}${recommended ? html`<span class="badge">推荐</span>` : nothing}</span>
                <div class="opt-desc">${opt.description}</div>
              </span>
            </label>
          `;
        })}
        ${q.guard
          ? nothing
          : html`
              <div class="other-row">
                <input
                  type="text"
                  placeholder="或输入其他答案…"
                  .value=${other ?? ""}
                  @input=${(e: InputEvent) => this._onOtherInput(i, (e.target as HTMLInputElement).value)}
                />
              </div>
            `}
      </div>
    `;
  }

  private _renderSummary() {
    const expired = this._status === "expired";
    const isGuard = this.ask?.questions.some((q) => q.guard) ?? false;
    // 仅服务 expired（实时失效/超时——明确交代，保留至流结束）与历史回看
    // （resolvedAnswers → answered，完整「问题 → 所选答案」记录）
    return html`
      <div class="summary">
        <span class="icon">${expired ? "⚠️" : "✅"}</span>
        <div class="summary-body">
          ${this._answers.map((a) => {
            const parts = [...a.selected];
            if (a.other) parts.push(`其他: ${a.other}`);
            return html`
              <div class="summary-line">
                <span class="q-h">${a.question}</span>
                <span class="a">${parts.join("、") || "（未作答）"}</span>
              </div>
            `;
          })}
          ${expired
            ? isGuard
              ? html`<div class="expired-note">安全确认超时，已按拒绝处理——AI 收到的是「未获授权」，并未同意访问。</div>`
              : html`<div class="expired-note">提交未确认（网络异常或问题已失效），答案可能未送达 AI。</div>`
            : nothing}
        </div>
      </div>
    `;
  }

  render() {
    if (!this.ask && !this.resolvedAnswers) return nothing;
    // 实时条幅已答：卡片消失，结果经 ask-done 事件由宿主弹 toast 轻提示；
    // 历史/失效态仍渲染摘要（resolvedAnswers 完整记录 / expired 明确交代）
    if (this._status === "answered" && this.ask) return nothing;
    if (this._status !== "pending") return this._renderSummary();
    if (!this.ask) return nothing;
    const isGuard = this.ask.questions.some((q) => q.guard);
    return html`
      <div class="card ${isGuard ? "guard" : ""}">
        ${isGuard
          ? html`<div class="guard-banner">🛡 安全确认 · 系统发起，AI 无法伪造此卡片</div>`
          : nothing}
        ${this.ask.questions.map((q, i) => this._renderQuestion(q, i))}
        <div class="actions">
          <button
            class="primary"
            type="button"
            ?disabled=${!this._canSubmit || this._submitting}
            @click=${this._submit}
          >
            ${this._submitting ? "提交中…" : "提交回答"}
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ask-card": AskCard;
  }
}
