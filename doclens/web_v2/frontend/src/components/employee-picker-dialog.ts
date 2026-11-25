/** 员工选择对话框（数字员工，ADR-0062）：列出全部员工，点选即派活。
 *
 * 清单由调用方供给（ChatEmployeesController.employees）；null = 加载中。
 * 预设缺失的员工标红不可选；副标题展示员工描述 + 模型名。
 * 视觉对齐 skill-toolbox-dialog（Meta 设计语言：钴蓝 tile 卡片网格 / 移动端列表）。
 */
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { Employee } from "../api/employees";
import { emptyStateStyles } from "../styles/empty-state-styles";
import { buttonBaseStyles } from "../styles/button-styles";
import "../components/icon";

@customElement("employee-picker-dialog")
export class EmployeePickerDialog extends LitElement {
  static styles = [emptyStateStyles, buttonBaseStyles, css`
    :host {
      display: block;
      width: 50vw;
      max-width: 100%;
      box-sizing: border-box;
      padding: var(--cortex-space-5, 20px) var(--cortex-space-6, 24px);
    }
    .dlg-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--cortex-space-3);
      margin-bottom: var(--cortex-space-5);
    }
    .title-wrap { display: flex; align-items: center; gap: var(--cortex-space-3); min-width: 0; }
    .title-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; flex-shrink: 0;
      border-radius: var(--cortex-radius-circle);
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      font-size: 20px;
    }
    h3 { margin: 0; font-size: var(--cortex-fs-lg); font-weight: 600; letter-spacing: -0.01em;
         color: var(--cortex-text); line-height: var(--cortex-lh-heading); }
    .subtitle { margin: 2px 0 0 0; font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); line-height: 1.4; }
    .close {
      display: inline-flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; flex-shrink: 0;
      border: none; border-radius: var(--cortex-radius-circle);
      background: transparent; color: var(--cortex-text-caption);
      font-size: 16px; cursor: pointer;
      transition: background var(--cortex-duration-fast) var(--cortex-ease),
                  color var(--cortex-duration-fast) var(--cortex-ease);
    }
    .close:hover { background: var(--cortex-surface-muted); color: var(--cortex-text); }
    .close:focus-visible { outline: none; box-shadow: var(--cortex-focus-ring); }

    .grid {
      display: grid; grid-template-columns: repeat(3, 1fr); grid-auto-rows: 1fr;
      gap: var(--cortex-space-3);
      max-height: 380px; overflow-y: auto;
      padding: var(--cortex-space-1);
    }
    .emp {
      display: flex; flex-direction: column; align-items: flex-start;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-4);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-lg);
      background: var(--cortex-surface);
      cursor: pointer; text-align: left; font-family: inherit;
      transition: background var(--cortex-duration-fast) var(--cortex-ease),
                  border-color var(--cortex-duration-fast) var(--cortex-ease);
    }
    .emp:hover:not(:disabled) { background: var(--cortex-surface-muted); border-color: var(--cortex-border); }
    .emp:focus-visible { outline: none; border-color: var(--cortex-primary); box-shadow: var(--cortex-focus-ring); }
    .emp:disabled { opacity: 0.45; cursor: not-allowed; }
    .emp.missing .name { color: var(--cortex-danger); }
    .tile {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; flex-shrink: 0;
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-primary-soft); color: var(--cortex-primary);
      font-size: 18px;
    }
    .name { font-size: var(--cortex-fs-sm); font-weight: 600; color: var(--cortex-text); word-break: break-all; }
    .desc {
      font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted); line-height: 1.5;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    .warn { font-size: var(--cortex-fs-xs); color: var(--cortex-danger); }

    .list { list-style: none; margin: 0; padding: 0; max-height: 50vh; overflow-y: auto; }
    .item {
      display: flex; align-items: flex-start; gap: var(--cortex-space-3);
      padding: var(--cortex-space-3) var(--cortex-space-2);
      border-bottom: 1px solid var(--cortex-border-muted); cursor: pointer;
    }
    .item:last-child { border-bottom: none; }
    .item.disabled { opacity: 0.45; cursor: not-allowed; }
    .item:hover:not(.disabled), .item:focus-visible { background: var(--cortex-surface-muted); outline: none; }
    .item .tile { width: 32px; height: 32px; font-size: 16px; margin-top: 2px; }
    .item .body { display: flex; flex-direction: column; gap: var(--cortex-space-1); min-width: 0; }
    .item .desc { -webkit-line-clamp: 2; width: 100%; min-width: 0; overflow-wrap: anywhere; }

    .err { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); padding: var(--cortex-space-4); text-align: center; }
    .actions { display: flex; justify-content: flex-end; margin-top: var(--cortex-space-5); }
    button.cancel { padding: 8px 20px; border-radius: var(--cortex-radius-pill); font-weight: 600; }
    @media (max-width: 1023px) {
      :host { width: 100%; box-sizing: border-box; }
      button.cancel { padding: 12px 20px; min-height: var(--cortex-touch-target); }
    }
  `];

  /** 员工清单，调用方供给；null = 加载中。 */
  @property({ attribute: false }) employees: Employee[] | null = null;
  @property() error: string | null = null;
  @property({ type: Boolean }) busy = false;
  @state() private _isMobile = false;

  private _mql?: MediaQueryList;
  private _onMqlChange = (e: MediaQueryListEvent) => { this._isMobile = e.matches; };

  connectedCallback() {
    super.connectedCallback();
    this._mql = window.matchMedia("(max-width: 1023px)");
    this._isMobile = this._mql.matches;
    this._mql.addEventListener("change", this._onMqlChange);
  }
  disconnectedCallback() {
    this._mql?.removeEventListener("change", this._onMqlChange);
    super.disconnectedCallback();
  }

  private _pick(e: Employee) {
    if (e.model_missing || e.review_model_missing || this.busy) return;
    this.dispatchEvent(new CustomEvent("pick", { detail: { employee: e }, bubbles: true, composed: true }));
  }
  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  }

  private _body() {
    if (this.error) return html`<div class="err">${this.error}</div>`;
    const list = this.employees;
    if (list === null) return html`<div class="empty">加载中…</div>`;
    if (list.length === 0) {
      return html`<div class="empty">还没有数字员工。到「设置 → 数字员工」新建一个，再回来派活。</div>`;
    }
    const disabled = (e: Employee) => e.model_missing || e.review_model_missing;
    if (this._isMobile) {
      return html`<ul class="list">
        ${list.map((e) => html`
          <li class="item ${disabled(e) ? "disabled" : ""}" role="button" tabindex=${disabled(e) ? "-1" : "0"}
              @click=${() => this._pick(e)} @keydown=${(ev: KeyboardEvent) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this._pick(e); } }}>
            <span class="tile"><doclens-icon name="user-round"></doclens-icon></span>
            <span class="body">
              <span class="name">${e.name}</span>
              <span class="desc">${e.description || "（无描述）"}</span>
              ${disabled(e) ? html`<span class="warn">模型预设缺失，暂不可派活</span>` : null}
            </span>
          </li>`)}
      </ul>`;
    }
    return html`<div class="grid" role="listbox">
      ${list.map((e) => html`
        <button type="button" role="option" class="emp ${disabled(e) ? "missing" : ""}"
                ?disabled=${disabled(e) || this.busy} @click=${() => this._pick(e)}>
          <span class="tile"><doclens-icon name="user-round"></doclens-icon></span>
          <span class="name">${e.name}</span>
          <span class="desc">${e.description || "（无描述）"}</span>
          ${disabled(e) ? html`<span class="warn">模型预设缺失</span>` : null}
        </button>`)}
    </div>`;
  }

  render() {
    return html`
      <div class="dlg-head">
        <div class="title-wrap">
          <span class="title-icon"><doclens-icon name="user-round"></doclens-icon></span>
          <div>
            <h3>选择员工</h3>
            <p class="subtitle">点选一位数字员工，在新建会话中派活：它会把成果写进产物目录，评审达标后自动结束</p>
          </div>
        </div>
        <button type="button" class="close" aria-label="关闭" @click=${this._cancel}>
          <doclens-icon name="x"></doclens-icon>
        </button>
      </div>
      ${this._body()}
      <div class="actions">
        <button type="button" class="cancel plain" @click=${this._cancel}>取消</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "employee-picker-dialog": EmployeePickerDialog; }
}
