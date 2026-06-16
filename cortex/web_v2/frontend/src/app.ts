import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("cortex-app")
export class CortexApp extends LitElement {
  static styles = css`:host { display: block; padding: 16px; }`;

  render() {
    return html`<div>Cortex Web v2 — 脚手架就绪</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "cortex-app": CortexApp;
  }
}
