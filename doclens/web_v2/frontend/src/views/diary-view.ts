/** 日记 view：「记录」（今日录入 + 时间线）/「回顾」（单日预览）两个子页。
 *
 * 容器职责：store 订阅 + 数据加载（diaryApi）+ 子组件事件处理。
 * 子组件（diary-record-panel / diary-review-panel / diary-calendar）均为纯 UI。
 *
 * 领域规则（ADR-0007）：录入永远只写今天；成品态只读。
 */
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import { store, actions } from "../state/store";
import { diaryApi, ApiError } from "../api/diary";
import {
  formatDate,
  formatMonth,
  parseLocalDate,
  shiftDate,
} from "../components/diary-calendar";
import "../components/diary-record-panel";
import "../components/diary-review-panel";
import "../components/icon";

@customElement("diary-view")
export class DiaryView extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow-y: auto;
      background: var(--cortex-bg);
    }
    .page {
      flex: 1;
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
      padding: var(--cortex-space-4, 16px) var(--cortex-space-4, 16px)
        calc(var(--cortex-space-6, 24px) + env(safe-area-inset-bottom));
    }
    .tab-strip {
      display: flex;
      gap: var(--cortex-space-2, 8px);
      margin-bottom: var(--cortex-space-4, 16px);
    }
    .sub-tab {
      min-height: 44px;
      padding: 0 20px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface);
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    }
    .sub-tab:hover { background: var(--cortex-surface-muted); }
    .sub-tab.active {
      background: var(--cortex-btn-primary-bg);
      border-color: var(--cortex-btn-primary-bg);
      color: #fff;
    }
    .today-head {
      margin: 0 0 var(--cortex-space-3, 12px);
      font-size: 15px;
      font-weight: 600;
      color: var(--cortex-text);
    }
    .error-bar {
      margin-bottom: var(--cortex-space-3, 12px);
      padding: var(--cortex-space-2, 8px) var(--cortex-space-3, 12px);
      border-radius: var(--cortex-radius-md, 8px);
      background: #fef2f2;
      color: var(--cortex-nav-active);
      font-size: 13px;
    }
  `;

  private _unsubscribe?: () => void;
  private _initialized = false;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    if (!this._initialized) {
      this._initialized = true;
      void this._init();
    }
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    super.disconnectedCallback();
  }

  private get _diary() {
    return store.getState().diary;
  }

  private _localToday(): string {
    return formatDate(new Date());
  }

  // ---------------------------------------------------------------- 数据加载

  private async _init() {
    await this._loadToday();
    const today = this._diary.today || this._localToday();
    actions.setDiaryState({ reviewDate: today });
    await Promise.all([
      this._loadReview(today),
      this._loadCalendar(formatMonth(parseLocalDate(today))),
    ]);
  }

  private async _loadToday() {
    actions.setDiaryState({ recordLoading: true, error: null });
    try {
      const resp = await diaryApi.today();
      actions.setDiaryState({
        today: resp.today,
        todayEntry: resp.entry,
        recordLoading: false,
      });
    } catch (e) {
      actions.setDiaryState({
        recordLoading: false,
        today: this._localToday(),
        error: e instanceof ApiError ? e.message : "加载今日记录失败",
      });
    }
  }

  private async _loadReview(date: string) {
    actions.setDiaryState({ reviewLoading: true, error: null });
    try {
      const entry = await diaryApi.entry(date);
      actions.setDiaryState({ reviewEntry: entry, reviewLoading: false });
    } catch (e) {
      actions.setDiaryState({
        reviewEntry: null,
        reviewLoading: false,
        error: e instanceof ApiError ? e.message : "加载日记失败",
      });
    }
  }

  private async _loadCalendar(month: string) {
    try {
      const resp = await diaryApi.calendar(month);
      actions.setDiaryState({ calendarMonth: month, calendarDates: resp.dates });
    } catch {
      // 打点失败不阻塞主流程，仅不显示打点
      actions.setDiaryState({ calendarMonth: month, calendarDates: [] });
    }
  }

  // ---------------------------------------------------------------- 记录页事件

  private async _onSubmitText(e: CustomEvent<{ value: string }>) {
    if (this._diary.submitting) return;
    actions.setDiaryState({ submitting: true, error: null });
    try {
      await diaryApi.addText(e.detail.value);
      await this._loadToday();
      // 今天的小节变化也可能影响回顾页（若正在看今天）
      if (this._diary.reviewDate === this._diary.today) {
        void this._loadReview(this._diary.reviewDate);
      }
      void this._loadCalendar(this._diary.calendarMonth || formatMonth(new Date()));
    } catch (e2) {
      actions.setDiaryState({
        error: e2 instanceof ApiError ? e2.message : "记录失败，请重试",
      });
    } finally {
      actions.setDiaryState({ submitting: false });
    }
  }

  private async _onUploadPhoto(e: CustomEvent<{ file: File; caption: string }>) {
    if (this._diary.submitting) return;
    actions.setDiaryState({ submitting: true, error: null });
    try {
      await diaryApi.uploadPhoto(e.detail.file, e.detail.caption);
      await this._loadToday();
      if (this._diary.reviewDate === this._diary.today) {
        void this._loadReview(this._diary.reviewDate);
      }
      void this._loadCalendar(this._diary.calendarMonth || formatMonth(new Date()));
    } catch (e2) {
      actions.setDiaryState({
        error: e2 instanceof ApiError ? e2.message : "照片上传失败，请重试",
      });
    } finally {
      actions.setDiaryState({ submitting: false });
    }
  }

  private async _onDeleteFragment(e: CustomEvent<{ fid: string }>) {
    const today = this._diary.today || this._localToday();
    actions.setDiaryState({ error: null });
    try {
      await diaryApi.removeFragment(today, e.detail.fid);
      await this._loadToday();
      if (this._diary.reviewDate === today) {
        void this._loadReview(today);
      }
    } catch (e2) {
      actions.setDiaryState({
        error: e2 instanceof ApiError ? e2.message : "删除失败，请重试",
      });
    }
  }

  // ---------------------------------------------------------------- 回顾页事件

  private async _onNavigateDay(e: CustomEvent<{ delta: number }>) {
    const next = shiftDate(this._diary.reviewDate, e.detail.delta);
    actions.setDiaryState({ reviewDate: next, calendarOpen: false });
    await this._loadReview(next);
    // 跨月时刷新打点面板
    const month = formatMonth(parseLocalDate(next));
    if (month !== this._diary.calendarMonth) {
      void this._loadCalendar(month);
    }
  }

  private _onToggleCalendar() {
    const open = !this._diary.calendarOpen;
    actions.setDiaryState({ calendarOpen: open });
    if (open) {
      // 打开面板时跳到当前选中日所在月
      void this._loadCalendar(formatMonth(parseLocalDate(this._diary.reviewDate)));
    }
  }

  private async _onSelectDate(e: CustomEvent<{ date: string }>) {
    const date = e.detail.date;
    actions.setDiaryState({ reviewDate: date, calendarOpen: false });
    await this._loadReview(date);
  }

  private _onMonthChange(e: CustomEvent<{ month: string }>) {
    void this._loadCalendar(e.detail.month);
  }

  private _switchTab(tab: "record" | "review") {
    actions.setDiaryState({ tab, calendarOpen: false });
    if (tab === "record") {
      void this._loadToday();
    } else {
      // 回到回顾页时刷新（可能刚录了新片段 / 总结 worker 刚重写过）
      void this._loadReview(this._diary.reviewDate);
    }
  }

  render() {
    const d = this._diary;
    return html`
      <div class="page"
        @submit-text=${this._onSubmitText}
        @upload-photo=${this._onUploadPhoto}
        @delete-fragment=${this._onDeleteFragment}
        @navigate-day=${this._onNavigateDay}
        @toggle-calendar=${this._onToggleCalendar}
        @select-date=${this._onSelectDate}
        @month-change=${this._onMonthChange}>
        <div class="tab-strip">
          <button
            class="sub-tab ${d.tab === "record" ? "active" : ""}"
            @click=${() => this._switchTab("record")}>记录</button>
          <button
            class="sub-tab ${d.tab === "review" ? "active" : ""}"
            @click=${() => this._switchTab("review")}>回顾</button>
        </div>
        ${d.error ? html`<div class="error-bar">${d.error}</div>` : null}
        ${d.tab === "record"
          ? html`
              <p class="today-head">今天 ${d.today || this._localToday()}</p>
              <diary-record-panel
                .entry=${d.todayEntry}
                .submitting=${d.submitting}></diary-record-panel>`
          : html`
              <diary-review-panel
                .date=${d.reviewDate}
                .today=${d.today || this._localToday()}
                .entry=${d.reviewEntry}
                .loading=${d.reviewLoading}
                .calendarOpen=${d.calendarOpen}
                .calendarMonth=${d.calendarMonth}
                .calendarDates=${d.calendarDates}></diary-review-panel>`}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "diary-view": DiaryView;
  }
}
