/** 旋转加载指示器公共样式（AP-1 抽取）。
 *
 *  此前同一配方（`border` + `border-top-color: var(--cortex-primary)` +
 *  `border-radius: 50%` + `@keyframes X { to { transform: rotate(360deg) } }`）
 *  在 8 处各自定义，且 **keyframes 名各不相同**——`swap-spin` /
 *  `compact-spin` / `cortex-download-spin` / `cortex-upload-spin` /
 *  `cortex-upload-overlay-spin` / `ptr-spin` / `cortex-spin` / `spin`
 *  共 8 个名字指同一动画；另有一处（chat-tool-trace）配色反向
 *  （primary 环 + 透明顶），说明配方已无单一真相源。
 *
 *  归一为**样式层**公共块 + `components/spinner.ts` 组件：
 *  - 样式块供「伪元素/自定义形状」场景直接 import（每个 shadow root 需
 *    各自 adopted 一份，故 keyframes 随块走）；
 *  - 组件承载尺寸/边框/配色变体，供绝大多数场景直接用元素。
 *
 *  尺寸约定：`.spinner-ring` 的宽高/边框宽/时长均由 CSS 变量驱动
 *  （`--cortex-spinner-size` / `--cortex-spinner-border-width` /
 *  `--cortex-spinner-duration`），默认值即公共默认档。
 *
 *  可访问性：旋转动画对前庭功能障碍用户有健康风险（WCAG 2.3.3），
 *  降级写在本块内一处——**全量覆盖**（此前仅 4/9 站点有
 *  `prefers-reduced-motion` 降级，5 处缺失）。
 */

import { css } from "lit";

/** 旋转环基础样式 + 唯一一份 keyframes + reduced-motion 降级。 */
export const spinnerStyles = css`
  .spinner-ring {
    width: var(--cortex-spinner-size, 20px);
    height: var(--cortex-spinner-size, 20px);
    border: var(--cortex-spinner-border-width, 2px) solid var(--cortex-border);
    border-top-color: var(--cortex-primary);
    border-radius: 50%;
    animation: cortex-spin var(--cortex-spinner-duration, 0.8s) linear infinite;
  }
  /* 配色反向变体：主题色整环 + 透明顶（工具运行中态用——语义为
     「正在调用」，与「加载中」的主色顶环区分） */
  .spinner-ring.reverse {
    border-color: var(--cortex-primary);
    border-top-color: transparent;
  }
  @keyframes cortex-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner-ring { animation: none; }
  }
`;
