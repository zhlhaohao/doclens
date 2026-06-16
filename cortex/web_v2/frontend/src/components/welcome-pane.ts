import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("welcome-pane")
export class WelcomePane extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--cortex-space-8) var(--cortex-space-6) var(--cortex-space-6);
      text-align: center;
      background: linear-gradient(180deg, var(--cortex-primary-soft) 0%, var(--cortex-surface) 100%);
      border-bottom: 1px solid var(--cortex-border-muted);
      flex-shrink: 0;
    }
    .title {
      font-size: var(--cortex-fs-xl);
      font-weight: 700;
      color: var(--cortex-primary);
      letter-spacing: -0.5px;
      margin: 0;
    }
    .subtitle {
      font-size: var(--cortex-fs-base);
      color: var(--cortex-text-muted);
      margin-top: var(--cortex-space-1);
    }
    @media (min-width: 1024px) {
      :host {
        padding: var(--cortex-space-6) var(--cortex-space-4) var(--cortex-space-4);
        border-radius: var(--cortex-radius-lg);
      }
    }
  `;

  @property() heading = "Cortex";
  @property() subheading = "";

  render() {
    return html`
      <h1 class="title">${this.heading}</h1>
      ${this.subheading ? html`<p class="subtitle">${this.subheading}</p>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "welcome-pane": WelcomePane;
  }
}
