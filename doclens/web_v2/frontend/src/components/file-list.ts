import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { store, actions } from "../state/store";
import "./file-row";

const DEFAULT_COL_WIDTHS = [28, 28, 240, 80, 140] as const;
const COL_MINS = [20, 20, 80, 50, 80];
const COL_MAXS = [60, 60, 800, 200, 300];
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
      padding: var(--cortex-space-2) var(--cortex-space-4);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .breadcrumb .path {
      flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
    .up-btn {
      padding: 2px 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      line-height: 1.4;
    }
    .up-btn:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .up-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .toolbar {
      display: flex; gap: var(--cortex-space-2);
      padding: var(--cortex-space-2) var(--cortex-space-4);
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
      flex-wrap: wrap;
    }
    .toolbar button {
      position: relative;
      padding: 6px 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--cortex-fs-sm);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
    }
    .toolbar button:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-text-subtle);
    }
    .toolbar button:disabled { opacity: 0.4; cursor: not-allowed; }
    /* 上传中：图标换成旋转圆环动画（"上传中"感知，无进度通道的补偿 UX）；
       min-width 锚定原 1em 图标宽度，避免替换时按钮抖动 */
    .toolbar button.uploading { opacity: 1; }
    .toolbar button.uploading::after { min-width: 1em; }
    .toolbar button.uploading doclens-icon { display: none; }
    .toolbar button.uploading::after {
      content: "";
      width: 12px;
      height: 12px;
      border: 2px solid var(--cortex-border);
      border-top-color: var(--cortex-primary);
      border-radius: 50%;
      animation: cortex-upload-spin 0.8s linear infinite;
    }
    @keyframes cortex-upload-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .toolbar button.uploading::after { animation: none; }
    }
    .toolbar button.danger { color: var(--cortex-danger); }
    .toolbar button.danger:hover:not(:disabled) {
      background: rgba(220, 38, 38, 0.06);
      border-color: var(--cortex-danger);
    }
    /* 桌面省空间：按钮只显图标，文字在 hover 时以 tooltip 浮现（上方，
       覆盖面包屑区域，z-index 保证在上），不撑宽按钮、无布局抖动 */
    .toolbar button .btn-label {
      display: none;
    }
    .toolbar button:hover:not(:disabled) .btn-label {
      display: block;
      position: absolute;
      bottom: calc(100% + 5px);
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      background: var(--cortex-text);
      color: var(--cortex-surface);
      font-size: var(--cortex-fs-xs);
      line-height: 1.4;
      padding: 2px 10px;
      border-radius: var(--cortex-radius-pill);
      z-index: 20;
      pointer-events: none;
    }
    .mobile-header {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 8px 10px;
      border-bottom: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      flex-shrink: 0;
      position: relative;
    }
    .mobile-header .mobile-back,
    .mobile-header .mobile-more {
      border: none;
      background: transparent;
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 0;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .mobile-header .mobile-back:hover,
    .mobile-header .mobile-more:hover {
      background: var(--cortex-surface-muted);
    }
    .mobile-header .mobile-path {
      flex: 1;
      min-width: 0;
      text-align: center;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mobile-header .mobile-menu {
      position: absolute;
      top: 100%;
      right: var(--cortex-space-2);
      min-width: 160px;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-shadow-lg);
      z-index: 10;
      padding: 4px 0;
    }
    .mobile-header .mobile-menu button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      color: var(--cortex-text);
      font-family: inherit;
      font-size: var(--cortex-fs-sm);
      padding: 10px 14px;
      cursor: pointer;
    }
    .mobile-header .mobile-menu button:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
    }
    .mobile-header .mobile-menu button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    /* 上传中：菜单项图标换旋转圆环 + 文案（移动端主路径，App 内上传入口） */
    .mobile-header .mobile-menu button.uploading { opacity: 1; }
    .mobile-header .mobile-menu button.uploading doclens-icon { display: none; }
    .mobile-header .mobile-menu button.uploading::before {
      content: "";
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      border: 2px solid var(--cortex-border);
      border-top-color: var(--cortex-primary);
      border-radius: 50%;
      animation: cortex-upload-spin 0.8s linear infinite;
    }
    .mobile-header .mobile-menu button.danger { color: var(--cortex-danger); }
    .header-row {
      display: grid;
      grid-template-columns:
        var(--col-1, 28px)
        var(--col-2, 28px)
        var(--col-3, 240px)
        var(--col-4, 80px)
        var(--col-5, 140px);
      gap: var(--cortex-space-2);
      padding: 6px var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      font-size: var(--cortex-fs-xs);
      font-weight: 500;
      color: var(--cortex-text-muted);
      border-bottom: 1px solid var(--cortex-border);
      flex-shrink: 0;
    }
    @media (max-width: 1023px) {
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
      /* 2026-08-17 决议：竖线不再 100vh 贯穿整个列表（会从模态 dialog 旁
         穿出、列表区视觉突兀），仅表头行高内可见作列分隔指示；
         pointer-events:none 让视觉线不拦截行点击（拖动热区仍是 col-resize 主体） */
      height: 100%;
      background: var(--cortex-border-muted);
      transition: background 0.15s;
      pointer-events: none;
    }
    .col-resize:hover::before,
    .col-resize:active::before {
      background: var(--cortex-text-muted);
    }
    .select-all { display: flex; align-items: center; justify-content: center; }
    .header-row .cell-size,
    .header-row .cell-time,
    .header-row .cell-type {
      text-align: center;
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
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

  /** 移动端启用顶部 bar（返回 / 路径 / more 下拉）。 */
  @property({ type: Boolean }) mobile = false;

  /** 上传进行中（App 内 jsbridge 通道）——禁用上传入口防重复触发 */
  @property({ type: Boolean }) uploading = false;

  /** 各列宽度（px），通过 --col-N CSS var 注入到 host，file-row 经继承读取 */
  @state() private _colWidths: number[] = [...DEFAULT_COL_WIDTHS];
  @state() private _showMobileMenu = false;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._loadColWidths();
    // 点击 outside 关闭 more 下拉
    document.addEventListener("click", this._onDocClick, true);
  }
  disconnectedCallback() {
    this._unsubscribe?.();
    document.removeEventListener("click", this._onDocClick, true);
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
    // 默认 checkbox 单击 = toggle（累积多选）；shift 保留范围选择语义
    const { path, shift } = e.detail;
    actions.selectEntry(path, { ctrl: !shift, shift });
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

  /** 移动端返回按钮。父组件监听 @back 自行决定如何导航。 */
  private _onMobileBackClick = () => {
    this._showMobileMenu = false;
    this.dispatchEvent(new CustomEvent("back", {
      bubbles: true,
      composed: true,
    }));
  };

  private _onMobileMoreClick = (e: Event) => {
    e.stopPropagation();
    this._showMobileMenu = !this._showMobileMenu;
  };

  private _onDocClick = (e: MouseEvent) => {
    if (!this._showMobileMenu) return;
    const path = e.composedPath();
    // 仅在点击 menu 自身或 more 按钮时不关闭；其它位置（含 shadow 内的
    // header-row、rows）一律关闭。原先 path.includes(this) 太宽。
    const menu = this.shadowRoot?.querySelector(".mobile-menu");
    const more = this.shadowRoot?.querySelector(".mobile-more");
    if (menu && path.includes(menu)) return;
    if (more && path.includes(more)) return;
    this._showMobileMenu = false;
  };

  private _onMenuItemClick = (name: string) => (e: Event) => {
    e.stopPropagation();
    this._showMobileMenu = false;
    this._action(name);
  };

  private _renderMobileHeader() {
    const { currentDir, selectedPaths } = store.getState().files;
    const canRename = selectedPaths.length === 1;
    const canAct = selectedPaths.length >= 1;
    const breadcrumb = currentDir === "" ? "/" : `/${currentDir}/`;

    return html`
      <div class="mobile-header">
        <button
          class="mobile-back"
          type="button"
          aria-label="返回"
          @click=${this._onMobileBackClick}
        ><doclens-icon name="arrow-left"></doclens-icon></button>
        <span class="mobile-path" title=${breadcrumb}>${breadcrumb}</span>
        <button
          class="mobile-more"
          type="button"
          aria-label="更多操作"
          @click=${this._onMobileMoreClick}
        ><doclens-icon name="more-horizontal"></doclens-icon></button>
        ${this._showMobileMenu
          ? html`
              <div class="mobile-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  data-action="mkdir"
                  @click=${this._onMenuItemClick("mkdir")}
                ><doclens-icon name="folder-plus"></doclens-icon>新目录</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="upload"
                  class=${this.uploading ? "uploading" : ""}
                  ?disabled=${this.uploading}
                  @click=${this._onMenuItemClick("upload")}
                >${this.uploading ? "上传中…" : html`<doclens-icon name="upload"></doclens-icon>上传`}</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="rename"
                  ?disabled=${!canRename}
                  @click=${this._onMenuItemClick("rename")}
                ><doclens-icon name="pencil"></doclens-icon>重命名</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="move"
                  ?disabled=${!canAct}
                  @click=${this._onMenuItemClick("move")}
                ><doclens-icon name="arrow-right"></doclens-icon>移动</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="skill-toolbox"
                  ?disabled=${!canAct}
                  @click=${this._onMenuItemClick("skill-toolbox")}
                ><doclens-icon name="sparkles"></doclens-icon>技能工具箱</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="copy-path"
                  ?disabled=${!canAct}
                  @click=${this._onMenuItemClick("copy-path")}
                ><doclens-icon name="copy"></doclens-icon>拷贝路径</button>
                <button
                  type="button"
                  role="menuitem"
                  data-action="delete"
                  ?disabled=${!canAct}
                  class="danger"
                  @click=${this._onMenuItemClick("delete")}
                ><doclens-icon name="trash-2"></doclens-icon>删除</button>
              </div>
            `
          : null}
      </div>
    `;
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

    if (this.mobile) {
      return html`
        ${this._renderMobileHeader()}
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
              <span>名称</span>
              <span class="cell-size">大小</span>
              <span class="cell-time">修改</span>
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

    return html`
      <div class="breadcrumb">
        <button
          class="up-btn"
          title="返回上一级目录"
          ?disabled=${!canGoUp}
          @click=${this._goUp}
        ><doclens-icon name="arrow-up"></doclens-icon></button>
        <span class="path">${breadcrumb}</span>
      </div>
      <div class="toolbar">
        <button data-action="mkdir" @click=${() => this._action("mkdir")}><doclens-icon name="folder-plus"></doclens-icon><span class="btn-label">新目录</span></button>
        <button data-action="upload" class=${this.uploading ? "uploading" : ""} ?disabled=${this.uploading} @click=${() => this._action("upload")}>${this.uploading ? html`<span class="btn-label">上传中</span>` : html`<doclens-icon name="upload"></doclens-icon><span class="btn-label">上传</span>`}</button>
        <button data-action="rename" ?disabled=${!canRename} @click=${() => this._action("rename")}><doclens-icon name="pencil"></doclens-icon><span class="btn-label">重命名</span></button>
        <button data-action="move" ?disabled=${!canAct} @click=${() => this._action("move")}><doclens-icon name="arrow-right"></doclens-icon><span class="btn-label">移动</span></button>
        <button data-action="copy-path" ?disabled=${!canAct} title="复制选中项的路径（多选时每行一个）" @click=${() => this._action("copy-path")}><doclens-icon name="copy"></doclens-icon><span class="btn-label">拷贝路径</span></button>
        <button data-action="skill-toolbox" ?disabled=${!canAct} title="对选中文件运行技能（AI 对话）" @click=${() => this._action("skill-toolbox")}><doclens-icon name="sparkles"></doclens-icon><span class="btn-label">技能工具箱</span></button>
        <button data-action="delete" ?disabled=${!canAct} class="danger" @click=${() => this._action("delete")}><doclens-icon name="trash-2"></doclens-icon><span class="btn-label">删除</span></button>
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
