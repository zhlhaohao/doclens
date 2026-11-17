/**
 * <c-spinner> —— 统一旋转加载指示器（AP-1）。
 *
 *  此前同一「转圈」配方在 8 处各自定义（keyframes 名各异、尺寸/边框/
 *  时长各自为政、5 处漏 `prefers-reduced-motion` 降级）。本组件是
 *  配方的唯一真相源：样式走 `styles/spinner-styles.ts`（唯一一份
 *  `@keyframes cortex-spin`），尺寸/配色走 prop。
 *
 *  用法：
 *   <c-spinner></c-spinner>                          默认 20px / 主色顶环
 *   <c-spinner size="40" border="4"></c-spinner>     大转圈（遮罩类）
 *   <c-spinner variant="reverse"></c-spinner>        主题色整环 + 透明顶
 *   <c-spinner label="正在压缩"></c-spinner>          带无障碍标签
 *
 *  尺寸写进内联 style 变量，故每个实例互不影响；reduced-motion 降级
 *  由公共样式块统一承载（全量覆盖）。
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { spinnerStyles } from "../styles/spinner-styles";

@customElement("c-spinner")
export class CSpinner extends LitElement {
  static styles = [
    spinnerStyles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .spinner-ring { display: block; }
    `,
  ];

  /** 直径（px）。 */
  @property({ type: Number }) size = 20;
  /** 环宽（px）。 */
  @property({ type: Number }) border = 2;
  /** 动画时长（秒）。 */
  @property({ type: Number }) duration = 0.8;
  /** reverse = 主题色整环 + 透明顶（工具运行中态）。 */
  @property({ type: String }) variant: "default" | "reverse" = "default";
  /** 无障碍标签（空则 aria-hidden，由外层容器承担 role=status）。 */
  @property({ type: String }) label = "";

  render() {
    const style = `--cortex-spinner-size:${this.size}px;` +
      `--cortex-spinner-border-width:${this.border}px;` +
      `--cortex-spinner-duration:${this.duration}s;`;
    return html`
      <span
        class="spinner-ring ${this.variant === "reverse" ? "reverse" : ""}"
        style=${style}
        role=${this.label ? "status" : nothing}
        aria-label=${this.label || nothing}
        aria-hidden=${this.label ? nothing : "true"}
      ></span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "c-spinner": CSpinner;
  }
}
