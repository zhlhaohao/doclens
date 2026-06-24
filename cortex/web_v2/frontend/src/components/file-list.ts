import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { store, actions } from "../state/store";
import "./file-row";

const DEFAULT_COL_WIDTHS = [28, 28, 240, 80, 140, 70, 80] as const;
const COL_MINS = [20, 20, 80, 50, 80, 50, 50];
const COL_MAXS = [60, 60, 800, 200, 300, 150, 200];
const COL_COUNT = DEFAULT_COL_WIDTHS.length;
const COL_WIDTHS_KEY = "cortex.files.colWidths";

@customElement("file-list")
export class FileList extends LitElement {
  static styles = css`
    :host {
      display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0;
      background: var(--cortex-surface);
      overflow: hidden;
    }
    .breadcrumb {
      display: flex; align-items: center; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .breadcrumb .path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .up-btn {
      padding: 2px 8px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
      line-height: 1.4;
    }
    .up-btn:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .up-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar {
      display: flex; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .toolbar button {
      padding: 6px 12px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-sm);
    }
    .toolbar button:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar button.danger { color: var(--cortex-danger); }
    .header-row {
      display: grid;
      grid-template-columns:
        var(--col-1, 28px)
        var(--col-2, 28px)
        var(--col-3, 240px)
        var(--col-4, 80px)
        var(--col-5, 140px)
        var(--col-6, 70px)
        var(--col-7, 80px);
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    @media (max-width: 1023px) {
      .header-row {
        grid-template-columns:
          var(--col-1, 28px)
          var(--col-2, 28px)
          var(--col-3, 240px)
          var(--col-4, 80px)
          var(--col-5, 140px)
          var(--col-6, 70px);
      }
      .header-row .cell-type { display: none; }
      .col-resize { display: none !important; }
    }
    .header-row > span { position: relative; }
    .col-resize {
      position: absolute;
      top: 0;
      right: -4px;
      width: 8px;
      height: 100%;
      cursor: col-resize;
      z-index: 1;
      user-select: none;
      background: transparent;
    }
    .col-resize::before {
      content: "";
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 1px;
      height: 100%;
      background: linear-gradient(
        to bottom,
        var(--cortex-primary-soft),
        var(--cortex-primary)
      );
      transition: background 0.15s;
    }
    .col-resize:hover::before,
    .col-resize:active::before {
      background: var(--cortex-primary);
    }
    .select-all { display: flex; align-items: center; justify-content: center; }
    .header-row .cell-size,
    .header-row .cell-time,
    .header-row .cell-indexed,
    .header-row .cell-type {
      text-align: center;
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
    }
    .rows { flex: 1; overflow-y: auto; }
    .empty {
      padding: var(--cortex-space-8);
      text-align: center;
      color: var(--cortex-text-subtle);
    }
  `;

  private _unsubscribe?: () => void;

  /** 当前预览/焦点文件路径 —— 该行会加 active 高亮（区别于 checkbox 多选） */
  @property() activePath = "";

  /** 各列宽度（px），通过 --col-N CSS var 注入到 host，file-row 经继承读取 */
  @state() private _colWidths: number[] = [...DEFAULT_COL_WIDTHS];

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._loadColWidths();
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  willUpdate(): void {
    // 把列宽注入到 :host 的 CSS 变量，子树（含 file-row 的 shadow DOM）继承读取
    for (let i = 0; i < COL_COUNT; i++) {
      this.style.setProperty(`--col-${i + 1}`, `${this._colWidths[i]}px`);
    }
  }

  private _loadColWidths() {
    const saved = localStorage.getItem(COL_WIDTHS_KEY);
    if (!saved) return;
    try {
      const arr = JSON.parse(saved);
      if (
        Array.isArray(arr) &&
        arr.length === COL_COUNT &&
        arr.every((n) => typeof n === "number" && Number.isFinite(n))
      ) {
        this._colWidths = arr.map((n, i) =>
          Math.max(COL_MINS[i], Math.min(COL_MAXS[i], n)),
        );
      }
    } catch {
      /* 损坏的 localStorage 值，忽略 */
    }
  }

  /** 在第 idx（0-indexed）列右边缘按下鼠标 → 拖动调整该列宽度 */
  private _makeColResizeHandler = (idx: number) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = this._colWidths[idx];
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const w = Math.max(
        COL_MINS[idx],
        Math.min(COL_MAXS[idx], startWidth + dx),
      );
      const next = [...this._colWidths];
      next[idx] = w;
      this._colWidths = next;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(this._colWidths));
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  private _action(name: string) {
    this.dispatchEvent(new CustomEvent("action", {
      detail: { name },
      bubbles: true, composed: true,
    }));
  }

  private _onRowChecked(e: CustomEvent<{ path: string; ctrl: boolean; shift: boolean }>) {
    actions.selectEntry(e.detail.path, { ctrl: e.detail.ctrl, shift: e.detail.shift });
  }

  private _onSelectAll(e: Event) {
    const cb = e.target as HTMLInputElement;
    const { currentDir, treeCache, selectedPaths } = store.getState().files;
    const entries = treeCache[currentDir] || [];
    if (cb.checked) {
      const all = entries.map(en => en.path);
      const merged = Array.from(new Set([...selectedPaths, ...all]));
      actions.setFilesState({ selectedPaths: merged });
    } else {
      const inDir = new Set(entries.map(en => en.path));
      actions.setFilesState({
        selectedPaths: selectedPaths.filter(p => !inDir.has(p)),
      });
    }
  }

  private _goUp() {
    const { currentDir } = store.getState().files;
    if (currentDir === "") return;
    const parent = currentDir.includes("/")
      ? currentDir.slice(0, currentDir.lastIndexOf("/"))
      : "";
    actions.selectDir(parent);
  }

  render() {
    const { currentDir, treeCache, selectedPaths } = store.getState().files;
    const entries = treeCache[currentDir] || [];
    const sel = new Set(selectedPaths);
    const canRename = selectedPaths.length === 1;
    const canAct = selectedPaths.length >= 1;
    const canGoUp = currentDir !== "";
    const breadcrumb = currentDir === "" ? "/" : `/${currentDir}/`;
    const allSelected = entries.length > 0 && entries.every(e => sel.has(e.path));

    return html`
      <div class="breadcrumb">
        <button
          class="up-btn"
          title="返回上一级目录"
          ?disabled=${!canGoUp}
          @click=${this._goUp}
        >↑</button>
        <span class="path">${breadcrumb}</span>
      </div>
      <div class="toolbar">
        <button data-action="mkdir" @click=${() => this._action("mkdir")}>+ 新目录</button>
        <button data-action="upload" @click=${() => this._action("upload")}>⬆ 上传</button>
        <button data-action="rename" ?disabled=${!canRename} @click=${() => this._action("rename")}>✎ 重命名</button>
        <button data-action="move" ?disabled=${!canAct} @click=${() => this._action("move")}>→ 移动</button>
        <button data-action="delete" ?disabled=${!canAct} class="danger" @click=${() => this._action("delete")}>🗑 删除</button>
      </div>
      ${entries.length === 0
        ? html`<div class="empty">目录为空</div>`
        : html`<div class="header-row">
            <span class="select-all">
              <input
                type="checkbox"
                .checked=${allSelected}
                @click=${this._onSelectAll}
              />
            </span>
            <span></span>
            <span>名称<span
                class="col-resize"
                title="拖动调整列宽"
                @mousedown=${this._makeColResizeHandler(2)}
              ></span></span>
            <span class="cell-size">大小<span
                class="col-resize"
                title="拖动调整列宽"
                @mousedown=${this._makeColResizeHandler(3)}
              ></span></span>
            <span class="cell-time">修改<span
                class="col-resize"
                title="拖动调整列宽"
                @mousedown=${this._makeColResizeHandler(4)}
              ></span></span>
            <span class="cell-indexed"><span
                class="col-resize"
                title="拖动调整列宽"
                @mousedown=${this._makeColResizeHandler(5)}
              ></span></span>
            <span class="cell-type">类型</span>
          </div>`}
      <div class="rows">
        ${entries.map(e => html`
          <file-row
            .entry=${e}
            .selected=${sel.has(e.path)}
            .active=${e.path === this.activePath}
            @checked=${this._onRowChecked}
          ></file-row>`)}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "file-list": FileList; }
}
