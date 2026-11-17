import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { InputDialogBase, type ValidationResult } from "./input-dialog-base";

/** 会话标题改名对话框（2026-09-17）。
 *  外壳复用 input-dialog-base（AP-28 归一），校验规则与文件名不同：标题是
 *  自由文本（可含任意字符），仅要求非空 + 有变化；长度上限 1000 与后端
 *  SESSION_TITLE_MAX 对齐。 */
@customElement("session-rename-dialog")
export class SessionRenameDialog extends InputDialogBase {
  protected get submitLabel(): string { return "重命名"; }
  protected get maxlength(): number { return 1000; }

  @property({ type: String }) currentTitle = "";

  protected get inputLabel(): unknown {
    return html`会话标题`;
  }

  protected get prefill(): string {
    return this.currentTitle;
  }

  protected validate(v: string): ValidationResult {
    if (!v.trim()) return "标题不能为空";
    // 「未变化」是尚未修改的中性状态，不是错误——降为 hint 级
    // （灰字提示，不红框；AP-28 视觉改版 2026-11-17）。
    if (v === this.currentTitle) {
      return { message: "标题未变化", level: "hint" };
    }
    return "";
  }

  protected submitDetail(v: string): Record<string, unknown> {
    return { title: v.trim() };
  }
}

declare global {
  interface HTMLElementTagNameMap { "session-rename-dialog": SessionRenameDialog; }
}
