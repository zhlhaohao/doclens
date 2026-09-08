import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import {
  deleteSkill,
  installSkill,
  listSkillsManage,
  patchSkill,
  previewSkillInstall,
  restoreSkill,
  type SkillInstallPreview,
  type SkillManageItem,
} from "../api/skills";
import "./icon";

interface InstallDialogState {
  url: string;
  preview: SkillInstallPreview | null;
  busy: boolean;
  error: string | null;
}

/**
 * 技能管理区块（ADR-0015）。挂在设置页技能 tab。
 *
 * 行 = icon + 名称 + 来源徽标（内置/GitHub）+ 描述 + 启用开关 + 进工具箱开关
 * + 更多面板（accept_dirs 联动置灰 + 删除/恢复）。改动即保存（PATCH 单条，
 * 后端热生效，不进 .env 保存按钮）。删除为两段式确认（按钮变为「确认删除」）。
 * 已删除内置技能灰置呈现，仅提供「恢复」。
 *
 * 移动端（<1024px）：行改卡片堆叠（主信息在上、控件区在下），开关命中区
 * ≥44px，安装弹窗全屏。
 */
@customElement("skills-section")
export class SkillsSection extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--cortex-font);
      color: var(--cortex-text);
    }
    .wrap { margin-bottom: var(--cortex-space-6); }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--cortex-space-3);
      margin-bottom: var(--cortex-space-2);
    }
    .head h2 {
      margin: 0;
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      letter-spacing: -0.015em;
    }
    .head .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .skill-list {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-3);
    }
    .skill-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
    }
    .skill-row.deleted {
      opacity: 0.55;
      background: var(--cortex-surface);
    }
    .skill-icon {
      flex-shrink: 0;
      color: var(--cortex-text-muted);
      display: inline-flex;
    }
    .skill-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .skill-name {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
      font-family: var(--cortex-font-mono);
    }
    .badge {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text-muted);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill);
      padding: 1px var(--cortex-space-2);
      font-family: var(--cortex-font);
    }
    .badge.github { color: var(--cortex-primary); }
    .skill-desc {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .skill-source {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font-mono);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      flex-shrink: 0;
    }
    .row-switches {
      display: flex;
      gap: var(--cortex-space-3);
      flex-shrink: 0;
    }
    .switch-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      cursor: pointer;
      user-select: none;
    }
    .switch-item.disabled { opacity: 0.45; cursor: not-allowed; }
    /* 开关（复用 mcp-servers-section 视觉语言） */
    .toggle {
      position: relative;
      width: 34px;
      height: 20px;
      flex-shrink: 0;
    }
    .toggle input {
      position: absolute;
      inset: 0;
      opacity: 0;
      margin: 0;
      cursor: pointer;
    }
    .toggle .track {
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-border);
      transition: background 0.15s;
      pointer-events: none;
    }
    .toggle .thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      transition: left 0.15s;
      pointer-events: none;
    }
    .toggle input:checked ~ .track { background: var(--cortex-primary); border-color: var(--cortex-primary); }
    .toggle input:checked ~ .thumb { left: 16px; }
    .toggle input:disabled { cursor: not-allowed; }
    .row-actions {
      display: flex;
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    .icon-btn {
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
      min-height: 28px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .icon-btn:hover {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-text-muted);
    }
    .icon-btn.primary {
      background: var(--cortex-btn-primary-bg);
      border-color: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      font-weight: 600;
    }
    .icon-btn.primary:hover { filter: brightness(1.05); }
    .icon-btn.danger:hover {
      background: var(--cortex-danger);
      border-color: var(--cortex-danger);
      color: #fff;
    }
    .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    /* 纯图标按钮：直径对齐左侧 Toggle（track 高 20px）的视觉尺度 */
    .icon-btn.icon-only { padding: 2px 4px; min-height: 20px; }
    .empty {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      padding: var(--cortex-space-2) 0;
    }
    /* 更多面板（行内展开，避免移动端下拉定位问题） */
    .more-panel {
      margin-top: var(--cortex-space-2);
      padding: var(--cortex-space-3);
      border: 1px dashed var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      font-size: var(--cortex-fs-xs);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-3);
      flex-wrap: wrap;
    }
    .more-panel .panel-hint {
      color: var(--cortex-text-subtle);
      margin-left: var(--cortex-space-2);
    }
    .msg {
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      margin-top: var(--cortex-space-3);
    }
    .msg.ok { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .msg.err { background: var(--cortex-danger-soft, rgba(220,38,38,0.1)); color: var(--cortex-danger); }
    .risk-note {
      margin-top: var(--cortex-space-3);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      line-height: 1.6;
    }
    /* 安装弹窗：桌面居中卡片 / 移动端全屏 */
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: var(--cortex-space-4);
      box-sizing: border-box;
    }
    .dialog {
      background: var(--cortex-bg);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg, 12px);
      padding: var(--cortex-space-4);
      width: 100%;
      max-width: 520px;
      max-height: 80vh;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-3);
    }
    .dialog h3 {
      margin: 0;
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
    }
    .field-label {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text-muted);
      margin-bottom: 2px;
    }
    .input {
      padding: 8px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
      font-size: var(--cortex-fs-sm);
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text);
      width: 100%;
      box-sizing: border-box;
    }
    .input:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .preview-list {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-3);
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      font-size: var(--cortex-fs-xs);
    }
    .preview-item .p-name {
      font-family: var(--cortex-font-mono);
      font-weight: 600;
    }
    .preview-item .p-desc { color: var(--cortex-text-muted); }
    .preview-source {
      font-family: var(--cortex-font-mono);
      color: var(--cortex-text-subtle);
      word-break: break-all;
    }
    .conflict-warn {
      color: var(--cortex-danger);
      font-size: var(--cortex-fs-xs);
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
    }
    .form-error {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-danger);
    }

    /* ===== 移动端：卡片堆叠 + 大命中区 + 全屏弹窗 ===== */
    @media (max-width: 1023px) {
      .skill-row {
        flex-direction: column;
        align-items: stretch;
        gap: var(--cortex-space-2);
      }
      .skill-icon { display: none; }
      /* 控件区一行展示：开关组居左、more 按钮居右（同行） */
      .controls {
        width: 100%;
        justify-content: space-between;
      }
      .row-switches {
        justify-content: flex-start;
        gap: var(--cortex-space-4);
      }
      .switch-item {
        min-height: 44px;
        font-size: var(--cortex-fs-sm);
      }
      .row-actions .icon-btn { min-height: 44px; }
      /* 移动端纯图标按钮 24×24，与左侧 Toggle（20px 高）视觉权重一致 */
      .row-actions .icon-btn.icon-only { min-width: 24px; min-height: 24px; justify-content: center; }
      .more-panel { flex-direction: column; align-items: stretch; }
      .more-panel .icon-btn { min-height: 44px; justify-content: center; }
      .overlay { padding: 0; align-items: stretch; }
      .dialog {
        max-width: none;
        max-height: none;
        border-radius: 0;
        border: none;
        flex: 1;
      }
    }
  `;

  @state() private _skills: SkillManageItem[] = [];
  @state() private _loading = true;
  @state() private _busy = false;
  @state() private _error: string | null = null;
  @state() private _toast: string | null = null;
  @state() private _expandedName: string | null = null;
  @state() private _confirmDeleteName: string | null = null;
  @state() private _install: InstallDialogState | null = null;

  private _toastTimer?: number;

  connectedCallback() {
    super.connectedCallback();
    this._load();
  }

  disconnectedCallback() {
    if (this._toastTimer !== undefined) window.clearTimeout(this._toastTimer);
    super.disconnectedCallback();
  }

  private async _load() {
    this._error = null;
    try {
      this._skills = await listSkillsManage();
    } catch (e) {
      this._error = `加载技能列表失败: ${(e as Error).message}`;
    } finally {
      this._loading = false;
    }
  }

  private _setFlash(msg: string) {
    this._toast = msg;
    if (this._toastTimer !== undefined) window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => { this._toast = null; }, 3000);
  }

  /** 就地更新列表中的单条（不可变替换）。 */
  private _applyItem(item: SkillManageItem) {
    this._skills = this._skills.map((s) => (s.name === item.name ? item : s));
  }

  private async _patch(s: SkillManageItem, updates: Parameters<typeof patchSkill>[1], flash: string) {
    this._busy = true;
    this._error = null;
    try {
      const updated = await patchSkill(s.name, updates);
      this._applyItem(updated);
      this._setFlash(flash);
    } catch (e) {
      this._error = (e as Error).message;
    } finally {
      this._busy = false;
    }
  }

  private async _delete(s: SkillManageItem) {
    if (this._confirmDeleteName !== s.name) {
      this._confirmDeleteName = s.name;
      return;
    }
    this._busy = true;
    this._error = null;
    try {
      await deleteSkill(s.name);
      this._confirmDeleteName = null;
      if (this._expandedName === s.name) this._expandedName = null;
      this._setFlash(s.builtin ? `已删除「${s.name}」（内置技能可随时恢复）` : `已删除「${s.name}」`);
      await this._load();
    } catch (e) {
      this._error = `删除失败: ${(e as Error).message}`;
    } finally {
      this._busy = false;
    }
  }

  private async _restore(s: SkillManageItem) {
    this._busy = true;
    this._error = null;
    try {
      await restoreSkill(s.name);
      this._setFlash(`已恢复「${s.name}」`);
      await this._load();
    } catch (e) {
      this._error = `恢复失败: ${(e as Error).message}`;
    } finally {
      this._busy = false;
    }
  }

  private _openInstall() {
    this._install = { url: "", preview: null, busy: false, error: null };
  }

  private _closeInstall() {
    if (this._install?.busy) return;
    this._install = null;
  }

  private _setInstallUrl(url: string) {
    if (!this._install) return;
    this._install = { ...this._install, url, preview: null, error: null };
  }

  private async _previewInstall() {
    const st = this._install;
    if (!st || !st.url.trim()) {
      if (this._install) this._install = { ...this._install!, error: "请填写 GitHub URL" };
      return;
    }
    this._install = { ...st, busy: true, error: null };
    try {
      const preview = await previewSkillInstall(st.url.trim());
      this._install = { ...this._install!, preview, busy: false };
    } catch (e) {
      this._install = { ...this._install!, busy: false, error: (e as Error).message };
    }
  }

  private async _confirmInstall() {
    const st = this._install;
    if (!st?.preview) return;
    this._install = { ...st, busy: true, error: null };
    try {
      const installed = await installSkill(st.url.trim());
      this._install = null;
      this._setFlash(`已安装: ${installed.join("、")}`);
      await this._load();
    } catch (e) {
      this._install = { ...this._install!, busy: false, error: (e as Error).message };
    }
  }

  private _renderSwitch(
    label: string,
    checked: boolean,
    disabled: boolean,
    title: string,
    onChange: (v: boolean) => void,
  ) {
    return html`
      <label class="switch-item ${disabled ? "disabled" : ""}" title=${title}>
        <span class="toggle">
          <input type="checkbox" .checked=${checked} ?disabled=${disabled || this._busy}
            @change=${(e: Event) => onChange((e.target as HTMLInputElement).checked)} />
          <span class="track"></span>
          <span class="thumb"></span>
        </span>
        ${label}
      </label>
    `;
  }

  private _renderRow(s: SkillManageItem) {
    if (s.deleted) {
      return html`
        <div class="skill-row deleted">
          <span class="skill-icon"><doclens-icon name=${s.icon}></doclens-icon></span>
          <div class="skill-main">
            <div class="skill-name">${s.name}<span class="badge">已删除 · 内置</span></div>
            ${s.description ? html`<div class="skill-desc">${s.description}</div>` : nothing}
          </div>
          <div class="row-actions">
            <button class="icon-btn" ?disabled=${this._busy} @click=${() => this._restore(s)}>
              <doclens-icon name="rotate-ccw"></doclens-icon>恢复
            </button>
          </div>
        </div>
      `;
    }
    const confirming = this._confirmDeleteName === s.name;
    const expanded = this._expandedName === s.name;
    return html`
      <div class="skill-row">
        <span class="skill-icon"><doclens-icon name=${s.icon}></doclens-icon></span>
        <div class="skill-main">
          <div class="skill-name">
            ${s.name}
            ${s.builtin
              ? html`<span class="badge">内置</span>`
              : html`<span class="badge github">GitHub</span>`}
          </div>
          ${s.description ? html`<div class="skill-desc">${s.description}</div>` : nothing}
          ${s.source_url ? html`<div class="skill-source" title=${s.source_url}>${s.source_url}</div>` : nothing}
        </div>
        <div class="controls">
          <div class="row-switches">
            ${this._renderSwitch("启用", s.enabled, false,
              "停用后 AI 对话的技能清单不再包含此技能（即时生效）",
              (v) => this._patch(s, { enabled: v }, v ? `已启用「${s.name}」` : `已停用「${s.name}」`))}
            ${this._renderSwitch("进工具箱", s.context_menu, false,
              "开启后出现在 files 页多选文件的技能工具箱中",
              (v) => this._patch(s, { context_menu: v }, v ? `「${s.name}」已加入工具箱` : `「${s.name}」已移出工具箱`))}
          </div>
          <div class="row-actions">
            <button class="icon-btn icon-only" ?disabled=${this._busy}
              @click=${() => { this._expandedName = expanded ? null : s.name; this._confirmDeleteName = null; }}
              title="更多">
              <doclens-icon name="more-horizontal"></doclens-icon>
            </button>
          </div>
        </div>
      </div>
      ${expanded ? html`
        <div class="more-panel">
          ${this._renderSwitch("可处理目录", s.accept_dirs, !s.context_menu,
            s.context_menu
              ? "开启后工具箱勾选清单中保留目录（如目录范围问答）"
              : "需先开启「进工具箱」",
            (v) => this._patch(s, { accept_dirs: v }, `已更新「${s.name}」目录处理`))}
          <span class="panel-hint">
            ${s.builtin
              ? "内置技能删除 = 停止部署，列表灰置，可随时恢复"
              : "外部技能删除 = 从磁盘移除，不可恢复"}
          </span>
          <button class="icon-btn danger" ?disabled=${this._busy} @click=${() => this._delete(s)}>
            ${confirming ? "确认删除" : "删除"}
          </button>
        </div>
      ` : nothing}
    `;
  }

  private _renderInstallDialog() {
    const st = this._install;
    if (!st) return nothing;
    return html`
      <div class="overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this._closeInstall(); }}>
        <div class="dialog" role="dialog" aria-label="从 GitHub 安装技能">
          <h3>从 GitHub 安装技能</h3>
          <div>
            <div class="field-label">GitHub URL（repo 根或 /tree/ 子目录链接）</div>
            <input class="input" autocomplete="off" placeholder="https://github.com/owner/repo[/tree/main/path]"
              .value=${st.url} ?disabled=${st.busy}
              @input=${(e: Event) => this._setInstallUrl((e.target as HTMLInputElement).value)} />
          </div>
          ${st.preview ? html`
            <div class="preview-list">
              <div class="preview-source">${st.preview.source_url}</div>
              ${st.preview.skills.map((p) => html`
                <div class="preview-item">
                  <div class="p-name">${p.name}</div>
                  ${p.description ? html`<div class="p-desc">${p.description}</div>` : nothing}
                </div>
              `)}
              ${st.preview.conflicts.length > 0 ? html`
                <div class="conflict-warn">
                  与内置技能同名，将被拒绝安装: ${st.preview.conflicts.join("、")}
                </div>
              ` : nothing}
            </div>
          ` : nothing}
          ${st.error ? html`<div class="form-error">${st.error}</div>` : nothing}
          <div class="dialog-actions">
            <button class="icon-btn" ?disabled=${st.busy} @click=${() => this._closeInstall()}>取消</button>
            ${st.preview
              ? html`<button class="icon-btn primary" ?disabled=${st.busy || st.preview.conflicts.length > 0}
                    @click=${() => this._confirmInstall()}>
                  ${st.busy ? "安装中…" : "确认安装"}
                </button>`
              : html`<button class="icon-btn primary" ?disabled=${st.busy || !st.url.trim()}
                    @click=${() => this._previewInstall()}>
                  ${st.busy ? "获取中…" : "预览"}
                </button>`}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="wrap">
        <div class="head">
          <h2>技能</h2>
          <span class="hint">AI 能力扩展 · 配置存本机 · 改动即时生效</span>
        </div>
        <button class="icon-btn primary" @click=${() => this._openInstall()}>
          <doclens-icon name="download"></doclens-icon>从 GitHub 安装
        </button>
        ${this._loading
          ? html`<div class="empty">加载中…</div>`
          : this._skills.length === 0
            ? html`<div class="empty">暂无技能。从 GitHub 安装一个，或等待内置技能部署。</div>`
            : html`<div class="skill-list">
                ${this._skills.map((s) => this._renderRow(s))}
              </div>`}
        ${this._error ? html`<div class="msg err">${this._error}</div>` : nothing}
        ${this._toast ? html`<div class="msg ok">${this._toast}</div>` : nothing}
        <div class="risk-note">
          技能是注入 AI 的指令文本。请仅安装信任来源的技能，其内容不经本应用审查。
          「停用」仅把技能移出 AI 可见清单；「进工具箱」控制 files 页多选文件时的快捷入口。
        </div>
        ${this._renderInstallDialog()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "skills-section": SkillsSection;
  }
}
