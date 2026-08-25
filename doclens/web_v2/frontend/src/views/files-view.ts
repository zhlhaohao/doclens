import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { store, actions } from "../state/store";
import { filesApi } from "../api/files";
import { fetchPreview } from "../api/preview";
import type { PageMarker, PstAttachmentInfo } from "../api/preview";
import { isPstFilePath, isPstEmailPath } from "../api/pst";
import "../components/pst-email-list";
import "../components/file-tree";
import "../components/file-list";
import "../components/preview-pane";
import "../components/mkdir-dialog";
import "../components/rename-dialog";
import "../components/reparse-dialog";
import "../components/move-dialog";
import "../components/delete-dialog";
import "../components/skill-toolbox-dialog";
import "../components/skill-run-dialog";
import type { SkillInfo } from "../api/skills";
import "../components/drop-zone";
import "../components/file-search-box";
import "../components/file-search-results";
import { fetchDocuments } from "../api/documents";
import { jsbridgeUploadAvailable, pickAndUploadFiles } from "../utils/jsbridge";
import { router } from "../router/router";

type DialogKind = "mkdir" | "rename" | "move" | "delete" | "reparse" | "skill-toolbox" | "skill-run" | null;

@customElement("files-view")
export class FilesView extends LitElement {
  static readonly TREE_PANE_WIDTH_KEY = "cortex.files.treePaneWidth";
  static readonly TREE_PANE_WIDTH_DEFAULT = 240;
  static readonly TREE_PANE_WIDTH_MIN = 180;
  static readonly TREE_PANE_WIDTH_MAX = 720;

  static readonly PREVIEW_PANE_WIDTH_KEY = "cortex.files.previewPaneWidth";
  static readonly PREVIEW_PANE_WIDTH_DEFAULT = 320;
  static readonly PREVIEW_PANE_WIDTH_MIN = 240;
  static readonly PREVIEW_PANE_WIDTH_MAX = 1600;

  /** file-list（中间栏）最小宽度，用于动态限制 splitter 拖动 */
  static readonly MIDDLE_PANE_MIN = 300;
  /** 两个 splitter 的总宽度 */
  static readonly SPLITTERS_TOTAL = 8;

  static styles = css`
    :host {
      display: flex; flex-direction: column;
      flex: 1; min-height: 0;
      background: var(--cortex-bg);
      font-family: var(--cortex-font);
    }
    .desktop-layout {
      flex: 1;
      display: grid;
      grid-template-columns:
        var(--tree-pane-width, 240px)
        4px
        /* 中间栏（file-list）硬性最小宽度：与 JS 拖动上限 MIDDLE_PANE_MIN(300) 对齐，
           防止恢复的两侧栏宽在窄窗口把中间列压没 */
        minmax(300px, 1fr)
        4px
        var(--preview-pane-width, 320px);
      min-height: 0;
      min-width: 0;
    }
    .splitter {
      cursor: col-resize;
      background: var(--cortex-border-muted);
      transition: background 0.15s;
      min-height: 0;
    }
    .splitter:hover, .splitter:active { background: var(--cortex-primary); }
    .tree-pane {
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }
    .tree-pane file-tree {
      flex: 1;
      min-height: 0;
    }
    .mobile-layout {
      /* display:flex 让子元素(file-tree/file-list/.mobile-preview)的
         flex:1 生效，提供明确高度链。缺少这个会导致 .mobile-preview
         高度塌陷（因为 block 容器内 flex:1 无效），进而让 preview-pane
         内的 md-viewer（flex:1 1 0）塌陷为 0，预览内容不可见。 */
      display: flex; flex-direction: column;
      flex: 1; min-height: 0; position: relative;
    }
    .mobile-layout file-tree,
    .mobile-layout file-list,
    .mobile-layout file-search-results,
    .mobile-layout .mobile-preview {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }
    .preview-col {
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: var(--cortex-surface);
      border-left: 1px solid var(--cortex-border);
      overflow: hidden;
    }
    .preview-placeholder {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--cortex-space-8);
      margin: var(--cortex-space-3);
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-lg);
      color: var(--cortex-text-subtle);
      text-align: center;
      font-size: var(--cortex-fs-base);
    }
    .mobile-preview {
      flex: 1; min-height: 0; display: flex; flex-direction: column;
    }
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      /* border-box：移动端 width:100vw 时边框不额外撑出屏幕 */
      box-sizing: border-box;
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 360px;
      max-width: 90vw;
    }
    @media (max-width: 1023px) {
      dialog {
        min-width: 0;
        /* 移动端对话框占满屏幕宽度（2026-08-17 决议） */
        width: 100vw;
        max-width: 100vw;
        max-height: calc(100vh - 16px);
        border-radius: var(--cortex-radius-md);
      }
      dialog > * { padding: var(--cortex-space-4); }
    }
    dialog::backdrop { background: rgba(0,0,0,0.3); }
    dialog > * { display: block; padding: var(--cortex-space-6); }
    .toast {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      background: var(--cortex-text);
      color: var(--cortex-surface);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-sm);
      box-shadow: var(--cortex-shadow-lg);
      z-index: 10000;
      cursor: pointer;
    }
    /* 上传中：屏幕中心遮罩（大转圈 + 文案），两条上传路径共用 */
    .upload-overlay {
      position: fixed; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: var(--cortex-space-4);
      background: color-mix(in srgb, var(--cortex-bg) 72%, transparent);
      backdrop-filter: blur(2px);
      z-index: 9999;
    }
    .upload-overlay .ring {
      width: 40px; height: 40px;
      border: 4px solid var(--cortex-border);
      border-top-color: var(--cortex-primary);
      border-radius: 50%;
      animation: cortex-upload-overlay-spin 0.8s linear infinite;
    }
    .upload-overlay .label {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
    @keyframes cortex-upload-overlay-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) {
      .upload-overlay .ring { animation: none; }
    }
    .back-btn {
      position: absolute; top: var(--cortex-space-2); left: var(--cortex-space-2);
      padding: 6px 12px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
      z-index: 5;
      font-size: var(--cortex-fs-sm);
    }
    @media (max-width: 1023px) {
      .desktop-layout { display: none; }
    }
    @media (min-width: 1024px) {
      .mobile-layout { display: none; }
    }
  `;

  @state() private _dialog: DialogKind = null;
  @state() private _reparsePath = ""; // 重新解析目标图像路径
  @state() private _pickedSkill: SkillInfo | null = null; // 工具箱中选中的技能
  @state() private _toast: string | null = null;
  private _toastTimer: any = null;

  // preview state（与 search-view 同款，本地管理）
  @state() private _previewPath = "";
  @state() private _previewContent = "";
  @state() private _previewLanguage = "text";
  @state() private _previewWritable = false;
  @state() private _previewPages: PageMarker[] | null = null;
  @state() private _previewAttachments: PstAttachmentInfo[] | null = null;
  @state() private _previewError: "NOT_INDEXED" | null = null;
  @state() private _previewDirty = false;

  @state() private _treePaneWidth = FilesView.TREE_PANE_WIDTH_DEFAULT;
  @state() private _previewPaneWidth = FilesView.PREVIEW_PANE_WIDTH_DEFAULT;

  /** jsbridge 上传进行中（App 内）：禁用上传入口，防重复触发 */
  @state() private _uploading = false;

  private _unsubscribe?: () => void;
  private _fileInput: HTMLInputElement | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    this._ensureLoaded("");
    this._loadPaneWidths();
    this._loadIndexedDocuments();
    // reindex 完成后刷新当前目录，让 indexed 标志反映新索引（改名/新增后自动回填）
    window.addEventListener("cortex:watch-reindexed", this._onIndexUpdated);
  }

  private async _loadIndexedDocuments() {
    if (!store.getState().files.filenameSearch.docsLoading) return;
    try {
      const docs = await fetchDocuments();
      actions.loadIndexedDocuments(docs);
    } catch (e: any) {
      actions.setFilenameSearchDocsError(e?.message || "文档列表加载失败");
    }
  }

  /** reindex 完成后（cortex:watch-reindexed）：刷新当前目录列表与已索引文档列表，
   *  让 indexed 标志反映新索引（改名/新增/删除后自动回填）。仅在 files 视图挂载时生效。 */
  private _onIndexUpdated = async () => {
    const dir = store.getState().files.currentDir;
    actions.invalidateDir(dir);
    void this._ensureLoaded(dir);
    try {
      const docs = await fetchDocuments();
      actions.loadIndexedDocuments(docs);
    } catch {
      /* 静默：indexed 标志非关键，不阻塞 */
    }
  };

  private _loadPaneWidths() {
    const treeSaved = localStorage.getItem(FilesView.TREE_PANE_WIDTH_KEY);
    if (treeSaved) {
      const w = Number(treeSaved);
      if (!Number.isNaN(w)) {
        this._treePaneWidth = Math.max(
          FilesView.TREE_PANE_WIDTH_MIN,
          Math.min(FilesView.TREE_PANE_WIDTH_MAX, w),
        );
      }
    }
    const previewSaved = localStorage.getItem(FilesView.PREVIEW_PANE_WIDTH_KEY);
    if (previewSaved) {
      const w = Number(previewSaved);
      if (!Number.isNaN(w)) {
        this._previewPaneWidth = Math.max(
          FilesView.PREVIEW_PANE_WIDTH_MIN,
          Math.min(FilesView.PREVIEW_PANE_WIDTH_MAX, w),
        );
      }
    }
  }

  /** 左 splitter：拖动 file-tree 右边缘。dx 正 = 变宽。
   *  动态上限 = files-view 实际宽 - preview 宽 - 中间栏最小 - splitters，避免挤掉中间栏。 */
  private _onTreeSplitterMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this._treePaneWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const hostWidth = this.clientWidth;
      const dynMax = hostWidth > 0
        ? hostWidth - this._previewPaneWidth - FilesView.MIDDLE_PANE_MIN - FilesView.SPLITTERS_TOTAL
        : FilesView.TREE_PANE_WIDTH_MAX;
      const cap = Math.min(FilesView.TREE_PANE_WIDTH_MAX, dynMax);
      const w = Math.max(
        FilesView.TREE_PANE_WIDTH_MIN,
        Math.min(cap, startWidth + dx),
      );
      if (w !== this._treePaneWidth) this._treePaneWidth = w;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(
        FilesView.TREE_PANE_WIDTH_KEY,
        String(this._treePaneWidth),
      );
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  /** 右 splitter：拖动 preview-col 左边缘。dx 负 = 变宽。
   *  动态上限 = files-view 实际宽 - tree 宽 - 中间栏最小 - splitters，避免挤掉中间栏。 */
  private _onPreviewSplitterMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this._previewPaneWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const hostWidth = this.clientWidth;
      const dynMax = hostWidth > 0
        ? hostWidth - this._treePaneWidth - FilesView.MIDDLE_PANE_MIN - FilesView.SPLITTERS_TOTAL
        : FilesView.PREVIEW_PANE_WIDTH_MAX;
      const cap = Math.min(FilesView.PREVIEW_PANE_WIDTH_MAX, dynMax);
      const w = Math.max(
        FilesView.PREVIEW_PANE_WIDTH_MIN,
        Math.min(cap, startWidth - dx),
      );
      if (w !== this._previewPaneWidth) this._previewPaneWidth = w;
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(
        FilesView.PREVIEW_PANE_WIDTH_KEY,
        String(this._previewPaneWidth),
      );
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  disconnectedCallback() {
    this._unsubscribe?.();
    if (this._toastTimer) clearTimeout(this._toastTimer);
    window.removeEventListener("cortex:watch-reindexed", this._onIndexUpdated);
    super.disconnectedCallback();
  }

  private get _state() { return store.getState().files; }

  private get _isMobile() {
    return typeof window !== "undefined" && window.innerWidth < 1024;
  }

  private async _ensureLoaded(path: string) {
    const { treeCache } = store.getState().files;
    if (path in treeCache) return;
    try {
      actions.setFilesState({ listing: true });
      const res = await filesApi.list(path);
      if (store.getState().files.treeCache !== treeCache) {
        // 期间 treeCache 已被其他请求替换，做 merge 而非覆盖
        const fresh = store.getState().files.treeCache;
        if (path in fresh) return;
        actions.setFilesState({
          treeCache: { ...fresh, [path]: res.entries },
          listing: false,
        });
        return;
      }
      actions.setFilesState({
        treeCache: { ...treeCache, [path]: res.entries },
        listing: false,
      });
    } catch (e: any) {
      actions.setFilesState({ listing: false, error: e?.message || "加载失败" });
      this._showToast(e?.message || "加载失败");
    }
  }

  updated() {
    // preview 由 _onFileListActivated 主动驱动，无需在 update 中被动触发
    // 所有对话框用 showModal（top-layer + backdrop + ESC 关闭）：<dialog open>
    // 是非模态 inline 元素，不进 top layer，列表内带 z-index 的元素（如表头
    // 列分隔线 .col-resize z-index:1）会穿透压在对话框之上
    const dlg = this.shadowRoot?.querySelector("dialog");
    if (dlg && !dlg.open) dlg.showModal();
  }

  private _showToast(msg: string) {
    this._toast = msg;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { this._toast = null; }, 3500);
  }

  private _onAction(e: CustomEvent<{ name: string }>) {
    const name = e.detail.name;
    if (name === "upload") {
      this._openFilePicker();
      return;
    }
    if (name === "copy-path") {
      this._copySelectedPaths();
      return;
    }
    if (name === "skill-toolbox") {
      // 目录也可入选（accept_dirs 技能如 knowledge-base 可做目录范围问答），
      // 只要勾选非空即可开工具箱
      if (this._state.selectedPaths.length === 0) return;
      this._pickedSkill = null;
      this._dialog = "skill-toolbox";
      return;
    }
    if (["mkdir", "rename", "move", "delete"].includes(name)) {
      if (name === "rename" && this._state.selectedPaths.length !== 1) return;
      if ((name === "move" || name === "delete") && this._state.selectedPaths.length === 0) return;
      this._dialog = name as DialogKind;
    }
  }

  /** 选中项里过滤掉目录，只留文件（技能 read_document 只能读文件）。 */
  private _selectedFilePaths(): string[] {
    const { treeCache, selectedPaths } = this._state;
    // 多选可跨目录：从各目录缓存收集 entry 判定 is_dir
    const entryByPath = new Map<string, { path: string; is_dir: boolean }>();
    for (const entries of Object.values(treeCache)) {
      for (const en of entries) entryByPath.set(en.path, en);
    }
    return selectedPaths.filter((p) => {
      const en = entryByPath.get(p);
      return en ? !en.is_dir : true; // 缓存未知时保留（宁可传错不漏选）
    });
  }

  /** 按技能能力决定清单：accept_dirs 技能保留目录（目录范围问答），否则只留文件。 */
  private _pathsForSkill(skill: SkillInfo): string[] {
    return skill.accept_dirs
      ? [...this._state.selectedPaths]
      : this._selectedFilePaths();
  }

  /** 工具箱中点选技能 → 进入确认对话框。 */
  private _onSkillPick(e: CustomEvent<{ skill: SkillInfo }>) {
    this._pickedSkill = e.detail.skill;
    this._dialog = "skill-run";
  }

  /** 确认对话框「开始对话」：拼消息 → pendingSkillChat → 切 chat 视图。 */
  private _onSkillRunSubmit(e: CustomEvent<{ prompt: string }>) {
    const skill = this._pickedSkill;
    const paths = skill ? this._pathsForSkill(skill) : [];
    this._dialog = null;
    if (!skill || paths.length === 0) return;

    const lines = [
      `[调用技能: ${skill.name}]`,
      "",
      `请先 load_skill("${skill.name}") 加载技能，然后按技能指引处理以下文件。`,
      "",
      "文件：",
      ...paths.map((p) => `- ${p}`),
      "",
      `补充要求：${e.detail.prompt || "无"}`,
    ];
    const firstFile = paths[0].split("/").pop() ?? paths[0];
    // 技能对话总是新建会话：重置 chat 视图态（旧对话保留在历史列表，可回）
    actions.setChatState({ state: "initial", currentSession: null, messages: [], streaming: false });
    actions.setPendingSkillChat({
      message: lines.join("\n"),
      title: `${skill.name} · ${firstFile}`,
    });
    actions.clearSelection();
    actions.setView("chat");
  }

  /** 拷贝选中项路径到剪贴板（相对 workdir，多选时每行一个）。 */
  private _copySelectedPaths() {
    const paths = this._state.selectedPaths;
    if (paths.length === 0) return;
    const text = paths.join("\n");
    navigator.clipboard.writeText(text).then(
      () => this._showToast(`已复制 ${paths.length} 个路径`),
      () => this._showToast("复制失败（剪贴板不可用）"),
    );
  }

  private _openFilePicker() {
    // NexBox WebView 内 X5 内核不弹 input file 选择器 → 走 jsbridge 原生通道
    //（App 版本过旧未实现该接口时自动降级回 input 方案）
    if (jsbridgeUploadAvailable()) {
      void this._uploadViaJsbridge(this._state.currentDir);
      return;
    }
    if (!this._fileInput) {
      this._fileInput = document.createElement("input");
      this._fileInput.type = "file";
      this._fileInput.multiple = true;
      this._fileInput.style.display = "none";
      this._fileInput.addEventListener("change", () => {
        if (this._fileInput && this._fileInput.files && this._fileInput.files.length > 0) {
          this._uploadFiles(Array.from(this._fileInput.files), this._state.currentDir);
          this._fileInput.value = "";
        }
      });
      document.body.appendChild(this._fileInput);
    }
    this._fileInput.click();
  }

  private async _onMkdirSubmit(e: CustomEvent<{ path: string }>) {
    this._dialog = null;
    try {
      await filesApi.mkdir(e.detail.path);
      const parent = e.detail.path.includes("/")
        ? e.detail.path.slice(0, e.detail.path.lastIndexOf("/"))
        : "";
      actions.invalidateDir(parent);
      await this._ensureLoaded(parent);
      actions.expandDir(parent);
      this._showToast("目录已创建");
    } catch (e: any) {
      this._showToast(e?.message || "创建失败");
    }
  }

  private async _onRenameSubmit(e: CustomEvent<{ newName: string }>) {
    const path = this._state.selectedPaths[0];
    this._dialog = null;
    try {
      await filesApi.rename(path, e.detail.newName);
      actions.invalidateDir(this._state.currentDir);
      await this._ensureLoaded(this._state.currentDir);
      // 若重命名的是当前预览文件，更新 previewPath 并重载内容
      if (this._previewPath === path) {
        const newPath = path.includes("/")
          ? path.slice(0, path.lastIndexOf("/") + 1) + e.detail.newName
          : e.detail.newName;
        this._previewPath = newPath;
        void this._reloadPreview();
      }
      this._showToast("已重命名");
    } catch (e: any) {
      this._showToast(e?.message || "重命名失败");
    }
  }

  private async _onMoveSubmit(e: CustomEvent<{ destDir: string; overwrite: boolean }>) {
    const sel = [...this._state.selectedPaths];
    this._dialog = null;
    try {
      const res = await filesApi.move(sel, e.detail.destDir, e.detail.overwrite);
      const parents = new Set<string>();
      sel.forEach(p => {
        parents.add(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
      });
      parents.add(e.detail.destDir);
      parents.forEach(p => actions.invalidateDir(p));
      for (const p of parents) await this._ensureLoaded(p);
      actions.clearSelection();
      this._showToast(res.skipped.length
        ? `已移动 ${res.moved.length} 项，${res.skipped.length} 项跳过`
        : `已移动 ${res.moved.length} 项`);
    } catch (e: any) {
      this._showToast(e?.message || "移动失败");
    }
  }

  private async _onDeleteSubmit(e: CustomEvent<{ paths: string[] }>) {
    const paths = [...e.detail.paths];
    this._dialog = null;
    let deleted = 0;
    let failed = 0;
    for (const p of paths) {
      try {
        await filesApi.remove(p);
        deleted++;
        actions.invalidateSubtree(p);
        const parent = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
        actions.invalidateDir(parent);
      } catch {
        failed++;
      }
    }
    const parents = new Set<string>();
    paths.forEach(p => parents.add(p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : ""));
    for (const p of parents) await this._ensureLoaded(p);
    // 若删除了正在预览的文件，清空 preview state
    if (this._previewPath && paths.includes(this._previewPath)) {
      this._previewPath = "";
      this._previewContent = "";
      this._previewError = null;
      this._previewWritable = false;
      this._previewPages = null;
      this._previewAttachments = null;
      this._previewDirty = false;
    }
    actions.clearSelection();
    this._showToast(failed
      ? `已删除 ${deleted}，失败 ${failed}`
      : `已删除 ${deleted} 项`);
  }

  private _onDropFiles(e: CustomEvent<{ files: File[]; destDir: string }>) {
    this._uploadFiles(e.detail.files, e.detail.destDir);
  }

  private async _uploadFiles(files: File[], destDir: string) {
    if (this._uploading) return;
    this._uploading = true;
    let ok = 0;
    let skipped = 0;
    let lastError = "";
    try {
      for (const f of files) {
        try {
          await filesApi.upload(f, destDir, false);
          ok++;
        } catch (e: any) {
          if (e?.code === "ALREADY_EXISTS") {
            skipped++;
          } else {
            lastError = e?.message || "上传失败";
          }
        }
      }
      await this._finishUpload(destDir, ok, skipped, lastError);
    } finally {
      this._uploading = false;
    }
  }

  /** 上传收尾：失效缓存 + 刷新目录 + toast 汇总（input 路径与 jsbridge 路径共用） */
  private async _finishUpload(destDir: string, ok: number, skipped: number, lastError: string) {
    actions.invalidateDir(destDir);
    await this._ensureLoaded(destDir);
    if (lastError && ok === 0) {
      this._showToast(lastError);
    } else {
      const parts = [`已上传 ${ok}`];
      if (skipped > 0) parts.push(`跳过 ${skipped}`);
      if (lastError) parts.push(`部分失败`);
      this._showToast(parts.join("，"));
    }
  }

  /**
   * App 内上传（jsbridge 通道）：原生选文件并直传服务器（大文件不走 base64 回传）。
   * 契约见 docs/jsbridge/upload_bridge.md；用户取消静默；401 跳登录页。
   */
  private async _uploadViaJsbridge(destDir: string) {
    if (this._uploading) return;
    this._uploading = true;
    try {
      const res = await pickAndUploadFiles({
        destDir,
        uploadUrl: `${window.location.origin}/api/files/upload`,
      });
      if (!res) return; // 用户在选择器取消
      if (res.unauthorized) {
        // 原生上传遇 401：与 client.ts 的 401 统一钩子行为对齐（app.ts 注入）
        actions.setAuthState({ authenticated: false });
        router.navigate("login");
        return;
      }
      let lastError = "";
      for (const r of res.results) {
        if (!r.ok && r.code !== "ALREADY_EXISTS") {
          lastError = r.detail || r.code || "上传失败";
        }
      }
      await this._finishUpload(destDir, res.uploadedCount, res.skippedCount, lastError);
    } catch (e) {
      this._showToast(e instanceof Error ? e.message : "上传失败");
    } finally {
      this._uploading = false;
    }
  }

  private _goBack() {
    const pane = this._state.mobilePane;
    if (pane === "detail") {
      if (this._isFilenameSearchActive) actions.setMobilePane("tree");
      else actions.setMobilePane("list");
    } else if (pane === "list") {
      actions.setMobilePane("tree");
    }
  }

  private async _onFileListActivated(e: CustomEvent<{ path: string; is_dir: boolean }>) {
    if (e.detail.is_dir) {
      actions.selectDir(e.detail.path);
      await this._ensureLoaded(e.detail.path);
      return;
    }
    // 文件：dirty 检查后切换预览
    await this._previewPathWithDirtyCheck(e.detail.path);
    if (this._isMobile) {
      actions.setMobilePane("detail");
    }
  }

  /** dirty 检查后切换预览；用户拒绝丢弃时不切换。复用给所有触发预览的入口。 */
  private async _previewPathWithDirtyCheck(path: string) {
    if (this._previewDirty) {
      const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
      if (!ok) return;
      this._discardPreviewEdits();
    }
    await this._fetchPreview(path);
  }

  private async _fetchPreview(path: string) {
    // PST 物理文件：预览 = 分页邮件列表组件（自取数），不走 /api/preview
    if (isPstFilePath(path)) {
      this._previewError = null;
      this._previewPath = path;
      this._previewContent = "";
      this._previewWritable = false;
      this._previewPages = null;
      this._previewAttachments = null;
      return;
    }
    const result = await fetchPreview(path);
    if (result.ok) {
      this._previewError = null;
      this._previewPath = result.path;
      this._previewContent = result.content;
      this._previewLanguage = result.language;
      this._previewWritable = result.writable;
      this._previewPages = result.pages;
      this._previewAttachments = result.attachments;
    } else if (result.notIndexed) {
      this._previewError = "NOT_INDEXED";
      this._previewPath = path;
      this._previewContent = "";
      this._previewWritable = false;
      this._previewPages = null;
      this._previewAttachments = null;
    } else {
      this._showToast(result.message || "预览失败");
    }
  }

  private async _reloadPreview() {
    if (!this._previewPath) return;
    const r = await fetchPreview(this._previewPath);
    if (r.ok) {
      this._previewContent = r.content;
      this._previewLanguage = r.language;
      this._previewWritable = r.writable;
      this._previewPages = r.pages;
      this._previewAttachments = r.attachments;
    }
  }

  /** PST 邮件列表行点击 → 打开派生邮件预览（走普通 preview 流程，含附件清单）。 */
  private _onOpenPstEmail = async (e: CustomEvent<{ path: string }>) => {
    await this._previewPathWithDirtyCheck(e.detail.path);
    if (this._isMobile) {
      actions.setMobilePane("detail");
    }
  };

  private _discardPreviewEdits() {
    const pp = this.shadowRoot?.querySelector("preview-pane") as any;
    pp?.discard?.();
    this._previewDirty = false;
  }

  private _onPreviewDirty = (e: CustomEvent<{ dirty: boolean }>) => {
    this._previewDirty = e.detail.dirty;
  };

  private _onPreviewSaved = () => {
    this._previewDirty = false;
    this._showToast("已保存");
  };

  private _onPreviewSaveFailed = (e: CustomEvent<{ message: string }>) => {
    this._showToast(`保存失败：${e.detail.message}`);
  };

  private _onPreviewUploadSuccess = (e: CustomEvent<{ path: string }>) => {
    this._previewDirty = false;
    this._showToast(`已覆盖：${e.detail.path}`);
    void this._reloadPreview();
  };

  private _onPreviewUploadFailed = (e: CustomEvent<{ message: string }>) => {
    this._showToast(`上传失败：${e.detail.message}`);
  };

  /** 预览 pane 下载成功（App 内 jsbridge 通道） */
  private _onPreviewDownloadSuccess = (e: CustomEvent<{ name: string }>) => {
    this._showToast(`已保存到下载目录：${e.detail.name}`);
  };

  private _onPreviewDownloadFailed = (e: CustomEvent<{ message: string }>) => {
    this._showToast(`下载失败：${e.detail.message}`);
  };

  private _renderNotIndexedHint() {
    return html`<div class="preview-placeholder">
      该文件未索引，无法预览。<br>
      请先执行 doclens index 后重试。
    </div>`;
  }

  private _renderPreviewPane(opts: { noHeader?: boolean; mobile?: boolean } = {}) {
    if (this._previewError === "NOT_INDEXED") {
      return this._renderNotIndexedHint();
    }
    if (!this._previewPath) {
      return html`<div class="preview-placeholder">点击文件预览</div>`;
    }
    // PST 物理文件：分页邮件列表（点击行进派生邮件预览）
    if (isPstFilePath(this._previewPath)) {
      return html`<pst-email-list
        .pstPath=${this._previewPath}
        ?showBack=${opts.mobile ?? false}
        @open-email=${this._onOpenPstEmail}
        @back=${() => this._goBack()}
      ></pst-email-list>`;
    }
    return html`<preview-pane
      ?noHeader=${opts.noHeader ?? false}
      ?mobile=${opts.mobile ?? false}
      ?enableReparse=${true}
      ?rememberScroll=${true}
      path=${this._previewPath}
      language=${this._previewLanguage}
      content=${this._previewContent}
      ?writable=${this._previewWritable}
      .pages=${this._previewPages}
      .attachments=${this._previewAttachments}
      ?showBack=${isPstEmailPath(this._previewPath)}
      backLabel="邮件列表"
      @dirty-change=${this._onPreviewDirty}
      @saved=${this._onPreviewSaved}
      @save-failed=${this._onPreviewSaveFailed}
      @upload-success=${this._onPreviewUploadSuccess}
      @upload-failed=${this._onPreviewUploadFailed}
      @download-success=${this._onPreviewDownloadSuccess}
      @download-failed=${this._onPreviewDownloadFailed}
      @reparse=${this._onReparse}
      @back=${this._onPreviewBack}
    ></preview-pane>`;
  }

  /** preview-pane「重新解析」按钮 → 打开 reparse-dialog。 */
  private _onReparse = (e: CustomEvent<{ path: string }>) => {
    this._reparsePath = e.detail.path;
    this._dialog = "reparse";
  };

  /** reparse-dialog 解析成功 → 关 dialog + toast + 重载预览。 */
  private _onReparseDone = () => {
    this._dialog = null;
    this._showToast("已重新解析");
    void this._reloadPreview();
  };

  /** 预览区返回：PST 派生邮件 → 回到该 PST 的邮件列表；其余走原导航。 */
  private _onPreviewBack = async () => {
    if (isPstEmailPath(this._previewPath)) {
      await this._previewPathWithDirtyCheck(this._previewPath.split("#")[0]);
      return;
    }
    this._goBack();
  };

  private get _searchBoxState() {
    const fs = store.getState().files.filenameSearch;
    const docsEmpty = !fs.docsLoading && fs.allDocs.length === 0;
    const disabled = fs.docsError !== null || docsEmpty;
    const placeholder = fs.docsError !== null
      ? "文档列表加载失败"
      : docsEmpty
        ? "暂无已索引文档"
        : "按文件名搜索…";
    return { disabled, placeholder };
  }

  private get _isFilenameSearchActive(): boolean {
    return store.getState().files.filenameSearch.isActive;
  }

  private _onFilenameSearch = (e: CustomEvent<{ query: string }>) => {
    const query = e.detail.query;
    if (query.trim() === "") {
      actions.clearFilenameSearch();
      return;
    }
    const { allDocs } = store.getState().files.filenameSearch;
    const q = query.toLowerCase();
    const filtered = allDocs.filter(d => d.name.toLowerCase().includes(q));
    filtered.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "zh", {
      numeric: true,
      sensitivity: "base",
    }));
    const totalMatches = filtered.length;
    const results = filtered.slice(0, 100);
    actions.setFilenameSearchQuery({ query, results, totalMatches });
    // 选中首项时立即联动 preview（dirty 检查与点击行一致）
    if (results[0]) {
      void this._previewPathWithDirtyCheck(results[0].path);
    }
  };

  private _onFilenameClear = () => {
    actions.clearFilenameSearch();
  };

  private _onFilenameResultActivated = async (e: CustomEvent<{ path: string }>) => {
    await this._previewPathWithDirtyCheck(e.detail.path);
    if (this._isMobile) {
      actions.setMobilePane("detail");
    }
  };

  private _cancelDialog = () => {
    this._dialog = null;
  };

  render() {
    return html`
      ${this._isMobile ? this._renderMobile() : this._renderDesktop()}
      ${this._renderDialogs()}
      <drop-zone .targetDir=${this._state.currentDir} @drop-files=${this._onDropFiles}></drop-zone>
      ${this._uploading
        ? html`<div class="upload-overlay" role="status" aria-live="polite">
            <div class="ring"></div>
            <div class="label">上传中…</div>
          </div>`
        : ""}
      ${this._toast
        ? html`<div class="toast" @click=${() => this._toast = null}>${this._toast}</div>`
        : ""}
    `;
  }

  private _renderDesktop() {
    const { disabled: searchDisabled, placeholder: searchPlaceholder } = this._searchBoxState;
    return html`
      <div
        class="desktop-layout"
        style="--tree-pane-width: ${this._treePaneWidth}px; --preview-pane-width: ${this._previewPaneWidth}px"
      >
        <aside class="tree-pane">
          <file-search-box
            .value=${store.getState().files.filenameSearch.query}
            ?disabled=${searchDisabled}
            .placeholder=${searchPlaceholder}
            @search=${this._onFilenameSearch}
            @clear=${this._onFilenameClear}
          ></file-search-box>
          <file-tree></file-tree>
        </aside>
        <div
          class="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整文件树栏宽度"
          @mousedown=${this._onTreeSplitterMouseDown}
        ></div>
        ${this._isFilenameSearchActive
          ? html`<file-search-results
              @activated=${this._onFilenameResultActivated}
              @clear=${this._onFilenameClear}
            ></file-search-results>`
          : html`<file-list
              .activePath=${this._previewPath}
              .uploading=${this._uploading}
              @action=${this._onAction}
              @activated=${this._onFileListActivated}
            ></file-list>`}
        <div
          class="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整预览栏宽度"
          @mousedown=${this._onPreviewSplitterMouseDown}
        ></div>
        <div class="preview-col">${this._renderPreviewPane({ noHeader: false })}</div>
      </div>
    `;
  }

  private _renderMobile() {
    const pane = this._state.mobilePane;
    const searchState = this._searchBoxState;
    return html`
      <div class="mobile-layout">
        ${pane === "tree"
          ? html`
              <file-search-box
                .value=${store.getState().files.filenameSearch.query}
                ?disabled=${searchState.disabled}
                .placeholder=${searchState.placeholder}
                @search=${this._onFilenameSearch}
                @clear=${this._onFilenameClear}
              ></file-search-box>
              ${this._isFilenameSearchActive
                ? html`<file-search-results
                    @activated=${this._onFilenameResultActivated}
                    @clear=${this._onFilenameClear}
                  ></file-search-results>`
                : html`<file-tree
                    @select-dir=${async (e: CustomEvent<{ path: string }>) => {
                      actions.selectDir(e.detail.path);
                      await this._ensureLoaded(e.detail.path);
                      actions.expandDir(e.detail.path);
                      actions.setMobilePane("list");
                    }}
                  ></file-tree>`}
            `
          : ""}
        ${pane === "list"
          ? html`<file-list
              .activePath=${this._previewPath}
              .uploading=${this._uploading}
              ?mobile=${true}
              @action=${this._onAction}
              @activated=${this._onFileListActivated}
              @back=${() => this._goBack()}
            ></file-list>`
          : ""}
        ${pane === "detail"
          ? html`<div class="mobile-preview">${this._renderPreviewPane({ mobile: true })}</div>`
          : ""}
      </div>
    `;
  }

  private _renderDialogs() {
    if (this._dialog === "mkdir") {
      return html`<dialog @cancel=${this._cancelDialog}>
        <mkdir-dialog
          @submit=${this._onMkdirSubmit}
          @cancel=${this._cancelDialog}
        ></mkdir-dialog>
      </dialog>`;
    }
    if (this._dialog === "rename") {
      const sel = this._state.selectedPaths[0] || "";
      const name = sel.split("/").pop() || "";
      return html`<dialog @cancel=${this._cancelDialog}>
        <rename-dialog
          .currentName=${name}
          @submit=${this._onRenameSubmit}
          @cancel=${this._cancelDialog}
        ></rename-dialog>
      </dialog>`;
    }
    if (this._dialog === "move") {
      return html`<dialog @cancel=${this._cancelDialog}>
        <move-dialog
          @submit=${this._onMoveSubmit}
          @cancel=${this._cancelDialog}
        ></move-dialog>
      </dialog>`;
    }
    if (this._dialog === "delete") {
      return html`<dialog @cancel=${this._cancelDialog}>
        <delete-dialog
          @submit=${this._onDeleteSubmit}
          @cancel=${this._cancelDialog}
        ></delete-dialog>
      </dialog>`;
    }
    if (this._dialog === "reparse") {
      return html`<dialog @cancel=${this._cancelDialog}>
        <reparse-dialog
          .path=${this._reparsePath}
          @done=${this._onReparseDone}
          @cancel=${this._cancelDialog}
        ></reparse-dialog>
      </dialog>`;
    }
    if (this._dialog === "skill-toolbox") {
      return html`<dialog @cancel=${this._cancelDialog}>
        <skill-toolbox-dialog
          @pick=${this._onSkillPick}
          @cancel=${this._cancelDialog}
        ></skill-toolbox-dialog>
      </dialog>`;
    }
    if (this._dialog === "skill-run") {
      return html`<dialog @cancel=${this._cancelDialog}>
        <skill-run-dialog
          .skill=${this._pickedSkill}
          .filePaths=${this._pickedSkill ? this._pathsForSkill(this._pickedSkill) : []}
          @submit=${this._onSkillRunSubmit}
          @cancel=${this._cancelDialog}
        ></skill-run-dialog>
      </dialog>`;
    }
    return html``;
  }
}

declare global {
  interface HTMLElementTagNameMap { "files-view": FilesView; }
}
