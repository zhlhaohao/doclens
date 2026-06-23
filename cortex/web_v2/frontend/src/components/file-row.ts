import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileEntry } from "../api/files";

@customElement("file-row")
export class FileRow extends LitElement {
  static styles = css`
    :host { display: block; }
    .row {
      display: grid;
      grid-template-columns: 28px 20px 1fr 80px 140px 70px;
      gap: var(--cortex-space-2);
      align-items: center;
      padding: 6px var(--cortex-space-3);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active { background: var(--cortex-primary-soft); }
    .checkbox { display: flex; align-items: center; justify-content: center; }
    .icon { font-size: 14px; }
    .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .size, .time {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: 10px;
      border-radius: var(--cortex-radius-sm);
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
    }
  `;

  @property({ type: Object }) entry!: FileEntry;
  @property({ type: Boolean }) selected = false;
  /** 当前预览/焦点的文件行 —— 由行体单击触发，区别于 checkbox 的多选 */
  @property({ type: Boolean }) active = false;

  private _fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  private _fmtTime(s: string): string {
    if (!s) return "";
    try {
      return new Date(s).toLocaleString(undefined, {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return ""; }
  }

  /** 行体单击 = 激活（文件夹=进入；文件=预览） */
  private _onRowClick() {
    this.dispatchEvent(new CustomEvent("activated", {
      detail: { path: this.entry.path, is_dir: this.entry.is_dir },
      bubbles: true, composed: true,
    }));
  }

  /** 复选框单击 = 多选（不触发 activated） */
  private _onCheckboxClick(e: MouseEvent) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("checked", {
      detail: {
        path: this.entry.path,
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
      },
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <div
        class="row ${this.active ? "active" : ""}"
        @click=${this._onRowClick}>
        <span class="checkbox">
          <input
            type="checkbox"
            .checked=${this.selected}
            @click=${this._onCheckboxClick}
          />
        </span>
        <span class="icon">${this.entry.is_dir ? "📁" : "📄"}</span>
        <span class="name">${this.entry.name}</span>
        <span class="size">${this.entry.is_dir ? "" : this._fmtSize(this.entry.size)}</span>
        <span class="time">${this._fmtTime(this.entry.modified_at)}</span>
        <span>${!this.entry.is_dir && this.entry.indexed ? html`<span class="badge">已索引</span>` : ""}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-row": FileRow; }
}
