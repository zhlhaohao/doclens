/** 日记「记录」子页：录入区（文字 + 拍照/相册 + 备注）+ 今日片段时间线。
 *
 * 纯 UI 组件，不直接调 API；事件向上冒泡给 diary-view：
 *   submit-text {value} / upload-photo {file, caption} / delete-fragment {fid}
 *
 * 拍摄实现（ADR-0007）：浏览器用 <input type=file>（「拍照」加
 * capture="environment"，手机唤起相机，桌面端忽略 capture 自然降级为
 * 文件选择；「相册」只用 accept）；NexBox WebView 内 JSBridge 不可用
 * （X5 内核不弹文件选择器），改走 jsbridge takePhoto/pickPhotos 原生
 * 通道，base64 转 File 后复用同一预览/备注/上传链路。
 *
 * 事件补充：photo-error {message}——jsbridge 通道失败时冒泡给 diary-view
 * 显示 error-bar（cancel 静默，不算错误）。
 */
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { DiaryEntry, DiaryFragment } from "../state/types";
import {
  jsbridgePhotoAvailable,
  jsbridgeDebugSummary,
  JSBRIDGE_DEBUG,
  JSBRIDGE_DEBUG_TAG,
  takePhotoAsFile,
  pickPhotoAsFile,
  JsbridgePhotoError,
} from "../utils/jsbridge";
import "./icon";
import "./input-box";
import "./image-viewer";
import "./toast-stack";
import type { ToastStack } from "./toast-stack";

@customElement("diary-record-panel")
export class DiaryRecordPanel extends LitElement {
  static styles = css`
    :host { display: block; box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    .text-input {
      display: block;
      /* 记录页输入框更紧凑：矮一点 + 上下 padding 收窄（默认 ≈48px/11px 偏空旷） */
      --min-h: calc(var(--cortex-fs-md) * 1.5 + 14px);   /* ≈36px，随字号缩放 */
      --cortex-input-pad-y: 6px;
    }
    .photo-btns {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--cortex-space-2, 8px);
      margin-top: var(--cortex-space-2, 8px);
    }
    .city-tag {
      margin-right: auto;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: var(--cortex-fs-sm);
      padding: 0;
      white-space: nowrap;
    }
    .city-tag:hover { color: var(--cortex-primary); }
    .photo-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-width: 44px;
      min-height: var(--cortex-btn-h-md, 44px);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      padding: 0 var(--cortex-btn-pad-x, 14px);
      font-size: var(--cortex-fs-base);
    }
    .photo-btn:hover { background: var(--cortex-surface-muted); }
    .photo-btn:disabled { opacity: 0.5; cursor: default; }

    /* 待上传照片：两行布局——预览+备注一行，操作按钮一行右对齐。
     *  单行布局在手机上输入框仅剩 ~130px（图 72 + 两按钮 + 间距），
     *  备注基本不可用；两行后输入框占满剩余宽度。 */
    .pending-photo {
      margin-top: var(--cortex-space-3, 12px);
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2, 8px);
      padding: var(--cortex-space-3, 12px);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg, 16px);
      background: var(--cortex-surface);
    }
    .pending-main {
      display: flex;
      gap: var(--cortex-space-3, 12px);
      align-items: center;
    }
    .pending-actions {
      display: flex;
      gap: var(--cortex-space-2, 8px);
      justify-content: flex-end;
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
      font-size: var(--cortex-fs-base);
      background: var(--cortex-bg);
      color: var(--cortex-text);
    }
    .pending-photo .caption:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .confirm-btn {
      min-height: var(--cortex-btn-h-md, 44px);
      padding: 0 calc(var(--cortex-btn-pad-x, 14px) + 4px);
      border: none;
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-primary);
      color: #fff;
      font-size: var(--cortex-fs-base);
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

    /* 今日片段时间线（时间轴模式，最新在上）：钴蓝圆点节点 + 节点间连接轴线 */
    .timeline {
      list-style: none;
      margin: var(--cortex-space-4, 16px) 0 0;
      padding: 0;
    }
    .frag {
      display: grid;
      grid-template-columns: 24px 1fr;
      column-gap: var(--cortex-space-2, 8px);
      position: relative;
      padding-bottom: var(--cortex-space-4, 16px);
    }
    .frag:last-child { padding-bottom: 0; }
    /* 节点间连接轴线（最后一条不画） */
    .frag::before {
      content: "";
      position: absolute;
      left: 11px;
      top: 20px;
      bottom: 0;
      width: 2px;
      background: var(--cortex-border-muted, var(--cortex-border));
    }
    .frag:last-child::before { display: none; }
    .node {
      grid-column: 1;
      align-self: start;
      width: 10px;
      height: 10px;
      margin: 6px 0 0 7px;
      border-radius: 50%;
      background: var(--cortex-primary);
      position: relative;
      z-index: 1;
    }
    .frag-content {
      grid-column: 2;
      min-width: 0;
    }
    .frag-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-2, 8px);
      margin-bottom: 2px;
    }
    .frag-meta .time {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text-muted);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }
    .frag-body {
      font-size: var(--cortex-fs-md);
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .frag-body img {
      max-width: 100%;
      max-height: 240px;
      margin-top: var(--cortex-space-1, 4px);
      border-radius: var(--cortex-radius-md, 8px);
      display: block;
      cursor: zoom-in;
    }
    .photo-wrap {
      position: relative;
      display: inline-block;
      margin-top: var(--cortex-space-1, 4px);
      white-space: normal; /* 覆盖 .frag-body 的 pre-wrap，避免模板空白撑高 */
    }
    .photo-wrap img { margin-top: 0; }
    .expand-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.45);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .frag-body .caption {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      margin-top: var(--cortex-space-1, 4px);
    }
    .del-btn {
      flex-shrink: 0;
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      min-width: 44px;
      min-height: 44px;
      padding: 0;
      border-radius: var(--cortex-radius-pill, 100px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--cortex-fs-sm);
    }
    .del-btn:hover { background: var(--cortex-surface-muted); color: var(--cortex-nav-active); }
    .del-btn.confirming { color: #fff; background: var(--cortex-nav-active); padding: 0 12px; }
    .frag-actions { display: flex; align-items: center; gap: 2px; }
    .icon-btn {
      border: none;
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      min-width: 44px;
      min-height: 44px;
      padding: 0;
      border-radius: var(--cortex-radius-pill, 100px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .icon-btn:hover { background: var(--cortex-surface-muted); color: var(--cortex-primary); }
    .edit-area {
      width: 100%;
      min-height: 72px;
      padding: 8px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md, 8px);
      background: var(--cortex-bg);
      color: var(--cortex-text);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      line-height: 1.6;
      resize: vertical;
    }
    .edit-area:focus { outline: none; border-color: var(--cortex-primary); }
    .edit-actions {
      display: flex;
      gap: var(--cortex-space-2, 8px);
      margin-top: var(--cortex-space-2, 8px);
    }
    .save-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: var(--cortex-btn-h-sm, 36px);
      padding: 0 var(--cortex-btn-pad-x, 14px);
      border: none;
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-primary);
      color: #fff;
      font-size: var(--cortex-fs-base);
      font-weight: 600;
      cursor: pointer;
    }
    .save-btn:disabled { opacity: 0.5; cursor: default; }
    .cancel-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: var(--cortex-btn-h-sm, 36px);
      padding: 0 var(--cortex-btn-pad-x, 14px);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-base);
      cursor: pointer;
    }
    .cancel-btn:disabled { opacity: 0.5; cursor: default; }
    .empty-hint {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-base);
      text-align: center;
      padding: var(--cortex-space-6, 24px) 0;
    }
  `;

  @property({ attribute: false }) entry: DiaryEntry | null = null;
  @property({ type: Boolean }) submitting = false;
  @property() city = "";

  /** 待上传的照片（已选未确认）：预览 + 备注输入 */
  @state() private _pendingFile: File | null = null;
  @state() private _pendingPreviewUrl = "";
  /** 两段确认删除：记录处于确认态的 fid */
  @state() private _confirmingFid = "";
  /** inline 编辑：当前编辑中的 fid + 编辑文本 */
  @state() private _editingFid = "";
  @state() private _editText = "";
  /** 全屏图片查看 */
  @state() private _viewerSrc = "";

  connectedCallback() {
    super.connectedCallback();
    if (!this._dbgShown) {
      this._dbgShown = true;
      // 调试：进入记录页即弹环境诊断（点 toast 可提前关闭）
      this.updateComplete.then(() => this._debugToast(jsbridgeDebugSummary(), "info", 6000));
    }
  }
  private _dbgShown = false;

  /** 调试 toast：右下角展示（真机 webview 无 devtools 时的眼睛）；JSBRIDGE_DEBUG=false 时静默 */
  private _debugToast(message: string, level: "success" | "error" | "info" = "info", duration = 4000) {
    if (!JSBRIDGE_DEBUG) return;
    const stack = this.renderRoot?.querySelector("toast-stack") as ToastStack | null;
    stack?.pushToast(message, level, duration);
  }

  private _onSubmitText(e: CustomEvent<{ value: string }>) {
    this.dispatchEvent(new CustomEvent("submit-text", {
      detail: { value: e.detail.value },
      bubbles: true, composed: true,
    }));
    // 清空输入框（input-box 是 controlled 的，这里直接置空其 value）
    const box = e.target as HTMLElement & { value: string };
    box.value = "";
  }

  private _onCityTag() {
    this.dispatchEvent(new CustomEvent("city-change", { bubbles: true, composed: true }));
  }

  private _pickPhoto(capture: boolean) {
    if (jsbridgePhotoAvailable()) {
      this._debugToast(`[${JSBRIDGE_DEBUG_TAG}] 点${capture ? "拍照" : "相册"}→调jsbridge ${capture ? "takePhoto" : "pickPhotos"}…`);
      this._toastCalledJsbridge(capture);
      void this._pickPhotoViaJsbridge(capture);
      return;
    }
    this._debugToast(`[${JSBRIDGE_DEBUG_TAG}] 点${capture ? "拍照" : "相册"}→降级input：${jsbridgeDebugSummary()}`, "error", 6000);
    const input = this.renderRoot.querySelector<HTMLInputElement>(
      capture ? "input[data-capture]" : "input[data-gallery]",
    );
    input?.click();
  }

  /** webview 内走原生通道；失败冒泡 photo-error，取消静默 */
  private async _pickPhotoViaJsbridge(capture: boolean) {
    try {
      const file = await (capture ? takePhotoAsFile() : pickPhotoAsFile());
      if (file) {
        this._debugToast(`[${JSBRIDGE_DEBUG_TAG}] 原生回调success：${file.name} ${(file.size / 1024).toFixed(0)}KB`, "success");
        this._setPendingFile(file);
      } else {
        this._debugToast(`[${JSBRIDGE_DEBUG_TAG}] 原生回调cancel（用户取消）`);
      }
    } catch (e) {
      const message = e instanceof JsbridgePhotoError
        ? `[${JSBRIDGE_DEBUG_TAG}] 原生回调fail code=${e.code}：${e.message}`
        : "拍照失败，请重试";
      this._debugToast(message, "error", 6000);
      this.dispatchEvent(new CustomEvent("photo-error", {
        detail: { message },
        bubbles: true, composed: true,
      }));
    }
  }

  /** 调用已发出（takePhotoAsFile 内部已挂回调等原生），用于确认 messageSend 未抛异常 */
  private _toastCalledJsbridge(capture: boolean) {
    this._debugToast(`[${JSBRIDGE_DEBUG_TAG}] messageSend已发出(${capture ? "takePhoto" : "pickPhotos"})，等原生回调（15s超时）…`, "info", 5000);
  }

  private _setPendingFile(file: File) {
    if (this._pendingPreviewUrl) URL.revokeObjectURL(this._pendingPreviewUrl);
    this._pendingFile = file;
    this._pendingPreviewUrl = URL.createObjectURL(file);
  }

  private _onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";  // 允许重选同一文件
    if (!file) return;
    this._setPendingFile(file);
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

  private _onEdit(fid: string, text: string) {
    this._confirmingFid = "";  // 退出删除确认态
    this._editingFid = fid;
    this._editText = text;
  }

  private _onCancelEdit() {
    this._editingFid = "";
    this._editText = "";
  }

  private _onSaveEdit(fid: string) {
    const text = this._editText;
    this.dispatchEvent(new CustomEvent("edit-fragment", {
      detail: { fid, text },
      bubbles: true, composed: true,
    }));
    this._editingFid = "";
    this._editText = "";
  }

  private _renderFragment(f: DiaryFragment) {
    const confirming = this._confirmingFid === f.fid;
    const editing = this._editingFid === f.fid;
    return html`
      <li class="frag">
        <span class="node"></span>
        <div class="frag-content">
          <div class="frag-meta">
            <span class="time">${f.time}</span>
            <div class="frag-actions">
              ${!editing
                ? html`<button class="icon-btn" title="编辑" @click=${() => this._onEdit(f.fid, f.kind === "photo" && f.text === "照片" ? "" : f.text)}>
                    <doclens-icon name="pencil" style="font-size:16px"></doclens-icon>
                  </button>`
                : null}
              <button
                class="del-btn ${confirming ? "confirming" : ""}"
                title="删除片段"
                @click=${() => this._onDelete(f.fid)}>
                ${confirming ? html`确认删除` : html`<doclens-icon name="trash-2" style="font-size:16px"></doclens-icon>`}
              </button>
            </div>
          </div>
          <div class="frag-body">${editing
            ? html`<textarea
                  class="edit-area"
                  .value=${this._editText}
                  @input=${(e: Event) => this._editText = (e.target as HTMLTextAreaElement).value}></textarea>
                <div class="edit-actions">
                  <button class="save-btn" ?disabled=${this.submitting} @click=${() => this._onSaveEdit(f.fid)}>${this.submitting ? "保存中…" : "保存"}</button>
                  <button class="cancel-btn" ?disabled=${this.submitting} @click=${() => this._onCancelEdit()}>取消</button>
                </div>`
            : f.kind === "photo" && f.image_url
              ? html`<div class="photo-wrap">
                  <img src=${f.image_url} alt=${f.text} loading="lazy"
                       @click=${() => this._viewerSrc = f.image_url!} />
                  <button class="expand-btn" title="全屏查看"
                          @click=${() => this._viewerSrc = f.image_url!}>
                    <doclens-icon name="maximize-2" style="font-size:14px"></doclens-icon>
                  </button>
                </div>
                ${f.text && f.text !== "照片" ? html`<div class="caption">${f.text}</div>` : null}`
              : f.text}</div>
        </div>
      </li>
    `;
  }

  render() {
    // 最新在上
    const fragments = [...(this.entry?.fragments ?? [])].reverse();
    return html`
      <input-box
        class="text-input"
        multiline
        buttonLabel="记录"
        placeholder="记录此刻…"
        ?disabled=${this.submitting}
        @submit=${this._onSubmitText}></input-box>
      <div class="photo-btns">
        ${this.city ? html`<button class="city-tag" title="更换城市" @click=${() => this._onCityTag()}>📍 ${this.city}</button>` : null}
        <button class="photo-btn" ?disabled=${this.submitting} @click=${() => this._pickPhoto(true)}>
          <doclens-icon name="camera" style="font-size:18px"></doclens-icon>拍照
        </button>
        <button class="photo-btn" ?disabled=${this.submitting} @click=${() => this._pickPhoto(false)}>
          <doclens-icon name="image" style="font-size:18px"></doclens-icon>相册
        </button>
      </div>
      <input type="file" data-capture accept="image/*" capture="environment" hidden @change=${this._onFileChange} />
      <input type="file" data-gallery accept="image/*" hidden @change=${this._onFileChange} />

      ${this._pendingFile ? html`
        <div class="pending-photo">
          <div class="pending-main">
            <img src=${this._pendingPreviewUrl} alt="待上传照片" />
            <input class="caption" placeholder="给照片加条备注（可选）" maxlength="200" />
          </div>
          <div class="pending-actions">
            <button class="confirm-btn" ?disabled=${this.submitting} @click=${this._confirmPending}>
              ${this.submitting ? "上传中…" : "上传"}
            </button>
            <button class="cancel-btn" title="取消" @click=${this._cancelPending}>
              <doclens-icon name="x" style="font-size:18px"></doclens-icon>
            </button>
          </div>
        </div>` : null}

      ${fragments.length > 0
        ? html`<ul class="timeline">
            ${fragments.map((f) => this._renderFragment(f))}
          </ul>`
        : html`<div class="empty-hint">今天还没有记录，写下第一条吧</div>`}

      ${this._viewerSrc ? html`<image-viewer
        .src=${this._viewerSrc}
        @close=${() => this._viewerSrc = ""}></image-viewer>` : null}

      <toast-stack></toast-stack>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "diary-record-panel": DiaryRecordPanel;
  }
}
