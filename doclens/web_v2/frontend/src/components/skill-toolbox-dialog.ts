import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { SkillInfo } from "../api/skills";
import "../components/icon";

/** 技能选择对话框：列出调用方传入的技能清单，点选即确认（pick 事件）。
 *
 * 清单由调用方供给（ADR-0016 §5）：files 页传工具箱白名单（GET /api/skills），
 * 对话页传全部启用技能（GET /api/skills/manage 过滤）——对话框不再自取数据。
 * skills=null 表示加载中；error 由调用方在加载失败时传入。
 *
 * 桌面端：3 列卡片网格（button 卡片，浮起效果）。
 * 移动端：list item 列表（ul/li 语义，通栏行 + 分隔线，无 button/网格），
 * 通过 matchMedia(1023px) 切换两套结构（2026-08-17 决议）。
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
    .head {
      display: flex; align-items: center; gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-sm); font-weight: 600;
      color: var(--cortex-text);
      word-break: break-all;
    }
    .head doclens-icon { flex-shrink: 0; }
    .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    /* 移动端 list item 列表（仅移动端渲染，无需媒体查询） */
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 50vh;
      overflow-y: auto;
    }
    .item {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--cortex-space-1);
      padding: var(--cortex-space-3) var(--cortex-space-2);
      border-bottom: 1px solid var(--cortex-border-muted);
      cursor: pointer;
    }
    .item:last-child { border-bottom: none; }
    .item:hover,
    .item:focus-visible {
      background: var(--cortex-surface-muted);
      outline: none;
    }
    .item .desc {
      -webkit-line-clamp: 2;
      width: 100%;
      min-width: 0;
      overflow-wrap: anywhere;
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
      /* border-box：dialog > * 注入的 16px 内边距计入 100% 宽度，
         否则内容比对话框宽 32px，出现横向滚动条 */
      :host { width: 100%; box-sizing: border-box; }
    }
  `;

  /** 技能清单，调用方供给；null = 加载中。 */
  @property({ attribute: false }) skills: SkillInfo[] | null = null;
  /** 加载失败时由调用方传入的错误文案。 */
  @property() error: string | null = null;
  @state() private _isMobile = false;

  private _mql?: MediaQueryList;
  private _onMqlChange = (e: MediaQueryListEvent) => {
    this._isMobile = e.matches;
  };

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

  private _onPick(skill: SkillInfo) {
    this.dispatchEvent(new CustomEvent("pick", {
      detail: { skill },
      bubbles: true, composed: true,
    }));
  }

  private _onItemKeydown(e: KeyboardEvent, skill: SkillInfo) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this._onPick(skill);
    }
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", {
      bubbles: true, composed: true,
    }));
  }

  private _renderBody() {
    if (this.error) return html`<div class="err">${this.error}</div>`;
    const skills = this.skills;
    if (skills === null) return html`<div class="empty">加载中…</div>`;
    if (skills.length === 0) return html`<div class="empty">暂无可用技能</div>`;
    if (this._isMobile) {
      // 移动端：list item 语义列表（ul/li，无 button）
      return html`<ul class="list">
        ${skills.map((s) => html`
          <li
            class="item"
            role="button"
            tabindex="0"
            @click=${() => this._onPick(s)}
            @keydown=${(e: KeyboardEvent) => this._onItemKeydown(e, s)}
          >
            <span class="head"><doclens-icon name=${s.icon}></doclens-icon>${s.name}</span>
            <span class="desc">${s.description}</span>
          </li>
        `)}
      </ul>`;
    }
    // 桌面端：3 列按钮卡片网格
    return html`<div class="grid" role="listbox">
      ${skills.map((s) => html`
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
    </div>`;
  }

  render() {
    return html`
      <h3>选择技能</h3>
      ${this._renderBody()}
      <div class="actions">
        <button type="button" class="cancel" @click=${this._cancel}>取消</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "skill-toolbox-dialog": SkillToolboxDialog; }
}
