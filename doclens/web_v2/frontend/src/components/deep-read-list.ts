/**
 * <deep-read-list> —— 深读面板书目列表（中间栏深读模式，ADR-0041）。
 *
 * 自取数（GET /api/skills/books，生成时间倒序）+ 手动刷新。行点击 →
 * activated 事件（宿主 files-view 跳 chat 新建技能会话直发开场白）；
 * 行内删除钮 → delete 事件（宿主弹确认后调 DELETE /api/skills/{name}）。
 * 深读技能从四个用户调用面全隐，本面板是唯一入口。
 */
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { fetchBookSkills, type BookSkillItem } from "../api/skills";
import "../components/icon";

function formatDate(sec: number | null): string {
  if (sec === null) return "";
  const d = new Date(sec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

@customElement("deep-read-list")
export class DeepReadList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
      font-family: var(--cortex-font);
    }
    .header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    .header .title {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header .back {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
    }
    .header .count {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
    }
    .header button {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-1);
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-sm);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }
    .header button:hover:not(:disabled) {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .header button:disabled { opacity: 0.4; cursor: not-allowed; }
    .rows {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      cursor: pointer;
      border-bottom: 1px solid var(--cortex-border-muted);
      transition: background 0.12s;
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row .book-icon {
      flex-shrink: 0;
      color: var(--cortex-primary);
      display: inline-flex;
    }
    .row .main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .row .title {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .date {
      flex-shrink: 0;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      white-space: nowrap;
    }
    .row .del {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--cortex-text-subtle);
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
    }
    .row .del:hover {
      color: var(--cortex-danger, #f85149);
      background: color-mix(in srgb, var(--cortex-danger, #f85149) 10%, transparent);
    }
    .empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-8);
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-base);
      text-align: center;
    }
    .error {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--cortex-space-8);
      color: var(--cortex-danger, #f85149);
      font-size: var(--cortex-fs-base);
      text-align: center;
    }
  `;

  @state() private _books: BookSkillItem[] | null = null;
  @state() private _error: string | null = null;
  @state() private _loading = false;

  connectedCallback() {
    super.connectedCallback();
    void this.refresh();
  }

  /** 返回按钮：退出深读模式（files-view 监听 @exit）。 */
  private _onExitClick = () => {
    this.dispatchEvent(new CustomEvent("exit", { bubbles: true, composed: true }));
  };

  /** 重新拉取书目（进模式拉取 / 手动刷新 / 删除后的统一入口）。 */
  async refresh(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      this._books = await fetchBookSkills();
    } catch (e: any) {
      this._error = e?.message || "书目加载失败";
      this._books = null;
    } finally {
      this._loading = false;
    }
  }

  private _onRowClick = (book: BookSkillItem) => {
    this.dispatchEvent(new CustomEvent("activated", {
      detail: { book },
      bubbles: true, composed: true,
    }));
  };

  private _onDeleteClick = (e: Event, book: BookSkillItem) => {
    e.stopPropagation(); // 不触发行点击（跳 chat）
    this.dispatchEvent(new CustomEvent("delete", {
      detail: { book },
      bubbles: true, composed: true,
    }));
  };

  render() {
    return html`
      <div class="header">
        <button
          class="back"
          type="button"
          title="返回文件列表"
          aria-label="返回文件列表"
          @click=${this._onExitClick}
        ><doclens-icon name="arrow-left"></doclens-icon></button>
        <span class="title">深读书目</span>
        ${this._books !== null
          ? html`<span class="count">${this._books.length}</span>`
          : null}
        <button
          type="button"
          title="重新获取书目"
          ?disabled=${this._loading}
          @click=${() => void this.refresh()}
        ><doclens-icon name="refresh-cw"></doclens-icon>${this._loading ? "获取中…" : "刷新"}</button>
      </div>
      ${this._error
        ? html`<div class="error">${this._error}</div>`
        : this._loading && this._books === null
          ? html`<div class="empty">获取书目…</div>`
          : this._books !== null && this._books.length === 0
            ? html`<div class="empty">
                还没有深读书目<br>
                <span style="font-size: var(--cortex-fs-sm)">在对话中发送 /deep-read 生成第一本</span>
              </div>`
            : html`<div class="rows">
                ${(this._books ?? []).map((b) => html`
                  <div
                    class="row"
                    @click=${() => this._onRowClick(b)}
                    title=${b.description || b.title}
                  >
                    <span class="book-icon"><doclens-icon name=${b.icon || "book-open"}></doclens-icon></span>
                    <span class="main">
                      <span class="title">${b.title}</span>
                      ${b.description
                        ? html`<span class="desc">${b.description}</span>`
                        : null}
                    </span>
                    ${b.created_at !== null
                      ? html`<span class="date">${formatDate(b.created_at)}</span>`
                      : null}
                    <button
                      class="del"
                      type="button"
                      title="删除此深读技能"
                      aria-label="删除 ${b.title}"
                      @click=${(e: Event) => this._onDeleteClick(e, b)}
                    ><doclens-icon name="trash-2"></doclens-icon></button>
                  </div>`)}
              </div>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "deep-read-list": DeepReadList; }
}
