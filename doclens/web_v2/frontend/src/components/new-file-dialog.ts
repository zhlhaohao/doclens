import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { store } from "../state/store";
import { validateFilename } from "../utils/filename-rules";
import { InputDialogBase } from "./input-dialog-base";

@customElement("new-file-dialog")
export class NewFileDialog extends InputDialogBase {
  protected get submitLabel(): string { return "新建"; }
  protected get placeholder(): string { return "例如 笔记.md"; }
  private get _parent() { return store.getState().files.currentDir; }

  protected get inputLabel(): unknown {
    return html`在 ${this._parent || "/"} 下新建文件`;
  }

  protected validate(v: string): string {
    if (!v) return "名称不能为空";
    if (v.startsWith(".")) return "不能以点开头";
    const illegal = validateFilename(v);
    if (illegal) return illegal;
    if (/\s/.test(v[0] || "")) return "不能以空白开头";
    if (!v.includes(".")) return "须带扩展名，如 笔记.md";
    return "";
  }

  protected submitDetail(v: string): Record<string, unknown> {
    const path = this._parent ? `${this._parent}/${v}` : v;
    return { path };
  }
}

declare global {
  interface HTMLElementTagNameMap { "new-file-dialog": NewFileDialog; }
}
