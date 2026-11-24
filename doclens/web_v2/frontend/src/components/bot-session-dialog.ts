/** Bot 会话覆盖层（ADR-0060 §2/§3）：全屏 <dialog> 覆盖团队页面，复用 chat-stream
 *  子组件渲染 Bot 对话 + 实时 SSE + 输入框 + 暂停。
 *
 *  不复用 <chat-view>：它是绑定 store.currentSession 的全局单例（1725 行），注入
 *  另一个 session 要动它的核心状态机。这里复用的是它的**子组件**（chat-stream /
 *  input-box）与纯函数（applyStreamEvent / finalizeInterruptedMessages）。
 *
 *  数据流：打开 → detail（含 generating + last_persisted_seq）→ 订阅 SSE →
 *  snapshot.text_so_far 填入 live 气泡 → 后续 delta 追加 → persisted 事件到达时
 *  该 seq 已在 detail 里（前端按 seq 去重：detail 只取 seq <= last_persisted_seq，
 *  在飞文本以 snapshot/流为唯一源）→ round_end 撤 live 气泡并重拉 detail。
 *
 *  关闭即断流（AbortController）；重开重连。
 */
import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import type { ChatMessage, ToolStep } from "../state/types";
import type { BotStreamEvent } from "../api/team";
import { streamBotEvents, fetchBotSession, sendToBot, stopBot, ApiError } from "../api/team";
import type { TimelineNode } from "../views/chat-timeline";
import "../components/chat-stream";
import "../components/input-box";
import "../components/icon";
import { dialogCardStyles } from "../styles/dialog-frame";

@customElement("bot-session-dialog")
export class BotSessionDialog extends LitElement {
  static styles = [dialogCardStyles, css`
    :host { display: contents; }
    dialog.overlay {
      width: min(80vw, 1100px);
      height: min(88vh, 900px);
      max-width: none;
      max-height: none;
      padding: 0;
    }
    @media (max-width: 1023px) {
      dialog.overlay { width: 100vw; height: 100vh; max-width: 100vw; max-height: 100vh; border-radius: 0; border: 0; }
    }
    .frame { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .head {
      display: flex; align-items: center; gap: var(--cortex-space-3);
      padding: var(--cortex-space-3) var(--cortex-space-4);
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .head h3 { margin: 0; font-size: var(--cortex-fs-md); font-weight: 600; flex: 1; }
    .role { color: var(--cortex-text-secondary); font-size: var(--cortex-fs-sm); }
    .dot { width: 8px; height: 8px; border-radius: var(--cortex-radius-circle); background: var(--cortex-text-secondary); }
    .dot.working { background: var(--cortex-success); }
    .dot.idle { background: var(--cortex-warning); }
    .btn {
      display: inline-flex; align-items: center; gap: 4px;
      border: 1px solid var(--cortex-border); border-radius: var(--cortex-btn-radius);
      background: var(--cortex-surface); color: var(--cortex-text);
      padding: 4px 10px; font-size: var(--cortex-fs-sm); cursor: pointer;
    }
    .btn:hover { background: var(--cortex-bg); }
    .btn:disabled { opacity: .5; cursor: default; }
    .body { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    chat-stream { flex: 1; min-height: 0; }
    .input { border-top: 1px solid var(--cortex-border-muted); padding: var(--cortex-space-2) var(--cortex-space-3); }
    .hint { color: var(--cortex-text-secondary); font-size: var(--cortex-fs-xs); padding: 2px 6px 4px; }
  `];

  @property() bot = "";
  @property() sessionId = "";
  @property({ type: Boolean, reflect: true }) open = false;

  @state() private _nodes: TimelineNode[] = [];
  @state() private _generating = false;
  @state() private _live = false;
  @state() private _error: string | null = null;
  @state() private _sending = false;

  private _controller: AbortController | null = null;
  private _lastSeq = 0;
  private _liveText = "";
  private _liveSteps: ToolStep[] = [];

  disconnectedCallback() {
    super.disconnectedCallback();
    this._abort();
  }

  protected updated(changed: Map<string, unknown>) {
    if (!changed.has("open")) return;
    const dlg = this.renderRoot.querySelector("dialog");
    if (!dlg) return;
    if (this.open) {
      if (!dlg.open) dlg.showModal();
      void this._open();
    } else if (dlg.open) {
      dlg.close();
      this._abort();
    }
  }

  private _abort() {
    this._controller?.abort();
    this._controller = null;
    this._live = false;
    this._liveText = "";
    this._liveSteps = [];
  }

  private async _open() {
    this._error = null;
    this._nodes = [];
    this._generating = false;
    try {
      const d = await fetchBotSession(this.bot, this.sessionId);
      this._lastSeq = d.last_persisted_seq;
      this._generating = d.generating;
      this._nodes = this._mapItems(d.items);
      if (d.generating) {
        this._live = true;
        this._nodes = [...this._nodes, { type: "message", message: { role: "assistant", content: "" } }];
      }
      this._controller = new AbortController();
      void this._pump(this._controller.signal);
    } catch (e) {
      this._error = e instanceof ApiError ? e.message : String(e);
    }
  }

  /** Bot 会话条目 → 时间线：message_user/message_ai 原样；tool_calls（单步）
   *  归并进上一条 assistant；bot_notice 渲染为 notice 气泡。 */
  private _mapItems(items: { kind: string; payload: string; seq?: number }[]): TimelineNode[] {
    const nodes: TimelineNode[] = [];
    for (const it of items) {
      if (it.seq !== undefined && it.seq > this._lastSeq) continue;
      let p: any;
      try { p = JSON.parse(it.payload); } catch { continue; }
      if (it.kind === "message_user") {
        nodes.push({ type: "message", message: { role: "user", content: p.text ?? p.content ?? "", seq: it.seq } });
      } else if (it.kind === "message_ai") {
        nodes.push({ type: "message", message: { role: "assistant", content: p.text ?? p.content ?? "", seq: it.seq } });
      } else if (it.kind === "tool_calls") {
        const last = nodes[nodes.length - 1];
        const calls = (p.calls ?? []).map((c: any) => ({
          tool_use_id: c.tool_use_id ?? `s${it.seq}-${Math.random().toString(36).slice(2, 6)}`,
          name: c.name ?? "", input: c.input ?? {}, output: c.output,
          status: (c.status === "error" ? "error" : "done") as ToolStep["status"],
        }));
        if (last && last.type === "message" && last.message.role === "assistant") {
          last.message = { ...last.message, tool_steps: [...(last.message.tool_steps ?? []), ...calls] };
        } else {
          nodes.push({ type: "message", message: { role: "assistant", content: "", tool_steps: calls, seq: it.seq } });
        }
      } else if (it.kind === "bot_notice") {
        // 系统条目（派单 / 打回 / 重派 / 停止 / Bot 回信）——以 user 侧气泡呈现，带 notice 标记
        nodes.push({ type: "message", message: { role: "user", content: p.text ?? "", seq: it.seq, notice: p.notice_type } });
      }
    }
    return nodes;
  }

  private async _pump(signal: AbortSignal) {
    try {
      for await (const ev of streamBotEvents(this.bot, this.sessionId, signal)) {
        this._apply(ev);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") this._error = e instanceof ApiError ? e.message : String(e);
    } finally {
      this._live = false;
    }
  }

  private _apply(ev: BotStreamEvent) {
    switch (ev.event) {
      case "snapshot":
        this._liveText = ev.data.text_so_far ?? "";
        this._generating = ev.data.generating;
        this._lastSeq = Math.max(this._lastSeq, ev.data.last_persisted_seq ?? 0);
        this._refreshLive();
        break;
      case "text_delta":
        this._liveText += ev.data.text ?? "";
        this._refreshLive();
        break;
      case "tool_call": {
        if (ev.data.complete) {
          this._liveSteps = this._liveSteps.map((s) => s.tool_use_id === ev.data.tool_use_id
            ? { ...s, input: ev.data.input, status: "done" as const } : s);
        } else {
          this._liveSteps = [...this._liveSteps, { tool_use_id: ev.data.tool_use_id, name: ev.data.name, input: {}, status: "running" }];
        }
        this._refreshLive();
        break;
      }
      case "round_end":
        // 终态已落库：撤 live 气泡，重拉 detail（ Bot 可能继续下一轮——
        // detail 回来后若仍 generating 再补一个空 live 气泡）
        void this._reload();
        break;
      case "status":
        this._generating = ev.data.alive;
        break;
      default:
        break;
    }
  }

  /** live 气泡 = 末条无 seq 的 assistant；每次增量替换它。 */
  private _refreshLive() {
    if (!this._live) return;
    const live: ChatMessage = { role: "assistant", content: this._liveText };
    if (this._liveSteps.length) live.tool_steps = this._liveSteps;
    const base = this._nodes.filter((n) => !this._isLive(n));
    this._nodes = [...base, { type: "message", message: live }];
  }

  private _isLive(n: TimelineNode): boolean {
    return n.type === "message" && n.message.role === "assistant" && n.message.seq === undefined;
  }

  private async _reload() {
    try {
      const d = await fetchBotSession(this.bot, this.sessionId);
      this._lastSeq = d.last_persisted_seq;
      this._generating = d.generating;
      this._liveText = "";
      this._liveSteps = [];
      const nodes = this._mapItems(d.items);
      this._nodes = d.generating
        ? [...nodes, { type: "message", message: { role: "assistant", content: "" } }]
        : nodes;
      this._live = d.generating;
      if (d.generating && !this._controller) {
        this._controller = new AbortController();
        void this._pump(this._controller.signal);
      }
    } catch { /* 保留下一次 */ }
  }

  private async _onSend(e: CustomEvent<{ value: string }>) {
    const text = (e.detail?.value ?? "").trim();
    if (!text || this._sending) return;
    this._sending = true;
    try {
      await sendToBot(this.bot, this.sessionId, text);
      // 消息可能落在另一个会话（Bot 无任务时落纯对话会话，而覆盖层打开的是
      // task 会话）——重拉 detail 让显示切到消息实际所在的会话；_reload 内
      // 按 generating 决定是否补 live 气泡与起 SSE pump
      await this._reload();
      this._generating = true;
    } catch (err) {
      this._error = err instanceof ApiError ? err.message : String(err);
    } finally {
      this._sending = false;
    }
  }

  private async _onStop() {
    try { await stopBot(this.bot, this.sessionId); } catch (err) {
      this._error = err instanceof ApiError ? err.message : String(err);
    }
  }

  private _close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true }));
  }

  render() {
    if (!this.open) return nothing;
    return html`
      <dialog class="overlay" @cancel=${(e: Event) => { e.preventDefault(); this._close(); }}>
        <div class="frame">
          <div class="head">
            <span class="dot ${this._generating ? "working" : "idle"}"></span>
            <h3>${this.bot}</h3>
            <span class="role">${this._generating ? "工作中" : "空闲"}</span>
            <button class="btn" ?disabled=${!this._generating} @click=${this._onStop} title="暂停该 Bot 所属 DAG">
              <doclens-icon name="pause"></doclens-icon>暂停
            </button>
            <button class="btn" @click=${this._close} title="关闭">
              <doclens-icon name="x"></doclens-icon>
            </button>
          </div>
          <div class="body">
            ${this._error ? html`<div class="hint" style="color:var(--cortex-danger)">${this._error}</div>` : nothing}
            <chat-stream .nodes=${this._nodes} ?generating=${this._generating}></chat-stream>
            <div class="input">
              <input-box multiline placeholder="对 ${this.bot} 说点什么…" buttonLabel="发送"
                         ?disabled=${false} ?streaming=${this._sending}
                         @submit=${this._onSend}></input-box>
              <div class="hint">用户消息与系统派单在 Bot 眼里是两种输入；Bot 复活后不记得本会话上文（靠记忆续接）。</div>
            </div>
          </div>
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "bot-session-dialog": BotSessionDialog; }
}
