import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { SearchMode } from "../state/types";

@customElement("input-box")
export class InputBox extends LitElement {
  static styles = css`
    :host {
      display: block;
      /* 输入框高度基准（= fs-md 行高 + 2×上下留白；随字号缩放。
         消费方可用 --min-h 覆盖为更紧凑的值，如日记记录页 36px） */
      --min-h: calc(var(--cortex-fs-md) * 1.5 + 26px);   /* ≈48px */
    }
    .wrapper {
      position: relative;
      display: flex;
      align-items: center;
      /* 边框效果：绿色渐变描边（padding-box 白心 + border-box 渐变），跟随 pill 圆角 */
      border: 2px solid transparent;
      border-radius: var(--cortex-radius-pill);
      background:
        linear-gradient(var(--cortex-chat-input-bg), var(--cortex-chat-input-bg)) padding-box,
        linear-gradient(135deg, #16a34a, #22c55e) border-box;
      min-height: var(--min-h);
      /* 右侧只留边距：按钮在文档流中占据实际宽度，文本换行点自然落在按钮前 */
      padding: 0 3px 0 18px;
      /* 强化：绿色调 elevation 阴影——静止即浮起，作为主动作区 */
      box-shadow: 0 6px 18px rgba(22, 163, 74, 0.12), 0 1px 2px rgba(20, 22, 26, 0.05);
      transition: box-shadow var(--cortex-duration-fast), background var(--cortex-duration-fast);
    }
    .wrapper:focus-within {
      /* 聚焦：绿色渐变描边加深为满色 + 更强 elevation + 绿色光晕环 */
      background:
        linear-gradient(var(--cortex-surface), var(--cortex-surface)) padding-box,
        linear-gradient(135deg, #16a34a, #22c55e) border-box;
      box-shadow: 0 10px 30px rgba(22, 163, 74, 0.20), 0 0 0 4px rgba(22, 163, 74, 0.14);
    }
    input {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      border-radius: var(--cortex-radius-md);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      /* Shadow DOM 不继承全局 box-sizing，必须显式声明，否则 padding 会把
         height 撑大 2 倍（44px height + 22px padding = 66px 高，移动端 ≈ 2.5 字）。 */
      box-sizing: border-box;
      /* 单行输入框：显式 height + 等高 line-height → 文字 100% 垂直居中 */
      height: var(--min-h);
      line-height: var(--min-h);
      padding: 0;
    }
    textarea {
      flex: 1;
      border: none;
      background: transparent;
      outline: none;
      border-radius: var(--cortex-radius-md);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
      resize: none;
      /* Shadow DOM 内必须显式声明 box-sizing，否则 min-height 是 content-box
         高度，padding 会叠加在外部导致总高度 = min-height + padding。 */
      box-sizing: border-box;
      /* 多行输入框：min-height 保证 1 行时总高度（含 padding）= wrapper 高度；
         line-height + padding 组合让单行文本视觉上居中（22.5px 文字在 24px
         内容区里 ≈ 完美居中）。实际高度由 _autoResize 按 scrollHeight 撑开。 */
      min-height: var(--min-h);
      line-height: 1.5;
      padding: var(--cortex-input-pad-y, 11px) 0;
    }
    /* multiline 自动扩充：默认单行高度，换行后随内容增高，超出上限内部滚动 */
    textarea {
      max-height: 200px;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    textarea::-webkit-scrollbar {
      display: none;
    }
    input::placeholder, textarea::placeholder { color: var(--cortex-text-subtle); }
    button {
      /* 文档流内按钮：flex: 0 保证不收缩，文本区域（flex:1）自动让位——
         换行点自然落在按钮前，长文不再钻到按钮底下 */
      flex: 0 0 auto;
      background: #16a34a;
      color: #fff;
      border: none;
      border-radius: var(--cortex-radius-pill);
      /* 上下左右各留 3px（wrapper padding 右 3px，按钮自身贴齐） */
      min-width: calc(var(--min-h) - 6px);
      height: calc(var(--min-h) - 6px);
      padding: 0 14px;
      font-size: var(--cortex-fs-md);
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: filter 0.15s, transform 0.1s;
    }
    button:disabled { filter: saturate(0.4); cursor: not-allowed; box-shadow: none; }
    button:hover:not(:disabled) { filter: brightness(1.05); }
    button:active:not(:disabled) { transform: scale(0.96); }
    /* 停止态：流式中发送键原地变身为「停止」（红色方形图标钮，区别于绿色发送），始终可点 */
    button.stop { background: #dc2626; padding: 0; }
    /* 停止态动画：白色方块呼吸 + 红色光晕扩散，错开节奏传达"正在思考/输出" */
    button.stop { animation: cortex-stop-glow 1.4s ease-in-out infinite; }
    button.stop doclens-icon { animation: cortex-stop-pulse 0.9s ease-in-out infinite; }
    @keyframes cortex-stop-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
      50% { box-shadow: 0 0 0 5px rgba(220, 38, 38, 0.28); }
    }
    @keyframes cortex-stop-pulse {
      0%, 100% { transform: scale(0.8); opacity: 0.5; }
      50% { transform: scale(1); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      button.stop, button.stop doclens-icon { animation: none; }
    }
    /* 分裂按钮：主体 + caret 拼成单一控件（模式选择器/技能菜单）——文档流内右对齐 */
    .actions.split {
      display: flex;
      align-items: center;
      flex: 0 0 auto;
      margin-left: 8px;
    }
    .actions.split .primary {
      border-radius: var(--cortex-radius-pill) 0 0 var(--cortex-radius-pill);
      /* 分裂按钮：primary 与 caret 拼成单一控件，必须共享同一 elevation；
         抑制主按钮的 glow，避免左半 "漂浮" 而右半扁平的不对称视觉。 */
      box-shadow: none;
    }
    .actions.split .primary:active:not(:disabled) { transform: scale(0.96); }
    .caret {
      box-sizing: border-box;
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      border: 1px solid var(--cortex-border);
      border-radius: 0 var(--cortex-radius-pill) var(--cortex-radius-pill) 0;
      box-shadow: none;
      /* 与主按钮同高：上下各留 3px，对齐 wrapper 边缘 */
      height: calc(var(--min-h) - 6px);
      min-width: 28px;
      padding: 0 10px;
      font-size: var(--cortex-fs-sm);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .caret:hover:not(:disabled) { background: var(--cortex-surface-muted); filter: none; }
    .caret:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu {
      position: absolute;
      /* 向上展开：input-box（带模式选择器）只用在 search 初始态，位于页面底端，
         向下展开会落到视口之外不可见。 */
      bottom: calc(100% + 4px);
      right: 6px;
      z-index: 20;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      box-shadow: var(--cortex-shadow-lg);
      overflow: hidden;
    }
    .menu-item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 8px 12px;
      cursor: pointer;
    }
    .menu-item:hover { background: var(--cortex-surface-muted); }
    .menu-item-title { font-size: var(--cortex-fs-md); color: var(--cortex-text); font-weight: 500; white-space: nowrap;
      display: inline-flex; align-items: center; gap: var(--cortex-space-2); }
    .menu-item-desc { font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); white-space: nowrap; }
    /* 菜单分隔线：技能菜单的「选择技能…」与最近技能之间 */
    .menu-divider { border-top: 1px solid var(--cortex-border-muted); margin: 2px 0; }
    .menu-item.active { background: var(--cortex-primary-soft); }
    .menu-item.active:hover { background: var(--cortex-primary-soft); }
    .menu-item.active .menu-item-title { color: var(--cortex-primary); font-weight: 600; }
    @media (max-width: 1023px) {
      /* 移动端稍矮（≈44px），仍随字号缩放 */
      :host { --min-h: calc(var(--cortex-fs-md) * 1.5 + 20px); }
      /* 触屏命中区 ≥44px（ADR-0016 §5 移动端适配） */
      .caret { min-width: 44px; }
      .menu-item { min-height: 44px; justify-content: center; }
    }
  `;

  @property() value = "";
  @property() placeholder = "";
  @property() buttonLabel = "搜索";
  @property() buttonIcon = "";
  /** 图标放在文字右侧（true = 文字在前、图标在后） */
  @property({ type: Boolean }) iconAfter = false;
  @property({ type: Boolean }) multiline = false;
  @property({ type: Boolean }) disabled = false;
  /** 流式中：按钮原地变身为「停止」（发 stop 事件），输入框禁用。仅 chat 用。 */
  @property({ type: Boolean }) streaming = false;

  /** 模式选择器：提供 .mode + .modes 时渲染分裂按钮 + caret 下拉；
   *  不提供时为遗留单一按钮（chat/files 等消费者不受影响）。 */
  @property() mode: SearchMode = "keyword";
  @property({ attribute: false }) modes: Record<SearchMode, { label: string; icon?: string; description?: string }> | null = null;

  /** 技能菜单（ADR-0016）：非 null 时渲染分裂按钮 + caret 技能菜单（与 modes 互斥，modes 优先）。
   *  数组 = 最近技能（可为空，菜单只显示「选择技能…」）；null = 不启用（普通单按钮）。
   *  caret 在输入为空时禁用（先输入问题才能选技能）；点技能项发 skill-pick，点「选择技能…」发 skill-browse。 */
  @property({ attribute: false }) skillItems: { name: string; icon?: string }[] | null = null;
  @state() private _menuOpen = false;

  @query("input, textarea") private inputEl!: HTMLInputElement | HTMLTextAreaElement;

  /** Focus the inner input/textarea element. */
  focus(): void {
    this.inputEl?.focus();
  }

  updated(changedProps: Map<string, unknown>) {
    super.updated?.(changedProps);
    // value 外部更新（如提交后清空）或多行态切换时，重新计算高度
    if (changedProps.has("value") || changedProps.has("multiline")) {
      this._autoResize();
    }
  }

  /** textarea 按内容自动扩充高度：单行起步，换行后增高，超上限内部滚动 */
  private _autoResize() {
    const ta = this.renderRoot.querySelector("textarea");
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }

  private get trimmed() {
    return this.value.trim();
  }

  private _onInput(e: Event) {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement;
    this.value = target.value;
    this.dispatchEvent(new CustomEvent("input-change", { detail: { value: this.value } }));
    // 同步更新按钮 disabled 状态，避免 Lit 异步渲染期间 disabled 按钮拦截 click 事件
    const btn = this.renderRoot.querySelector("button");
    if (btn) btn.disabled = !this.trimmed || this.disabled;
    this._autoResize();
  }

  private _onKeydown(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    // multiline：Enter 发送、Shift+Enter 换行；非 multiline：Enter 始终发送
    if (e.shiftKey && this.multiline) return;
    e.preventDefault();
    this._submit();
  }

  private _submit() {
    // 流式中由停止键接管，submit 不触发（textarea 已禁用，此为双保险）
    if (this.streaming || !this.trimmed || this.disabled) return;
    this.dispatchEvent(new CustomEvent("submit", { detail: { value: this.trimmed } }));
  }

  /** 流式中按钮变身停止键：发 stop 事件（不 submit），始终可点。 */
  private _emitStop() {
    this.dispatchEvent(new CustomEvent("stop"));
  }

  private get _hasModes(): boolean {
    return !!this.modes && this.mode in this.modes;
  }

  /** 技能菜单启用 = skillItems 非 null 且非 modes 模式（modes 优先，两者不共存）。 */
  private get _hasSkillMenu(): boolean {
    return !this._hasModes && this.skillItems !== null;
  }

  private _pickSkill(item: { name: string; icon?: string }) {
    if (!this.trimmed || this.disabled || this.streaming) return;
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
    this.dispatchEvent(new CustomEvent("skill-pick", { detail: { name: item.name } }));
  }

  private _browseSkills() {
    if (!this.trimmed || this.disabled || this.streaming) return;
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
    this.dispatchEvent(new CustomEvent("skill-browse"));
  }

  private _toggleMenu(e: Event) {
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
    if (this._menuOpen) {
      document.addEventListener("click", this._onDocClick);
      // 技能菜单打开时通知宿主刷新候选（设置页可能刚改过启用状态）
      if (this._hasSkillMenu) this.dispatchEvent(new CustomEvent("skill-menu-open"));
    }
  }

  private _onDocClick = () => {
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
  };

  private _selectMode(key: SearchMode) {
    this._menuOpen = false;
    document.removeEventListener("click", this._onDocClick);
    this.dispatchEvent(new CustomEvent("mode-change", { detail: { mode: key } }));
  }

  private _renderButton() {
    // 停止态：流式中按钮原地变身为「停止」（红色方形 + 白色实心方块），始终可点
    if (this.streaming) {
      return html`
        <button class="stop" @click=${this._emitStop} aria-label="停止生成">
          <doclens-icon class="filled" name="square" aria-hidden="true"></doclens-icon>
        </button>`;
    }
    if (!this._hasModes && !this._hasSkillMenu) {
      const icon = this.buttonIcon
        ? html`<doclens-icon class="thick" name=${this.buttonIcon} aria-hidden="true"></doclens-icon>`
        : null;
      const label = html`<span>${this.buttonLabel}</span>`;
      return html`
        <button @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
          ${this.iconAfter ? html`${label}${icon}` : html`${icon}${label}`}
        </button>`;
    }
    if (this._hasSkillMenu) {
      // 技能菜单分裂按钮：主键 = 普通发送；caret 弹出技能菜单（空输入禁用——先输入问题才能选技能）
      const icon = this.buttonIcon
        ? html`<doclens-icon class="thick" name=${this.buttonIcon} aria-hidden="true"></doclens-icon>`
        : null;
      const label = html`<span>${this.buttonLabel}</span>`;
      return html`
        <div class="actions split">
          <button class="primary" @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
            ${this.iconAfter ? html`${label}${icon}` : html`${icon}${label}`}
          </button>
          <button class="caret" @click=${this._toggleMenu} ?disabled=${!this.trimmed || this.disabled}
                  aria-label="选择技能" aria-expanded=${this._menuOpen}><doclens-icon name="chevron-down"></doclens-icon></button>
        </div>`;
    }
    const cur = this.modes![this.mode];
    return html`
      <div class="actions split">
        <button class="primary" @click=${this._submit} ?disabled=${!this.trimmed || this.disabled}>
          ${cur?.icon ? html`<doclens-icon name=${cur.icon} aria-hidden="true"></doclens-icon>` : null}
          <span>${cur?.label ?? this.buttonLabel}</span>
        </button>
        <button class="caret" @click=${this._toggleMenu} ?disabled=${this.disabled}
                aria-label="切换搜索模式" aria-expanded=${this._menuOpen}><doclens-icon name="chevron-down"></doclens-icon></button>
      </div>`;
  }

  private _renderMenu() {
    if (this._hasSkillMenu) return this._renderSkillMenu();
    if (!this._hasModes || !this._menuOpen) return null;
    return html`
      <div class="menu" role="menu">
        ${(Object.keys(this.modes!) as SearchMode[]).map((key) => {
          const m = this.modes![key];
          return html`
            <div class="menu-item ${key === this.mode ? "active" : ""}" role="menuitem"
                 @click=${() => this._selectMode(key)}>
              <span class="menu-item-title">
                ${m.icon ? html`<span aria-hidden="true">${m.icon}</span>` : null}${m.label}
              </span>
              ${m.description ? html`<span class="menu-item-desc">${m.description}</span>` : null}
            </div>`;
        })}
      </div>`;
  }

  /** 技能菜单：第 1 项固定「选择技能…」（弹对话框），其下为最近 ≤3 个技能。 */
  private _renderSkillMenu() {
    if (!this._menuOpen) return null;
    const items = this.skillItems ?? [];
    return html`
      <div class="menu" role="menu">
        <div class="menu-item" role="menuitem" @click=${this._browseSkills}>
          <span class="menu-item-title"><doclens-icon name="sparkles" aria-hidden="true"></doclens-icon>选择技能…</span>
          <span class="menu-item-desc">从全部启用技能中选择</span>
        </div>
        ${items.length > 0 ? html`<div class="menu-divider" role="separator"></div>` : null}
        ${items.map((item) => html`
          <div class="menu-item" role="menuitem" @click=${() => this._pickSkill(item)}>
            <span class="menu-item-title">
              ${item.icon ? html`<doclens-icon name=${item.icon} aria-hidden="true"></doclens-icon>` : null}${item.name}
            </span>
          </div>`)}
      </div>`;
  }

  render() {
    // 流式期间禁用输入（不能打字/回车），由停止键接管
    const fieldDisabled = this.disabled || this.streaming;
    const field = this.multiline
      ? html`<textarea rows="1" .value=${this.value} placeholder=${this.placeholder}
          ?disabled=${fieldDisabled} @input=${this._onInput} @keydown=${this._onKeydown}></textarea>`
      : html`<input type="text" .value=${this.value} placeholder=${this.placeholder}
          ?disabled=${fieldDisabled} @input=${this._onInput} @keydown=${this._onKeydown} />`;
    return html`
      <div class="wrapper">
        ${field}
        ${this._renderButton()}
        ${this._renderMenu()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "input-box": InputBox;
  }
}
