/** 表单控件公共样式（AP-6 抽取）。
 *
 *  此前同一控件族（input / select / textarea / checkbox）在多处各自定义，
 *  形态分裂且已漂移：
 *  - `.input,.select`：model-presets（padding 8px 10px / bg `--cortex-bg`）
 *    ≈ mcp（8px 10px / bg `--cortex-bg`）≠ settings-view（**9px 12px /
 *    bg `--cortex-surface`**）——同一控件两种内边距 + 两种背景 token；
 *  - `select,input[type=text]`：translate-dialog（padding `--cortex-space-2`
 *    / 圆角 `--cortex-radius-sm` / bg surface）——第三套；
 *  - `input`：input-dialog-base（8px / 圆角 md / fs-base / 无背景指定）；
 *  - `textarea`：reparse（min-height 180px / fs-sm）/ skill-run（72px /
 *    fs-base）/ interject（auto / fs-md / bg surface）/ mcp（64px / mono）；
 *  - checkbox：8 处自写，多处无 `accent-color`。
 *
 *  归一为**样式层**公共块：**只归一边框/圆角/字号/焦点环/过渡**（控件
 *  形态契约），**尺寸（padding / min-height / width）与背景 token 走变体
 *  或本地覆盖**——各控件在不同容器里的尺寸需求确有差异（对话框窄、
 *  设置页宽），强并会改布局（DRY Misuse）。
 *
 *  背景色统一取 `--cortex-surface`（原 `--cortex-bg` 与 surface 两派，
 *  以 surface 为准——与按钮/徽标同族底色，且避免深色主题下表单凹陷）。
 */

import { css } from "lit";

/** 表单控件族：input / select / textarea / checkbox 的形态契约。 */
export const formStyles = css`
  /* 盒模型归一（AP-6 视觉修正 2026-11-17）：**元素选择器**而非仅类名
     选择器——shadow DOM 不受全局 reset 影响，裸 <input> / <select> /
     <textarea>（input-dialog-base 的输入框、interject-dialog 的 textarea、
     mcp-servers-section 的输入、ask-card / file-search-box 的输入等）
     若不带 .input/.select/.textarea 类名，原先只在类名选择器上的
     box-sizing 根本不命中 → width:100% 按 content-box 计算 =
     100% + padding + border → 溢出容器右侧（重命名对话框实测）。
     元素选择器覆盖全部表单控件，content-box 溢出一次性根治。 */
  input,
  select,
  textarea {
    box-sizing: border-box;
  }
  .input,
  .select,
  .textarea {
    padding: 8px 10px;
    border: 1px solid var(--cortex-border);
    border-radius: var(--cortex-radius-md);
    background: var(--cortex-surface);
    color: var(--cortex-text);
    font-size: var(--cortex-fs-sm);
    font-family: inherit;
    width: 100%;
    max-width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .input:focus,
  .select:focus,
  .textarea:focus {
    outline: none;
    border-color: var(--cortex-primary);
    box-shadow: var(--cortex-focus-ring);
  }
  .input.mono,
  .textarea.mono {
    font-family: var(--cortex-font-mono);
  }
  .textarea {
    min-height: 64px;
    resize: vertical;
  }
  /* checkbox：统一主题色勾选框 */
  .checkbox,
  input[type="checkbox"] {
    accent-color: var(--cortex-primary);
  }
`;
