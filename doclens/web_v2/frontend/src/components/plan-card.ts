/** 计划卡（ADR-0060 §1）：lead 提交 DAG 后在会话里展示的结构化摘要。
 *
 *  - 步骤表（id / 指令 / owner / 依赖 / 交付物）
 *  - 「开始」直调 POST /api/team/dags/{id}/start——lead 不在确认环
 *  - 「修改」预填 chat 输入框（草稿修改是自然语言活，仍由 lead 的 group_plan_revise 做）
 *  - 随 DAG 状态失效：非 draft 时按钮禁用、显示当前状态
 *  - 持久条目：detail 回放时 kind=plan_card → ChatMessage.plan_card 重建
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { PlanCard } from "../state/types";
import { dagAction, ApiError } from "../api/team";
import { store } from "../state/store";
import "../components/icon";

const STATUS_LABEL: Record<string, string> = {
  draft: "待确认", active: "执行中", paused: "已暂停", stalled: "受阻", done: "已完成", cancelled: "已取消",
};

@customElement("plan-card")
export class PlanCardEl extends LitElement {
  static styles = css`
    :host { display: block; margin: 0.4em 0; }
    .card {
      border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-lg);
      background: var(--cortex-surface); overflow: hidden;
    }
    .head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--cortex-border-muted); }
    .head h4 { margin: 0; font-size: var(--cortex-fs-md); font-weight: 600; flex: 1; }
    .badge { font-size: var(--cortex-fs-xs); padding: 1px 8px; border-radius: var(--cortex-radius-pill); background: var(--cortex-bg); color: var(--cortex-text-secondary); }
    .badge.draft { background: var(--cortex-warning); }
    .badge.active { background: var(--cortex-success); color: var(--cortex-on-danger); }
    .badge.done { background: var(--cortex-success); color: var(--cortex-on-danger); }
    .badge.stalled { background: var(--cortex-danger); color: var(--cortex-on-danger); }
    table { width: 100%; border-collapse: collapse; font-size: var(--cortex-fs-sm); }
    th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--cortex-border-muted); vertical-align: top; }
    th { color: var(--cortex-text-secondary); font-weight: 500; font-size: var(--cortex-fs-xs); }
    tr:last-child td { border-bottom: 0; }
    td.id { font-family: var(--cortex-font-mono, monospace); white-space: nowrap; }
    td.owner { white-space: nowrap; }
    .deliv { color: var(--cortex-text-secondary); font-size: var(--cortex-fs-xs); }
    .foot { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-top: 1px solid var(--cortex-border-muted); }
    .foot .out { flex: 1; color: var(--cortex-text-secondary); font-size: var(--cortex-fs-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .btn {
      display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px;
      border: 1px solid var(--cortex-border); border-radius: var(--cortex-btn-radius);
      background: var(--cortex-surface); color: var(--cortex-text); cursor: pointer; font-size: var(--cortex-fs-sm);
    }
    .btn:hover { background: var(--cortex-bg); }
    .btn.primary { background: var(--cortex-btn-primary-bg); color: var(--cortex-btn-primary-text); border-color: transparent; }
    .btn:disabled { opacity: .5; cursor: default; }
    .repairs { padding: 6px 14px; font-size: var(--cortex-fs-xs); color: var(--cortex-text-secondary); }
  `;

  @property({ attribute: false }) card!: PlanCard;
  @state() private _busy = false;
  @state() private _status: string = "";

  connectedCallback() {
    super.connectedCallback();
    this._status = this.card?.status ?? "draft";
  }

  private _toast(msg: string, level: "success" | "error" | "info" = "info") {
    const stack = document.querySelector("app-bar")?.shadowRoot?.querySelector("toast-stack") as
      (HTMLElement & { pushToast?: (m: string, l?: string, d?: number) => void }) | null | undefined;
    stack?.pushToast?.(msg, level, 3000);
  }

  private async _start() {
    const sid = store.getState().chat.currentSession?.id ?? "";
    if (!sid) return;
    this._busy = true;
    try {
      await dagAction(this.card.dag_id, "start", sid);
      this._status = "active";
      this._toast("计划已开始", "success");
      window.dispatchEvent(new CustomEvent("cortex:plan-started", { detail: { dag_id: this.card.dag_id } }));
    } catch (e) {
      this._toast(e instanceof ApiError ? e.message : String(e), "error");
    } finally {
      this._busy = false;
    }
  }

  private _edit() {
    // 预填输入框（lead 的 group_plan_revise 仍是草稿修改的执行者）
    const draft = `修改计划 #${this.card.dag_id}「${this.card.name}」：`;
    window.dispatchEvent(new CustomEvent("cortex:chat-prefill", { detail: { text: draft } }));
  }

  render() {
    const c = this.card;
    if (!c) return nothing;
    const draft = this._status === "draft";
    const steps = c.plan?.steps ?? [];
    return html`
      <div class="card">
        <div class="head">
          <doclens-icon name="git-fork"></doclens-icon>
          <h4>计划 #${c.dag_id} · ${c.name}</h4>
          <span class="badge ${this._status}">${STATUS_LABEL[this._status] ?? this._status}</span>
        </div>
        <table>
          <thead><tr><th>步骤</th><th>内容</th><th>负责人</th><th>依赖</th></tr></thead>
          <tbody>
            ${steps.map((s) => html`
              <tr>
                <td class="id">${s.step_id}</td>
                <td>${s.subject ?? ""}<div class="deliv">${(s.deliverables ?? []).map((d) => d.path).join(" · ")}</div></td>
                <td class="owner">${s.assignee ?? s.role ?? "—"}</td>
                <td>${(s.depends_on ?? []).join(", ") || "—"}</td>
              </tr>`)}
          </tbody>
        </table>
        ${(c.repairs?.length ?? 0) > 0 ? html`<div class="repairs">已自动修正：${c.repairs!.join("；")}</div>` : nothing}
        <div class="foot">
          <span class="out" title=${c.output_dir ?? ""}>产物：${c.output_dir ?? ""}</span>
          ${draft ? html`
            <button class="btn" @click=${this._edit} ?disabled=${this._busy}>修改</button>
            <button class="btn primary" @click=${this._start} ?disabled=${this._busy}>
              <doclens-icon name="play"></doclens-icon>开始
            </button>` : nothing}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "plan-card": PlanCardEl; }
}
