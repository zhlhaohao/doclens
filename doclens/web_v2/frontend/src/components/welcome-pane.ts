import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/** 模式 / 能力 chip（纯展示，不可点击）。 */
export interface OnboardingChip {
  label: string;
  icon?: string;
}

export type WelcomePaneVariant = "compact" | "onboarding";

@customElement("welcome-pane")
export class WelcomePane extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 36px var(--cortex-space-6) 22px;
      text-align: center;
      background: linear-gradient(
        180deg,
        var(--cortex-primary-soft) 0%,
        var(--cortex-surface) 100%
      );
      flex-shrink: 0;
    }
    /* compact 模式：保持原来的标题样式 */
    .title {
      font-size: var(--cortex-fs-xl);
      font-weight: 700;
      color: var(--cortex-text);
      letter-spacing: -0.02em;
      margin: 0;
    }
    .title .accent {
      color: var(--cortex-primary);
      font-weight: 700;
    }
    .title .sep + span {
      color: var(--cortex-primary);
      font-weight: 600;
    }
    .title .sep {
      color: var(--cortex-text-subtle);
      margin: 0 6px;
      font-weight: 400;
    }
    .subtitle {
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text-muted);
      margin-top: 6px;
    }

    /* onboarding 模式：去掉标题渐变背景，卡片宽度与 history-list/input-row 对齐 */
    :host([variant="onboarding"]) {
      background: transparent;
      padding: 10px var(--cortex-space-4) 6px;
      text-align: left;
    }
    .onboarding-card {
      box-sizing: border-box;
      width: 100%;
      margin: 0;
      padding: var(--cortex-space-6) var(--cortex-space-5);
      /* 聚光灯 hero（更淡）：亮白热斑 → 浅奶油 → 暖金 → 金 → 柔琥珀向外衰减，
         保留聚焦光斑但整体更柔和清淡。暖色；文字深色，亮区可读。 */
      background:
        radial-gradient(circle at 18% 22%, #fffdf2 0%, #fef3c7 22%, #fde68a 45%, #fcd34d 70%, #f7b928 100%);
      color: var(--cortex-text);
      border: none;
      border-radius: var(--cortex-radius-3xl);
      box-shadow: var(--cortex-shadow-md);
    }
    .title-group {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-4);
      min-width: 0;
    }
    .hero-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--cortex-radius-circle);
      background: var(--cortex-btn-primary-bg);
      color: #ffffff;
      font-size: 24px;
    }
    /* 头部一行：左标题右模式 chips，节省一行高度 */
    .card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .onboarding-card .card-title {
      font-size: var(--cortex-fs-xl);
      font-weight: 700;
      color: var(--cortex-text);
      letter-spacing: -0.02em;
      margin: 0;
    }
    .onboarding-subheading {
      font-size: var(--cortex-fs-sm);
      color: rgba(10, 19, 23, 0.72);
      line-height: 1.5;
      margin: 6px 0 0;
    }
    .workdir-row {
      font-size: var(--cortex-fs-xs);
      color: rgba(10, 19, 23, 0.62);
      margin: 4px 0 0;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: nowrap;       /* "当前目录是" + 胶囊 始终同一行 */
      min-width: 0;
    }
    .workdir-row .workdir-prefix {
      flex-shrink: 0;          /* "当前目录是" 不被挤压换行 */
    }
    /* 路径胶囊基础样式：不限定父容器，workdir-row 和内嵌 subheading 都生效。
     * inline-flex + max-width:100%：移动端不溢出屏幕右缘。 */
    .workdir-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      max-width: 100%;
      box-sizing: border-box;
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
      background: rgba(10, 19, 23, 0.08);
      border: 1px solid rgba(10, 19, 23, 0.14);
      border-radius: var(--cortex-radius-pill);
      padding: 2px 10px;
      overflow: hidden;
      white-space: nowrap;
    }
    .workdir-pill .pill-icon {
      flex-shrink: 0;
    }
    /* 路径过长时截断开头（省略号在左），路径末尾（最有区分度的部分）保持可见：
     * direction:rtl 让溢出发生在左侧，<bdo dir="ltr"> 保证 Windows 反斜杠路径不 bidi 乱序 */
    .workdir-pill .pill-path {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      direction: rtl;
    }
    .workdir-row .workdir-pill {
      flex: 1 1 auto;
      min-width: 0;
    }
    /* subheading 内嵌路径胶囊（合并为一行）：垂直居中 + 左右小间距 */
    .workdir-inline .workdir-pill {
      vertical-align: middle;
      margin: 0 3px;
      max-width: 100%;
    }
    .modes-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text);
      background: rgba(10, 19, 23, 0.10);
      border: 1px solid rgba(10, 19, 23, 0.08);
      border-radius: var(--cortex-radius-pill);
      white-space: nowrap;
    }
    /* 示例：两列网格 + 顶部分隔线，替代小节标签，压缩竖向空间 */
    .examples-list {
      list-style: none;
      padding: 8px 0 0;
      margin: 8px 0 0;
      border-top: 1px solid rgba(10, 19, 23, 0.12);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 16px;
    }
    .examples-list li {
      font-size: var(--cortex-fs-sm);
      color: rgba(10, 19, 23, 0.85);
      padding: 1px 0;
      line-height: 1.4;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .examples-list li::before {
      content: "• ";
      color: var(--cortex-primary);
      margin-right: 4px;
    }
    @media (min-width: 1024px) {
      :host { padding: 20px var(--cortex-space-4) 14px; }
      /* onboarding：桌面端去掉水平 padding，卡片与 history-list 同宽（720/760px） */
      :host([variant="onboarding"]) { padding: 10px 0 6px; }
    }
    @media (max-width: 1023px) {
      /* 移动端：去掉渐变背景 + 缩进对齐 hero-card */
      :host {
        background: transparent;
        text-align: left;
        padding: 10px var(--cortex-space-4) 6px;
      }
      .title { font-size: var(--cortex-fs-lg); }
      .subtitle { font-size: var(--cortex-fs-sm); }
      .onboarding-card { padding: var(--cortex-space-5) var(--cortex-space-4); }
      /* 窄屏：大图标 + 标题并排一行；隐藏模式 chip 胶囊，压缩行数 */
      .title-group { flex-direction: row; align-items: center; gap: var(--cortex-space-3); }
      .hero-mark { width: 36px; height: 36px; font-size: 18px; }
      .modes-row { display: none; }
      .card-title { font-size: var(--cortex-fs-lg); }
      /* 窄屏也保持 2 列（示例已精简，2×2 排布），收紧列间距防溢出 */
      .examples-list { grid-template-columns: 1fr 1fr; gap: 2px 10px; }
    }
  `;

  @property() variant: WelcomePaneVariant = "compact";
  @property() heading = "Doclens";
  @property() subheading = "";
  @property() suffix = "";
  /** hero 圆盘图标名（仅 onboarding；空则不渲染圆盘） */
  @property() heroIcon = "";

  /** 模式 / 能力 chip 列表（仅 onboarding 变体显示） */
  @property({ attribute: false }) modes: OnboardingChip[] = [];
  /** 示例问题列表（仅 onboarding 变体显示） */
  @property({ attribute: false }) examples: string[] = [];
  /** 当前工作目录绝对路径（仅 onboarding 变体显示；空字符串/缺失则隐藏胶囊） */
  @property({ attribute: false }) workdir = "";

  render() {
    if (this.variant === "onboarding") return this._renderOnboarding();
    return this._renderCompact();
  }

  private _renderCompact() {
    return html`
      <h1 class="title">
        <span class="accent">${this.heading}</span>${this.suffix
          ? html`<span class="sep">·</span><span>${this.suffix}</span>`
          : nothing}
      </h1>
      ${this.subheading ? html`<p class="subtitle">${this.subheading}</p>` : nothing}
    `;
  }

  /** 路径胶囊：📂 图标固定不截断，路径过长时截断开头、末尾保持可见。 */
  private _renderWorkdirPill(dir: string) {
    return html`<span class="workdir-pill" title=${this.workdir || dir}
      ><doclens-icon class="pill-icon" name="folder-open"></doclens-icon><span class="pill-path"><bdo dir="ltr">${dir}</bdo></span
    ></span>`;
  }

  /** subheading 渲染：含 {workdir} 占位符时把路径胶囊内嵌进句中（合并为一行）。
   *  胶囊始终保留——workdir 未就绪时先显示占位符，属性更新后 Lit 自动重渲染填实；
   *  无 token 时纯文本，独立 workdir-row 由调用方按需保留。 */
  private _renderOnboardingSubheading() {
    if (!this.subheading) return nothing;
    const token = "{workdir}";
    const idx = this.subheading.indexOf(token);
    if (idx < 0) return html`<p class="onboarding-subheading">${this.subheading}</p>`;
    const before = this.subheading.slice(0, idx);
    const after = this.subheading.slice(idx + token.length);
    return html`<p class="onboarding-subheading workdir-inline">
      ${before}${this._renderWorkdirPill(this.workdir || "…")}${after}
    </p>`;
  }

  private _renderOnboarding() {
    return html`
      <div class="onboarding-card">
        <div class="card-head">
          <div class="title-group">
            ${this.heroIcon
              ? html`<div class="hero-mark"><doclens-icon name=${this.heroIcon}></doclens-icon></div>`
              : nothing}
            <h2 class="card-title">${this.heading}</h2>
          </div>
          ${this.modes.length
            ? html`
                <div class="modes-row">
                  ${this.modes.map(
                    (m) => html`<span class="chip">${m.icon ? html`<doclens-icon name=${m.icon}></doclens-icon> ` : nothing}${m.label}</span>`,
                  )}
                </div>
              `
            : nothing}
        </div>
        ${this._renderOnboardingSubheading()}
        ${this.workdir && !this.subheading.includes("{workdir}")
          ? html`
              <p class="workdir-row">
                <span class="workdir-prefix">当前目录是</span>
                ${this._renderWorkdirPill(this.workdir)}
              </p>
            `
          : nothing}
        ${this.examples.length
          ? html`
              <ul class="examples-list">
                ${this.examples.map((e) => html`<li>${e}</li>`)}
              </ul>
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "welcome-pane": WelcomePane;
  }
}