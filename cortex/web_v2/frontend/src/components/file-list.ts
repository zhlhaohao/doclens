import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { store, actions } from "../state/store";
import "./file-row";

@customElement("file-list")
export class FileList extends LitElement {
  static styles = css`
    :host {
      display: flex; flex-direction: column; flex: 1; min-height: 0;
      background: var(--cortex-surface);
    }
    .breadcrumb {
      display: flex; align-items: center; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .breadcrumb .path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .up-btn {
      padding: 2px 8px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      line-height: 1.4;
    }
    .up-btn:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .up-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar {
      display: flex; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .toolbar button {
      padding: 6px 12px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
    }
    .toolbar button:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar button.danger { color: var(--cortex-danger); }
    .header-row {
      display: grid;
      grid-template-columns: 28px 28px 1fr 80px 140px 70px 80px;
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    @media (max-width: 1023px) {
      .header-row { grid-template-columns: 28px 28px 1fr 80px 140px 70px; }
      .header-row .cell-type { display: none; }
    }
    .select-all { display: flex; align-items: center; justify-content: center; }
    .header-row .cell-type { color: var(--cortex-text-muted); font-size: var(--cortex-fs-sm); }
    .rows { flex: 1; overflow-y: auto; }
    .empty {
      padding: var(--cortex-space-8);
      text-align: center;
      color: var(--cortex-text-subtle);
    }
  `;

  private _unsubscribe?: () => void;

  /** 当前预览/焦点文件路径 —— 该行会加 active 高亮（区别于 checkbox 多选） */
  @property() activePath = "";

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private _action(name: string) {
    this.dispatchEvent(new CustomEvent("action", {
      detail: { name },
      bubbles: true, composed: true,
    }));
  }

  private _onRowChecked(e: CustomEvent<{ path: string; ctrl: boolean; shift: boolean }>) {
    actions.selectEntry(e.detail.path, { ctrl: e.detail.ctrl, shift: e.detail.shift });
  }

  private _onSelectAll(e: Event) {
    const cb = e.target as HTMLInputElement;
    const { currentDir, treeCache, selectedPaths } = store.getState().files;
    const entries = treeCache[currentDir] || [];
    if (cb.checked) {
      const all = entries.map(en => en.path);
      const merged = Array.from(new Set([...selectedPaths, ...all]));
      actions.setFilesState({ selectedPaths: merged });
    } else {
      const inDir = new Set(entries.map(en => en.path));
      actions.setFilesState({
        selectedPaths: selectedPaths.filter(p => !inDir.has(p)),
      });
    }
  }

  private _goUp() {
    const { currentDir } = store.getState().files;
    if (currentDir === "") return;
    const parent = currentDir.includes("/")
      ? currentDir.slice(0, currentDir.lastIndexOf("/"))
      : "";
    actions.selectDir(parent);
  }

  render() {
    const { currentDir, treeCache, selectedPaths } = store.getState().files;
    const entries = treeCache[currentDir] || [];
    const sel = new Set(selectedPaths);
    const canRename = selectedPaths.length === 1;
    const canAct = selectedPaths.length >= 1;
    const canGoUp = currentDir !== "";
    const breadcrumb = currentDir === "" ? "/" : `/${currentDir}/`;
    const allSelected = entries.length > 0 && entries.every(e => sel.has(e.path));

    return html`
      <div class="breadcrumb">
        <button
          class="up-btn"
          title="返回上一级目录"
          ?disabled=${!canGoUp}
          @click=${this._goUp}
        >↑</button>
        <span class="path">${breadcrumb}</span>
      </div>
      <div class="toolbar">
        <button data-action="mkdir" @click=${() => this._action("mkdir")}>+ 新目录</button>
        <button data-action="upload" @click=${() => this._action("upload")}>⬆ 上传</button>
        <button data-action="rename" ?disabled=${!canRename} @click=${() => this._action("rename")}>✎ 重命名</button>
        <button data-action="move" ?disabled=${!canAct} @click=${() => this._action("move")}>→ 移动</button>
        <button data-action="delete" ?disabled=${!canAct} class="danger" @click=${() => this._action("delete")}>🗑 删除</button>
      </div>
      ${entries.length === 0
        ? html`<div class="empty">目录为空</div>`
        : html`<div class="header-row">
            <span class="select-all">
              <input
                type="checkbox"
                .checked=${allSelected}
                @click=${this._onSelectAll}
              />
            </span>
            <span></span>
            <span>名称</span>
            <span style="text-align:right;">大小</span>
            <span style="text-align:right;">修改</span>
            <span></span>
            <span class="cell-type">类型</span>
          </div>`}
      <div class="rows">
        ${entries.map(e => html`
          <file-row
            .entry=${e}
            .selected=${sel.has(e.path)}
            .active=${e.path === this.activePath}
            @checked=${this._onRowChecked}
          ></file-row>`)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-list": FileList; }
}
