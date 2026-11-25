/** 团队视图（ADR-0060 §2）：当前会话的 DAG 层级分组 + 底部 Bot 横条。
 *
 *  - 顶部 DAG 切换条（名称 + 状态徽标），默认选最新 active/draft
 *  - 选中 DAG：步骤按依赖深度分层（并行同层、无连线，依赖写在卡片上）
 *  - 步骤 owner 可点 → 打开 bot-session-dialog 覆盖层
 *  - DAG 级操作栏按状态显隐（开始/暂停/继续/取消；retry/replan 本期跳 chat）
 *  - 底部「团队 Bot」横条：本会话租借的 Bot + 全局空闲实体
 *  - 5s 轮询（仅可见时；[hidden] 时停）——不监听文件事件（§11g）
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { DagInfo, DagStep, PlanStep, BotInfo, BotStatus, DagStatus } from "../api/team";
import { listBots, listDags, listRoles, dagAction, deleteBot, createBot, ApiError } from "../api/team";
import { createSession, fetchSessionDetail, listSessions } from "../api/sessions";
import "../components/icon";
import "../components/bot-session-dialog";
import "../components/toast-stack";

const POLL_MS = 5000;

const STATUS_LABEL: Record<DagStatus, string> = {
  draft: "草稿", active: "执行中", paused: "已暂停", stalled: "受阻", done: "已完成", cancelled: "已取消",
};
const STEP_LABEL: Record<string, string> = {
  pending: "等待", ready: "就绪", in_progress: "进行中", verifying: "验收中", done: "完成", failed: "失败", superseded: "已替换",
};
const BOT_LABEL: Record<BotStatus, string> = { working: "工作中", idle: "空闲", shutdown: "已停止" };

/** 步骤按依赖深度分层（拓扑层级）：depth = 1 + max(depth(dep))。 */
export function layerSteps(plan: PlanStep[], steps: DagStep[]): DagStep[][] {
  const byId = new Map(steps.map((s) => [s.step_id, s]));
  const depth = new Map<string, number>();
  const resolving = new Set<string>();
  const d = (id: string): number => {
    const v = depth.get(id);
    if (v !== undefined) return v;
    if (resolving.has(id)) return 0; // 环由校验器挡住，防御
    resolving.add(id);
    const ps = plan.find((p) => p.step_id === id);
    const deps = (ps?.depends_on ?? []).filter((x) => byId.has(x));
    const v2 = deps.length ? 1 + Math.max(...deps.map(d)) : 0;
    resolving.delete(id);
    depth.set(id, v2);
    return v2;
  };
  const layers: DagStep[][] = [];
  for (const s of steps) {
    const i = d(s.step_id);
    (layers[i] ??= []).push(s);
  }
  return layers.filter(Boolean);
}

@customElement("team-view")
export class TeamView extends LitElement {
  static styles = css`
    :host { box-sizing: border-box; }
    *, *::before, *::after { box-sizing: border-box; }
    :host {
      display: flex; flex-direction: column; height: 100%; min-height: 0;
      background: var(--cortex-bg); font-size: var(--cortex-fs-base); color: var(--cortex-text);
    }
    .page { flex: 1; min-height: 0; overflow-y: auto; padding: var(--cortex-space-4); }
    .empty { color: var(--cortex-text-secondary); text-align: center; padding: 4em 1em; }
    .empty doclens-icon { font-size: 40px; opacity: .4; }
    .empty h3 { margin: .6em 0 .2em; font-weight: 600; }
    .empty p { margin: 0 0 1em; font-size: var(--cortex-fs-sm); }
    .recent { display: flex; gap: var(--cortex-space-2); flex-wrap: wrap; justify-content: center; }
    .strip { display: flex; gap: var(--cortex-space-2); flex-wrap: wrap; align-items: center; margin-bottom: var(--cortex-space-3); }
    .tab {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px;
      border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-pill);
      background: var(--cortex-surface); cursor: pointer; font-size: var(--cortex-fs-sm);
    }
    .tab[active] { background: var(--cortex-btn-primary-bg); color: var(--cortex-btn-primary-text); border-color: transparent; }
    .actions { margin-left: auto; display: flex; gap: var(--cortex-space-2); }
    .btn {
      display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
      border: 1px solid var(--cortex-border); border-radius: var(--cortex-btn-radius);
      background: var(--cortex-surface); color: var(--cortex-text); cursor: pointer; font-size: var(--cortex-fs-sm);
    }
    .btn:hover { background: var(--cortex-bg); }
    .btn.primary { background: var(--cortex-btn-primary-bg); color: var(--cortex-btn-primary-text); border-color: transparent; }
    .btn.danger { color: var(--cortex-danger); }
    .layer { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--cortex-space-3); margin-bottom: var(--cortex-space-3); }
    .layer-label { font-size: var(--cortex-fs-xs); color: var(--cortex-text-secondary); margin: 0 0 var(--cortex-space-1) var(--cortex-space-1); }
    .step {
      border: 1px solid var(--cortex-border-muted); border-radius: var(--cortex-radius-lg);
      background: var(--cortex-surface); padding: var(--cortex-space-3); display: flex; flex-direction: column; gap: 6px;
    }
    .step.in_progress { border-color: var(--cortex-success); }
    .step.failed, .step.stalled { border-color: var(--cortex-danger); }
    .step-head { display: flex; align-items: center; gap: 8px; }
    .step-id { font-family: var(--cortex-font-mono, monospace); font-size: var(--cortex-fs-xs); color: var(--cortex-text-secondary); }
    .step-subject { flex: 1; font-size: var(--cortex-fs-sm); font-weight: 500; }
    .badge { font-size: var(--cortex-fs-xs); padding: 1px 8px; border-radius: var(--cortex-radius-pill); background: var(--cortex-bg); color: var(--cortex-text-secondary); white-space: nowrap; }
    .badge.done { background: var(--cortex-success); color: var(--cortex-on-danger); }
    .badge.in_progress, .badge.verifying { background: var(--cortex-warning); }
    .badge.failed { background: var(--cortex-danger); color: var(--cortex-on-danger); }
    .badge.active, .badge.paused, .badge.stalled, .badge.draft { font-weight: 500; }
    .owner {
      display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
      padding: 1px 8px; border-radius: var(--cortex-radius-pill); border: 1px solid var(--cortex-border);
      font-size: var(--cortex-fs-xs); background: var(--cortex-surface);
    }
    .owner:hover { background: var(--cortex-bg); }
    .meta { font-size: var(--cortex-fs-xs); color: var(--cortex-text-secondary); display: flex; gap: 10px; flex-wrap: wrap; }
    .deliv { display: flex; gap: 8px; flex-wrap: wrap; font-size: var(--cortex-fs-xs); }
    .deliv a { color: var(--cortex-text); }
    .bots { border-top: 1px solid var(--cortex-border-muted); padding: var(--cortex-space-3) var(--cortex-space-4); background: var(--cortex-surface); }
    .bots h4 { margin: 0 0 var(--cortex-space-2); font-size: var(--cortex-fs-sm); font-weight: 600; }
    .bot-row { display: flex; gap: var(--cortex-space-2); flex-wrap: wrap; }
    .bot {
      display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px;
      border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-pill);
      background: var(--cortex-surface); cursor: pointer; font-size: var(--cortex-fs-sm);
    }
    .bot:hover { background: var(--cortex-bg); }
    .bot .dot { width: 8px; height: 8px; border-radius: var(--cortex-radius-circle); background: var(--cortex-text-secondary); }
    .bot .dot.working { background: var(--cortex-success); }
    .bot .dot.idle { background: var(--cortex-warning); }
    .bot .role { color: var(--cortex-text-secondary); font-size: var(--cortex-fs-xs); }
    .bot .lease { color: var(--cortex-text-secondary); font-size: var(--cortex-fs-xs); }
    .bot .del { border: 0; background: none; color: var(--cortex-text-secondary); cursor: pointer; font-size: 14px; padding: 0 2px; }
    .bot .del:hover { color: var(--cortex-danger); }
    .bot.add { border-style: dashed; color: var(--cortex-text-secondary); }
    .bots .hint { color: var(--cortex-text-secondary); font-size: var(--cortex-fs-xs); margin-top: var(--cortex-space-1); }
    dialog.new-bot { border: 1px solid var(--cortex-border); border-radius: var(--cortex-radius-xl); padding: 0;
      background: var(--cortex-surface); box-shadow: var(--cortex-shadow-lg); min-width: 360px; max-width: 90vw; }
    dialog.new-bot::backdrop { background: rgba(0,0,0,.4); }
    .new-form { display: flex; flex-direction: column; gap: var(--cortex-space-3); padding: var(--cortex-space-5); }
    .new-form h3 { margin: 0; font-size: var(--cortex-fs-md); }
    .new-form label { display: flex; flex-direction: column; gap: 4px; font-size: var(--cortex-fs-sm); }
    .new-form input, .new-form select { padding: 6px 10px; border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md); background: var(--cortex-bg); color: var(--cortex-text); font-size: var(--cortex-fs-sm); }
    .role-desc { color: var(--cortex-text-secondary); font-size: var(--cortex-fs-xs); min-height: 2.4em; }
    .new-actions { display: flex; justify-content: flex-end; gap: var(--cortex-space-2); }
    .error { color: var(--cortex-danger); font-size: var(--cortex-fs-sm); margin-bottom: var(--cortex-space-2); }
  `;

  @property({ type: Boolean }) hidden = false;

  @state() private _dags: DagInfo[] = [];
  @state() private _bots: BotInfo[] = [];
  @state() private _selected: number | null = null;
  @state() private _dialogBot: string | null = null;
  @state() private _error: string | null = null;
  @state() private _recent: { id: string; title: string }[] = [];
  /** 新建 Bot 对话框 */
  @state() private _newOpen = false;
  @state() private _newName = "";
  @state() private _newRole = "researcher";
  @state() private _roles: { id: string; name: string; description: string }[] = [];
  @state() private _newBusy = false;

  private _timer: number | null = null;

  private get _sid(): string { return store.getState().chat.currentSession?.id ?? ""; }

  private _unsub: (() => void) | null = null;

  connectedCallback() {
    super.connectedCallback();
    // 父会话切换 → 关闭覆盖层（Bot 归属随会话变；旧会话的 Bot 对新会话不可见）。
    // 初次恢复（空 → 非空）不关：chat-view 异步恢复会话晚于用户点开 Bot
    let lastSid = this._sid;
    this._unsub = store.subscribeSelector(
      (s) => s.chat.currentSession?.id ?? "",
      (sid) => {
        if (this._dialogBot !== null && lastSid && sid !== lastSid) this._dialogBot = null;
        if (sid !== lastSid) this._selected = null;
        lastSid = sid;
        void this._refresh();
      },
    );
    this._start();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    this._unsub = null;
    this._stop();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has("hidden")) {
      if (this.hidden) this._stop(); else this._start();
    }
    if (changed.has("_newOpen")) {
      const dlg = this.renderRoot.querySelector("dialog.new-bot") as HTMLDialogElement | null;
      if (dlg) {
        if (this._newOpen && !dlg.open) {
          dlg.showModal();
          void this._loadRoles();
        } else if (!this._newOpen && dlg.open) {
          dlg.close();
        }
      }
    }
  }

  private async _loadRoles() {
    if (this._roles.length) return;
    try {
      
      this._roles = await listRoles();
    } catch { /* 下拉空也能提交（默认 researcher） */ }
  }

  private async _createBot() {
    const name = this._newName.trim();
    if (!name || this._newBusy) return;
    this._newBusy = true;
    try {
      let sid = this._sid;
      if (!sid) {
        
        
        const s = await createSession({ type: "chat", title: `与 ${name} 对话` });
        const d = await fetchSessionDetail(s.id, { metaOnly: true });
        actions.setChatState({ currentSession: { id: d.id, type: "chat", title: d.title, preview: d.preview,
          updated_at: d.updated_at, message_count: d.message_count } });
        sid = d.id;
      }
      
      await createBot(name, this._newRole, sid);
      this._newOpen = false;
      this._newName = "";
      this._toast(`已创建 ${name}`, "success");
      await this._refresh();
      this._dialogBot = name;
    } catch (e) {
      this._toast(e instanceof ApiError ? e.message : String(e), "error");
    } finally {
      this._newBusy = false;
    }
  }

  private _start() {
    if (this._timer !== null) return;
    void this._refresh();
    this._timer = window.setInterval(() => void this._refresh(), POLL_MS);
  }

  private _stop() {
    if (this._timer !== null) { window.clearInterval(this._timer); this._timer = null; }
  }

  private async _pickSession(id: string) {
    
    
    try {
      const d = await fetchSessionDetail(id, { metaOnly: true });
      actions.setChatState({ currentSession: {
        id: d.id, type: "chat", title: d.title, preview: d.preview,
        updated_at: d.updated_at, message_count: d.message_count,
      } });
    } catch { /* 会话已删等 */ }
  }

  private async _refresh() {
    const sid = this._sid;
    if (!sid) {
      this._dags = [];
      // 空态也列全部 Bot（实体全局可见，ADR-0060 §5）——用户能看到「有哪些 Bot 可以聊」
      try { this._bots = await listBots(""); } catch { this._bots = []; }
      if (this._recent.length === 0) {
        try {
          
          const r = await listSessions({ type: "chat", limit: 8 });
          this._recent = r.sessions;
        } catch { /* ignore */ }
      }
      return;
    }
    try {
      const [dags, bots] = await Promise.all([listDags(sid), listBots(sid)]);
      this._dags = dags;
      this._bots = bots;
      if (this._selected === null || !dags.some((d) => d.id === this._selected)) {
        const pref = dags.find((d) => d.status === "active") ?? dags.find((d) => d.status === "draft")
          ?? dags.find((d) => d.status === "paused") ?? dags.find((d) => d.status === "stalled") ?? dags[0];
        this._selected = pref ? pref.id : null;
      }
    } catch (e) {
      this._error = e instanceof ApiError ? e.message : String(e);
    }
  }

  private _toast(msg: string, level: "info" | "success" | "error" = "info") {
    const stack = document.querySelector("app-bar")?.shadowRoot?.querySelector("toast-stack") as
      (HTMLElement & { pushToast?: (m: string, l?: string, d?: number) => void }) | null | undefined;
    stack?.pushToast?.(msg, level, 3000);
  }

  private async _act(dag: DagInfo, action: "start" | "pause" | "resume" | "cancel") {
    try {
      await dagAction(dag.id, action, this._sid);
      await this._refresh();
    } catch (e) {
      this._toast(e instanceof ApiError ? e.message : String(e), "error");
    }
  }

  private async _deleteBot(bot: BotInfo) {
    if (!window.confirm(`删除 Bot「${bot.name}」？实体、记忆与本会话的对话记录将被删除，不可恢复。`)) return;
    
    try {
      await deleteBot(bot.name, this._sid);
      this._toast(`已删除 ${bot.name}`, "success");
      await this._refresh();
    } catch (e) {
      this._toast(e instanceof ApiError ? e.message : String(e), "error");
    }
  }

  render() {
    const sid = this._sid;
    const dag = this._dags.find((d) => d.id === this._selected) ?? null;
    return html`
      <div class="page">
        ${this._error ? html`<div class="error">${this._error}</div>` : nothing}
        ${!sid ? html`
          <div class="empty">
            <doclens-icon name="users"></doclens-icon>
            <h3>团队</h3>
            <p>团队视图展示当前对话的计划与 Bot。先选一个对话，或去「个人助手」让助手派活。</p>
            ${this._recent.length ? html`
              <div class="recent">
                ${this._recent.map((s) => html`
                  <button class="tab" @click=${() => this._pickSession(s.id)}>${s.title || "（无标题）"}</button>`)}
              </div>` : nothing}
          </div>
        ` : this._dags.length === 0 ? html`
          <div class="empty">
            <doclens-icon name="network"></doclens-icon>
            <h3>当前会话还没有计划</h3>
            <p>在「个人助手」里让助手拆分任务并派给 Bot（加载 team-dispatch 技能），计划会出现在这里。</p>
          </div>
        ` : html`
          <div class="strip">
            ${this._dags.map((d) => html`
              <button class="tab" ?active=${d.id === this._selected} @click=${() => { this._selected = d.id; }}>
                ${d.name} <span class="badge ${d.status}">${STATUS_LABEL[d.status] ?? d.status}</span>
              </button>`)}
            ${dag ? html`<div class="actions">${this._dagActions(dag)}</div>` : nothing}
          </div>
          ${dag ? this._renderDag(dag) : nothing}
        `}
      </div>
      ${this._bots.length ? html`
        <div class="bots">
          <h4>团队 Bot</h4>
          <div class="bot-row">${this._bots.map((b) => this._renderBot(b))}
            <button class="bot add" @click=${() => { this._newOpen = true; }} title="新建 Bot">
              <doclens-icon name="plus" style="font-size:14px"></doclens-icon>新建
            </button>
          </div>
          ${!sid ? html`<div class="hint">点 Bot 直接对话（会新建一个对话）；已有对话的计划在上方。</div>` : nothing}
        </div>` : html`
        <div class="bots">
          <h4>团队 Bot</h4>
          <div class="bot-row">
            <button class="bot add" @click=${() => { this._newOpen = true; }} title="新建 Bot">
              <doclens-icon name="plus" style="font-size:14px"></doclens-icon>新建 Bot
            </button>
          </div>
        </div>`}
      <bot-session-dialog .bot=${this._dialogBot ?? ""} .sessionId=${sid} .open=${this._dialogBot !== null}
                          @closed=${() => { this._dialogBot = null; }}></bot-session-dialog>
      <dialog class="new-bot" @cancel=${(e: Event) => { e.preventDefault(); this._newOpen = false; }}
              @close=${() => { this._newOpen = false; }}>
        ${this._newOpen ? html`
          <form class="new-form" @submit=${(e: Event) => { e.preventDefault(); void this._createBot(); }}>
            <h3>新建 Bot</h3>
            <label>名字<input .value=${this._newName} @input=${(e: InputEvent) => { this._newName = (e.target as HTMLInputElement).value; }}
                              placeholder="字母 / 数字 / 中文 / - _，1–32 字" autofocus /></label>
            <label>角色<select @change=${(e: Event) => { this._newRole = (e.target as HTMLSelectElement).value; }}>
              ${this._roles.map((r) => html`<option value=${r.id} ?selected=${r.id === this._newRole}>${r.name}（${r.id}）</option>`)}
            </select></label>
            <div class="role-desc">${this._roles.find((r) => r.id === this._newRole)?.description ?? ""}</div>
            <div class="new-actions">
              <button type="button" class="btn" @click=${() => { this._newOpen = false; }}>取消</button>
              <button type="submit" class="btn primary" ?disabled=${this._newBusy || !this._newName.trim()}>
                ${this._newBusy ? "创建中…" : "创建并对话"}
              </button>
            </div>
          </form>` : nothing}
      </dialog>
    `;
  }

  private async _retry(dag: DagInfo, s: DagStep) {
    try {
      await dagAction(dag.id, "retry", this._sid, s.step_id);
      this._toast(`已重试步骤 ${s.step_id}`, "success");
      await this._refresh();
    } catch (e) {
      this._toast(e instanceof ApiError ? e.message : String(e), "error");
    }
  }

  private _replan(dag: DagInfo) {
    // 重规划是自然语言活：跳 chat 预填，lead 调 group_plan_replan。
    // 预填经 store.pendingPrefill（chat-view 可能尚未挂载，事件会丢）
    const draft = `对计划 #${dag.id}「${dag.name}」重规划：失败的步骤是 ${dag.failed_step ?? "?"}（${dag.stall_reason ?? ""}）。保留已完成步骤，只重提未完成的。`;
    actions.setPendingPrefill(draft);
    actions.setView("chat");
  }

  private _dagActions(dag: DagInfo) {
    const a = (act: "start" | "pause" | "resume" | "cancel", label: string, icon: string, cls = "") => html`
      <button class="btn ${cls}" @click=${() => this._act(dag, act)}><doclens-icon name=${icon}></doclens-icon>${label}</button>`;
    switch (dag.status) {
      case "draft": return a("start", "开始", "play", "primary");
      case "active": return html`${a("pause", "暂停", "pause")}${a("cancel", "取消", "x", "danger")}`;
      case "paused": return html`${a("resume", "继续", "play", "primary")}${a("cancel", "取消", "x", "danger")}`;
      case "stalled": return html`<button class="btn primary" @click=${() => this._replan(dag)}><doclens-icon name="git-fork"></doclens-icon>重规划</button>${a("cancel", "取消", "x", "danger")}`;
      default: return nothing;
    }
  }

  private _renderDag(dag: DagInfo) {
    const layers = layerSteps(dag.plan.steps, dag.steps);
    return html`
      ${dag.stall_reason ? html`<div class="error">受阻原因：${dag.stall_reason}${dag.failed_step ? `（步骤 ${dag.failed_step}）` : ""}</div>` : nothing}
      ${layers.map((layer, i) => html`
        <div class="layer-label">第 ${i + 1} 层${i === 0 ? "" : "（依赖上一层）"}</div>
        <div class="layer">${layer.map((s) => this._renderStep(dag, s))}</div>
      `)}
    `;
  }

  private _renderStep(dag: DagInfo, s: DagStep) {
    const ps = dag.plan.steps.find((p) => p.step_id === s.step_id);
    const deps = (ps?.depends_on ?? []).join(", ");
    const owner = s.assignee ?? ps?.assignee ?? null;
    const bot = owner ? this._bots.find((b) => b.name === owner) : null;
    const role = bot?.role ?? ps?.role ?? "";
    const openBot = () => { if (owner) this._dialogBot = owner; };
    return html`
      <div class="step ${s.status}">
        <div class="step-head">
          <span class="step-id">${s.step_id}</span>
          <span class="step-subject" title=${ps?.instructions ?? ""}>${s.subject ?? ps?.subject ?? ""}</span>
          <span class="badge ${s.status}">${STEP_LABEL[s.status] ?? s.status}${s.interrupted ? "（中断）" : ""}</span>
          ${s.status === "failed" && dag.status === "stalled" ? html`
            <button class="btn" @click=${() => this._retry(dag, s)} title="重试此步骤"><doclens-icon name="list-restart"></doclens-icon>重试</button>` : nothing}
        </div>
        ${owner ? html`
          <button class="owner" @click=${openBot} title="打开 ${owner} 的会话">
            <span class="dot ${bot?.status ?? ""}" style="width:6px;height:6px;border-radius:9999px;background:var(--cortex-text-secondary)"></span>
            ${owner}${role ? html`<span class="role">（${role}）</span>` : nothing}
          </button>` : html`<span class="meta">未指定 owner</span>`}
        ${deps ? html`<div class="meta">依赖：${deps}</div>` : nothing}
        ${(ps?.deliverables?.length ?? 0) > 0 ? html`
          <div class="deliv">${ps!.deliverables!.map((d) => html`
            <a href="/api/preview?path=${encodeURIComponent((dag.output_dir.replace(/\\/g, "/") + "/" + d.path))}"
               target="_blank" title=${d.path}>${d.path.split("/").pop()}</a>`)}
          </div>` : nothing}
      </div>
    `;
  }

  /** 点 Bot：无会话 → 先建一个 chat 会话；无租约 → 本会话租借（spawn 语义）；
   *  他会话占用 → toast。然后打开覆盖层。 */
  private async _openBot(b: BotInfo) {
    let sid = this._sid;
    if (!sid) {
      try {
        const { createSession } = await import("../api/sessions");
        
        const s = await createSession({ type: "chat", title: `与 ${b.name} 对话` });
        
        const d = await fetchSessionDetail(s.id, { metaOnly: true });
        actions.setChatState({ currentSession: { id: d.id, type: "chat", title: d.title, preview: d.preview,
          updated_at: d.updated_at, message_count: d.message_count } });
        sid = d.id;
      } catch (e) {
        this._toast(e instanceof ApiError ? e.message : String(e), "error");
        return;
      }
    }
    if (b.leased_by && b.leased_by !== sid) {
      this._toast(`${b.name} 正被其他会话占用`, "error");
      return;
    }
    if (!b.leased_by) {
      try {
        
        await createBot(b.name, b.role, sid);
      } catch (e) {
        this._toast(e instanceof ApiError ? e.message : String(e), "error");
        return;
      }
    }
    this._dialogBot = b.name;
    void this._refresh();
  }

  private _renderBot(b: BotInfo) {
    const mine = b.leased_by === this._sid;
    const lease = mine ? "本会话" : (b.leased_by ? "会话占用" : "空闲");
    const clickable = !b.leased_by || mine;
    return html`
      <span class="bot" @click=${() => clickable && void this._openBot(b)} title=${b.memory_summary || b.name} style="cursor:${clickable ? "pointer" : "default"}">
        <span class="dot ${b.status}"></span>
        <span>${b.name}</span>
        <span class="role">${b.role}</span>
        <span class="lease">${BOT_LABEL[b.status]} · ${lease}</span>
        ${b.task ? html`<span class="role">· ${b.task.subject}</span>` : nothing}
        ${mine ? html`<button class="del" title="删除 Bot" @click=${(e: Event) => { e.stopPropagation(); void this._deleteBot(b); }}>
          <doclens-icon name="trash-2" style="font-size:13px"></doclens-icon></button>` : nothing}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "team-view": TeamView; }
}
