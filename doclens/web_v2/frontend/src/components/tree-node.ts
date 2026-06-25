import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileEntry } from "../api/files";

@customElement("tree-node")
export class TreeNode extends LitElement {
  static styles = css`
    :host { display: block; }
    .row {
      display: flex; align-items: center; gap: var(--cortex-space-1);
      padding: 4px 8px; cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base); color: var(--cortex-text);
      user-select: none;
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.selected { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .arrow {
      width: 16px; height: 16px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--cortex-text-subtle); transition: transform 0.1s;
      font-size: 10px;
    }
    .arrow.expanded { transform: rotate(90deg); }
    .arrow.leaf { visibility: hidden; }
    .icon { font-size: 14px; }
    .label { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .children { padding-left: 16px; }
  `;

  @property({ type: Object }) entry!: FileEntry;
  @property({ type: Number }) depth = 0;
  @property({ type: Boolean }) expanded = false;
  @property({ type: Boolean }) selected = false;
  @property({ type: Boolean }) readonly = false;
  @property({ type: Array }) childEntries: FileEntry[] = [];
  @property({ type: String }) loading = "";

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
    return html`
      <div class="row ${this.selected ? "selected" : ""}" @click=${this._onClick}>
        <span
          class="arrow ${this.expanded ? "expanded" : ""} ${this.entry.has_child_dirs ? "" : "leaf"}"
          @click=${this._toggle}>▶</span>
        <span class="icon">${this.entry.is_dir ? "📁" : "📄"}</span>
        <span class="label">${this.entry.name}</span>
      </div>
      ${this.expanded && this.entry.is_dir ? html`
        <div class="children">
          ${this.loading === this.entry.path
            ? html`<div style="padding: 4px 8px; color: var(--cortex-text-subtle); font-size: var(--cortex-fs-sm);">加载中…</div>`
            : this.childEntries.filter(c => c.is_dir).map(c => html`
              <tree-node
                .entry=${c}
                .depth=${this.depth + 1}
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
