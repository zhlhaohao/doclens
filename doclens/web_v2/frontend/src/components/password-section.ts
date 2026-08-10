/** 设置页 · 访问密码区块（挂在 network tab 声明式字段之后）。
 *
 * 不进 settings-fields 声明式体系（那是 envVar 驱动、写 .env 的）；
 * 密码哈希存全局 auth.db，走 /api/auth/* 接口。
 * 状态自持有（不占用 settings store 的 values/dirty 体系），反馈内联展示。
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import { ApiError } from "../api/client";
import { clearPassword, getAuthStatus, logout, setPassword } from "../api/auth";
import { actions } from "../state/store";
import { router } from "../router/router";

const PIN_LENGTH = 6;

@customElement("password-section")
export class PasswordSection extends LitElement {
  static styles = css`
    :host { display: block; }
    .section {
      margin-top: var(--cortex-space-4, 16px);
      padding-top: var(--cortex-space-4, 16px);
    }
    h2 {
      margin: 0 0 var(--cortex-space-3);
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      color: var(--cortex-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: var(--cortex-surface-muted);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
    }
    .hint {
      margin: 4px 0 12px;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-subtle);
      line-height: 1.6;
    }
    .warning {
      margin: 4px 0 12px;
      padding: 8px 12px;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-warning);
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-warning);
      border-radius: var(--cortex-radius-md);
    }
    .badge {
      display: inline-block;
      padding: 2px 10px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-success);
      border: 1px solid var(--cortex-success);
      border-radius: 999px;
      margin-left: 8px;
      vertical-align: middle;
    }
    /* 垂直 label + 全宽 input（DESIGN form 风格） */
    .field {
      display: grid;
      grid-template-columns: minmax(80px, 140px) 1fr;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-2) 0;
      align-items: center;
    }
    .field-label {
      font-size: var(--cortex-fs-sm);
      font-weight: 400;
      color: var(--cortex-text-muted);
    }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      font-size: var(--cortex-fs-base);
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      outline: none;
    }
    input:focus {
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin: 4px 0 14px;
    }
    button {
      padding: 8px 16px;
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font);
      color: var(--cortex-text);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      cursor: pointer;
    }
    button.primary {
      color: #fff;
      background: var(--cortex-primary);
      border-color: var(--cortex-primary);
    }
    button.primary:hover:not(:disabled) { background: var(--cortex-primary-hover); }
    button.danger {
      color: var(--cortex-danger);
      border-color: var(--cortex-danger);
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .feedback {
      min-height: 1.2em;
      font-size: var(--cortex-fs-sm);
      margin: 4px 0 0;
    }
    .feedback.error { color: var(--cortex-danger); }
    .feedback.ok { color: var(--cortex-success); }
  `;

  @state() private _hasPassword: boolean | null = null;
  @state() private _required = false;

  // 表单字段
  @state() private _old = "";
  @state() private _next = "";
  @state() private _confirm = "";
  @state() private _clearPin = "";

  @state() private _error = "";
  @state() private _ok = "";
  @state() private _busy = false;

  /** keep-alive view 下 connectedCallback 仅首次触发；可见时再 _refresh，
   *  确保密码设置/清除后不显示陈旧的旧密码框。 */
  private _observer?: IntersectionObserver;

  connectedCallback() {
    super.connectedCallback();
    void this._refresh();
    this._observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void this._refresh();
    });
    this._observer.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._observer?.disconnect();
  }

  private async _refresh() {
    try {
      const s = await getAuthStatus();
      this._hasPassword = s.has_password;
      this._required = s.required;
      actions.setAuthState({
        required: s.required,
        authenticated: s.authenticated,
        hasPassword: s.has_password,
      });
    } catch {
      this._error = "无法获取密码状态";
    }
  }

  private _resetForms() {
    this._old = "";
    this._next = "";
    this._confirm = "";
    this._clearPin = "";
  }

  private _valid(pin: string): boolean {
    return new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(pin);
  }

  private async _run(fn: () => Promise<unknown>, okMsg: string) {
    if (this._busy) return;
    this._busy = true;
    this._error = "";
    this._ok = "";
    try {
      await fn();
      this._ok = okMsg;
      this._resetForms();
      await this._refresh();
    } catch (e) {
      this._error = e instanceof ApiError ? e.message : "操作失败，请重试";
    } finally {
      this._busy = false;
    }
  }

  private _submitSet() {
    if (!this._valid(this._next)) {
      this._error = "密码必须是 6 位数字";
      return;
    }
    if (this._next !== this._confirm) {
      this._error = "两次输入的新密码不一致";
      return;
    }
    const hasOld = this._hasPassword === true;
    if (hasOld && !this._old) {
      this._error = "请输入旧密码";
      return;
    }
    void this._run(
      () => setPassword(hasOld ? this._old : null, this._next),
      hasOld ? "密码已修改，其他设备需重新登录" : "密码已设置",
    );
  }

  private _submitClear() {
    if (!this._clearPin) {
      this._error = "请输入当前密码";
      return;
    }
    void this._run(() => clearPassword(this._clearPin), "密码已清除，访问不再需要登录");
  }

  private async _logout() {
    try {
      await logout();
    } catch {
      /* 网络错误也照旧跳登录页 */
    }
    actions.setAuthState({ authenticated: false });
    router.navigate("login");
  }

  render() {
    if (this._hasPassword === null) return nothing;
    const hasOld = this._hasPassword === true;
    return html`
      <div class="section">
        <h2>
          🔒 访问密码
          ${hasOld ? html`<span class="badge">已设置</span>` : nothing}
        </h2>
        <p class="hint">
          仅当 GUI 绑定非环回地址（如 0.0.0.0 暴露局域网）时生效；本机 127.0.0.1 访问始终免登录。
          登录状态 24 小时内有效（使用中自动续期）。
        </p>
        ${!hasOld
          ? html`<p class="warning">尚未设置访问密码——若将 Web UI 绑定到非环回地址，局域网内任何人都可访问。</p>`
          : nothing}

        ${hasOld
          ? html`
              <div class="field">
                <span class="field-label">旧密码</span>
                <input type="password" inputmode="numeric" maxlength=${PIN_LENGTH}
                  autocomplete="current-password" placeholder="6 位数字"
                  .value=${this._old}
                  @input=${(e: InputEvent) => (this._old = (e.target as HTMLInputElement).value)} />
              </div>
            `
          : nothing}

        <div class="field">
          <span class="field-label">新密码（6 位数字）</span>
          <input type="password" inputmode="numeric" maxlength=${PIN_LENGTH}
            autocomplete="new-password" placeholder="6 位数字"
            .value=${this._next}
            @input=${(e: InputEvent) => (this._next = (e.target as HTMLInputElement).value)} />
        </div>
        <div class="field">
          <span class="field-label">确认新密码</span>
          <input type="password" inputmode="numeric" maxlength=${PIN_LENGTH}
            autocomplete="new-password" placeholder="再次输入"
            .value=${this._confirm}
            @input=${(e: InputEvent) => (this._confirm = (e.target as HTMLInputElement).value)} />
        </div>
        <div class="actions">
          <button class="primary" ?disabled=${this._busy} @click=${this._submitSet}>
            ${hasOld ? "修改密码" : "设置密码"}
          </button>
        </div>

        ${hasOld
          ? html`
              <div class="field">
                <span class="field-label">当前密码</span>
                <input type="password" inputmode="numeric" maxlength=${PIN_LENGTH}
                  autocomplete="current-password" placeholder="6 位数字"
                  .value=${this._clearPin}
                  @input=${(e: InputEvent) => (this._clearPin = (e.target as HTMLInputElement).value)} />
              </div>
              <div class="actions">
                <button class="danger" ?disabled=${this._busy} @click=${this._submitClear}>清除密码</button>
                ${this._required
                  ? html`<button ?disabled=${this._busy} @click=${this._logout}>退出登录</button>`
                  : nothing}
              </div>
            `
          : nothing}

        <p class="feedback ${this._error ? "error" : "ok"}">${this._error || this._ok || nothing}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "password-section": PasswordSection;
  }
}
