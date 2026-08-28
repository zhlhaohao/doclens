import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

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
  } | null = null;
  @state() private _healthError = false;

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
    document.removeEventListener("keydown", this._onKeydown);
    super.disconnectedCallback();
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has("open") && this.open) {
      this._loadHealth();
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
      };
      this._health = {
        version: data.version ?? "?",
        dev: data.dev ?? false,
        started_at: data.started_at,
        code_mtime: data.code_mtime,
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

  render() {
    if (!this.open) return html``;
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
