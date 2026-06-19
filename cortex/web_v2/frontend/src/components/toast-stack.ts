import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

export type ToastLevel = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  message: string;
  level: ToastLevel;
  /** 0 = 不自动消失（需手动 dismiss） */
  duration: number;
}

@customElement("toast-stack")
export class ToastStack extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      min-width: 200px;
      max-width: 360px;
      padding: 10px 14px;
      border-radius: 6px;
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .toast.success { background: #10b981; color: #fff; }
    .toast.error { background: #dc2626; color: #fff; }
    .toast.info { background: var(--cortex-surface); color: var(--cortex-text); border: 1px solid var(--cortex-border); }
    .toast .msg { flex: 1; }
  `;

  @state() _toasts: ToastItem[] = [];
  private _nextId = 1;
  private _timers = new Map<number, number>();

  pushToast(message: string, level: ToastLevel = "info", duration = 2500) {
    const id = this._nextId++;
    this._toasts = [...this._toasts, { id, message, level, duration }];
    if (duration > 0) {
      const handle = window.setTimeout(() => this.dismiss(id), duration);
      this._timers.set(id, handle);
    }
  }

  dismiss(id: number) {
    const handle = this._timers.get(id);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      this._timers.delete(id);
    }
    this._toasts = this._toasts.filter((t) => t.id !== id);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    for (const handle of this._timers.values()) window.clearTimeout(handle);
    this._timers.clear();
  }

  render() {
    return html`
      ${this._toasts.map(
        (t) => html`
          <div class="toast ${t.level}" @click=${() => this.dismiss(t.id)}>
            <span class="msg">${t.message}</span>
          </div>
        `,
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "toast-stack": ToastStack;
  }
}