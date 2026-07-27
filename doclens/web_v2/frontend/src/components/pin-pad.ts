/** 自绘 3×4 数字键盘（移动端登录页用）。
 *
 * 纯 button 渲染、不挂任何 input 焦点 → 不弹系统键盘。
 * 事件：digit(detail: string) / backspace / submit（CustomEvent）。
 * 输入串由父组件持有，本组件无状态。
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("pin-pad")
export class PinPad extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      max-width: 300px;
      margin: 0 auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--cortex-space-3, 12px);
    }
    button {
      height: 56px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      font-size: var(--cortex-fs-xl);
      font-family: var(--cortex-font);
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    button:active {
      background: var(--cortex-surface-muted);
    }
    button.fn {
      font-size: var(--cortex-fs-lg);
      color: var(--cortex-text-muted);
    }
  `;

  private _emit(name: string, detail?: string) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  render() {
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    return html`
      <div class="grid">
        ${digits.map(
          (d) => html`<button type="button" data-key=${d} @click=${() => this._emit("digit", d)}>${d}</button>`,
        )}
        <button type="button" class="fn" data-key="backspace" aria-label="删除"
          @click=${() => this._emit("backspace")}>⌫</button>
        <button type="button" data-key="0" @click=${() => this._emit("digit", "0")}>0</button>
        <button type="button" class="fn" data-key="submit" aria-label="确认"
          @click=${() => this._emit("submit")}>✓</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pin-pad": PinPad;
  }
}
