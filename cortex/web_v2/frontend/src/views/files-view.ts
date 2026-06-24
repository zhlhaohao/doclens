import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store, actions } from "../state/store";
import { filesApi } from "../api/files";
import { fetchPreview } from "../api/preview";
import type { PageMarker } from "../api/preview";
import "../components/file-tree";
import "../components/file-list";
import "../components/preview-pane";
import "../components/mkdir-dialog";
import "../components/rename-dialog";
import "../components/move-dialog";
import "../components/delete-dialog";
import "../components/drop-zone";

type DialogKind = "mkdir" | "rename" | "move" | "delete" | null;

@customElement("files-view")
export class FilesView extends LitElement {
  static readonly TREE_PANE_WIDTH_KEY = "cortex.files.treePaneWidth";
  static readonly TREE_PANE_WIDTH_DEFAULT = 240;
  static readonly TREE_PANE_WIDTH_MIN = 180;
  static readonly TREE_PANE_WIDTH_MAX = 720;

  static readonly PREVIEW_PANE_WIDTH_KEY = "cortex.files.previewPaneWidth";
  static readonly PREVIEW_PANE_WIDTH_DEFAULT = 320;
  static readonly PREVIEW_PANE_WIDTH_MIN = 240;
  static readonly PREVIEW_PANE_WIDTH_MAX = 1600;

  /** file-list（中间栏）最小宽度，用于动态限制 splitter 拖动 */
  static readonly MIDDLE_PANE_MIN = 300;
  /** 两个 splitter 的总宽度 */
  static readonly SPLITTERS_TOTAL = 8;

  static styles = css`
    :host {
      display: flex; flex-direction: column;
      flex: 1; min-height: 0;
      background: var(--cortex-bg);
      font-family: var(--cortex-font);
    }
    .desktop-layout {
      flex: 1;
      display: grid;
      grid-template-columns:
        var(--tree-pane-width, 240px)
        4px
        1fr
        4px
        var(--preview-pane-width, 320px);
      min-height: 0;
    }
    .splitter {
      cursor: col-resize;
      background: var(--cortex-border);
      transition: background 0.15s;
      min-height: 0;
    }
    .splitter:hover, .splitter:active { background: var(--cortex-primary); }
    .mobile-layout {
      flex: 1; min-height: 0; position: relative;
    }
    .mobile-layout file-tree,
    .mobile-layout file-list,
    .mobile-layout .mobile-preview {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .preview-col {
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: var(--cortex-surface);
      border-left: 1px solid var(--cortex-border);
      overflow: hidden;
    }
    .preview-placeholder {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--cortex-space-8);
      color: var(--cortex-text-subtle);
      text-align: center;
      font-size: var(--cortex-fs-base);
    }
    .mobile-preview {
      flex: 1; min-height: 0; display: flex; flex-direction: column;
    }
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: 0 12px 32px rgba(0,0,0,0.12);
      min-width: 360px;
      max-width: 90vw;
    }
    dialog::backdrop { background: rgba(0,0,0,0.3); }
    dialog > * { display: block; padding: var(--cortex-space-6); }
    .toast {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: var(--cortex-text);
      color: var(--cortex-surface);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-sm);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      cursor: pointer;
    }
    .back-btn {
      position: absolute; top: var(--cortex-space-2); left: var(--cortex-space-2);
      padding: 6px 12px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
      z-index: 5;
      font-size: var(--cortex-fs-sm);
    }
    @media (max-width: 1023px) {
      .desktop-layout { display: none; }
    }
    @media (min-width: 1024px) {
      .mobile-layout { display: none; }
    }
  `;

  @state() private _dialog: DialogKind = null;
  @state() private _toast: string | null = null;
  private _toastTimer: any = null;

  // preview state（与 search-view 同款，本地管理）
  @state() private _previewPath = "";
  @state() private _previewContent = "";
  @state() private _previewLanguage = "text";
  @state() private _previewWritable = false;
  @state() private _previewPages: PageMarker[] | null = null;
  @state() private _previewError: "NOT_INDEXED" | null = null;
  @state() private _previewDirty = false;

  @state() private _treePaneWidth = FilesView.TREE_PANE_WIDTH_DEFAULT;
  @state() private _previewPaneWidth = FilesView.PREVIEW_PANE_WIDTH_DEFAULT;

  private _unsubscribe?: () => void;
  private _fileInput: HTMLInputElement | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._ensureLoaded("");
    this._loadPaneWidths();
  }

  private _loadPaneWidths() {
    const treeSaved = localStorage.getItem(FilesView.TREE_PANE_WIDTH_KEY);
    if (treeSaved) {
      const w = Number(treeSaved);
      if (!Number.isNaN(w)) {
        this._treePaneWidth = Math.max(
          FilesView.TREE_PANE_WIDTH_MIN,
          Math.min(FilesView.TREE_PANE_WIDTH_MAX, w),
        );
      }
    }
    const previewSaved = localStorage.getItem(FilesView.PREVIEW_PANE_WIDTH_KEY);
    if (previewSaved) {
      const w = Number(previewSaved);
      if (!Number.isNaN(w)) {
        this._previewPaneWidth = Math.max(
          FilesView.PREVIEW_PANE_WIDTH_MIN,
          Math.min(FilesView.PREVIEW_PANE_WIDTH_MAX, w),
        );
      }
    }
  }

  /** 左 splitter：拖动 file-tree 右边缘。dx 正 = 变宽。
   *  动态上限 = 窗口宽 - preview 宽 - 中间栏最小 - splitters，避免挤掉中间栏。 */
  private _onTreeSplitterMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this._treePaneWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dynMax = typeof window !== "undefined"
        ? window.innerWidth - this._previewPaneWidth - FilesView.MIDDLE_PANE_MIN - FilesView.SPLITTERS_TOTAL
        : FilesView.TREE_PANE_WIDTH_MAX;
      const cap = Math.min(FilesView.TREE_PANE_WIDTH_MAX, dynMax);
      const w = Math.max(
        FilesView.TREE_PANE_WIDTH_MIN,
        Math.min(cap, startWidth + dx),
      );
      if (w !== this._treePaneWidth) this._treePaneWidth = w;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(
        FilesView.TREE_PANE_WIDTH_KEY,
        String(this._treePaneWidth),
      );
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  /** 右 splitter：拖动 preview-col 左边缘。dx 负 = 变宽。
   *  动态上限 = 窗口宽 - tree 宽 - 中间栏最小 - splitters，避免挤掉中间栏。 */
  private _onPreviewSplitterMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this._previewPaneWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dynMax = typeof window !== "undefined"
        ? window.innerWidth - this._treePaneWidth - FilesView.MIDDLE_PANE_MIN - FilesView.SPLITTERS_TOTAL
        : FilesView.PREVIEW_PANE_WIDTH_MAX;
      const cap = Math.min(FilesView.PREVIEW_PANE_WIDTH_MAX, dynMax);
      const w = Math.max(
        FilesView.PREVIEW_PANE_WIDTH_MIN,
        Math.min(cap, startWidth - dx),
      );
      if (w !== this._previewPaneWidth) this._previewPaneWidth = w;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(
        FilesView.PREVIEW_PANE_WIDTH_KEY,
        String(this._previewPaneWidth),
      );
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  disconnectedCallback() {
    this._unsubscribe?.();
    if (this._toastTimer) clearTimeout(this._toastTimer);
    super.disconnectedCallback();
  }

  private get _state() { return store.getState().files; }

  private get _isMobile() {
    return typeof window !== "undefined" && window.innerWidth < 1024;
  }

  private async _ensureLoaded(path: string) {
    const { treeCache } = store.getState().files;
    if (path in treeCache) return;
    try {
      actions.setFilesState({ listing: true });
      const res = await filesApi.list(path);
      if (store.getState().files.treeCache !== treeCache) {
        // 期间 treeCache 已被其他请求替换，做 merge 而非覆盖
        const fresh = store.getState().files.treeCache;
        if (path in fresh) return;
        actions.setFilesState({
          treeCache: { ...fresh, [path]: res.entries },
          listing: false,
        });
        return;
      }
      actions.setFilesState({
        treeCache: { ...treeCache, [path]: res.entries },
        listing: false,
      });
    } catch (e: any) {
      actions.setFilesState({ listing: false, error: e?.message || "加载失败" });
      this._showToast(e?.message || "加载失败");
    }
  }

  updated() {
    // preview 由 _onFileListActivated 主动驱动，无需在 update 中被动触发
  }

  private _showToast(msg: string) {
    this._toast = msg;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this._toast = null; }, 3500);
  }

  private _onAction(e: CustomEvent<{ name: string }>) {
    const name = e.detail.name;
    if (name === "upload") {
      this._openFilePicker();
      return;
    }
    if (["mkdir", "rename", "move", "delete"].includes(name)) {
      if (name === "rename" && this._state.selectedPaths.length !== 1) return;
      if ((name === "move" || name === "delete") && this._state.selectedPaths.length === 0) return;
      this._dialog = name as DialogKind;
    }
  }

  private _openFilePicker() {
    if (!this._fileInput) {
      this._fileInput = document.createElement("input");
      this._fileInput.type = "file";
      this._fileInput.multiple = true;
      this._fileInput.style.display = "none";
      this._fileInput.addEventListener("change", () => {
        if (this._fileInput && this._fileInput.files && this._fileInput.files.length > 0) {
          this._uploadFiles(Array.from(this._fileInput.files), this._state.currentDir);
          this._fileInput.value = "";
        }
      });
      document.body.appendChild(this._fileInput);
    }
    this._fileInput.click();
  }

  private async _onMkdirSubmit(e: CustomEvent<{ path: string }>) {
    this._dialog = null;
    try {
      await filesApi.mkdir(e.detail.path);
      const parent = e.detail.path.includes("/")
        ? e.detail.path.slice(0, e.detail.path.lastIndexOf("/"))
        : "";
      actions.invalidateDir(parent);
      await this._ensureLoaded(parent);
      actions.expandDir(parent);
      this._showToast("目录已创建");
    } catch (e: any) {
      this._showToast(e?.message || "创建失败");
    }
  }

  private async _onRenameSubmit(e: CustomEvent<{ newName: string }>) {
    const path = this._state.selectedPaths[0];
    this._dialog = null;
    try {
      await filesApi.rename(path, e.detail.newName);
      actions.invalidateDir(this._state.currentDir);
      await this._ensureLoaded(this._state.currentDir);
      // 若重命名的是当前预览文件，更新 previewPath 并重载内容
      if (this._previewPath === path) {
        const newPath = path.includes("/")
          ? path.slice(0, path.lastIndexOf("/") + 1) + e.detail.newName
          : e.detail.newName;
        this._previewPath = newPath;
        void this._reloadPreview();
      }
      this._showToast("已重命名");
    } catch (e: any) {
      this._showToast(e?.message || "重命名失败");
    }
  }

  private async _onMoveSubmit(e: CustomEvent<{ destDir: string; overwrite: boolean }>) {
    const sel = [...this._state.selectedPaths];
    this._dialog = null;
    try {
      const res = await filesApi.move(sel, e.detail.destDir, e.detail.overwrite);
      const parents = new Set<string>();
      sel.forEach(p => {
        parents.add(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
      });
      parents.add(e.detail.destDir);
      parents.forEach(p => actions.invalidateDir(p));
      for (const p of parents) await this._ensureLoaded(p);
      actions.clearSelection();
      this._showToast(res.skipped.length
        ? `已移动 ${res.moved.length} 项，${res.skipped.length} 项跳过`
        : `已移动 ${res.moved.length} 项`);
    } catch (e: any) {
      this._showToast(e?.message || "移动失败");
    }
  }

  private async _onDeleteSubmit(e: CustomEvent<{ paths: string[] }>) {
    const paths = [...e.detail.paths];
    this._dialog = null;
    let deleted = 0;
    let failed = 0;
    for (const p of paths) {
      try {
        await filesApi.remove(p);
        deleted++;
        actions.invalidateSubtree(p);
        const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
        actions.invalidateDir(parent);
      } catch {
        failed++;
      }
    }
    const parents = new Set<string>();
    paths.forEach(p => parents.add(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""));
    for (const p of parents) await this._ensureLoaded(p);
    // 若删除了正在预览的文件，清空 preview state
    if (this._previewPath && paths.includes(this._previewPath)) {
      this._previewPath = "";
      this._previewContent = "";
      this._previewError = null;
      this._previewWritable = false;
      this._previewPages = null;
      this._previewDirty = false;
    }
    actions.clearSelection();
    this._showToast(failed
      ? `已删除 ${deleted}，失败 ${failed}`
      : `已删除 ${deleted} 项`);
  }

  private _onDropFiles(e: CustomEvent<{ files: File[]; destDir: string }>) {
    this._uploadFiles(e.detail.files, e.detail.destDir);
  }

  private async _uploadFiles(files: File[], destDir: string) {
    let ok = 0;
    let skipped = 0;
    let lastError = "";
    for (const f of files) {
      try {
        await filesApi.upload(f, destDir, false);
        ok++;
      } catch (e: any) {
        if (e?.code === "ALREADY_EXISTS") {
          skipped++;
        } else {
          lastError = e?.message || "上传失败";
        }
      }
    }
    actions.invalidateDir(destDir);
    await this._ensureLoaded(destDir);
    if (lastError && ok === 0) {
      this._showToast(lastError);
    } else {
      const parts = [`已上传 ${ok}`];
      if (skipped > 0) parts.push(`跳过 ${skipped}`);
      if (lastError) parts.push(`部分失败`);
      this._showToast(parts.join("，"));
    }
  }

  private _goBack() {
    const pane = this._state.mobilePane;
    if (pane === "detail") actions.setMobilePane("list");
    else if (pane === "list") actions.setMobilePane("tree");
  }

  private async _onFileListActivated(e: CustomEvent<{ path: string; is_dir: boolean }>) {
    if (e.detail.is_dir) {
      actions.selectDir(e.detail.path);
      await this._ensureLoaded(e.detail.path);
      return;
    }
    // 文件：dirty 检查后切换预览
    if (this._previewDirty) {
      const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
      if (!ok) return;
      this._discardPreviewEdits();
    }
    await this._fetchPreview(e.detail.path);
    if (this._isMobile) {
      actions.setMobilePane("detail");
    }
  }

  private async _fetchPreview(path: string) {
    const result = await fetchPreview(path);
    if (result.ok) {
      this._previewError = null;
      this._previewPath = result.path;
      this._previewContent = result.content;
      this._previewLanguage = result.language;
      this._previewWritable = result.writable;
      this._previewPages = result.pages;
    } else if (result.notIndexed) {
      this._previewError = "NOT_INDEXED";
      this._previewPath = path;
      this._previewContent = "";
      this._previewWritable = false;
      this._previewPages = null;
    } else {
      this._showToast(result.message || "预览失败");
    }
  }

  private async _reloadPreview() {
    if (!this._previewPath) return;
    const r = await fetchPreview(this._previewPath);
    if (r.ok) {
      this._previewContent = r.content;
      this._previewLanguage = r.language;
      this._previewWritable = r.writable;
      this._previewPages = r.pages;
    }
  }

  private _discardPreviewEdits() {
    const pp = this.shadowRoot?.querySelector("preview-pane") as any;
    pp?.discard?.();
    this._previewDirty = false;
  }

  private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>) => {
    this._previewDirty = e.detail.dirty;
  };

  private _onPreviewSaved = () => {
    this._previewDirty = false;
    this._showToast("已保存");
  };

  private _onPreviewSaveFailed = (e: CustomEvent<{ message: string }>) => {
    this._showToast(`保存失败：${e.detail.message}`);
  };

  private _onPreviewUploadSuccess = (e: CustomEvent<{ path: string }>) => {
    this._previewDirty = false;
    this._showToast(`已覆盖：${e.detail.path}`);
    void this._reloadPreview();
  };

  private _onPreviewUploadFailed = (e: CustomEvent<{ message: string }>) => {
    this._showToast(`上传失败：${e.detail.message}`);
  };

  private _renderNotIndexedHint() {
    return html`<div class="preview-placeholder">
      该文件未索引，无法预览。<br>
      请先执行 cortex index 后重试。
    </div>`;
  }

  private _renderPreviewPane(noHeader = false) {
    if (this._previewError === "NOT_INDEXED") {
      return this._renderNotIndexedHint();
    }
    if (!this._previewPath) {
      return html`<div class="preview-placeholder">点击文件预览</div>`;
    }
    return html`<preview-pane
      ?noHeader=${noHeader}
      path=${this._previewPath}
      language=${this._previewLanguage}
      content=${this._previewContent}
      ?writable=${this._previewWritable}
      .pages=${this._previewPages}
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}
    ></preview-pane>`;
  }

  private _cancelDialog = () => {
    this._dialog = null;
  };

  render() {
    return html`
      ${this._isMobile ? this._renderMobile() : this._renderDesktop()}
      ${this._renderDialogs()}
      <drop-zone .targetDir=${this._state.currentDir} @drop-files=${this._onDropFiles}></drop-zone>
      ${this._toast
        ? html`<div class="toast" @click=${() => this._toast = null}>${this._toast}</div>`
        : ""}
    `;
  }

  private _renderDesktop() {
    return html`
      <div
        class="desktop-layout"
        style="--tree-pane-width: ${this._treePaneWidth}px; --preview-pane-width: ${this._previewPaneWidth}px"
      >
        <file-tree></file-tree>
        <div
          class="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整文件树栏宽度"
          @mousedown=${this._onTreeSplitterMouseDown}
        ></div>
        <file-list
          .activePath=${this._previewPath}
          @action=${this._onAction}
          @activated=${this._onFileListActivated}
        ></file-list>
        <div
          class="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整预览栏宽度"
          @mousedown=${this._onPreviewSplitterMouseDown}
        ></div>
        <div class="preview-col">${this._renderPreviewPane(false)}</div>
      </div>
    `;
  }

  private _renderMobile() {
    const pane = this._state.mobilePane;
    return html`
      <div class="mobile-layout">
        ${pane !== "tree"
          ? html`<button class="back-btn" @click=${() => this._goBack()}>← 返回</button>`
          : ""}
        ${pane === "tree"
          ? html`<file-tree
              @select-dir=${async (e: CustomEvent<{ path: string }>) => {
                actions.selectDir(e.detail.path);
                await this._ensureLoaded(e.detail.path);
                actions.expandDir(e.detail.path);
                actions.setMobilePane("list");
              }}
            ></file-tree>`
          : ""}
        ${pane === "list"
          ? html`<file-list
              .activePath=${this._previewPath}
              @action=${this._onAction}
              @activated=${this._onFileListActivated}
            ></file-list>`
          : ""}
        ${pane === "detail"
          ? html`<div class="mobile-preview">${this._renderPreviewPane(true)}</div>`
          : ""}
      </div>
    `;
  }

  private _renderDialogs() {
    if (this._dialog === "mkdir") {
      return html`<dialog open>
        <mkdir-dialog
          @submit=${this._onMkdirSubmit}
          @cancel=${this._cancelDialog}
        ></mkdir-dialog>
      </dialog>`;
    }
    if (this._dialog === "rename") {
      const sel = this._state.selectedPaths[0] || "";
      const name = sel.split("/").pop() || "";
      return html`<dialog open>
        <rename-dialog
          .currentName=${name}
          @submit=${this._onRenameSubmit}
          @cancel=${this._cancelDialog}
        ></rename-dialog>
      </dialog>`;
    }
    if (this._dialog === "move") {
      return html`<dialog open>
        <move-dialog
          @submit=${this._onMoveSubmit}
          @cancel=${this._cancelDialog}
        ></move-dialog>
      </dialog>`;
    }
    if (this._dialog === "delete") {
      return html`<dialog open>
        <delete-dialog
          @submit=${this._onDeleteSubmit}
          @cancel=${this._cancelDialog}
        ></delete-dialog>
      </dialog>`;
    }
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap { "files-view": FilesView; }
}
