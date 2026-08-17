import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { SkillInfo } from "../api/skills";
import "../components/icon";

/** 技能执行确认对话框：只读文件清单 + 可选补充 prompt + 「开始对话」。
 *
 * 文件清单只读（要改就取消回去重新选）；prompt 留空可执行。
 */
@customElement("skill-run-dialog")
export class SkillRunDialog extends LitElement {
  static styles = css`
    :host { display: block; min-width: 420px; }
    h3 {
      margin: 0 0 var(--cortex-space-3) 0;
      font-size: var(--cortex-fs-md); font-weight: 600;
      letter-spacing: -0.01em; color: var(--cortex-text);
      display: flex; align-items: center; gap: var(--cortex-space-2);
    }
    .files {
      max-height: 220px; overflow-y: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      margin: var(--cortex-space-2) 0;
    }
    .files .count {
      color: var(--cortex-text-muted);
      font-size: var(--cortex-fs-xs);
      margin-bottom: var(--cortex-space-1);
    }
    .files ul { margin: 0; padding: 0; list-style: none; }
    .files li {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text);
      padding: 2px 0;
      word-break: break-all;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    label {
      display: block; font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted); margin: var(--cortex-space-3) 0 4px 0;
    }
    textarea {
      width: 100%; min-height: 72px; padding: 8px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      font-size: var(--cortex-fs-base);
      font-family: inherit;
      box-sizing: border-box;
      resize: vertical;
      transition: border-color 0.15s, box-shadow 0.15s;
      background: var(--cortex-surface);
      color: var(--cortex-text);
    }
    textarea:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-base);
    }
    button.primary {
      background: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      border: none;
      border-radius: var(--cortex-radius-pill);
    }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    @media (max-width: 1023px) {
      :host { min-width: 0; }
      .files { max-height: 35vh; }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;

  /** 用户点选的技能（来自 skill-toolbox-dialog 的 pick 事件）。 */
  @property({ attribute: false }) skill: SkillInfo | null = null;

  /** 待处理文件路径（已过滤目录，相对 workdir）。 */
  @property({ attribute: false }) filePaths: string[] = [];

  @state() private _prompt = "";

  private _submit() {
    this.dispatchEvent(new CustomEvent("submit", {
      detail: { prompt: this._prompt.trim() },
      bubbles: true, composed: true,
    }));
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent("cancel", {
      bubbles: true, composed: true,
    }));
  }

  render() {
    const skill = this.skill;
    return html`
      <h3>
        <doclens-icon name=${skill?.icon ?? "sparkles"}></doclens-icon>
        ${skill?.name ?? ""}
      </h3>
      <div class="files">
        <div class="count">将处理 ${this.filePaths.length} 项：</div>
        <ul>
          ${this.filePaths.map((p) => html`<li title=${p}>${p}</li>`)}
        </ul>
      </div>
      <label for="skill-prompt">补充要求（可选）</label>
      <textarea
        id="skill-prompt"
        placeholder="例如：重点提取数据结论 / 用中文输出 / 简明扼要…"
        .value=${this._prompt}
        @input=${(e: Event) => (this._prompt = (e.target as HTMLTextAreaElement).value)}
      ></textarea>
      <div class="actions">
        <button type="button" @click=${this._cancel}>取消</button>
        <button
          type="button"
          class="primary"
          ?disabled=${!skill || this.filePaths.length === 0}
          @click=${this._submit}
        >开始对话</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "skill-run-dialog": SkillRunDialog; }
}
