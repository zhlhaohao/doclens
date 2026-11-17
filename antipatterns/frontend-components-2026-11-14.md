# 前端自定义组件 反模式审计台账

> 审计日期：2026-11-14｜点名范围：`doclens/web_v2/frontend/src/components/`（77 文件，约 25.6k 行）｜机械扫描：全仓（跨文件私有 import、`as any` 密度、shadowRoot 穿透、z-index 散布）
> 审计焦点：**组件功能划分是否合理、是否存在多余或重复的组件**

## 一、判据声明

- 附件 `references/frontend.md`（Lit 组件工程节 + 原生 H5 节命中；复检 2026-10-20 来源清单，形态仍现行有效，未更新）
- 附件 `references/general.md`（前端模块层 + 组件层 + 功能层全节装载）
- 仓库纪律：CLAUDE.md 前端标尺（`web_v2/frontend/docs/DESIGN.md` META 设计系统、dialog 用原生 `<dialog>` + `showModal()`）；组件内大量 ADR 编号注释（ADR-0010/0041/0043/0046/0049）作为反证判据
- 技术栈探测：Lit + Vite（`frontend/package.json`、`vite build` 产物入 `web_v2/static/`）

## 二、发现条目

### AP-1 列表加载骨架三连抄（deep-read-list / git-changes-list / pst-email-list）[P3] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：`deep-read-list.ts:181-260` vs `git-changes-list.ts:192-287` 结构级复制（connectedCallback→refresh、`_loading/_error/_data` try/catch/finally、`_onExitClick`/`_onRowClick`、header 四件套、render 四态三元、`.empty` 样式块）；`pst-email-list.ts:158-175` 第三份同款。已现漂移（git 版有 `sortChanges`，deep-read 版无）。
- **风险**：同构各自演化，修一处漏两处；新增列表功能（如空态改进）要改三处。
- **修复方案**：抽列表骨架基类或 headless controller（loading/error/empty/rows 四态 + refresh 契约），三组件改数据域注入。
- **回归验证**：`frontend/tests` 对应组件 spec + `npm run build`。

### AP-2 clipboard 复制配方 ≥5 份散抄 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：`chat-message.ts:521-535`、`chat-tool-trace.ts:397-421`、`compact-confirm-dialog.ts:164-187`、`history-item.ts:190`、`session-info-dialog.ts:157` 各写一份「writeText → 降级 execCommand → 复位」；已漂移（复位 1.5s vs 2s、有无降级分支不一）。`utils/sanitize.ts` 有统一工具先例而复制逻辑未抽象。
- **风险**：降级路径行为不一致；一处修 XSS/兼容性其余不跟。
- **修复方案**：入 `utils/`（如 `clipboard.ts`，含 copied 复位回调）。
- **回归验证**：`npm run test -- tests/*.spec.ts` 触及组件 + build。

### AP-3 确认框三胞胎 + `<dialog>` 宿主壳三份同构 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：`turn-delete-dialog.ts:60-84` / `fork-confirm-dialog.ts:39-65` / `compact-confirm-dialog.ts:55-77`——`.buttons` 布局、`button.primary` 样式、移动端 `column-reverse`、confirm/cancel 事件对三份复制仅文案不同；`chat-view.ts:2136-2196` 各包一层 `<dialog>` 壳也是同构三份。
- **风险**：低（小组件、ADR 注释背书各自存在）；但样式漂移成本已显。
- **修复方案**：抽 `confirm-dialog` 通用组件（title/message/danger + confirm/cancel），三处改传文案。
- **回归验证**：触及 spec + build。

### AP-4 settings 五分节 CRUD 基础设施五连抄 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming（同构度最高的一条）
- **证据**：`_setFlash` 四份（model:446 / mcp:415 / skills:402 / search:313）、`_errMsg` 三份、状态八件套 `_loading/_busy/_error/_toast/_confirmDeleteId/_formError/_editing` 三份、CRUD 六方法同构（search 17 方法中 13 个与 model 逐行同构，search 541 行 ≈ model 981 行的子集拷贝）、两段式删除确认三连抄、CSS 各 200-330 行复制（66 处类名匹配）、3000ms toast 魔数 4 份。
- **风险**：search-presets 注释自认复用 model 机制（ADR-0010）但只复用了后端，前端整文件拷贝；后端机制演进时前端五处漂移。
- **修复方案**：抽 section 基类（CRUD 流程 + flash + 确认删除 + 样式共享层），表单 schema 由子类声明。
- **回归验证**：`tests/test_skills_config.py` 对应后端 + 前端 settings 相关 spec + build。

### AP-5 mkdir-dialog ≈ new-file-dialog 近重复 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：全文 diff 仅 24 行（123 vs 125 行），实质差异只有「须带扩展名」校验（`new-file-dialog.ts:78`）与 placeholder；结构/事件协议/CSS 全同。
- **风险**：极低（两者已稳定）；属择机合并项。
- **修复方案**：合并为 `name-dialog`（kind: file|dir，扩展名校验开关）。
- **回归验证**：files-view 相关 spec + build。

### AP-6 rename-dialog vs session-rename-dialog CSS 逐字复制 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：`rename-dialog.ts:9-60` vs `session-rename-dialog.ts:9-60` 52 行 static styles 完全一致；结构同构仅校验规则不同（`session-rename-dialog.ts:5` 注释自认「外壳仿 rename-dialog」）。
- **风险**：低；session-rename 独立存在有后端 `SESSION_TITLE_MAX` 对齐背书（反证），但复制实体仍成立。
- **修复方案**：共享样式模块（`styles/dialog-form.ts`）或共享外壳组件。
- **回归验证**：触及 spec + build。

### AP-7 对话框三轨模态机制并存 [P2] [status: pending]
- **形态**：Lava Flow / 双轨基础设施
- **证据**：机制 A 自绘 scrim + `<dialog open>` 无 showModal（watch-changes:178、control-panel:201、workdir-switch:316、backup:293、about:322）；机制 B 宿主渲染 `<dialog>` + showModal（files-view.ts:1784 五连、chat-view.ts:1063）；机制 C 组件自带 `<dialog>` + updated 里 showModal（translate:356、reindex:196）。CLAUDE.md 明文「弹窗用原生 `<dialog>` + `showModal()`」，机制 A 违反仓库纪律。
- **风险**：ESC/焦点圈/层级行为三套不一致；无 showModal 的假模态焦点仍可达背景。
- **修复方案**：统一到机制 B/C（组件自带 dialog + showModal）；机制 A 五个组件逐个迁移。
- **回归验证**：触及 spec + build；手测 ESC/焦点行为。

### AP-8 dialog 样式样板 13-15 处逐字复制 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：`column-reverse` 移动端按钮块 13 个文件、`min-height: 44px` 15 个、`button.primary:hover` 10 个逐字相同；全部 23 个 dialog 直接 extends LitElement 无共享层。
- **风险**：样式调整需改十余处（与 AP-7 合并处理收益最大）。
- **修复方案**：抽 `styles/dialog.ts` 共享样式（actions/buttons/err/scrim）。
- **回归验证**：触及 spec + build。

### AP-9 formatSize 五处散抄，utils/format.ts 已有 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming / Duplicated Source of Truth
- **证据**：`file-row.ts:105`、`file-search-results.ts:28`、`git-changes-list.ts:39`、`backup-dialog.ts:275`、`delete-dialog.ts:102` 各写 KB/MB 换算；`utils/format.ts:4 formatBytes` 已存在。
- **风险**：单位口径漂移（判读：口径分裂温床）。
- **修复方案**：五处改 import formatBytes。
- **回归验证**：触及 spec + build。

### AP-10 导航项清单双份硬编码（activity-bar vs tab-bar）[P3] [status: pending]
- **形态**：Duplicated Source of Truth
- **证据**：`activity-bar.ts:67-71` 与 `tab-bar.ts:55-59` 各持同一份 `_items`（search/chat/diary/files 四项逐字相同）+ 相同 `diaryEnabled` 过滤 + 相同 `navigate` 派发；差异仅侧栏/底栏视觉。
- **风险**：新增视图需同步改两处，漏一处即导航不一致。
- **修复方案**：抽 `nav-items.ts` 单一真源（数组 + diaryEnabled 过滤函数）。
- **回归验证**：触及 spec + build。

### AP-11 bookmark-drawer 手工拷贝 toc-drawer 骨架 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：`bookmark-drawer.ts:23-157` vs `toc-drawer.ts:19-122`：`:host/overlay/panel/panel-header/close-btn/list` 样式逐行相同（仅 keyframes 前缀不同）、Esc 处理与挂卸同构；`bookmark-drawer.ts:9` 注释自认「复用 toc-drawer 的交互骨架」但是手工拷贝。
- **风险**：抽屉交互改动双处漂移。
- **修复方案**：抽 `drawer-shell` 组件（overlay+panel+esc+close 协议），两抽屉改内容注入。
- **回归验证**：触及 spec + build。

### AP-12 pagination 双实现并存 [P3] [status: pending]
- **形态**：Stovepipe / 重复组件
- **证据**：`history-list.ts:217-230` 自绘「上一页/页码/下一页」；`pagination-bar.ts` 是现成同类组件（search-view:685、pst-email-list:245 在用）。
- **风险**：分页交互/样式两套，改分页行为漏一处。
- **修复方案**：history-list 改用 pagination-bar。
- **回归验证**：触及 spec + build。

### AP-13 store.subscribe+requestUpdate 样板 4 份 [P3] [status: pending]
- **形态**：Smart/Dumb Component Imbalance（样板复制面）
- **证据**：`file-list.ts:433`、`file-tree.ts:35`、`tree-node.ts:49`、`file-search-results.ts:225` 手写同一订阅样板；`tree-node` 为递归叶子，N 节点 = N 份订阅。
- **风险**：样板漂移 + tree-node 递归订阅放大。
- **修复方案**：抽 Lit ReactiveController（如 `StoreSubscriptionController`）；tree-node 改由 file-tree 单订阅下传。
- **回归验证**：触及 spec + build。

### AP-14 preview-pane God Object（2226 行、18 props、约 65 方法、≥9 职责域）[P2] [status: pending]
- **形态**：God Object / Divergent Change
- **证据**：`preview-pane.ts` 聚合格式分派（render 2031-2213 四分支）、5 套字号/缩放 stepper（946/1071/1101/1134/1165）、代码主题（996）、全屏（1006）、滚动记忆（912-945）、关键词高亮条（1500-1608）、TOC（1990）、书签域全量含 addBookmark/removeBookmark 直调（1748-1852）、技能工具箱域含 fetchSkills/recordSkillUse（1854-1989）、移动端 header+more 菜单（1238-1350）、编辑模式（1352-1458）。code-viewer 拆出（2026-10-19）只减一个渲染分支，工具栏/抽屉/工具箱/书签各域仍集中。5 份 stepper 中 `_renderMdFontScaleGroup` vs `_renderCodeFontScaleGroup` 结构完全相同（模板内重计算伴生）。
- **风险**：任何工具栏调整都 touch 此文件；stepper 五份已现 inline style 复制漂移。
- **修复方案**：第一刀抽 `font-scale-stepper` 组件（统一 5 处）；第二刀把书签域、技能工具箱域下放独立子组件（事件上抛，preview-pane 只编排）。
- **回归验证**：`npm run test -- tests/preview-pane.spec.ts` + `npm run test:e2e:search` + build。

### AP-15 md-viewer render() 内同步 marked.parse + sanitizeHtml [P2] [status: pending]
- **形态**：模板内重计算（性能）
- **证据**：`md-viewer.ts:1516-1517` 单块分支每次 render 全量重解析；`keyword` @property 防抖后每次变更触发 render → 整篇 re-parse+sanitize。分页分支有 `_pagedChunks` 缓存（willUpdate 740），单块分支无等价缓存。
- **风险**：大文档 + 关键词高亮输入场景每次击键级触发全量解析；规模盲区判读：demo 短文无感，大 PDF 级 md 卡顿。
- **修复方案**：单块分支补与分页分支同款缓存（keyword 变化只做高亮、不 re-parse）。
- **回归验证**：`npm run test -- tests/md-viewer.spec.ts` + build。

### AP-16 input-box 上帝输入框（14 props、≥5 子功能域）[P2] [status: pending]
- **形态**：God Object / Interface Bloat + Dead Props
- **证据**：`input-box.ts:322-357` 14 props（chat 调用方用 8、search 用 2、diary 用 3——无单一调用方用全量）；聚合文本输入、模式选择、技能菜单、斜杠补全状态机（443-467）、附件/图片粘贴拖拽压缩（492-517）、缩略图行 ≥5 域。Dead props：`buttonIcon` 仅 search-view:648 一处、`iconAfter` 全库零调用方；`images-restored` 事件（:337 注释声称）全库不存在——幽灵契约。
- **风险**：改任一子功能都在 817 行内交叉影响；死契约误导维护。
- **修复方案**：拆 chat-input-box（附件+技能+斜杠）与 search-input-box（模式）；删 iconAfter、修注释。
- **回归验证**：`input-box.test.ts` + search/chat 相关 spec + build。

### AP-17 turn-delete-dialog 双真相源未闭环 [P1] [status: pending]
- **形态**：受控属性与内部 @state 双真相源
- **证据**：`turn-delete-dialog.ts:94-105` `submitting` prop 与 `_submittingLocal` state 双写靠 `_busy` getter 合并；失败路径回填 errorMessage 后**本地仍 true 且无复位路径**——删除失败后按钮永久禁用（正确性已受损）。
- **风险**：真实 bug：一次失败后确认框死锁，需关闭重开。
- **修复方案**：`errorMessage` 变化钩里复位 `_submittingLocal`（或改单真相源：宿主回填失败即置 false）。
- **回归验证**：手测删除失败路径 + 触及 spec。

### AP-18 file-card expanded 死接口 [P4] [status: pending]
- **形态**：Dead Props
- **证据**：`file-card.ts:122` reflect prop `expanded` 唯一消费者 `search-results.ts:93` 硬编码 `?expanded=${false}`；实际展开全靠内部 `_toggle` 自改（:125-128）——公共 prop 实为内部 state 误标。
- **风险**：误导外部以为可控展开。
- **修复方案**：降级为 @state，删 public 接口。
- **回归验证**：`tests/file-card.spec.ts` + build。

### AP-19 welcome-pane 死 props（suffix / heroIcon / variant=compact 分支）[P4] [status: pending]
- **形态**：Dead Props / Dead Styles
- **证据**：`welcome-pane.ts:250,252` 声明且有渲染分支（:272-273/:312-313），两个调用方（chat-view:2319、search-view:612）均未传；compact 变体疑似无消费。
- **风险**：死代码维护成本。
- **修复方案**：删未消费分支（先确认 compact 无运行时构造）。
- **回归验证**：触及 spec + build。

### AP-20 app-bar.activeView 死 prop [P4] [status: pending]
- **形态**：Dead Props
- **证据**：`app-bar.ts:280` 唯一 @property，`this.activeView` 全文件零处使用；app.ts:303 传值。prop 与传值方共同维护无效契约。
- **风险**：极低。
- **修复方案**：删 prop 与传值。
- **回归验证**：build。

### AP-21 icon message-circle 零消费 [P4] [status: pending]
- **形态**：Lava Flow
- **证据**：`icon.ts:100` 91 图标中唯 `message-circle` 全库 0 消费（静态 grep 级证据）。
- **风险**：极低。
- **修复方案**：删注册项。
- **回归验证**：build。

### AP-22 file-list God Object（992 行、双渲染路径）[P2] [status: pending]
- **形态**：God Object / Copy-and-Paste（同文件内）
- **证据**：`file-list.ts` 混合 store 读写排序（:531/:822）、列宽拖拽+localStorage（:467/:487）、桌面 13 动作按钮（:875-895）、移动端 header+more 重复同 13 动作（:646-800，ADR-0049 背书有意独立计算但 :531 vs :647 双份 `getState().files` 解构已现漂移温床）、面包屑、document 级点击关闭、横滚同步 ≥5 域。
- **风险**：动作清单 disabled 逻辑双份维护，新增动作两处改。
- **修复方案**：抽动作清单/禁用推导为纯函数（单一真源，两渲染路径共用）；移动菜单/列宽各自子组件化。
- **回归验证**：files 相关 spec + `npm run test:e2e:search` + build。

### AP-23 toast 全局通道跨 shadow 穿透 [P3] [status: pending]
- **形态**：shadow DOM 穿透打洞
- **证据**：`app.ts:182`、`translate-dialog.ts:250-254`、`chat-view.ts:2304` 等 `querySelector("app-bar")?.shadowRoot?.querySelector("toast-stack")` 直捣内部节点取 toast 实例。
- **风险**：toast-stack 改名/重构即全断；绕过封装。
- **修复方案**：app 层挂全局 toast 事件（`window.dispatchEvent(new CustomEvent("app-toast"))`），toast-stack 自监听。
- **回归验证**：触及 spec + build。

### AP-24 TRANSLATE_SERVICES 前端硬拷贝后端契约 [P2] [status: pending]
- **形态**：手抄跨文件契约字面量（数据与契约层）
- **证据**：`model-presets-section.ts:62-107` 62-107 行 envKeys 目录为后端 translator.py envs 的前端镜像，注释自承「与 translator.py 全量对齐」——后端改键前端必漏。
- **风险**：契约漂移致探测/保存静默错位。
- **修复方案**：后端 `/api/config` 或 presets 端点下发服务目录，前端拉取。
- **回归验证**：`tests/test_skills_config.py` 等配置链路 + 前端 spec + build。

### AP-25 settings 激活预设双真相源 [P3] [status: pending]
- **形态**：Duplicated State Source
- **证据**：`settings-view.ts:1099-1113` 父 `_values` 持激活态 + section 内 `presets-activated` 事件逼父级 `_load()` 重拉对账——激活态真值同时活在父 state 与后端。
- **风险**：事件丢失/竞态时 UI 与后端错位。
- **修复方案**：激活态以 store/后端为单一真源，父级订阅而非事件对账。
- **回归验证**：settings 相关 spec + build。

### AP-26 z-index 35 处散布无分层规范 [P3] [status: pending]
- **形态**：z-index 军备竞赛
- **证据**：跨文件 1→9999 约 35 处裸数字（app-bar 50/60、drawer 30、download-overlay 9999、toast 1000、pdf-viewer 101…）；数值关系靠注释互相引用维系（`pull-refresh-indicator.ts:21`、`pdf-viewer.ts:142` 注释自认脆弱耦合）。
- **风险**：新浮层加层时压死 portal/fixed 元素（frontend.md 实证案例同型）。
- **修复方案**：`styles/layers.ts` 常量表（base/drawer/appbar/toast/overlay 五档），全量替换。
- **回归验证**：build + 手测浮层叠放。

### AP-27 mcp 轮询覆盖竞态 [P3] [status: pending]
- **形态**：Race Hazard（灰色项立案：轮询无条件覆盖）
- **证据**：`mcp-servers-section.ts:402-413` `_pollStatus` 每 5s 无条件覆盖 `_servers`，与用户删除/编辑并发时可能覆盖刚 `_load` 的结果。
- **风险**：用户可见状态闪回（未见实证，定 P3 观察）。
- **修复方案**：轮询带版本号/在途编辑时跳过覆盖。
- **回归验证**：触及 spec + build。

## 三、新型态

（无——本域发现均可归入既有形态。）

## 四、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
