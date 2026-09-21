import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { TemplateResult } from "lit";
import type { ToolStep } from "../state/types";

const TOOL_ICON: Record<string, string> = {
  search: "search",
  read_document: "file",
  grep: "search",
  kb_grep: "search",
};

const TOOL_ACTION: Record<string, string> = {
  search: "正在搜索",
  read_document: "正在读取",
  grep: "正在检索",
  kb_grep: "正在检索",
};

/** MCP 工具显示名：mcp__<server>__<tool> → server / tool。 */
function mcpDisplayName(name: string): string | null {
  if (!name.startsWith("mcp__")) return null;
  const rest = name.slice(5);
  const sep = rest.indexOf("__");
  if (sep <= 0) return null;
  return `${rest.slice(0, sep)} / ${rest.slice(sep + 2)}`;
}

/** load_skill 回显摘要：技能 body 动辄上百行，思考过程只需知道加载了哪个技能。
 *  技能名优先取入参 name，兜底解析 output 的 <skill name="..."> 头；
 *  空输出 / 错误不适用（保持原样回显）；全文见「复制全文」与技能管理页。 */
export function skillResultSummary(s: ToolStep): string | null {
  if (s.name !== "load_skill") return null;
  const out = s.output ?? "";
  if (!out || out.startsWith("Error:")) return null;
  const inputName = s.input?.name;
  const name =
    typeof inputName === "string" && inputName.trim()
      ? inputName.trim()
      : out.match(/<skill name="([^"]+)">/)?.[1] ?? "";
  const lines = out.split("\n").length;
  return name ? `已加载技能 "${name}"（${lines} 行）` : `已加载技能内容（${lines} 行）`;
}

export interface DiffRow {
  type: "ctx" | "del" | "add";
  line: string;
}

/** 多行参数值的展示截断（与 output 区 / read_file 回显一致：5 行预览）。
 *  write_file 的 content 等大参数不再整段铺开，展开交互同 output。 */
export function argPreview(text: string, maxLines = 5): { visible: string; totalLines: number } {
  const lines = text.split("\n");
  return {
    visible: lines.length > maxLines ? lines.slice(0, maxLines).join("\n") : text,
    totalLines: lines.length,
  };
}

/** 展示时置顶的路径类参数——模型传参顺序不保证（write_file 常见 content 在
 *  path 之前），文件名先于内容才符合阅读逻辑。 */
const ARG_FIRST_KEYS = ["path", "file_path"];

export function orderedArgEntries(input: Record<string, unknown>): [string, unknown][] {
  const first = ARG_FIRST_KEYS.filter((k) => k in input);
  const rest = Object.entries(input).filter(([k]) => !ARG_FIRST_KEYS.includes(k));
  return [...first.map((k) => [k, input[k]] as [string, unknown]), ...rest];
}

/** 成功输出与已展示内容重复时结果区不渲染；错误输出与带替换处数的
 *  「Edited <path>（替换 N 处）」（diff 只示一处，处数有信息量）照常显示。 */
export function isRedundantOutput(s: ToolStep): boolean {
  const out = s.output ?? "";
  if (out === "" || out.startsWith("Error:")) return false;
  // write_file："Wrote N bytes to <path>" 与 path/content 重复
  if (s.name === "write_file") return true;
  // edit_file："Edited <path>" 与 diff 头的 path 重复
  if (s.name === "edit_file" && typeof s.input?.path === "string") {
    return out === `Edited ${s.input.path}`;
  }
  return false;
}

/** shell 类工具（bash / powershell）成功输出默认收起——命令行输出噪音多，
 *  点击「展开输出」才查看；错误输出不收起（失败原因需直接可见）。 */
export const SHELL_TOOLS = new Set(["bash", "powershell"]);

export function isShellOutputCollapsed(s: ToolStep, showFull: boolean): boolean {
  return SHELL_TOOLS.has(s.name) && s.status !== "error" && !showFull;
}

/** DP 表规模上限：超过则退化为「全删 + 全增」（保真不省略，不做配对） */
const MAX_DIFF_CELLS = 1_000_000;

/** 行级 LCS diff（edit_file 回显用，对齐 Claude Code CLI 观感）：
 *  两边共有的行配对为 ctx 上下文，old 独有为 del，new 独有为 add。 */
export function lineDiff(oldText: string, newText: string): DiffRow[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  if (a.length * b.length > MAX_DIFF_CELLS) {
    return [
      ...a.map((line) => ({ type: "del" as const, line })),
      ...b.map((line) => ({ type: "add" as const, line })),
    ];
  }
  // 经典 LCS 长度表（自底向上），再自顶向下回溯出配对
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: "ctx", line: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: "del", line: a[i] });
      i++;
    } else {
      rows.push({ type: "add", line: b[j] });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: "del", line: a[i] });
    i++;
  }
  while (j < m) {
    rows.push({ type: "add", line: b[j] });
    j++;
  }
  return rows;
}

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
    :host {
      display: block;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface-muted);
      overflow: hidden;
    }
    .summary {
      display: flex; align-items: center; gap: 6px;
      font-size: var(--cortex-fs-sm); color: var(--cortex-text-muted);
      cursor: pointer; user-select: none;
      padding: var(--cortex-space-2) var(--cortex-space-3);
    }
    .summary:hover { background: var(--cortex-surface); }
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
    .head .meta { margin-left: auto; color: var(--cortex-text-subtle); font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs); }
    .head .ok { color: var(--cortex-success); }
    .head .err { color: var(--cortex-danger); }
    .arg {
      color: var(--cortex-text-muted); margin-top: 3px;
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      white-space: pre-wrap; word-break: break-word;
    }
    /* edit_file 行级 diff（对齐 Claude Code CLI）：del 红底白字 / add 绿底青字 / ctx 上下文弱化 */
    .diff {
      margin-top: 3px; border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-sm);
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      max-height: 160px; overflow-y: auto;
      scrollbar-width: none; -ms-overflow-style: none;
    }
    .diff::-webkit-scrollbar { display: none; }
    .diff .dl {
      display: block; padding: 0 6px; min-height: 1.4em; line-height: 1.4;
      white-space: pre-wrap; word-break: break-word;
    }
    .diff .path { color: var(--cortex-text-muted); background: var(--cortex-surface); }
    .diff .ctx { color: var(--cortex-text-muted); }
    .diff .del { background: var(--cortex-danger); color: #fff; }
    .diff .add { background: var(--cortex-success); color: #a5f3fc; }
    .res {
      margin-top: 5px; background: var(--cortex-surface);
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
    .res .more, .arg .more { color: var(--cortex-primary); cursor: pointer; display: inline-block; margin-top: 3px; }
    .spin {
      width: 12px; height: 12px;
      border: 2px solid var(--cortex-primary);
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin .8s infinite linear;
      display: inline-block;
    }
    .running-text { color: var(--cortex-primary); font-size: var(--cortex-fs-xs); }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
    .copy-btn {
      margin-left: auto;
      /* 背景融入 .summary 容器（transparent + 无边框），仅 hover/已复制 给轻反馈 */
      background: transparent;
      border: none;
      border-radius: var(--cortex-radius-sm);
      padding: 2px 6px;
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font);
      line-height: 1.2;
    }
    .copy-btn:hover { background: var(--cortex-surface); color: var(--cortex-primary); }
    .copy-btn.copied { color: var(--cortex-success); }
  `;

  @property({ attribute: false }) steps: ToolStep[] = [];
  @state() private _expanded = false;
  /** 用户手动切换过展开态——此后运行态自动展开/收起不再覆盖。 */
  private _userToggled = false;
  @state() private _fullResultIds = new Set<string>();
  @state() private _copied = false;
  /** lineDiff 结果记忆化（tool_use_id + 两文本长度 → 行）：流式期间每次
   *  input_json_delta 触发重渲染，O(n×m) LCS DP 不记忆化则每 delta 重算
   *  数十万 cell；文本单调增长，长度即版本号。超上限清空防长会话累积。 */
  private _diffCache = new Map<string, DiffRow[]>();

  willUpdate(changed: Map<string, unknown>) {
    if (changed.has("steps")) {
      const oldSteps = (changed.get("steps") as ToolStep[] | undefined) ?? [];
      const wasRunning = oldSteps.some((s) => s.status === "running");
      const nowRunning = this.steps.some((s) => s.status === "running");
      // 自动展开/收起只服务未手动操作过的 trace；用户切换过展开态后
      // 不再覆盖（手工展开不会被「运行结束自动收起」回吞）
      if (!this._userToggled) {
        if (!wasRunning && nowRunning) this._expanded = true;
        else if (wasRunning && !nowRunning) this._expanded = false;
      }
    }
  }

  private _toggle() {
    this._userToggled = true;
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

  private _renderArgs(s: ToolStep): TemplateResult {
    const entries = orderedArgEntries(s.input);
    // pre-wrap 下模板换行会渲染成空行：参数间用 <br> 显式分隔，map 外不另起行。
    // 大块多行参数（write_file 的 content 等）不写 key 标签、值从新行开始；
    // 单行参数保持「key: value」同行。
    return html`${entries.map(([k, v], i) => {
      const text = typeof v === "string" ? v : JSON.stringify(v);
      const multi = text.includes("\n");
      const label = multi ? nothing : html`${k}: `;
      // 多行内容块与上方参数间空一行（两个 <br>），单行参数紧邻上一行
      const gap = i === 0 ? nothing : multi ? html`<br /><br />` : html`<br />`;
      return html`${gap}${label}${this._renderArgValue(s, k, v)}`;
    })}`;
  }

  /** 单个参数值：多行超 5 行截断为预览 + 「展开全部」（键 `${tool_use_id}:arg:${key}`
   *  复用 _fullResultIds 展开态，与 output 区交互一致）；非字符串 JSON 序列化。 */
  private _renderArgValue(s: ToolStep, key: string, value: unknown): TemplateResult {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    const argKey = `${s.tool_use_id}:arg:${key}`;
    const { visible, totalLines } = argPreview(text);
    const truncated = !this._fullResultIds.has(argKey) && totalLines > 5;
    return html`${truncated ? visible : text}${truncated
      ? html`<span class="more" @click=${() => this._toggleResult(argKey)}>展开全部 (${totalLines} 行) ⌄</span>`
      : nothing}`;
  }

  /** edit_file 参数 → 行级 diff 块（首行 path，其后 ctx/-/+ 行）；running 中即展示
   *  （能看到将要改什么）。old_text/new_text 非 string 时返回 null，回退通用参数渲染。 */
  private _renderEditDiff(s: ToolStep): TemplateResult | null {
    if (s.name !== "edit_file") return null;
    const { path, old_text, new_text } = s.input;
    if (typeof old_text !== "string" || typeof new_text !== "string") return null;
    const key = `${s.tool_use_id}:${old_text.length}:${new_text.length}`;
    let rows = this._diffCache.get(key);
    if (rows === undefined) {
      if (this._diffCache.size > 64) this._diffCache.clear();
      rows = lineDiff(old_text, new_text);
      this._diffCache.set(key, rows);
    }
    const prefix: Record<DiffRow["type"], string> = { ctx: "  ", del: "- ", add: "+ " };
    return html`
      <div class="diff">
        ${typeof path === "string" && path
          ? html`<span class="dl path">${path}</span>`
          : nothing}
        ${rows.map(
          (r) => html`<span class="dl ${r.type}">${prefix[r.type]}${r.line}</span>`,
        )}
      </div>
    `;
  }

  private _renderStep(s: ToolStep) {
    const running = s.status === "running";
    const error = s.status === "error";
    const mcpName = mcpDisplayName(s.name);
    const icon = mcpName ? "plug" : (TOOL_ICON[s.name] ?? "settings");
    // load_skill 有摘要时结果区只显示技能名（不渲染正文、无展开按钮）
    const summary = skillResultSummary(s);
    const showFull = this._fullResultIds.has(s.tool_use_id);
    // bash / powershell 成功输出默认收起，点击「展开输出」查看（再点收起）
    const shellCollapsed = isShellOutputCollapsed(s, showFull);
    // write_file 成功输出与 path/content 重复，整块不渲染（含「（无输出）」占位）
    const hideOutput = isRedundantOutput(s);
    // edit_file 有 diff 块时替代通用参数区（path 进 diff 头，old/new 进 diff 行）
    const editDiff = this._renderEditDiff(s);
    const { visible, totalLines } = argPreview(s.output ?? "");
    const truncated = !showFull && !summary && totalLines > 5;
    const hasOutput = s.output != null && s.output !== "";
    return html`
      <div class="step ${running ? "running" : ""} ${error ? "error" : ""}">
        <div class="head">
          ${running ? html`<span class="spin"></span>` : html`<doclens-icon name=${icon}></doclens-icon>`}
          <span class="name" title=${s.name}>${mcpName ?? s.name}</span>
          ${running ? html`<span class="running-text">${mcpName ? `正在调用 ${mcpName.split(" / ")[0]}` : (TOOL_ACTION[s.name] ?? "正在调用")}...</span>` : null}
          <span class="meta">
            ${!running ? (error ? html`<doclens-icon class="err" name="x"></doclens-icon>` : html`<doclens-icon class="ok" name="check"></doclens-icon>`) : null}
            ${s.duration_ms != null ? html` ${Math.round(s.duration_ms)}ms` : null}
          </span>
        </div>
        ${editDiff
          ?? (Object.keys(s.input).length ? html`<div class="arg">${this._renderArgs(s)}</div>` : null)}
        ${hasOutput
          ? (hideOutput
              ? nothing
              : shellCollapsed
                ? html`<div class="res"><span class="more" @click=${() => this._toggleResult(s.tool_use_id)}>展开输出 (${totalLines} 行) ⌄</span></div>`
                : summary
                  ? html`<div class="res">${summary}</div>`
                  : html`<div class="res">${visible}${truncated
                      ? html`<span class="more" @click=${() => this._toggleResult(s.tool_use_id)}>展开全部 (${totalLines} 行) ⌄</span>`
                      : null}</div>`)
          : (running ? null : html`<div class="arg">（无输出）</div>`)}
      </div>
    `;
  }

  render() {
    if (!this.steps.length) return null;
    const running = this.steps.some((s) => s.status === "running");
    return html`
      <div class="summary" @click=${this._toggle}>
        <doclens-icon class="arrow" name=${this._expanded ? "chevron-down" : "chevron-right"}></doclens-icon>
        <doclens-icon name="sparkles"></doclens-icon> 思考过程 · <span class="count">${this.steps.length} 步</span>
        ${running ? " · 进行中" : ""}
        <button class="copy-btn ${this._copied ? "copied" : ""}" @click=${this._onCopy} title=${this._copied ? "已复制" : "复制全文"}>${this._copied ? html`<doclens-icon name="check"></doclens-icon> 已复制` : html`<doclens-icon name="copy"></doclens-icon>`}</button>
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
