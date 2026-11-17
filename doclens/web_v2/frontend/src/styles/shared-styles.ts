import { css } from "lit";

/** 已移除：dialogControlStyles（对话框控件基础样式）。
 *
 *  AP-40 抽取时由 styles/button-styles.ts 取代（按钮族）+ 各组件自带
 *  input 样式（对话框输入框形态并不统一，故不入共享块）。本文件保留，
 *  因 tests/content-width.spec.ts 断言「此处不得复活已删除的死 token /
 *  死样式」——文件在即断言才有意义（断言按字面匹配，故此处不复述 token 名）。 */
export const sharedStylesContract = css`
  :host { display: block; }
`;
