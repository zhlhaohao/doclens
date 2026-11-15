/** 原生 <dialog> 对话框外壳公共样式（AP-40 抽取）。
 *
 * about-dialog / backup-dialog / control-panel-dialog / watch-changes-dialog /
 * workdir-switch-dialog 五件此前逐字复制同一段外壳：:host 全屏遮罩定位 +
 * :host([open]) 半透明遮罩 + .scrim + dialog 卡片 + .head 标题行 +
 * .close-btn 关闭钮 + 移动端 dialog 撑满。漂移实证：workdir 的
 * .close-btn 多出 :disabled 分支、backup 的 dialog 用 `width: min(...)`
 * 而其余四家用 min-width，三处各写一遍移动端断点。
 *
 * 归一为**样式层**公共块（组件本体不合并——各对话框内容结构各异）。
 * 用法：`static styles = [dialogFrameStyles, css`…特有样式…`]`，数组后者
 * 覆盖前者（各组件的 dialog 尺寸差异写在后面的片段里）。
 */

import { css } from "lit";

/** 对话框外壳：遮罩 + 卡片 + 标题行 + 关闭钮 + 移动端断点。 */
export const dialogFrameStyles = css`
  :host {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--cortex-z-toast);
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
  .close-btn:hover:not(:disabled) {
    background: var(--cortex-surface-muted);
    color: var(--cortex-text);
  }
  .close-btn:disabled {
    opacity: var(--cortex-btn-disabled-opacity);
    cursor: not-allowed;
  }
  @media (max-width: 1023px) {
    dialog {
      min-width: 0;
      width: calc(100vw - 16px);
      max-width: calc(100vw - 16px);
    }
  }
`;
