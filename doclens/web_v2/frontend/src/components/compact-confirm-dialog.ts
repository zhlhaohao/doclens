import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { formatTokens } from "../utils/format";
import { dialogSlotStyles } from "../utils/dialog-styles";
import { copyText, createCopiedFlash } from "../utils/clipboard";
import "./spinner";
import { buttonBaseStyles, confirmButtonStyles, buttonRowStyles } from "../styles/button-styles";
import { confirmStyles } from "../styles/confirm-styles";

/** 压缩上下文确认/进度模态框（ADR-0026 手动压缩入口）。
 *  三态复用同一个 <dialog> 宿主（chat-view 渲染），确认后不关框——压缩
 *  期间以模态 spinner 停留（top-layer 天然禁止操作底层页面），完成后在
 *  框内展示压缩效果（pre → post tokens）+ copy 按钮拷贝压缩产物供人审核。
 *
 *  phase:
 *   - confirm：说明压缩语义（摘要替换上下文、展示不变、耗时数十秒）；
 *     确认冒泡 compact-confirm，取消/ESC 冒泡 cancel。
 *   - running：压缩进行中。不可取消/ESC（对话框宿主拦截 cancel）。
 *   - done：压缩完成，展示 token 缩减效果；「复制」拷贝压缩产物可读
 *     转录（摘要 + 骨架）到剪贴板；「完成」冒泡 cancel 关框。
 *   - error：压缩失败，展示错误信息；「关闭」冒泡 cancel 关框。
 */
@customElement("compact-confirm-dialog")
export class CompactConfirmDialog extends LitElement {
  static styles = [
    dialogSlotStyles,
    confirmStyles,
    buttonBaseStyles,
    confirmButtonStyles,
    buttonRowStyles,
    css`
      :host {
        display: block;
        min-width: 340px;
        font-size: var(--cortex-fs-md);
        color: var(--cortex-text);
      }
      /* 标题略大（本地变体，形态走公共块 confirmStyles） */
      h2 { font-size: var(--cortex-fs-lg); margin: 0 0 var(--cortex-space-4); }
      h2.with-icon { gap: var(--cortex-space-3); }
      p {
        margin: 0 0 var(--cortex-space-3);
        line-height: 1.6;
      }
      button doclens-icon { font-size: 14px; vertical-align: -2px; margin-right: 4px; }

      /* —— running 态 —— */
      .running {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--cortex-space-4);
        padding: var(--cortex-space-6) 0;
        text-align: center;
      }
      /* —— done 态效果展示 —— */
      .result {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--cortex-space-4);
        background: var(--cortex-surface-muted);
        border-radius: var(--cortex-radius-sm);
        padding: var(--cortex-space-4) var(--cortex-space-5);
        margin-bottom: var(--cortex-space-4);
      }
      .result .tokens {
        font-size: var(--cortex-fs-xl);
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .result .arrow { color: var(--cortex-text-muted); }
      .result .saved {
        margin-left: auto;
        color: var(--cortex-btn-primary-bg);
        font-size: var(--cortex-fs-sm);
        white-space: nowrap;
      }
      .error-text {
        color: var(--cortex-danger);
        word-break: break-all;
      }
      @media (max-width: 1023px) {
        :host { min-width: 0; }
        .result { flex-wrap: wrap; }
      }
    `,
  ];

  /** 当前阶段：confirm（确认）/ running（压缩中）/ done（完成）/ error（失败）。 */
  @property({ attribute: false }) phase: "confirm" | "running" | "done" | "error" = "confirm";
  /** done：压缩前 tokens（body.pre_tokens）。 */
  @property({ type: Number }) preTokens = 0;
  /** done：压缩后 tokens（body.post_tokens）。 */
  @property({ type: Number }) postTokens = 0;
  /** error：错误信息。 */
  @property({ type: String }) errorMessage = "";
  /** done：压缩产物可读转录（后端渲染，copy 按钮拷贝供人审核）。 */
  @property({ type: String }) compactedText = "";
  /** copy 成功瞬时反馈（复位统一走 utils/clipboard，卸载清理）。 */
  @state() private _copied = false;
  private _copiedFlash = createCopiedFlash(() => { this._copied = false; });

  disconnectedCallback(): void {
    this._copiedFlash.dispose();
    super.disconnectedCallback();
  }

  private _onConfirm = (): void => {
    this.dispatchEvent(new CustomEvent("compact-confirm", {
      bubbles: true, composed: true,
    }));
  };

  private _onCancel = (): void => {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  /** 压缩缩减百分比（pre>0 且有实际缩减才显示）。 */
  private get _savedPercent(): number | null {
    if (this.preTokens <= 0 || this.postTokens >= this.preTokens) return null;
    return Math.round((1 - this.postTokens / this.preTokens) * 100);
  }

  /** copy 压缩产物到剪贴板（降级/复位统一走 utils/clipboard 单一入口）。 */
  private async _onCopy(): Promise<void> {
    const text = this.compactedText;
    if (!text) return;
    if (await copyText(text)) this._flashCopied();
  }

  private _flashCopied(): void {
    this._copied = true;
    this._copiedFlash.flash();
  }

  render() {
    switch (this.phase) {
      case "running":
        return this._renderRunning();
      case "done":
        return this._renderDone();
      case "error":
        return this._renderError();
      default:
        return this._renderConfirm();
    }
  }

  private _renderConfirm() {
    return html`
      <h2>压缩上下文</h2>
      <p>AI 将把当前会话历史总结为一份摘要，之后的对话基于摘要继续，可显著降低上下文占用。</p>
      <p class="muted">聊天记录展示不变，仍然完整可见；生成摘要约需几十秒。</p>
      <div class="note"><doclens-icon name="info"></doclens-icon>
        <span>与上下文占用达到阈值时的自动压缩是同一机制，此处为手动提前执行。</span>
      </div>
      <div class="buttons">
        <button type="button" @click=${this._onCancel}>取消</button>
        <button class="primary" type="button" @click=${this._onConfirm}>确认压缩</button>
      </div>
    `;
  }

  private _renderRunning() {
    return html`
      <div class="running">
        <c-spinner size="28" border="3" label="正在压缩"></c-spinner>
        <div>
          <h2 style="margin: 0 0 var(--cortex-space-2); text-align: center;">正在压缩会话历史…</h2>
          <p class="muted" style="margin: 0;">AI 正在总结会话内容，约需几十秒，请勿关闭页面。</p>
        </div>
      </div>
    `;
  }

  private _renderDone() {
    const saved = this._savedPercent;
    // auto 压缩（ADR-0044）SSE 通道只带 pre/post 估算值，无 compactedText
    return html`
      <h2 class="with-icon">
        <doclens-icon name="circle-check"></doclens-icon>压缩完成
      </h2>
      ${this.postTokens > 0 || this.preTokens > 0 ? html`
        <div class="result">
          <span class="tokens">${formatTokens(this.preTokens)}</span>
          <span class="arrow">→</span>
          <span class="tokens">${formatTokens(this.postTokens)}</span>
          ${saved !== null ? html`<span class="saved">节省 ${saved}%</span>` : nothing}
        </div>
      ` : nothing}
      <p class="muted">上下文已替换为摘要；聊天记录展示不变，后续对话基于摘要继续。</p>
      <div class="buttons">
        ${this.compactedText ? html`
          <button type="button" @click=${this._onCopy}>
            ${this._copied
              ? html`<doclens-icon name="check"></doclens-icon>已复制`
              : html`<doclens-icon name="clipboard"></doclens-icon>复制压缩内容`}
          </button>
        ` : nothing}
        <button class="primary" type="button" @click=${this._onCancel}>完成</button>
      </div>
    `;
  }

  private _renderError() {
    return html`
      <h2 class="with-icon">
        <doclens-icon name="circle-x"></doclens-icon>压缩失败
      </h2>
      <p class="error-text">${this.errorMessage || "未知错误"}</p>
      <p class="muted">会话历史未被修改，可稍后重试。</p>
      <div class="buttons">
        <button class="primary" type="button" @click=${this._onCancel}>关闭</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "compact-confirm-dialog": CompactConfirmDialog;
  }
}
