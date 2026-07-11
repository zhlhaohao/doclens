import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("welcome-pane")
export class WelcomePane extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 36px var(--cortex-space-6) 22px;
      text-align: center;
      background: linear-gradient(
        180deg,
        rgba(208, 245, 232, 0.55) 0%,
        rgba(240, 242, 249, 0) 100%
      );
      flex-shrink: 0;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: var(--cortex-text);
      letter-spacing: -0.3px;
      margin: 0;
    }
    .title .accent {
      color: var(--cortex-primary);
      font-weight: 700;
    }
    .title .sep {
      color: var(--cortex-text-subtle);
      margin: 0 6px;
      font-weight: 400;
    }
    .subtitle {
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
      margin-top: 6px;
    }
    @media (min-width: 1024px) {
      :host {
        padding: 28px var(--cortex-space-4) 18px;
      }
      .title { font-size: 24px; }
    }
  `;

  @property() heading = "Doclens";
  @property() subheading = "";
  /** heading 之外的"副品牌 / 标语"，用 .accent + .sep 拼接在主标题后（示例：「Doclens · 问日程」） */
  @property() suffix = "";

  render() {
    return html`
      <h1 class="title">
        <span class="accent">${this.heading}</span>${this.suffix
          ? html`<span class="sep">·</span><span>${this.suffix}</span>`
          : null}
      </h1>
      ${this.subheading ? html`<p class="subtitle">${this.subheading}</p>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "welcome-pane": WelcomePane;
  }
}
