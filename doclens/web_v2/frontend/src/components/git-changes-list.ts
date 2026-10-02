/**
 * <git-changes-list> —— 未提交改动列表（中间栏改动模式，CONTEXT.md 2026-10-01）。
 *
 * 自取数（/api/git/changes）+ 自刷新（手动按钮 + 宿主经 refresh() 顺带触发，
 * 如 Git Sync 轮次 SSE 的 last_sync_at 变化）。排序：新增组在前、其余按路径
 * 字典序（Q12 决议，本地排不依赖后端顺序）。点击行 → activated 事件由宿主
 * （files-view）在预览栏加载 Unified Diff。纯只读——无丢弃/stage/unstage。
 */
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { gitApi } from "../api/git";
import type { GitChange } from "../api/git";
import "../components/icon";
import "./diff-viewer";

const KIND_LABEL: Record<string, string> = {
  added: "新增",
  modified: "修改",
  deleted: "删除",
};
const STAGING_LABEL: Record<string, string> = {
  untracked: "未跟踪",
  staged: "已暂存",
  unstaged: "未暂存",
  both: "两层",
};

/** Q12 决议排序：新增在前，组内路径字典序。 */
export function sortChanges(changes: GitChange[]): GitChange[] {
  const collator = new Intl.Collator("zh", { numeric: true, sensitivity: "base" });
  return [...changes].sort((a, b) => {
    const aAdd = a.kind === "added" ? 0 : 1;
    const bAdd = b.kind === "added" ? 0 : 1;
    if (aAdd !== bAdd) return aAdd - bAdd;
    return collator.compare(a.path, b.path);
  });
}

function formatSize(size: number | null): string {
  if (size === null) return "—";
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}

@customElement("git-changes-list")
export class GitChangesList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-surface);
      font-family: var(--cortex-font);
    }
    .changes-header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    .changes-header .title {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .changes-header .back {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
    }
    .changes-header .count {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
    }
    .changes-header button {
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
    .changes-header button:hover:not(:disabled) {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    .changes-header button:disabled { opacity: 0.4; cursor: not-allowed; }
    .rows {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      cursor: pointer;
      border-bottom: 1px solid var(--cortex-border-muted);
      transition: background 0.12s;
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active { background: var(--cortex-primary-soft); }
    .badge {
      flex-shrink: 0;
      font-size: var(--cortex-fs-xs);
      padding: 1px 8px;
      border-radius: var(--cortex-radius-pill);
      border: 1px solid var(--cortex-border);
      white-space: nowrap;
    }
    .badge.added { color: #3fb950; border-color: color-mix(in srgb, #3fb950 45%, transparent); }
    .badge.modified { color: var(--cortex-primary); border-color: color-mix(in srgb, var(--cortex-primary) 45%, transparent); }
    .badge.deleted { color: #f85149; border-color: color-mix(in srgb, #f85149 45%, transparent); }
    .path {
      flex: 1;
      min-width: 0;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .path .dir {
      color: var(--cortex-text-subtle);
    }
    .staging {
      flex-shrink: 0;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      white-space: nowrap;
    }
    .size {
      flex-shrink: 0;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      white-space: nowrap;
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

  /** 当前选中（预览 diff）的路径 —— 该行加 active 高亮。 */
  @property() activePath = "";

  @state() private _changes: GitChange[] | null = null;
  @state() private _error: string | null = null;
  @state() private _loading = false;

  connectedCallback() {
    super.connectedCallback();
    void this.refresh();
  }

  /** 返回按钮：退出改动模式（files-view 监听 @exit）。 */
  private _onExitClick = () => {
    this.dispatchEvent(new CustomEvent("exit", {
      bubbles: true, composed: true,
    }));
  };

  /** 重新拉取改动列表（进模式拉取 / 手动刷新 / 同步轮次顺带重拉的统一入口）。 */
  async refresh(): Promise<void> {
    this._loading = true;
    this._error = null;
    try {
      const res = await gitApi.changes();
      this._changes = sortChanges(res.changes);
    } catch (e: any) {
      this._error = e?.message || "改动列表加载失败";
      this._changes = null;
    } finally {
      this._loading = false;
    }
  }

  private _onRowClick = (path: string) => {
    this.dispatchEvent(new CustomEvent("activated", {
      detail: { path },
      bubbles: true, composed: true,
    }));
  };

  private _splitPath(path: string): { dir: string; name: string } {
    const i = path.lastIndexOf("/");
    return i >= 0
      ? { dir: path.slice(0, i + 1), name: path.slice(i + 1) }
      : { dir: "", name: path };
  }

  render() {
    return html`
      <div class="changes-header">
        <button
          class="back"
          type="button"
          title="返回文件列表"
          aria-label="返回文件列表"
          @click=${this._onExitClick}
        ><doclens-icon name="arrow-left"></doclens-icon></button>
        <span class="title">未提交改动</span>
        ${this._changes !== null
          ? html`<span class="count">${this._changes.length}</span>`
          : null}
        <button
          type="button"
          title="重新获取改动列表"
          ?disabled=${this._loading}
          @click=${() => void this.refresh()}
        ><doclens-icon name="refresh-cw"></doclens-icon>${this._loading ? "获取中…" : "刷新"}</button>
      </div>
      ${this._error
        ? html`<div class="error">${this._error}</div>`
        : this._loading && this._changes === null
          ? html`<div class="empty">获取改动列表…</div>`
          : this._changes !== null && this._changes.length === 0
            ? html`<div class="empty">
                工作区干净<br>
                <span style="font-size: var(--cortex-fs-sm)">所有改动均已提交</span>
              </div>`
            : html`<div class="rows">
                ${(this._changes ?? []).map((c) => {
                  const { dir, name } = this._splitPath(c.path);
                  return html`
                    <div
                      class="row ${c.path === this.activePath ? "active" : ""}"
                      @click=${() => this._onRowClick(c.path)}
                      title=${c.path}
                    >
                      <span class="badge ${c.kind}">${KIND_LABEL[c.kind] ?? c.kind}</span>
                      <span class="path">${dir
                        ? html`<span class="dir">${dir}</span>${name}`
                        : name}</span>
                      <span class="staging">${STAGING_LABEL[c.staging] ?? ""}</span>
                      <span class="size">${formatSize(c.kind === "deleted" ? c.old_size : c.size)}</span>
                    </div>`;
                })}
              </div>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "git-changes-list": GitChangesList; }
}
