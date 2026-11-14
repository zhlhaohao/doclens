import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileEntry } from "../api/files";
import { getFileTypeBadge } from "../utils/file-type";

@customElement("file-row")
export class FileRow extends LitElement {
  static styles = css`
    :host { display: block; }
    /* 移动端：host 跟随 .row 的 max-content 宽（file-list :host overflow
       hidden 会裁 display:block 的 host），行底线/行点击区贯穿滑出列 */
    @media (max-width: 1023px) {
      :host { width: max-content; min-width: 100%; }
    }
    .row {
      display: grid;
      grid-template-columns:
        var(--col-1, 28px)
        var(--col-2, 28px)
        var(--col-3, 240px)
        var(--col-4, 80px)
        var(--col-5, 140px);
      gap: var(--cortex-space-2);
      align-items: center;
      padding: 6px var(--cortex-space-3);
      cursor: pointer;
      border-bottom: 1px solid var(--cortex-border-muted);
      transition: background 0.1s;
      font-size: var(--cortex-fs-sm);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active { background: var(--cortex-primary-soft); }
    .checkbox { display: flex; align-items: center; justify-content: center; }
    .checkbox input { accent-color: var(--cortex-primary); }
    .cell-icon { font-size: 16px; }
    /* 名称列可换行（用户决议 2026-10-10）：长文件名在列宽内折行完整展示，
       替代原 nowrap+ellipsis 截断；anywhere 兜底无空格长串（CJK/连字符名） */
    .name {
      white-space: normal;
      overflow-wrap: anywhere;
      min-width: 0;
      color: var(--cortex-text); font-size: var(--cortex-fs-sm);
    }
    /* 未索引文件：名称用 subtle 灰色区别（替代原"已索引"列徽标） */
    .name.unindexed { color: var(--cortex-text-subtle); }
    .size, .time, .cell-type {
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      text-align: center;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      font-size: var(--cortex-fs-xs);
      border-radius: var(--cortex-radius-sm);
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
    }
    .type-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-xs);
      font-weight: 700;
      line-height: 1;
      user-select: none;
      font-family: var(--cortex-font-mono);
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-muted);
    }
    /* 移动端（mobile 模式）：名称列宽由 --cortex-files-name-col 驱动
       （file-list willUpdate 注入：
       ≤430px 视口 = calc(100vw - 215px)——名称列在屏内完整显示、长名
       换行（.name white-space:normal），大小/修改列滑出屏外由横滚露出；
       430~1023px = 420px 固定——折叠屏展开，多余空间行尾留白，两列
       直接在屏内）。表头网格与此处逐像素一致（对齐事故见 2026-11-14）。 */
    @media (max-width: 1023px) {
      .row {
        grid-template-columns: 24px 20px var(--cortex-files-name-col, 420px) 67px 100px;
        gap: var(--cortex-space-1);
        padding: 6px var(--cortex-space-2);
        width: max-content;
        min-width: 100%;
        box-sizing: border-box;
      }
      .size { font-size: var(--cortex-fs-2xs, var(--cortex-fs-xs)); }
    }
  `;

  @property({ type: Object }) entry!: FileEntry;
  @property({ type: Boolean }) selected = false;
  /** 当前预览/焦点的文件行 —— 由行体单击触发，区别于 checkbox 的多选 */
  @property({ type: Boolean }) active = false;
  /** 外部浏览态（ADR-0049）：隐藏 checkbox 与索引徽标（外部恒只读未索引）。 */
  @property({ type: Boolean }) hideCheckbox = false;
  /** 移动端：时间列用短格式（MM-DD HH:mm），窄列不折行（file-list 传入）。 */
  @property({ type: Boolean }) mobile = false;

  private _fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  private _fmtTime(s: string): string {
    if (!s) return "";
    try {
      // 桌面端列宽充足用完整格式；移动端窄列（84px）用「MM-DD HH:mm」
      // ——完整 toLocaleString（~71px @12px）会在空格处折行成两行
      if (this.mobile) {
        const d = new Date(s);
        if (Number.isNaN(d.getTime())) return "";
        const p = (n: number) => String(n).padStart(2, "0");
        return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
      }
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
    const badge = getFileTypeBadge(this.entry.name, this.entry.is_dir);
    return html`
      <div
        class="row ${this.active ? "active" : ""}"
        @click=${this._onRowClick}>
        <span class="checkbox">
          ${this.hideCheckbox
            ? null
            : html`<input
                type="checkbox"
                .checked=${this.selected}
                @click=${this._onCheckboxClick}
              />`}
        </span>
        <span class="cell-icon">
          ${this.entry.is_dir
            ? html`<doclens-icon name="folder"></doclens-icon>`
            : badge
              ? html`<span class="type-badge"
                  style="background:${badge.bg};color:${badge.fg}">${badge.letter}</span>`
              : html`<doclens-icon name="file"></doclens-icon>`}
        </span>
        <span
          class="name ${!this.entry.is_dir && !this.entry.indexed && !this.entry.registered ? "unindexed" : ""}"
          title=${this.entry.is_dir
            ? ""
            : this.entry.indexed
              ? ""
              : this.entry.registered
                ? "已登记（文件名可搜索；内容不参与全文检索）"
                : "未索引（不参与搜索）"}
        >${this.entry.name}</span>
        <span class="size">${this.entry.is_dir ? "" : this._fmtSize(this.entry.size)}</span>
        <span class="time">${this._fmtTime(this.entry.modified_at)}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-row": FileRow; }
}