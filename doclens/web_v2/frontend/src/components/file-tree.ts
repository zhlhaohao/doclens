import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { store, actions } from "../state/store";
import { filesApi } from "../api/files";
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
      padding: var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
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

    return html`
      <div class="header">文件</div>
      ${rootEntries.filter(e => e.is_dir).map(e => html`
        <tree-node
          .entry=${e}
          .depth=${0}
          .expanded=${expanded.has(e.path)}
          .selected=${e.path === currentDir}
          .childEntries=${treeCache[e.path] || []}
          .loading=""
          @toggle=${this._onToggle}
          @select-dir=${this._onSelectDir}
        ></tree-node>
      `)}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-tree": FileTree; }
}
