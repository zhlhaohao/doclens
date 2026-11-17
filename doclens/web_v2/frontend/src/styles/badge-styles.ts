/** 徽标（badge）公共样式（AP-7 抽取）。
 *
 *  此前 `.badge { }` 在 8 个组件各自定义，形状/内边距/圆角/底色各异：
 *  - 圆角：`--cortex-radius-pill`（6 处）vs `--cortex-radius-sm`（1 处）
 *  - 内边距：`1px 6px` / `1px 8px` / `1px space-2` / `0 6px` / `2px 10px`
 *  - 底色：`primary-soft` / `surface` / `surface-muted` / 无
 *  - 边框：`1px solid currentColor` / `1px solid border` / 无
 *  另有两处是**死样式**（file-row / model-presets-section 的 `.badge`
 *  无匹配模板——与 AP-24 同型），本次一并清除。
 *
 *  归一为**样式层**公共块：**只归一形状**（字号/圆角/内边距/行内块/
 *  不换行），**色值与边框走变体类**（primary / success / neutral /
 *  plain），各组件的布局差异（margin-left / vertical-align / mono 字体
 *  / flex-shrink）保留在本地——防 DRY Misuse。
 *
 *  语义色差异确实存在（主色/成功/中性/diff 色），故不强并为单一组件；
 *  仅提供形状契约 + 变体。
 */

import { css } from "lit";

/** 徽标形状基线 + 色值变体。 */
export const badgeStyles = css`
  .badge {
    display: inline-block;
    flex-shrink: 0;
    padding: 1px var(--cortex-space-2);
    font-size: var(--cortex-fs-xs);
    font-weight: 600;
    line-height: 1.6;
    border-radius: var(--cortex-radius-pill);
    white-space: nowrap;
  }
  /* 中性徽标（浅底 + 描边 + 弱化文字）——设置页/技能列表默认 */
  .badge.neutral {
    background: var(--cortex-surface);
    border: 1px solid var(--cortex-border);
    color: var(--cortex-text-muted);
  }
  /* 描边徽标（底色 + 描边，色值由调用方覆写 border-color/color） */
  .badge.outline {
    background: var(--cortex-surface);
    border: 1px solid var(--cortex-border);
  }
  /* 主色徽标 */
  .badge.primary {
    background: var(--cortex-surface);
    border: 1px solid var(--cortex-primary);
    color: var(--cortex-primary);
  }
  /* 成功徽标（描边色随文字色） */
  .badge.success {
    background: transparent;
    border: 1px solid currentColor;
    color: var(--cortex-success);
  }
  /* 纯文字徽标（无底色无边框——命中数这类弱信息） */
  .badge.plain {
    padding: 0;
    border: none;
    background: none;
    font-weight: 400;
    color: var(--cortex-text-muted);
  }
`;
