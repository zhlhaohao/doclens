/** 日记「回顾」子页：成文日记浏览器（只看已总结成文的日）。
 *
 * 顶部：◀ 前一天 | 日期按钮（点开日历打点面板，只标成文日）| 后一天 ▶（到今天禁用）。
 * 内容：成品态 → md-viewer 渲染；片段态/空态 → 空态提示（不展示原始片段）。
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
    :host {
      display: block;
      position: relative;
      box-sizing: border-box;
      /* em 留白锚点：随字号缩放（小屏 90% 同步收紧） */
      font-size: var(--cortex-fs-base);
    }
    *, *::before, *::after { box-sizing: border-box; }
    /* 内嵌 md-viewer：去掉自身留白与灰底，让白纸贴满宿主宽度
       （.page.review-tab 已取消水平 padding，白纸 max-width 820px 与
       宿主 .page 相同，无需突破；白纸 padding 控制内容边距） */
    md-viewer {
      display: block;
      padding: 0;
      background: transparent;
    }
    .nav-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2, 8px);
      /* 导航行与 md 正文间距收紧（原 space-4=16px 偏空） */
      margin-bottom: 0.4em;
    }
    .nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-height: var(--cortex-btn-h-sm, 36px);
      padding: 0 calc(var(--cortex-btn-pad-x, 14px) - 6px);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      font-size: var(--cortex-fs-base);
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
      min-height: var(--cortex-btn-h-sm, 36px);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      cursor: pointer;
      font-size: var(--cortex-fs-md);
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
      font-size: var(--cortex-fs-md);
    }
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
    // 回顾页只展示已整理成文的日记；片段态/空态都不展示原始片段
    if (!this.entry || this.entry.state !== "summarized") {
      const msg = this.entry?.state === "raw"
        ? "这一天的日记尚未整理成文"
        : "这一天没有日记";
      return html`<div class="empty">${msg}</div>`;
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
          ${this.date.slice(5)} ${weekdayCn(this.date).replace("星期", "周")}${isToday ? "（今天）" : ""}
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
