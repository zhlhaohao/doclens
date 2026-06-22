import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("files-view")
export class FilesView extends LitElement {
  static styles = css`:host { display: block; padding: 20px; }`;
  render() { return html`<div>Files (stub — will be implemented in Batch 6)</div>`; }
}

declare global {
  interface HTMLElementTagNameMap { "files-view": FilesView; }
}
