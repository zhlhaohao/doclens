/** 对话框内嵌件共享样式（AP-27/29/35 → AP-4 收敛）。
 *
 *  此前 .note / .buttons / button.primary / 移动端 column-reverse 在
 *  compact / fork / import / city / rewind / turn-delete 等多份逐字复制
 *  （漂移实证：about-dialog `<dialog>` 忘写 open 靠级联巧合显示）。
 *
 *  AP-4 收敛：按钮形态与按钮排已归入 `styles/button-styles.ts`
 *  （buttonBaseStyles / confirmButtonStyles / buttonRowStyles）——本文件
 *  原先内嵌的第三套 `button {}` 定义随之删除，`.buttons` 规则改由
 *  buttonRowStyles 提供（同名同义，单一真相源）。
 *  本文件只保留**对话框内容块的提示样式**（.note）。
 */

import { css } from "lit";

/** 提示块（.note）：图标 + 文案的两栏块。 */
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
`;

/** 已移除：dangerConfirmStyles（危险确认件的 .anchor / .warn / button.plain）。
 *
 *  AP-40 抽取时：button.plain 归入 styles/button-styles.ts 的
 *  buttonBaseStyles（+ confirmButtonStyles 的确认框变体）；.anchor / .warn
 *  两件（rewind / turn-delete）形态确有差异（前者带 primary 边框色、
 *  后者带左描边圆角），故各留组件内，不强行归一（防 DRY Misuse）。 */
