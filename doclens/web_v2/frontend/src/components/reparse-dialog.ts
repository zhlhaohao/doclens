import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getVisionPrompt, reparseImage, saveManualNote, ReparseError } from "../api/vision";

type Mode = "ai" | "manual";

/**
 * 图像重新解析对话框：两种模式 + 一键清空。
 *
 * - AI 重新解析：textarea 预填默认 VISION_PROMPT（GET /api/vision/prompt），
 *   用户编辑提示词后提交 → POST /api/vision/reparse 调视觉模型。
 * - 手动备注：textarea 留空由用户输入 Markdown → POST /api/vision/note 直接
 *   覆盖 AI 解读（不调模型，持久保留，model_tag="manual"）。
 *
 * 自管 API 调用 + loading；成功 dispatch "done"，失败 _err 内显（不关 dialog，
 * 可改内容重试）。外壳仿 rename-dialog。
 */
@customElement("reparse-dialog")
export class ReparseDialog extends LitElement {
  static styles = css`
    :host { display: block; min-width: 360px; max-width: 560px; }
    .mode-tabs { display: flex; gap: var(--cortex-space-2); margin-bottom: var(--cortex-space-3); }
    .mode-tabs .tab {
      flex: 1; padding: 6px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-sm); cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .mode-tabs .tab:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .mode-tabs .tab.active {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
    }
    .mode-tabs .tab:disabled { opacity: 0.4; cursor: not-allowed; }
    .row { margin: var(--cortex-space-3) 0; }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin-bottom: 4px;
    }
    textarea {
      width: 100%; min-height: 180px; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-sm);
      box-sizing: border-box;
      font-family: inherit;
      resize: vertical;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    textarea:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    textarea.invalid { border-color: var(--cortex-danger); }
    .err { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); margin-top: 4px; }
    .actions {
      display: flex; justify-content: flex-end; align-items: center;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    .actions .spacer { flex: 1; }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .actions { flex-wrap: wrap; gap: var(--cortex-space-3); }
      .actions .spacer { flex-basis: 100%; }
      .actions button { flex: 1; padding: 12px 16px; min-height: 44px; }
    }
  `;

  /** 要重新解析的图像相对路径（由父组件传入）。 */
  @property() path = "";
  @state() private _mode: Mode = "ai";
  @state() private _defaultPrompt = "";  // 缓存默认 VISION_PROMPT（AI 模式预填）
  @state() private _prompt = "";
  @state() private _promptLoading = true;
  @state() private _loading = false;
  @state() private _err = "";

  async connectedCallback() {
    super.connectedCallback();
    try {
      this._defaultPrompt = await getVisionPrompt();
      if (this._mode === "ai") this._prompt = this._defaultPrompt;
    } catch {
      this._err = "加载默认提示词失败，请手动输入";
    }
    this._promptLoading = false;
  }

  private _switchMode(mode: Mode) {
    if (this._loading || mode === this._mode) return;
    this._mode = mode;
    this._err = "";
    // AI 模式恢复默认提示词；手动模式清空让用户输入备注
    this._prompt = mode === "ai" ? this._defaultPrompt : "";
  }

  private _clear() {
    if (this._loading) return;
    this._prompt = "";
    this._err = "";
  }

  private _onInput(e: Event) {
    this._prompt = (e.target as HTMLTextAreaElement).value;
    if (this._err) this._err = "";
  }

  private async _submit() {
    if (this._loading || this._promptLoading) return;
    if (!this._prompt.trim()) {
      this._err = this._mode === "ai" ? "提示词不能为空" : "备注不能为空";
      return;
    }
    this._err = "";
    this._loading = true;
    try {
      if (this._mode === "ai") {
        await reparseImage(this.path, this._prompt);
      } else {
        await saveManualNote(this.path, this._prompt);
      }
      this.dispatchEvent(new CustomEvent("done", { bubbles: true, composed: true }));
    } catch (e) {
      const code = e instanceof ReparseError ? `[${e.code}] ` : "";
      this._err = `${code}${(e as Error).message ?? "操作失败"}`;
    } finally {
      this._loading = false;
    }
  }

  private _cancel() {
    if (this._loading) return; // 进行中不允许取消，防半完成状态
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    const isAi = this._mode === "ai";
    const canSubmit = !this._loading && !this._promptLoading && !!this._prompt.trim();
    const invalid = !!this._err;
    const submitLabel = this._loading
      ? (isAi ? "解析中..." : "保存中...")
      : (isAi ? "重新解析" : "保存备注");
    return html`
      <div class="mode-tabs">
        <button class="tab ${isAi ? "active" : ""}" ?disabled=${this._promptLoading}
          @click=${() => this._switchMode("ai")}>AI 重新解析</button>
        <button class="tab ${!isAi ? "active" : ""}"
          @click=${() => this._switchMode("manual")}>手动备注</button>
      </div>
      <div class="row">
        <label>${isAi
          ? "提示词（AI 按此解析图像）"
          : "备注内容（直接作为图像解读，不调 AI，覆盖解析结果）"}</label>
        <textarea
          class=${invalid ? "invalid" : ""}
          .value=${this._prompt}
          ?disabled=${this._loading || this._promptLoading}
          placeholder=${this._promptLoading
            ? "加载默认提示词..."
            : (isAi ? "" : "输入备注 Markdown（如 # 主题\n说明文字…），将覆盖 AI 解析结果")}
          @input=${this._onInput}
        ></textarea>
        ${invalid ? html`<div class="err">${this._err}</div>` : ""}
      </div>
      <div class="actions">
        <button @click=${this._clear} ?disabled=${this._loading || this._promptLoading}>清空</button>
        <span class="spacer"></span>
        <button @click=${this._cancel} ?disabled=${this._loading}>取消</button>
        <button class="primary" ?disabled=${!canSubmit} @click=${this._submit}>${submitLabel}</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "reparse-dialog": ReparseDialog; }
}
