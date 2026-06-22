import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { store } from "../state/store";

@customElement("file-detail")
export class FileDetail extends LitElement {
  static styles = css`
    :host {
      display: flex; flex-direction: column;
      background: var(--cortex-surface);
      border-left: 1px solid var(--cortex-border);
      padding: var(--cortex-space-4);
      gap: var(--cortex-space-2);
      overflow-y: auto;
    }
    h2 {
      margin: 0 0 var(--cortex-space-2) 0;
      font-size: var(--cortex-fs-md);
      word-break: break-all;
    }
    .placeholder {
      color: var(--cortex-text-subtle);
      text-align: center;
      padding: var(--cortex-space-8) 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: var(--cortex-space-2) 0;
      border-bottom: 1px solid var(--cortex-border-muted);
      font-size: var(--cortex-fs-sm);
      gap: var(--cortex-space-3);
    }
    .row .k { color: var(--cortex-text-muted); flex-shrink: 0; }
    .row .v {
      font-family: var(--cortex-font-mono);
      word-break: break-all;
      text-align: right;
    }
    .actions {
      display: flex; flex-direction: column; gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    .actions button {
      padding: 8px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-base);
    }
    .actions button:hover { background: var(--cortex-surface-muted); }
    .actions button.danger { color: var(--cortex-danger); }
  `;

  private _unsubscribe?: () => void;
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

  private _fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  render() {
    const { selectedPaths, detail, detailLoading } = store.getState().files;

    if (selectedPaths.length === 0) {
      return html`<div class="placeholder">选择一个文件查看详情</div>`;
    }
    if (selectedPaths.length > 1) {
      return html`
        <div class="placeholder">
          <p><strong>${selectedPaths.length}</strong> 项已选中</p>
          <div class="actions">
            <button @click=${() => this._action("move")}>→ 移动…</button>
            <button class="danger" @click=${() => this._action("delete")}>🗑 删除…</button>
          </div>
        </div>
      `;
    }

    if (detailLoading || !detail) {
      return html`<div class="placeholder">${detailLoading ? "加载中…" : "选择一个文件查看详情"}</div>`;
    }
    const d = detail;
    return html`
      <h2>${d.is_dir ? "📁" : "📄"} ${d.name}</h2>
      <div class="row"><span class="k">路径</span><span class="v">${d.path}</span></div>
      <div class="row"><span class="k">大小</span><span class="v">${d.is_dir ? "—" : this._fmtSize(d.size)}</span></div>
      <div class="row"><span class="k">类型</span><span class="v">${d.extension || "—"}</span></div>
      <div class="row"><span class="k">修改</span><span class="v">${d.modified_at ? new Date(d.modified_at).toLocaleString() : "—"}</span></div>
      <div class="row"><span class="k">创建</span><span class="v">${d.created_at ? new Date(d.created_at).toLocaleString() : "—"}</span></div>
      <div class="row"><span class="k">可写</span><span class="v">${d.writable ? "是" : "否"}</span></div>
      ${d.is_dir ? "" : html`<div class="row"><span class="k">已索引</span><span class="v">${d.indexed ? "是" : "否"}</span></div>`}
      <div class="actions">
        ${!d.is_dir ? html`<button @click=${() => this._action("preview")}>👁 打开预览</button>` : ""}
        ${!d.is_dir ? html`<button @click=${() => this._action("download")}>⬇ 下载</button>` : ""}
        <button @click=${() => this._action("rename")}>✎ 重命名</button>
        <button @click=${() => this._action("move")}>→ 移动</button>
        <button class="danger" @click=${() => this._action("delete")}>🗑 删除</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-detail": FileDetail; }
}
