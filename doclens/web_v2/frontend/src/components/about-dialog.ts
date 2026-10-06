import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

/** 运行情况快照（/api/health.runtime，ADR-0037；rss_mb psutil 缺席为 null） */
interface RuntimeVitals {
  uptime_sec: number;
  rss_mb: number | null;
  threads: number;
  objects: number;
  errors: number;
  gc_collections: number;
}

/** 「关于」对话框：发行版只显示 doclens 版本号；开发模式（后端
 * /api/health 返回 dev=true，源码树运行）附加调试信息：
 * - doclens 版本：health.version（发行版 = pip 安装的包版本号；
 *   开发版 = 源码树 pyproject）
 * - 前端构建：vite define 注入的 __BUILD_INFO__（git hash · 构建时间）
 * - 当前 bundle：performance 资源里 index.[hash].js 的文件名——与磁盘
 *   static/assets/ 对比即可发现 SW 缓存旧版本（SW 旧缓存多次挡住验证）
 * - 后端代码状态：代码 mtime vs 进程启动时间（改了代码没重启检测）
 * Esc / 点遮罩 / 关闭按钮 → 派发 close。 */
@customElement("about-dialog")
export class AboutDialog extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      pointer-events: none;
    }
    /* 仅在 open 时显示遮罩并捕获点击（modal 行为） */
    :host([open]) {
      background: rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    .scrim {
      position: absolute;
      inset: 0;
    }
    dialog {
      position: relative;
      pointer-events: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      padding: 0;
      background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 380px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--cortex-space-4);
      padding: var(--cortex-space-4) var(--cortex-space-6);
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .head h3 {
      margin: 0;
      font-size: var(--cortex-fs-md);
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--cortex-text);
    }
    .close-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: var(--cortex-fs-lg);
      line-height: 1;
      color: var(--cortex-text-muted);
      padding: 4px 8px;
      border-radius: var(--cortex-radius-sm);
    }
    .close-btn:hover {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text);
    }
    .body {
      padding: var(--cortex-space-4) var(--cortex-space-6) var(--cortex-space-6);
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-3);
    }
    .row {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .row .label {
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .row .value {
      color: var(--cortex-text);
      word-break: break-all;
    }
    .row .value.ok {
      color: var(--cortex-success, #16a34a);
    }
    .row .value.err {
      color: var(--cortex-danger);
    }
    .row .value.sub {
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    /* SW 缓存旧 bundle 是高频坑：当前 bundle 行做视觉强调 */
    .row.stale-hint .value {
      font-weight: 600;
    }
    /* 运行情况分区（ADR-0037）：2×3 紧凑网格，等宽数字 */
    .vitals {
      display: flex;
      flex-direction: column;
      gap: var(--cortex-space-2, 6px);
    }
    .vitals-label {
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
    }
    .vitals-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--cortex-space-2, 6px) var(--cortex-space-4, 12px);
    }
    .vital {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--cortex-space-2, 6px);
      min-width: 0;
    }
    .vital-k {
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      white-space: nowrap;
    }
    .vital-v {
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      font-variant-numeric: tabular-nums;
    }
    .vital-v.err {
      color: var(--cortex-danger);
    }
    .err {
      color: var(--cortex-danger);
    }
    @media (max-width: 1023px) {
      dialog {
        min-width: 0;
        width: calc(100vw - 16px);
        max-width: calc(100vw - 16px);
      }
    }
  `;

  @property({ type: Boolean, reflect: true })
  open = false;

  @state() private _health: {
    version: string;
    dev: boolean;
    started_at?: string;
    code_mtime?: string;
    runtime?: RuntimeVitals;
  } | null = null;
  @state() private _healthError = false;
  /** 运行情况轮询 timer（弹窗 open 期间 5s 一刷，ADR-0037） */
  private _pollTimer: number | null = null;

  /** 后端 runtime 快照（/api/health.runtime；rss_mb psutil 缺席时为 null） */
  private _runtime(): RuntimeVitals | null {
    return this._health?.runtime ?? null;
  }

  /** 启动晚于代码最后修改 → 已加载最新；反之改了代码没重启（editable
   *  install 改源码立即生效的前提是重启进程）。「?」（扫描失败）视为未知。 */
  private get _codeState(): "fresh" | "stale" | "unknown" {
    const h = this._health;
    if (!h || !h.started_at || !h.code_mtime) return "unknown";
    if (h.started_at === "?" || h.code_mtime === "?") return "unknown";
    return h.code_mtime <= h.started_at ? "fresh" : "stale";
  }

  /** ISO 时间（UTC）→ 北京时区 `YYYY-MM-DD HH:mm:ss`。后端 API 保持
   *  UTC 标准输出，展示层统一转北京时间。 */
  private _fmtBeijing(iso?: string): string {
    if (!iso) return "?";
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return iso;
    const p = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(t);
    const get = (k: string) => p.find((x) => x.type === k)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("keydown", this._onKeydown);
  }

  disconnectedCallback(): void {
    this._stopPolling();
    document.removeEventListener("keydown", this._onKeydown);
    super.disconnectedCallback();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has("open")) {
      if (this.open) {
        this._loadHealth();
        // 运行情况 5s 轮询（ADR-0037）：打开期间持续刷新，关闭即清
        this._pollTimer = window.setInterval(
          () => void this._loadHealth(),
          5000,
        );
      } else {
        this._stopPolling();
      }
    }
  }

  private _stopPolling(): void {
    if (this._pollTimer !== null) {
      window.clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  private _onKeydown = (e: KeyboardEvent): void => {
    if (this.open && e.key === "Escape") {
      e.preventDefault();
      this._close();
    }
  };

  private _close(): void {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true, composed: true }));
  }

  /** 当前页面实际加载的入口 bundle 文件名（performance 资源表提取）。 */
  private _currentBundle(): string {
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const hit = entries
      .map((e) => e.name.split("/").pop() ?? "")
      .filter((n) => /^index\.[A-Za-z0-9_-]+\.js$/.test(n));
    return hit[0] ?? "未知";
  }

  private async _loadHealth(): Promise<void> {
    this._health = null;
    this._healthError = false;
    try {
      // no-store：health 无 Cache-Control 头时浏览器会对 GET 启发式缓存，
      // 导致「改代码未重启」的状态滞后一拍（实测踩坑）
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as {
        version?: string;
        dev?: boolean;
        started_at?: string;
        code_mtime?: string;
        runtime?: RuntimeVitals;
      };
      this._health = {
        version: data.version ?? "?",
        dev: data.dev ?? false,
        started_at: data.started_at,
        code_mtime: data.code_mtime,
        runtime: data.runtime,
      };
      // WebView 远程调试辅助（仅开发模式）
      if (this._health.dev) {
        console.info(
          `[about] 前端构建 ${__BUILD_INFO__} | bundle ${this._currentBundle()}`,
        );
      }
    } catch {
      this._healthError = true;
    }
  }

  /** 秒数 → `X天 HH:MM:SS` / `HH:MM:SS` 运行时长。 */
  private _fmtUptime(sec: number): string {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return d > 0 ? `${d}天 ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  /** 对象/GC 大数千分位（1,234,567）。 */
  private _fmtNum(n: number): string {
    return n.toLocaleString("zh-CN");
  }

  render() {
    if (!this.open) return html``;
    const rt = this._runtime();
    return html`
      <div class="scrim" @click=${this._close}></div>
      <dialog>
        <div class="head">
          <h3>关于</h3>
          <button class="close-btn" aria-label="关闭" @click=${this._close}>✕</button>
        </div>
        <div class="body">
          <div class="row">
            <span class="label">doclens 版本</span>
            ${this._health
              ? html`<span class="value">${this._health.version}</span>`
              : this._healthError
                ? html`<span class="value err">后端不可达</span>`
                : html`<span class="value">获取中…</span>`}
          </div>
          <div class="vitals" title="进程运行情况（每 5 秒刷新；错误数 = 本次运行累计）">
            <span class="vitals-label">运行情况</span>
            <div class="vitals-grid">
              <div class="vital">
                <span class="vital-k">运行时长</span>
                <span class="vital-v">${rt ? this._fmtUptime(rt.uptime_sec) : "…"}</span>
              </div>
              <div class="vital">
                <span class="vital-k">内存</span>
                <span class="vital-v">${rt ? (rt.rss_mb !== null ? `${rt.rss_mb} MB` : "不可用") : "…"}</span>
              </div>
              <div class="vital">
                <span class="vital-k">线程</span>
                <span class="vital-v">${rt ? this._fmtNum(rt.threads) : "…"}</span>
              </div>
              <div class="vital">
                <span class="vital-k">对象</span>
                <span class="vital-v">${rt ? this._fmtNum(rt.objects) : "…"}</span>
              </div>
              <div class="vital">
                <span class="vital-k">错误</span>
                <span class="vital-v ${rt && rt.errors > 0 ? "err" : ""}">${rt ? this._fmtNum(rt.errors) : "…"}</span>
              </div>
              <div class="vital">
                <span class="vital-k">GC 回收</span>
                <span class="vital-v">${rt ? this._fmtNum(rt.gc_collections) : "…"}</span>
              </div>
            </div>
          </div>
          ${this._health?.dev
            ? html`
          <div class="row" title="git 提交 · 构建时刻（开发调试用）">
            <span class="label">前端构建</span>
            <span class="value">${__BUILD_INFO__}</span>
          </div>
          <div class="row stale-hint" title="与磁盘 static/assets/ 最新文件名对比，判断 SW 是否缓存了旧 bundle">
            <span class="label">当前 bundle</span>
            <span class="value">${this._currentBundle()}</span>
          </div>
          <div class="row" title="代码最后修改 vs 进程启动：改了代码没重启时警告">
            <span class="label">代码状态</span>
            ${this._codeState === "stale"
              ? html`<span class="value err">⚠ 代码修改晚于启动（有改动未重启）</span>`
              : this._codeState === "fresh"
                ? html`<span class="value ok">✓ 已加载最新</span>`
                : html`<span class="value">未知</span>`}
            <span class="value sub">代码 ${this._fmtBeijing(this._health.code_mtime)} · 启动 ${this._fmtBeijing(this._health.started_at)}</span>
          </div>`
            : null}
        </div>
      </dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "about-dialog": AboutDialog;
  }
}
