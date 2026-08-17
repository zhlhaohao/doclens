import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { fetchSkills } from "../api/skills";
import type { SkillInfo } from "../api/skills";
import "../components/icon";

/** 技能工具箱选择对话框：列出 context_menu 白名单技能。
 *
 * 桌面端 3 列网格矩阵、移动端纵向列表（断点 1023px）。
 * 每项含图标 + 简介；点选即确认（无需二次确认按钮）。
 */
@customElement("skill-toolbox-dialog")
export class SkillToolboxDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
      /* 桌面占页面宽度 50%（2026-08-17 决议），三列卡片矩阵 */
      width: 50vw;
      max-width: 100%;
    }
    h3 {
      margin: 0 0 var(--cortex-space-2) 0;
      font-size: var(--cortex-fs-md); font-weight: 600;
      letter-spacing: -0.01em; color: var(--cortex-text);
    }
    .hint {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-sm);
      margin-bottom: var(--cortex-space-3);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--cortex-space-3);
      max-height: 380px;
      overflow-y: auto;
      padding: var(--cortex-space-1); /* 给卡片 hover 阴影留呼吸空间 */
    }
    /* 浮起卡片（Meta card-product-feature 风格）：大圆角 + 静态细边框平面，
       hover 抬升阴影 + 上移 2px，focus-visible 同步 */
    .skill {
      display: flex; flex-direction: column; align-items: flex-start;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-4);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-xl);
      background: var(--cortex-surface);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
    }
    .skill:hover:not(:disabled),
    .skill:focus-visible {
      border-color: var(--cortex-border);
      box-shadow: var(--cortex-shadow-md);
      transform: translateY(-2px);
      outline: none;
    }
    .skill:active:not(:disabled) { transform: translateY(0); }
    .skill:disabled { opacity: 0.4; cursor: not-allowed; }
    .skill .head {
      display: flex; align-items: center; gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-sm); font-weight: 600;
      color: var(--cortex-text);
      word-break: break-all;
    }
    .skill .head doclens-icon { flex-shrink: 0; }
    .skill .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .empty {
      padding: var(--cortex-space-8);
      text-align: center;
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-sm);
    }
    .err {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-sm);
      padding: var(--cortex-space-4);
      text-align: center;
    }
    .actions {
      display: flex; justify-content: flex-end;
      margin-top: var(--cortex-space-4);
    }
    button.cancel {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    @media (max-width: 1023px) {
      :host { width: 100%; }
      .grid {
        grid-template-columns: 1fr;
        max-height: 50vh;
      }
      .skill { flex-direction: row; align-items: center; border-radius: var(--cortex-radius-lg); }
      .skill .desc { -webkit-line-clamp: 2; }
    }
  `;

  @state() private _skills: SkillInfo[] = [];
  @state() private _loading = true;
  @state() private _error: string | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  private async _load() {
    this._loading = true;
    this._error = null;
    try {
      this._skills = await fetchSkills();
    } catch (e) {
      this._error = (e as Error)?.message || "技能列表加载失败";
    } finally {
      this._loading = false;
    }
  }

  private _onPick(skill: SkillInfo) {
    this.dispatchEvent(new CustomEvent("pick", {
      detail: { skill },
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", {
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <h3>选择技能</h3>
      <div class="hint">将对选中的文件执行所选技能</div>
      ${this._loading
        ? html`<div class="empty">加载中…</div>`
        : this._error
          ? html`<div class="err">${this._error}</div>`
          : this._skills.length === 0
            ? html`<div class="empty">暂无可用技能</div>`
            : html`<div class="grid" role="listbox">
                ${this._skills.map((s) => html`
                  <button
                    type="button"
                    role="option"
                    class="skill"
                    @click=${() => this._onPick(s)}
                  >
                    <span class="head"><doclens-icon name=${s.icon}></doclens-icon>${s.name}</span>
                    <span class="desc">${s.description}</span>
                  </button>
                `)}
              </div>`}
      <div class="actions">
        <button type="button" class="cancel" @click=${this._cancel}>取消</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "skill-toolbox-dialog": SkillToolboxDialog; }
}
