import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FileGroup, MatchItem, SearchHit } from "../state/types";

/**
 * <file-card> —— 文件分组结果卡（2026-10-18 决议）。
 *
 * 头部：文件名（大）+ 目录（小）+ 命中数徽标；点头部 = 展开/收起。
 * 组内一条命中一行（行号 + 单行文本 + 关键词 <mark> 高亮）；点行 = 预览定位。
 * kind="path"（grep 路径命中）：头部加「路径」徽标，无命中行。
 */
@customElement("file-card")
export class FileCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      /* .list-pane 是 flex 列容器：子项默认 flex-shrink:1，内容超高时卡片
         被等比压缩、overflow:hidden 裁掉命中行（展开只见 1 行半）。
         显式禁收缩，让 list-pane 的 overflow-y:auto 真正滚动。 */
      flex: 0 0 auto;
      /* 极简形态：无卡片盒（2026-10-18 用户反馈「界面太繁复」）——
         列表用分隔线分区，交互态只用文字色与轻背景 */
      border-bottom: 1px solid var(--cortex-border-muted);
    }
    .header {
      display: flex;
      align-items: baseline;
      gap: var(--cortex-space-2);
      padding: 7px 4px;
      cursor: pointer;
      user-select: none;
      transition: color 0.15s;
      touch-action: manipulation;
      min-width: 0;
    }
    .header:hover .name { color: var(--cortex-primary); }
    .chevron {
      color: var(--cortex-text-subtle);
      font-size: 10px;
      flex-shrink: 0;
      transition: transform 0.15s;
      align-self: center;
    }
    :host([expanded]) .chevron { transform: rotate(90deg); }
    .name {
      flex: 0 1 auto;
      min-width: 0;
      font-weight: 500;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: color 0.15s;
    }
    .badge {
      flex-shrink: 0;
      margin-left: auto;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-muted);
      font-family: var(--cortex-font-mono);
      white-space: nowrap;
    }
    .rows {
      display: flex;
      flex-direction: column;
      padding: 0 0 6px 22px;
    }
    .row {
      display: flex;
      align-items: baseline;
      gap: var(--cortex-space-2);
      padding: 3px 4px;
      cursor: pointer;
      transition: background 0.1s;
      touch-action: manipulation;
      border-radius: var(--cortex-radius-sm);
    }
    .row:hover { background: var(--cortex-surface-muted); }
    .row.active {
      background: var(--cortex-primary-soft);
    }
    .line-no {
      flex-shrink: 0;
      min-width: 2.5em;
      text-align: right;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
    }
    .row-text {
      flex: 1;
      min-width: 0;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text);
      line-height: 1.45;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    mark {
      background: color-mix(in srgb, var(--cortex-primary) 15%, transparent);
      color: var(--cortex-primary);
      padding: 0 2px;
      border-radius: 2px;
    }
    .cap-note {
      padding: 4px 12px 6px;
      font-size: var(--cortex-fs-xs);
      color: var(--cortex-text-subtle);
    }
    .path-note {
      padding: 6px 12px;
      font-size: var(--cortex-fs-sm);
      color: var(--cortex-text-muted);
    }
  `;

  @property({ attribute: false }) group: FileGroup | null = null;
  /** 当前激活命中（引用比较，来自 detailStack 顶部） */
  @property({ attribute: false }) activeHit: SearchHit | null = null;
  @property({ type: Boolean, reflect: true }) expanded = false;

  private _toggle(e: Event) {
    e.stopPropagation();
    this.expanded = !this.expanded;
  }

  private _rowClick(m: MatchItem) {
    if (!this.group) return;
    // 从 spans 还原字面命中文本作预览高亮词（正则词项本身不可字面搜）；
    // 无 spans（LIKE 兜底行/path 组）不带 hl，预览回退 queryWords 高亮
    let hl: string | undefined;
    if (m.spans?.length) {
      hl = m.spans.map(([s, e]) => m.text.slice(s, e)).join(" ");
    }
    this.dispatchEvent(new CustomEvent("hit-select", {
      detail: { hit: { path: this.group.path, line: m.line, hl } },
      bubbles: true, composed: true,
    }));
  }

  private _renderText(m: MatchItem) {
    // spans 由后端给字符区间，与 text 截断坐标系一致；Lit 文本绑定天然安全
    if (!m.spans?.length) return m.text;
    const parts: Array<string | { mark: string }> = [];
    let pos = 0;
    for (const [s, e] of m.spans) {
      if (s > pos) parts.push(m.text.slice(pos, s));
      parts.push({ mark: m.text.slice(s, e) });
      pos = e;
    }
    if (pos < m.text.length) parts.push(m.text.slice(pos));
    return parts.map((p) =>
      typeof p === "string" ? p : html`<mark>${p.mark}</mark>`,
    );
  }

  private _isActive(m: MatchItem): boolean {
    if (!this.group || !this.activeHit) return false;
    return this.activeHit.path === this.group.path && this.activeHit.line === m.line;
  }

  render() {
    const g = this.group;
    if (!g) return null;
    // 路径分隔符取最后出现的 / 或 \（Windows 绝对路径用反斜杠，POSIX 相对路径用斜杠）；
    // 完整路径进头部 tooltip，正文只显示文件名（极简，2026-10-18 用户反馈）
    const sep = Math.max(g.path.lastIndexOf("/"), g.path.lastIndexOf("\\"));
    const name = sep >= 0 ? g.path.slice(sep + 1) : g.path;

    const isPath = g.kind === "path";
    // 展开即全部命中行（2026-10-18 用户反馈：折叠二次点击看不到全部）；
    // 仅后端 50 行 cap 截断时注明（该部分本就不在响应里）
    const visible = g.matches;

    return html`
      <div
        class="header"
        role="button"
        tabindex="0"
        aria-expanded=${this.expanded ? "true" : "false"}
        title=${g.path}
        @click=${this._toggle}
        @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") this._toggle(e); }}>
        <span class="chevron">▶</span>
        <span class="name">${isPath ? "路径 " : ""}${name}</span>
        ${!isPath ? html`<span class="badge">${g.total_matches}</span>` : null}
      </div>
      ${this.expanded ? html`
        <div class="rows">
          ${isPath
            ? html`<div class="row" @click=${() => this._rowClick({ line: null, text: g.path, spans: [] })}>
                     <span class="line-no">—</span>
                     <span class="row-text">${g.path}</span>
                   </div>`
            : visible.map((m) => html`
                <div
                  class="row ${this._isActive(m) ? "active" : ""}"
                  @click=${() => this._rowClick(m)}>
                  <span class="line-no">${m.line ?? "—"}</span>
                  <span class="row-text">${this._renderText(m)}</span>
                </div>`)}
          ${!isPath && g.truncated
            ? html`<div class="cap-note" title="后端单文件命中下发上限">仅显示前 ${g.matches.length} 处（共 ${g.total_matches} 处命中）</div>`
            : null}
        </div>
      ` : null}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "file-card": FileCard;
  }
}
