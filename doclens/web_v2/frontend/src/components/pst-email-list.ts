import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { fetchPstEmails } from "../api/pst";
import type { PstEmailItem } from "../api/pst";
import "./pagination-bar";

/** 会话级页位置缓存：从邮件预览返回列表时恢复离开时的页码
 * （组件随预览切换销毁/重建，不缓存会退回第 1 页）。 */
const _offsetCache = new Map<string, number>();

/**
 * <pst-email-list> —— PST 物理文件的预览：分页邮件表格（取代旧 md 目录页）。
 *
 * Props:
 *   - pstPath: PST 相对路径（xxx.pst，非派生路径）
 *
 * Events:
 *   - open-email: { path: "<pst>#<entry_id>" } —— 点击某行，父组件打开邮件预览
 */
@customElement("pst-email-list")
export class PstEmailList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-card-bg);
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: baseline;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .header .name {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header .meta {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      white-space: nowrap;
    }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      font-family: inherit;
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-1) var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .back-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
      border-color: var(--cortex-text-subtle);
    }
    .table-wrap {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
    }
    thead th {
      position: sticky;
      top: 0;
      background: var(--cortex-card-bg);
      text-align: left;
      font-weight: 500;
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      white-space: nowrap;
    }
    tbody td {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 0;
    }
    tbody tr {
      cursor: pointer;
      transition: background 0.12s;
    }
    tbody tr:hover {
      background: var(--cortex-surface-muted);
    }
    /* 列宽：主题弹性，其余按内容收缩 */
    .col-subject { width: 45%; }
    .col-sender { width: 25%; }
    .col-date { width: 17%; }
    .col-folder { width: 13%; }
    td.col-date, td.col-folder {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
    }
    .state {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      padding: var(--cortex-space-4);
      text-align: center;
    }
    .state.error {
      color: var(--cortex-text-muted);
    }
    pagination-bar {
      flex-shrink: 0;
    }
  `;

  @property() pstPath = "";
  /** 显示返回按钮（移动端 detail pane 用，点击冒泡 back 事件由父组件导航）。 */
  @property({ type: Boolean }) showBack = false;

  @state() private _emails: PstEmailItem[] = [];
  @state() private _total = 0;
  @state() private _offset = 0;
  @state() private _loading = false;
  @state() private _error: string | null = null;

  private _limit = 50;

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("pstPath")) {
      // 恢复离开时的页位置（首次访问默认第 1 页）
      this._offset = _offsetCache.get(this.pstPath) ?? 0;
      void this._load();
    }
  }

  private async _load() {
    if (!this.pstPath) return;
    this._loading = true;
    this._error = null;
    const result = await fetchPstEmails(this.pstPath, this._offset, this._limit);
    // 竞态防护：加载期间 pstPath 又变了，丢弃过期响应
    if (result.ok && result.path !== this.pstPath) return;
    if (result.ok) {
      this._emails = result.emails;
      this._total = result.total;
    } else {
      this._emails = [];
      this._total = 0;
      this._error = result.notIndexed
        ? "该 PST 尚未索引，请先执行 doclens index。"
        : result.message || "加载失败";
    }
    this._loading = false;
  }

  private _onPageChange = (e: CustomEvent<{ page: number }>) => {
    this._offset = (e.detail.page - 1) * this._limit;
    _offsetCache.set(this.pstPath, this._offset);
    void this._load();
  };

  private _onBackClick = () => {
    this.dispatchEvent(new CustomEvent("back", {
      bubbles: true,
      composed: true,
    }));
  };

  private _onRowClick(email: PstEmailItem) {
    this.dispatchEvent(
      new CustomEvent("open-email", {
        detail: { path: `${this.pstPath}#${email.entry_id}` },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _basename(p: string): string {
    const i = p.lastIndexOf("/");
    return i >= 0 ? p.slice(i + 1) : p;
  }

  render() {
    if (this._loading && this._emails.length === 0) {
      return html`<div class="state">加载中...</div>`;
    }
    if (this._error) {
      return html`<div class="state error">${this._error}</div>`;
    }
    return html`
      <div class="header">
        ${this.showBack
          ? html`<button class="back-btn" @click=${this._onBackClick}><doclens-icon name="arrow-left"></doclens-icon>返回</button>`
          : null}
        <span class="name" title=${this.pstPath}>${this._basename(this.pstPath)}</span>
        <span class="meta">共 ${this._total} 封邮件</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-subject">主题</th>
              <th class="col-sender">发件人</th>
              <th class="col-date">日期</th>
              <th class="col-folder">文件夹</th>
            </tr>
          </thead>
          <tbody>
            ${this._emails.map(
              (m) => html`
                <tr @click=${() => this._onRowClick(m)}>
                  <td class="col-subject" title=${m.subject}>${m.subject}</td>
                  <td class="col-sender" title=${m.sender}>${m.sender}</td>
                  <td class="col-date" title=${m.date}>${m.date}</td>
                  <td class="col-folder" title=${m.folder}>${m.folder}</td>
                </tr>
              `,
            )}
          </tbody>
        </table>
      </div>
      <pagination-bar
        .total=${this._total}
        .offset=${this._offset}
        .limit=${this._limit}
        ?disabled=${this._loading}
        @page-change=${this._onPageChange}>
      </pagination-bar>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pst-email-list": PstEmailList;
  }
}
