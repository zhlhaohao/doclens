import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  activatePreset,
  createPreset,
  deletePreset,
  listPresets,
  updatePreset,
  PresetsApiError,
  type NewPresetInput,
  type Preset,
  type PresetKind,
  type PresetProtocol,
} from "../api/presets";

/** 空表单初值（新建用）。 */
function emptyForm(kind: PresetKind): FormState {
  return {
    name: "",
    kind,
    protocol: "openai_compat",
    base_url: "",
    model_id: "",
    api_key: "",
    context_window: "",
  };
}

interface FormState {
  name: string;
  kind: PresetKind;
  protocol: PresetProtocol;
  base_url: string;
  model_id: string;
  api_key: string;
  context_window: string;
}

interface EditingState {
  mode: "new" | "edit";
  kind: PresetKind;
  presetId?: string; // edit 模式下被编辑预设 id
  form: FormState;
}

const PROTOCOL_OPTIONS: { value: PresetProtocol; label: string }[] = [
  { value: "openai_compat", label: "OpenAI 兼容" },
  { value: "anthropic", label: "Anthropic" },
];

/**
 * 模型预设管理区块（ADR-0009）。挂在设置页 AI tab 顶部。
 *
 * 一键切换 = 后端把预设全部字段物化写进 global .env（+ 清 local 残留）+ reload_config；
 * 切换成功后派发 `presets-activated` 事件，由 <settings-view> 监听并重新
 * 拉取 .env，从而刷新「当前激活预设」高亮与下方字段散填区。
 */
@customElement("model-presets-section")
export class ModelPresetsSection extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--cortex-font);
      color: var(--cortex-text);
    }
    .wrap {
      margin-bottom: var(--cortex-space-6);
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--cortex-space-3);
      margin-bottom: var(--cortex-space-2);
    }
    .head h2 {
      margin: 0;
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      letter-spacing: -0.015em;
    }
    .head .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .group {
      margin-top: var(--cortex-space-5);
    }
    .group + .group {
      margin-top: var(--cortex-space-6);
      padding-top: var(--cortex-space-5);
    }
    .group-title {
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      color: var(--cortex-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 var(--cortex-space-3);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-2);
      background: var(--cortex-surface-muted);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
    }
    .preset-list {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
    }
    .preset-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border: none;
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
    }
    .preset-row.active {
      border-color: var(--cortex-primary);
      background: rgba(49, 162, 76, 0.15);
    }
    .preset-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .preset-name {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .badge {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-primary);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-primary);
      border-radius: var(--cortex-radius-pill);
      padding: 1px var(--cortex-space-2);
    }
    .preset-meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row-actions {
      display: flex;
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    .icon-btn {
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
    }
    .icon-btn:hover {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-text-muted);
    }
    .icon-btn.primary {
      background: var(--cortex-btn-primary-bg);
      border-color: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      font-weight: 600;
    }
    .icon-btn.primary:hover { filter: brightness(1.05); }
    .icon-btn.danger:hover {
      background: var(--cortex-danger);
      border-color: var(--cortex-danger);
      color: #fff;
    }
    .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .empty {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      padding: var(--cortex-space-2) 0;
    }

    /* ===== 内联编辑表单 ===== */
    .form {
      margin-top: var(--cortex-space-3);
      padding: var(--cortex-space-4);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--cortex-space-3);
    }
    .form .full { grid-column: 1 / -1; }
    .field-label {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text-muted);
      margin-bottom: 2px;
    }
    .input, .select {
      padding: 8px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      width: 100%;
      box-sizing: border-box;
    }
    .input.mono { font-family: var(--cortex-font-mono); }
    .input:focus, .select:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
    }
    .form-error {
      grid-column: 1 / -1;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-danger);
    }

    .msg {
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      margin-top: var(--cortex-space-3);
    }
    .msg.ok { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .msg.err { background: var(--cortex-danger-soft, rgba(220,38,38,0.1)); color: var(--cortex-danger); }

    @media (max-width: 1023px) {
      .form { grid-template-columns: 1fr; }
    }
  `;

  /** 当前激活预设名（来自 .env 的 CORTEX_ACTIVE_*_PRESET，由 settings-view 传入）。 */
  @property() activeLlm = "";
  @property() activeVision = "";

  @state() private _presets: Preset[] = [];
  @state() private _loading = true;
  @state() private _editing: EditingState | null = null;
  @state() private _busy = false;
  @state() private _error: string | null = null;
  @state() private _toast: string | null = null;
  @state() private _confirmDeleteId: string | null = null;
  @state() private _formError: string | null = null;

  private _toastTimer?: number;

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  disconnectedCallback() {
    if (this._toastTimer !== undefined) window.clearTimeout(this._toastTimer);
    super.disconnectedCallback();
  }

  private async _load() {
    this._error = null;
    try {
      this._presets = await listPresets();
    } catch (e) {
      this._error = `加载预设失败: ${(e as Error).message}`;
    } finally {
      this._loading = false;
    }
  }

  private _byKind(kind: PresetKind): Preset[] {
    return this._presets.filter((p) => p.kind === kind);
  }

  private _isActive(p: Preset): boolean {
    return (p.kind === "llm" ? this.activeLlm : this.activeVision) === p.name;
  }

  private _setFlash(msg: string) {
    this._toast = msg;
    if (this._toastTimer !== undefined) window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => { this._toast = null; }, 3000);
  }

  private _errMsg(e: unknown): string {
    if (e instanceof PresetsApiError) {
      const body = e.body as { detail?: string } | null;
      return body?.detail ?? `HTTP ${e.status}`;
    }
    return (e as Error).message;
  }

  private _openNew(kind: PresetKind) {
    this._formError = null;
    this._editing = { mode: "new", kind, form: emptyForm(kind) };
  }

  private _openEdit(p: Preset) {
    this._formError = null;
    this._editing = {
      mode: "edit",
      kind: p.kind,
      presetId: p.id,
      form: {
        name: p.name,
        kind: p.kind,
        protocol: p.protocol ?? "openai_compat",
        base_url: p.base_url ?? "",
        model_id: p.model_id ?? "",
        api_key: "", // 留空=不改动（编辑时密钥已脱敏）
        context_window: p.context_window ? String(p.context_window) : "",
      },
    };
  }

  private _cancelEdit() {
    this._editing = null;
    this._formError = null;
  }

  private _setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!this._editing) return;
    this._editing = { ...this._editing, form: { ...this._editing.form, [key]: value } };
  }

  private async _submit() {
    const ed = this._editing;
    if (!ed) return;
    const f = ed.form;
    if (!f.name.trim()) {
      this._formError = "请填写预设名称";
      return;
    }
    if (!f.base_url.trim() || !f.model_id.trim()) {
      this._formError = "base_url 与模型 ID 必填";
      return;
    }
    this._busy = true;
    this._formError = null;
    try {
      if (ed.mode === "new") {
        const input: NewPresetInput = {
          name: f.name.trim(),
          kind: f.kind,
          protocol: f.protocol,
          base_url: f.base_url.trim(),
          model_id: f.model_id.trim(),
          api_key: f.api_key,
          context_window: f.kind === "llm" && f.context_window ? Number(f.context_window) : null,
        };
        await createPreset(input);
        this._setFlash(`已创建预设「${input.name}」`);
      } else if (ed.presetId) {
        const cw = f.kind === "llm" && f.context_window ? Number(f.context_window) : null;
        const updates: Record<string, unknown> = {
          name: f.name.trim(),
          protocol: f.protocol,
          base_url: f.base_url.trim(),
          model_id: f.model_id.trim(),
          context_window: cw,
        };
        // api_key 仅在用户输入了新值时才传（空=不改动）
        if (f.api_key) updates.api_key = f.api_key;
        await updatePreset(ed.presetId, updates);
        this._setFlash(`已更新预设「${f.name.trim()}」`);
      }
      this._editing = null;
      await this._load();
    } catch (e) {
      this._formError = this._errMsg(e);
    } finally {
      this._busy = false;
    }
  }

  private async _activate(p: Preset) {
    this._busy = true;
    this._error = null;
    try {
      const r = await activatePreset(p.id);
      this._setFlash(r.note ?? `已切换到「${p.name}」`);
      // 通知 settings-view 重新拉取 .env（激活键 + 物化字段都已更新）
      this.dispatchEvent(new CustomEvent("presets-activated", { bubbles: true, composed: true }));
    } catch (e) {
      this._error = `切换失败: ${this._errMsg(e)}`;
    } finally {
      this._busy = false;
    }
  }

  private async _delete(p: Preset) {
    if (this._confirmDeleteId !== p.id) {
      this._confirmDeleteId = p.id;
      return;
    }
    this._busy = true;
    this._error = null;
    try {
      await deletePreset(p.id);
      this._confirmDeleteId = null;
      this._setFlash(`已删除预设「${p.name}」`);
      await this._load();
    } catch (e) {
      this._error = `删除失败: ${this._errMsg(e)}`;
    } finally {
      this._busy = false;
    }
  }

  private _renderForm() {
    const ed = this._editing;
    if (!ed) return nothing;
    const f = ed.form;
    const isLlm = f.kind === "llm";
    return html`
      <div class="form">
        <div>
          <div class="field-label">名称</div>
          <input class="input" autocomplete="off" .value=${f.name} @input=${(e: Event) => this._setField("name", (e.target as HTMLInputElement).value)} />
        </div>
        <div>
          <div class="field-label">协议</div>
          <select class="select" .value=${f.protocol} @change=${(e: Event) => this._setField("protocol", (e.target as HTMLSelectElement).value as PresetProtocol)}>
            ${PROTOCOL_OPTIONS.map((o) => html`<option value=${o.value} ?selected=${o.value === f.protocol}>${o.label}</option>`)}
          </select>
        </div>
        <div class="full">
          <div class="field-label">API Base URL</div>
          <input class="input mono" autocomplete="off" placeholder="https://..." .value=${f.base_url} @input=${(e: Event) => this._setField("base_url", (e.target as HTMLInputElement).value)} />
        </div>
        <div>
          <div class="field-label">模型 ID</div>
          <input class="input mono" autocomplete="off" .value=${f.model_id} @input=${(e: Event) => this._setField("model_id", (e.target as HTMLInputElement).value)} />
        </div>
        <div>
          <div class="field-label">API Key ${ed.mode === "edit" ? html`（留空=不改动）` : nothing}</div>
          <input class="input mono" type="password" autocomplete="new-password" placeholder=${ed.mode === "edit" ? "••••••" : "可留空"} .value=${f.api_key} @input=${(e: Event) => this._setField("api_key", (e.target as HTMLInputElement).value)} />
        </div>
        ${isLlm ? html`
          <div>
            <div class="field-label">上下文窗口（tokens，留空用默认 200000）</div>
            <input class="input" type="number" min="1" autocomplete="off" .value=${f.context_window} @input=${(e: Event) => this._setField("context_window", (e.target as HTMLInputElement).value)} />
          </div>
        ` : nothing}
        ${this._formError ? html`<div class="form-error">${this._formError}</div>` : nothing}
        <div class="form-actions">
          <button class="icon-btn" ?disabled=${this._busy} @click=${() => this._cancelEdit()}>取消</button>
          <button class="icon-btn primary" ?disabled=${this._busy} @click=${() => this._submit()}>
            ${this._busy ? "保存中…" : ed.mode === "new" ? "创建" : "保存"}
          </button>
        </div>
      </div>
    `;
  }

  private _renderGroup(kind: PresetKind, title: string) {
    const list = this._byKind(kind);
    return html`
      <div class="group">
        <div class="group-title">
          ${title}
          <button class="icon-btn" @click=${() => this._openNew(kind)}>+ 新建</button>
        </div>
        ${list.length === 0
          ? html`<div class="empty">暂无预设，点「新建」创建一个。</div>`
          : html`<div class="preset-list">
              ${list.map((p) => this._renderRow(p))}
            </div>`}
        ${this._editing?.kind === kind ? this._renderForm() : nothing}
      </div>
    `;
  }

  private _renderRow(p: Preset) {
    const active = this._isActive(p);
    const confirming = this._confirmDeleteId === p.id;
    return html`
      <div class="preset-row ${active ? "active" : ""}">
        <div class="preset-main">
          <div class="preset-name">
            ${p.name}
          </div>
          <div class="preset-meta">${p.model_id || "（未设模型）"} · ${p.protocol}${p.kind === "llm" && p.context_window ? ` · ${p.context_window}k` : ""}</div>
        </div>
        <div class="row-actions">
          ${active
            ? html`<button class="icon-btn" disabled>已激活</button>`
            : html`<button class="icon-btn primary" ?disabled=${this._busy} @click=${() => this._activate(p)}>切换</button>`}
          <button class="icon-btn" ?disabled=${this._busy} @click=${() => this._openEdit(p)}>编辑</button>
          <button class="icon-btn danger" ?disabled=${this._busy} @click=${() => this._delete(p)}>
            ${confirming ? "确认删除" : "删除"}
          </button>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="wrap">
        ${this._loading
          ? html`<div class="empty">加载中…</div>`
          : html`${this._renderGroup("llm", "LLM（AI 对话）")}${this._renderGroup("vision", "视觉模型（图像解析）")}`}
        ${this._error ? html`<div class="msg err">${this._error}</div>` : nothing}
        ${this._toast ? html`<div class="msg ok">${this._toast}</div>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "model-presets-section": ModelPresetsSection;
  }
}
