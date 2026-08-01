import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./md-viewer";
import "./md-editor";
import { savePreview, PreviewSaveError, uploadPreview, PreviewUploadError } from "../api/preview";
import type { PageMarker, PstAttachmentInfo } from "../api/preview";
import { isPstEmailPath, isPstFilePath } from "../api/pst";
import type { MdEditor } from "./md-editor";
import type { MdViewer } from "./md-viewer";
import {
  ScrollJumpController,
  scrollJumpFabStyles,
  renderScrollJumpFabs,
} from "../utils/scroll-jump";

@customElement("preview-pane")
export class PreviewPane extends LitElement {
  static styles = [
    scrollJumpFabStyles,
    css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-card-bg);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .header .path {
      flex: 1;
      min-width: 0;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .body {
      flex: 1;
      overflow: auto;
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre-wrap;      /* 长行自动折回，不横向滚动 */
      overflow-wrap: anywhere;
    }
    /* 行号悬挂缩进：折行的续行对齐到正文列，不压行号列 */
    .body .line {
      padding-left: 48px;
      text-indent: -48px;
    }
    .body .line-no {
      color: var(--cortex-text-subtle);
      display: inline-block;
      width: 40px;
    }
    /* 搜索命中行高亮 —— SaaS Boutique primary-based（替代旧 amber） */
    .highlight {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    .html-frame {
      flex: 1;
      border: none;
      border-radius: 0;
      width: 100%;
      background: #fff;
      min-height: 0;
    }
    /* PST 邮件附件下载区（markdown 预览底部） */
    .attachments {
      flex-shrink: 0;
      max-height: 30%;
      overflow: auto;
      border-top: 1px solid var(--cortex-border-muted);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-1);
    }
    .attachments-title {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-weight: 500;
      padding: var(--cortex-space-1) 0;
    }
    .attachment {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-primary);
      text-decoration: none;
      padding: var(--cortex-space-1) var(--cortex-space-2);
      border-radius: var(--cortex-radius-md);
      transition: background 0.12s;
      min-width: 0;
    }
    .attachment:hover {
      background: var(--cortex-primary-soft);
    }
    .attachment .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .attachment .size {
      flex-shrink: 0;
      margin-left: auto;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .attachment.disabled {
      color: var(--cortex-text-muted);
      cursor: default;
    }
    .attachment.disabled:hover {
      background: transparent;
    }
    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
    }
    /* 次级动作按钮：hairline + radius-sm + muted；hover surface-muted + text */
    button.download-btn,
    button.upload-btn,
    button.back-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    button.download-btn:hover,
    button.upload-btn:hover,
    button.back-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border-color: var(--cortex-text-subtle);
    }
    button.back-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    /* 主动作：编辑按钮 = primary gradient + glow */
    button.edit-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: none;
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      transition: opacity 0.15s;
    }
    button.edit-btn:hover { opacity: 0.9; }
    button.edit-btn:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }
    .mobile-header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      flex-shrink: 0;
      position: relative;
    }
    /* 圆形返回 / 更多按钮 —— 同 focus-header */
    .mobile-header .mobile-back,
    .mobile-header .mobile-more {
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      touch-action: manipulation;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .mobile-header .mobile-back:hover,
    .mobile-header .mobile-more:hover {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .mobile-header .mobile-filename {
      flex: 1;
      min-width: 0;
      text-align: center;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mobile-header .mobile-menu {
      position: absolute;
      top: 100%;
      right: var(--cortex-space-2);
      min-width: 140px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-shadow-lg);
      z-index: 10;
      padding: var(--cortex-space-1) 0;
    }
    .mobile-header .mobile-menu button {
      display: block;
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      color: var(--cortex-text);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      cursor: pointer;
      transition: background 0.15s;
    }
    .mobile-header .mobile-menu button:hover {
      background: var(--cortex-surface-muted);
    }
  `,
  ];

  @property() path = "";
  @property() language = "text";
  @property() content = "";
  @property({ attribute: false }) highlights: number[] = [];
  @property({ type: Boolean }) loading = false;
  @property({ type: Number }) line: number | null = null;
  @property() keyword = "";
  @property({ type: Boolean }) writable = false;
  @property({ type: Boolean }) noHeader = false;
  /** 移动端启用顶部 bar（返回 / 文件名 / more 下拉）。与 noHeader 互不冲突：
   *  移动端显示自己的 mobile-header，常规 .header 由 noHeader 控制。 */
  @property({ type: Boolean }) mobile = false;
  @property({ attribute: false }) pages: PageMarker[] | null = null;
  /** PST 派生邮件预览的附件清单（null = 非邮件预览或无元数据）。 */
  @property({ attribute: false }) attachments: PstAttachmentInfo[] | null = null;
  /** 桌面 header 显示返回按钮（如 PST 邮件预览 → 返回邮件列表）。 */
  @property({ type: Boolean }) showBack = false;
  @property() backLabel = "返回";

  @state() private _mode: "preview" | "edit" = "preview";
  @state() private _content = "";
  @state() private _showMobileMenu = false;

  /** 模式切换的位置锚点（源行号）：预览↔编辑共用同一种锚点货币。 */
  private _anchorLine = 1;
  /** 切回预览时抑制 md-viewer 的命中行定位（避免与锚点恢复打架） */
  private _suppressLocate = false;
  /** 外部新文档到达（content prop 变化）→ 跳过一次锚点恢复 */
  private _skipRestoreOnce = false;

  /** 悬浮跳转按钮（纯文本预览分支；markdown 分支由 md-viewer 自治） */
  private _scrollJump = new ScrollJumpController(this, { behavior: "smooth" });

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("content")) {
      this._content = this.content;
      this._mode = "preview";
      // 新文档：锚点失效，不做位置恢复，命中行定位照常
      this._skipRestoreOnce = true;
      this._suppressLocate = false;
      this._anchorLine = 1;
    }
  }

  async updated(changed: Map<string, unknown>) {
    super.updated?.(changed);
    // 纯文本分支的滚动容器 .body 只在该分支存在：在则绑定，不在则解绑
    const body = this.shadowRoot!.querySelector(".body") as HTMLElement | null;
    if (body) this._scrollJump.attach(body);
    else this._scrollJump.detach();

    if (!changed.has("_mode")) return;
    if (this._mode === "edit") {
      // 预览 → 编辑：把锚点行恢复为编辑器视口顶部（瞬跳）
      const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
      if (editor) {
        await editor.updateComplete;
        editor.scrollToLine(this._anchorLine);
      }
      return;
    }
    // 编辑 → 预览
    if (this._skipRestoreOnce) {
      this._skipRestoreOnce = false;
      return;
    }
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    if (viewer) {
      await viewer.updateComplete;
      viewer.scrollToSourceLine(this._anchorLine, "auto");
    }
    this._suppressLocate = false;
  }

  connectedCallback() {
    super.connectedCallback();
    // 点击 outside 关闭 more 下拉
    document.addEventListener("click", this._onDocClick, true);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._onDocClick, true);
    super.disconnectedCallback();
  }

  /** 移动端返回按钮。父组件监听 @back 自行决定如何导航。 */
  private _onMobileBackClick = () => {
    this.dispatchEvent(new CustomEvent("back", {
      bubbles: true,
      composed: true,
    }));
  };

  private _onMobileMoreClick = (e: Event) => {
    e.stopPropagation();
    this._showMobileMenu = !this._showMobileMenu;
  };

  private _onDocClick = (e: MouseEvent) => {
    if (!this._showMobileMenu) return;
    const path = e.composedPath();
    // 仅在点击 menu 自身或 more 按钮时不关闭；其它位置（含组件 shadow 内
    // 的 preview 内容）一律关闭。原先 path.includes(this) 太宽，导致点
    // preview 内容时不关闭。
    const menu = this.shadowRoot?.querySelector(".mobile-menu");
    const more = this.shadowRoot?.querySelector(".mobile-more");
    if (menu && path.includes(menu)) return;
    if (more && path.includes(more)) return;
    this._showMobileMenu = false;
  };

  private _basename(p: string): string {
    if (!p) return "";
    const i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(i + 1) : p;
  }

  /** PST 路径（物理 .pst 或派生邮件 xxx.pst#entry）：原始文件下载/上传无意义。 */
  private get _isPst(): boolean {
    return isPstEmailPath(this.path) || isPstFilePath(this.path);
  }

  private _renderMobileHeader() {
    return html`
      <div class="mobile-header">
        <button
          class="mobile-back"
          type="button"
          aria-label="返回"
          @click=${this._onMobileBackClick}
        ><doclens-icon name="arrow-left"></doclens-icon></button>
        <span class="mobile-filename" title=${this.path}>${this._basename(this.path)}</span>
        <button
          class="mobile-more"
          type="button"
          aria-label="更多操作"
          @click=${this._onMobileMoreClick}
        ><doclens-icon name="more-horizontal"></doclens-icon></button>
        ${this._showMobileMenu
          ? html`
              <div class="mobile-menu" role="menu">
                ${this.writable
                  ? html`<button
                      type="button"
                      role="menuitem"
                      @click=${() => { this._showMobileMenu = false; this.enterEdit(); }}
                    ><doclens-icon name="pencil"></doclens-icon>编辑</button>`
                  : null}
                ${this._isPst
                  ? null
                  : html`<button
                      type="button"
                      role="menuitem"
                      @click=${() => { this._showMobileMenu = false; this._onDownloadClick(); }}
                    ><doclens-icon name="download"></doclens-icon>下载</button>
                <button
                  type="button"
                  role="menuitem"
                  @click=${() => { this._showMobileMenu = false; this._onUploadClick(); }}
                ><doclens-icon name="upload"></doclens-icon>上传</button>`}
              </div>
            `
          : null}
      </div>
    `;
  }

  enterEdit() {
    // 捕获预览视口顶部的源行号作为锚点（块级精度）
    const viewer = this.shadowRoot!.querySelector("md-viewer") as MdViewer | null;
    if (viewer) this._anchorLine = viewer.topSourceLine();
    this._mode = "edit";
  }

  /** 退出编辑前捕获编辑器视口顶部的源行号（编辑后新文本的行号），
   *  并抑制切回预览时 md-viewer 的命中行定位（避免与锚点恢复打架）。 */
  private _captureEditorAnchor() {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    if (editor) this._anchorLine = editor.topLine();
    this._suppressLocate = true;
  }

  private _onEditorCancel = () => {
    this._captureEditorAnchor();
    this._mode = "preview";
  };

  private _onEditorDirty = (e: CustomEvent<{ dirty: boolean }>) => {
    this.dispatchEvent(
      new CustomEvent("dirty-change", { detail: { dirty: e.detail.dirty } }),
    );
  };

  private async _onEditorSave(e: CustomEvent<{ content: string }>) {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    this._captureEditorAnchor();
    try {
      await savePreview(this.path, e.detail.content);
      this._content = e.detail.content;
      this._mode = "preview";
      this.dispatchEvent(
        new CustomEvent("saved", { detail: { content: e.detail.content } }),
      );
    } catch (err) {
      const msg =
        err instanceof PreviewSaveError
          ? `${err.code} ${err.message}`
          : (err as Error).message ?? "保存失败";
      editor?.setError(msg);
      this.dispatchEvent(
        new CustomEvent("save-failed", { detail: { message: msg } }),
      );
    }
  }

  /** 公共方法：父组件（search-view）在用户确认"丢弃修改"后调用。 */
  discard() {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
    editor?.discard();
    this._mode = "preview";
  }

  /** 触发原始文件下载；文件名由后端 Content-Disposition 决定。 */
  private _onDownloadClick = () => {
    if (!this.path) return;
    const url = `/api/preview/download?path=${encodeURIComponent(this.path)}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    // 文件名由后端 Content-Disposition 提供，这里不设 download 属性
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  private _renderDownloadBtn() {
    if (this._isPst) return null;
    return html`<button class="download-btn" @click=${this._onDownloadClick}><doclens-icon name="download"></doclens-icon>下载</button>`;
  }

  /** 桌面 header 返回按钮（复用 mobile back 事件，父组件统一监听 @back）。 */
  private _renderBackBtn() {
    if (!this.showBack) return null;
    return html`<button class="back-btn" @click=${this._onMobileBackClick}><doclens-icon name="arrow-left"></doclens-icon>${this.backLabel}</button>`;
  }

  private _onUploadClick = () => {
    const input = this.shadowRoot?.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    input?.click();
  };

  private async _onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    // 重置 value 允许下次再选同一文件
    input.value = "";
    if (!file) return;
    const ok = window.confirm(`即将上传 '${file.name}' 覆盖原文件，是否继续？`);
    if (!ok) return;
    try {
      const res = await uploadPreview(file);
      this.dispatchEvent(
        new CustomEvent("upload-success", { detail: { path: res.path } }),
      );
    } catch (err) {
      const msg =
        err instanceof PreviewUploadError
          ? `${err.code} ${err.message}`
          : (err as Error).message ?? "上传失败";
      this.dispatchEvent(
        new CustomEvent("upload-failed", { detail: { message: msg } }),
      );
    }
  }

  private _renderUploadBtn() {
    if (this._isPst) return null;
    return html`<button class="upload-btn" @click=${this._onUploadClick}><doclens-icon name="upload"></doclens-icon>上传</button>`;
  }

  private _formatSize(size: number): string {
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
    if (size >= 1024) return `${Math.round(size / 1024)} KB`;
    return `${size} B`;
  }

  /** PST 邮件附件下载区：stored 的可点击下载，未落盘的仅展示名称。 */
  private _renderAttachments() {
    if (!this.attachments || this.attachments.length === 0) return null;
    return html`
      <div class="attachments">
        <div class="attachments-title">附件（${this.attachments.length}）</div>
        ${this.attachments.map((a) =>
          a.stored && a.download_url
            ? html`<a
                class="attachment"
                href=${a.download_url}
                title=${a.name}
              ><doclens-icon name="download"></doclens-icon>
                <span class="name">${a.name}</span>
                <span class="size">${this._formatSize(a.size)}</span>
              </a>`
            : html`<span class="attachment disabled" title=${a.name}>
                <span class="name">${a.name}</span>
                <span class="size">${this._formatSize(a.size)} · 未落盘</span>
              </span>`,
        )}
      </div>
    `;
  }

  render() {
    if (this.loading) return html`<div class="empty">加载中...</div>`;
    if (!this._content && !this.content)
      return html`<div class="empty">点击左侧结果查看预览</div>`;

    // 移动端用自己的顶部 bar，常规 .header 不再渲染（避免双 bar）
    const renderMobileBar = this.mobile ? this._renderMobileHeader() : null;
    const showDesktopHeader = !this.mobile && !this.noHeader;

    if (this.language === "markdown" && this._mode === "edit") {
      return html`
        <input type="file" hidden @change=${this._onFileChange}>
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
          </div>
        ` : null}
        <md-editor
          .path=${this.path}
          .originalContent=${this._content}
          ?mobile=${this.mobile}
          @save=${this._onEditorSave}
          @cancel=${this._onEditorCancel}
          @dirty-change=${this._onEditorDirty}
        ></md-editor>
      `;
    }

    if (this.language === "markdown") {
      return html`
        <input type="file" hidden @change=${this._onFileChange}>
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this.writable
              ? html`<button class="edit-btn" @click=${() => this.enterEdit()}><doclens-icon name="pencil"></doclens-icon>编辑</button>`
              : null}
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
          </div>
        ` : null}
        <md-viewer
          .content=${this._content}
          .line=${this.line}
          .keyword=${this.keyword}
          .pages=${this.pages}
          ?suppressLocate=${this._suppressLocate}
        ></md-viewer>
        ${this._renderAttachments()}
      `;
    }

    // HTML：iframe srcdoc 渲染原生网页（脚本隔离，不可编辑）
    if (this.language === "html") {
      return html`
        <input type="file" hidden @change=${this._onFileChange}>
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
            ${this._renderBackBtn()}
            <span class="path">${this.path}</span>
            ${this._renderDownloadBtn()}
            ${this._renderUploadBtn()}
          </div>
        ` : null}
        <iframe
          class="html-frame"
          srcdoc=${this._content}
          sandbox="allow-scripts"
          title="HTML 预览"
        ></iframe>
      `;
    }

    // 非 md：现有纯文本 + 行号视图
    const lines = this._content.split("\n");
    return html`
      <input type="file" hidden @change=${this._onFileChange}>
      ${renderMobileBar}
      ${showDesktopHeader ? html`
        <div class="header">
          ${this._renderBackBtn()}
          <span class="path">${this.path}</span>
          ${this._renderDownloadBtn()}
          ${this._renderUploadBtn()}
        </div>
      ` : null}
      <div class="body">
        ${lines.map((line, i) => {
          const lineNo = i + 1;
          const cls = this.highlights.includes(lineNo) ? "highlight" : "";
          return html`<div class="line ${cls}"><span class="line-no">${lineNo}</span>${line}</div>`;
        })}
        <div class="scroll-jump-anchor">${renderScrollJumpFabs(this._scrollJump)}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "preview-pane": PreviewPane;
  }
}
