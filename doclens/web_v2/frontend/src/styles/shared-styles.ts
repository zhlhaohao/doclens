import { css } from "lit";

/** initial 页布局（search-view / chat-view 共用）
 * hero-card 把 welcome-pane + history-list + input-row 合并为一张整体卡。
 * 移动端：hero-card 无缝衔接 app-bar/tab-bar（padding 0 + 直角无边框/阴影）。
 * 桌面端（≥1024px）：hero-card 居中卡片，max-width 由 --hero-max-width 控制
 *   （默认 720px；chat-view 在 :host 设 760px）。 */
export const initialStackStyles = css`
  .initial-stack {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: var(--cortex-space-6);
    padding: 0;
  }
  .hero-card {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--cortex-surface);
    overflow: hidden;
  }
  .input-row {
    padding: var(--cortex-space-3) var(--cortex-space-4);
    flex-shrink: 0;
    background: var(--cortex-primary-soft);
    border-top: 1px solid var(--cortex-border);
  }
  @media (min-width: 1024px) {
    .initial-stack {
      max-width: var(--hero-max-width, 720px);
      margin: 0 auto;
      width: 100%;
      padding: var(--cortex-space-6) 0 var(--cortex-space-4);
    }
    .hero-card {
      border: 1px solid var(--cortex-border);
      border-radius: var(--cortex-radius-lg);
      box-shadow: var(--cortex-shadow-md);
    }
  }
`;

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
    background: var(--cortex-primary-gradient);
    color: #fff; border: none;
    border-radius: var(--cortex-radius-lg);
    box-shadow: var(--cortex-primary-glow);
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
