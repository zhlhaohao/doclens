import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

/**
 * <import-confirm-dialog> —— 会话导入确认框（2026-10-29 重做，ADR-0038）。
 *
 * 背景：原实现用 `window.confirm` 弹确认，浏览器「阻止此页面创建更多对话
 * 框」开启时 confirm 被静默返回 false——点导入毫无反应且无任何提示；同 id
 * 重复导入时后端 skipped，前端只闪 3 秒 toast，同样像是「没反应」。
 *
 * 三态复用同一个宿主（chat-view 渲染，updated() 里 showModal）：
 *   - confirm：展示文件名 + 标题 + 条目数，确认后冒泡 `import-confirm`
 *     （detail: { asCopy: false }）。
 *   - exists：后端回报同 id 已存在，说明「已导入过」，提供「作为副本导入」
 *     → 冒泡 `import-confirm`（detail: { asCopy: true }）；WebView 直传
 *     通道拿不到文件字节，副本导入需重新选择文件，文案已注明。
 *   - busy：导入请求在途，禁用按钮（防止重复提交）。
 *
 * 取消 / ESC 一律冒泡 `cancel`，由宿主关框。
 */
@customElement("import-confirm-dialog")
export class ImportConfirmDialog extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-width: 340px;
      max-width: 460px;
      font-size: var(--cortex-fs-md);
      color: var(--cortex-text);
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 var(--cortex-space-3);
      font-size: var(--cortex-fs-lg);
    }
    h2 doclens-icon { color: var(--cortex-primary, var(--cortex-text)); }
    .file {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      word-break: break-all;
      margin-bottom: var(--cortex-space-2);
    }
    .session {
      border-left: 3px solid var(--cortex-border);
      background: var(--cortex-surface-muted);
      border-radius: 0 var(--cortex-radius-sm) var(--cortex-radius-sm) 0;
      padding: 8px 10px;
      margin-bottom: var(--cortex-space-3);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      word-break: break-word;
    }
    .session .title { color: var(--cortex-text); }
    .detail {
      font-size: var(--cortex-fs-sm);
      line-height: 1.6;
      margin-bottom: var(--cortex-space-3);
    }
    .note {
      display: flex;
      gap: 6px;
      align-items: flex-start;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-sm);
      padding: 8px 10px;
      margin-bottom: var(--cortex-space-4);
    }
    .note doclens-icon { color: var(--cortex-primary, var(--cortex-text)); flex: none; }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
    }
    button {
      padding: 8px 18px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
    }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .buttons { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .buttons button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;

  /** 所选文件名（浏览器路径有；WebView 直传路径为空）。 */
  @property({ type: String }) fileName = "";
  /** 导出文件内的会话标题。 */
  @property({ type: String }) sessionTitle = "";
  /** 导出文件内的条目数。 */
  @property({ type: Number }) itemCount = 0;
  /** 当前阶段：confirm（首次确认）/ exists（同 id 已存在）/ busy（在途）。 */
  @property({ attribute: false }) phase: "confirm" | "exists" | "busy" = "confirm";
  /** WebView 直传通道（副本导入须重新选文件）。 */
  @property({ type: Boolean }) webview = false;

  private _emit(asCopy: boolean) {
    this.dispatchEvent(new CustomEvent("import-confirm", {
      detail: { asCopy }, bubbles: true, composed: true,
    }));
  }

  private _onConfirm = () => this._emit(false);
  private _onCopy = () => this._emit(true);
  private _onCancel = () => {
    this.dispatchEvent(new CustomEvent("cancel", { bubbles: true, composed: true }));
  };

  render() {
    switch (this.phase) {
      case "busy":
        return this._renderBusy();
      case "exists":
        return this._renderExists();
      default:
        return this._renderConfirm();
    }
  }

  private _renderConfirm() {
    return html`
      <h2><doclens-icon name="upload"></doclens-icon>导入会话</h2>
      ${this.fileName ? html`<div class="file">${this.fileName}</div>` : nothing}
      <div class="session">
        <span class="title">${this.sessionTitle || "（无标题）"}</span>
        <span>· ${this.itemCount} 条记录</span>
      </div>
      <p class="detail">导入后会出现在历史会话列表最前面，可直接继续对话。</p>
      <div class="note"><doclens-icon name="info"></doclens-icon>
        <span>若该会话已存在（同一份文件导入过），将提示后可选择作为新副本导入。</span>
      </div>
      <div class="buttons">
        <button type="button" @click=${this._onCancel}>取消</button>
        <button class="primary" type="button" @click=${this._onConfirm}>导入</button>
      </div>
    `;
  }

  private _renderExists() {
    return html`
      <h2><doclens-icon name="info"></doclens-icon>会话已存在</h2>
      <div class="session">
        <span class="title">${this.sessionTitle || "（无标题）"}</span>
      </div>
      <p class="detail">
        这份文件已经导入过（同一会话 id），因此没有再生成新会话——
        可在历史列表中找到它。
      </p>
      <p class="detail">若确实需要再存一份，可作为新副本导入，标题会带上「（导入副本）」。</p>
      ${this.webview ? html`
        <div class="note"><doclens-icon name="info"></doclens-icon>
          <span>App 内导入需要重新选择该文件。</span>
        </div>` : nothing}
      <div class="buttons">
        <button type="button" @click=${this._onCancel}>取消</button>
        <button class="primary" type="button" @click=${this._onCopy}>作为副本导入</button>
      </div>
    `;
  }

  private _renderBusy() {
    return html`
      <h2><doclens-icon name="upload"></doclens-icon>正在导入…</h2>
      <p class="detail">正在写入会话，请稍候。</p>
      <div class="buttons">
        <button type="button" disabled>取消</button>
        <button class="primary" type="button" disabled>导入中…</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "import-confirm-dialog": ImportConfirmDialog;
  }
}
