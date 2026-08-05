/** 日记日历打点面板（回顾页的日期选择器）。
 *
 * 月历网格：有内容的日子打点高亮，未来日期禁用，选中日反色。
 * 事件：select-date {date} / month-change {month}（YYYY-MM）。
 */
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

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
    .cal-title {
      font-weight: 600;
      font-size: 15px;
      border: none;
      background: transparent;
      color: var(--cortex-text);
      cursor: pointer;
      padding: 6px 14px;
      border-radius: var(--cortex-radius-pill, 100px);
    }
    .cal-title:hover { background: var(--cortex-surface-muted); }
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
    /* 月份/年份快速选择网格（4 列） */
    .pick-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2px;
    }
    .pick-cell {
      min-height: 44px;
      border: none;
      background: transparent;
      cursor: pointer;
      border-radius: var(--cortex-radius-md, 8px);
      font-size: 14px;
      color: var(--cortex-text);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pick-cell:hover:not(:disabled) { background: var(--cortex-surface-muted); }
    .pick-cell:disabled { color: var(--cortex-text-muted); opacity: 0.35; cursor: default; }
    .pick-cell.selected {
      background: var(--cortex-primary);
      color: #fff;
      font-weight: 700;
    }
  `;

  /** 当前展示月份 YYYY-MM */
  @property() month = "";
  /** 该月有内容的日期（打点） */
  @property({ attribute: false }) dates: string[] = [];
  @property() selected = "";
  /** 今天 YYYY-MM-DD（未来日期禁用） */
  @property() today = "";

  /** 头部标题点击下钻：days（日期）→ months（月份）→ years（年份）三级选择 */
  @state() private _view: "days" | "months" | "years" = "days";
  /** months 视图当前显示的年份 */
  @state() private _pickerYear = 0;
  /** years 视图的区间起始年（12 年一格） */
  @state() private _yearStart = 0;

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

  private _dispatchMonth(month: string) {
    this.dispatchEvent(new CustomEvent("month-change", {
      detail: { month }, bubbles: true, composed: true,
    }));
  }

  private _currentYear(): number {
    return Number(this.month.split("-")[0]) || new Date().getFullYear();
  }

  /** 标题点击：days → months → years → days 循环下钻。 */
  private _titleClick() {
    if (this._view === "days") {
      this._pickerYear = this._currentYear();
      this._view = "months";
    } else if (this._view === "months") {
      const y = this._pickerYear;
      this._yearStart = y - (y % 12);
      this._view = "years";
    } else {
      this._view = "days";
    }
  }

  private _shiftPickerYear(delta: number) {
    this._pickerYear += delta;
  }

  private _shiftYearRange(delta: number) {
    this._yearStart += delta * 12;
  }

  private _pickYear(y: number) {
    this._pickerYear = y;
    this._view = "months";
  }

  private _pickMonth(m: number) {
    const mm = String(m).padStart(2, "0");
    this._dispatchMonth(`${this._pickerYear}-${mm}`);
    this._view = "days";
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
    return html`
      <div class="cal-head">${this._renderHead()}</div>
      ${this._view === "days"
        ? this._renderDays()
        : this._view === "months"
          ? this._renderMonths()
          : this._renderYears()}
    `;
  }

  private _renderHead() {
    if (this._view === "months") {
      return html`
        <button class="nav-btn" aria-label="上一年" @click=${() => this._shiftPickerYear(-1)}>
          <doclens-icon name="chevron-left"></doclens-icon>
        </button>
        <button class="cal-title" @click=${() => this._titleClick()}>${this._pickerYear} 年</button>
        <button class="nav-btn" aria-label="下一年" @click=${() => this._shiftPickerYear(1)}>
          <doclens-icon name="chevron-right"></doclens-icon>
        </button>
      `;
    }
    if (this._view === "years") {
      const end = this._yearStart + 11;
      return html`
        <button class="nav-btn" aria-label="上一年代" @click=${() => this._shiftYearRange(-1)}>
          <doclens-icon name="chevron-left"></doclens-icon>
        </button>
        <button class="cal-title" @click=${() => this._titleClick()}>${this._yearStart}–${end}</button>
        <button class="nav-btn" aria-label="下一年代" @click=${() => this._shiftYearRange(1)}>
          <doclens-icon name="chevron-right"></doclens-icon>
        </button>
      `;
    }
    const [y, m] = this.month.split("-");
    return html`
      <button class="nav-btn" aria-label="上一月" @click=${() => this._shiftMonth(-1)}>
        <doclens-icon name="chevron-left"></doclens-icon>
      </button>
      <button class="cal-title" @click=${() => this._titleClick()}>
        ${Number(y)} 年 ${Number(m)} 月
      </button>
      <button class="nav-btn" aria-label="下一月" @click=${() => this._shiftMonth(1)}>
        <doclens-icon name="chevron-right"></doclens-icon>
      </button>
    `;
  }

  private _renderDays() {
    const dots = new Set(this.dates);
    return html`
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

  private _renderMonths() {
    const [ty, tm] = this.today ? this.today.split("-").map(Number) : [0, 0];
    const curMonth = this.month;
    return html`
      <div class="pick-grid">
        ${Array.from({ length: 12 }, (_, i) => {
          const m = i + 1;
          const mm = String(m).padStart(2, "0");
          const monthKey = `${this._pickerYear}-${mm}`;
          const future = this.today !== "" &&
            (this._pickerYear > ty || (this._pickerYear === ty && m > tm));
          return html`
            <button
              class="pick-cell ${monthKey === curMonth ? "selected" : ""}"
              ?disabled=${future}
              @click=${() => this._pickMonth(m)}>${m} 月</button>
          `;
        })}
      </div>
    `;
  }

  private _renderYears() {
    const curYear = this._currentYear();
    const ty = this.today ? Number(this.today.split("-")[0]) : 0;
    return html`
      <div class="pick-grid">
        ${Array.from({ length: 12 }, (_, i) => {
          const y = this._yearStart + i;
          return html`
            <button
              class="pick-cell ${y === curYear ? "selected" : ""}"
              ?disabled=${this.today !== "" && y > ty}
              @click=${() => this._pickYear(y)}>${y}</button>
          `;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "diary-calendar": DiaryCalendar;
  }
}
