# frontend/src 通用组件层缺失（设计系统缺位）反模式审计台账

> 审计日期：2026-11-17｜点名范围：`doclens/web_v2/frontend/src/`（components 80 个 .ts / utils 44 个 .ts / styles 5 个 .ts）｜机械扫描：全仓（行数 top、常量/样式定义多处计数、`<dialog>`/showModal 宿主分布、`navigator.clipboard` 调用点、`:empty`/`.badge`/spinner 配方分布、prefers-reduced-motion 覆盖、复制反馈时长分布）
>
> 本台账是 `antipatterns/frontend-components.md`（2026-11-15，组件层清理）的**后续批次**，聚焦一个此前未立案的系统性问题：**跨域机制类通用件缺失导致的重复真相源**。上一批抽的是「同构组件」（可参数化的近重复对），本批抽的是「同构机制」（加载/空态/外壳/表单/剪贴板等无业务语义的模式）。

## 一、判据声明

- 附件 `references/frontend.md`（Lit 组件工程节 + 语义 HTML/可访问性节 + 构建节；复检 2026-11-17：以「Lit web components anti-patterns / design system duplication」检索复检，检索结果无高相关权威条目（返回学术论文与泛论），**结论：附件清单与 Lit 官方文档实践一致，无需更新**；本批新增形态见「三、新型态」节）
- 附件 `references/general.md`（前端模块层 + 组件层 + 功能层 + 数据与契约层，全节装载作兜底归类）
- 仓库纪律文档附加判据：
  - `doclens/web_v2/frontend/docs/DESIGN.md`（组件样式一律走 tokens.css 变量，禁硬编码颜色；z-index 五档分层）
  - `CLAUDE.md` 前端两层新结构（「样式层公共块」「组件只留视图与装配」「组件规模红线」）
- 执行方式：主代理全量 grep 骨架 + 定点精读（styles/ 5 个公共块全文、17 个 `.empty` 定义点、8 个 spinner 配方点、9 个 clipboard 调用点、全部 `<dialog>` 宿主）

## 二、发现条目

### AP-1 spinner 配方 8 处复制 + 4 处漏 `prefers-reduced-motion` [P2] [status: done(见执行记录)]
- **形态**：Copy-and-Paste Programming（样式级）+ 缺失可访问性降级
- **证据**：同一配方（`border: Npx solid var(--cortex-border)` + `border-top-color: var(--cortex-primary)` + `border-radius: 50%` + `@keyframes X { to { transform: rotate(360deg) } }`）在 8 处各自定义，**keyframes 名各不相同**：
  - `app.ts:92-99`（`swap-spin`，32px/3px/0.9s）
  - `components/compact-confirm-dialog.ts:59-67`（`compact-spin`，28px/3px/0.8s）
  - `components/download-overlay.ts:23-36`（`cortex-download-spin`，40px/4px/0.8s）
  - `components/file-list.ts:130-138`（`cortex-upload-spin`，12px/2px，工具栏按钮 ::after）
  - `components/file-list.ts:248-257`（同名 `cortex-upload-spin`，14px/2px，移动端 ::before）
  - `components/pull-refresh-indicator.ts:60-75`（`ptr-spin`）
  - `components/search-results.ts:44-54`（`cortex-spin`，14px/2px，`.loading::after`）
  - `views/files-view.ts:281-296`（`cortex-upload-overlay-spin`，上传遮罩）
  - 变体：`components/chat-tool-trace.ts:255-263`（`spin`，配色相反：`border: 2px solid var(--cortex-primary)` + `border-top-color: transparent`）
  - **reduced-motion 覆盖只有 4/9**：`file-list`（:138）、`pull-refresh-indicator`（:73）、`download-overlay`（:36）、`files-view`（:294）有；`app.ts`（工作目录切换遮罩）、`compact-confirm-dialog`（压缩中）、`search-results`（加载态）、`chat-tool-trace`（工具运行中）、`file-list` 移动端那处（:248 同文件首处已覆盖，:257 那处未单独覆盖）**没有**。
- **风险**：① 旋转动画对前庭功能障碍用户是健康风险（WCAG 2.3.3 Animation from Interactions），5 处无降级；② 改 spinner 视觉（边框粗细/配色/时长）要改 9 处，keyframes 名已各自漂移（`spin`/`ptr-spin`/`cortex-spin`/`compact-spin`/`swap-spin`/`cortex-download-spin`/`cortex-upload-spin`/`cortex-upload-overlay-spin` 共 8 个名字指同一动画）；③ `chat-tool-trace` 的配色反向版本说明「配方无单一真相源」已导致行为分裂。
- **修复方案**：新增 `components/spinner.ts`（`<c-spinner>`：`size` / `variant`（track=border+primary顶 / primary=primary+透明顶）/ `label` slot）+ `styles/spinner-styles.ts`（唯一一份 `@keyframes cortex-spin`）。9 个消费点替换为该组件或该样式块；`prefers-reduced-motion: reduce` 降级写进公共块一次（全量覆盖）。**不改 DOM 结构**（除 file-list 两处伪元素需改为真实 `<c-spinner>` 或保留伪元素但引用公共 keyframes 名）。
- **回归验证**：`npm run test -- tests/download-overlay.spec.ts tests/search-flow.spec.ts tests/files-flow.spec.ts` + `npm run build`；人工核对 9 处视觉一致 + 系统开启「减少动态效果」后均静止。
- **执行结果**：新增 `src/styles/spinner-styles.ts`（唯一一份 `@keyframes cortex-spin` + `prefers-reduced-motion` 降级）与 `src/components/spinner.ts`（`<c-spinner size/border/duration/variant/label>`，尺寸走 CSS 变量）。8 个配方点全部改为消费公共件：app.ts 切换遮罩（32px/3px/0.9s）、compact-confirm-dialog 压缩中（28px/3px）、download-overlay 下载中（40px/4px）、files-view 上传遮罩（40px/4px）、search-results 加载中（14px，伪元素 → 真实元素）、pull-refresh-indicator 刷新中（14px，`.ring` span → `<c-spinner>`）、chat-tool-trace 工具运行中（12px，`variant="reverse"` 保留配色反向语义）、file-list 上传中两处（12px 桌面 / 14px 移动端，伪元素 → 真实元素）。**reduced-motion 覆盖 4/9 → 9/9**（缺失的 5 处：app.ts、compact-confirm-dialog、search-results、chat-tool-trace、file-list 移动端）。keyframes 名 8 个 → 1 个。新增 `tests/spinner.spec.ts`（7 例：变量注入/尺寸覆写/reverse 变体/aria 语义/公共块含降级/**全仓无第二处 `@keyframes *spin*` 守卫**/**全仓无圆环+rotate 配方残留守卫**）；`tests/pull-to-refresh.spec.ts` 原断言锁死旧 keyframes 名 `ptr-spin`，改为断言「本组件不再自带 keyframes + 渲染 `<c-spinner>`」并保留 pointer-events 与 reduced-motion 两条实质守卫（测试固化错误：断言锁定实现细节，随实现迁移同步更新）。回归：前端全量 1145 测试通过（114 文件）+ `npm run build` 通过 + `tests/test_architecture.py` 9 通过。

### AP-2 `.empty` 空态样式 17 处定义且形态分裂 [P2] [status: pending]
- **形态**：Copy-and-Paste Programming（样式级）+ 口径分裂
- **证据**：`.empty { }` 定义 17 处，**内边距/字号/色值/对齐各不相同**：
  - `components/backup-dialog.ts:137`（fs-sm + muted + `space-6 0` + 居中）
  - `components/bookmark-drawer.ts:57`（`space-6 space-4` + fs-sm + muted）
  - `components/chat-stream.ts:28`（缩进不同——在嵌套规则内）
  - `components/deep-read-list.ts:153`（flex 居中列 + 额外子样式）
  - `components/diary-review-panel.ts:89`（居中 + muted + `space-8, 32px` 硬编码）
  - `components/diff-viewer.ts:144`（flex 居中）
  - `components/file-list.ts:387`（`space-8` 居中 + **subtle**）
  - `components/file-search-results.ts:140`（flex 居中列）
  - `components/git-changes-list.ts:159`（flex 居中列）
  - `components/history-list.ts:99`（subtle + fs-sm + 居中）
  - `components/md-viewer.ts:448`（subtle + 居中 + `space-6`）
  - `components/preview-pane.ts:250`
  - `components/search-results.ts:30`（subtle + **fs-base** + `space-8`）
  - `components/session-info-dialog.ts:54`
  - `components/skill-toolbox-dialog.ts:174`
  - `components/watch-changes-dialog.ts:42`
  - `components/workdir-switch-dialog.ts:62`（**单行压缩写法**，padding `4px 0`）
  - 漂移实证：`diary-review-panel.ts:89` 用硬编码 `32px` 代替 `--cortex-space-8`（违反 DESIGN.md「只用 tokens」纪律）；`search-results` 用 fs-base 而 `history-list`/`backup-dialog` 用 fs-sm——同一「暂无内容」提示两种字号。
- **风险**：① 「暂无内容 / 加载中 / 出错」三类状态提示视觉不统一，跨页面观感割裂；② 硬编码 `32px` 是 DESIGN.md 红线（`tests/content-width.spec.ts` 断言死 token/死样式不得复活）；③ 新增空态继续复制第 18 份。
- **修复方案**：新增 `components/empty-state.ts`（`<c-empty-state>`：`variant="empty|loading|error"`、`message`、`hint` slot、可选 `icon`）+ `styles/empty-state-styles.ts` 公共样式块（供内联用法）。17 处收敛为 1 个组件 + 1 个样式块；差异通过 `variant`/类名覆盖表达，**不做强行归一**（`deep-read-list`/`git-changes-list` 的 flex 居中列形态由组件自身默认布局承载）。
- **回归验证**：`npm run test -- tests/file-list.spec.ts tests/history-list.spec.ts tests/preview-pane.spec.ts tests/md-viewer.spec.ts` + `npm run build`。

### AP-3 对话框外壳两族并存 + 34 处 `<dialog>` 宿主各自管理 [P2] [status: pending]
- **形态**：Copy-and-Paste Programming（结构级）+ Action at a Distance
- **证据**：
  - **族 A**（自管 scrim 全屏外壳：`:host` fixed + `:host([open])` 遮罩 + `.scrim` + 自绘 dialog 卡片 + `.head`/`.close-btn`）：`styles/dialog-frame.ts`（`dialogFrameStyles`）被 about-dialog / backup-dialog / control-panel-dialog / watch-changes-dialog / workdir-switch-dialog 五件使用。
  - **族 B**（原生 `<dialog>` + `showModal()` 进 top-layer）：`views/chat-dialogs.ts` 10 处、`views/files-view.ts` 9 处、`views/diary-view.ts` 1 处、`components/translate-dialog.ts:290`、`components/chat-message.ts:635`（图片预览）。
  - 两族并非「等价风格」：族 B 走 top-layer，**不受 z-index 约束**（`styles/tokens.css:32` 注释明示）；族 A 走 `z-index: var(--cortex-z-toast)` 自绘遮罩——遇到 PDF portal 等高 z-index 层会被压住（`preview-pane.ts:382` 注释自认「showModal：top layer 全屏居中——不被 PDF portal 遮挡」）。
  - **34 处 `<dialog>` 宿主各自手动 `showModal()`**：`views/chat-view.ts:509`（遍历所有 dialog）、`views/files-view.ts:797`（只取第一个 `querySelector("dialog")`——**单选**，同页多 dialog 时只会模态化第一个）、`views/diary-view.ts:151`、`components/translate-dialog.ts:330`、`components/chat-message.ts:374`、`utils/skill-toolbox.ts:53`。
  - 漂移实证：`views/files-view.ts:797` 用 `querySelector("dialog")` 单选，而 `views/chat-view.ts:509` 用 `querySelectorAll` 遍历——同机制两种写法；`components/about-dialog.ts:256` 写 `<dialog>`（无 open）而 `backup-dialog.ts:227` 写 `<dialog open>`——靠族 A 的 `display:flex` 级联巧合显示（`antipatterns/frontend-components.md` AP-27 已记此漂移，本条为同一问题的结构面证据）。
- **风险**：① 「哪个对话框是模态」这件事分散在 6 个宿主文件里，`files-view` 的单选实现是潜在 bug（多 dialog 页）；② 族 A 族 B 视觉不一致（遮罩实现不同），改对话框外壳要分两处改；③ 每次新增对话框都要复制「showModal 时机 + ESC 处理」样板。
- **修复方案**：新增 `components/dialog-shell.ts`（`<c-dialog>`：内部渲染原生 `<dialog>`，负责 `showModal()` 时机、ESC/`cancel` 事件转发、`::backdrop`、移动端撑满、内容 slot）。34 处宿主改用 `<c-dialog>`（外壳与内容分离，内容仍由各领域组件提供）。**族 A 五件迁移到族 B 路径**（top-layer 是正解，z-index 治不了 portal 遮挡），但 `dialogFrameStyles` 保留为过渡期样式层。
- **回归验证**：`npm run test -- tests/about-dialog.spec.ts tests/control-panel-dialog.spec.ts tests/city-dialog.spec.ts tests/delete-dialog.spec.ts tests/compact-confirm-dialog.spec.ts tests/chat-view-dialogs.spec.ts` + `npm run build` + 人工逐个开合全部对话框（含 ESC、遮罩点击、移动端尺寸）。

### AP-4 确认类对话框 6 件外壳近重复，无统一基类 [P2] [status: pending]
- **形态**：结构级近重复（可合并）—— 上一批 AP-28/AP-29/AP-35 只处理了「单输入框五件套」与「两两近似对」，**六个确认框整体仍无基类**
- **证据**：6 件确认框共用同一外壳骨架（h2 图标标题 → 说明段 → `.note` 提示块 → `.detail` → `.warn` 危险警示 → `.anchor` 锚点摘录 → 按钮排 → 提交中禁用 → 错误行）：
  - `components/compact-confirm-dialog.ts`（四态机 confirm/running/done/error，:105-248）
  - `components/fork-confirm-dialog.ts`（静态单态，:38-66）
  - `components/import-confirm-dialog.ts`（三态 confirm/exists/busy，:80-152）
  - `components/turn-delete-dialog.ts`（:85-118）
  - `components/rewind-dialog.ts`（:98-241，含文件三态清单）
  - `components/delete-dialog.ts`（:70-125，额外：异步 stats 加载态 + 勾选门控）
  - 样式层已分裂成三套按钮语义：`styles/button-styles.ts` 的 `buttonBaseStyles`（primary=黑 pill）/ `confirmButtonStyles`（primary=文字色反相 + 略小字号）/ `utils/dialog-styles.ts` 的 `dialogSlotStyles`（button 圆角 pill + 8px 18px）——同一「主按钮」三种视觉，取决于用哪套样式块。
  - 上一批结论反证（`frontend-components.md` 反证归档）：「import 三态机+双确认语义、compact 四态机+剪贴板双轨、delete 直读 store+异步 stats+checkbox 门控——强行合一属 DRY Misuse」。**本条不是主张把六件合成一件**，而是主张抽「外壳基类 + 钩子」，与已有 `components/input-dialog-base.ts`（AP-28 已 done，抽象出 `inputLabel`/`validate`/`submitDetail` 三个钩子）同一范式。
- **风险**：① 新增确认框必然再复制一遍 h2+note+detail+warn+按钮排；② 主按钮视觉三套并存（`buttonBaseStyles` vs `confirmButtonStyles` vs `dialogSlotStyles`），同类对话框主键外观不一致；③ 提交中禁用/错误回填的行为各写一遍（`turn-delete` 已因双真相源被 AP-36 修过一次，`rewind` 仍是纯内部 `_submitting` 失败不复位）。
- **修复方案**：新增 `components/confirm-dialog-base.ts`（抽象基类，对标 `InputDialogBase`）：`title`/`icon`/`body` slot/`note`/`warn`/`danger` 按钮语义/`submitting`/`errorMessage`/ESC-cancel 协议；多态内容用模板方法 `renderBody()` 供子类覆写。**各件内容结构保留在子类**（不强行统一 compact 四态机与 import 三态机）。样式层把 `buttonBaseStyles`/`confirmButtonStyles`/`dialogSlotStyles` 的按钮定义归一为一套 token 化按钮 + 单一 `.actions` 类名（`.actions`/`.buttons` 两套类名现由 `styles/button-styles.ts:99-127` 与 `utils/dialog-styles.ts:22-47` 各定义一次，同名不同值）。
- **回归验证**：`npm run test -- tests/compact-confirm-dialog.spec.ts tests/turn-delete-dialog.spec.ts tests/delete-dialog.spec.ts tests/city-dialog.spec.ts` + `npm run build` + 人工比对六框主按钮视觉一致。

### AP-5 剪贴板写入 9 处各写一份 + 降级配方只有 2 处实现 [P2] [status: done(见执行记录)]
- **形态**：Copy-and-Paste Programming + Error Hiding（部分变体）
- **证据**：`navigator.clipboard.writeText` 调用 9 处，各写各的：
  - `components/chat-message.ts:520`（await + catch → 冒泡 `copy-failed`）
  - `components/history-item.ts:196`（await + catch → 冒泡 `copy-failed`）
  - `components/session-info-dialog.ts:148`（await + catch → 冒泡 `copy-failed`）
  - `components/chat-tool-trace.ts:420`（await + **execCommand 降级**）
  - `components/compact-confirm-dialog.ts:137`（await + **execCommand 降级**）
  - `components/md-viewer.ts:821`（代码块复制，`.then().catch(() => {})` —— **静默吞错**）
  - `components/md-viewer.ts:1542`（全文复制，`.catch(() => {})` —— **静默吞错**）
  - `components/preview-pane.ts:1777`（then 双分支 → 派发 `path-copied` {ok}）
  - `views/files-view.ts:975`（then 双分支 → toast 成功/失败）
  - **降级配方（`navigator.clipboard` 不可用时用隐藏 textarea + `execCommand`）只在 2 处实现**：`chat-tool-trace.ts:423-434`、`compact-confirm-dialog.ts:141-151` —— 两份几乎逐行相同。**其余 7 处无降级**：非安全上下文（HTTP 非 localhost）或权限被拒时，7 处直接失败，其中 2 处（md-viewer 两处）**完全静默**（`.catch(() => {})`，用户点复制无任何反馈）。
  - **反馈时长分裂**：1500ms（chat-message:523 / history-item:199 / session-info-dialog:151 / md-viewer:823 / md-viewer:1544）vs 2000ms（chat-tool-trace:345 / compact-confirm-dialog:158）——同一「已复制」提示两种持续时间。
  - **定时器清理不对称**：`chat-message.ts:394`、`history-item.ts:272` 有 `disconnectedCallback` 清 `_copyTimer`；`session-info-dialog.ts:151` **无**（组件无 disconnectedCallback）；`md-viewer.ts:1544` 的 `setTimeout` 无句柄无清理；`compact-confirm-dialog.ts:158` 的 `setTimeout` 无句柄无清理。
- **风险**：① 「复制」在 WebView/HTTP 部署下大概率失败（原生下载同款问题已在 `download-overlay` 注释承认），7 处无降级 = 用户可见功能缺失，其中 md-viewer 两处连失败提示都没有；② 定时器未清理 = 卸载后回调操作已卸载 @state（与 AP-11/AP-41 同型）；③ 反馈时长/降级/事件名三种契约各写各的。
- **修复方案**：新增 `utils/clipboard.ts`：`copyText(text): Promise<boolean>`（`navigator.clipboard` → 隐藏 textarea + `execCommand` → 全失败返回 false）+ `COPY_FEEDBACK_MS = 1500` 常量 + 可选 `onCopied` 复位回调。9 处改调此单一入口；`md-viewer` 两处的静默 catch 补失败反馈（沿用宿主 `copy-failed` 协议）；`session-info-dialog`/`compact-confirm-dialog`/`md-viewer` 补 timer 句柄化 + `disconnectedCallback` 清理。
- **回归验证**：`npm run test -- tests/chat-message.spec.ts tests/chat-tool-trace.spec.ts tests/md-viewer.spec.ts tests/history-list.spec.ts` + `npm run build`；人工在非安全上下文（HTTP 访问）验证复制降级可用。
- **执行结果**：新增 `src/utils/clipboard.ts`（`copyText()`：clipboard API → 隐藏 textarea + execCommand 降级 → false；`COPY_FEEDBACK_MS = 1500` 唯一口径；`createCopiedFlash()`：置位/复位/重置计时/dispose 卸载清理全套状态机）。9 处调用点全部迁移：chat-message / history-item / session-info-dialog（`copy-failed` 协议不变）、chat-tool-trace / compact-confirm-dialog（双份降级配方收编）、md-viewer 代码块 + 全文复制（**两处静默吞错修复**：代码块失败显示「复制失败」、全文失败冒泡 `copy-failed` 由宿主 toast——需宿主监听确认，见下「执行期间发现」）、preview-pane（`path-copied {ok}` 协议不变）、files-view（toast 双分支不变）。降级覆盖 2/9 → **9/9**；反馈时长 1500/2000 两派 → 1500 唯一；timer 清理补齐 session-info-dialog / compact-confirm-dialog / md-viewer 三处（新建 disconnectedCallback 或并入既有）。**执行期间发现**：① jsdom `execCommand` 是「未实现但不抛错」的 no-op 返回 false——降级路径须尊重返回值（初版无条件 return true 被测试抓住）；② md-viewer 全文复制失败冒泡 `copy-failed`，但 preview-pane 宿主链上无监听（chat-view 的 `@copy-failed` 绑在 chat-message 上）——失败反馈在预览页不可见，属 AP-2 空态/错误反馈域的邻接问题，不扩散（护栏 3），留 AP-2 处理时一并接线。回归：新增 `tests/clipboard.spec.ts` 8 例（主路径/降级/降级返回 false/全失败/flash 重置计时/dispose 幂等/时长唯一/「全仓无直调 navigator.clipboard.writeText」守卫）；`tests/session-info-dialog.spec.ts` 时序修正（fake timers 下 await 链补一拍 waitFor）。前端全量 1153 测试通过（115 文件）+ `npm run build` 通过 + `tests/test_architecture.py` 9 通过。

### AP-6 表单控件样式 4 套并存（input/select/textarea/checkbox）[P3] [status: pending]
- **形态**：Copy-and-Paste Programming（样式级）+ 口径分裂
- **证据**：`<select>` 4 处、`<textarea>` 6 处、`type="checkbox"` 8 处，各自定义样式：
  - `.input, .select`：`components/model-presets-section.ts:212-220`（padding 8px 10px / bg `--cortex-bg`）、`components/mcp-servers-section.ts:262-271`（同 8px 10px / bg `--cortex-bg`）、`views/settings-view.ts:358-366`（**padding 9px 12px / bg `--cortex-surface`** —— 同一控件两套内边距与两种背景色 token）
  - `.textarea`：`components/mcp-servers-section.ts:273-277`（min-height 64px + resize vertical + mono 字体）
  - `components/translate-dialog.ts:71-79`：`select, input[type="text"]` 合并规则，**padding 用 `var(--cortex-space-2)`、圆角 `--cortex-radius-sm`、bg `--cortex-surface`** —— 与前三者又不同
  - `components/input-dialog-base.ts:20-34`（单输入框基类）：padding 8px / 圆角 `--cortex-radius-md` / bg 无指定 / 自带 `invalid` 态与 focus ring
  - `components/reparse-dialog.ts:176`、`components/skill-run-dialog.ts:112`、`components/interject-dialog.ts:56`、`components/diary-record-panel.ts:498`：textarea 各自样式
  - checkbox：无公共样式，8 处各自用 `accent-color: var(--cortex-primary)`（`file-row.ts:33`）或不设（`delete-dialog.ts:114`、`move-dialog.ts:92`、`rewind-dialog.ts:185`、`mcp-servers-section.ts:537`、`skills-section.ts:484`、`file-list.ts:895/975`、`settings-view.ts:1008/1053`）
- **风险**：① 设置页同一表单控件（select）三种内边距 + 两种背景 token，肉眼可见的「不像一套」；② `<label for>` 关联基本没有——`delete-dialog.ts:110-119` 的 checkbox 用 `<label class="opt">` 包住（隐式关联，可接受），但 `mcp-servers-section.ts:537`/`skills-section.ts:484`/`rewind-dialog.ts:185` 的 checkbox **无 label 包裹或无 aria-label**（可访问性高频违规，frontend.md 语义 HTML 节判据）；③ 改控件视觉要改 4+ 套。
- **修复方案**：新增 `styles/form-styles.ts`（label / input / select / textarea / checkbox 五件套，token 化）+ 可选 `components/form-field.ts`（`<c-field label=… hint=… error=…>` 包 label+控件+错误文案）；`.input,.select,.textarea` 的三套变体收敛为一套（背景统一走 `--cortex-surface`）。同步补齐缺失的 label/aria-label。
- **回归验证**：`npm run test -- tests/settings-view.spec.ts tests/mcp-servers-section.spec.ts tests/model-presets-section.spec.ts` + `npm run build`。

### AP-7 `.badge` 徽标样式 8 处定义 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming（样式级）
- **证据**：`.badge { }` 定义 8 处：`components/ask-card.ts:114`、`components/file-card.ts:56`、`components/file-row.ts:55`、`components/git-changes-list.ts:123`、`components/mcp-servers-section.ts:144`、`components/model-presets-section.ts:190`、`components/password-section.ts:51`、`components/skills-section.ts:93`。共同形态为「小圆角底色 + 小字号」，但圆角（`--cortex-radius-sm` vs `--cortex-radius-full`）、底色（`--cortex-primary-soft` vs `--cortex-surface-muted`）、内边距（1px 6px vs 2px 8px）各异。
- **风险**：纯组织问题，同类徽标视觉不统一；改徽标样式要改 8 处。**DRY Misuse 边界**：徽标语义色有差异（primary / neutral / danger），可参数化但不宜强并为单一组件。
- **修复方案**：新增 `styles/badge-styles.ts`（`.badge` 基础 + `.badge.primary`/`.badge.neutral`/`.badge.danger` 变体）供 8 处 import；或新增 `<c-badge tone="primary|neutral|danger">`。**只归一形状与内边距，色值走 variant**。
- **回归验证**：`npm run build` + `npm run test -- tests/file-card.spec.ts tests/file-row.spec.ts tests/ask-card.spec.ts`。

## 三、新型态

- **「机制缺失型复制」**（本台账新增）：与上一批的「同构组件近重复」不同形态——此处的重复**不是**两个业务组件相似，而是**同一套无业务语义的交互机制**（加载指示 / 空态 / 对话框外壳 / 确认框骨架 / 剪贴板写入 / 表单控件）在 N 个业务组件里各自实现一遍。检测线索：① 同一 CSS 配方/同一 API 调用序列在 ≥4 个文件出现；② 各处实现细节已漂移（配色反向、字号两版、keyframe 名各异、reduced-motion 覆盖不齐）；③ 抽出的公共件**不含任何业务字段**——可安全跨域复用。首次实证：本台账。
- **「样式块分叉为多套视觉」**（本台账新增）：同一语义控件（主按钮）因消费方选了不同样式块而呈现不同视觉——`buttonBaseStyles`（黑 pill）/ `confirmButtonStyles`（文字色反相）/ `dialogSlotStyles`（pill + 8px 18px）三套并存，`button.primary` 在不同对话框里长得不一样。检测线索：同名 class（`button.primary` / `.actions` / `.buttons`）在不同样式块中重复定义且值不同；Lit `static styles` 数组拼接顺序成为「视觉真相源」。首次实证：本台账 AP-4。

## 四、反证归档（疑似重复但实为有意设计——不立案）

| 质疑 | 结论 |
|---|---|
| `md-viewer`/`pdf-viewer`/`image-viewer`/`code-viewer`/`diff-viewer`/`cm-editor` 应抽「通用预览器」？ | 否——各域渲染内核与交互模型完整，抽出必然造出万能组件（DRY Misuse）。`diff-viewer` 已抽出 `parseUnifiedDiff` 纯函数（AP-37 done），是正确粒度 |
| `file-card`/`file-row`/`history-item`/`tree-node`/`git-changes-list` 应抽「通用列表项」？ | 否——数据形状与高亮坐标系不同（`file-card.ts:144` 有坐标系安全绑定注释），合并即破坏 |
| `chat-message`/`chat-stream`/`chat-tool-trace`/`ask-card` 应抽「对话域基类」？ | 否——耦合 `chat-view` 状态机，边界为对话域内部 |
| 五个 section（model-presets/mcp-servers/search-presets/skills/password）应合成「设置页 section 框架」？ | 否——字段结构各异；已抽 `settingsSectionStyles` + `ToastFlashMixin`（上一批 AP-22 done），再合即 DRY Misuse |
| `styles/shared-styles.ts` 的 `sharedStylesContract` 是死代码？ | 否——`tests/content-width.spec.ts` 按字面匹配断言「已删除样式不得复活」，文件在即断言才有意义 |
| 9 处 spinner 配色反向（`chat-tool-trace`）是刻意区分？ | 部分——配色相反有语义（工具运行中=主题色环），但**动画时长/边框粗细**无理由分化；判为配方分裂而非刻意设计 |
| `dialogFrameStyles`（族 A）应立即废弃？ | 否——它是上一批 AP-27 的成果（5 件在用），本条只主张族 A 迁移到族 B 路径，不主张直接删样式块 |

## 五、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-11-17 | 审计（无令，仅台账） | AP-1~AP-7 | 台账成文，7 条全部 pending；未改任何源码文件 |
| 2026-11-17 | 批 1（公共件·加载指示） | AP-1 | 新增 `src/styles/spinner-styles.ts`（唯一 `@keyframes cortex-spin` + reduced-motion 降级）+ `src/components/spinner.ts`（`<c-spinner>` size/border/duration/variant/label）；8 个配方点全部改消费公共件（app.ts / compact-confirm-dialog / download-overlay / files-view / search-results / pull-refresh-indicator / chat-tool-trace / file-list×2）；keyframes 名 8→1，reduced-motion 覆盖 4/9→9/9。新增 `tests/spinner.spec.ts` 7 例（含「全仓无第二处 spin keyframes」「全仓无圆环+rotate 配方」两条守卫）；`tests/pull-to-refresh.spec.ts` 断言随实现迁移更新（不再锁死 `ptr-spin` 名，改验公共件消费）。回归：前端全量 1145 测试通过（114 文件）+ `npm run build` 通过 + `tests/test_architecture.py` 9 通过 |
| 2026-11-17 | 批 2（公共件·剪贴板） | AP-5 | 新增 `src/utils/clipboard.ts`（copyText 含 execCommand 降级 + COPY_FEEDBACK_MS=1500 + createCopiedFlash 状态机）；9 处调用点全部迁移，降级覆盖 2/9→9/9，md-viewer 两处静默吞错修复（代码块失败显示「复制失败」、全文失败冒泡 copy-failed），timer 清理补齐 3 处。jsdom execCommand no-op 返回 false 的坑已尊重（测试抓住）。新增 `tests/clipboard.spec.ts` 8 例（含「全仓无直调 navigator.clipboard.writeText」守卫）；`tests/session-info-dialog.spec.ts` fake-timers 时序修正。遗留：md-viewer copy-failed 在预览页宿主链无监听，归 AP-2 一并接线。回归：前端全量 1153 测试通过（115 文件）+ `npm run build` 通过 + `tests/test_architecture.py` 9 通过 |
