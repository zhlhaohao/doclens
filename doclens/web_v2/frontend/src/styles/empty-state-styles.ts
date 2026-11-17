/** 空态/占位公共样式（AP-2 抽取）。
 *
 *  此前 `.empty { }` 在 17 个组件各自定义，间距/字号/色值/对齐各不相同
 *  （`--cortex-space-8` vs `space-6` vs `4px 0`、subtle vs muted、fs-sm
 *  vs fs-base vs fs-md），diary-review-panel 还硬编码 32px 违反 DESIGN.md
 *  「只用 tokens」纪律——「暂无内容」提示在跨页面观感割裂。
 *
 *  归一为**样式层**公共块（保留 `.empty` 类名——4 个 spec 文件直接
 *  `querySelector(".empty")` 断言，且各宿主的三态分支逻辑各异，抽组件
 *  会强行统一「空/加载/错误」状态机，属 DRY Misuse）。
 *
 *  基线（收自 17 处的众数形态）：
 *  - 纵向间距 `--cortex-space-6`（原 space-8/space-6/4px 三派归一为 6；
 *    需要更大留白的 flex 填充场景用 .empty.fill）
 *  - 字号 `--cortex-fs-sm`（原 fs-sm/fs-base/fs-md 三派——空态文案属辅
 *    助信息，取最小档与 .muted 提示条同口径）
 *  - 颜色 `--cortex-text-subtle`（比 muted 更弱一档：空态是「没有内容」
 *    而非「次要说明」）
 *  - 居中文本；呼吸动画（加载态）与全屏填充（flex 场景）走变体类
 */

import { css } from "lit";

/** 空态基础样式 + 加载呼吸变体 + flex 填充变体。 */
export const emptyStateStyles = css`
  .empty {
    color: var(--cortex-text-subtle);
    font-size: var(--cortex-fs-sm);
    text-align: center;
    padding: var(--cortex-space-6) var(--cortex-space-4);
    line-height: 1.6;
  }
  /* 加载中变体：呼吸动画给「正在干活」的感知（区别于确定性的「为空」） */
  .empty.loading {
    animation: empty-pulse 1.2s ease-in-out infinite;
  }
  @keyframes empty-pulse {
    50% { opacity: 0.45; }
  }
  @media (prefers-reduced-motion: reduce) {
    .empty.loading { animation: none; }
  }
  /* flex 填充变体：列表容器内撑满剩余高度并居中 */
  .empty.fill {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--cortex-space-2);
    padding: var(--cortex-space-8) var(--cortex-space-4);
  }
`;
