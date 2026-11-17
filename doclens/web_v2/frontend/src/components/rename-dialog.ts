import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { validateFilename } from "../utils/filename-rules";
import { InputDialogBase, type ValidationResult } from "./input-dialog-base";

@customElement("rename-dialog")
export class RenameDialog extends InputDialogBase {
  protected get submitLabel(): string { return "重命名"; }

  @property({ type: String }) currentName = "";

  protected get inputLabel(): unknown {
    return html`重命名`;
  }

  protected get prefill(): string {
    return this.currentName;
  }

  protected validate(v: string): ValidationResult {
    if (!v) return "名称不能为空";
    // 「未变化」是尚未修改的中性状态，不是错误——降为 hint 级
    // （灰字提示，不红框；AP-28 视觉改版 2026-11-17）。
    if (v === this.currentName) {
      return { message: "名称未变化", level: "hint" };
    }
    if (v.startsWith(".")) return "不能以点开头";
    const illegal = validateFilename(v);
    if (illegal) return illegal;
    return "";
  }

  protected submitDetail(v: string): Record<string, unknown> {
    return { newName: v };
  }
}

declare global {
  interface HTMLElementTagNameMap { "rename-dialog": RenameDialog; }
}
