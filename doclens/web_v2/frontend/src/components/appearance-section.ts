import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  APP_THEME_ORDER,
  APP_THEME_LABELS,
  readAppTheme,
  writeAppTheme,
  onAppThemeChange,
  type AppTheme,
} from "../utils/app-theme";

/** 设置页「外观」区块：应用主题三选一（ADR-0043）。
 *  纯前端偏好（localStorage），即选即生效、无保存按钮（与后端 env 字段的
 *  dirty/save 体系无关，故独立组件而非 settings-fields 字段）。 */
@customElement("appearance-section")
export class AppearanceSection extends LitElement {
  static styles = css`
    .section {
      margin-top: var(--cortex-space-6);
    }
    h2 {
      font-size: var(--cortex-fs-md);
      margin: 0 0 var(--cortex-space-2);
    }
    .section-desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      margin: 0 0 var(--cortex-space-3);
      line-height: 1.5;
    }
    .theme-row {
      display: flex;
      gap: var(--cortex-space-3);
      flex-wrap: wrap;
    }
    .theme-card {
      flex: 1 1 140px;
      max-width: 200px;
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-3);
      border: 2px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      background: var(--cortex-surface);
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      transition: border-color 0.15s, background 0.15s;
    }
    .theme-card:hover { border-color: var(--cortex-text-subtle); }
    .theme-card.active {
      border-color: var(--cortex-primary);
      background: var(--cortex-primary-soft);
    }
    .swatch {
      height: 44px;
      border-radius: var(--cortex-radius-sm);
      border: 1px solid var(--cortex-border-muted);
      display: flex;
      align-items: center;
      padding: 0 var(--cortex-space-2);
      gap: 4px;
    }
    .swatch span {
      display: inline-block;
      width: 14px;
      height: 14px;
      border-radius: 50%;
    }
    .name {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      color: var(--cortex-text);
    }
    .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
    }
  `;

  @state() private _theme: AppTheme = readAppTheme();
  private _offChange?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._theme = readAppTheme();
    this._offChange = onAppThemeChange((t) => { this._theme = t; });
  }

  disconnectedCallback() {
    this._offChange?.();
    this._offChange = undefined;
    super.disconnectedCallback();
  }

  /** 色卡固定预览色（各主题的代表色，不随当前主题变——预览的是被选主题本身）。 */
  private static readonly SWATCH: Record<AppTheme, { bg: string; dots: string[]; hint: string }> = {
    light: { bg: "#ffffff", dots: ["#0064e0", "#0a1317", "#ced0d4"], hint: "默认 · 白画布 + 钴蓝" },
    dark: { bg: "#0d1117", dots: ["#3c94f7", "#e6edf3", "#30363d"], hint: "GitHub dark 深底" },
    paper: { bg: "#f8f4ea", dots: ["#0064e0", "#2b2417", "#d8cfba"], hint: "米黄纸底 · 长阅读" },
  };

  render() {
    return html`
      <div class="section">
        <h2>外观</h2>
        <p class="section-desc">应用主题三选一，即选即生效（本机记忆，不影响其他设备）。</p>
        <div class="theme-row" role="radiogroup" aria-label="应用主题">
          ${APP_THEME_ORDER.map((t) => {
            const sw = AppearanceSection.SWATCH[t];
            return html`
              <button
                type="button"
                role="radio"
                aria-checked=${this._theme === t ? "true" : "false"}
                class="theme-card ${this._theme === t ? "active" : ""}"
                @click=${() => writeAppTheme(t)}
              >
                <div class="swatch" style="background:${sw.bg}">
                  ${sw.dots.map((d) => html`<span style="background:${d}"></span>`)}
                </div>
                <span class="name">${APP_THEME_LABELS[t]}</span>
                <span class="hint">${sw.hint}</span>
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "appearance-section": AppearanceSection;
  }
}
