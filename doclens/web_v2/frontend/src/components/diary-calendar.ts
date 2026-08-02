/** 日记日历打点面板（回顾页的日期选择器）。
 *
 * 月历网格：有内容的日子打点高亮，未来日期禁用，选中日反色。
 * 事件：select-date {date} / month-change {month}（YYYY-MM）。
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

import "./icon";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

/** YYYY-MM-DD → 本地 Date（避免 new Date(str) 的 UTC 解析陷阱） */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function formatMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftDate(dateStr: string, deltaDays: number): string {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return formatDate(d);
}

export function shiftMonth(month: string, deltaMonths: number): string {
  const d = parseLocalDate(`${month}-01`);
  d.setMonth(d.getMonth() + deltaMonths);
  return formatMonth(d);
}

const WEEKDAY_NAMES = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];

export function weekdayCn(dateStr: string): string {
  return WEEKDAY_NAMES[(parseLocalDate(dateStr).getDay() + 6) % 7];
}

@customElement("diary-calendar")
export class DiaryCalendar extends LitElement {
  static styles = css`
    :host { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    :host {
      display: block;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg, 16px);
      box-shadow: var(--cortex-shadow-md);
      padding: var(--cortex-space-3, 12px);
    }
    .cal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--cortex-space-2, 8px);
    }
    .cal-title { font-weight: 600; font-size: 15px; }
    .nav-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-muted);
      border-radius: var(--cortex-radius-pill, 100px);
    }
    .nav-btn:hover { background: var(--cortex-surface-muted); }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 2px;
    }
    .wd {
      text-align: center;
      font-size: 12px;
      color: var(--cortex-text-muted);
      padding: 4px 0;
    }
    .day {
      position: relative;
      border: none;
      background: transparent;
      cursor: pointer;
      min-height: 44px;             /* 触控目标 ≥44px */
      border-radius: var(--cortex-radius-md, 8px);
      font-size: 14px;
      color: var(--cortex-text);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .day:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .day.other { color: var(--cortex-text-muted); opacity: 0.4; }
    .day:disabled { color: var(--cortex-text-muted); opacity: 0.35; cursor: default; }
    .day.selected {
      background: var(--cortex-primary);
      color: #fff;
      font-weight: 700;
    }
    .day .dot {
      position: absolute;
      bottom: 6px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--cortex-primary);
    }
    .day.selected .dot { background: #fff; }
  `;

  /** 当前展示月份 YYYY-MM */
  @property() month = "";
  /** 该月有内容的日期（打点） */
  @property({ attribute: false }) dates: string[] = [];
  @property() selected = "";
  /** 今天 YYYY-MM-DD（未来日期禁用） */
  @property() today = "";

  private _shiftMonth(delta: number) {
    this.dispatchEvent(new CustomEvent("month-change", {
      detail: { month: shiftMonth(this.month, delta) },
      bubbles: true, composed: true,
    }));
  }

  private _select(dateStr: string) {
    this.dispatchEvent(new CustomEvent("select-date", {
      detail: { date: dateStr },
      bubbles: true, composed: true,
    }));
  }

  private _cells(): Array<{ date: string; day: number; other: boolean } | null> {
    const first = parseLocalDate(`${this.month}-01`);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    // 周一开头：getDay() 周日=0 → 转成周一=0
    const leadBlanks = (first.getDay() + 6) % 7;
    const cells: Array<{ date: string; day: number; other: boolean } | null> = [];
    for (let i = 0; i < leadBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ date: `${this.month}-${String(d).padStart(2, "0")}`, day: d, other: false });
    }
    return cells;
  }

  render() {
    const [y, m] = this.month.split("-");
    const dots = new Set(this.dates);
    return html`
      <div class="cal-head">
        <button class="nav-btn" aria-label="上一月" @click=${() => this._shiftMonth(-1)}>
          <doclens-icon name="chevron-left"></doclens-icon>
        </button>
        <span class="cal-title">${Number(y)} 年 ${Number(m)} 月</span>
        <button class="nav-btn" aria-label="下一月" @click=${() => this._shiftMonth(1)}>
          <doclens-icon name="chevron-right"></doclens-icon>
        </button>
      </div>
      <div class="grid">
        ${WEEKDAYS.map((w) => html`<span class="wd">${w}</span>`)}
        ${this._cells().map((c) =>
          c === null
            ? html`<span></span>`
            : html`
                <button
                  class="day ${c.date === this.selected ? "selected" : ""}"
                  ?disabled=${this.today !== "" && c.date > this.today}
                  @click=${() => this._select(c.date)}>
                  ${c.day}
                  ${dots.has(c.date) ? html`<span class="dot"></span>` : null}
                </button>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "diary-calendar": DiaryCalendar;
  }
}
