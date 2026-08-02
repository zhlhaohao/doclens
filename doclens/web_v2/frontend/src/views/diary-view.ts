/** 日记 view：「记录」（今日录入 + 时间线）/「回顾」（单日预览）两个子页。
 *
 * 容器职责：store 订阅 + 数据加载（diaryApi）+ 子组件事件处理。
 * 子组件（diary-record-panel / diary-review-panel / diary-calendar）均为纯 UI。
 *
 * 领域规则（ADR-0007）：录入永远只写今天；成品态只读。
 */
import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";

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
import "../components/city-dialog";
import "../components/icon";

@customElement("diary-view")
export class DiaryView extends LitElement {
  static styles = css`
    :host { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
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
      gap: 4px;
      padding: 4px;
      margin-bottom: var(--cortex-space-4, 16px);
      border-radius: var(--cortex-radius-pill, 100px);
      background: var(--cortex-surface-muted);
    }
    .sub-tab {
      flex: 1;
      min-height: 40px;
      padding: 0 16px;
      border: none;
      border-radius: var(--cortex-radius-pill, 100px);
      background: transparent;
      color: var(--cortex-text-muted);
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .sub-tab:hover { color: var(--cortex-text); }
    .sub-tab doclens-icon { font-size: 16px; }
    .sub-tab.active {
      background: var(--cortex-primary-soft);
      color: var(--cortex-primary);
    }
    .error-bar {
      margin-bottom: var(--cortex-space-3, 12px);
      padding: var(--cortex-space-2, 8px) var(--cortex-space-3, 12px);
      border-radius: var(--cortex-radius-md, 8px);
      background: #fef2f2;
      color: var(--cortex-nav-active);
      font-size: 13px;
    }
    dialog {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      max-width: 90vw;
    }
    dialog::backdrop { background: rgba(0, 0, 0, 0.3); }
    dialog > * { display: block; padding: var(--cortex-space-6); }
  `;

  private _unsubscribe?: () => void;
  private _initialized = false;
  /** 被城市选择拦截的待提交片段（选完城市后自动续录） */
  @state() private _pendingSubmit:
    | { type: "text"; value: string }
    | { type: "photo"; file: File; caption: string }
    | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._unsubscribe = store.subscribe(() => this.requestUpdate());
    if (!this._initialized) {
      this._initialized = true;
      void this._init();
    }
  }

  protected updated(changedProps: Map<string, unknown>) {
    super.updated(changedProps);
    // 城市对话框用 showModal（top-layer + backdrop + ESC）；<dialog open> 是非模态
    // inline，会落在页面底部（top: 3000+）不可见
    const dlg = this.shadowRoot?.querySelector("dialog");
    if (dlg && !dlg.open) dlg.showModal();
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
    // 回顾页默认显示昨天的成文日记（今天尚未总结，恒为空态）
    const yesterday = shiftDate(today, -1);
    actions.setDiaryState({ reviewDate: yesterday });
    await Promise.all([
      this._loadReview(yesterday),
      this._loadCalendar(formatMonth(parseLocalDate(yesterday))),
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
    if (!this._diary.todayEntry?.city) {
      this._pendingSubmit = { type: "text", value: e.detail.value };
      actions.setDiaryState({ cityDialogOpen: true });
      return;
    }
    void this._submitText(e.detail.value);
  }

  private async _onUploadPhoto(e: CustomEvent<{ file: File; caption: string }>) {
    if (this._diary.submitting) return;
    if (!this._diary.todayEntry?.city) {
      this._pendingSubmit = { type: "photo", file: e.detail.file, caption: e.detail.caption };
      actions.setDiaryState({ cityDialogOpen: true });
      return;
    }
    void this._uploadPhoto(e.detail.file, e.detail.caption);
  }

  private async _submitText(value: string) {
    actions.setDiaryState({ submitting: true, error: null });
    try {
      await diaryApi.addText(value);
      await this._loadToday();
    } catch (e2) {
      actions.setDiaryState({
        error: e2 instanceof ApiError ? e2.message : "记录失败，请重试",
      });
    } finally {
      actions.setDiaryState({ submitting: false });
    }
  }

  private async _uploadPhoto(file: File, caption: string) {
    actions.setDiaryState({ submitting: true, error: null });
    try {
      await diaryApi.uploadPhoto(file, caption);
      await this._loadToday();
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
    } catch (e2) {
      actions.setDiaryState({
        error: e2 instanceof ApiError ? e2.message : "删除失败，请重试",
      });
    }
  }

  private async _onEditFragment(e: CustomEvent<{ fid: string; text: string }>) {
    const today = this._diary.today || this._localToday();
    actions.setDiaryState({ submitting: true, error: null });
    try {
      await diaryApi.editFragment(today, e.detail.fid, e.detail.text);
      await this._loadToday();
    } catch (e2) {
      actions.setDiaryState({
        error: e2 instanceof ApiError ? e2.message : "保存失败，请重试",
      });
    } finally {
      actions.setDiaryState({ submitting: false });
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
      // 回到回顾页：刷新成文与日历打点（后台 worker 可能刚总结完昨天）
      const date = this._diary.reviewDate;
      void this._loadReview(date);
      void this._loadCalendar(formatMonth(parseLocalDate(date)));
    }
  }

  private async _onCitySubmit(e: CustomEvent<{ city: string }>) {
    const city = e.detail.city;
    const today = this._diary.today || this._localToday();
    actions.setDiaryState({ cityDialogOpen: false });
    try {
      // 写城市到 md 标题 + 后端自动抓天气 + 返回更新后 entry
      const entry = await diaryApi.setCity(today, city);
      actions.setDiaryState({ todayEntry: entry });
    } catch { /* 写失败不阻断 */ }
    // 选完城市后，自动提交被拦截的片段
    const pending = this._pendingSubmit;
    this._pendingSubmit = null;
    if (pending?.type === "text") {
      void this._submitText(pending.value);
    } else if (pending?.type === "photo" && pending.file) {
      void this._uploadPhoto(pending.file, pending.caption);
    }
  }

  private _onCityCancel() {
    actions.setDiaryState({ cityDialogOpen: false });
    localStorage.setItem("doclens.diary.citySelected", "true");
  }

  render() {
    const d = this._diary;
    return html`
      <div class="page"
        @submit-text=${this._onSubmitText}
        @upload-photo=${this._onUploadPhoto}
        @delete-fragment=${this._onDeleteFragment}
        @edit-fragment=${this._onEditFragment}
        @navigate-day=${this._onNavigateDay}
        @toggle-calendar=${this._onToggleCalendar}
        @select-date=${this._onSelectDate}
        @month-change=${this._onMonthChange}>
        <div class="tab-strip">
          <button
            class="sub-tab ${d.tab === "record" ? "active" : ""}"
            @click=${() => this._switchTab("record")}>
            <doclens-icon name="pencil"></doclens-icon>记录
          </button>
          <button
            class="sub-tab ${d.tab === "review" ? "active" : ""}"
            @click=${() => this._switchTab("review")}>
            <doclens-icon name="book-open"></doclens-icon>回顾
          </button>
        </div>
        ${d.error ? html`<div class="error-bar">${d.error}</div>` : null}
        ${d.tab === "record"
          ? html`
              <diary-record-panel
                .entry=${d.todayEntry}
                .submitting=${d.submitting}
                .city=${d.todayEntry?.city || ""}
                @city-change=${() => actions.setDiaryState({ cityDialogOpen: true })}></diary-record-panel>`
          : html`
              <diary-review-panel
                .date=${d.reviewDate}
                .today=${d.today || this._localToday()}
                .entry=${d.reviewEntry}
                .loading=${d.reviewLoading}
                .calendarOpen=${d.calendarOpen}
                .calendarMonth=${d.calendarMonth}
                .calendarDates=${d.calendarDates}></diary-review-panel>`}
        ${d.tab === "record" && d.cityDialogOpen ? html`
          <dialog @cancel=${this._onCityCancel}>
            <city-dialog
              @submit=${this._onCitySubmit}
              @cancel=${this._onCityCancel}></city-dialog>
          </dialog>` : null}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "diary-view": DiaryView;
  }
}
