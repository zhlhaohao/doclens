/** 登录页：6 位数字密码。
 *
 * 触屏设备（pointer: coarse）→ 只读圆点 + 自绘数字键盘（不弹系统键盘）；
 * 桌面（pointer: fine）→ 普通密码输入框。
 * 登录成功 → setAuthState + 跳 #/search（app.ts 订阅 auth 变化后启动轮询）。
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { ApiError } from "../api/client";
import { login } from "../api/auth";
import { actions } from "../state/store";
import { router } from "../router/router";
import { isCoarsePointer } from "../utils/device";
import "../components/pin-pad";

const PIN_LENGTH = 6;

@customElement("login-view")
export class LoginView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100dvh;
      background: var(--cortex-bg);
      padding: var(--cortex-space-4, 16px);
      box-sizing: border-box;
    }
    .card {
      width: 100%;
      max-width: 360px;
      background: var(--cortex-card-bg);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      box-shadow: var(--cortex-shadow-lg);
      padding: 32px 28px;
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4, 16px);
    }
    h1 {
      margin: 0;
      font-size: var(--cortex-fs-xl);
      color: var(--cortex-text);
      text-align: center;
    }
    .subtitle {
      margin: 0;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      text-align: center;
    }
    .dots {
      display: flex;
      justify-content: center;
      gap: 12px;
      height: 20px;
    }
    .dot {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1.5px solid var(--cortex-border);
      background: transparent;
    }
    .dot.filled {
      background: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    input.pin-input {
      width: 100%;
      box-sizing: border-box;
      padding: 12px 14px;
      font-size: var(--cortex-fs-xl);
      font-family: var(--cortex-font-mono);
      letter-spacing: 0.5em;
      text-align: center;
      color: var(--cortex-text);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      outline: none;
    }
    input.pin-input:focus {
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .error {
      margin: 0;
      min-height: 1.2em;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-danger);
      text-align: center;
    }
    button.submit {
      width: 100%;
      padding: 12px;
      font-size: var(--cortex-fs-base);
      font-family: var(--cortex-font);
      color: #fff;
      background: var(--cortex-primary);
      border: none;
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
    }
    button.submit:hover:not(:disabled) {
      background: var(--cortex-primary-hover);
    }
    button.submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  @state() private _pin = "";
  @state() private _error = "";
  @state() private _submitting = false;
  /** 构造时判定一次设备类型（登录页生命周期内不会切换） */
  private _coarse = isCoarsePointer();

  private async _submit() {
    if (this._pin.length !== PIN_LENGTH || this._submitting) return;
    this._submitting = true;
    this._error = "";
    try {
      await login(this._pin);
      actions.setAuthState({ authenticated: true });
      router.navigate("search");
    } catch (e) {
      this._pin = "";
      // 后端 401/429 的 detail 已是用户可读文案（"密码错误" / "已锁定，请 N 秒后再试"）
      this._error = e instanceof ApiError ? e.message : "网络错误，请重试";
    } finally {
      this._submitting = false;
    }
  }

  private _onDigit(e: CustomEvent<string>) {
    if (this._pin.length >= PIN_LENGTH) return;
    this._error = "";
    this._pin += e.detail;
    if (this._pin.length === PIN_LENGTH) void this._submit();
  }

  private _onBackspace() {
    this._error = "";
    this._pin = this._pin.slice(0, -1);
  }

  private _onInput(e: InputEvent) {
    const el = e.target as HTMLInputElement;
    // 只保留数字，最长 6 位
    this._pin = el.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    el.value = this._pin;
    this._error = "";
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") void this._submit();
  }

  private _renderCoarse() {
    return html`
      <div class="dots" aria-label="已输入 ${this._pin.length} 位">
        ${Array.from(
          { length: PIN_LENGTH },
          (_, i) => html`<span class="dot ${i < this._pin.length ? "filled" : ""}"></span>`,
        )}
      </div>
      <pin-pad
        @digit=${this._onDigit}
        @backspace=${this._onBackspace}
        @submit=${() => void this._submit()}
      ></pin-pad>
    `;
  }

  private _renderFine() {
    return html`
      <input
        class="pin-input"
        type="password"
        inputmode="numeric"
        pattern="[0-9]*"
        maxlength=${PIN_LENGTH}
        autocomplete="current-password"
        placeholder="●●●●●●"
        .value=${this._pin}
        @input=${this._onInput}
        @keydown=${this._onKeydown}
        autofocus
      />
      <button
        class="submit"
        ?disabled=${this._pin.length !== PIN_LENGTH || this._submitting}
        @click=${() => void this._submit()}
      >${this._submitting ? "验证中…" : "登 录"}</button>
    `;
  }

  render() {
    return html`
      <div class="card">
        <h1>🔒 访问密码</h1>
        <p class="subtitle">此实例已启用密码保护，请输入 6 位数字密码</p>
        ${this._coarse ? this._renderCoarse() : this._renderFine()}
        <p class="error" role="alert">${this._error || nothing}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "login-view": LoginView;
  }
}
