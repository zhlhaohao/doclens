import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

import { store, actions } from "../state/store";
import type { ReindexState } from "../state/types";
import { streamSSE } from "../api/client";
import "./toast-stack";
import type { ToastStack } from "./toast-stack";

@customElement("reindex-dialog")
export class ReindexDialog extends LitElement {
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
    /* 仅在 dialog 打开时显示 scrim 并捕获点击（modal 行为） */
    :host(:has(dialog[open])) {
      background: rgba(0, 0, 0, 0.3);
      pointer-events: auto;
    }
    dialog {
      pointer-events: auto;
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-xl);
      padding: 0; background: var(--cortex-surface);
      box-shadow: var(--cortex-shadow-lg);
      min-width: 360px; max-width: 90vw;
    }
    dialog::backdrop { background: rgba(0,0,0,0.3); }
    dialog > * { display: block; padding: var(--cortex-space-6); }
    /* toast-stack 在 closed 态下仍需可点击 */
    :host > toast-stack { pointer-events: auto; }
    h3 { margin: 0 0 var(--cortex-space-3) 0; font-size: var(--cortex-fs-md); font-weight: 600; letter-spacing: -0.01em; color: var(--cortex-text); }
    .body { font-size: var(--cortex-fs-sm); color: var(--cortex-text); line-height: 1.6; }
    .progress {
      font-family: var(--cortex-font-mono); font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted); margin-top: var(--cortex-space-2);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .actions {
      display: flex; justify-content: flex-end;
      gap: var(--cortex-space-2); margin-top: var(--cortex-space-4);
    }
    button {
      padding: 6px 16px; border: 1px solid var(--cortex-border);
      background: var(--cortex-surface); cursor: pointer;
      border-radius: var(--cortex-radius-pill); font-size: var(--cortex-fs-base);
    }
    button.primary { background: var(--cortex-btn-primary-bg); color: var(--cortex-btn-primary-text); border: none; border-radius: var(--cortex-radius-pill); }
    button.primary:hover:not(:disabled) { opacity: 0.9; }
    button.warn { background: var(--cortex-danger); color: #fff; border: none; border-radius: var(--cortex-radius-lg); }
    @media (max-width: 1023px) {
      dialog {
        min-width: 0; width: calc(100vw - 16px); max-width: calc(100vw - 16px);
        max-height: calc(100vh - 16px);
      }
      .actions { flex-direction: column-reverse; gap: var(--cortex-space-3); }
      .actions button { width: 100%; padding: 12px 16px; min-height: 44px; }
    }
  `;

  private _abort: AbortController | null = null;
  private _unsub?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this._unsub = store.subscribe(() => this.requestUpdate());
  }

  disconnectedCallback() {
    this._abort?.abort();
    this._unsub?.();
    super.disconnectedCallback();
  }

  private _pushToast(message: string, level: "success" | "error" | "info" = "info", duration = 2500) {
    const stack = this.shadowRoot?.querySelector("toast-stack") as ToastStack | null;
    stack?.pushToast(message, level, duration);
  }

  private _confirm() {
    actions.startReindex();
    void this._runReindex();
  }

  private _close() {
    this._abort?.abort();
    actions.closeReindex();
  }

  private async _runReindex(): Promise<void> {
    this._abort = new AbortController();
    try {
      for await (const ev of streamSSE("/api/reindex", {}, this._abort.signal)) {
        if (this._abort.signal.aborted) break;
        if (ev.event === "progress") {
          const d = JSON.parse(ev.data);
          actions.setReindexProgress({ current_file: d.current_file, indexed_count: d.indexed_count, sub_label: d.sub_label });
        } else if (ev.event === "done") {
          const d = JSON.parse(ev.data);
          if (d.success) {
            actions.finishReindex({ success: d.success, doc_count: d.doc_count, failed_count: d.failed_count });
            this._pushToast(
              d.failed_count > 0
                ? `索引重建完成：${d.doc_count} 文档，${d.failed_count} 个文件失败`
                : `索引重建完成：${d.doc_count} 文档`,
              d.failed_count > 0 ? "error" : "success", 3000,
            );
          } else {
            actions.failReindex(d.failed_count > 0 ? `重建失败：${d.failed_count} 个文件失败` : "重建失败");
          }
          break;
        } else if (ev.event === "error") {
          const d = JSON.parse(ev.data);
          actions.failReindex(d.detail || "重建失败");
          break;
        }
      }
    } catch (e) {
      if (!this._abort?.signal.aborted) {
        actions.failReindex((e as Error).message || "重建失败");
      }
    }
  }

  private _renderBody(r: ReindexState) {
    if (r.dialog === "confirm") {
      return html`
        <h3><doclens-icon name="refresh-ccw"></doclens-icon> 强制重建索引</h3>
        <div class="body"><doclens-icon name="alert-triangle"></doclens-icon> 将清空当前索引并全量重扫工作目录，期间（数十秒）搜索结果可能不完整。是否继续？</div>
        <div class="actions">
          <button @click=${() => actions.closeReindex()}>取消</button>
          <button class="warn" @click=${this._confirm}>确认重建</button>
        </div>
      `;
    }
    if (r.dialog === "running") {
      return html`
        <h3><doclens-icon name="refresh-cw"></doclens-icon> 正在重建索引…</h3>
        <div class="body">已索引 <strong>${r.indexed_count}</strong> 个文件</div>
        ${r.current_file ? html`<div class="progress">当前：${r.current_file}${r.sub_label ? ` · ${r.sub_label}` : ""}</div>` : ""}
        <div class="actions">
          <button @click=${this._close}>关闭（后台继续）</button>
        </div>
      `;
    }
    if (r.dialog === "done") {
      const res = r.result;
      return html`
        <h3 style="${res && res.failed_count > 0 ? "color: var(--cortex-danger)" : ""}">
          <doclens-icon name="${res && res.failed_count > 0 ? "alert-triangle" : "check"}"></doclens-icon>
          ${res && res.failed_count > 0 ? "重建完成（部分失败）" : "重建完成"}
        </h3>
        <div class="body">
          共索引 <strong>${res?.doc_count ?? 0}</strong> 个文档
          ${res && res.failed_count > 0
            ? html`<br /><span style="color: var(--cortex-danger); font-weight: 600;">· ${res.failed_count} 个文件失败</span>`
            : ""}
        </div>
        <div class="actions">
          <button class="primary" @click=${this._close}>关闭</button>
        </div>
      `;
    }
    return html`
      <h3><doclens-icon name="alert-triangle"></doclens-icon> 重建失败</h3>
      <div class="body">${r.error || "未知错误"}</div>
      <div class="actions">
        <button class="primary" @click=${this._close}>关闭</button>
      </div>
    `;
  }

  render() {
    const r = store.getState().reindex;
    if (r.dialog === "closed") return html`<toast-stack></toast-stack>`;
    return html`
      <dialog open>${this._renderBody(r)}</dialog>
      <toast-stack></toast-stack>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "reindex-dialog": ReindexDialog; }
}
