import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  getRecentWorkdirs,
  switchWorkdir,
  precheckWorkdir,
  WorkdirSwitchError,
  type RecentWorkdir,
} from "../api/workdir";

/** 工作目录切换对话框（ADR-0043）：顶栏「工作目录指示器」点击弹出。
 * 内容：最近工作目录清单 + 路径输入框 + 确认警告（孤儿任务数、草稿丢失）。
 * 确认后调 POST /api/workdir/switch（同步阻塞至切换完成），成功/失败事件
 * 交给 app-bar 处理（遮罩 + reload 走 SSE workdir_swapped / workdir_swap_failed）。
 *
 * Esc / 点遮罩 / 取消按钮 → 派发 close（切换请求进行中不可关——请求已发出，
 * 关掉对话框用户会以为没切）。 */
@customElement("workdir-switch-dialog")
export class WorkdirSwitchDialog extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      pointer-events: none;
    }
    :host([open]) {
      background: rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    .scrim { position: absolute; inset: 0; }
    dialog {
      position: relative;
      pointer-events: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 420px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      font-family: var(--cortex-font);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-4) var(--cortex-space-6);
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .head h3 {
      margin: 0;
      font-size: var(--cortex-fs-md);
      font-weight: 600;
      color: var(--cortex-text);
    }
    .close-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: var(--cortex-fs-lg);
      line-height: 1;
      color: var(--cortex-text-muted);
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .close-btn:hover:not(:disabled) { background: var(--cortex-surface-muted); color: var(--cortex-text); }
    .close-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .body {
      padding: var(--cortex-space-4) var(--cortex-space-6) var(--cortex-space-6);
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4);
      overflow-y: auto;
    }
    .label {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      margin-bottom: 4px;
    }
    .recent-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 200px;
      overflow-y: auto;
    }
    .recent-item {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 8px 10px;
      border: 1px solid transparent;
      border-radius: var(--cortex-radius-md);
      background: transparent;
      cursor: pointer;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      text-align: left;
      font-family: var(--cortex-font-mono);
      word-break: break-all;
    }
    .recent-item:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .recent-item.current { color: var(--cortex-text-muted); cursor: default; }
    .recent-item:disabled { opacity: 0.5; cursor: not-allowed; }
    .empty { font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted); padding: 4px 0; }
    input {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-base);
      box-sizing: border-box;
      font-family: var(--cortex-font-mono);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .warn {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-warning);
      background: var(--cortex-warning-bg);
      border: 1px solid var(--cortex-warning-border);
      border-radius: var(--cortex-radius-md);
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .err {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
    }
    .actions button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    .actions button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
    }
    .actions button.primary:hover:not(:disabled) { opacity: 0.9; }
    .actions button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      dialog { min-width: 0; width: calc(100vw - 16px); max-width: calc(100vw - 16px); }
      input { font-size: 16px; padding: 10px; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;

  @property({ type: Boolean, reflect: true })
  open = false;

  /** 当前工作目录（app-bar 从 store.status.workdir 传入） */
  @property() currentWorkdir = "";

  /** 预填目标路径（ADR-0049 files 页「设为工作目录」入口）：打开时回填
   *  路径输入框，用户仍可修改后提交。 */
  @property() prefillPath = "";

  @state() private _recent: RecentWorkdir[] = [];
  @state() private _path = "";
  @state() private _err = "";
  @state() private _submitting = false;
  /** ADR-0049 索引确认态：目标目录无索引库，等用户确认耗时的全量构建。 */
  @state() private _needIndexConfirm = false;
  /** precheck 进行中（探测 ~10ms，按钮短暂禁用防双击）。 */
  @state() private _prechecking = false;

  connectedCallback() {
    super.connectedCallback();
    if (this.open) void this._load();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has("open") && this.open) {
      this._err = "";
      this._path = this.prefillPath;
      this._needIndexConfirm = false;
      void this._load();
    }
  }

  private async _load() {
    try {
      this._recent = await getRecentWorkdirs();
    } catch {
      this._recent = [];
    }
  }

  private _samePath(a: string, b: string): boolean {
    const norm = (s: string) => s.replace(/[\\/]+$/, "").replace(/\//g, "\\").toLowerCase();
    return norm(a) === norm(b);
  }

  private _close() {
    if (this._submitting) return; // 请求已发出，不允许误关
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  private _pickRecent(path: string) {
    if (this._submitting) return;
    if (this._samePath(path, this.currentWorkdir)) return; // 当前目录不可选
    this._path = path;
    this._err = "";
    this._needIndexConfirm = false;
  }

  private async _submit() {
    const path = this._path.trim();
    if (!path) {
      this._err = "请输入或选择目标目录";
      return;
    }
    if (this._samePath(path, this.currentWorkdir)) {
      this._err = "目标与当前目录相同";
      return;
    }
    // ADR-0049 索引确认门：先探测目标是否已有索引库；未建索引则先弹
    // 确认（大目录全量索引分钟级），用户确认后才真正发起切换。
    if (!this._needIndexConfirm) {
      this._prechecking = true;
      this._err = "";
      try {
        const pre = await precheckWorkdir(path);
        if (!pre.has_index) {
          this._needIndexConfirm = true;
          return; // 停在确认态；确认按钮文案变为「仍要切换」
        }
      } catch (e) {
        // 探测失败（目录不存在 400 / 网络错）：直接报错，不进入切换
        this._err = e instanceof Error ? e.message : String(e);
        return;
      } finally {
        this._prechecking = false;
      }
    }
    this._needIndexConfirm = false;
    this._submitting = true;
    this._err = "";
    // 通知 app 层立即显示遮罩（ADR-0043 切换窗口）：遮罩必须在请求期间
    // 就位——swap 窗口期 status 轮询会吃 503，不能靠 status 驱动遮罩。
    this.dispatchEvent(new CustomEvent("swap-start", {
      detail: { target: path },
      bubbles: true, composed: true,
    }));
    try {
      const result = await switchWorkdir(path);
      // changed=true：正常路径由 SSE workdir_swapped 驱动整页 reload。
      // 但 SSE 事件可能在断连间隙丢失——POST 成功响应本身是可靠终态信号，
      // 直接 reload 兜底（双通道幂等：先 reload 者生效）。
      if (!result.changed) {
        this._submitting = false;
        this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
      } else {
        window.location.reload();
      }
    } catch (e) {
      this._submitting = false;
      // 400 切前校验失败 = 后端未进入切换窗口，遮罩本就不该出现，不解锁；
      // 409/500 = 窗口内失败（已回滚），兜底解锁遮罩（SSE workdir_swap_failed
      // 可能在断连间隙丢失——POST 失败响应是可靠终态信号；app 层幂等）。
      if (!(e instanceof WorkdirSwitchError && e.status === 400)) {
        window.dispatchEvent(new CustomEvent("cortex:workdir-swap-failed", {
          detail: { error: e instanceof Error ? e.message : String(e) },
        }));
      }
      if (e instanceof WorkdirSwitchError) {
        this._err = e.message;
      } else {
        this._err = `切换失败：${e}`;
      }
    }
  }

  private _onInput(e: Event) {
    this._path = (e.target as HTMLInputElement).value;
    this._err = "";
    this._needIndexConfirm = false; // 改了路径，确认态作废重探
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !this._submitting) void this._submit();
  }

  render() {
    if (!this.open) return nothing;
    // 简化版（用户决议 2026-10-26）：只留 当前目录 / 新目录输入 / 三条
    // 历史 / 确认取消；无常规 warn hint（索引确认警告保留——那是决策
    // 所需信息，非提示噪音）
    const others = this._recent.filter((r) => !this._samePath(r.path, this.currentWorkdir)).slice(0, 3);
    return html`
      <div class="scrim" @click=${this._close}></div>
      <dialog open>
        <div class="head">
          <h3>切换工作目录</h3>
          <button class="close-btn" ?disabled=${this._submitting} @click=${this._close} aria-label="关闭">
            <doclens-icon name="x"></doclens-icon>
          </button>
        </div>
        <div class="body">
          <div>
            <div class="label">当前目录</div>
            <div style="font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm); word-break: break-all;">${this.currentWorkdir || "?"}</div>
          </div>
          <div>
            <div class="label">新目录</div>
            <input
              type="text"
              .value=${this._path}
              ?disabled=${this._submitting}
              placeholder="D:\\知识库"
              @input=${this._onInput}
              @keydown=${this._onKeydown}
            />
          </div>
          ${others.length > 0
            ? html`<div>
                <div class="label">最近使用</div>
                <div class="recent-list">
                  ${others.map((r) => html`
                      <button class="recent-item" ?disabled=${this._submitting} @click=${() => this._pickRecent(r.path)}>
                        <doclens-icon name="folder"></doclens-icon>${r.path}
                      </button>
                    `)}
                </div>
              </div>`
            : nothing}
          ${this._needIndexConfirm
            ? html`<div class="warn" style="border-color: var(--cortex-danger);">
                <span><strong>该目录尚未建立索引。</strong>切换后将自动开始全量索引——目录较大时可能需要数分钟到更久，期间搜索不可用。</span>
              </div>`
            : nothing}
          ${this._err ? html`<div class="err">${this._err}</div>` : nothing}
          <div class="actions">
            <button ?disabled=${this._submitting} @click=${this._close}>取消</button>
            <button class="primary" ?disabled=${this._submitting || this._prechecking || !this._path.trim()} @click=${this._submit}>
              ${this._prechecking ? "检查索引…"
                : this._submitting ? "切换中…"
                : this._needIndexConfirm ? "仍要切换"
                : "切换"}
            </button>
          </div>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "workdir-switch-dialog": WorkdirSwitchDialog;
  }
}
