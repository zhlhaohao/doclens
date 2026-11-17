/** 会话操作域（AP-1 拆分：chat-view 的会话级动作状态机）。
 *
 * 原 chat-view.ts 内并存六组会话级操作：改名 / 压缩 / 导出 / 导入 /
 * 孪生复制 / 回退 / 删轮。它们的共同形态是「宿主事件 → 发 API 请求 →
 * 改对话框状态 → toast 报告 → 通知宿主刷新」，与视图渲染无关——迁入本
 * controller，chat-view 只保留事件接线与渲染（God Object 的「会话操作域」
 * 职责外迁）。
 *
 * 与 PreviewController / FilesModesController 同构：ReactiveController，
 * 变更经 host.requestUpdate() 驱动宿主重渲染。
 */
import type { ReactiveController, ReactiveControllerHost } from "lit";

import {
  compactSession,
  deleteTurn,
  duplicateSession,
  exportSession,
  importSession,
  renameSession,
  rewindSession,
  sessionExportFileName,
  sessionExportUrl,
  sessionImportUploadUrl,
} from "../api/sessions";
import { router } from "../router/router";
import { downloadFromUrl } from "../utils/download";
import { jsbridgeDownloadAvailable, jsbridgeUploadAvailable, pickAndUploadFiles } from "../utils/jsbridge";
import { actions } from "../state/store";

import type {
  CompactDialogState,
  DeleteTurnDialogState,
  ImportDialogState,
  RewindDialogState,
} from "../views/chat-dialogs";

export interface ChatSessionOpsOptions {
  /** toast 报告通道。 */
  toast: (message: string, level: "success" | "error" | "info", duration: number) => void;
  /** 刷新会话历史列表（导入/复制后）。 */
  reloadHistory: () => Promise<void> | void;
  /** 重载当前会话（回退/删轮后刷新消息流与压缩信息）。 */
  reloadSession: () => Promise<void> | void;
  /** 锚点内容回填输入框（回退后）。 */
  restoreDraft: (content: string, images?: { data: string; media_type: string }[]) => void;
  /** 改名成功后同步当前会话与历史列表。 */
  applyRenamedTitle: (title: string) => void;
  /** 当前会话 id（操作对象；null = 无会话）。 */
  currentSessionId: () => string | null;
  /** 当前会话标题（导出文件名用）。 */
  currentSessionTitle: () => string;
  /** 当前消息列表（回退/删轮算折叠数与轮次消息数用）。 */
  messages: () => Array<{ role: string; content: string; seq?: number }>;
  /** 流式进行中（回退按钮在流式期间禁用）。 */
  streaming: () => boolean;
  /** 压缩信息刷新（会话信息弹窗）。 */
  refreshCompaction: () => Promise<void> | void;
  /** 进入指定会话（孪生复制后直接进入副本）。 */
  enterSession?: (session: {
    id: string; type: string; title: string; preview: string;
    updated_at: string; message_count: number; mode?: string;
  }) => void;
}

export class ChatSessionOpsController implements ReactiveController {
  // ---- 对话框状态（视图据此渲染）
  renameDialogOpen = false;
  /** 孪生复制确认框待复制的源会话（null = 关闭）；确认后执行复制。 */
  forkSession: {
    id: string; title: string;
    message_count: number;
    mode?: string;
  } | null = null;
  compactDialog: CompactDialogState | null = null;
  rewindDialog: RewindDialogState | null = null;
  deleteTurnDialog: DeleteTurnDialogState | null = null;
  importDialog: ImportDialogState | null = null;
  /** 手动压缩进行中（防重复触发；LLM 摘要调用可达数十秒）。 */
  private _compacting = false;
  /** WebView 原生导入进行中（防重复拉起选择器）。 */
  private _importing = false;

  private host: ReactiveControllerHost;
  private opts: ChatSessionOpsOptions;

  constructor(host: ReactiveControllerHost, opts: ChatSessionOpsOptions) {
    this.host = host;
    this.opts = opts;
    host.addController(this);
  }

  hostConnected() {}
  hostDisconnected() {}

  private _touch(): void {
    this.host.requestUpdate();
  }

  // ---------------------------------------------------------------- 改名

  openRename(): void {
    this.renameDialogOpen = true;
    this._touch();
  }

  cancelRename(): void {
    this.renameDialogOpen = false;
    this._touch();
  }

  async submitRename(e: CustomEvent<{ title: string }>): Promise<void> {
    this.renameDialogOpen = false;
    this._touch();
    const sessionId = this.opts.currentSessionId();
    if (!sessionId) return;
    try {
      const res = await renameSession(sessionId, e.detail.title);
      this.opts.applyRenamedTitle(res.title);
      this.opts.toast("已重命名", "success", 2500);
    } catch (err) {
      this.opts.toast(`重命名失败：${(err as Error)?.message || err}`, "error", 5000);
    }
  }

  // ---------------------------------------------------------------- 压缩

  /** 打开压缩确认框（more 菜单「压缩上下文」）。 */
  openCompactConfirm(): void {
    this.compactDialog = {
      phase: "confirm", preTokens: 0, postTokens: 0, errorMessage: "", compactedText: "",
    };
    this._touch();
  }

  cancelCompact(): void {
    // running 态不允许关闭（拦截 ESC/backdrop；模态 spinner 必须停留到出结果）
    if (this.compactDialog?.phase === "running") return;
    this.compactDialog = null;
    this._touch();
  }

  /** 确认压缩：切换模态框为 running 态后执行（自带防重入）。 */
  async confirmCompact(): Promise<void> {
    const sessionId = this.opts.currentSessionId();
    if (!sessionId || this._compacting) return;
    this._compacting = true;
    this.compactDialog = {
      phase: "running", preTokens: 0, postTokens: 0, errorMessage: "", compactedText: "",
    };
    this._touch();
    try {
      const body = await compactSession(sessionId);
      this.compactDialog = {
        phase: "done",
        preTokens: body.pre_tokens ?? 0,
        postTokens: body.post_tokens ?? 0,
        errorMessage: "",
        compactedText: body.compacted_text ?? "",
      };
      void this.opts.refreshCompaction();
    } catch (err) {
      this.compactDialog = {
        phase: "error", preTokens: 0, postTokens: 0,
        errorMessage: (err as Error)?.message || String(err),
        compactedText: "",
      };
    } finally {
      this._compacting = false;
    }
    this._touch();
  }

  /** auto 压缩模态兜底收尾（ADR-0044）：SSE done 已到而压缩 done 事件
   *  丢失/未发时撤下 running 模态，防止卡死页面；正常路径已先行切换。 */
  finalizeAutoCompactDialog(): void {
    const d = this.compactDialog;
    if (d?.auto && d.phase === "running") {
      this.compactDialog = null;
      this._touch();
    }
  }

  /** 压缩事件（SSE compact）驱动的自动压缩模态态迁移。 */
  setAutoCompactDialog(state: CompactDialogState | null): void {
    this.compactDialog = state;
    this._touch();
  }

  // ---------------------------------------------------------------- 导出

  /** 导出当前会话（ADR-0038）：全保真 JSON，跨实例记忆转移。
   *  uptoSeq 非空 = 截断导出（导出到此为止）。 */
  async exportSession(uptoSeq?: number): Promise<void> {
    const sessionId = this.opts.currentSessionId();
    if (!sessionId) return;
    const truncated = uptoSeq !== undefined;
    try {
      if (jsbridgeDownloadAvailable()) {
        const r = await downloadFromUrl(
          sessionExportUrl(sessionId, uptoSeq),
          sessionExportFileName(this.opts.currentSessionTitle(), truncated),
        );
        if (r.via !== "jsbridge") return;
        if (r.name) this.opts.toast(`已导出：${r.name}（保存在下载目录）`, "success", 3500);
        else if (r.error) this.opts.toast(`导出失败：${r.error}`, "error", 5000);
        // 两字段皆空 = unauthorized 已在公共编排内跳登录，此处静默
        return;
      }
      await exportSession(sessionId, uptoSeq);
      this.opts.toast(
        truncated ? "已导出（截至该消息）" : "已导出会话文件",
        "success", 2500,
      );
    } catch (e) {
      this.opts.toast(`导出失败：${(e as Error)?.message || e}`, "error", 5000);
    }
  }

  // ---------------------------------------------------------------- 导入

  /** 导入会话（ADR-0038）：浏览器 = 文件选择器 → 确认框 → 上传；
   *  WebView 内改用原生选择器 + 直传（X5 不弹 input file）。 */
  importHistory(): void {
    if (jsbridgeUploadAvailable()) {
      void this._importViaJsbridge();
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) void this._importSessionFile(file);
    };
    input.click();
  }

  /** WebView 原生导入：选中 JSON 直传 /api/sessions/import/upload。 */
  private async _importViaJsbridge(): Promise<void> {
    if (this._importing) return;
    this._importing = true;
    try {
      const res = await pickAndUploadFiles({
        destDir: "",
        uploadUrl: sessionImportUploadUrl(),
        maxCount: 1,
      });
      if (!res) return; // 用户在选择器取消
      if (res.unauthorized) {
        // 与 client.ts 的 401 统一钩子行为对齐
        actions.setAuthState({ authenticated: false });
        router.navigate("login");
        return;
      }
      const item = res.results[0];
      if (!item) {
        this.opts.toast("导入失败：未选择文件", "error", 5000);
        return;
      }
      if (!item.ok) {
        this.opts.toast(`导入失败：${item.detail || item.code || "未知错误"}`, "error", 5000);
        return;
      }
      if (item.path === "skipped") {
        // 已导入过：展示「作为副本导入」分支（副本需重新选文件——原生
        // 直传通道不把文件字节交给 H5，只能再走一次选择器）。
        this.importDialog = {
          fileName: "", title: "", count: 0,
          phase: "exists", data: null, webview: true,
        };
        this._touch();
        await this.opts.reloadHistory();
        return;
      }
      this.opts.toast("已导入会话", "success", 3000);
      await this.opts.reloadHistory();
    } catch (e) {
      this.opts.toast(`导入失败：${(e as Error)?.message || e}`, "error", 5000);
    } finally {
      this._importing = false;
    }
  }

  /** 浏览器路径：解析文件 → 打开原生确认框。 */
  private async _importSessionFile(file: File): Promise<void> {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      this.opts.toast("导入失败：文件不是合法 JSON", "error", 5000);
      return;
    }
    // 前端轻量预读（标题/条目数）供确认展示；完整结构校验在后端
    const d = data as { session?: { title?: unknown }; items?: unknown };
    const title = typeof d.session?.title === "string" ? d.session.title : "";
    const count = Array.isArray(d.items) ? d.items.length : 0;
    this.importDialog = {
      fileName: file.name, title, count,
      phase: "confirm", data, webview: false,
    };
    this._touch();
  }

  /** 确认框「导入 / 作为副本导入」。 */
  async confirmImport(e: CustomEvent<{ asCopy: boolean }>): Promise<void> {
    const asCopy = !!e.detail?.asCopy;
    const dlg = this.importDialog;
    if (!dlg) return;

    // WebView 副本路径：无文件字节，重新拉起原生选择器（as_copy 直传端点）
    if (dlg.webview) {
      if (!asCopy) return;
      this.importDialog = null;
      this._touch();
      await this._importViaJsbridgeCopy();
      return;
    }

    if (dlg.data === null) return;
    this.importDialog = { ...dlg, phase: "busy" };
    this._touch();
    try {
      const res = await importSession(dlg.data, { asCopy });
      if (res.imported > 0) {
        this.importDialog = null;
        this.opts.toast(
          asCopy
            ? `已导入副本「${dlg.title || dlg.fileName}」`
            : `已导入会话「${dlg.title || dlg.fileName}」`,
          "success", 3000,
        );
        await this.opts.reloadHistory(); // 刷新列表（导入即置顶）
        return;
      }
      // skipped：切到「已存在」态，让用户决定是否作为副本导入
      this.importDialog = { ...dlg, phase: "exists" };
    } catch (e) {
      this.importDialog = { ...dlg, phase: "confirm" };
      this.opts.toast(`导入失败：${(e as Error)?.message || e}`, "error", 5000);
    }
    this._touch();
  }

  /** WebView 副本导入：带 as_copy 再走一次原生选择器直传。 */
  private async _importViaJsbridgeCopy(): Promise<void> {
    if (this._importing) return;
    this._importing = true;
    try {
      const res = await pickAndUploadFiles({
        destDir: "",
        uploadUrl: sessionImportUploadUrl(true),
        maxCount: 1,
      });
      if (!res) return;
      if (res.unauthorized) {
        actions.setAuthState({ authenticated: false });
        router.navigate("login");
        return;
      }
      const item = res.results[0];
      if (!item || !item.ok) {
        this.opts.toast(
          `导入失败：${item?.detail || item?.code || "未选择文件"}`, "error", 5000,
        );
        return;
      }
      this.opts.toast("已导入会话副本", "success", 3000);
      await this.opts.reloadHistory();
    } catch (e) {
      this.opts.toast(`导入失败：${(e as Error)?.message || e}`, "error", 5000);
    } finally {
      this._importing = false;
    }
  }

  cancelImport(): void {
    this.importDialog = null;
    this._touch();
  }

  // ---------------------------------------------------------------- 孪生复制

  openFork(session: {
    id: string; title: string;
    message_count: number;
    mode?: string;
  }): void {
    this.forkSession = session;
    this._touch();
  }

  cancelFork(): void {
    this.forkSession = null;
    this._touch();
  }

  /** 确认复制：调孪生复制 API → 刷新历史 → 进入孪生会话（复制即为了继续干活）。 */
  async confirmFork(): Promise<void> {
    const session = this.forkSession;
    this.forkSession = null;
    this._touch();
    if (!session) return;
    try {
      const twin = await duplicateSession(session.id);
      await this.opts.reloadHistory();
      // 复用 Session 形态进入会话（starred/mode 已知，免一次 get）
      this.opts.enterSession?.({
        id: twin.id, type: "chat", title: twin.title, preview: twin.preview,
        updated_at: new Date().toISOString(),
        message_count: session.message_count, mode: session.mode,
      });
      this.opts.toast("已复制会话，原会话保留", "success", 2500);
    } catch (err) {
      this.opts.toast(`复制会话失败：${(err as Error)?.message || err}`, "error", 5000);
    }
  }

  // ---------------------------------------------------------------- 回退

  /** 「回退到这里」：算折叠数并弹确认框。 */
  openRewind(e: CustomEvent<{ seq: number; content: string; images?: { data: string; media_type: string }[] }>): void {
    if (this.opts.streaming()) return; // 流式期间按钮已禁用，双保险
    const anchorSeq = e.detail.seq;
    // 折叠数 = 锚点及其后的活消息（锚点回填输入框，同样从时间线消失）
    const deadCount = this.opts.messages().filter(
      (m) => m.seq !== undefined && m.seq >= anchorSeq,
    ).length;
    this.rewindDialog = {
      seq: anchorSeq, content: e.detail.content, deadCount,
      images: e.detail.images,
    };
    this._touch();
  }

  /** 确认回退：POST → 重拉 detail（渲染新折叠条）→ 锚点内容回填输入框。 */
  async confirmRewind(
    e: CustomEvent<{ pointSeq: number; restoreFiles: boolean }>,
  ): Promise<void> {
    const sessionId = this.opts.currentSessionId();
    const anchor = this.rewindDialog;
    this.rewindDialog = null;
    this._touch();
    if (!sessionId || !anchor) return;
    try {
      const res = await rewindSession(sessionId, e.detail.pointSeq, e.detail.restoreFiles);
      this.opts.restoreDraft(anchor.content, anchor.images ?? []);
      const f = res.files;
      const parts: string[] = [];
      if (f.restored.length) parts.push(`恢复 ${f.restored.length} 个文件`);
      if (f.deleted.length) parts.push(`删除 ${f.deleted.length} 个文件`);
      if (f.failed.length) parts.push(`${f.failed.length} 个文件处置失败`);
      this.opts.toast(
        parts.length ? `已回退（${parts.join("，")}）` : "已回退",
        f.failed.length ? "info" : "success",
        4000,
      );
      await this.opts.reloadSession();
    } catch (err) {
      this.opts.toast(`回退失败：${(err as Error)?.message || err}`, "error", 5000);
    }
  }

  cancelRewind(): void {
    this.rewindDialog = null;
    this._touch();
  }

  // ---------------------------------------------------------------- 删轮

  /** 「删除这一轮」：弹确认框（删除不可撤销，不直接执行）。
   *  本轮消息数 = 锚点起、到下一条 user 消息之前的可见消息条数。 */
  openDeleteTurn(e: CustomEvent<{ seq: number }>): void {
    const seq = e.detail.seq;
    const msgs = this.opts.messages().filter((m) => m.seq !== undefined);
    const nextUser = msgs.find(
      (m) => m.role === "user" && (m.seq as number) > seq,
    );
    const end = nextUser?.seq ?? Infinity;
    const inTurn = msgs.filter(
      (m) => (m.seq as number) >= seq && (m.seq as number) < end,
    );
    const anchorMsg = msgs.find((m) => m.seq === seq);
    this.deleteTurnDialog = {
      seq,
      content: anchorMsg?.content ?? "",
      turnMessageCount: Math.max(inTurn.length, 1),
      submitting: false,
      errorMessage: "",
    };
    this._touch();
  }

  /** 确认删轮：DELETE → 重拉 detail（消息流与压缩信息同步刷新）。 */
  async confirmDeleteTurn(e: CustomEvent<{ pointSeq: number }>): Promise<void> {
    const sessionId = this.opts.currentSessionId();
    const d = this.deleteTurnDialog;
    if (!sessionId || !d) return;
    this.deleteTurnDialog = { ...d, submitting: true, errorMessage: "" };
    this._touch();
    try {
      const res = await deleteTurn(sessionId, e.detail.pointSeq);
      this.deleteTurnDialog = null;
      this.opts.toast(
        `已删除该轮对话（剩 ${res.message_count} 条消息）`, "success", 3000,
      );
      await this.opts.reloadSession();
    } catch (err) {
      this.deleteTurnDialog = {
        ...d, submitting: false,
        errorMessage: (err as Error)?.message || String(err),
      };
    }
    this._touch();
  }

  cancelDeleteTurn(): void {
    this.deleteTurnDialog = null;
    this._touch();
  }
}
