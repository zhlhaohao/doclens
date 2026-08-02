import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

/** 广东六城（与后端设置页 CITY_OPTIONS 同步）。 */
const CITIES = ["广州", "深圳", "珠海", "东莞", "佛山", "中山"];

/** 首次进日记页且未配 DIARY_CITY 时弹出的城市选择对话框。
 *
 * 纯 UI 组件，事件向上冒泡：submit{city} / cancel。
 */
@customElement("city-dialog")
export class CityDialog extends LitElement {
  static styles = css`
    :host { display: block; min-width: 320px; }
    .title {
      font-size: var(--cortex-fs-base);
      font-weight: 600;
      margin-bottom: var(--cortex-space-3);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--cortex-space-2);
    }
    button.city {
      padding: 12px 8px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-base);
      min-height: 44px;
    }
    button.city:hover {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-primary);
      color: var(--cortex-primary);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--cortex-space-4);
    }
    button.cancel {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .actions { flex-direction: column-reverse; }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;

  private _pick(city: string) {
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { city },
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="title">选择你的城市（用于日记天气）</div>
      <div class="grid">
        ${CITIES.map((c) => html`<button class="city" @click=${() => this._pick(c)}>${c}</button>`)}
      </div>
      <div class="actions">
        <button class="cancel" @click=${this._cancel}>暂不设置</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "city-dialog": CityDialog; }
}
