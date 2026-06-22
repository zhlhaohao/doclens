import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store } from "../state/store";
import "./tree-node";

@customElement("move-dialog")
export class MoveDialog extends LitElement {
  static styles = css`
    :host { display: block; min-width: 360px; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); }
    .tree {
      max-height: 320px; overflow-y: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-2);
      margin: var(--cortex-space-2) 0;
    }
    .selected {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin-bottom: var(--cortex-space-2);
    }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-primary);
      color: white;
      border-color: var(--cortex-primary);
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    label.opt {
      display: flex; gap: var(--cortex-space-2); align-items: center;
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-2) 0;
    }
  `;

  @state() private _dest = "";
  @state() private _overwrite = false;

  private get _selectedCount() {
    return store.getState().files.selectedPaths.length;
  }

  private _onPickDir(e: CustomEvent<{ path: string }>) {
    this._dest = e.detail.path;
  }

  private _onToggle(e: Event) {
    // 阻止冒泡到外层，但不阻止 tree-node 内部处理
    e.stopPropagation();
  }

  private _submit() {
    if (!this._dest) return;
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { destDir: this._dest, overwrite: this._overwrite },
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    const { treeCache, expandedPaths } = store.getState().files;
    const rootDirs = (treeCache[""] || []).filter((e: any) => e.is_dir);
    const expanded = new Set(expandedPaths);

    return html`
      <h3>移动 ${this._selectedCount} 个项目到</h3>
      <div class="tree">
        ${rootDirs.map((d: any) => html`
          <tree-node
            .entry=${d}
            .depth=${0}
            .readonly=${true}
            .expanded=${expanded.has(d.path)}
            .selected=${this._dest === d.path}
            .childEntries=${treeCache[d.path] || []}
            @pick-dir=${this._onPickDir}
            @toggle=${this._onToggle}
          ></tree-node>
        `)}
      </div>
      <div class="selected">目标：${this._dest || "（请选择）"}</div>
      <label class="opt">
        <input
          type="checkbox"
          .checked=${this._overwrite}
          @change=${(e: Event) => this._overwrite = (e.target as HTMLInputElement).checked}
        />
        覆盖同名
      </label>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button class="primary" ?disabled=${!this._dest} @click=${this._submit}>移动到这里</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "move-dialog": MoveDialog; }
}
