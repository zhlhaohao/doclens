import { css } from "lit";

/** 对话框通用控件样式（按钮 + 输入框）—— mkdir/rename/move/reindex/delete 共用。
 * 在各 dialog 的 static styles 数组里置于特有样式之前；特有规则（button.danger/warn、
 * label.opt、移动端断点等）放在后面的 css`` 片段里覆盖。 */
export const dialogControlStyles = css`
  button {
    padding: var(--cortex-space-2) var(--cortex-space-4);
    border: 1px solid var(--cortex-border);
    background: var(--cortex-surface);
    color: var(--cortex-text);
    cursor: pointer;
    border-radius: var(--cortex-radius-sm);
    font-size: var(--cortex-fs-base);
    font-family: var(--cortex-font);
    transition: border-color 0.15s, background 0.15s;
  }
  button:hover { background: var(--cortex-surface-muted); border-color: var(--cortex-text-subtle); }
  button:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
  button.primary {
    background: var(--cortex-btn-primary-bg);
    color: var(--cortex-btn-primary-text); border: none;
    border-radius: var(--cortex-radius-pill);
  }
  button.primary:hover { opacity: 0.9; }
  input {
    width: 100%;
    box-sizing: border-box;
    padding: var(--cortex-space-2) var(--cortex-space-4);
    border: 1px solid var(--cortex-border);
    border-radius: var(--cortex-radius-md);
    background: var(--cortex-surface);
    font-family: var(--cortex-font);
    font-size: var(--cortex-fs-base);
    color: var(--cortex-text);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input:focus {
    outline: none;
    border-color: var(--cortex-primary);
    box-shadow: var(--cortex-focus-ring);
  }
  input.invalid { border-color: var(--cortex-danger); }
  input.invalid:focus { box-shadow: var(--cortex-focus-ring-danger); }
`;
