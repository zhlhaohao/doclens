import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileEntry } from "../api/files";
import { store } from "../state/store";

@customElement("tree-node")
export class TreeNode extends LitElement {
  static styles = css`
    :host { display: block; }
    .row {
      display: flex; align-items: center; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3); cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-sm); color: var(--cortex-text);
      user-select: none;
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.selected { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .arrow {
      width: 16px; height: 16px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--cortex-text-subtle); transition: transform 0.15s;
      font-size: 14px;
    }
    .arrow.expanded { transform: rotate(90deg); }
    .arrow.leaf { visibility: hidden; }
    .icon { font-size: 16px; }
    .label {
      flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm);
    }
    .children { padding-left: 16px; }
  `;

  @property({ type: Object }) entry!: FileEntry;
  @property({ type: Number }) depth = 0;
  @property({ type: Boolean }) expanded = false;
  @property({ type: Boolean }) selected = false;
  @property({ type: Boolean }) readonly = false;
  @property({ type: Array }) childEntries: FileEntry[] = [];
  @property({ type: String }) loading = "";

  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    // 订阅 store：expandedPaths / currentDir / treeCache 变化时重渲染，
    // 让递归子节点的展开/选中/子项状态实时反映 store。
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private _onClick() {
    if (this.readonly) {
      this.dispatchEvent(new CustomEvent("pick-dir", {
        detail: { path: this.entry.path },
        bubbles: true, composed: true,
      }));
    } else {
      this.dispatchEvent(new CustomEvent("select-dir", {
        detail: { path: this.entry.path },
        bubbles: true, composed: true,
      }));
    }
  }

  private _toggle(e: Event) {
    e.stopPropagation();
    if (!this.entry.has_child_dirs) return;
    this.dispatchEvent(new CustomEvent("toggle", {
      detail: { path: this.entry.path },
      bubbles: true, composed: true,
    }));
  }

  render() {
    const { treeCache, expandedPaths, currentDir } = store.getState().files;
    const expanded = new Set(expandedPaths);
    return html`
      <div class="row ${this.selected ? "selected" : ""}" @click=${this._onClick}>
        <span
          class="arrow ${this.expanded ? "expanded" : ""} ${this.entry.has_child_dirs ? "" : "leaf"}"
          @click=${this._toggle}><doclens-icon name="chevron-right"></doclens-icon></span>
        <doclens-icon class="icon" name=${this.entry.is_dir ? "folder" : "file"}></doclens-icon>
        <span class="label">${this.entry.name}</span>
      </div>
      ${this.expanded && this.entry.is_dir ? html`
        <div class="children">
          ${this.loading && this.loading === this.entry.path
            ? html`<div style="padding: 4px 8px; color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm);">加载中…</div>`
            : this.childEntries.filter(c => c.is_dir).map(c => html`
              <tree-node
                .entry=${c}
                .depth=${this.depth + 1}
                .expanded=${expanded.has(c.path)}
                .selected=${c.path === currentDir}
                .childEntries=${treeCache[c.path] || []}
                .readonly=${this.readonly}
                @select-dir=${(e: Event) => this._relay("select-dir", e)}
                @toggle=${(e: Event) => this._relay("toggle", e)}
                @pick-dir=${(e: Event) => this._relay("pick-dir", e)}
              ></tree-node>
            `)}
        </div>
      ` : ""}
    `;
  }

  private _relay(name: string, e: Event) {
    e.stopPropagation();
    const detail = (e as CustomEvent).detail;
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap { "tree-node": TreeNode; }
}
