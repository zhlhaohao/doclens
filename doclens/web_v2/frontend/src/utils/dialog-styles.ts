/** 对话框内嵌件共享样式（AP-27/29/35）：`<dialog>` slot 内容件的公共 CSS。
 *  此前 .note / .buttons / button.primary / 移动端 column-reverse 在
 *  compact / fork / import / city / rewind / turn-delete 等多份逐字复制
 *  （漂移实证：about-dialog `<dialog>` 忘写 open 靠级联巧合显示）。
 *  迁移策略：样式归一，组件本体不合并（防 DRY Misuse）。 */

import { css } from "lit";

/** 提示块（.note）+ 按钮排（.buttons）+ 按钮基础/主键样式 + 移动端断点。 */
export const dialogSlotStyles = css`
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
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--cortex-space-2);
    margin-top: var(--cortex-space-4);
  }
  button {
    padding: 8px 18px;
    border: 1px solid var(--cortex-border);
    background: var(--cortex-surface);
    color: var(--cortex-text-muted);
    cursor: pointer;
    border-radius: var(--cortex-radius-pill);
    font-size: var(--cortex-fs-sm);
    font-family: inherit;
  }
  button.primary {
    background: var(--cortex-btn-primary-bg);
    color: var(--cortex-btn-primary-text);
    border: none;
  }
  button.primary:hover { opacity: 0.9; }
  @media (max-width: 1023px) {
    .buttons { flex-direction: column-reverse; gap: var(--cortex-space-3); }
    .buttons button { width: 100%; padding: 12px 16px; min-height: 44px; }
  }
`;

/** 危险操作确认件的额外样式：警示摘录（.anchor）+ 不可撤销提示（.warn）
 *  + plain 副按钮（rewind / turn-delete 共用）。 */
export const dangerConfirmStyles = css`
  .anchor {
    font-size: var(--cortex-fs-sm);
    color: var(--cortex-text-muted);
    background: var(--cortex-surface-muted);
    border-left: 3px solid var(--cortex-border);
    padding: var(--cortex-space-2) var(--cortex-space-3);
    margin: 0 0 var(--cortex-space-3);
    max-height: 8em;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .warn {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    font-size: var(--cortex-fs-sm);
    color: var(--cortex-danger);
    background: var(--cortex-danger-soft, rgba(220, 38, 38, 0.1));
    border-radius: var(--cortex-radius-sm);
    padding: 8px 10px;
    margin: 0 0 var(--cortex-space-4);
  }
  button.plain {
    background: transparent;
    border: none;
    color: var(--cortex-text-muted);
  }
  button.plain:hover { color: var(--cortex-text); background: var(--cortex-surface-muted); }
`;
