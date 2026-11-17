/** 按钮公共样式（AP-40 抽取 → AP-4 收敛）。
 *
 *  此前按钮形态有三套并存：
 *  - **A `buttonBaseStyles`**（通用对话框）：primary 用
 *    `--cortex-btn-primary-bg`（墨色）+ text 反相；默认 6px 16px /
 *    fs-base；副按钮是无 class 的 `button`（surface 底 + 边框）。
 *  - **B `confirmButtonStyles`**（rewind / turn-delete）：primary 用
 *    `--cortex-text` 反相（**另一套配色**）；8px 18px / fs-sm / 600。
 *  - **C `dialogSlotStyles`**（compact / fork / import）：primary 用
 *    `btn-primary-bg`（与 A 同源）；8px 18px / fs-sm；圆角 pill。
 *    且 C 内嵌了一套 `button {}` 与 A 重复。
 *
 *  漂移实证：同一「主按钮」在不同对话框里长得不一样（墨色 vs 文字色
 *  反相）；`.actions` / `.buttons` 两套类名做同一件事且各定义一次。
 *
 *  归一：**一套 token 化按钮**（形态契约：边框/圆角/字号/过渡/禁用态/
 *  三变体 primary·danger·plain）+ **两档尺寸变体**（`.buttons` 默认
 *  紧凑档 8px 18px / fs-sm；`.actions` 通用档 6px 16px / fs-base——
 *  与原行为一致，不改视觉）。primary 统一走 `--cortex-btn-primary-bg`
 *  （A/C 同源的那一套；B 的反相是唯一离群者，收敛后视觉统一）。
 *
 *  不抽 `<c-button>` 自定义元素——现有测试有大量
 *  `shadowRoot.querySelector("button.primary")` 依赖原生 button 语义。
 *
 *  约定：Lit `static styles = [buttonBaseStyles, css`…`]`——数组后者
 *  覆盖前者，各组件的特有变体（warn / cancel / icon-btn）写在后面片段。
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
    transition: opacity 0.15s, filter 0.15s, background 0.15s;
  }
  button:disabled {
    opacity: var(--cortex-btn-disabled-opacity);
    cursor: not-allowed;
  }
  button.primary {
    background: var(--cortex-btn-primary-bg);
    color: var(--cortex-btn-primary-text);
    border: none;
    font-weight: 600;
  }
  button.primary:hover:not(:disabled) { opacity: 0.9; }
  button.danger {
    background: var(--cortex-danger);
    color: var(--cortex-on-danger);
    border: none;
    font-weight: 600;
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

/** 紧凑档按钮（确认类对话框用）：8px 18px / fs-sm——原
 *  `confirmButtonStyles` 与 `dialogSlotStyles` 两套同尺寸实现合一。 */
export const confirmButtonStyles = css`
  button,
  button.primary,
  button.danger,
  button.plain {
    padding: 8px 18px;
    font-size: var(--cortex-fs-sm);
  }
`;

/** 按钮排（.actions / .buttons）：右对齐一行，移动端竖排（column-reverse，
 *  主按钮在下）。移动端按钮撑满 + 44px 触控高度（DESIGN.md 触控目标）。
 *
 *  `.actions` 与 `.buttons` 曾是两个类名做同一件事（AP-4 收敛：`.buttons`
 *  归一为 `.actions` 的别名形态——两者规则相同，仅保留一套定义）。 */
export const buttonRowStyles = css`
  .actions,
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--cortex-space-2);
    margin-top: var(--cortex-space-4);
  }
  @media (max-width: 1023px) {
    .actions,
    .buttons {
      flex-direction: column-reverse;
      gap: var(--cortex-space-3);
    }
    .actions button,
    .buttons button {
      width: 100%;
      padding: 12px 16px;
      min-height: 44px;
    }
  }
`;
