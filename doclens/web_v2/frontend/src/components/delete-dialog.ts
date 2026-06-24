import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store } from "../state/store";
import { filesApi } from "../api/files";

type Phase = "loading-stats" | "confirming" | "deleting";

@customElement("delete-dialog")
export class DeleteDialog extends LitElement {
  static styles = css`
    :host { display: block; min-width: 360px; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); word-break: break-all; }
    .warn {
      padding: var(--cortex-space-3);
      background: #FEF3C7;
      border: 1px solid #FCD34D;
      border-radius: var(--cortex-radius-md);
      color: #92400E;
      font-size: var(--cortex-fs-sm);
      margin-bottom: var(--cortex-space-3);
    }
    .stats {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      line-height: 1.6;
    }
    .stats ul { list-style: none; padding: 0; margin: var(--cortex-space-2) 0; }
    .stats li { padding: 2px 0; }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    button.danger {
      background: var(--cortex-danger);
      color: white;
      border-color: var(--cortex-danger);
    }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    label.opt {
      display: flex; gap: var(--cortex-space-2); align-items: center;
      padding: var(--cortex-space-2) 0;
      font-size: var(--cortex-fs-sm);
    }
    .spinner { color: var(--cortex-text-muted); padding: var(--cortex-space-4); text-align: center; }
  `;

  @state() private _phase: Phase = "confirming";
  @state() private _stats: { file_count: number; dir_count: number; total_size_bytes: number } | null = null;
  @state() private _confirmed = false;

  private get _selected() { return store.getState().files.selectedPaths; }

  connectedCallback() {
    super.connectedCallback();
    // 如果外部已经预设了 stats（测试或快速路径），跳过自动加载
    if (this._stats) return;
    if (this._selected.length > 0) {
      this._phase = "loading-stats";
      this._loadStats();
    }
  }

  private async _loadStats() {
    const sel = this._selected;
    let totalFiles = 0, totalDirs = 0, totalBytes = 0;
    for (const p of sel) {
      try {
        const s = await filesApi.stats(p);
        totalFiles += s.file_count;
        totalDirs += s.dir_count;
        totalBytes += s.total_size_bytes;
      } catch {
        // 单文件会 400 (INVALID_PATH: 不是目录)，忽略；用文件自身信息
      }
    }
    // 如果 stats 全为 0 但选中了文件，说明都是单文件
    if (totalFiles === 0 && totalDirs === 0) {
      totalFiles = sel.length;
    }
    this._stats = { file_count: totalFiles, dir_count: totalDirs, total_size_bytes: totalBytes };
    this._phase = "confirming";
  }

  private _fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  private _delete() {
    if (!this._confirmed) return;
    this._phase = "deleting";
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { paths: this._selected },
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    const count = this._selected.length;
    if (this._phase === "loading-stats") {
      return html`<div class="spinner">统计中…</div>`;
    }
    return html`
      <h3>删除 ${count > 1 ? `${count} 项` : this._selected[0]}？</h3>
      <div class="warn">⚠️ 此操作不可恢复</div>
      ${this._stats ? html`
        <div class="stats">
          将永久删除：
          <ul>
            <li>• ${this._stats.file_count} 个文件</li>
            ${this._stats.dir_count > 0 ? html`<li>• ${this._stats.dir_count} 个子文件夹</li>` : ""}
            ${this._stats.total_size_bytes > 0 ? html`<li>• 总计 ${this._fmtSize(this._stats.total_size_bytes)}</li>` : ""}
          </ul>
        </div>
      ` : html`<div class="stats">将永久删除 ${count} 个项目。</div>`}
      <label class="opt">
        <input
          type="checkbox"
          .checked=${this._confirmed}
          @change=${(e: Event) => this._confirmed = (e.target as HTMLInputElement).checked}
        />
        我确定要永久删除
      </label>
      <div class="actions">
        <button @click=${this._cancel}>取消</button>
        <button
          class="danger"
          ?disabled=${!this._confirmed || this._phase === "deleting"}
          @click=${this._delete}>
          ${this._phase === "deleting" ? "删除中…" : "永久删除"}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "delete-dialog": DeleteDialog; }
}
