/** 按钮公共样式（AP-40 抽取）。
 *
 * 此前基础按钮（border + surface + pill + fs-base）、`button.primary`
 * （黑 pill 主按钮）、`button.danger`、`button.plain` 与 `.actions` 按钮排
 * 在 delete/input-dialog-base/move/reindex/session-info/skill-run/
 * translate 等 10+ 个对话框里逐字复制（漂移实证：disabled 透明度有
 * 0.4 / 0.5 两版、primary 圆角有 pill / 999px 两版）。
 *
 * 归一为**样式层**公共块（不抽 <c-button> 自定义元素——现有测试有 72 处
 * `shadowRoot.querySelector("button.primary")` 依赖原生 button 语义）。
 * 约定：Lit `static styles = [buttonBaseStyles, css`…`]`——数组后者覆盖
 * 前者，各组件的特有变体（warn / cancel / icon-btn）写在后面的片段里。
 */

import { css } from "lit";

/** 基础按钮：默认态 + 禁用态 + primary / danger / plain 三变体。 */
export const buttonBaseStyles = css`
  button {
    padding: 6px 16px;
    border: 1px solid var(--cortex-border);
    background: var(--cortex-surface);
    color: var(--cortex-text);
    cursor: pointer;
    border-radius: var(--cortex-btn-radius);
    font-size: var(--cortex-fs-base);
    font-family: inherit;
  }
  button:disabled {
    opacity: var(--cortex-btn-disabled-opacity);
    cursor: not-allowed;
  }
  button.primary {
    background: var(--cortex-btn-primary-bg);
    color: var(--cortex-btn-primary-text);
    border: none;
  }
  button.primary:hover:not(:disabled) { opacity: 0.9; }
  button.danger {
    background: var(--cortex-danger);
    color: var(--cortex-on-danger);
    border: none;
  }
  button.danger:hover:not(:disabled) { filter: brightness(1.05); }
  button.plain {
    background: transparent;
    color: var(--cortex-text-muted);
    border: 1px solid var(--cortex-border);
  }
  button.plain:hover:not(:disabled) {
    background: var(--cortex-surface-muted);
    color: var(--cortex-text);
  }
`;

/** 确认框按钮（.plain 副按钮 + .danger 危险主键 + primary 黑 pill）：
 *  确认类对话框（rewind / turn-delete）的一组按钮——比通用按钮略小
 *  （fs-sm、8px 18px），primary 用文字色反相而非 btn-primary token。 */
export const confirmButtonStyles = css`
  button.primary {
    background: var(--cortex-text);
    color: var(--cortex-surface);
    border: none;
    border-radius: var(--cortex-btn-radius);
    padding: 8px 18px;
    font-size: var(--cortex-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  button.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button.plain {
    background: transparent;
    color: var(--cortex-text-muted);
    border: 1px solid var(--cortex-border);
    border-radius: var(--cortex-btn-radius);
    padding: 8px 18px;
    font-size: var(--cortex-fs-sm);
    cursor: pointer;
  }
  button.danger {
    background: var(--cortex-danger);
    color: var(--cortex-on-danger);
    border: none;
    border-radius: var(--cortex-btn-radius);
    padding: 8px 18px;
    font-size: var(--cortex-fs-sm);
    font-weight: 600;
    cursor: pointer;
  }
  button.danger:disabled { opacity: 0.5; cursor: not-allowed; }
`;

/** 按钮排（.actions / .buttons）：右对齐一行，移动端竖排（column-reverse，
 *  主按钮在下）。移动端按钮撑满 + 44px 触控高度（DESIGN.md 触控目标）。 */
export const buttonRowStyles = css`
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--cortex-space-2);
    margin-top: var(--cortex-space-4);
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--cortex-space-2);
    margin-top: var(--cortex-space-4);
  }
  @media (max-width: 1023px) {
    .actions {
      flex-direction: column-reverse;
      gap: var(--cortex-space-3);
    }
    .actions button {
      width: 100%;
      padding: 12px 16px;
      min-height: 44px;
    }
    .buttons {
      flex-direction: column-reverse;
      gap: var(--cortex-space-3);
    }
    .buttons button {
      width: 100%;
      padding: 12px 16px;
      min-height: 44px;
    }
  }
`;
