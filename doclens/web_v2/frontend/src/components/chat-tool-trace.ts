import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ToolStep } from "../state/types";

const TOOL_ICON: Record<string, string> = {
  search: "🔍",
  read_document: "📄",
  grep: "🔎",
};

const TOOL_ACTION: Record<string, string> = {
  search: "正在搜索",
  read_document: "正在读取",
  grep: "正在检索",
};

@customElement("chat-tool-trace")
export class ChatToolTrace extends LitElement {
  static styles = css`
    :host { display: block; }
    .summary {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted);
      cursor: pointer; user-select: none; padding: 2px 0;
    }
    .summary .arrow { color: var(--cortex-primary); font-weight: 700; }
    .summary .count { color: var(--cortex-text); font-weight: 600; }
    .steps { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
    .step {
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      padding: 7px 9px;
    }
    .step.running { border-color: var(--cortex-primary); background: var(--cortex-primary-soft); }
    .step.error { border-color: var(--cortex-danger); }
    .head { display: flex; align-items: center; gap: 7px; font-size: var(--cortex-fs-sm); color: var(--cortex-text); }
    .head .name { font-weight: 600; font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-sm); }
    .head .meta { margin-left: auto; color: var(--cortex-text-subtle); font-size: var(--cortex-fs-xs); }
    .head .ok { color: var(--cortex-success); }
    .head .err { color: var(--cortex-danger); }
    .arg {
      color: var(--cortex-text-muted); margin-top: 3px;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      white-space: pre-wrap; word-break: break-word;
    }
    .res {
      margin-top: 5px; background: var(--cortex-bg);
      border-radius: var(--cortex-radius-sm); padding: 5px 7px;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      white-space: pre-wrap; word-break: break-word;
      max-height: 96px; overflow-y: auto;
    }
    .res .more { color: var(--cortex-primary); cursor: pointer; display: inline-block; margin-top: 3px; }
    .spin {
      width: 12px; height: 12px;
      border: 2px solid var(--cortex-primary);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin .8s infinite linear;
      display: inline-block;
    }
    .running-text { color: var(--cortex-primary-hover); font-size: var(--cortex-fs-xs); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  `;

  @property({ attribute: false }) steps: ToolStep[] = [];
  @state() private _expanded = false;
  @state() private _fullResultIds = new Set<string>();

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("steps")) {
      const oldSteps = (changed.get("steps") as ToolStep[] | undefined) ?? [];
      const wasRunning = oldSteps.some((s) => s.status === "running");
      const nowRunning = this.steps.some((s) => s.status === "running");
      if (!wasRunning && nowRunning) this._expanded = true;
      else if (wasRunning && !nowRunning) this._expanded = false;
    }
  }

  private _toggle() {
    this._expanded = !this._expanded;
  }

  private _toggleResult(id: string) {
    const next = new Set(this._fullResultIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    this._fullResultIds = next;
  }

  private _renderArgs(input: Record<string, unknown>): string {
    return Object.entries(input)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("\n");
  }

  private _renderStep(s: ToolStep) {
    const running = s.status === "running";
    const error = s.status === "error";
    const icon = TOOL_ICON[s.name] ?? "🔧";
    const showFull = this._fullResultIds.has(s.tool_use_id);
    const outputLines = (s.output ?? "").split("\n");
    const truncated = !showFull && outputLines.length > 5;
    const visible = truncated ? outputLines.slice(0, 5).join("\n") : (s.output ?? "");
    const hasOutput = s.output != null && s.output !== "";
    return html`
      <div class="step ${running ? "running" : ""} ${error ? "error" : ""}">
        <div class="head">
          ${running ? html`<span class="spin"></span>` : html`<span>${icon}</span>`}
          <span class="name">${s.name}</span>
          ${running ? html`<span class="running-text">${TOOL_ACTION[s.name] ?? "正在调用"}...</span>` : null}
          <span class="meta">
            ${!running ? (error ? html`<span class="err">✗</span>` : html`<span class="ok">✓</span>`) : null}
            ${s.duration_ms != null ? html` ${Math.round(s.duration_ms)}ms` : null}
          </span>
        </div>
        ${Object.keys(s.input).length ? html`<div class="arg">${this._renderArgs(s.input)}</div>` : null}
        ${hasOutput
          ? html`<div class="res">${visible}${truncated
              ? html`<span class="more" @click=${() => this._toggleResult(s.tool_use_id)}>展开全部 (${outputLines.length} 行) ⌄</span>`
              : null}</div>`
          : (running ? null : html`<div class="arg">（无输出）</div>`)}
      </div>
    `;
  }

  render() {
    if (!this.steps.length) return null;
    const running = this.steps.some((s) => s.status === "running");
    return html`
      <div class="summary" @click=${this._toggle}>
        <span class="arrow">${this._expanded ? "▾" : "▸"}</span>
        🧠 思考过程 · <span class="count">${this.steps.length} 步</span>
        ${running ? " · 进行中" : ""}
      </div>
      ${this._expanded ? html`<div class="steps">${this.steps.map((s) => this._renderStep(s))}</div>` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "chat-tool-trace": ChatToolTrace;
  }
}
