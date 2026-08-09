import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import {
  activatePreset,
  createPreset,
  deletePreset,
  listPresets,
  updatePreset,
  PresetsApiError,
  type Preset,
} from "../api/presets";

/** 搜索预设表单初值（新建用，预填出厂默认）。 */
function emptyForm(): FormState {
  return {
    name: "",
    max_results: "50",
    min_score_threshold: "0.3",
    max_span: "50",
    weight_keyword_match: "4.0",
    weight_file_name_match: "2.0",
    weight_fts_score: "1.0",
    weight_title_match: "2.0",
    weight_proximity_match: "1.0",
  };
}

interface FormState {
  name: string;
  max_results: string;
  min_score_threshold: string;
  max_span: string;
  weight_keyword_match: string;
  weight_file_name_match: string;
  weight_fts_score: string;
  weight_title_match: string;
  weight_proximity_match: string;
}

interface EditingState {
  mode: "new" | "edit";
  presetId?: string;
  form: FormState;
}

// 表单字段 → 数字字段元数据（label / hint 意义 / min / max / step）
const FIELDS: { key: keyof Omit<FormState, "name">; label: string; hint: string; min: number; max: number; step: number }[] = [
  { key: "max_results", label: "最大结果数", hint: "search 工具最多返回多少篇文档", min: 1, max: 500, step: 1 },
  { key: "min_score_threshold", label: "评分阈值", hint: "低于该综合分的结果被过滤，0 = 不过滤", min: 0, max: 1, step: 0.05 },
  { key: "max_span", label: "关键词集中度", hint: "邻近度统计的关键词最大字符跨度", min: 1, max: 100, step: 1 },
  { key: "weight_keyword_match", label: "关键词权重", hint: "命中的关键词越多排越前", min: 0, max: 10, step: 0.1 },
  { key: "weight_file_name_match", label: "文件名权重", hint: "文件名含关键词的文档排更前", min: 0, max: 10, step: 0.1 },
  { key: "weight_fts_score", label: "FTS 分权重", hint: "偏向传统 BM25 全文检索排序", min: 0, max: 10, step: 0.1 },
  { key: "weight_title_match", label: "标题权重", hint: "小节标题含关键词排更前", min: 0, max: 10, step: 0.1 },
  { key: "weight_proximity_match", label: "邻近度权重", hint: "关键词紧邻出现的文档排更前", min: 0, max: 10, step: 0.1 },
];

/**
 * 搜索预设管理区块（ADR-0010）。挂在设置页 search tab 顶部。
 *
 * 复用模型预设的整套机制（同一 model_presets.json / presets_store / /api/presets /
 * 物化写 global .env），kind=search。切换即时热生效（无副作用）。
 */
@customElement("search-presets-section")
export class SearchPresetsSection extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--cortex-font);
      color: var(--cortex-text);
    }
    .wrap {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-lg);
      padding: var(--cortex-space-5);
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
    .group { margin-top: var(--cortex-space-3); }
    .group-title {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text-subtle);
      margin: 0 0 var(--cortex-space-2);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
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
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
    }
    .preset-row.active {
      border-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
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
      font-variant-numeric: tabular-nums;
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
    .icon-btn:hover { background: var(--cortex-surface-muted); border-color: var(--cortex-text-muted); }
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
    .field-label .field-range {
      font-weight: 400;
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      margin-left: var(--cortex-space-2);
    }
    .field-hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-top: 2px;
      line-height: 1.4;
    }
    .input {
      padding: 8px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      width: 100%;
      box-sizing: border-box;
      font-variant-numeric: tabular-nums;
    }
    .input:focus {
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

  /** 当前激活搜索预设名（来自 .env CORTEX_ACTIVE_SEARCH_PRESET）。 */
  @property() activeSearch = "";

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
      this._presets = await listPresets("search");
    } catch (e) {
      this._error = `加载预设失败: ${(e as Error).message}`;
    } finally {
      this._loading = false;
    }
  }

  private _isActive(p: Preset): boolean {
    return this.activeSearch === p.name;
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

  private _openNew() {
    this._formError = null;
    this._editing = { mode: "new", form: emptyForm() };
  }

  private _openEdit(p: Preset) {
    this._formError = null;
    this._editing = {
      mode: "edit",
      presetId: p.id,
      form: {
        name: p.name,
        max_results: p.max_results != null ? String(p.max_results) : "",
        min_score_threshold: p.min_score_threshold != null ? String(p.min_score_threshold) : "",
        max_span: p.max_span != null ? String(p.max_span) : "",
        weight_keyword_match: p.weight_keyword_match != null ? String(p.weight_keyword_match) : "",
        weight_file_name_match: p.weight_file_name_match != null ? String(p.weight_file_name_match) : "",
        weight_fts_score: p.weight_fts_score != null ? String(p.weight_fts_score) : "",
        weight_title_match: p.weight_title_match != null ? String(p.weight_title_match) : "",
        weight_proximity_match: p.weight_proximity_match != null ? String(p.weight_proximity_match) : "",
      },
    };
  }

  private _cancelEdit() {
    this._editing = null;
    this._formError = null;
  }

  private _setField(key: keyof FormState, value: string) {
    if (!this._editing) return;
    this._editing = { ...this._editing, form: { ...this._editing.form, [key]: value } };
  }

  /** 把表单字符串字段收集为后端 search 输入（数字字段；空串→null=不写该键）。 */
  private _collect(f: FormState): Record<string, number | null> {
    const out: Record<string, number | null> = {};
    for (const fd of FIELDS) {
      const raw = f[fd.key].trim();
      out[fd.key] = raw === "" ? null : Number(raw);
    }
    return out;
  }

  private async _submit() {
    const ed = this._editing;
    if (!ed) return;
    const f = ed.form;
    if (!f.name.trim()) {
      this._formError = "请填写预设名称";
      return;
    }
    // 校验数字字段（空允许=不写；非空须是有效数字）
    for (const fd of FIELDS) {
      const raw = f[fd.key].trim();
      if (raw !== "" && Number.isNaN(Number(raw))) {
        this._formError = `${fd.label} 不是有效数字`;
        return;
      }
    }
    this._busy = true;
    this._formError = null;
    try {
      const collected = this._collect(f);
      if (ed.mode === "new") {
        await createPreset({ name: f.name.trim(), kind: "search", ...collected });
        this._setFlash(`已创建预设「${f.name.trim()}」`);
      } else if (ed.presetId) {
        await updatePreset(ed.presetId, { name: f.name.trim(), ...collected });
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
      await activatePreset(p.id);
      this._setFlash(`已切换到「${p.name}」`);
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

  private _summary(p: Preset): string {
    const parts = [
      `结果≤${p.max_results ?? "?"}`,
      `阈值${p.min_score_threshold ?? "?"}`,
      `权[${p.weight_keyword_match ?? "?"}/${p.weight_file_name_match ?? "?"}/${p.weight_fts_score ?? "?"}/${p.weight_title_match ?? "?"}/${p.weight_proximity_match ?? "?"}]`,
    ];
    return parts.join(" · ");
  }

  private _renderForm() {
    const ed = this._editing;
    if (!ed) return nothing;
    const f = ed.form;
    return html`
      <div class="form">
        <div class="full">
          <div class="field-label">名称</div>
          <input class="input" autocomplete="off" .value=${f.name} @input=${(e: Event) => this._setField("name", (e.target as HTMLInputElement).value)} />
        </div>
        ${FIELDS.map((fd) => html`
          <div>
            <div class="field-label">${fd.label} <span class="field-range">${fd.min}–${fd.max}</span></div>
            <input
              class="input"
              type="number"
              autocomplete="off"
              min=${fd.min}
              max=${fd.max}
              step=${fd.step}
              .value=${f[fd.key]}
              @input=${(e: Event) => this._setField(fd.key, (e.target as HTMLInputElement).value)}
            />
            <div class="field-hint">${fd.hint}</div>
          </div>
        `)}
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

  private _renderRow(p: Preset) {
    const active = this._isActive(p);
    const confirming = this._confirmDeleteId === p.id;
    return html`
      <div class="preset-row ${active ? "active" : ""}">
        <div class="preset-main">
          <div class="preset-name">
            ${p.name}
            ${active ? html`<span class="badge">当前</span>` : nothing}
          </div>
          <div class="preset-meta">${this._summary(p)}</div>
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
        <div class="head">
          <h2>搜索预设</h2>
          <span class="hint">一键切换搜索调优参数（结果过滤 + 评分权重）；切换即时生效。</span>
        </div>
        ${this._loading
          ? html`<div class="empty">加载中…</div>`
          : html`
            <div class="group">
              <div class="group-title">
                搜索调优
                <button class="icon-btn" @click=${() => this._openNew()}>+ 新建</button>
              </div>
              ${this._presets.length === 0
                ? html`<div class="empty">暂无预设，点「新建」创建一个。</div>`
                : html`<div class="preset-list">${this._presets.map((p) => this._renderRow(p))}</div>`}
              ${this._editing ? this._renderForm() : nothing}
            </div>
          `}
        ${this._error ? html`<div class="msg err">${this._error}</div>` : nothing}
        ${this._toast ? html`<div class="msg ok">${this._toast}</div>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "search-presets-section": SearchPresetsSection;
  }
}
