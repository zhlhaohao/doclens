import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

@customElement("drop-zone")
export class DropZone extends LitElement {
  static styles = css`
    :host { display: contents; }
    .overlay {
      position: fixed; inset: 0;
      background: rgba(13, 148, 136, 0.15);
      border: 4px dashed var(--cortex-primary);
      display: none;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: var(--cortex-space-2);
      pointer-events: none;
      z-index: 9999;
      font-size: var(--cortex-fs-lg);
      color: var(--cortex-primary);
      font-weight: 500;
    }
    .overlay.active { display: flex; }
    @media (max-width: 1023px) {
      /* 移动端不支持拖拽上传 */
      :host { display: none !important; }
    }
  `;

  @property({ type: String }) targetDir = "";
  @state() private _active = false;

  private _dragCounter = 0;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("dragenter", this._onDragEnter);
    window.addEventListener("dragover", this._onDragOver);
    window.addEventListener("dragleave", this._onDragLeave);
    window.addEventListener("drop", this._onDrop);
  }

  disconnectedCallback() {
    window.removeEventListener("dragenter", this._onDragEnter);
    window.removeEventListener("dragover", this._onDragOver);
    window.removeEventListener("dragleave", this._onDragLeave);
    window.removeEventListener("drop", this._onDrop);
    super.disconnectedCallback();
  }

  private _hasFilesOnly(e: DragEvent): boolean {
    if (!e.dataTransfer) return false;
    const items = Array.from(e.dataTransfer.items || []);
    if (items.length === 0) return e.dataTransfer.types.includes("Files");
    return items.every(i => i.kind === "file");
  }

  private _onDragEnter = (e: DragEvent) => {
    if (!this._hasFilesOnly(e)) return;
    e.preventDefault();
    this._dragCounter++;
    this._active = true;
  };
  private _onDragOver = (e: DragEvent) => {
    if (!this._hasFilesOnly(e)) return;
    e.preventDefault();
  };
  private _onDragLeave = () => {
    this._dragCounter--;
    if (this._dragCounter <= 0) {
      this._active = false;
      this._dragCounter = 0;
    }
  };
  private _onDrop = (e: DragEvent) => {
    if (!e.dataTransfer) return;
    e.preventDefault();
    this._active = false;
    this._dragCounter = 0;
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    this.dispatchEvent(new CustomEvent("drop-files", {
      detail: { files, destDir: this.targetDir },
      bubbles: true, composed: true,
    }));
  };

  render() {
    return html`
      <div class="overlay ${this._active ? "active" : ""}">
        <div>⬇ 拖放以上传到</div>
        <div>📁 ${this.targetDir || "/"}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "drop-zone": DropZone; }
}
