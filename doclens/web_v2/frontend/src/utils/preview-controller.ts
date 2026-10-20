import type { ReactiveController, ReactiveControllerHost } from "lit";

import { fetchPreview, isPstDerivedPath } from "../api/preview";
import type { PageMarker, PstAttachmentInfo } from "../api/preview";
import { isPstFilePath } from "../api/pst";

/**
 * PreviewController —— 三宿主视图（search/files/chat）共用的预览状态机。
 *
 * 替代此前三份复制的样板（P1-2 抽取，2026-10-20）：8 个 @state 字段的
 * fetch 回填 / 错误分支手工清空 / dirty 门（confirm + discard）/ 保存回填
 * / PST 物理文件拦截 / 范围↔全文件分派。
 *
 * 状态收敛为单一对象——错误/清空 = 整体替换，不再有「清漏一个字段」的
 * 脏状态面。变更后 host.requestUpdate() 驱动宿主重渲染；视图用兼容
 * getter（get previewPath() 等）转发，渲染模板零改动。
 *
 * 视图差异经构造选项保留：
 * - reloadAfterSave: "tokens"（search/chat——只回填 content+tokens，
 *   带 path 防竞态）| "full"（files——全量重拉，管理语义元数据可变）
 * - getPane: dirty 丢弃时命令式调 preview-pane.discard()
 * - 错误呈现策略由视图读 state.status 自决（chat 非未索引不开栏、
 *   files 任何错误进错误页、search 只认 NOT_INDEXED）
 */

/** 一次成功预览的完整文档态（对齐 PreviewResponse / fetchPreview 结果）。
 *
 * 响应形态由 (language, synthesized) 判别为三态（P2-2 文档化；后端仍是
 * 压平单模型，TS 侧注释先锁定契约——若新增格式应升级为完整 union）：
 * ① 文本（synthesized=false, language≠pdf）：磁盘直读；代码文件附 tokens；
 *    行范围切片时带 line_range，lineMap 恒 null
 * ② 合成（synthesized=true）：DB 合成 markdown——pages（pptx/excel/epub
 *    分页）与 lineMap（原始行号→md 行号换算）仅此形态非空；attachments
 *    仅 PST 派生邮件非空
 * ③ PDF（language=pdf）：轻量标记——content 恒空串、字节流由独立端点
 *    服务；pageStarts 仅此形态非空（未索引为 null，跳页静默降级）
 */
export interface PreviewDoc {
  path: string;
  content: string;
  language: string;
  writable: boolean;
  synthesized: boolean;
  /** 文件字节数（ADR-0046 编辑阈值判定用；后端未下发时 null）。 */
  sizeBytes: number | null;
  pages: PageMarker[] | null;
  lineMap: Record<string, number> | null;
  pageStarts: number[] | null;
  attachments: PstAttachmentInfo[] | null;
  tokens: string[][][] | null;
}

export type PreviewState =
  | { status: "empty" }
  | { status: "ok"; doc: PreviewDoc }
  | { status: "not-indexed"; path: string }
  | { status: "error"; path: string; message: string };

export interface PreviewControllerOptions {
  /** dirty 丢弃时找 preview-pane 调 discard()（命令式 API）。 */
  getPane?: () => { discard?: () => void } | null;
  /** 保存后的重拉策略（默认 "tokens"）。 */
  reloadAfterSave?: "tokens" | "full";
}

/** 命中行 → 合成 md 行号的「前驱近似」换算（BUG-F3 修复语义）：
 *  精确键 miss 时取 ≤line 的最大键——命中行常落在 docx 段落/xlsx 单元格/
 *  pptx 正文块内部，前驱 heading 即所属块，粗粒度定位远优于不滚；
 *  仍无键返回 null（md-viewer 不滚动）。普通文本预览 lineMap 为 null，
 *  调用方直接用原 line。 */
export function mapLineViaPredecessor(
  lineMap: Record<string, number>,
  line: number,
): number | null {
  const exact = lineMap[String(line)];
  if (exact !== undefined) return exact;
  let best: number | null = null;
  let bestKey = -1;
  for (const key of Object.keys(lineMap)) {
    const k = Number(key);
    if (k <= line && k > bestKey) {
      bestKey = k;
      best = lineMap[key];
    }
  }
  return best;
}

export class PreviewController implements ReactiveController {
  /** 当前预览状态（视图渲染读这里；变更经 _set 驱动宿主重渲染）。 */
  state: PreviewState = { status: "empty" };
  /** 编辑脏标记（preview-pane dirty-change 事件镜像）。 */
  dirty = false;

  private host: ReactiveControllerHost;
  private opts: PreviewControllerOptions;

  constructor(host: ReactiveControllerHost, opts: PreviewControllerOptions = {}) {
    this.host = host;
    this.opts = opts;
    host.addController(this);
  }

  hostConnected() {}
  hostDisconnected() {}

  // ------------------------------------------------------------ 便捷读取

  get path(): string {
    return this.state.status === "ok" ? this.state.doc.path
      : this.state.status === "not-indexed" || this.state.status === "error" ? this.state.path
      : "";
  }

  get content(): string { return this.state.status === "ok" ? this.state.doc.content : ""; }
  get language(): string { return this.state.status === "ok" ? this.state.doc.language : "text"; }
  get writable(): boolean { return this.state.status === "ok" ? this.state.doc.writable : false; }
  get sizeBytes(): number | null { return this.state.status === "ok" ? this.state.doc.sizeBytes : null; }
  get pages(): PageMarker[] | null { return this.state.status === "ok" ? this.state.doc.pages : null; }
  get attachments(): PstAttachmentInfo[] | null { return this.state.status === "ok" ? this.state.doc.attachments : null; }
  get pageStarts(): number[] | null { return this.state.status === "ok" ? this.state.doc.pageStarts : null; }
  get tokens(): string[][][] | null { return this.state.status === "ok" ? this.state.doc.tokens : null; }
  /** NOT_INDEXED 专用错误标志（三视图错误页共用形态）。 */
  get notIndexed(): boolean { return this.state.status === "not-indexed"; }
  /** 通用错误信息（files 错误页用；notIndexed/empty 为 null）。 */
  get errorMessage(): string | null {
    return this.state.status === "error" ? this.state.message : null;
  }

  // ------------------------------------------------------------ 打开预览

  /** 全文件预览（files 文件树 / chat 引用 / search 无行命中）。 */
  async open(path: string): Promise<PreviewState> {
    // PST 物理文件：预览 = 分页邮件列表组件（自取数），不走 /api/preview
    if (isPstFilePath(path)) {
      return this._set({ status: "ok", doc: this._emptyDoc(path) });
    }
    const result = await fetchPreview(path);
    if (result.ok) {
      return this._set({ status: "ok", doc: this._docFrom(result) });
    }
    return this._set(this._failState(path, result.notIndexed, result.message));
  }

  /** 搜索命中预览：有行号且非 PST 派生 → 先范围（line±10/+20），响应若需
   *  整文件渲染（synthesized = DB 合成 md 切片断分页/line_map 失配；
   *  language=markdown = md-viewer 的 data-source-line 是全文行号体系，
   *  切片内绝对命中行不存在、jumpToSourceLine 落空）→ 改取全文件。
   *  返回状态供视图算行定位（doc.lineMap 前驱换算在调用方）。 */
  async openHit(path: string, line: number | null): Promise<PreviewState> {
    if (line === null || isPstDerivedPath(path)) return this.open(path);
    const params = new URLSearchParams({ path });
    params.set("start_line", String(Math.max(1, line - 10)));
    params.set("end_line", String(line + 20));
    let body: any;
    try {
      const res = await fetch(`/api/preview?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return this._set(this._failState(path, err.code === "NOT_INDEXED", err.detail || `HTTP ${res.status}`));
      }
      body = await res.json();
    } catch {
      return this._set(this._setTempError(path));
    }
    if (body.synthesized || body.language === "markdown") {
      return this.open(path); // 合成/md 预览必须整文件渲染
    }
    // 范围片段：文本文件，r.line 即文件实际行号（无 lineMap/页表/附件）
    return this._set({
      status: "ok",
      doc: {
        path: body.path ?? path,
        content: body.content ?? "",
        language: body.language ?? "text",
        writable: body.writable ?? false,
        synthesized: body.synthesized ?? false,
        sizeBytes: body.size_bytes ?? null,
        pages: body.pages ?? null,
        lineMap: null,
        pageStarts: null,
        attachments: null,
        tokens: body.tokens ?? null,
      },
    });
  }

  /** 重新拉取当前文档（files 保存后全量重拉 / SSE reindexed）。 */
  async reload(): Promise<PreviewState> {
    if (this.state.status !== "ok") return this.state;
    return this.open(this.state.doc.path);
  }

  // ------------------------------------------------------------ 生命周期

  /** 清空预览（切视图 / 删除文件 / 关闭预览栏）。 */
  clear(): void {
    this._set({ status: "empty" });
    this.dirty = false;
  }

  /** 预览文件被重命名：同步路径（内容不变，重索引后 SSE 触发 reload）。 */
  renamePath(newPath: string): void {
    if (this.state.status === "ok") {
      this.state = { status: "ok", doc: { ...this.state.doc, path: newPath } };
      this.host.requestUpdate();
    }
  }

  /** dirty 门：有未保存修改时确认丢弃；用户拒绝返回 false（不执行 action）。 */
  async safeAction(action: () => void | Promise<void>): Promise<boolean> {
    if (this.dirty) {
      const ok = window.confirm("当前文件有未保存的修改。\n确定要丢弃吗？");
      if (!ok) return false;
      this.discardEdits();
    }
    await action();
    return true;
  }

  /** 丢弃编辑（命令式调 preview-pane.discard + 复位脏标记）。 */
  discardEdits(): void {
    this.opts.getPane?.()?.discard?.();
    this.dirty = false;
    this.host.requestUpdate();
  }

  /** preview-pane dirty-change 事件 → onDirtyChange(e.detail.dirty)。 */
  onDirtyChange(dirty: boolean): void {
    this.dirty = dirty;
    this.host.requestUpdate();
  }

  /** preview-pane saved 事件处理：脏标记复位 + content 回填（防宿主旧值
   *  回跳）+ tokens 清空（受控 prop 时序，防陈旧分词着色）+ 重拉。
   *  返回重拉 promise（视图可忽略）。 */
  onSaved(content: string): Promise<void> {
    this.dirty = false;
    if (this.state.status === "ok") {
      this.state = {
        status: "ok",
        doc: { ...this.state.doc, content, tokens: null },
      };
      this.host.requestUpdate();
      return this.opts.reloadAfterSave === "full"
        ? this._reloadFull()
        : this._reloadTokens();
    }
    return Promise.resolve();
  }

  /** 重拉恢复 tokens 高亮（仍在本文件才回填，防竞态）。 */
  private async _reloadTokens(): Promise<void> {
    if (this.state.status !== "ok") return;
    const path = this.state.doc.path;
    try {
      const r = await fetchPreview(path);
      if (r.ok && this.state.status === "ok" && this.state.doc.path === path) {
        this.state = { status: "ok", doc: this._docFrom(r) };
        this.host.requestUpdate();
      }
    } catch { /* 静默：无高亮可接受 */ }
  }

  /** files 语义的全量重拉（元数据随重索引可变：pages/attachments 等）。 */
  private async _reloadFull(): Promise<void> {
    await this._reloadTokens();
  }

  // ------------------------------------------------------------ 内部

  private _docFrom(r: {
    path: string; content: string; language: string; writable: boolean;
    synthesized: boolean; sizeBytes: number | null; pages: PageMarker[] | null;
    lineMap: Record<string, number> | null; pageStarts: number[] | null;
    attachments: PstAttachmentInfo[] | null; tokens: string[][][] | null;
  }): PreviewDoc {
    return {
      path: r.path, content: r.content, language: r.language,
      writable: r.writable, synthesized: r.synthesized, sizeBytes: r.sizeBytes,
      pages: r.pages, lineMap: r.lineMap, pageStarts: r.pageStarts,
      attachments: r.attachments, tokens: r.tokens,
    };
  }

  private _emptyDoc(path: string): PreviewDoc {
    return {
      path, content: "", language: "text", writable: false,
      synthesized: false, sizeBytes: null, pages: null, lineMap: null,
      pageStarts: null, attachments: null, tokens: null,
    };
  }

  private _failState(path: string, notIndexed: boolean, message: string): PreviewState {
    return notIndexed
      ? { status: "not-indexed", path }
      : { status: "error", path, message: message || "预览失败" };
  }

  private _setTempError(path: string): PreviewState {
    return { status: "error", path, message: "网络错误" };
  }

  private _set(state: PreviewState): PreviewState {
    this.state = state;
    this.host.requestUpdate();
    return state;
  }
}
