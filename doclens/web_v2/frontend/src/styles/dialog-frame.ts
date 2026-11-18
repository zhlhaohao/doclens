/** 原生 <dialog> 对话框外壳公共样式（AP-40 抽取 → AP-3 收敛）。
 *
 * 历史：about / backup / control-panel / watch-changes / workdir-switch
 * 五件逐字复制同一段外壳（:host 全屏遮罩 + .scrim + 自绘 dialog 卡片
 * + .head + .close-btn）。AP-3 已把那五件迁到 `<c-dialog>` 公共件
 * （原生 <dialog> + showModal top-layer），**自绘外壳
 * `dialogFrameStyles` 随之废弃删除**——外壳唯一真相源是
 * `components/c-dialog.ts`。
 *
 * 本文件现存两块：
 * - `dialogCardStyles`：卡片形态（边框/圆角/阴影/背景/backdrop/移动端）
 * - `dialogHeadStyles`：卡片内标题行 + 关闭钮（迁出后由各组件自渲染）
 */

import { css } from "lit";

/** 原生 <dialog> 卡片形态（AP-3）：族 B 三份近似复制的单一真相源。
 *
 *  chat-view-styles / files-view / diary-view 此前各写一遍几乎相同的
 *  规则（border + radius-xl + padding:0 + surface + shadow-lg +
 *  max-width:90vw + ::backdrop + `dialog > *` padding），仅 min-width 与
 *  移动端规则略有差异。归一为**样式层**公共块。
 *
 *  用法：`static styles = [dialogCardStyles, css`…特有…`]`，或直接
 *  import 到视图的 styles 组合里。
 */
export const dialogCardStyles = css`
  dialog {
    border: 1px solid var(--cortex-border);
    border-radius: var(--cortex-radius-xl);
    box-sizing: border-box;
    padding: 0;
    background: var(--cortex-surface);
    box-shadow: var(--cortex-shadow-lg);
    max-width: 90vw;
    /* 卡片最小宽度：宿主（<c-dialog> 公共件）经 --c-dialog-min-width 注入；
       未注入时为 0 = 不设下限（内容自适应）。 */
    min-width: var(--c-dialog-min-width, 0);
  }
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.3);
  }
  /* 移动端：卡片**内缩**（2026-11-18 修正）——此前占满 100vw，左右边框
     顶住屏幕边缘，读起来像「页面被裁掉一半」。改为左右各留 16px 间距，
     卡片宽 = 视口宽 − 32px；同时归零 min-width（宿主给的 340/360px 下限
     在窄屏上会顶住边缘）。 */
  @media (max-width: 1023px) {
    dialog {
      min-width: 0;
      width: calc(100vw - 32px);
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px);
      border-radius: var(--cortex-radius-md);
    }
  }
`;

/** 对话框卡片内的标题行 + 关闭钮（AP-3）。
 *
 *  族 A 五件（about / backup / control-panel / watch-changes /
 *  workdir-switch）迁到 `<c-dialog>` 后，标题行与关闭钮不再由外壳
 *  自绘，改由各组件在自己的 shadow 内渲染——样式从 dialogFrameStyles
 *  拆出为独立公共块，内容组件 import 即可。
 */
export const dialogHeadStyles = css`
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
`;
