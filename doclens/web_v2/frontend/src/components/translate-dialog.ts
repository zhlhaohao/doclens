// PDF 翻译弹框（ADR-0039）：预览页 header「翻译」按钮点开。
// 表单（预设只读展示/语言对/页码/产物形态）→ 提交进串行队列 → SSE 进度 →
// 完成后派发 translate-done 事件（preview-pane 刷新文件树/打开译文）。
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  submitTranslation,
  cancelTranslation,
  getTranslation,
  subscribeTranslation,
  TranslateApiError,
  type TranslateJobView,
  type TranslateEvent,
  type TranslateOutputs,
} from "../api/translate";
import { listPresets, type Preset } from "../api/presets";
import { getConfig } from "../api/config";

const LANGS = ["en", "zh", "ja", "ko", "de", "fr", "es", "it", "pt", "ru"];

/** 已挂 cancel 监听的 dialog 元素集合（防重复绑定）。 */
const CANCEL_WIRED = new WeakSet<HTMLDialogElement>();

@customElement("translate-dialog")
export class TranslateDialog extends LitElement {
  static styles = css`
    /* 原生 <dialog> + showModal()：top layer 全屏居中（沿宿主工具箱/
       关于对话框范式）——不被 PDF portal（document.body z-index 1）遮挡、
       不受预览栏 overflow 裁剪（2026-10-08 修复：旧 absolute 定位只浮在
       预览列内）。 */
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      box-sizing: border-box;
      padding: var(--cortex-space-5);
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      width: min(440px, calc(100vw - 32px));
      max-height: calc(100vh - 48px);
      color: var(--cortex-text);
      font-family: var(--cortex-font);
    }
    dialog::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }
    dialog[open] {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-3);
    }
    h3 {
      margin: 0;
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
    }
    .file {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      word-break: break-all;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-1);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    select,
    input[type="text"] {
      font: inherit;
      padding: var(--cortex-space-2);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      background: var(--cortex-surface);
      color: var(--cortex-text);
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--cortex-space-3);
    }
    .outputs {
      display: flex;
      gap: var(--cortex-space-2);
    }
    .outputs label {
      flex: 1;
      flex-direction: row;
      align-items: center;
      gap: var(--cortex-space-2);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      padding: var(--cortex-space-2);
      cursor: pointer;
    }
    .check {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .check input {
      accent-color: var(--cortex-btn-primary-bg, #0a1317);
    }
    .actions {
      display: flex;
      gap: var(--cortex-space-2);
      justify-content: flex-end;
      margin-top: var(--cortex-space-2);
    }
    button {
      /* 对话框按钮 = pill（DESIGN.md：对话框/设置确认黑 pill 营销主按钮；
       * 对齐 delete-dialog/city-dialog 范式） */
      font: inherit;
      font-size: var(--cortex-fs-base);
      padding: 6px 16px;
      border-radius: var(--cortex-radius-pill);
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
    }
    button:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
    }
    button.primary {
      /* 黑 pill 主按钮（marketing primary） */
      background: var(--cortex-btn-primary-bg, #0a1317);
      border: none;
      color: var(--cortex-btn-primary-text, #ffffff);
    }
    button.primary:hover:not(:disabled) {
      background: var(--cortex-btn-primary-pressed, #444950);
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .progress-wrap {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
    }
    .bar {
      height: 6px;
      border-radius: 3px;
      background: var(--cortex-surface-muted);
      overflow: hidden;
    }
    .bar > div {
      height: 100%;
      background: var(--cortex-btn-primary-bg, #0a1317);
      transition: width 0.3s ease;
    }
    .status-line {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
    .status-line.err {
      color: var(--cortex-danger, #b42318);
    }
    .preset-hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      border: 1px dashed var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      padding: var(--cortex-space-2);
    }
  `;

  /** 知识库内 PDF 相对路径（必传）。 */
  @property() path = "";

  @state() private _langIn = "en";
  @state() private _langOut = "zh";
  @state() private _outputs: TranslateOutputs = "both";
  @state() private _pages = "";
  @state() private _busy = false;
  @state() private _job: TranslateJobView | null = null;
  @state() private _phase: "form" | "running" = "form";
  @state() private _error: string | null = null;
  @state() private _progressDone = 0;
  @state() private _progressTotal = 0;
  @state() private _activePreset: Preset | null = null;

  private _closeSse?: () => void;

  connectedCallback() {
    super.connectedCallback();
    void this._loadActivePreset();
  }

  disconnectedCallback() {
    this._closeSse?.();
    super.disconnectedCallback();
  }

  private async _loadActivePreset() {
    try {
      const [presets, cfg] = await Promise.all([
        listPresets("translate"),
        getConfig("global"),
      ]);
      const activeName = (cfg.values["CORTEX_ACTIVE_TRANSLATE_PRESET"] ?? "").trim();
      this._activePreset = activeName
        ? (presets.find(
            (p) => p.name.trim().toLowerCase() === activeName.toLowerCase(),
          ) ?? null)
        : null;
    } catch {
      // 预设加载失败不阻塞弹框（后端会回退 google）
    }
  }

  private _close() {
    if (this._phase === "running" && this._job && this._job.status === "running") {
      // 翻译进行中关闭：不取消任务（后台继续），只关弹框
      this._closeSse?.();
    }
    this.dispatchEvent(new CustomEvent("translate-close", { bubbles: true, composed: true }));
  }

  private async _submit() {
    this._busy = true;
    this._error = null;
    try {
      const job = await submitTranslation({
        path: this.path,
        lang_in: this._langIn,
        lang_out: this._langOut,
        outputs: this._outputs,
        pages: this._pages.trim() || undefined,
      });
      this._job = job;
      this._phase = "running";
      this._progressDone = job.progress_done;
      this._progressTotal = job.progress_total;
      this._closeSse = subscribeTranslation(
        job.job_id,
        (ev: TranslateEvent) => this._onEvent(ev),
      );
    } catch (e) {
      this._error =
        e instanceof TranslateApiError ? e.message : (e as Error).message;
    } finally {
      this._busy = false;
    }
  }

  private _onEvent(ev: TranslateEvent) {
    if (ev.type === "progress" || ev.type === "running" || ev.type === "status") {
      if (typeof ev.done === "number") this._progressDone = ev.done;
      if (typeof ev.total === "number") this._progressTotal = ev.total;
    } else if (ev.type === "done") {
      this._closeSse?.();
      this.dispatchEvent(
        new CustomEvent("translate-done", {
          detail: { paths: ev.paths ?? [] },
          bubbles: true,
          composed: true,
        }),
      );
      this._error = null;
      this._phase = "form";
    } else if (ev.type === "error") {
      this._closeSse?.();
      this._error = ev.error ?? "翻译失败";
      this._phase = "form";
    } else if (ev.type === "cancelled") {
      this._closeSse?.();
      this._phase = "form";
    }
    // 同步 job 视图（轮询兜底场景）
    void this._pollJob();
  }

  private async _pollJob() {
    if (!this._job) return;
    try {
      this._job = await getTranslation(this._job.job_id);
    } catch {
      // 轮询失败忽略（SSE 为主）
    }
  }

  private async _cancel() {
    if (!this._job) return;
    try {
      this._job = await cancelTranslation(this._job.job_id);
      this._closeSse?.();
      this._phase = "form";
    } catch (e) {
      this._error = (e as Error).message;
    }
  }

  render() {
    const pct =
      this._progressTotal > 0
        ? Math.min(100, Math.round((this._progressDone / this._progressTotal) * 100))
        : 0;
    return html`
      <dialog>
        <h3>翻译 PDF</h3>
        <div class="file">${this.path}</div>
        ${this._phase === "form"
          ? this._renderForm()
          : html`
              <div class="progress-wrap">
                <div class="bar"><div style="width:${pct}%"></div></div>
                <div class="status-line">
                  ${this._job?.status === "queued"
                    ? "排队中（前序任务完成后开始）…"
                    : pct >= 100
                      ? "页面处理完成，段落翻译收尾中（服务异常时此处会很快报错）…"
                      : `翻译中 ${this._progressDone}/${this._progressTotal || "?"}（约 ${pct}%）`}
                </div>
              </div>
              <div class="actions">
                <button @click=${() => void this._cancel()}>取消翻译</button>
                <button @click=${() => this._close()}>后台运行</button>
              </div>
            `}
        ${this._error ? html`<div class="status-line err">${this._error}</div>` : nothing}
      </dialog>
    `;
  }

  /** 每次渲染后确保模态打开（top layer）；Esc（cancel 事件）统一走
   *  _close 语义（运行中 = 后台继续，只是关弹框）。用 updated 而非
   *  firstUpdated——条件挂载 + Lit DOM 复用下 firstUpdated 时机不保证
   *  dialog 已在树中，可能漏 showModal 导致非模态（2026-10-08 修复）。 */
  protected updated() {
    const dlg = this.renderRoot.querySelector("dialog");
    if (!dlg) return;
    if (!CANCEL_WIRED.has(dlg)) {
      dlg.addEventListener("cancel", (e) => {
        e.preventDefault();
        this._close();
      });
      CANCEL_WIRED.add(dlg);
    }
    if (!dlg.open) dlg.showModal();
  }

  private _renderForm() {
    return html`
      ${this._activePreset
        ? html`<div class="preset-hint">
            使用已激活的翻译预设（设置页 AI tab 可管理）：${this._activePreset.name}
          </div>`
        : html`<div class="preset-hint">
            尚无翻译预设，将使用 Google 免密钥翻译（设置页 AI tab 可配置更好的服务）
          </div>`}
      <div class="row">
        <label>源语言
          <select .value=${this._langIn} @change=${(e: Event) => (this._langIn = (e.target as HTMLSelectElement).value)}>
            ${LANGS.map((l) => html`<option value=${l} ?selected=${l === this._langIn}>${l}</option>`)}
          </select>
        </label>
        <label>目标语言
          <select .value=${this._langOut} @change=${(e: Event) => (this._langOut = (e.target as HTMLSelectElement).value)}>
            ${LANGS.map((l) => html`<option value=${l} ?selected=${l === this._langOut}>${l}</option>`)}
          </select>
        </label>
      </div>
      <label>页码范围（可选，如 1-3,5；留空=全文）
        <input
          type="text"
          .value=${this._pages}
          placeholder="1-3,5"
          @input=${(e: InputEvent) => (this._pages = (e.target as HTMLInputElement).value)}
        />
      </label>
      <label>输出格式（单语=纯译文；双语=原文译文逐页交错；两份产物都会保留）
        <div class="outputs">
          ${(
            [
              ["both", "单语+双语"],
              ["dual", "仅双语"],
              ["mono", "仅单语"],
            ] as [TranslateOutputs, string][]
          ).map(
            ([v, label]) => html`
              <label class=${this._outputs === v ? "check" : ""}>
                <input
                  type="radio"
                  name="outputs"
                  value=${v}
                  .checked=${this._outputs === v}
                  @change=${() => (this._outputs = v)}
                />
                ${label}
              </label>
            `,
          )}
        </div>
      </label>
      <div class="actions">
        <button @click=${() => this._close()}>取消</button>
        <button class="primary" ?disabled=${this._busy} @click=${() => void this._submit()}>
          ${this._busy ? "提交中…" : "开始翻译"}
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "translate-dialog": TranslateDialog;
  }
}
