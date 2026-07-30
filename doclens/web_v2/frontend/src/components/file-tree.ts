import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { store, actions } from "../state/store";
import { filesApi } from "../api/files";
import type { FileEntry } from "../api/files";
import "./tree-node";

@customElement("file-tree")
export class FileTree extends LitElement {
  static styles = css`
    :host {
      display: flex; flex-direction: column;
      background: var(--cortex-surface);
      border-right: 1px solid var(--cortex-border);
      overflow-y: auto;
    }
    .header {
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: sticky; top: 0;
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border-muted);
      z-index: 1;
    }
  `;

  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._ensureLoaded("");
    actions.expandDir("");
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private async _ensureLoaded(path: string) {
    const { treeCache } = store.getState().files;
    if (path in treeCache) return;
    try {
      actions.setFilesState({ listing: true });
      const res = await filesApi.list(path);
      actions.setFilesState({
        treeCache: { ...store.getState().files.treeCache, [path]: res.entries },
        listing: false,
      });
    } catch (e: any) {
      actions.setFilesState({ listing: false, error: e?.message || "加载失败" });
    }
  }

  private _onToggle = async (e: CustomEvent<{ path: string }>) => {
    const path = e.detail.path;
    const { expandedPaths } = store.getState().files;
    if (expandedPaths.includes(path)) {
      actions.collapseDir(path);
    } else {
      await this._ensureLoaded(path);
      actions.expandDir(path);
    }
  };

  private _onSelectDir = async (e: CustomEvent<{ path: string }>) => {
    actions.selectDir(e.detail.path);
    await this._ensureLoaded(e.detail.path);
    actions.expandDir(e.detail.path);
  };

  render() {
    const { treeCache, expandedPaths, currentDir } = store.getState().files;
    const rootEntries = treeCache[""] || [];
    const expanded = new Set(expandedPaths);
    // 根节点：取工作目录名（回退"根目录"），点击 selectDir("") 回到根目录文件列表。
    const workdir = store.getState().status?.workdir;
    const rootName = (workdir?.replace(/[\\/]+/g, "/").split("/").filter(Boolean).pop()) || "根目录";
    const rootEntry: FileEntry = {
      name: rootName,
      path: "",
      is_dir: true,
      has_child_dirs: rootEntries.some(e => e.is_dir),
      size: 0,
      modified_at: "",
      indexed: false,
      writable: false,
    };

    return html`
      <div class="header">文件</div>
      <tree-node
        .entry=${rootEntry}
        .depth=${0}
        .expanded=${expanded.has("")}
        .selected=${currentDir === ""}
        .childEntries=${rootEntries}
        .loading=""
        @toggle=${this._onToggle}
        @select-dir=${this._onSelectDir}
      ></tree-node>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-tree": FileTree; }
}
