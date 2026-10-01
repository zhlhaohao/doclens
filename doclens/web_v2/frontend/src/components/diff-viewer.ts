/**
 * <diff-viewer> —— Unified Diff 渲染（未提交改动视图，CONTEXT.md 2026-10-01）。
 *
 * 输入后端 /api/git/diff 的 unified diff 文本（-U3 hunk 稀疏），逐行渲染：
 * 等宽字体 + 新旧两列行号 + +/- 着色 + @@ hunk 头；hunk 之间显示
 * 「跳过 N 行」省略条。行块 content-visibility 兜底超长 diff 的滚动性能
 * （分页懒渲染同思路，diff 无 TOC/锚点需求，块级即可）。
 * 二进制文件由宿主渲染占位卡片，不进本组件。
 */
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

interface DiffRow {
  type: "add" | "del" | "ctx" | "hunk" | "skip";
  text: string;
  oldNo: string;  // 旧文件行号（非数字 = 空）
  newNo: string;  // 新文件行号
}

/** 解析 unified diff 文本为行模型（含 hunk 间省略条）。 */
export function parseUnifiedDiff(diff: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldNo = 0;
  let newNo = 0;
  let prevEnd = 0; // 上个 hunk 覆盖到的旧文件行（+1 = 省略起点）
  let firstHunk = true;

  for (const line of diff.split("\n")) {
    // diff 头（diff --git / index / --- / +++ / new file mode / similarity…）
    if (
      line.startsWith("diff --git") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("rename ") ||
      line.startsWith("similarity") ||
      line.startsWith("old mode") ||
      line.startsWith("new mode") ||
      line.startsWith("Binary files") ||
      line === ""
    ) {
      continue;
    }
    const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      const start = parseInt(m[1], 10);
      oldNo = start;
      newNo = parseInt(m[3], 10);
      if (!firstHunk && start > prevEnd + 1) {
        rows.push({
          type: "skip",
          text: `⋯ 跳过 ${start - prevEnd - 1} 行`,
          oldNo: "",
          newNo: "",
        });
      }
      firstHunk = false;
      rows.push({ type: "hunk", text: line, oldNo: "", newNo: "" });
      continue;
    }
    if (line.startsWith("+")) {
      rows.push({ type: "add", text: line.slice(1), oldNo: "", newNo: String(newNo++) });
    } else if (line.startsWith("-")) {
      rows.push({ type: "del", text: line.slice(1), oldNo: String(oldNo++), newNo: "" });
    } else if (line.startsWith(" ") || line === "") {
      rows.push({ type: "ctx", text: line.replace(/^ /, ""), oldNo: String(oldNo++), newNo: String(newNo++) });
    }
    prevEnd = oldNo - 1;
  }
  return rows;
}

@customElement("diff-viewer")
export class DiffViewer extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      font-family: var(--cortex-font-mono);
      font-size: var(--cortex-fs-sm);
      background: var(--cortex-surface);
    }
    .diff-body {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: var(--cortex-space-2) 0;
      /* 等宽对齐：tab 展开为 4 空格，防制表符错位 */
      tab-size: 4;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    td {
      padding: 0 var(--cortex-space-2);
      white-space: pre;
      vertical-align: top;
      font-family: inherit;
      font-size: inherit;
    }
    td.line-no {
      text-align: right;
      color: var(--cortex-text-subtle);
      user-select: none;
      min-width: 3.2em;
      opacity: 0.75;
      font-size: var(--cortex-fs-xs);
      padding-top: 2px;
    }
    td.sign {
      user-select: none;
      width: 1em;
      padding: 0 0 0 var(--cortex-space-1);
      text-align: center;
      opacity: 0.8;
    }
    tr.ctx td.code { color: var(--cortex-text); }
    tr.add { background: color-mix(in srgb, #2ea04326 55%, transparent); }
    tr.add td.sign { color: #3fb950; }
    tr.del { background: color-mix(in srgb, #f8514926 55%, transparent); }
    tr.del td.sign { color: #f85149; }
    tr.hunk td {
      background: var(--cortex-surface-muted);
      color: var(--cortex-text-muted);
      padding: 2px var(--cortex-space-2);
      font-size: var(--cortex-fs-xs);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    tr.skip td {
      color: var(--cortex-text-subtle);
      font-size: var(--cortex-fs-xs);
      text-align: center;
      padding: var(--cortex-space-1);
      background: var(--cortex-bg);
      user-select: none;
    }
    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--cortex-text-subtle);
      font-family: var(--cortex-font);
      font-size: var(--cortex-fs-base);
      padding: var(--cortex-space-8);
    }
  `;

  /** unified diff 文本（空 = 无差异/占位）。 */
  @property({ attribute: false }) diff = "";

  render() {
    if (!this.diff) {
      return html`<div class="empty">无差异内容</div>`;
    }
    const rows = parseUnifiedDiff(this.diff);
    if (rows.length === 0) {
      return html`<div class="empty">无差异内容</div>`;
    }
    return html`
      <div class="diff-body">
        <table>
          <tbody>
            ${rows.map((r) => {
              if (r.type === "hunk") {
                return html`<tr class="hunk"><td colspan="3">${r.text}</td></tr>`;
              }
              if (r.type === "skip") {
                return html`<tr class="skip"><td colspan="3">${r.text}</td></tr>`;
              }
              const sign = r.type === "add" ? "+" : r.type === "del" ? "-" : " ";
              // 单行号列（用户反馈 2026-10-01）：旧行号优先（del/ctx 侧），
              // 新增行显示新行号——diff 阅读以「源文件位置」为锚
              const lineNo = r.oldNo || r.newNo;
              return html`
                <tr class=${r.type}>
                  <td class="line-no">${lineNo}</td>
                  <td class="sign">${sign.trim()}</td>
                  <td class="code">${r.text}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { "diff-viewer": DiffViewer; }
}
