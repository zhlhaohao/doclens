/** 日记「记录」子页：录入区（文字 + 拍照/相册 + 备注）+ 今日片段时间线。
 *
 * 纯 UI 组件，不直接调 API；事件向上冒泡给 diary-view：
 *   submit-text {value} / upload-photo {file, caption} / delete-fragment {fid}
 *
 * 拍摄实现（ADR-0007）：「拍照」用 capture="environment"（手机唤起相机，
 * 桌面端浏览器忽略 capture 自然降级为文件选择）；「相册」只用 accept。
 */
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { DiaryEntry, DiaryFragment } from "../state/types";
import "./icon";
import "./input-box";

@customElement("diary-record-panel")
export class DiaryRecordPanel extends LitElement {
  static styles = css`
    :host { display: block; }
    .entry-row {
      display: flex;
      gap: var(--cortex-space-2, 8px);
      align-items: flex-start;
    }
    .entry-row input-box { flex: 1; min-width: 0; }
    .photo-btns { display: flex; gap: var(--cortex-space-2, 8px); }
    .photo-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 44px;
      min-height: 44px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      padding: 0 14px;
      font-size: 14px;
    }
    .photo-btn:hover { background: var(--cortex-surface-muted); }
    .photo-btn:disabled { opacity: 0.5; cursor: default; }

    /* 待上传照片：备注输入条 */
    .pending-photo {
      margin-top: var(--cortex-space-3, 12px);
      display: flex;
      gap: var(--cortex-space-3, 12px);
      align-items: center;
      padding: var(--cortex-space-3, 12px);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg, 16px);
      background: var(--cortex-surface);
    }
    .pending-photo img {
      width: 72px;
      height: 72px;
      object-fit: cover;
      border-radius: var(--cortex-radius-md, 8px);
      flex-shrink: 0;
    }
    .pending-photo .caption {
      flex: 1;
      min-width: 0;
      height: 44px;
      padding: 0 12px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md, 8px);
      font-size: 14px;
      background: var(--cortex-bg);
      color: var(--cortex-text);
    }
    .pending-photo .caption:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .confirm-btn {
      min-height: 44px;
      padding: 0 18px;
      border: none;
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-primary);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .confirm-btn:disabled { opacity: 0.5; cursor: default; }
    .cancel-btn {
      min-width: 44px;
      min-height: 44px;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill, 100px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .cancel-btn:hover { background: var(--cortex-surface-muted); }

    /* 今日片段时间线（最新在上） */
    .timeline { margin-top: var(--cortex-space-4, 16px); }
    .timeline-title {
      font-size: 13px;
      color: var(--cortex-text-muted);
      margin: 0 0 var(--cortex-space-2, 8px);
    }
    .frag {
      display: flex;
      gap: var(--cortex-space-3, 12px);
      align-items: flex-start;
      padding: var(--cortex-space-3, 12px);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg, 16px);
      background: var(--cortex-surface);
      margin-bottom: var(--cortex-space-2, 8px);
    }
    .frag .time {
      flex-shrink: 0;
      font-size: 13px;
      color: var(--cortex-text-muted);
      font-variant-numeric: tabular-nums;
      padding-top: 2px;
    }
    .frag .body { flex: 1; min-width: 0; font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .frag img {
      max-width: 160px;
      max-height: 160px;
      border-radius: var(--cortex-radius-md, 8px);
      display: block;
    }
    .frag .caption { font-size: 13px; color: var(--cortex-text-muted); margin-top: 4px; }
    .del-btn {
      flex-shrink: 0;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      min-width: 44px;
      min-height: 44px;
      margin: -8px -8px 0 0;
      border-radius: var(--cortex-radius-pill, 100px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
    }
    .del-btn:hover { background: var(--cortex-surface-muted); color: var(--cortex-nav-active); }
    .del-btn.confirming { color: #fff; background: var(--cortex-nav-active); padding: 0 12px; }
    .empty-hint {
      color: var(--cortex-text-muted);
      font-size: 14px;
      text-align: center;
      padding: var(--cortex-space-6, 24px) 0;
    }
  `;

  @property({ attribute: false }) entry: DiaryEntry | null = null;
  @property({ type: Boolean }) submitting = false;

  /** 待上传的照片（已选未确认）：预览 + 备注输入 */
  @state() private _pendingFile: File | null = null;
  @state() private _pendingPreviewUrl = "";
  /** 两段确认删除：记录处于确认态的 fid */
  @state() private _confirmingFid = "";

  private _onSubmitText(e: CustomEvent<{ value: string }>) {
    this.dispatchEvent(new CustomEvent("submit-text", {
      detail: { value: e.detail.value },
      bubbles: true, composed: true,
    }));
    // 清空输入框（input-box 是 controlled 的，这里直接置空其 value）
    const box = e.target as HTMLElement & { value: string };
    box.value = "";
  }

  private _pickPhoto(capture: boolean) {
    const input = this.renderRoot.querySelector<HTMLInputElement>(
      capture ? "input[data-capture]" : "input[data-gallery]",
    );
    input?.click();
  }

  private _onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";  // 允许重选同一文件
    if (!file) return;
    if (this._pendingPreviewUrl) URL.revokeObjectURL(this._pendingPreviewUrl);
    this._pendingFile = file;
    this._pendingPreviewUrl = URL.createObjectURL(file);
  }

  private _cancelPending() {
    if (this._pendingPreviewUrl) URL.revokeObjectURL(this._pendingPreviewUrl);
    this._pendingFile = null;
    this._pendingPreviewUrl = "";
  }

  private _confirmPending() {
    if (!this._pendingFile) return;
    const caption = this.renderRoot.querySelector<HTMLInputElement>(".caption")?.value.trim() ?? "";
    const file = this._pendingFile;
    this._cancelPending();
    this.dispatchEvent(new CustomEvent("upload-photo", {
      detail: { file, caption },
      bubbles: true, composed: true,
    }));
  }

  private _onDelete(fid: string) {
    if (this._confirmingFid !== fid) {
      // 第一段：进入确认态（再次点击才真删，防误触）
      this._confirmingFid = fid;
      return;
    }
    this._confirmingFid = "";
    this.dispatchEvent(new CustomEvent("delete-fragment", {
      detail: { fid },
      bubbles: true, composed: true,
    }));
  }

  private _renderFragment(f: DiaryFragment) {
    const confirming = this._confirmingFid === f.fid;
    return html`
      <div class="frag">
        <span class="time">${f.time}</span>
        <div class="body">
          ${f.kind === "photo" && f.image_url
            ? html`<img src=${f.image_url} alt=${f.text} loading="lazy" />
                   ${f.text && f.text !== "照片" ? html`<div class="caption">${f.text}</div>` : null}`
            : html`${f.text}`}
        </div>
        <button
          class="del-btn ${confirming ? "confirming" : ""}"
          title="删除片段"
          @click=${() => this._onDelete(f.fid)}>
          ${confirming ? html`确认删除` : html`<doclens-icon name="trash-2" style="font-size:16px"></doclens-icon>`}
        </button>
      </div>
    `;
  }

  render() {
    // 最新在上
    const fragments = [...(this.entry?.fragments ?? [])].reverse();
    return html`
      <div class="entry-row">
        <input-box
          multiline
          buttonLabel="记录"
          placeholder="记录此刻…（Enter 发送，Shift+Enter 换行）"
          ?disabled=${this.submitting}
          @submit=${this._onSubmitText}></input-box>
        <div class="photo-btns">
          <button class="photo-btn" ?disabled=${this.submitting} @click=${() => this._pickPhoto(true)}>
            <doclens-icon name="camera" style="font-size:18px"></doclens-icon>拍照
          </button>
          <button class="photo-btn" ?disabled=${this.submitting} @click=${() => this._pickPhoto(false)}>
            <doclens-icon name="image" style="font-size:18px"></doclens-icon>相册
          </button>
        </div>
      </div>
      <input type="file" data-capture accept="image/*" capture="environment" hidden @change=${this._onFileChange} />
      <input type="file" data-gallery accept="image/*" hidden @change=${this._onFileChange} />

      ${this._pendingFile ? html`
        <div class="pending-photo">
          <img src=${this._pendingPreviewUrl} alt="待上传照片" />
          <input class="caption" placeholder="给照片加条备注（可选）" maxlength="200" />
          <button class="confirm-btn" ?disabled=${this.submitting} @click=${this._confirmPending}>
            ${this.submitting ? "上传中…" : "上传"}
          </button>
          <button class="cancel-btn" title="取消" @click=${this._cancelPending}>
            <doclens-icon name="x" style="font-size:18px"></doclens-icon>
          </button>
        </div>` : null}

      <div class="timeline">
        ${fragments.length > 0
          ? html`<p class="timeline-title">今天已记录 ${fragments.length} 条（明天自动整理成日记）</p>
                 ${fragments.map((f) => this._renderFragment(f))}`
          : html`<div class="empty-hint">今天还没有记录，写下第一条吧</div>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "diary-record-panel": DiaryRecordPanel;
  }
}
