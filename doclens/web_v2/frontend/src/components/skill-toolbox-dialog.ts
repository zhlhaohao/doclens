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
 * 视觉对齐 DESIGN.md（Meta 设计语言）：
 * - 头部：钴蓝浅底圆形图标（primary-soft tint）+ 标题/副标题 + 右上圆形关闭钮
 *   （button-icon-circular）；
 * - 卡片 = card-icon-feature：hairline-soft 细边框、16px 圆角（rounded.xl）、
 *   图标置于钴蓝浅底 tile 之上（与 segmented-control 选中态同一 tint 语言）；
 * - 平铺无阴影：hover 只换底/深边，不做抬升（Meta elevation 只留给粘性面板）；
 * - 聚焦用钴蓝 focus ring；底部「取消」为 ghost pill。
 *
 * 桌面端：3 列卡片网格（button 卡片）；移动端：list item 列表（ul/li 语义），
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

    /* ── 头部：标题块 + 右上关闭 ── */
    .dlg-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--cortex-space-3);
      margin-bottom: var(--cortex-space-5);
    }
    .title-wrap {
      display: flex; align-items: center; gap: var(--cortex-space-3);
      min-width: 0;
    }
    .title-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; flex-shrink: 0;
      border-radius: var(--cortex-radius-circle);
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      font-size: 20px;
    }
    h3 {
      margin: 0;
      font-size: var(--cortex-fs-lg); font-weight: 600;
      letter-spacing: -0.01em; color: var(--cortex-text);
      line-height: var(--cortex-lh-heading);
    }
    .subtitle {
      margin: 2px 0 0 0;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      line-height: 1.4;
    }
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
    .close:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }

    /* ── 桌面：3 列卡片网格（card-icon-feature）── */
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-auto-rows: 1fr; /* 同行卡片等高，视觉对齐 */
      gap: var(--cortex-space-3);
      max-height: 380px;
      overflow-y: auto;
      padding: var(--cortex-space-1); /* 给 focus ring 留呼吸空间 */
    }
    .skill {
      display: flex; flex-direction: column; align-items: flex-start;
      gap: var(--cortex-space-2);
      padding: var(--cortex-space-4);
      border: 1px solid var(--cortex-border-muted);
      border-radius: var(--cortex-radius-lg);
      background: var(--cortex-surface);
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      /* 平铺：hover 仅换底/深边，无抬升无阴影（Meta no-elevation 政策） */
      transition: background var(--cortex-duration-fast) var(--cortex-ease),
                  border-color var(--cortex-duration-fast) var(--cortex-ease);
    }
    .skill:hover:not(:disabled) {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-border);
    }
    .skill:focus-visible {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .skill:disabled { opacity: 0.4; cursor: not-allowed; }
    /* 图标 tile：钴蓝浅底圆角块，与 segmented-control 选中态同一 tint 语言 */
    .tile {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; flex-shrink: 0;
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
      font-size: 18px;
    }
    .name {
      font-size: var(--cortex-fs-sm); font-weight: 600;
      color: var(--cortex-text);
      letter-spacing: var(--cortex-tracking-body);
      word-break: break-all;
    }
    .desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* ── 移动端 list item 列表（仅移动端渲染，无需媒体查询）── */
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 50vh;
      overflow-y: auto;
    }
    .item {
      display: flex;
      align-items: flex-start;
      gap: var(--cortex-space-3);
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
    .item .tile { width: 32px; height: 32px; font-size: 16px; margin-top: 2px; }
    .item .body { display: flex; flex-direction: column; gap: var(--cortex-space-1); min-width: 0; }
    .item .desc {
      -webkit-line-clamp: 2;
      width: 100%;
      min-width: 0;
      overflow-wrap: anywhere;
    }

    /* ── 状态与动作 ── */
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
      margin-top: var(--cortex-space-5);
    }
    /* ghost pill：透明底 + hairline 边框，hover 浅灰底 */
    button.cancel {
      padding: 8px 20px;
      border: 1px solid var(--cortex-border);
      background: transparent;
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      letter-spacing: var(--cortex-tracking-body);
      transition: background var(--cortex-duration-fast) var(--cortex-ease),
                  border-color var(--cortex-duration-fast) var(--cortex-ease);
    }
    button.cancel:hover { background: var(--cortex-surface-muted); }
    button.cancel:focus-visible {
      outline: none;
      box-shadow: var(--cortex-focus-ring);
    }
    @media (max-width: 1023px) {
      /* border-box：dialog > * 注入的 16px 内边距计入 100% 宽度，
         否则内容比对话框宽 32px，出现横向滚动条 */
      :host { width: 100%; box-sizing: border-box; }
      button.cancel { padding: 12px 20px; min-height: var(--cortex-touch-target); }
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
      // 移动端：list item 语义列表（ul/li，无 button），图标 tile + 文字列横排
      return html`<ul class="list">
        ${skills.map((s) => html`
          <li
            class="item"
            role="button"
            tabindex="0"
            @click=${() => this._onPick(s)}
            @keydown=${(e: KeyboardEvent) => this._onItemKeydown(e, s)}
          >
            <span class="tile"><doclens-icon name=${s.icon}></doclens-icon></span>
            <span class="body">
              <span class="name">${s.name}</span>
              <span class="desc">${s.description}</span>
            </span>
          </li>
        `)}
      </ul>`;
    }
    // 桌面端：3 列按钮卡片网格（card-icon-feature：图标 tile 在上）
    return html`<div class="grid" role="listbox">
      ${skills.map((s) => html`
        <button
          type="button"
          role="option"
          class="skill"
          @click=${() => this._onPick(s)}
        >
          <span class="tile"><doclens-icon name=${s.icon}></doclens-icon></span>
          <span class="name">${s.name}</span>
          <span class="desc">${s.description}</span>
        </button>
      `)}
    </div>`;
  }

  render() {
    return html`
      <div class="dlg-head">
        <div class="title-wrap">
          <span class="title-icon"><doclens-icon name="sparkles"></doclens-icon></span>
          <div>
            <h3>选择技能</h3>
            <p class="subtitle">点选一个技能，立即使用</p>
          </div>
        </div>
        <button type="button" class="close" aria-label="关闭" @click=${this._cancel}>
          <doclens-icon name="x"></doclens-icon>
        </button>
      </div>
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
