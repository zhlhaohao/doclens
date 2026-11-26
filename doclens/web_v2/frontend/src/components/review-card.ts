/** 评审卡（数字员工，ADR-0062）：一次评审在消息流里的人读呈现。
 *
 * 分数（对照阈值）+ 达标与否 + 意见清单；返工指令原文折叠在卡内（可展开）
 * ——卡是给人看的，返工指令是给模型的，同一内容不显示两遍。
 * 三种形态：review（有分）/ no_artifact（无产物预检，无分）/ failed（评审失败）。
 * 颜色只用 tokens（达标 → success 语义；未达标 → warning；失败 → danger）。
 */
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ChatMessage } from "../state/types";
import type { ReviewEvent } from "../api/employees";
import "../components/icon";

@customElement("review-card")
export class ReviewCard extends LitElement {
  static styles = css`
    :host { display: block; }
    .card {
      margin: var(--cortex-space-3) 0;
      padding: var(--cortex-space-4) var(--cortex-space-5);
      border: 1px solid var(--cortex-border-muted);
      border-left: 3px solid var(--cortex-text-caption);
      border-radius: var(--cortex-radius-lg);
      background: var(--cortex-surface);
    }
    .card.passed { border-left-color: var(--cortex-success); }
    .card.failed-pass { border-left-color: var(--cortex-warning); }
    .card.error { border-left-color: var(--cortex-danger); }
    .head {
      display: flex; align-items: center; gap: var(--cortex-space-3);
      flex-wrap: wrap;
    }
    .head doclens-icon { font-size: 18px; }
    .passed .head doclens-icon { color: var(--cortex-success); }
    .failed-pass .head doclens-icon { color: var(--cortex-warning); }
    .error .head doclens-icon { color: var(--cortex-danger); }
    .title { font-size: var(--cortex-fs-sm); font-weight: 600; color: var(--cortex-text); }
    .iter { font-size: var(--cortex-fs-xs); color: var(--cortex-text-subtle); }
    .score {
      margin-left: auto; font-variant-numeric: tabular-nums;
      font-size: var(--cortex-fs-sm); font-weight: 600; color: var(--cortex-text);
    }
    .score .thr { color: var(--cortex-text-subtle); font-weight: 400; }
    .verdict {
      font-size: var(--cortex-fs-xs); font-weight: 600; padding: 2px 8px;
      border-radius: var(--cortex-radius-pill);
    }
    .passed .verdict { background: var(--cortex-surface-muted); color: var(--cortex-success-ink); }
    .failed-pass .verdict { background: var(--cortex-surface-muted); color: var(--cortex-warning); }
    .error .verdict { background: var(--cortex-danger-soft); color: var(--cortex-danger); }
    .summary { margin: var(--cortex-space-2) 0 0 0; font-size: var(--cortex-fs-sm); color: var(--cortex-text); line-height: 1.6; }
    ul { margin: var(--cortex-space-2) 0 0 0; padding-left: 1.2em; }
    li { font-size: var(--cortex-fs-sm); color: var(--cortex-text); line-height: 1.6; margin: 2px 0; }
    .sug li { color: var(--cortex-text-muted); }
    .err { margin-top: var(--cortex-space-2); font-size: var(--cortex-fs-xs); color: var(--cortex-danger); }
    .checks {
      margin-top: var(--cortex-space-3); display: flex; flex-direction: column; gap: 2px;
      font-size: var(--cortex-fs-xs);
    }
    .check-row { display: flex; align-items: center; gap: 6px; color: var(--cortex-text-muted); }
    .check-row doclens-icon { font-size: 13px; flex-shrink: 0; }
    .check-row.ok doclens-icon { color: var(--cortex-success-ink); }
    .check-row.bad doclens-icon { color: var(--cortex-danger); }
    .check-name { font-weight: 600; color: var(--cortex-text); flex-shrink: 0; }
    .check-val { font-family: var(--cortex-font-mono); overflow-wrap: anywhere; }
    details {
      margin-top: var(--cortex-space-3); font-size: var(--cortex-fs-xs);
    }
    summary {
      cursor: pointer; color: var(--cortex-text-subtle); user-select: none;
      list-style: none; display: inline-flex; align-items: center; gap: 4px;
    }
    summary::-webkit-details-marker { display: none; }
    summary:hover { color: var(--cortex-text); }
    pre {
      margin: var(--cortex-space-2) 0 0 0; padding: var(--cortex-space-3);
      background: var(--cortex-surface-muted); border-radius: var(--cortex-radius-md);
      white-space: pre-wrap; word-break: break-word;
      font-size: var(--cortex-fs-xs); color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono, ui-monospace, monospace);
      max-height: 260px; overflow: auto;
    }
  `;

  @property({ attribute: false }) review!: ReviewEvent;
  /** 评审指令原文（宿主代发，折叠在卡内） */
  @property({ attribute: false }) order: ChatMessage | null = null;
  /** 返工指令原文（折叠在卡内） */
  @property({ attribute: false }) rework: ChatMessage | null = null;
  @state() private _open = false;
  @state() private _reworkOpen = false;

  render() {
    const r = this.review;
    const kindCls = r.kind === "failed" ? "error" : r.passed ? "passed" : "failed-pass";
    const icon = r.kind === "failed" ? "alert-triangle" : r.passed ? "badge-check" : r.kind === "no_artifact" ? "clipboard-check" : "gauge";
    const verdict =
      r.kind === "failed" ? "评审失败"
        : r.kind === "no_artifact" ? "无产物"
          : r.passed ? "达标" : "未达标";
    return html`
      <div class="card ${kindCls}">
        <div class="head">
          <doclens-icon name=${icon}></doclens-icon>
          <span class="title">评审 · 第 ${r.iteration} 轮</span>
          <span class="verdict">${verdict}</span>
          ${r.score !== null && r.score !== undefined
            ? html`<span class="score">${r.score}<span class="thr"> / ${r.threshold}</span></span>`
            : null}
        </div>
        ${r.summary ? html`<p class="summary">${r.summary}</p>` : null}
        ${r.kind === "no_artifact"
          ? html`<p class="summary">产物目录为空（模板拷贝与 tmp/ 不计）。已要求员工把成果落盘。</p>`
          : null}
        ${r.issues?.length
          ? html`<ul>${r.issues.map((i) => html`<li>${i}</li>`)}</ul>`
          : null}
        ${r.suggestions?.length
          ? html`<ul class="sug">${r.suggestions.map((s) => html`<li>${s}</li>`)}</ul>`
          : null}
        ${r.error ? html`<div class="err">${r.error}</div>` : null}
        ${r.checks?.length
          ? html`<div class="checks">
              ${r.checks.map((c) => html`
                <div class="check-row ${c.pass ? "ok" : "bad"}">
                  <doclens-icon name=${c.pass ? "circle-check" : "circle-x"}></doclens-icon>
                  <span class="check-name">${c.name}</span>
                  ${c.value ? html`<span class="check-val">${c.value}</span>` : null}
                </div>`)}
            </div>`
          : null}
        ${this._orderBlock()}
        ${this.rework
          ? html`<details ?open=${false} @toggle=${(e: Event) => (this._reworkOpen = (e.target as HTMLDetailsElement).open)}>
              <summary><doclens-icon name=${this._reworkOpen ? "chevron-up" : "chevron-down"}></doclens-icon>查看发给员工的返工指令</summary>
              <pre>${this.rework.content}</pre>
            </details>`
          : null}
      </div>
    `;
  }

  /** 评审指令折叠块（无指令时不渲染） */
  private _orderBlock() {
    if (!this.order) return null;
    return html`<details ?open=${false} @toggle=${(e: Event) => (this._open = (e.target as HTMLDetailsElement).open)}>
        <summary><doclens-icon name=${this._open ? "chevron-up" : "chevron-down"}></doclens-icon>查看发给员工的评审指令</summary>
        <pre>${this.order.content}</pre>
      </details>`;
  }
}

declare global {
  interface HTMLElementTagNameMap { "review-card": ReviewCard; }
}
