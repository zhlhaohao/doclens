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

/** 构造整个 trace 的完整可拷贝文本（所有步骤的 name + 完整 input + 完整 output，无截断）。 */
export function buildFullText(steps: ToolStep[]): string {
  const lines: string[] = [`思考过程（${steps.length} 步）`];
  steps.forEach((s, i) => {
    lines.push("");
    lines.push(`[${i + 1}] ${s.name}`);
    if (Object.keys(s.input).length) {
      lines.push("参数：");
      lines.push(JSON.stringify(s.input, null, 2));
    }
    if (s.output != null && s.output !== "") {
      lines.push("结果：");
      lines.push(s.output);
    } else {
      lines.push("结果：（无输出）");
    }
  });
  return lines.join("\n");
}

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
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .res::-webkit-scrollbar {
      display: none;
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
    .copy-btn {
      margin-left: auto;
      background: transparent;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      padding: 2px 8px;
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font);
      line-height: 1.2;
    }
    .copy-btn:hover { background: var(--cortex-primary-soft); color: var(--cortex-primary-hover); }
    .copy-btn.copied { border-color: var(--cortex-success); color: var(--cortex-success); }
  `;

  @property({ attribute: false }) steps: ToolStep[] = [];
  @state() private _expanded = false;
  @state() private _fullResultIds = new Set<string>();
  @state() private _copied = false;

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

  private async _onCopy(e: Event) {
    e.stopPropagation();
    const text = buildFullText(this.steps);
    try {
      await navigator.clipboard.writeText(text);
      this._copied = true;
      setTimeout(() => { this._copied = false; }, 2000);
    } catch (err) {
      // clipboard 不可用（权限/非安全上下文）时降级：使用隐藏 textarea + execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        this._copied = true;
        setTimeout(() => { this._copied = false; }, 2000);
      } catch (err2) {
        console.warn("copy failed:", err2);
      }
    }
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
        <button class="copy-btn ${this._copied ? "copied" : ""}" @click=${this._onCopy} title=${this._copied ? "已复制" : "复制全文"}>${this._copied ? "✓ 已复制" : "📋"}</button>
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
