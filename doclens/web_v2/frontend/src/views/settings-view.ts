import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { store } from "../state/store";
import { actions } from "../state/store";
import { router } from "../router/router";
import type { SettingsScope } from "../state/types";
import {
  SETTINGS_FIELDS,
  SETTINGS_TAB_LABELS,
  FIELD_DEFAULTS,
  IMPLICIT_DEFAULTS,
  type SettingsField,
  type SettingsTab,
} from "./settings-fields";
import { getConfig, putConfig, ConfigApiError } from "../api/config";
import { getStatus } from "../api/status";
import "../components/toast-stack";
import "../components/password-section";
import "../components/model-presets-section";
import "../components/search-presets-section";
import type { ToastStack } from "../components/toast-stack";

const TAB_ORDER: SettingsTab[] = ["ai", "search", "network"];

/** 三个 tab 的线框 icon（Lucide outline，见 <doclens-icon>）。 */
const TAB_ICONS: Record<SettingsTab, string> = {
  ai: "sparkles",
  search: "search",
  network: "globe",
};

/** Lucide 风格眼睛图标（密码隐藏）：闭合眼 + 圆瞳 */
const ICON_EYE = html`
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
`;

/** Lucide 风格眼睛-off 图标（密码可见）：带斜杠 */
const ICON_EYE_OFF = html`
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
    <line x1="2" x2="22" y1="2" y2="22"/>
  </svg>
`;

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
    /* ===== 桌面端 F1 布局：左 sidebar（scope+垂直 tab）+ 右 main（panel/footer 居中对齐）===== */
    .layout {
      display: flex;
      flex-direction: row;
      flex: 1;
      min-height: 0;
    }
    .sidebar {
      width: 180px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-6) var(--cortex-space-3);
      background: var(--cortex-surface);
      border-right: 1px solid var(--cortex-border-muted);
      overflow-y: auto;
    }
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
    }
    .tab-strip {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tab-strip button {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      background: transparent;
      border: none;
      padding: var(--cortex-space-2) var(--cortex-space-4);
      font-size: 14px;
      font-weight: 600;
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      border-radius: var(--cortex-radius-lg);
      transition: background 0.15s ease, color 0.15s ease;
    }
    .tab-strip button doclens-icon {
      font-size: 16px;
      flex-shrink: 0;
    }
    .tab-strip button:hover {
      color: var(--cortex-text);
    }
    .tab-strip button.active {
      background: rgba(0, 100, 224, 0.15);
      color: var(--cortex-primary);
    }
    .scroll-area {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--cortex-space-4);
    }
    .tab-panel { display: none; max-width: 880px; margin: 0 auto; }
    .tab-panel.active { display: block; }

    .section {
      padding: 0 0 var(--cortex-space-6);
      margin-bottom: var(--cortex-space-2);
    }
    .section + .section {
      padding-top: var(--cortex-space-5);
    }
    .section h2 {
      margin: 0 0 var(--cortex-space-3);
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      color: var(--cortex-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1.3;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      background: var(--cortex-surface-muted);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
    }
    .section-desc {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin: 0 0 var(--cortex-space-4) 0;
    }
    .field {
      display: grid;
      grid-template-columns: minmax(80px, 140px) 1fr;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-2) 0;
      align-items: center;
    }
    .field:first-of-type { border-top: none; }
    .field-label .name {
      font-size: var(--cortex-fs-sm);
      font-weight: 400;
      color: var(--cortex-text);
      line-height: 1.5;
    }
    .field-control { display: flex; flex-direction: column; gap: var(--cortex-space-1); }
    /* password wrapper：撑满父容器 + 让"显示"按钮内嵌右侧 */
    .password-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      max-width: 100%;
    }
    .password-wrap .input { padding-right: 44px; max-width: 100%; }
    .password-toggle {
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      color: var(--cortex-text-muted);
      background: transparent;
      border: none;
      border-radius: var(--cortex-radius-sm);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .password-toggle:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    /* CSS-only icon swap：模板里两个 span 都在 DOM，class 控制可见性，
       避免 render() 在 shadow DOM 中因 cached template 不挂载导致 SVG 丢失 */
    .password-toggle .eye-hide { display: none; }
    .password-toggle.revealed .eye-show { display: none; }
    .password-toggle.revealed .eye-hide { display: inline-flex; }
    .field-control .row { display: flex; align-items: center; gap: var(--cortex-space-2); }
    .slider-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
    }
    /* 布尔开关（switch 组件）：轨道 + 滑块，选中态用主色 */
    .switch {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      cursor: pointer;
      user-select: none;
    }
    .switch input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
    .switch .track {
      width: 36px;
      height: 20px;
      border-radius: 999px;
      background: var(--cortex-border);
      position: relative;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .switch .thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.15s;
    }
    .switch input:checked + .track { background: var(--cortex-primary); }
    .switch input:checked + .track .thumb { transform: translateX(16px); }
    .switch input:focus-visible + .track {
      outline: 2px solid var(--cortex-primary);
      outline-offset: 1px;
    }
    .switch .switch-text {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .slider-row input[type="range"] {
      accent-color: var(--cortex-primary);
      flex: 1;
    }
    .slider-row .value-chip { display: none; }
    .value-chip {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      border-radius: var(--cortex-radius-sm);
      padding: 2px var(--cortex-space-2);
      font-variant-numeric: tabular-nums;
    }

    /* 常驻描述行（仅 search tab 渲染，见 _renderDesc） */
    .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      line-height: 1.4;
      margin-top: 2px;
    }
    /* .field 是双列 grid，desc 独占一行通栏显示 */
    .field .desc { grid-column: 1 / -1; }

    /* 权重区：桌面两列网格 */
    .weights-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--cortex-space-4) var(--cortex-space-6);
    }
    .w-item { min-width: 0; }
    .w-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-2);
      margin-bottom: 2px;
    }
    .w-name {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text);
    }
    /* 未显式设置、回显默认值的徽章：弱化样式与显式值区分 */
    .value-chip.implicit {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-muted);
    }
    .w-slider {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-1);
    }
    .w-slider input[type="range"] {
      flex: 1;
      accent-color: var(--cortex-primary);
    }
    .w-end {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      min-width: 14px;
      text-align: center;
    }

    .input, .select {
      padding: 9px 12px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    /* toggle 开关（bool 配置项，如「启用 MCP server」） */
    .toggle {
      display: inline-flex; align-items: center; gap: var(--cortex-space-2);
      cursor: pointer; user-select: none;
    }
    .toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
    .toggle-track {
      width: 36px; height: 20px; border-radius: 10px;
      background: var(--cortex-border-muted);
      position: relative; transition: background 0.15s; flex-shrink: 0;
    }
    .toggle-thumb {
      position: absolute; top: 2px; left: 2px;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--cortex-surface);
      transition: transform 0.15s;
    }
    .toggle input:checked + .toggle-track { background: var(--cortex-primary); }
    .toggle input:checked + .toggle-track .toggle-thumb { transform: translateX(16px); }
    .toggle input:focus-visible + .toggle-track { box-shadow: var(--cortex-focus-ring); }
    .toggle-label { font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle); }
    .input:hover:not(:focus), .select:hover:not(:focus) {
      border-color: var(--cortex-text-muted);
    }
    .input.mono { font-family: var(--cortex-font-mono); }
    .input:focus, .select:focus {
      outline: none;
      border-color: var(--cortex-primary);
      background: var(--cortex-surface);
      box-shadow: var(--cortex-focus-ring);
    }

    .footer-bar {
      flex-shrink: 0;
      background: var(--cortex-surface);
      border-top: 1px solid var(--cortex-border-muted);
      padding: var(--cortex-space-4) var(--cortex-space-6);
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 -1px 0 var(--cortex-border-muted);
      max-width: 880px;
      width: 100%;
      margin: var(--cortex-space-4) auto 0;
      box-sizing: border-box;
      border-radius: var(--cortex-radius-lg) var(--cortex-radius-lg) 0 0;
    }
    .dirty-status {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .dirty-dot {
      display: inline-block;
      width: 8px; height: 8px;
      background: var(--cortex-warning);
      border-radius: 50%;
      margin-right: var(--cortex-space-2);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cortex-space-2);
      padding: 8px 14px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-sm);
      font-weight: 500;
      border-radius: var(--cortex-radius-pill);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s, transform 0.05s;
    }
    .btn:hover { background: var(--cortex-surface-muted); border-color: var(--cortex-text-muted); }
    .btn:active { transform: translateY(0.5px); }
    .btn.primary {
      background: var(--cortex-btn-primary-bg);
      border: none;
      color: var(--cortex-btn-primary-text);
      font-weight: 600;
    }
    .btn.primary:hover { filter: brightness(1.05); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    /* 关闭按钮加宽：与保存并列时点击目标更大 */
    .btn.close { padding-left: var(--cortex-space-6); padding-right: var(--cortex-space-6); }

    /* ===== 移动端 (<1024px) ===== */
    @media (max-width: 1023px) {
      /* F1 移动端单列回退：scope+tab 回到顶部水平条，整体滚动，footer 吸底保留。
         注意：.layout/.main/.scroll-area 必须 flex: none 让盒子随内容撑高，
         否则被 flex 压缩后 overflow:visible 只是"看得见"，底部 padding 无效。 */
      :host { overflow-y: auto; }
      .layout { flex-direction: column; flex: none; min-height: 0; overflow: visible; }
      .sidebar {
        width: 100%;
        flex-direction: column;
        gap: var(--cortex-space-2);
        padding: var(--cortex-space-3) var(--cortex-space-4);
        border-right: none;
        border-bottom: 1px solid var(--cortex-border);
        overflow: visible;
        flex-shrink: 0;
      }
      .main { overflow: visible; min-height: 0; flex: none; }
      .scroll-area { overflow: visible; flex: none; }
      .tab-strip { flex-direction: row; overflow-x: auto; }
      .tab-strip button {
        justify-content: center;
        text-align: center;
        white-space: nowrap;
      }

      .section h2 {
        margin-left: calc(-1 * var(--cortex-space-4));
        margin-right: calc(-1 * var(--cortex-space-4));
      }
      .scroll-area {
        padding: 0 var(--cortex-space-4) var(--cortex-space-6);
      }

      /* 移动端保留 footer（保存按钮唯一入口）：fixed 吸底。
         设置页全屏覆盖 tab-bar 区域（app.ts 在 settings 视图隐藏 tab-bar），
         故 bottom: 0，并为刘海屏留出安全区。
         不用 sticky —— .layout/.main 被 flex 压缩后盒子包不住内容，sticky 会失效。 */
      .footer-bar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 20;
        margin: 0;
        border-radius: 0;
        padding: var(--cortex-space-2) var(--cortex-space-3);
        padding-bottom: calc(var(--cortex-space-2) + env(safe-area-inset-bottom, 0px));
        flex-wrap: nowrap;
        align-items: center;
        gap: var(--cortex-space-2);
        box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
      }
      /* 给 fixed footer 让位：padding 必须加在随内容撑高的 .scroll-area 上，
         加在 .main 上会像 sticky 一样被 flex 压缩吞掉 */
      .scroll-area { padding-bottom: 120px; }
      /* 状态区压缩：移动端只留脏标记圆点 + 错误/成功提示，说明文字省略 */
      .footer-bar .dirty-status { flex: 0 0 auto; font-size: var(--cortex-fs-xs); gap: var(--cortex-space-1); }
      .footer-bar .dirty-status .dirty-text { display: none; }
      .footer-bar .dirty-dot { margin-right: 0; }
      /* 按钮单行不折行：revert 幽灵小按钮，save 主按钮撑满剩余空间 */
      .footer-bar .footer-actions { flex: 1; display: flex; gap: var(--cortex-space-2); min-width: 0; }
      .footer-bar .btn {
        white-space: nowrap;
        min-height: 40px;
        padding: 6px var(--cortex-space-3);
      }
      .footer-bar .btn.primary { flex: 1; justify-content: center; }
      /* 移动端关闭按钮与保存等宽分摊剩余空间 */
      .footer-bar .btn.close { flex: 1; justify-content: center; }

      .input, .select { max-width: 100%; }

      /* 权重区移动端回退单列 */
      .weights-grid { grid-template-columns: 1fr; }

      /* Slider 单控件 + 数值 chip */
      .slider-row {
        display: flex;
        flex-direction: column;
        gap: var(--cortex-space-2);
      }
      .slider-row input[type="number"] { display: none; }
      .slider-row input[type="range"] {
        max-width: 100%;
        width: 100%;
        flex: 1;
      }
      /* 需压过桌面端 .slider-row .value-chip { display: none } 的优先级 */
      .slider-row .value-chip {
        display: inline-block;
        align-self: flex-start;
        font-size: var(--cortex-fs-md);
        font-weight: 600;
      }

      /* Password 显示按钮：mobile 仍嵌在 input 内右侧，与桌面布局一致 */
      .password-wrap { max-width: 100% !important; position: relative !important; }
      .password-toggle {
        position: absolute !important;
        right: var(--cortex-space-2) !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
      }

      /* Toast-stack 避开移动 tab-bar */
      toast-stack {
        bottom: calc(56px + env(safe-area-inset-bottom, 0px) + 12px);
        right: 12px;
        left: 12px;
        width: auto;
      }
      toast-stack .toast { max-width: 100%; }

      /* 字段错误红字 */
      .field-error {
        font-size: var(--cortex-fs-xs);
        color: var(--cortex-danger);
        margin-top: var(--cortex-space-1);
      }

      /* ===== Mobile polish: tightened spacing ===== */
      .section {
        padding: var(--cortex-space-4);
        margin-bottom: var(--cortex-space-3);
      }
      .tab-strip {
        gap: 4px;
      }
      .tab-strip button {
        padding: var(--cortex-space-3) var(--cortex-space-2);
        font-size: var(--cortex-fs-sm);
      }
    }
  `;

  @state() private _activeTab: SettingsTab = "ai";
  @state() private _saving = false;
  @state() private _error: string | null = null;
  @state() private _toast: string | null = null;
  @state() private _values: Record<string, string> = {};
  @state() private _original: Record<string, string> = {};
  @state() private _exists = true;
  @state() private _scope: SettingsScope = "global";
  @state() private _fieldErrors: Record<string, string> = {};

  private _unsubscribe?: () => void;
  private _loadGen = 0;            // invalidate stale loads (I1)
  private _toastTimer?: number;    // clear on disconnect (I2)

  connectedCallback() {
    super.connectedCallback();
    const state = store.getState();
    this._scope = state.settings.scope;
    this._unsubscribe = store.subscribe(() => this._onStoreChange());
    window.addEventListener("cortex:revert-settings", this._onRevertRequest);
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
    window.removeEventListener("cortex:revert-settings", this._onRevertRequest);
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
      this._fieldErrors = {};
      actions.loadSettings(this._values, resp.exists);
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

  private _updateValues(updates: Record<string, string>) {
    this._values = { ...this._values, ...updates };
    for (const [envVar, value] of Object.entries(updates)) {
      actions.updateSetting(envVar, value);
    }
  }

  private _onInput(envVar: string, value: string) {
    this._updateValues({ [envVar]: value });
  }

  private _isMobile(): boolean {
    return typeof window.matchMedia === "function"
      && window.matchMedia("(max-width: 1023px)").matches;
  }

  private _pushToast(message: string, level: "success" | "error" | "info" = "info", duration = 2500) {
    const stack = this.shadowRoot?.querySelector("toast-stack") as ToastStack | null;
    stack?.pushToast(message, level, duration);
  }

  private _extractFieldErrors(e: unknown): Record<string, string> {
    if (e instanceof ConfigApiError) {
      const body = e.body as { fields?: { field: string; error: string }[] } | null;
      const out: Record<string, string> = {};
      for (const f of body?.fields ?? []) out[f.field] = f.error;
      return out;
    }
    return {};
  }

  private _onRevertRequest = () => { this._revert(); };

  /** 关闭设置页：返回进入设置前的主视图（未访问过则回默认 search）。 */
  private _close() {
    router.navigate(router.lastMain());
  }

  /** 重新拉取 /api/status，同步 store 中的 model_name 等展示用字段。
   *  失败静默：模型名为空时 UI 仅显示「思考中」，不阻塞其它逻辑。 */
  private async _refreshSystemStatus() {
    try {
      const s = await getStatus();
      actions.setStatus(s);
    } catch {
      /* 静默失败 */
    }
  }

  private _revert() {
    this._values = { ...this._original };
    actions.revertSettings();
  }

  private async _save() {
    if (!this._dirty || this._saving) return;
    this._saving = true;
    this._error = null;
    this._fieldErrors = {};
    try {
      const result = await putConfig(this._scope, this._values);
      if (!this.isConnected) return;
      this._original = { ...this._values };
      actions.loadSettings(this._values, true);
      // 重新拉一次 /api/status：settings-view 和 chat-view 共享 store.status，
      // 旧值在 connectedCallback 一次性载入后不会自动更新。不刷新的话，
      // 用户改了 PLANIFY_MODEL_ID 后去 chat 提问，思考中占位仍显示旧 model。
      void this._refreshSystemStatus();
      const msg = result.needs_restart
        ? "已保存。重启 doclens gui 后 AI 配置生效。"
        : "已保存。下次查询立即生效。";
      if (this._isMobile()) {
        this._pushToast(msg, "success", 4000);
      } else {
        this._toast = msg;
      }
    } catch (e: unknown) {
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
      if (this._isMobile()) {
        this._pushToast(msg, "error", 5000);
        this._fieldErrors = this._extractFieldErrors(e);
      } else {
        this._error = msg;
      }
    } finally {
      this._saving = false;
    }
  }

  private _renderField(f: SettingsField) {
    const value = this._values[f.envVar] ?? "";
    return html`
      <div class="field">
        <div class="field-label">
          <div class="name">${f.label}</div>
        </div>
        <div class="field-control">
          <div class="row">${this._renderInput(f, value)}</div>
          ${this._fieldErrors[f.envVar] ? html`<div class="field-error">${this._fieldErrors[f.envVar]}</div>` : nothing}
        </div>
        ${this._renderDesc(f)}
      </div>
    `;
  }

  /** 常驻描述行：hint（去末尾句号）+ 取值范围。仅 search tab 渲染。 */
  private _renderDesc(f: SettingsField) {
    if (f.tab !== "search" || !f.hint) return nothing;
    const base = f.hint.replace(/。$/, "");
    const range = f.min != null && f.max != null ? ` · ${f.min}–${f.max}` : "";
    return html`<div class="desc">${base}${range}</div>`;
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
            placeholder=${IMPLICIT_DEFAULTS[f.envVar] ?? nothing}
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
          <div class="password-wrap">
            <input
              class="input ${mono}"
              type="password"
              .value=${value}
              data-env=${f.envVar}
              @input=${onInput}
            />
            <button
              class="password-toggle"
              type="button"
              aria-label="显示密码"
              @click=${(e: Event) => {
                const btn = e.currentTarget as HTMLButtonElement;
                const input = btn.previousElementSibling as HTMLInputElement;
                const revealed = btn.classList.toggle("revealed");
                input.type = revealed ? "text" : "password";
                btn.setAttribute("aria-label", revealed ? "隐藏密码" : "显示密码");
              }}
            >
              <span class="eye-show">${ICON_EYE}</span>
              <span class="eye-hide">${ICON_EYE_OFF}</span>
            </button>
          </div>
        `;
      case "number":
        return html`
          <input
            class="input"
            type="number"
            .value=${value}
            placeholder=${IMPLICIT_DEFAULTS[f.envVar] ?? nothing}
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
      case "switch": {
        // 布尔开关：值域 "true"/"false"；未显式设置（.env 无此键）时
        // 回显出厂默认（FIELD_DEFAULTS），并标注（默认）
        const implicit = value === "";
        const on = implicit
          ? (FIELD_DEFAULTS[f.envVar] ?? "true") === "true"
          : value === "true";
        const onChange = (e: Event) =>
          this._onInput(f.envVar, (e.target as HTMLInputElement).checked ? "true" : "false");
        return html`
          <label class="switch">
            <input
              type="checkbox"
              .checked=${on}
              data-env=${f.envVar}
              @change=${onChange}
            />
            <span class="track"><span class="thumb"></span></span>
            <span class="switch-text">${on ? "已启用" : "已停用"}${implicit ? "（默认）" : ""}</span>
          </label>
        `;
      }
      case "slider": {
        // 未显式设置时回显后端默认值（隐式样式），避免空值拖杆停在中点、chip 空白
        const implicit = value === "";
        const eff = implicit
          ? (IMPLICIT_DEFAULTS[f.envVar] ?? String(f.min ?? 0))
          : value;
        return html`
          <div class="slider-row">
            <input
              class="input"
              type="number"
              .value=${eff}
              min=${f.min ?? nothing}
              max=${f.max ?? nothing}
              step=${f.step ?? nothing}
              style="width: 100px;"
              data-env=${f.envVar}
              @input=${onInput}
            />
            <input
              type="range"
              min=${f.min ?? nothing}
              max=${f.max ?? nothing}
              step=${f.step ?? nothing}
              .value=${eff}
              @input=${onInput}
            />
            <span class="value-chip ${implicit ? "implicit" : ""}" data-role="value-chip">${eff}</span>
          </div>
        `;
      }
      case "toggle":
        return html`
          <label class="toggle">
            <input
              type="checkbox"
              ?checked=${value === "true"}
              data-env=${f.envVar}
              @change=${(e: Event) =>
                this._onInput(f.envVar, (e.target as HTMLInputElement).checked ? "true" : "false")}
            />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span class="toggle-label">${value === "true" ? "开启" : "关闭"}</span>
          </label>
        `;
      default:
        return nothing;
    }
  }

  render() {
    const scopeLabel = "全局";
    const existsHint = this._exists ? "" : "（新建）";
    return html`
      <div class="layout">
        <aside class="sidebar">
          <nav class="tab-strip" role="tablist">
            ${TAB_ORDER.map((tab) => html`
              <button
                class=${this._activeTab === tab ? "active" : ""}
                @click=${() => { this._activeTab = tab; }}
              ><doclens-icon name=${TAB_ICONS[tab]}></doclens-icon>${SETTINGS_TAB_LABELS[tab]}</button>
            `)}
          </nav>
        </aside>
        <main class="main">
          <div class="scroll-area">
            ${TAB_ORDER.map((tab) => {
              const fields = SETTINGS_FIELDS.filter((f) => f.tab === tab);
              const sections: { title: string; desc?: string; fields: SettingsField[] }[] = [];
              for (const f of fields) {
                const key = f.section ?? "";
                let s = sections.find((x) => x.title === key);
                if (!s) { s = { title: key, fields: [] }; sections.push(s); }
                s.fields.push(f);
              }
              return html`
                <div class="tab-panel ${this._activeTab === tab ? "active" : ""}" data-panel=${tab}>
                  ${tab === "ai" ? html`
                    <model-presets-section
                      .activeLlm=${this._values["CORTEX_ACTIVE_LLM_PRESET"] ?? ""}
                      .activeVision=${this._values["CORTEX_ACTIVE_VISION_PRESET"] ?? ""}
                      @presets-activated=${() => {
                        this._load();
                        // 切换 LLM/视觉预设后后端已 reload_config，重拉 /api/status
                        // 同步 store.status.model_name，否则 chat 思考占位仍显示旧模型
                        void this._refreshSystemStatus();
                      }}
                    ></model-presets-section>
                  ` : nothing}
                  ${tab === "search" ? html`
                    <search-presets-section
                      .activeSearch=${this._values["CORTEX_ACTIVE_SEARCH_PRESET"] ?? ""}
                      @presets-activated=${() => this._load()}
                    ></search-presets-section>
                  ` : nothing}
                  ${sections.map((s) => html`
                    <div class="section">
                      ${s.title ? html`<h2>${s.title}</h2>` : nothing}
                      ${s.fields.map((f) => this._renderField(f))}
                    </div>
                  `)}
                  ${tab === "network" ? html`<password-section></password-section>` : nothing}
                </div>
              `;
            })}
          </div>
          <div class="footer-bar">
            <div class="dirty-status">
              ${this._dirty
                ? html`<span class="dirty-dot"></span><span class="dirty-text">有 <strong>${this._dirtyFields.length}</strong> 个字段已修改</span>`
                : html`<span class="dirty-text" style="font-size: var(--cortex-fs-sm); color: var(--cortex-text-subtle);">所有字段与 .env 一致</span>`
              }
              ${this._error ? html`<span style="color: var(--cortex-danger); margin-left: var(--cortex-space-2);">${this._error}</span>` : nothing}
              ${this._toast ? html`<span style="color: var(--cortex-success); margin-left: var(--cortex-space-2);">${this._toast}</span>` : nothing}
            </div>
            <div class="footer-actions">
              ${this._dirty ? html`<button class="btn" ?disabled=${this._saving} @click=${() => this._revert()}>放弃修改</button>` : nothing}
              <button class="btn close" type="button" @click=${() => this._close()}>关闭</button>
              <button class="btn primary" ?disabled=${!this._dirty || this._saving} @click=${() => this._save()}>
                ${this._saving ? "保存中…" : html`<doclens-icon name="save"></doclens-icon>保存${scopeLabel}配置${existsHint}`}
              </button>
            </div>
          </div>
        </main>
      </div>
      <toast-stack></toast-stack>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "settings-view": SettingsView;
  }
}
