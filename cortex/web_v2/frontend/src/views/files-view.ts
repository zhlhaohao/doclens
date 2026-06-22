import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store, actions } from "../state/store";
import { filesApi } from "../api/files";
import "../components/file-tree";
import "../components/file-list";
import "../components/file-detail";
import "../components/mkdir-dialog";
import "../components/rename-dialog";
import "../components/move-dialog";
import "../components/delete-dialog";
import "../components/drop-zone";

type DialogKind = "mkdir" | "rename" | "move" | "delete" | null;

@customElement("files-view")
export class FilesView extends LitElement {
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
      grid-template-columns: 240px 1fr 320px;
      min-height: 0;
    }
    .mobile-layout {
      flex: 1; min-height: 0; position: relative;
    }
    .mobile-layout file-tree,
    .mobile-layout file-list,
    .mobile-layout file-detail {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
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
  private _lastSelectedSig = "";

  private _unsubscribe?: () => void;
  private _fileInput: HTMLInputElement | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._ensureLoaded("");
  }

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

  private async _maybeLoadDetail() {
    const sel = this._state.selectedPaths;
    const sig = sel.join(",");
    if (sig === this._lastSelectedSig) return;
    this._lastSelectedSig = sig;

    if (sel.length !== 1) {
      if (this._state.detail !== null) {
        actions.setFilesState({ detail: null });
      }
      return;
    }
    actions.setFilesState({ detailLoading: true });
    try {
      const attrs = await filesApi.attrs(sel[0]);
      // 期间若 selection 已变，丢弃结果
      if (store.getState().files.selectedPaths.join(",") !== sig) return;
      actions.setFilesState({ detail: attrs as any, detailLoading: false });
    } catch (e: any) {
      actions.setFilesState({ detailLoading: false });
    }
  }

  updated() {
    // 每次 update 都检查 detail 是否需要刷新
    this._maybeLoadDetail();
  }

  private _showToast(msg: string) {
    this._toast = msg;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this._toast = null; }, 3500);
  }

  private _onAction(e: CustomEvent<{ name: string }>) {
    const name = e.detail.name;
    if (name === "preview" || name === "download") {
      const path = this._state.selectedPaths[0];
      if (path) {
        window.open(`/api/preview/download?path=${encodeURIComponent(path)}`, "_blank");
      }
      return;
    }
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
      <div class="desktop-layout">
        <file-tree></file-tree>
        <file-list @action=${this._onAction}></file-list>
        <file-detail @action=${this._onAction}></file-detail>
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
          ? html`<file-list @action=${this._onAction}
              @activated=${(e: CustomEvent<{ path: string; is_dir: boolean }>) => {
                if (!e.detail.is_dir) actions.setMobilePane("detail");
              }}
            ></file-list>`
          : ""}
        ${pane === "detail"
          ? html`<file-detail @action=${this._onAction}></file-detail>`
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
