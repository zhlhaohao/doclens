import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./md-viewer";
import "./md-editor";
import { savePreview, PreviewSaveError, uploadPreview, PreviewUploadError } from "../api/preview";
import type { PageMarker } from "../api/preview";
import type { MdEditor } from "./md-editor";

@customElement("preview-pane")
export class PreviewPane extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      padding: 10px 14px;
      border-bottom: 1px solid var(--cortex-border);
      font-family: var(--cortex-font-mono);
      flex-shrink: 0;
    }
    .header .path { flex: 1; }
    .body {
      flex: 1;
      overflow: auto;
      padding: 12px 14px;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      line-height: 1.7;
      color: var(--cortex-text);
      white-space: pre;
    }
    .highlight { background: #fef3c7; padding: 0 2px; border-radius: 2px; }
    .html-frame {
      flex: 1;
      border: 0;
      width: 100%;
      background: white;
      min-height: 0;
    }
    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
    }
    button.edit-btn,
    button.download-btn,
    button.upload-btn {
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: 4px;
      cursor: pointer;
    }
    .mobile-header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 8px 10px;
      border-bottom: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      flex-shrink: 0;
      position: relative;
    }
    .mobile-header .mobile-back,
    .mobile-header .mobile-more {
      border: none;
      background: transparent;
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 6px 10px;
      border-radius: var(--cortex-radius-sm);
      min-width: 36px;
    }
    .mobile-header .mobile-back:hover,
    .mobile-header .mobile-more:hover {
      background: var(--cortex-surface-muted);
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
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      z-index: 10;
      padding: 4px 0;
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
      padding: 10px 14px;
      cursor: pointer;
    }
    .mobile-header .mobile-menu button:hover {
      background: var(--cortex-surface-muted);
    }
  `;

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

  @state() private _mode: "preview" | "edit" = "preview";
  @state() private _content = "";
  @state() private _showMobileMenu = false;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("content")) {
      this._content = this.content;
      this._mode = "preview";
    }
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
    // 路径中包含 preview-pane 自身或 mobile-menu 即视为 inside
    if (path.includes(this)) return;
    this._showMobileMenu = false;
  };

  private _basename(p: string): string {
    if (!p) return "";
    const i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(i + 1) : p;
  }

  private _renderMobileHeader() {
    return html`
      <div class="mobile-header">
        <button
          class="mobile-back"
          type="button"
          aria-label="返回"
          @click=${this._onMobileBackClick}
        >←</button>
        <span class="mobile-filename" title=${this.path}>${this._basename(this.path)}</span>
        <button
          class="mobile-more"
          type="button"
          aria-label="更多操作"
          @click=${this._onMobileMoreClick}
        >⋯</button>
        ${this._showMobileMenu
          ? html`
              <div class="mobile-menu" role="menu">
                ${this.writable
                  ? html`<button
                      type="button"
                      role="menuitem"
                      @click=${() => { this._showMobileMenu = false; this.enterEdit(); }}
                    >✏️ 编辑</button>`
                  : null}
                <button
                  type="button"
                  role="menuitem"
                  @click=${() => { this._showMobileMenu = false; this._onDownloadClick(); }}
                >⬇️ 下载</button>
                <button
                  type="button"
                  role="menuitem"
                  @click=${() => { this._showMobileMenu = false; this._onUploadClick(); }}
                >⬆️ 上传</button>
              </div>
            `
          : null}
      </div>
    `;
  }

  enterEdit() {
    this._mode = "edit";
  }

  private _onEditorCancel = () => {
    this._mode = "preview";
  };

  private _onEditorDirty = (e: CustomEvent<{ dirty: boolean }>) => {
    this.dispatchEvent(
      new CustomEvent("dirty-change", { detail: { dirty: e.detail.dirty } }),
    );
  };

  private async _onEditorSave(e: CustomEvent<{ content: string }>) {
    const editor = this.shadowRoot!.querySelector("md-editor") as MdEditor | null;
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
    return html`<button class="download-btn" @click=${this._onDownloadClick}>⬇️ 下载</button>`;
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
    return html`<button class="upload-btn" @click=${this._onUploadClick}>⬆️ 上传</button>`;
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
            <span class="path">${this.path}</span>
            ${this.writable
              ? html`<button class="edit-btn" @click=${() => this.enterEdit()}>✏️ 编辑</button>`
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
        ></md-viewer>
      `;
    }

    // HTML：iframe srcdoc 渲染原生网页（脚本隔离，不可编辑）
    if (this.language === "html") {
      return html`
        <input type="file" hidden @change=${this._onFileChange}>
        ${renderMobileBar}
        ${showDesktopHeader ? html`
          <div class="header">
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
          <span class="path">${this.path}</span>
          ${this._renderDownloadBtn()}
          ${this._renderUploadBtn()}
        </div>
      ` : null}
      <div class="body">
        ${lines.map((line, i) => {
          const lineNo = i + 1;
          const cls = this.highlights.includes(lineNo) ? "highlight" : "";
          return html`<div class=${cls}><span style="color:var(--cortex-text-subtle);display:inline-block;width:40px;">${lineNo}</span>${line}</div>`;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "preview-pane": PreviewPane;
  }
}
