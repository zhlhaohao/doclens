/** 设置页 section 公共样式（AP-40 抽取）。
 *
 * model-presets / mcp-servers / search-presets / skills 四个 section 此前
 * 逐字复制同一批规则（.icon-btn 族、.empty、.field-label、.form 内联编辑
 * 表单、.form-actions、.form-error、.msg 提示条、.wrap）——四处完全相同
 * 73 条。配套 utils/section-mixins.ts 的 ToastFlashMixin（同为设置页
 * section 共用件），样式与逻辑两处一起归一。
 *
 * 归一为**样式层**公共块（组件本体不合并——四者字段结构各异）。
 * 用法：`static styles = [settingsSectionStyles, css`…特有样式…`]`，数组
 * 后者覆盖前者。
 */

import { css } from "lit";

/** 设置 section 共用样式：小圆钮 + 空态 + 表单 + 提示条。 */
export const settingsSectionStyles = css`
  .wrap {
    margin-bottom: var(--cortex-space-6);
  }
  .icon-btn {
    padding: 4px 10px;
    border: 1px solid var(--cortex-border);
    background: var(--cortex-surface);
    color: var(--cortex-text);
    border-radius: var(--cortex-btn-radius);
    font-size: var(--cortex-fs-xs);
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, border-color 0.15s;
  }
  .icon-btn:hover {
    background: var(--cortex-surface-muted);
    border-color: var(--cortex-text-muted);
  }
  .icon-btn.primary {
    background: var(--cortex-btn-primary-bg);
    border-color: var(--cortex-btn-primary-bg);
    color: var(--cortex-btn-primary-text);
    font-weight: 600;
  }
  .icon-btn.primary:hover { filter: brightness(1.05); }
  .icon-btn.danger:hover {
    background: var(--cortex-danger);
    border-color: var(--cortex-danger);
    color: var(--cortex-on-danger);
  }
  .icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .empty {
    font-size: var(--cortex-fs-xs);
    color: var(--cortex-text-subtle);
    padding: var(--cortex-space-2) 0;
  }
  .field-label {
    font-size: var(--cortex-fs-xs);
    font-weight: 600;
    color: var(--cortex-text-muted);
    margin-bottom: 2px;
  }
  .form {
    margin-top: var(--cortex-space-3);
    padding: var(--cortex-space-4);
    border: 1px solid var(--cortex-border);
    border-radius: var(--cortex-radius-md);
    background: var(--cortex-surface);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--cortex-space-3);
  }
  .form .full { grid-column: 1 / -1; }
  .form-actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: var(--cortex-space-2);
  }
  .form-error {
    grid-column: 1 / -1;
    font-size: var(--cortex-fs-xs);
    color: var(--cortex-danger);
  }
  .msg {
    font-size: var(--cortex-fs-xs);
    padding: var(--cortex-space-2) var(--cortex-space-3);
    border-radius: var(--cortex-radius-md);
    margin-top: var(--cortex-space-3);
  }
  .msg.ok { background: var(--cortex-primary-soft); color: var(--cortex-primary); }
  .msg.err { background: var(--cortex-danger-soft, rgba(220,38,38,0.1)); color: var(--cortex-danger); }
  @media (max-width: 1023px) {
    .form { grid-template-columns: 1fr; }
  }
`;
