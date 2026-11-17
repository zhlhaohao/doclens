/** 文件页「改动模式 / 深读模式」状态机（AP-3 拆分件）。
 *
 * 原 files-view.ts 内并存三域：文件树浏览、git 未提交改动、深读书目。
 * 其中后两域的状态与副作用（模式互斥、diff 取数、目录守卫、技能探测、
 * 同步轮次感知）自成一体，与视图渲染无关——迁入本 controller，
 * files-view 只保留渲染与事件接线（God Object 的「模式域」职责外迁）。
 *
 * 与 PreviewController 同构：ReactiveController，变更经 host.requestUpdate()
 * 驱动宿主重渲染；视图读 controller 的只读属性。
 */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import { gitApi } from "../api/git";
import type { GitDiffResponse } from "../api/git";
import { deleteSkill } from "../api/skills";
import type { BookSkillItem } from "../api/skills";
import { store, actions } from "../state/store";

/** 中间栏模式：文件列表 / 未提交改动 / 深读书目（后两者互斥）。 */
export type FilesMiddleMode = "list" | "changes" | "deep-read";

export interface FilesModesOptions {
  /** 探测 git 根（入口显隐依据）；失败静默隐藏。 */
  probeGitRoot: () => Promise<boolean>;
  /** 深读技能存在性探测；失败按「无深读技能」处理。 */
  probeBooks: () => Promise<boolean>;
  /** 退出改动模式时恢复常规预览（dirty 编辑丢弃确认与切文件同律）。 */
  restoreNormalPreview: () => void;
  /** 移动端切到列表层（模式切换时收起详情）。 */
  toMobileList?: () => void;
  /** 删除深读技能后的提示（由宿主 toast 通道承载）。 */
  notify?: (message: string) => void;
  /** 深读书目行点击 → 跳 chat 新建技能会话（宿主执行跳转）。 */
  onBookActivated?: (book: BookSkillItem) => void;
}

export class FilesModesController implements ReactiveController {
  // ------------------------------------------------------------ 改动模式

  /** 改动模式开关。 */
  changesMode = false;
  /** 知识库是否 git 根（入口显隐依据；null = 未探测）。 */
  isGitRoot: boolean | null = null;
  /** 当前 diff 预览的文件路径（空 = 无）。 */
  diffPath = "";
  /** diff 响应（null = 加载中/失败共用态机）。 */
  diffResp: GitDiffResponse | null = null;
  diffError: string | null = null;
  /** 上次见到的同步时间戳——变化即顺带重拉改动列表（Q5 决议）。 */
  private _lastSeenSyncAt: number | null | undefined = undefined;
  /** 进入改动模式时记录的当前目录——变化 = 用户点了 file-tree（Q15 退出依据）。 */
  private _lastDirBeforeChanges: string | null = null;

  // ------------------------------------------------------------ 深读模式

  /** 深读模式开关。 */
  deepReadMode = false;
  /** 是否存在深读技能（入口显隐依据；null = 未探测）。 */
  hasBooks: boolean | null = null;
  /** 进入深读模式时记录的当前目录——变化 = 用户点了 file-tree（同 Q15 退出依据）。 */
  private _lastDirBeforeDeepRead: string | null = null;
  /** 待删除的深读技能（删除确认对话框数据；null = 无）。 */
  deleteBook: BookSkillItem | null = null;

  private host: ReactiveControllerHost;
  private opts: FilesModesOptions;
  private _unsubscribers: Array<() => void> = [];

  constructor(host: ReactiveControllerHost, opts: FilesModesOptions) {
    this.host = host;
    this.opts = opts;
    host.addController(this);
  }

  hostConnected() {
    void this.probeGitRoot();
    void this.probeBooks();
    // selector 订阅（此前是全量 subscribe + 手动 requestUpdate——任何 store
    // 切片变化都重渲整个文件页）。三处关心的切片各自订阅：
    // ① 同步轮次（last_sync_at）→ 改动模式内重拉列表
    // ② 当前目录 → 模式目录守卫（Q15：点 file-tree 即退出模式）
    this._unsubscribers.push(
      store.subscribeSelector(
        (s) => s.syncStatus?.last_sync_at ?? null,
        (syncAt) => {
          if (this._lastSeenSyncAt !== undefined && syncAt !== this._lastSeenSyncAt) {
            this._lastSeenSyncAt = syncAt;
            // Q5 决议：改动模式内顺带重拉改动列表（同步轮次 SSE 零新事件）
            if (this.changesMode) void this.refreshChangesList();
            this.host.requestUpdate();
          }
        },
      ),
    );
    this._unsubscribers.push(
      store.subscribeSelector(
        (s) => s.files.currentDir,
        () => this._onDirChanged(),
      ),
    );
  }

  hostDisconnected() {
    this._unsubscribers.forEach((un) => un());
    this._unsubscribers = [];
  }

  /** 中间栏当前模式（改动/深读互斥，视图据此选列表组件）。 */
  get middleMode(): FilesMiddleMode {
    if (this.deepReadMode) return "deep-read";
    if (this.changesMode) return "changes";
    return "list";
  }

  /** 深读书目列表组件的刷新句柄（宿主在同步轮次/删除后调用）。 */
  private _deepReadListRef?: { refresh?: () => Promise<void> };
  /** 改动列表组件的刷新句柄。 */
  private _changesListRef?: { refresh?: () => Promise<void> };

  /** 视图在渲染时登记子组件句柄（消 `as any` 穿透）。 */
  registerChangesList(el: { refresh?: () => Promise<void> } | null) {
    this._changesListRef = el ?? undefined;
  }

  registerDeepReadList(el: { refresh?: () => Promise<void> } | null) {
    this._deepReadListRef = el ?? undefined;
  }

  /** Git Sync 轮次推进（Q5）：改动模式内重拉改动列表。 */
  async refreshChangesList(): Promise<void> {
    await this._changesListRef?.refresh?.();
  }

  async refreshDeepReadList(): Promise<void> {
    await this._deepReadListRef?.refresh?.();
  }

  // ------------------------------------------------------------ 探测

  async probeGitRoot(): Promise<void> {
    this.isGitRoot = await this.opts.probeGitRoot();
  }

  async probeBooks(): Promise<void> {
    this.hasBooks = await this.opts.probeBooks();
  }

  // ------------------------------------------------------------ 模式切换

  /** 进入 / 退出改动模式。进入时预览栏清空（diff 由用户点行触发）。 */
  toggleChangesMode(): void {
    this.changesMode = !this.changesMode;
    if (!this.changesMode) {
      this._clearDiff();
      this._lastDirBeforeChanges = null;
      // 回到普通列表时恢复常规预览态
      this.opts.restoreNormalPreview();
    } else {
      this._clearDiff();
      this._lastDirBeforeChanges = store.getState().files.currentDir;
      this.opts.toMobileList?.();
    }
    this.host.requestUpdate();
  }

  /** 进入 / 退出深读模式（与改动模式互斥——进深读时先退改动）。
   *  预览栏保持常规态（点书跳 chat，预览栏无深读专属内容）。 */
  toggleDeepReadMode(): void {
    if (this.changesMode) this.toggleChangesMode();
    this.deepReadMode = !this.deepReadMode;
    if (this.deepReadMode) {
      this._lastDirBeforeDeepRead = store.getState().files.currentDir;
      this.opts.toMobileList?.();
    } else {
      this._lastDirBeforeDeepRead = null;
    }
    this.host.requestUpdate();
  }

  private _clearDiff(): void {
    this.diffPath = "";
    this.diffResp = null;
    this.diffError = null;
  }

  /** 目录变化（用户点了 file-tree）：退出改动/深读模式（Q15 决议）。 */
  private _onDirChanged(): void {
    const dir = store.getState().files.currentDir;
    if (this.changesMode && dir !== this._lastDirBeforeChanges) {
      this.changesMode = false;
      this._clearDiff();
    }
    if (this.deepReadMode && dir !== this._lastDirBeforeDeepRead) {
      this.deepReadMode = false;
    }
    this.host.requestUpdate();
  }

  // ------------------------------------------------------------ diff 取数

  /** 改动列表行点击 → 加载该文件的 Unified Diff。 */
  async openDiff(path: string): Promise<void> {
    this.diffPath = path;
    this.diffResp = null;
    this.diffError = null;
    this.host.requestUpdate();
    try {
      this.diffResp = await gitApi.diff(path);
    } catch (err) {
      this.diffError = (err as Error)?.message || "diff 加载失败";
    }
    this.host.requestUpdate();
  }

  /** 退出改动模式并常规预览该文件（diff header「预览」按钮）。 */
  exitChangesForNormalPreview(): void {
    this.changesMode = false;
    this._clearDiff();
    this.host.requestUpdate();
  }

  // ------------------------------------------------------------ 深读技能

  /** 删除确认提交：真删技能目录（非内置 → DELETE 真删分支），刷新面板与入口。 */
  async deleteBookConfirm(): Promise<void> {
    const book = this.deleteBook;
    this.deleteBook = null;
    this.host.requestUpdate();
    if (!book) return;
    try {
      await deleteSkill(book.name);
      this.opts.notify?.(`已删除深读技能：${book.title}`);
      await this.refreshDeepReadList();
      await this.probeBooks();
      // 删空后退出深读模式（面板只剩空态引导）
      if (this.hasBooks === false) this.deepReadMode = false;
    } catch (e) {
      this.opts.notify?.((e as Error)?.message || "删除失败");
    }
    this.host.requestUpdate();
  }

  /** 深读书目行点击：跳 chat 新建技能会话（宿主执行跳转，本域只发信号）。 */
  emitBookActivated(book: BookSkillItem): void {
    this.opts.onBookActivated?.(book);
  }

  /** 切换移动端详情层（改动模式点行 → 移动端看 diff）。 */
  toMobileDetail(): void {
    actions.setMobilePane("detail");
  }
}
