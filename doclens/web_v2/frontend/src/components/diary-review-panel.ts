/** 日记「回顾」子页：单日预览。
 *
 * 顶部：◀ 前一天 | 日期按钮（点开日历打点面板）| 后一天 ▶（到今天禁用）。
 * 内容：成品态 → md-viewer 渲染；片段态 → 原始片段时间线 + 整理提示；
 *       空 → 「这一天没有日记」。
 *
 * 纯 UI 组件；事件向上冒泡给 diary-view：
 *   navigate-day {delta} / open-calendar / select-date（经 diary-calendar 透传）。
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { DiaryEntry } from "../state/types";
import { weekdayCn } from "./diary-calendar";
import "./diary-calendar";
import "./icon";
import "./md-viewer";

@customElement("diary-review-panel")
export class DiaryReviewPanel extends LitElement {
  static styles = css`
    :host { display: block; position: relative; }
    .nav-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2, 8px);
      margin-bottom: var(--cortex-space-4, 16px);
    }
    .nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 14px;
      white-space: nowrap;
    }
    .nav-btn:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .nav-btn:disabled { opacity: 0.4; cursor: default; }
    .date-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      font-size: 15px;
      font-weight: 600;
    }
    .date-btn:hover { background: var(--cortex-surface-muted); }
    .cal-pop {
      position: absolute;
      top: 52px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 20;
      width: min(340px, 92vw);
    }
    .content.loading {
      text-align: center;
      color: var(--cortex-text-muted);
      padding: var(--cortex-space-8, 32px) 0;
    }
    .empty {
      text-align: center;
      color: var(--cortex-text-muted);
      padding: var(--cortex-space-8, 32px) 0;
      font-size: 15px;
    }
    .raw-hint {
      font-size: 13px;
      color: var(--cortex-text-muted);
      margin: 0 0 var(--cortex-space-3, 12px);
      padding: var(--cortex-space-2, 8px) var(--cortex-space-3, 12px);
      background: var(--cortex-surface-muted);
      border-radius: var(--cortex-radius-md, 8px);
    }
    .frag {
      display: flex;
      gap: var(--cortex-space-3, 12px);
      align-items: flex-start;
      padding: var(--cortex-space-3, 12px);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg, 16px);
      background: var(--cortex-surface);
      margin-bottom: var(--cortex-space-2, 8px);
    }
    .frag .time {
      flex-shrink: 0;
      font-size: 13px;
      color: var(--cortex-text-muted);
      font-variant-numeric: tabular-nums;
      padding-top: 2px;
    }
    .frag .body { flex: 1; min-width: 0; font-size: 15px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .frag img {
      max-width: 200px;
      max-height: 200px;
      border-radius: var(--cortex-radius-md, 8px);
      display: block;
    }
    .frag .caption { font-size: 13px; color: var(--cortex-text-muted); margin-top: 4px; }
  `;

  @property() date = "";
  @property() today = "";
  @property({ attribute: false }) entry: DiaryEntry | null = null;
  @property({ type: Boolean }) loading = false;
  @property({ type: Boolean }) calendarOpen = false;
  @property() calendarMonth = "";
  @property({ attribute: false }) calendarDates: string[] = [];

  private _nav(delta: number) {
    this.dispatchEvent(new CustomEvent("navigate-day", {
      detail: { delta },
      bubbles: true, composed: true,
    }));
  }

  private _toggleCalendar() {
    this.dispatchEvent(new CustomEvent("toggle-calendar", { bubbles: true, composed: true }));
  }

  private _renderBody() {
    if (this.loading) {
      return html`<div class="content loading">加载中…</div>`;
    }
    if (!this.entry || this.entry.state === "empty") {
      return html`<div class="empty">这一天没有日记</div>`;
    }
    if (this.entry.state === "raw") {
      const isToday = this.date === this.today;
      return html`
        <p class="raw-hint">
          ${isToday
            ? "今天的片段将在明天自动整理成日记"
            : "这些片段尚未整理——将在下次应用运行时自动整理成日记"}
        </p>
        ${this.entry.fragments.map((f) => html`
          <div class="frag">
            <span class="time">${f.time}</span>
            <div class="body">
              ${f.kind === "photo" && f.image_url
                ? html`<img src=${f.image_url} alt=${f.text} loading="lazy" />
                       ${f.text && f.text !== "照片" ? html`<div class="caption">${f.text}</div>` : null}`
                : html`${f.text}`}
            </div>
          </div>`)}
      `;
    }
    // 成品态：md-viewer 渲染（图片 URL 已被后端重写为 /api/preview/raw）
    return html`<md-viewer .content=${this.entry.content}></md-viewer>`;
  }

  render() {
    const isToday = this.date === this.today;
    return html`
      <div class="nav-row">
        <button class="nav-btn" @click=${() => this._nav(-1)}>
          <doclens-icon name="chevron-left" style="font-size:16px"></doclens-icon>前一天
        </button>
        <button class="date-btn" @click=${this._toggleCalendar}>
          <doclens-icon name="calendar" style="font-size:16px"></doclens-icon>
          ${this.date} ${weekdayCn(this.date)}${isToday ? "（今天）" : ""}
        </button>
        <button class="nav-btn" ?disabled=${isToday} @click=${() => this._nav(1)}>
          后一天<doclens-icon name="chevron-right" style="font-size:16px"></doclens-icon>
        </button>
      </div>
      ${this.calendarOpen ? html`
        <div class="cal-pop">
          <diary-calendar
            .month=${this.calendarMonth}
            .dates=${this.calendarDates}
            .selected=${this.date}
            .today=${this.today}></diary-calendar>
        </div>` : null}
      ${this._renderBody()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "diary-review-panel": DiaryReviewPanel;
  }
}
