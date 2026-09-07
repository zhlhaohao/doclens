import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";

import {
  createMcpServer,
  deleteMcpServer,
  listMcpServerTools,
  listMcpServers,
  reconnectMcpServer,
  setMcpServerEnabled,
  updateMcpServer,
  McpApiError,
  type McpServer,
  type McpToolInfo,
  type McpTransport,
} from "../api/mcp";

interface FormState {
  name: string;
  transport: McpTransport;
  command: string;
  args: string;
  envText: string;
  cwd: string;
  url: string;
  headersText: string;
  timeout: string;
  notes: string;
}

interface EditingState {
  mode: "new" | "edit";
  serverId?: string;
  form: FormState;
}

const TRANSPORT_OPTIONS: { value: McpTransport; label: string }[] = [
  { value: "stdio", label: "stdio（本地进程）" },
  { value: "http", label: "Streamable HTTP" },
  { value: "sse", label: "HTTP+SSE（旧版）" },
];

const TRANSPORT_LABEL: Record<McpTransport, string> = {
  stdio: "stdio",
  http: "HTTP",
  sse: "SSE",
};

const STATUS_LABEL: Record<string, string> = {
  disabled: "已停用",
  connecting: "连接中",
  ok: "已连接",
  failed: "失败",
};

function emptyForm(): FormState {
  return {
    name: "",
    transport: "stdio",
    command: "",
    args: "",
    envText: "",
    cwd: "",
    url: "",
    headersText: "",
    timeout: "30",
    notes: "",
  };
}

/** env/headers 编辑器用 KEY=VALUE 行文本；空值行忽略。 */
function parseLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1);
  }
  return out;
}

function formatLines(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

/**
 * MCP 服务器管理区块（ADR-0014）。挂在设置页 MCP tab。
 *
 * 列表 = 名称 + transport 徽章 + 启用开关 + 状态灯（connecting/ok/failed +
 * 工具数，轮询刷新）+ 编辑/删除；改动即保存（PUT 单条，不进 .env 保存按钮）。
 * 连接由后端异步 reconcile 建立，状态 5s 轮询同步。
 */
@customElement("mcp-servers-section")
export class McpServersSection extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-family: var(--cortex-font);
      color: var(--cortex-text);
    }
    .wrap {
      margin-bottom: var(--cortex-space-6);
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--cortex-space-3);
      margin-bottom: var(--cortex-space-2);
    }
    .head h2 {
      margin: 0;
      font-size: var(--cortex-fs-lg);
      font-weight: 700;
      letter-spacing: -0.015em;
    }
    .head .hint {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .server-list {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2);
      margin-top: var(--cortex-space-3);
    }
    .server-row {
      display: flex;
      align-items: center;
      gap: var(--cortex-space-3);
      padding: var(--cortex-space-3);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
    }
    .server-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      cursor: pointer;
    }
    .server-name {
      font-size: var(--cortex-fs-sm);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: var(--cortex-space-2);
    }
    .badge {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text-muted);
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-pill);
      padding: 1px var(--cortex-space-2);
    }
    .server-meta {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--cortex-fs-xs);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--cortex-text-subtle);
    }
    .dot.ok { background: var(--cortex-primary); }
    .dot.connecting { background: #d97706; animation: pulse 1.2s infinite; }
    .dot.failed { background: var(--cortex-danger); }
    @keyframes pulse { 50% { opacity: 0.4; } }
    .status .err-text {
      color: var(--cortex-danger);
      max-width: 220px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row-actions {
      display: flex;
      gap: var(--cortex-space-1);
      flex-shrink: 0;
    }
    .icon-btn {
      padding: 4px 10px;
      border: 1px solid var(--cortex-border);
      background: var(--cortex-surface);
      color: var(--cortex-text);
      border-radius: var(--cortex-radius-pill);
      font-size: var(--cortex-fs-xs);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s, border-color 0.15s;
    }
    .icon-btn:hover {
      background: var(--cortex-surface-muted);
      border-color: var(--cortex-text-muted);
    }
    .icon-btn.primary {
      background: var(--cortex-btn-primary-bg);
      border-color: var(--cortex-btn-primary-bg);
      color: var(--cortex-btn-primary-text);
      font-weight: 600;
    }
    .icon-btn.primary:hover { filter: brightness(1.05); }
    .icon-btn.danger:hover {
      background: var(--cortex-danger);
      border-color: var(--cortex-danger);
      color: #fff;
    }
    .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    /* 启用开关（复用 .switch 视觉语言的最小实现） */
    .toggle {
      position: relative;
      width: 34px;
      height: 20px;
      flex-shrink: 0;
      cursor: pointer;
    }
    .toggle input {
      position: absolute;
      inset: 0;
      opacity: 0;
      margin: 0;
      cursor: pointer;
    }
    .toggle .track {
      position: absolute;
      inset: 0;
      border-radius: 999px;
      background: var(--cortex-surface-muted);
      border: 1px solid var(--cortex-border);
      transition: background 0.15s;
      pointer-events: none;
    }
    .toggle .thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--cortex-surface);
      border: 1px solid var(--cortex-border);
      transition: left 0.15s;
      pointer-events: none;
    }
    .toggle input:checked ~ .track { background: var(--cortex-primary); border-color: var(--cortex-primary); }
    .toggle input:checked ~ .thumb { left: 16px; }
    .empty {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      padding: var(--cortex-space-2) 0;
    }
    /* 工具清单展开区 */
    .tools-panel {
      margin-top: var(--cortex-space-2);
      padding: var(--cortex-space-3);
      border: 1px dashed var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      font-size: var(--cortex-fs-xs);
    }
    .tools-panel .tool-row {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 4px 0;
    }
    .tools-panel .tool-name {
      font-family: var(--cortex-font-mono);
      font-weight: 600;
      color: var(--cortex-text);
      word-break: break-all;
    }
    .tools-panel .tool-desc {
      color: var(--cortex-text-muted);
    }
    /* 内联编辑表单 */
    .form {
      margin-top: var(--cortex-space-3);
      padding: var(--cortex-space-4);
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-surface);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--cortex-space-3);
    }
    .form .full { grid-column: 1 / -1; }
    .field-label {
      font-size: var(--cortex-fs-xs);
      font-weight: 600;
      color: var(--cortex-text-muted);
      margin-bottom: 2px;
    }
    .input, .select, .textarea {
      padding: 8px 10px;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-md);
      background: var(--cortex-bg);
      font-size: var(--cortex-fs-sm);
      font-family: inherit;
      color: var(--cortex-text);
      width: 100%;
      box-sizing: border-box;
    }
    .textarea {
      min-height: 64px;
      resize: vertical;
      font-family: var(--cortex-font-mono);
    }
    .input.mono { font-family: var(--cortex-font-mono); }
    .input:focus, .select:focus, .textarea:focus {
      outline: none;
      border-color: var(--cortex-primary);
      box-shadow: var(--cortex-focus-ring);
    }
    .form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: var(--cortex-space-2);
    }
    .form-error {
      grid-column: 1 / -1;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-danger);
    }
    .msg {
      font-size: var(--cortex-fs-xs);
      padding: var(--cortex-space-2) var(--cortex-space-3);
      border-radius: var(--cortex-radius-md);
      margin-top: var(--cortex-space-3);
    }
    .msg.ok { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
    .msg.err { background: var(--cortex-danger-soft, rgba(220,38,38,0.1)); color: var(--cortex-danger); }
    .risk-note {
      margin-top: var(--cortex-space-3);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
      line-height: 1.6;
    }
    @media (max-width: 1023px) {
      .form { grid-template-columns: 1fr; }
      .status .err-text { max-width: 120px; }
    }
  `;

  @state() private _servers: McpServer[] = [];
  @state() private _loading = true;
  @state() private _editing: EditingState | null = null;
  @state() private _busy = false;
  @state() private _error: string | null = null;
  @state() private _toast: string | null = null;
  @state() private _confirmDeleteId: string | null = null;
  @state() private _formError: string | null = null;
  @state() private _expandedToolsId: string | null = null;
  @state() private _toolsCache: Record<string, McpToolInfo[]> = {};

  private _toastTimer?: number;
  private _pollTimer?: number;

  connectedCallback() {
    super.connectedCallback();
    this._load();
    // 状态轮询（connecting → ok/failed 演进 + 工具数刷新；轻量 GET）
    this._pollTimer = window.setInterval(() => this._pollStatus(), 5000);
  }

  disconnectedCallback() {
    if (this._toastTimer !== undefined) window.clearTimeout(this._toastTimer);
    if (this._pollTimer !== undefined) window.clearInterval(this._pollTimer);
    super.disconnectedCallback();
  }

  private async _load() {
    this._error = null;
    try {
      this._servers = await listMcpServers();
    } catch (e) {
      this._error = `加载 MCP 服务器失败: ${(e as Error).message}`;
    } finally {
      this._loading = false;
    }
  }

  /** 轮询：静默刷新列表（含 runtime 状态），失败不打扰。 */
  private async _pollStatus() {
    try {
      this._servers = await listMcpServers();
    } catch {
      /* 静默：轮询失败等下轮 */
    }
  }

  private _setFlash(msg: string) {
    this._toast = msg;
    if (this._toastTimer !== undefined) window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => { this._toast = null; }, 3000);
  }

  private _errMsg(e: unknown): string {
    if (e instanceof McpApiError) {
      const body = e.body as { detail?: string } | null;
      return body?.detail ?? `HTTP ${e.status}`;
    }
    return (e as Error).message;
  }

  private _openNew() {
    this._formError = null;
    this._editing = { mode: "new", form: emptyForm() };
  }

  private _openEdit(s: McpServer) {
    this._formError = null;
    this._editing = {
      mode: "edit",
      serverId: s.id,
      form: {
        name: s.name,
        transport: s.transport,
        command: s.command,
        args: s.args.join(" "),
        // 脱敏值（***）原样带出：用户不动即回传 *** = 保留
        envText: formatLines(s.env),
        cwd: s.cwd,
        url: s.url,
        headersText: formatLines(s.headers),
        timeout: String(s.timeout),
        notes: s.notes,
      },
    };
  }

  private _cancelEdit() {
    this._editing = null;
    this._formError = null;
  }

  private _setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (!this._editing) return;
    this._editing = { ...this._editing, form: { ...this._editing.form, [key]: value } };
  }

  private async _submit() {
    const ed = this._editing;
    if (!ed) return;
    const f = ed.form;
    if (!f.name.trim()) {
      this._formError = "请填写服务器名称";
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(f.name.trim())) {
      this._formError = "名称仅限字母、数字、连字符、下划线（用于工具前缀）";
      return;
    }
    if (f.transport === "stdio" && !f.command.trim()) {
      this._formError = "stdio 服务器必须填写启动命令";
      return;
    }
    if (f.transport !== "stdio" && !f.url.trim()) {
      this._formError = "HTTP/SSE 服务器必须填写 URL";
      return;
    }
    const timeoutNum = Number(f.timeout) || 30;
    this._busy = true;
    this._formError = null;
    try {
      if (ed.mode === "new") {
        await createMcpServer({
          name: f.name.trim(),
          transport: f.transport,
          command: f.command.trim(),
          args: f.args.trim() ? f.args.trim().split(/\s+/) : [],
          env: parseLines(f.envText),
          cwd: f.cwd.trim(),
          url: f.url.trim(),
          headers: parseLines(f.headersText),
          timeout: timeoutNum,
          notes: f.notes,
        });
        this._setFlash(`已添加「${f.name.trim()}」，正在后台连接…`);
      } else if (ed.serverId) {
        await updateMcpServer(ed.serverId, {
          name: f.name.trim(),
          transport: f.transport,
          command: f.command.trim(),
          args: f.args.trim() ? f.args.trim().split(/\s+/) : [],
          env: parseLines(f.envText),
          cwd: f.cwd.trim(),
          url: f.url.trim(),
          headers: parseLines(f.headersText),
          timeout: timeoutNum,
          notes: f.notes,
        });
        this._setFlash(`已更新「${f.name.trim()}」，变更将异步生效`);
      }
      this._editing = null;
      await this._load();
    } catch (e) {
      this._formError = this._errMsg(e);
    } finally {
      this._busy = false;
    }
  }

  private async _toggleEnabled(s: McpServer, enabled: boolean) {
    this._busy = true;
    this._error = null;
    try {
      await setMcpServerEnabled(s.id, enabled);
      this._setFlash(enabled ? `已启用「${s.name}」` : `已停用「${s.name}」`);
      await this._load();
    } catch (e) {
      this._error = this._errMsg(e);
    } finally {
      this._busy = false;
    }
  }

  private async _delete(s: McpServer) {
    if (this._confirmDeleteId !== s.id) {
      this._confirmDeleteId = s.id;
      return;
    }
    this._busy = true;
    this._error = null;
    try {
      await deleteMcpServer(s.id);
      this._confirmDeleteId = null;
      if (this._expandedToolsId === s.id) this._expandedToolsId = null;
      this._setFlash(`已删除「${s.name}」`);
      await this._load();
    } catch (e) {
      this._error = `删除失败: ${this._errMsg(e)}`;
    } finally {
      this._busy = false;
    }
  }

  private async _reconnect(s: McpServer) {
    this._busy = true;
    try {
      await reconnectMcpServer(s.id);
      this._setFlash(`正在重连「${s.name}」…`);
      await this._load();
    } catch (e) {
      this._error = this._errMsg(e);
    } finally {
      this._busy = false;
    }
  }

  /** 展开/收起工具清单（点击行主体切换）。 */
  private async _toggleTools(s: McpServer) {
    if (this._expandedToolsId === s.id) {
      this._expandedToolsId = null;
      return;
    }
    this._expandedToolsId = s.id;
    if (!(s.id in this._toolsCache)) {
      try {
        const r = await listMcpServerTools(s.id);
        this._toolsCache = { ...this._toolsCache, [s.id]: r.tools };
      } catch {
        this._toolsCache = { ...this._toolsCache, [s.id]: [] };
      }
    }
  }

  private _renderToolsPanel(s: McpServer) {
    if (this._expandedToolsId !== s.id) return nothing;
    const tools = this._toolsCache[s.id];
    return html`
      <div class="tools-panel">
        ${tools === undefined
          ? html`<div>加载工具清单中…</div>`
          : tools.length === 0
            ? html`<div>暂无已注册工具（${STATUS_LABEL[s.runtime.status] ?? s.runtime.status}）</div>`
            : tools.map((t) => html`
                <div class="tool-row">
                  <span class="tool-name">${t.registered_name}</span>
                  ${t.description ? html`<span class="tool-desc">${t.description}</span>` : nothing}
                </div>
              `)}
      </div>
    `;
  }

  private _renderRow(s: McpServer) {
    const confirming = this._confirmDeleteId === s.id;
    const st = s.runtime;
    return html`
      <div class="server-row">
        <label class="toggle" title=${s.enabled ? "停用" : "启用"}>
          <input
            type="checkbox"
            .checked=${s.enabled}
            ?disabled=${this._busy}
            @change=${(e: Event) => this._toggleEnabled(s, (e.target as HTMLInputElement).checked)}
          />
          <span class="track"></span>
          <span class="thumb"></span>
        </label>
        <div class="server-main" @click=${() => this._toggleTools(s)} title="点击展开工具清单">
          <div class="server-name">
            ${s.name}
            <span class="badge">${TRANSPORT_LABEL[s.transport]}</span>
          </div>
          <div class="server-meta">
            ${s.transport === "stdio"
              ? `${s.command} ${s.args.join(" ")}`
              : s.url}
          </div>
          <div class="status">
            <span class="dot ${st.status}"></span>
            ${STATUS_LABEL[st.status] ?? st.status}
            ${st.status === "ok" ? html` · ${st.tool_count} 个工具` : nothing}
            ${st.status === "failed" && st.error
              ? html`<span class="err-text" title=${st.error}>${st.error}</span>`
              : nothing}
          </div>
        </div>
        <div class="row-actions">
          ${st.status === "failed" || st.status === "ok"
            ? html`<button class="icon-btn" ?disabled=${this._busy} @click=${() => this._reconnect(s)}>重连</button>`
            : nothing}
          <button class="icon-btn" ?disabled=${this._busy} @click=${() => this._openEdit(s)}>编辑</button>
          <button class="icon-btn danger" ?disabled=${this._busy} @click=${() => this._delete(s)}>
            ${confirming ? "确认删除" : "删除"}
          </button>
        </div>
      </div>
      ${this._renderToolsPanel(s)}
    `;
  }

  private _renderForm() {
    const ed = this._editing;
    if (!ed) return nothing;
    const f = ed.form;
    const isStdio = f.transport === "stdio";
    return html`
      <div class="form">
        <div>
          <div class="field-label">名称（= 工具前缀 mcp__&lt;名称&gt;__*）</div>
          <input class="input mono" autocomplete="off" placeholder="context7"
            .value=${f.name} @input=${(e: Event) => this._setField("name", (e.target as HTMLInputElement).value)} />
        </div>
        <div>
          <div class="field-label">传输</div>
          <select class="select" .value=${f.transport}
            @change=${(e: Event) => this._setField("transport", (e.target as HTMLSelectElement).value as McpTransport)}>
            ${TRANSPORT_OPTIONS.map((o) => html`<option value=${o.value} ?selected=${o.value === f.transport}>${o.label}</option>`)}
          </select>
        </div>
        ${isStdio ? html`
          <div>
            <div class="field-label">启动命令</div>
            <input class="input mono" autocomplete="off" placeholder="npx"
              .value=${f.command} @input=${(e: Event) => this._setField("command", (e.target as HTMLInputElement).value)} />
          </div>
          <div>
            <div class="field-label">参数（空格分隔）</div>
            <input class="input mono" autocomplete="off" placeholder="-y @context7/mcp"
              .value=${f.args} @input=${(e: Event) => this._setField("args", (e.target as HTMLInputElement).value)} />
          </div>
          <div class="full">
            <div class="field-label">环境变量（每行 KEY=VALUE）</div>
            <textarea class="textarea" .value=${f.envText}
              @input=${(e: Event) => this._setField("envText", (e.target as HTMLTextAreaElement).value)}></textarea>
          </div>
          <div>
            <div class="field-label">工作目录（可选）</div>
            <input class="input mono" autocomplete="off"
              .value=${f.cwd} @input=${(e: Event) => this._setField("cwd", (e.target as HTMLInputElement).value)} />
          </div>
        ` : html`
          <div class="full">
            <div class="field-label">URL</div>
            <input class="input mono" autocomplete="off" placeholder="http://127.0.0.1:8080/mcp"
              .value=${f.url} @input=${(e: Event) => this._setField("url", (e.target as HTMLInputElement).value)} />
          </div>
          <div class="full">
            <div class="field-label">请求头（每行 KEY: VALUE → 转为 KEY=VALUE 输入）</div>
            <textarea class="textarea" placeholder="Authorization=Bearer xxx"
              .value=${f.headersText} @input=${(e: Event) => this._setField("headersText", (e.target as HTMLTextAreaElement).value)}></textarea>
          </div>
        `}
        <div>
          <div class="field-label">工具调用超时（秒）</div>
          <input class="input" type="number" min="1" max="600" .value=${f.timeout}
            @input=${(e: Event) => this._setField("timeout", (e.target as HTMLInputElement).value)} />
        </div>
        <div>
          <div class="field-label">备注</div>
          <input class="input" .value=${f.notes}
            @input=${(e: Event) => this._setField("notes", (e.target as HTMLInputElement).value)} />
        </div>
        ${this._formError ? html`<div class="form-error">${this._formError}</div>` : nothing}
        <div class="form-actions">
          <button class="icon-btn" ?disabled=${this._busy} @click=${() => this._cancelEdit()}>取消</button>
          <button class="icon-btn primary" ?disabled=${this._busy} @click=${() => this._submit()}>
            ${this._busy ? "保存中…" : ed.mode === "new" ? "添加" : "保存"}
          </button>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="wrap">
        <div class="head">
          <h2>MCP 服务器</h2>
          <span class="hint">外部工具源 · 配置存本机 · 保存后异步生效</span>
        </div>
        <button class="icon-btn primary" @click=${() => this._openNew()}>+ 添加服务器</button>
        ${this._loading
          ? html`<div class="empty">加载中…</div>`
          : this._servers.length === 0
            ? html`<div class="empty">暂无服务器。添加一个 MCP 服务器，其工具将可被 AI 对话直接调用。</div>`
            : html`<div class="server-list">
                ${this._servers.map((s) => this._renderRow(s))}
              </div>`}
        ${this._editing ? this._renderForm() : nothing}
        ${this._error ? html`<div class="msg err">${this._error}</div>` : nothing}
        ${this._toast ? html`<div class="msg ok">${this._toast}</div>` : nothing}
        <div class="risk-note">
          启用的服务器所暴露的工具将可被 AI 直接调用（不经逐次确认），请仅添加信任的服务器。
          工具由其提供方定义，内容不经本应用审查。
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mcp-servers-section": McpServersSection;
  }
}
