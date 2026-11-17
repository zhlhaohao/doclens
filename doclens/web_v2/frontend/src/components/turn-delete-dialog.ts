import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ConfirmDialogBase } from "./confirm-dialog-base";

/** 锚点摘录截断长度（与 rewind-dialog 同口径，摘录仅提示用）。 */
const ANCHOR_EXCERPT_LEN = 160;

/**
 * <turn-delete-dialog> —— 删除对话对确认框（2026-10-29）。
 *
 * 删除粒度是**整轮**（该 user 消息 + 其后的工具轨迹与 AI 回复），用于清理
 * 无用轮次、压短上下文。确认后冒泡 turn-delete-confirm {pointSeq}，执行与
 * 刷新由 chat-view 负责；取消/ESC 冒泡 cancel。
 * 外壳走 ConfirmDialogBase（AP-4）；提交中状态由宿主回传 submitting prop
 * （单一真相源 AP-36：confirm 派发是同步的，宿主随即置 true 回传，
 * 组件内不另存第二份 busy 态）。
 */
@customElement("turn-delete-dialog")
export class TurnDeleteDialog extends ConfirmDialogBase {
  static styles = [
    ...ConfirmDialogBase.styles,
    css`
      h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 var(--cortex-space-3);
        font-size: var(--cortex-fs-lg);
      }
      h2 doclens-icon { color: var(--cortex-danger); }
      /* 摘录块限高（本地变体，形态走公共块 confirmStyles） */
      .anchor { max-height: 6em; overflow: hidden; }
      .warn doclens-icon { color: var(--cortex-danger); flex: none; }
    `,
  ];

  /** 锚点（该 user 消息）seq */
  @property({ type: Number }) pointSeq = -1;
  /** 锚点消息内容（确认框预览） */
  @property() anchorContent = "";
  /** 将被删除的本轮消息条数（user + AI） */
  @property({ type: Number }) turnMessageCount = 0;
  /** 提交中（宿主回传；失败时由 chat-view 回填 errorMessage）。 */
  @property() submitting = false;
  @property() errorMessage = "";

  protected get isSubmitting(): boolean { return this.submitting; }
  protected get submitError(): string { return this.errorMessage; }

  protected get dialogTitle(): unknown {
    return html`<doclens-icon name="trash-2"></doclens-icon>删除这一轮对话`;
  }
  protected get confirmLabel(): string { return "删除"; }
  protected get danger(): boolean { return true; }

  protected renderBody() {
    const excerpt = this.anchorContent.slice(0, ANCHOR_EXCERPT_LEN) || "（空消息）";
    const n = this.turnMessageCount;
    return html`
      <div class="anchor">${excerpt}</div>
      <div class="detail">
        将删除这条提问及其后的${n > 1 ? ` ${n} 条消息` : "回答"}（含工具调用轨迹），
        后续对话不受影响。
      </div>
      <div class="warn"><doclens-icon name="alert-triangle"></doclens-icon>
        <span>删除<b>不可撤销</b>，且会改变本会话的上下文（模型不再看到这部分内容）。</span>
      </div>
    `;
  }

  render() {
    return this.renderConfirm();
  }

  protected confirm(): void {
    if (this.submitting) return;
    this.dispatchEvent(
      new CustomEvent("turn-delete-confirm", {
        detail: { pointSeq: this.pointSeq },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "turn-delete-dialog": TurnDeleteDialog;
  }
}
