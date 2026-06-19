import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store } from "../state/store";
import { actions } from "../state/store";
import type { SettingsScope } from "../state/types";
import {
  SETTINGS_FIELDS,
  SETTINGS_TAB_LABELS,
  type SettingsField,
  type SettingsTab,
} from "./settings-fields";
import { getConfig, putConfig, ConfigApiError } from "../api/config";

const TAB_ORDER: SettingsTab[] = ["ai", "search", "scoring", "terminal"];

@customElement("settings-view")
export class SettingsView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: var(--cortex-bg);
      font-family: var(--cortex-font);
    }
    .tab-strip {
      display: flex;
      background: var(--cortex-surface);
      border-bottom: 1px solid var(--cortex-border);
      padding: 0 var(--cortex-space-8);
      overflow-x: auto;
      flex-shrink: 0;
    }
    .tab-strip button {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      padding: var(--cortex-space-3) var(--cortex-space-4);
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
    }
    .tab-strip button:hover { color: var(--cortex-text); }
    .tab-strip button.active {
      color: var(--cortex-primary);
      border-bottom-color: var(--cortex-primary);
      font-weight: 500;
    }
    .scroll-area {
      flex: 1;
      overflow-y: auto;
      padding: var(--cortex-space-6) var(--cortex-space-8) 120px;
      position: relative;
    }
    .tab-panel { display: none; max-width: 880px; margin: 0 auto; }
    .tab-panel.active { display: block; }

    .section {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      padding: var(--cortex-space-6);
      margin-bottom: var(--cortex-space-4);
    }
    .section h2 {
      margin: 0 0 var(--cortex-space-1) 0;
      font-size: var(--cortex-fs-md);
      font-weight: 600;
    }
    .section-desc {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin: 0 0 var(--cortex-space-4) 0;
    }
    .field {
      display: grid;
      grid-template-columns: minmax(220px, 280px) 1fr;
      gap: var(--cortex-space-6);
      padding: var(--cortex-space-3) 0;
      border-top: 1px solid var(--cortex-border-muted);
      align-items: start;
    }
    .field:first-of-type { border-top: none; }
    .field-label .name {
      font-size: var(--cortex-fs-base);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .field-label .env {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      margin-top: 2px;
    }
    .field-control { display: flex; flex-direction: column; gap: var(--cortex-space-1); }
    .field-control .row { display: flex; align-items: center; gap: var(--cortex-space-2); }
    .field-control .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }

    .input, .select {
      padding: 6px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      max-width: 420px;
    }
    .input.mono { font-family: var(--cortex-font-mono); }
    .input:focus, .select:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
    }

    .effect {
      display: inline-flex;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 500;
    }
    .effect.restart { background: rgba(245,158,11,0.12); color: var(--cortex-warning); }
    .effect.live { background: rgba(16,185,129,0.12); color: var(--cortex-success); }

    .info-box {
      background: var(--cortex-primary-soft);
      border-left: 3px solid var(--cortex-primary);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-sm);
      margin-bottom: var(--cortex-space-4);
      line-height: 1.7;
    }
    .info-box.warn {
      background: rgba(245,158,11,0.08);
      border-left-color: var(--cortex-warning);
    }

    .footer-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--cortex-surface);
      border-top: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3) var(--cortex-space-8);
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.04);
    }
    .dirty-status {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .dirty-dot {
      width: 8px; height: 8px;
      background: var(--cortex-warning);
      border-radius: 50%;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 6px 12px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-sm);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
      font-family: inherit;
    }
    .btn:hover { background: var(--cortex-surface-muted); }
    .btn.primary {
      background: var(--cortex-primary);
      border-color: var(--cortex-primary);
      color: #fff;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .copy-banner {
      background: var(--cortex-primary-soft);
      border-bottom: 1px solid var(--cortex-border);
      padding: var(--cortex-space-3) var(--cortex-space-8);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
    }
    .copy-banner .grow { flex: 1; }
  `;

  @state() private _activeTab: SettingsTab = "ai";
  @state() private _saving = false;
  @state() private _error: string | null = null;
  @state() private _toast: string | null = null;
  @state() private _values: Record<string, string> = {};
  @state() private _original: Record<string, string> = {};
  @state() private _exists = true;
  @state() private _scope: SettingsScope = "local";

  private _unsubscribe?: () => void;
  private _loadGen = 0;            // invalidate stale loads (I1)
  private _toastTimer?: number;    // clear on disconnect (I2)

  connectedCallback() {
    super.connectedCallback();
    const state = store.getState();
    this._scope = state.settings.scope;
    this._unsubscribe = store.subscribe(() => this._onStoreChange());
    this._load();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    // I2: clear any pending toast timer to avoid post-disconnect state writes
    if (this._toastTimer !== undefined) {
      window.clearTimeout(this._toastTimer);
      this._toastTimer = undefined;
    }
    // I1: invalidate any in-flight load so its resolution is a no-op
    this._loadGen += 1;
    super.disconnectedCallback();
  }

  private _onStoreChange() {
    const newState = store.getState();
    if (newState.settings.scope !== this._scope) {
      this._scope = newState.settings.scope;
      this._load();
    }
  }

  private async _load() {
    // I1: generation counter invalidates stale loads (e.g. when scope
    // changes before the previous fetch resolves, or when component is
    // disconnected mid-fetch).
    const gen = ++this._loadGen;
    this._error = null;
    try {
      const resp = await getConfig(this._scope);
      if (gen !== this._loadGen || !this.isConnected) return;
      this._values = { ...resp.values };
      this._original = { ...resp.values };
      this._exists = resp.exists;
      actions.loadSettings(resp.values, resp.exists);
    } catch (e: unknown) {
      if (gen !== this._loadGen || !this.isConnected) return;
      this._error = `加载失败: ${(e as Error).message}`;
    }
  }

  private get _dirtyFields(): string[] {
    const keys = new Set([...Object.keys(this._original), ...Object.keys(this._values)]);
    const changed: string[] = [];
    for (const k of keys) {
      if ((this._original[k] ?? "") !== (this._values[k] ?? "")) changed.push(k);
    }
    return changed;
  }

  private get _dirty(): boolean {
    return this._dirtyFields.length > 0;
  }

  private _onInput(envVar: string, value: string) {
    this._values = { ...this._values, [envVar]: value };
    actions.updateSetting(envVar, value);
  }

  private _revert() {
    this._values = { ...this._original };
    actions.revertSettings();
  }

  private async _save() {
    if (!this._dirty || this._saving) return;
    this._saving = true;
    // I5: clear any prior error so success toast isn't shown next to a stale error
    this._error = null;
    try {
      const result = await putConfig(this._scope, this._values);
      if (!this.isConnected) return;
      this._original = { ...this._values };
      actions.loadSettings(this._values, true);
      this._toast = result.needs_restart
        ? `已保存。重启 cortex gui 后 AI 配置生效。`
        : `已保存。下次查询立即生效。`;
      // I2: track timer so it can be cleared on disconnect
      this._toastTimer = window.setTimeout(() => {
        this._toast = null;
        this._toastTimer = undefined;
      }, 4000);
    } catch (e: unknown) {
      // I6: prefer typed ConfigApiError to extract per-field failure list
      let msg: string;
      if (e instanceof ConfigApiError) {
        const body = e.body as { fields?: { field: string; error: string }[] } | null;
        const failedFields = body?.fields?.map((f) => f.field).join(", ");
        msg = failedFields ? `保存失败（${failedFields}）` : `保存失败 (HTTP ${e.status})`;
      } else if (e instanceof Error) {
        msg = `保存失败: ${e.message}`;
      } else {
        msg = "保存失败: 未知错误";
      }
      this._error = msg;
    } finally {
      this._saving = false;
    }
  }

  private _renderField(f: SettingsField) {
    const value = this._values[f.envVar] ?? "";
    const effectBadge = f.effect
      ? html`<span class="effect ${f.effect}">${f.effect === "restart" ? "🔁 需重启" : "● 即时"}</span>`
      : nothing;
    return html`
      <div class="field">
        <div class="field-label">
          <div class="name">${f.label} ${effectBadge}</div>
          <div class="env">${f.envVar}${f.min !== undefined && f.max !== undefined ? ` · 范围 ${f.min}~${f.max}` : ""}</div>
        </div>
        <div class="field-control">
          <div class="row">${this._renderInput(f, value)}</div>
          ${f.hint ? html`<div class="hint">${f.hint}</div>` : nothing}
        </div>
      </div>
    `;
  }

  private _renderInput(f: SettingsField, value: string) {
    const mono = f.mono ? "mono" : "";
    const onInput = (e: Event) =>
      this._onInput(f.envVar, (e.target as HTMLInputElement | HTMLSelectElement).value);

    switch (f.component) {
      case "text":
        return html`
          <input
            class="input ${mono}"
            type="text"
            .value=${value}
            data-env=${f.envVar}
            @input=${onInput}
            list=${f.datalist ? `${f.envVar}-list` : nothing}
          />
          ${f.datalist ? html`
            <datalist id=${`${f.envVar}-list`}>
              ${f.datalist.map((d) => html`<option value=${d}></option>`)}
            </datalist>
          ` : nothing}
        `;
      case "password":
        return html`
          <div style="position: relative; max-width: 420px;">
            <input
              class="input ${mono}"
              type="password"
              .value=${value}
              data-env=${f.envVar}
              @input=${onInput}
            />
            <button
              class="btn"
              type="button"
              style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%); padding: 2px 8px; font-size: var(--cortex-fs-xs);"
              @click=${(e: Event) => {
                const input = (e.target as HTMLButtonElement).previousElementSibling as HTMLInputElement;
                input.type = input.type === "password" ? "text" : "password";
              }}
            >显示</button>
          </div>
        `;
      case "number":
        return html`
          <input
            class="input"
            type="number"
            .value=${value}
            min=${f.min ?? nothing}
            max=${f.max ?? nothing}
            step=${f.step ?? nothing}
            data-env=${f.envVar}
            @input=${onInput}
          />
          ${f.unit ? html`<span style="font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle);">${f.unit}</span>` : nothing}
        `;
      case "select":
        return html`
          <select class="select" .value=${value} data-env=${f.envVar} @change=${onInput}>
            ${(f.options ?? []).map((opt) => html`
              <option value=${opt.value} ?selected=${opt.value === value}>${opt.label}</option>
            `)}
          </select>
        `;
      case "slider":
        return html`
          <input
            class="input"
            type="number"
            .value=${value}
            min=${f.min ?? nothing}
            max=${f.max ?? nothing}
            step=${f.step ?? nothing}
            style="width: 100px;"
            data-env=${f.envVar}
            @input=${onInput}
          />
          <input
            type="range"
            .value=${value}
            min=${f.min ?? nothing}
            max=${f.max ?? nothing}
            step=${f.step ?? nothing}
            style="flex: 1; max-width: 280px;"
            @input=${onInput}
          />
        `;
      default:
        return nothing;
    }
  }

  private _renderInfoBox(tab: SettingsTab) {
    if (tab === "ai") {
      return html`
        <div class="info-box">
          本 tab 的所有参数修改后需<strong>重启 cortex gui</strong> 才能生效。
        </div>
      `;
    }
    if (tab === "search") {
      return html`<div class="info-box">本 tab 的参数保存后下次查询即时生效，<strong>无需重启</strong>。</div>`;
    }
    if (tab === "scoring") {
      return html`
        <div class="info-box">
          <strong>📐 评分原理（白话版）</strong><br>
          最终得分（0~1）= 把下面 5 个信号<strong>按权重做加权平均</strong>（每个信号名对应下方一个"XX 权重"字段）：<br>
          • <strong>关键词匹配</strong> —— 文档里命中的关键词数 ÷ 你查询的总词数<br>
          • <strong>文件名匹配</strong> —— 文件名里命中的关键词数 ÷ 总词数<br>
          • <strong>FTS 原始分</strong> —— FTS5 全文检索给的相关度（0~1 之间）<br>
          • <strong>标题匹配</strong> —— 段落标题里命中的关键词数 ÷ 总词数<br>
          • <strong>邻近度</strong> —— 0 / 0.5 / 1 三档（多词紧挨着分数更高）<br><br>
          每个权重<strong>越大</strong>，对应信号对最终排序的影响越大；权重设为 <code>0</code> = <strong>完全忽略</strong>该信号。推荐区间 <code>0~10</code>。
        </div>
      `;
    }
    if (tab === "terminal") {
      return html`
        <div class="info-box warn">
          ⚠️ 这些参数仅影响 <code>cortex</code> CLI/TUI 的<strong>终端输出格式</strong>，对 Web UI 没有可见效果。在此处提供编辑仅为了免去手动改 .env 的麻烦。
        </div>
      `;
    }
    return nothing;
  }

  render() {
    const scopeLabel = this._scope === "local" ? "本地" : "全局";
    const existsHint = this._exists ? "" : "（新建）";
    return html`
      <nav class="tab-strip" role="tablist">
        ${TAB_ORDER.map((tab) => html`
          <button
            class=${this._activeTab === tab ? "active" : ""}
            @click=${() => { this._activeTab = tab; }}
          >${SETTINGS_TAB_LABELS[tab]}</button>
        `)}
      </nav>

      <div class="scroll-area">
        ${TAB_ORDER.map((tab) => {
          const fields = SETTINGS_FIELDS.filter((f) => f.tab === tab);
          const sections: { title: string; desc?: string; fields: SettingsField[] }[] = [];
          for (const f of fields) {
            let s = sections.find((x) => x.title === f.section);
            if (!s) { s = { title: f.section, fields: [] }; sections.push(s); }
            s.fields.push(f);
          }
          return html`
            <div class="tab-panel ${this._activeTab === tab ? "active" : ""}" data-panel=${tab}>
              ${this._renderInfoBox(tab)}
              ${sections.map((s) => html`
                <div class="section">
                  <h2>${s.title}</h2>
                  ${s.fields.map((f) => this._renderField(f))}
                </div>
              `)}
            </div>
          `;
        })}

        <div class="footer-bar">
          <div class="dirty-status">
            ${this._dirty
              ? html`<span class="dirty-dot"></span><span>有 <strong>${this._dirtyFields.length}</strong> 个字段已修改</span>`
              : html`<span style="font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle);">所有字段与 .env 一致</span>`
            }
            ${this._error ? html`<span style="color: var(--cortex-danger); margin-left: var(--cortex-space-2);">${this._error}</span>` : nothing}
            ${this._toast ? html`<span style="color: var(--cortex-success); margin-left: var(--cortex-space-2);">${this._toast}</span>` : nothing}
          </div>
          <div style="display: flex; gap: var(--cortex-space-2);">
            <button class="btn" ?disabled=${!this._dirty || this._saving} @click=${() => this._revert()}>放弃修改</button>
            <button class="btn primary" ?disabled=${!this._dirty || this._saving} @click=${() => this._save()}>
              ${this._saving ? "保存中…" : `💾 保存${scopeLabel}配置${existsHint}`}
            </button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "settings-view": SettingsView;
  }
}
