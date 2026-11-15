import { css } from "lit";

/** chat-view 视图样式（AP-1 拆分第一步：静态 CSS 外迁）。
 *
 * 原为 chat-view.ts 内的 `static styles = css` 模板（214 行），与组件
 * 行为逻辑混在同一文件——God Object 的「样式域」职责。纯样式无状态、
 * 无副作用，机械外移，行为零变化。
 */
export const chatViewStyles = css`
  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    background: var(--cortex-view-bg);
    /* shadow 内不受全局 border-box reset 影响，须显式声明：
       content-box 下 .input-bar 的 max-width:token 不含 padding(48px)，
       输入框比 initial 态 .input-row 里的宽 48px，两态切换时跳动 */
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: border-box; }
  .initial-stack {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    /* 顶部蓝色光晕：让白色卡片从背景中浮出，增加层次感 */
    background:
      radial-gradient(720px 280px at 50% -80px, color-mix(in srgb, var(--cortex-primary) 8%, transparent), transparent 70%);
  }
  .input-row {
    /* 底部留白与搜索页 .input-row 一致（space-4=16px），保证两页输入框距底边等高 */
    padding: 6px var(--cortex-space-6) var(--cortex-space-4);
    flex-shrink: 0;
  }
  /* 输入框对齐日记记录页的紧凑尺寸（默认 ≈48px/11px 偏大） */
  .text-input {
    --min-h: calc(var(--cortex-fs-md) * 1.5 + 14px);   /* ≈36px，随字号缩放 */
    --cortex-input-pad-y: 6px;
  }
  .focus-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .input-bar {
    /* 底部留白与搜索页输入框一致（space-4=16px），顶部保持 space-3 */
    padding: var(--cortex-space-3) var(--cortex-space-6) var(--cortex-space-4);
    border-top: 1px solid var(--cortex-border-muted);
    flex-shrink: 0;
    background: var(--cortex-view-bg);
  }
  .focus-main {
    display: flex;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  }
  /* 悬置卡（ask-card）可收缩内滚后，多问堆叠时会把消息区压到 0——
     留最小保底，答题期间仍可见最后一两条消息上下文。row 布局
     （桌面有预览）下列高本就 stretch，此规则无实际影响。 */
  .focus-main chat-stream {
    min-height: 96px;
  }
  /* 桌面 preview 关闭：chat-stream 与 ask-card 同步居中限宽（卡片不超消息区） */
  @media (min-width: 1024px) {
    .focus-main:not(.has-preview) chat-stream,
    .focus-main:not(.has-preview) ask-card {
      max-width: var(--content-max-width, 1080px);
      margin: 0 auto;
      width: 100%;
    }
  }
  /* 桌面 preview 打开：水平排布，chat-stream 让位 */
  @media (min-width: 1024px) {
    .focus-main.has-preview {
      flex-direction: row;
      padding: var(--cortex-space-3);
    }
    .focus-main.has-preview chat-stream,
    .focus-main.has-preview ask-card {
      flex: 1 1 0;
      min-width: 0;
      max-width: none;
    }
  }
  .focus-main .splitter {
    flex: 0 0 4px;
    cursor: col-resize;
    background: var(--cortex-border-muted);
    transition: background 0.15s;
  }
  .focus-main .splitter:hover,
  .focus-main .splitter:active {
    background: var(--cortex-primary);
  }
  .focus-main .preview-pane-wrap {
    flex: 0 1 var(--preview-pane-width, 420px);
    min-width: 180px;
    max-width: 900px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    position: relative;
    background: var(--cortex-card-bg);
    border-radius: var(--cortex-radius-lg);
    border: 1px solid var(--cortex-border-muted);
  }
  .focus-main .preview-close {
    position: absolute;
    top: 6px;
    right: 8px;
    z-index: var(--cortex-z-base);
    width: 26px;
    height: 26px;
    border: 1px solid var(--cortex-border);
    background: var(--cortex-surface);
    color: var(--cortex-text-muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  .focus-main .preview-close:hover {
    background: var(--cortex-primary-soft);
    color: var(--cortex-primary);
    border-color: var(--cortex-primary);
  }
  .focus-main .not-indexed-hint {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--cortex-surface-muted);
    border-radius: var(--cortex-radius-md);
    color: var(--cortex-text-muted);
    padding: var(--cortex-space-6);
    margin: var(--cortex-space-3);
    text-align: center;
  }
  /* 移动端：桌面 splitter / preview-pane-wrap 隐藏 */
  @media (max-width: 1023px) {
    .focus-main .splitter,
    .focus-main .preview-pane-wrap,
    .focus-main .desktop-only {
      display: none;
    }
    /* 移动端输入框贴近屏幕左右（原 space-6=24px 留白偏宽）；
       initial 态 .input-row 与 focus 态 .input-bar 同步收紧，保证两态等宽 */
    .input-row,
    .input-bar { padding-left: var(--cortex-space-2); padding-right: var(--cortex-space-2); }
    /* 移动端对话框占满屏幕宽度，与 files-view 决议一致 */
    dialog {
      width: 100vw;
      max-width: 100vw;
      max-height: calc(100vh - 16px);
      border-radius: var(--cortex-radius-md);
    }
    dialog > * { padding: var(--cortex-space-4); }
  }
  /* 技能选择对话框宿主 chrome（Meta 平铺浮层：hairline 边框 + 24px 圆角 + level-2 阴影），
     与 files-view/diary-view 的 dialog 规格一致；此前无样式，吃的是浏览器默认外观 */
  dialog {
    border: 1px solid var(--cortex-border);
    border-radius: var(--cortex-radius-xl);
    box-sizing: border-box;
    padding: 0;
    background: var(--cortex-surface);
    box-shadow: var(--cortex-shadow-lg);
    max-width: 90vw;
  }
  dialog::backdrop { background: rgba(0, 0, 0, 0.3); }
  dialog > * { display: block; padding: var(--cortex-space-6); }
  /* 移动端预览 overlay。**不得设 z-index**（2026-09-29 修复：对话页
     参考资料 PDF 在移动浏览器灰屏的真根因）——z-index 会创建层叠
     上下文，把 document.body 下 z-index:1 的 pdf-viewer portal 整个
     压在下面（canvas 画好但被挡死）。去掉后：overlay（absolute 定位）
     仍画在静态消息流之上（背景遮罩语义不变），而 portal（定位 + z:1）
     反超 overlay（z:auto）显露 canvas；toc-drawer（z:30）等内部浮层
     在根上下文直接比较，仍正确盖住 canvas。 */
  .preview-overlay {
    position: absolute;
    inset: 0;
    background: var(--cortex-card-bg);
    display: flex;
    flex-direction: column;
  }
  /* 移动端预览打开时隐藏对话顶栏：focus-header 因 backdrop-filter 需
     z-index:10，会浮在 z:auto 的 preview-overlay 之上（预览界面露出
     顶栏的「新会话」返回钮——点了回 initial 而非关闭预览，2026-09-29
     修复）。预览层的返回由 preview-pane 自带 mobile-header 承担。 */
  @media (max-width: 1023px) {
    .focus-body.has-preview > focus-header {
      display: none;
    }
  }
  @media (min-width: 1024px) {
    .preview-overlay {
      display: none;
    }
  }
  @media (min-width: 1024px) {
    /* 桌面端：居中列布局，避免全宽拉伸。initial 与 focus 两态共用同一
       列宽（--content-max-width），保证发送首条消息切换状态时输入框不跳动 */
    .initial-stack {
      max-width: var(--content-max-width, 1080px);
      margin: 0 auto;
      width: 100%;
    }
    .input-bar {
      max-width: var(--content-max-width, 1080px);
      margin: 0 auto;
      width: 100%;
    }
  }
`;
