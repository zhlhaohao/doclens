/** 确认类对话框的内容块公共样式（AP-4 抽取）。
 *
 *  六个确认框（compact / fork / import / turn-delete / rewind / delete）
 *  此前各自复制同一批内容块样式，形态高度相似却已漂移：
 *  - `.muted`：compact / fork 各一份（fs-sm + muted）
 *  - `.detail`：import / turn-delete 各一份（fs-sm + 1.6 行高 + space-3 下边距）
 *  - `.note`：compact / fork / import 用（icon + 文案两栏）——其中
 *    fork/compact 经 dialogSlotStyles 已有公共块，import 又写了一份
 *  - `.warn`：turn-delete / rewind / delete 三份——**形态确实分裂**
 *    （turn-delete/rewind 是「surface-muted 底 + 无边框」，delete 是
 *    「黄色半透明底 + 描边 + 左侧警示条」）
 *  - `.anchor`：turn-delete / rewind 两份（描边色不同：border vs primary）
 *  - `.error`：turn-delete / rewind 各一份
 *
 *  归一为**样式层**公共块：**同形态的块合一**（.muted / .detail /
 *  .note / .error），**形态确实不同的保留变体类**（.warn 分
 *  `.warn`（中性）/ `.warn.danger`（警示黄）；.anchor 分 `.anchor` /
 *  `.anchor.primary`）——不强并即 DRY Misuse。
 */

import { css } from "lit";

/** 确认框内容块公共样式。 */
export const confirmStyles = css`
  h2 {
    margin: 0 0 var(--cortex-space-3) 0;
    font-size: var(--cortex-fs-md);
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--cortex-text);
  }
  h2.with-icon {
    display: flex;
    align-items: center;
    gap: var(--cortex-space-2);
  }
  /* 次要说明段 */
  .muted {
    color: var(--cortex-text-muted);
    font-size: var(--cortex-fs-sm);
  }
  /* 正文说明段 */
  .detail {
    font-size: var(--cortex-fs-sm);
    line-height: 1.6;
    margin-bottom: var(--cortex-space-3);
  }
  /* 提示块（图标 + 文案两栏，浅底圆角） */
  .note {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    font-size: var(--cortex-fs-sm);
    color: var(--cortex-text-muted);
    background: var(--cortex-surface-muted);
    border-radius: var(--cortex-radius-sm);
    padding: 8px 10px;
    margin-bottom: var(--cortex-space-4);
  }
  /* 警示块：默认中性浅底；.danger 变体为黄色警示（删除类操作） */
  .warn {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    font-size: var(--cortex-fs-sm);
    color: var(--cortex-text-muted);
    background: var(--cortex-surface-muted);
    border-radius: var(--cortex-radius-sm);
    padding: 8px 10px;
    margin-bottom: var(--cortex-space-4);
  }
  .warn.danger {
    padding: var(--cortex-space-3);
    background: rgba(247, 185, 40, 0.10);
    border: 1px solid rgba(247, 185, 40, 0.35);
    border-left: 3px solid var(--cortex-warning);
    border-radius: var(--cortex-radius-md);
    color: var(--cortex-text);
    margin-bottom: var(--cortex-space-3);
  }
  /* 锚点摘录块（被操作内容的引文）：默认中性描边；.primary 变体主色描边 */
  .anchor {
    background: var(--cortex-surface-muted);
    border-left: 3px solid var(--cortex-border);
    border-radius: 0 var(--cortex-radius-sm) var(--cortex-radius-sm) 0;
    padding: 8px 10px;
    margin-bottom: var(--cortex-space-3);
    font-size: var(--cortex-fs-sm);
    color: var(--cortex-text-muted);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .anchor.primary {
    border-radius: var(--cortex-radius-sm);
    border-left: 3px solid var(--cortex-primary);
    margin: 0 0 var(--cortex-space-3);
  }
  /* 错误行（提交失败回填） */
  .error {
    color: var(--cortex-danger);
    font-size: var(--cortex-fs-sm);
    margin-bottom: var(--cortex-space-2);
  }
`;
