import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { store, actions } from "../state/store";
import type { IndexedDocument } from "../state/types";

const MAX_RESULTS = 100;

/** 把命中片段用 <mark> 包起来；大小写不敏感，连续子串。 */
function highlight(name: string, query: string): unknown {
  if (!query) return name;
  const lower = name.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return name;
  return [
    name.slice(0, idx),
    html`<mark>${name.slice(idx, idx + q.length)}</mark>`,
    name.slice(idx + q.length),
  ];
}

/** 从 path 中提取所在目录（不含文件名）。 */
function dirOf(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i + 1);
}

function formatSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatRelative(s: string): string {
  if (!s) return "";
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const day = 24 * 3600 * 1000;
  if (diffMs < day) return "今天";
  if (diffMs < 2 * day) return "昨天";
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} 天前`;
  if (diffMs < 30 * day) return `${Math.floor(diffMs / (7 * day))} 周前`;
  if (diffMs < 365 * day) return `${Math.floor(diffMs / (30 * day))} 个月前`;
  return `${Math.floor(diffMs / (365 * day))} 年前`;
}

@customElement("file-search-results")
export class FileSearchResults extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      min-width: 0;
      background: var(--cortex-card-bg);
      overflow: hidden;
    }
    .header-bar {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      background: var(--cortex-card-bg);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      font-size: var(--cortex-fs-xs);
      font-weight: 500;
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .rows {
      flex: 1;
      overflow-y: auto;
    }
    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--cortex-space-2);
      align-items: center;
      padding: var(--cortex-space-2) var(--cortex-space-3);
      cursor: pointer;
      border-bottom: 1px solid var(--cortex-border-muted);
      font-size: var(--cortex-fs-sm);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active { background: var(--cortex-primary-soft); }
    .name-cell {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      min-width: 0;
    }
    .icon { flex-shrink: 0; }
    .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--cortex-text);
    }
    .dir {
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .meta {
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    mark {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    .empty {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--cortex-space-8) var(--cortex-space-4);
      color: var(--cortex-text-subtle);
      text-align: center;
      gap: var(--cortex-space-2);
    }
    .empty .icon-big { font-size: 32px; opacity: 0.5; }
    .overflow-hint {
      padding: var(--cortex-space-2) var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-xs);
      text-align: center;
      border-top: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
  `;

  private get _state() {
    return store.getState().files.filenameSearch;
  }

  private _onRowClick(doc: IndexedDocument) {
    actions.selectFilenameSearchResult(doc.path);
    this.dispatchEvent(new CustomEvent("activated", {
      detail: { path: doc.path },
      bubbles: true,
      composed: true,
    }));
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    const { results, selectedPath } = this._state;
    if (results.length === 0) {
      if (e.key === "Escape") {
        this.dispatchEvent(new CustomEvent("clear", { bubbles: true, composed: true }));
      }
      return;
    }
    const idx = results.findIndex(r => r.path === selectedPath);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = results[Math.min(results.length - 1, idx + 1)];
      actions.selectFilenameSearchResult(next.path);
      this.dispatchEvent(new CustomEvent("activated", {
        detail: { path: next.path },
        bubbles: true,
        composed: true,
      }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = results[Math.max(0, idx - 1)];
      actions.selectFilenameSearchResult(prev.path);
      this.dispatchEvent(new CustomEvent("activated", {
        detail: { path: prev.path },
        bubbles: true,
        composed: true,
      }));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cur = results[idx] ?? results[0];
      if (cur) {
        this.dispatchEvent(new CustomEvent("activated", {
          detail: { path: cur.path },
          bubbles: true,
          composed: true,
        }));
      }
    } else if (e.key === "Escape") {
      this.dispatchEvent(new CustomEvent("clear", { bubbles: true, composed: true }));
    }
  };

  private _unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.tabIndex = 0;
    this.addEventListener("keydown", this._onKeyDown);
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this._onKeyDown);
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  render() {
    const { query, results, selectedPath, totalMatches } = this._state;
    if (results.length === 0) {
      return html`
        <div class="empty">
          <doclens-icon class="icon-big" name="search"></doclens-icon>
          <div>未匹配到任何文件名包含 "<b>${query}</b>" 的文档</div>
        </div>
      `;
    }
    return html`
      <div class="header-bar"><doclens-icon name="file"></doclens-icon> 文件名搜索结果 · 共 ${totalMatches} 项</div>
      <div class="columns">
        <span>名称 · 目录</span>
        <span>大小 · 修改</span>
      </div>
      <div class="rows">
        ${results.map(doc => {
          const dir = dirOf(doc.path);
          const isActive = doc.path === selectedPath;
          return html`
            <div
              class="row ${isActive ? "active" : ""}"
              @click=${() => this._onRowClick(doc)}
            >
              <span class="name-cell">
                <doclens-icon class="icon" name="file"></doclens-icon>
                <span class="name">${highlight(doc.name, query)}</span>
                ${dir ? html`<span class="dir">${dir}</span>` : ""}
              </span>
              <span class="meta">${formatSize(doc.size)} · ${formatRelative(doc.modifiedAt)}</span>
            </div>
          `;
        })}
      </div>
      ${totalMatches > results.length
        ? html`<div class="overflow-hint">共 ${totalMatches} 项，仅显示前 ${MAX_RESULTS}，请补充关键字</div>`
        : ""}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-search-results": FileSearchResults; }
}
