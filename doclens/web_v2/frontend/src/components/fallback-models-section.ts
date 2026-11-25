/** 兜底模型清单区块（设置页 AI tab，ADR-0061）。
 *
 * 用户维护一份**有序**的 LLM 预设列表；主模型额度耗尽时按此顺序（同供应商
 * 提权）切到第一个可用的兜底。本区块只管清单；两个预检阈值是普通配置
 * 字段（settings-fields「兜底模型」section，走设置页统一保存）。
 *
 * 交互：已选列表 ↑/↓ 调序 + 移除；底部下拉「添加」把未入选的 LLM 预设
 * 追加到末尾。每次改动即 PUT（保存即生效，下一回合起）。
 */
import { LitElement, html, css, nothing } from "lit";
import { settingsSectionStyles } from "../styles/settings-section-styles";
import { customElement, property, state } from "lit/decorators.js";

import {
  getFallbackOrder,
  listPresets,
  PresetsApiError,
  setFallbackOrder,
  type Preset,
} from "../api/presets";
import { ToastFlashMixin, apiErrMsg } from "../utils/section-mixins";

const errMsg = (e: unknown) => apiErrMsg(e, PresetsApiError);

@customElement("fallback-models-section")
export class FallbackModelsSection extends ToastFlashMixin(LitElement) {
  static styles = [settingsSectionStyles, css`
    .group {
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
    .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      margin: 0 0 var(--cortex-space-3);
      line-height: 1.5;
    }
    .fb-list { display: flex; flex-direction: column; gap: var(--cortex-space-2); }
    .fb-row {
      display: flex; align-items: center; gap: var(--cortex-space-3);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
    }
    .fb-idx {
      flex-shrink: 0; width: 22px; text-align: center;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
    }
    .fb-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .fb-name { font-size: var(--cortex-fs-sm); font-weight: 600; }
    .fb-name .cur {
      margin-left: 6px; padding: 0 6px; border-radius: 999px;
      font-size: var(--cortex-fs-xs); font-weight: 500;
      background: var(--cortex-primary-soft); color: var(--cortex-primary);
    }
    .fb-meta {
      font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .fb-actions { display: flex; gap: var(--cortex-space-1); flex-shrink: 0; }
    .fb-actions .icon-btn { min-width: 30px; }
    .fb-add {
      display: flex; gap: var(--cortex-space-2); align-items: center;
      margin-top: var(--cortex-space-3);
    }
    .fb-add select {
      flex: 1; min-width: 0;
      padding: 4px 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-btn-radius);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-family: inherit; font-size: var(--cortex-fs-sm);
    }
    @media (max-width: 1023px) {
      .fb-row { flex-wrap: wrap; }
      .fb-actions { width: 100%; justify-content: flex-end; }
    }
  `];

  /** 当前激活的 LLM 预设名（settings-view 传入，标「当前」徽标）。 */
  @property() activeLlm = "";

  @state() private _llm: Preset[] = [];
  @state() private _order: string[] = [];
  @state() private _loading = true;
  @state() private _busy = false;
  @state() private _error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    void this._load();
  }

  private async _load() {
    this._error = null;
    try {
      const [presets, order] = await Promise.all([listPresets("llm"), getFallbackOrder()]);
      this._llm = presets;
      // 清单里可能含已删预设（后端读取已剔除，这里再过滤一次防竞态）
      const ids = new Set(presets.map((p) => p.id));
      this._order = order.filter((id) => ids.has(id));
    } catch (e) {
      this._error = `加载兜底清单失败: ${errMsg(e)}`;
    } finally {
      this._loading = false;
    }
  }

  private get _byId(): Map<string, Preset> {
    return new Map(this._llm.map((p) => [p.id, p]));
  }

  private get _unselected(): Preset[] {
    const inOrder = new Set(this._order);
    return this._llm.filter((p) => !inOrder.has(p.id));
  }

  private async _commit(next: string[]) {
    this._busy = true;
    this._error = null;
    try {
      this._order = await setFallbackOrder(next);
    } catch (e) {
      this._error = `保存兜底清单失败: ${errMsg(e)}`;
    } finally {
      this._busy = false;
    }
  }

  private _move(idx: number, delta: -1 | 1) {
    const j = idx + delta;
    if (j < 0 || j >= this._order.length) return;
    const next = [...this._order];
    [next[idx], next[j]] = [next[j], next[idx]];
    void this._commit(next);
  }

  private _remove(idx: number) {
    void this._commit(this._order.filter((_, i) => i !== idx));
  }

  private _add(e: Event) {
    const sel = e.target as HTMLSelectElement;
    const id = sel.value;
    sel.value = "";
    if (!id || this._order.includes(id)) return;
    void this._commit([...this._order, id]);
  }

  private _isActive(p: Preset): boolean {
    return !!this.activeLlm && p.name.trim().toLowerCase() === this.activeLlm.trim().toLowerCase();
  }

  private _renderRow(id: string, idx: number) {
    const p = this._byId.get(id);
    if (!p) return nothing;
    const active = this._isActive(p);
    const meta = `${p.model_id || "（未设模型）"} · ${p.protocol}${p.vision ? " · 视觉" : ""}`;
    return html`
      <div class="fb-row">
        <span class="fb-idx">${idx + 1}</span>
        <div class="fb-main">
          <div class="fb-name">${p.name}${active ? html`<span class="cur">当前</span>` : nothing}</div>
          <div class="fb-meta">${meta}</div>
        </div>
        <div class="fb-actions">
          <button class="icon-btn" title="上移" ?disabled=${this._busy || idx === 0}
            @click=${() => this._move(idx, -1)}>↑</button>
          <button class="icon-btn" title="下移"
            ?disabled=${this._busy || idx === this._order.length - 1}
            @click=${() => this._move(idx, 1)}>↓</button>
          <button class="icon-btn danger" title="从清单移除" ?disabled=${this._busy}
            @click=${() => this._remove(idx)}>移除</button>
        </div>
      </div>
    `;
  }

  render() {
    const unselected = this._unselected;
    return html`
      <div class="wrap">
        <div class="group">
          <div class="group-title">兜底模型</div>
          <p class="hint">
            主模型套餐额度耗尽时，按此顺序自动切换到可用的兜底模型，本回合继续进行（不改变当前激活预设）。
            同供应商的兜底会优先（同模型 ID 者最佳——等于换账号续跑）；带图的回合只选支持视觉的预设。
            兜底模型需支持工具调用。保存即生效（下一回合起）。
          </p>
          ${this._loading
            ? html`<div class="empty">加载中…</div>`
            : this._order.length === 0
              ? html`<div class="empty">未配置兜底模型。主模型额度耗尽时回合将报错结束。</div>`
              : html`<div class="fb-list">${this._order.map((id, i) => this._renderRow(id, i))}</div>`}
          ${unselected.length > 0
            ? html`<div class="fb-add">
                <select @change=${this._add} ?disabled=${this._busy}>
                  <option value="">+ 添加兜底模型…</option>
                  ${unselected.map(
                    (p) => html`<option value=${p.id}>${p.name}（${p.model_id || "?"}）</option>`,
                  )}
                </select>
              </div>`
            : nothing}
          ${this._error ? html`<div class="msg err">${this._error}</div>` : nothing}
          ${this._toast ? html`<div class="msg ok">${this._toast}</div>` : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "fallback-models-section": FallbackModelsSection;
  }
}
