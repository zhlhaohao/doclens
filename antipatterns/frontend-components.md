# frontend/src/components（Lit 组件）反模式审计台账

> 审计日期：2026-11-15｜点名范围：`doclens/web_v2/frontend/src/components/`（70 个组件 .ts，25,559 行）｜机械扫描：全仓（消费方 grep 死 prop/死事件/死组件、行数 top、ICONS 注册表↔引用双向核对、监听挂/卸对称性、attribute:false 一致性）

## 一、判据声明

- 附件 `references/frontend.md`（Lit 组件工程节 + 构建节；复检 2026-11-15：条目仍与 Lit 官方文档一致，无更新）
- 附件 `references/general.md`（前端模块层 + 组件层 + 功能层 + 数据与契约层，全节装载）
- 仓库纪律文档附加判据：`frontend/docs/DESIGN.md`（组件样式只引 tokens.css 变量，禁硬编码颜色——test_architecture.py 红线 4）
- 执行方式：主代理精读 preview-pane.ts 全文（2226 行）+ 9 个子代理分组清查 + 1 个子代理专项核实（P1-1/P1-2/P3-5 的字节级证据）

## 二、发现条目

### AP-1 input-box 命令式 `querySelector("button")` 选中错误按钮 [P1] [status: done(见执行记录)]
- **形态**：绕过声明式绑定的脆弱选择器（Lit 栈清单：shadow DOM 内命令式 poke）
- **证据**：`input-box.ts:405-406`、`437-438` 两处 `this.renderRoot.querySelector("button")` 假设首 button = 提交键。但 render 文档序（`input-box.ts:728/730/732`）：缩略图行 `thumb-x`（805）→ 📎 attach 键（746-748）→ 提交键（732）。`attachments=true` 时首 button 是 📎；有图片时是缩略图删除钮。写回 `btn.disabled = !this.trimmed || this.disabled` 会打到错误按钮上（attach 的正确禁用条件是 `fieldDisabled`，两者语义不同——输入为空时误禁 📎、输入非空时误恢复）。
- **风险**：附件模式下发送键禁用态从未被正确同步（提交键禁用态仅靠模板 `?disabled=${this._submitDisabled}` 兜底与否待验），📎/缩略图删除钮被随机置禁。正确性已受损。
- **修复方案**：两处命令式写回改为给提交键加 `class="submit"`（或用 ref/`data-submit`），querySelector 精确命中；或彻底改声明式绑定。
- **回归验证**：`npm run test -- tests/input-box.spec.ts`（cwd=frontend）+ `npm run build`

### AP-2 icon.ts↔pdf-viewer 图标契约双向断裂 [P1] [status: done(见执行记录)]
- **形态**：手抄跨文件契约字面量（引用了注册表中不存在的键，静默渲染空）
- **证据**：`pdf-viewer.ts:333` `name="file-x"`（加载错误态）、`:340` `name="loader"`（加载中态）均不在 ICONS 表（`icon.ts:95-175`，79 键，无别名机制，未命中 render null，`icon.ts:207-210`）。反向全量扫描其余 `name="<icon>"` 全部命中注册表。
- **风险**：PDF 加载失败/加载中两个状态位图标空白（文字仍在，视觉降级非崩溃）——正确性轻度已损，且说明「图标契约」无编译期/测试期闭合检查。
- **修复方案**：icon.ts 补 `file-x`/`loader`（lucide 有同名图标）或改用已注册近似名（`circle-x`/`loader-circle` 若已注册）；可选：加一条 spec 断言所有静态 `name="..."` 引用都在 ICONS 表内（契约闭合测试）。
- **回归验证**：`npm run test -- tests/pdf-viewer.spec.ts` + 手工开 PDF 预览看两个状态图标。

### AP-3 preview-pane 635 行未闭合 JSDoc 吞掉 636 行 @state 声明 [P3] [status: done(批2 提交待填)]
- **形态**：死代码残留（注释事故——Lava Flow 变体）
- **证据**：字节级核实（od）：635 行 `/** 代码主题（ADR-0043 三态）…` 无 `*/`，借 638 行注释的闭合符，把 636 行 `@state() private _codeTheme: CodeTheme = readCodeTheme();` 整行吞入注释。真实生效声明在 710 行（自带 708-709 JSDoc）。634 行还有一条已过时的 ADR-0036 两态 JSDoc 残留。若 636 生效将与 710 构成重复声明编译错——当前行为完全依赖 710 那份。
- **风险**：纯死代码 + 误导性文档（读者以为 636 是声明点）；无行为影响。
- **修复方案**：删除 634-636 三行残留（保留 710 行声明及其 JSDoc）。
- **回归验证**：`npm run build` + `npm run test -- tests/preview-pane.spec.ts`

### AP-4 preview-pane God Object：单组件 ≥13 个职责域 [P2] [status: pending]
- **形态**：God Object / Divergent Change
- **证据**：2226 行。职责域清单（行号）：① 5 分支渲染编排（md/pdf/html/行号/编辑，1563-2216）② 预览↔编辑双模式锚点恢复（_anchorLine/_anchorAtBottom/_selOffsets/_suppressLocate/_skipRestoreOnce，736-748、835-866、1355-1408）③ 滚动位置记忆（_scrollBoundViewer/_scrollAnchorFn/_pendingScrollPath + debounce flush，753-759、890-930）④ 阅读书签域（BOOKMARK_EXTS/标签生成/增删跳，1731-1852）⑤ 目录抽屉域（1822-1853、1968-1998）⑥ 关键词高亮输入条 + 步进导航（1443-1560）⑦ PDF 缩放代理（_pdfZoom*/zoom-label，649、1607-1660）⑧ 翻译入口（1700-1729）⑨ 下载编排（jsbridge 通道 + overlay，1431-1448、2218-2222）⑩ 技能工具箱两段对话框（1866-1905、1998-2020）⑪ 字号/代码主题 6 组 stepper/group 渲染（946-1161）⑫ 全屏态 + body class 联动（1003-1021）⑬ 移动端 header + outside-click 菜单（447-535、1238-1343）。状态字段 30+。历史上已有一次被拆（657 行注释：「行选择已迁 code-viewer（2026-10-19 P1-1 拆分）」）——拆分方向已验证可行。
- **风险**：任何预览功能改动都 touch 本文件；六个字号 stepper 已内部复制（见 AP-5）；新渲染分支继续往 render() 巨方法里堆。
- **修复方案**：沿既有 P1-1 先例继续抽域：① 字号/缩放控件 → `zoom-stepper` 公共组件（吸收 AP-5）；② 书签域 → controller；③ 工具箱两段对话框 → 宿主视图级组件（files 页已有一份同交互）。不要求一次到位。
- **回归验证**：`npm run test -- tests/preview-pane.spec.ts tests/md-viewer.spec.ts tests/file-card.spec.ts tests/search-highlight-units.spec.ts` + `npm run build`

### AP-5 preview-pane 六个 stepper/group 渲染方法参数化可合一（内部 Copy-and-Paste） [P3] [status: done(批5c 提交待填)]
- **形态**：Copy-and-Paste Programming（组件内）
- **证据**：`_renderFontScaleStepper`(946-975) ≈ `_renderCodeFontScaleStepper`(1101-1130)：模板逐行相同，仅 state getter/bound 函数/常量组不同；`_renderMdFontScaleGroup`(1071-1098) ≈ `_renderCodeFontScaleGroup`(1134-1161) 同构；`_renderPdfZoomStepper`(1165-1193) 与 `_renderPdfZoomGroup`(1610-1636) 又是同一 −/值/+ 控件的 mobile/desktop 两套。同一「− 百分比 +」控件共 6 份实现（含 3 份逐字相同的内联 style 字符串，962/1117/1180）。
- **风险**：改一处样式/交互漏五处；属 AP-4 的子症状。
- **修复方案**：抽 `renderStepper({value, atMin, atMax, onMinus, onPlus, onReset, label})` 私有帮助方法（或按 AP-4 抽公共组件）。
- **回归验证**：同 AP-4。

### AP-6 md-viewer God Object：≥9 个正交职责域 [P2] [status: pending]
- **形态**：God Object / Divergent Change
- **证据**：1595 行。职责域：① marked 全局 renderer/tokenizer 定制（132-220）② KaTeX 样式注入（289-291）③ 分页懒渲染 + 估高骨架（637-718、1479-1492）④ 关键词匹配索引/步进导航/徽标 + 竞态治理（615-635、1151-1337）⑤ 滚动锚点货币（921-961、1338-1393）⑥ DOM 选区↔源偏移换算（962-1138）⑦ 图片 URL 重写/点击绑定（799-882）⑧ 代码块复制按钮（826-841）+ 全文复制（1575-1588）⑨ 全屏图片查看器 + FAB（605、1516-1573）。
- **风险**：与 AP-4 同型：预览链路任何改动横跨 preview-pane↔md-viewer 两个巨类。
- **修复方案**：⑤⑥（锚点/选区换算）可抽 utils 纯函数模块（已是纯几何计算）；④ 匹配导航可抽 controller。按需渐进，不强制。
- **回归验证**：`npm run test -- tests/md-viewer.spec.ts` + `npm run build`

### AP-7 md-viewer render() 内全量 parse+sanitize 无缓存（单块模式） [P2] [status: done(批5b 提交待填)]
- **形态**：模板内重计算（Lit 栈清单）
- **证据**：`md-viewer.ts:1526` 每次 render 执行 `sanitizeHtml(marked.parse(...))`；触发面宽：`_copied`(607/1586)、`_viewerSrc`(605)、`_matchIndex`(623，滚动派生) 任一 @state 变化都全量重解析。分页模式有 `_pagedChunks` 缓存（640-641），**单块模式无任何缓存**。render 内还有全局副作用：`ensureMdConfigured()`(1495)、模块级 `currentOffset = 0`（1525，注释 1520-1524 自认残留态补丁）。
- **风险**：大文档 + 高亮步进（每步改 _matchIndex）时每步全量 parse+sanitize；滚动期间 _matchIndex 更新亦触发。规模盲区判读：demo 短文无感，MB 级 md 步进一次 = 一次全量重解析。
- **修复方案**：单块模式也按 content+keyword 记忆化解析结果（content 未变则复用 DOM/html）；_matchIndex 派生更新与正文渲染解耦。
- **回归验证**：`npm run test -- tests/md-viewer.spec.ts` + `npm run build`

### AP-8 pdf-viewer 换文档时 host 监听叠加（挂/卸不对称） [P2] [status: done(批5a 提交待填)]
- **形态**：ReactiveController 挂/卸不对称（Lit 栈清单）
- **证据**：`pdf-viewer.ts:647-652` `_loadDocument` 每次执行 `_bindPinch/_bindWheel` + `host.addEventListener("scroll",…)`；注释称「每次重建 portal 后重挂」，但 `_ensurePortal`(402) 在 portal 仍连接时**复用旧 portal**——挂载态下切换 docPath（willUpdate:300 触发新 `_loadDocument`）在同一 host 上叠加 touchstart/touchmove/touchend/wheel/scroll 匿名监听，无摘除路径；每次换 PDF 多发一份 composed "scroll" 事件（651），下游 scroll 记忆/滚动锚点被多余触发。
- **风险**：反复切换 PDF 的会话中监听份数线性增长 → 缩放一次触发 N 次、scroll 记忆多余 flush；内存泄漏温和。
- **修复方案**：_bindPinch/_bindWheel/scroll 绑定前先摘旧（或挂到 portal 节点随 _destroyPortal 一起消失）。
- **回归验证**：`npm run test -- tests/pdf-viewer.spec.ts` + 手工连续切换两个 PDF 验证缩放/滚动。

### AP-9 pdf-viewer `_applyKeyword` 400ms setTimeout 无代数守卫（Race Hazard） [P2] [status: done(批5a 提交待填)]
- **形态**：Race Hazard（功能层）
- **证据**：`pdf-viewer.ts:885-887` `setTimeout(400ms)` 夺回滚动权，未做 `_loadSeq` 代数检查——同函数其余异步路径均有 seq 守卫（316/617/659/730/738/751/783），独此处缺失。400ms 内切换文档会在新文档上执行旧定位。
- **风险**：快速连续切换 PDF + 带关键词命中时定位错乱（偶发、难复现类 bug）。
- **修复方案**：回调入口比对 `_loadSeq` 快照，不等则丢弃。
- **回归验证**：`npm run test -- tests/pdf-viewer.spec.ts`

### AP-10 ask-card 超时 vs 在途提交双派发 `ask-done`（Race Hazard） [P2] [status: done(批5a 提交待填)]
- **形态**：Race Hazard
- **证据**：`ask-card.ts:243-259` guard 超时回调只检查 `_status !== "pending"`（248），不检查 `_submitting`；`respondAsk` 在途超 122s 时：timeout 先置 `_status="expired"` 并派发 `ask-done` → respond 返回后置 `_status="answered"` 覆盖并**再次**派发 `ask-done`（330）。`_submitting` 仅防重入（301），不参与竞态判定。
- **风险**：宿主 chat-view `_onAskDone` 被双调用（幂等性未验证），状态在 expired↔answered 间翻转。
- **修复方案**：派发前检查 `_status === "pending"`（或引入单调代数）；respond 返回时若已 expired 则不再派发。
- **回归验证**：`npm run test -- tests/ask-card.spec.ts`（如无则补单测：模拟超时后 resolve）

### AP-11 input-box document 级监听无 disconnectedCallback 清理（泄漏） [P2] [status: done(批5a 提交待填)]
- **形态**：监听挂/卸不对称
- **证据**：`input-box.ts:588/569/580/597/602/764` `_toggleMenu`/`_onAttachClick` 向 document 挂 `_onDocClick`，但 InputBox **无 disconnectedCallback**。对照组：chat-message（395-401）、chat-stream（177-181）、ask-card（237-240）均有对称清理。
- **风险**：菜单开着时组件被卸载（视图切换）→ document 回调泄漏 + 残留回调写已卸载组件的 `_menuOpen`。
- **修复方案**：补 disconnectedCallback 摘除 `_onDocClick`。
- **回归验证**：`npm run test -- tests/input-box.spec.ts`

### AP-12 cm-editor `whenReady()` 10ms×200 轮询（Busy Waiting） [P3] [status: done(批5b 提交待填)]
- **形态**：Busy Waiting
- **证据**：`cm-editor.ts:401-405` 以 `setTimeout(10ms)×200` 轮询 `this._view` 非空（等待动态 import 完成事件），2s 后静默放弃——宿主 `preview-pane.ts:842` 依赖它做锚点恢复，超时即锚点静默丢失（注释自认）。
- **风险**：低频但真实：慢设备上首次进编辑态锚点丢失；轮询本身开销可忽略。
- **修复方案**：动态 import 的 promise resolve 后直接置 ready 标志/派发事件，whenReady 等待该 promise 而非轮询。
- **回归验证**：`npm run build` + 手工：打开大 md → 编辑 → 取消，验证视口位置保持。

### AP-13 chat-message 死 prop `error` [P3] [status: done(批2 提交待填)]
- **形态**：Dead Props
- **证据**：`chat-message.ts:341` `@property error`；唯一实例化点 chat-stream.ts:335 透传清单不含 error，chat-view.ts:2427-2441 也未绑定；模板 599/622 的 error 渲染分支无输入路径 → 死 prop + 死模板分支。
- **风险**：无行为影响；误导维护者以为存在错误通道。
- **修复方案**：删除 prop 与对应模板分支（或接通真实错误源——按产品意图二选一）。
- **回归验证**：`npm run build`

### AP-14 input-box 死 prop `iconAfter` + 幻影事件注释 `images-restored` [P3] [status: done(批2 提交待填)]
- **形态**：Dead Props / 文档-代码冲突
- **证据**：`input-box.ts:327` `iconAfter` 全库无消费方赋值（仅 621/634 自读）；`:337` 注释描述 `images-restored` 事件，实际无 dispatchEvent 也无监听者——注释描述了不存在的事件通道（实际回填走 `.images=` 绑定，chat-view.ts:2363/2471）。
- **风险**：误导；无行为影响。
- **修复方案**：删 iconAfter prop；改写 337 行注释为真实的 `.images=` 受控往返描述。
- **回归验证**：`npm run build`

### AP-15 file-row 死 prop `hideCheckbox` [P3] [status: done(批2 提交待填)]
- **形态**：Dead Props
- **证据**：`file-row.ts:101,157`；全库无调用方传 `hide-checkbox`（file-list.ts:899-905、979-984 均不传，file-list 已计算 readOnly(858) 却不转发）。
- **修复方案**：删 prop 及 157 行分支；或让 file-list 转发 readOnly（若产品需要只读态隐藏 checkbox——二选一，默认删）。
- **回归验证**：`npm run test -- tests/file-card.spec.ts tests/search-highlight-units.spec.ts` + `npm run build`

### AP-16 tree-node 死 prop `loading`（永假分支） [P3] [status: done(批2 提交待填)]
- **形态**：Dead Props
- **证据**：`tree-node.ts:41,92`；唯一外部传值 file-tree.ts:102 恒传 `""`，递归子节点（95-105）不传 → `this.loading === this.entry.path` 永假，「加载中…」分支（93）不可达。
- **修复方案**：删 prop 与分支（或接通真实 loading 路径）。
- **回归验证**：`npm run build`

### AP-17 search-results 死绑定 `?expanded=${false}` + welcome-pane 死 prop `suffix` [P3] [status: done(批2 提交待填)]
- **形态**：Dead Props / 死绑定
- **证据**：`search-results.ts:93` 恒 false 绑定（展开态实由 file-card 内部 `_toggle` 124-127 管理）；`welcome-pane.ts:250` `suffix` 全仓无传值（两处宿主均传 variant="onboarding"），compact 变体（269-278）+ heading 默认 "Doclens"（247）疑似遗留死分支。
- **修复方案**：删恒 false 绑定；welcome-pane 确认无外部 HTML 入口后删 suffix/compact 分支。
- **回归验证**：`npm run build`

### AP-18 app-bar 死 prop `activeView` [P3] [status: done(批2 提交待填)]
- **形态**：Dead Props
- **证据**：`app-bar.ts:280`；app.ts:303 传入但组件内零读取（全文 grep 仅声明行）。
- **修复方案**：删 prop 与 app.ts 传值。
- **回归验证**：`npm run build`

### AP-19 welcome-pane 死 prop `heroIcon` [P4] [status: 误报关闭（2026-11-15 核实：chat-view.ts:2321 / search-view.ts:614 以 attribute 形式 heroicon="bot"/"search" 传值，属性存活）]
- **形态**：Dead Props
- **证据**：`welcome-pane.ts:252` `heroIcon` 属性全仓库无赋值点（AP-2 核实任务的附带发现）。
- **修复方案**：与 AP-17 一并清理 welcome-pane。
- **回归验证**：`npm run build`

### AP-20 history-item `copy-failed` 事件半死（search 侧无监听） [P3] [status: done(批5a 提交待填)]
- **形态**：Dead Events（按宿主分支失效）
- **证据**：`history-item.ts:201-204` 派发 `copy-failed`；监听仅 chat-view（1078、2440）。search-view 的 history-list（629-641）未监听 → search 侧复制标题失败静默无反馈。
- **修复方案**：search-view 补监听 toast（对齐 chat 侧）。
- **回归验证**：`npm run test -- tests/search-highlight-units.spec.ts` + 手工 search 页复制失败场景。

### AP-21 mcp-servers-section `_toggleTools` 把失败缓存成「暂无工具」（Error Hiding + Caching Failure） [P2] [status: done(批5a 提交待填)]
- **形态**：Error Hiding / Caching Failure
- **证据**：`mcp-servers-section.ts:585-587` catch 吞错并缓存 `[]`；cache 判断在 581——重展开也不重试，真实错误（网络/后端）对用户永久呈现为「暂无工具」。
- **风险**：MCP 工具列表故障不可诊断；与同文件 `_pollStatus` 的「失败不打扰」（401，有注释声明、每次轮询重试）形成对比——后者合理，前者把失败钉死。
- **修复方案**：失败不写缓存（保留 error 态 + 重试入口），或缓存带 TTL。
- **回归验证**：`npm run test -- tests/`（mcp section 同名 spec 如有）+ `npm run build`

### AP-22 五个 section 设置页系统性样板复制（应抽公共层） [P2] [status: done(批5c 提交待填)]
- **形态**：Copy-and-Paste Programming（跨文件系统性）
- **证据**（行号对照，四份逐字/近逐字）：
  - `_setFlash`/`_toast`/`_toastTimer`（3000ms 同硬编码）：model-presets-section.ts:446-450 ≡ mcp-servers-section.ts:415-419 ≡ skills-section.ts:402-406 ≡ search-presets-section.ts:313-317
  - `_errMsg` 三份：model:452-458 ≡ mcp:421-427 ≡ search:319-325
  - 两段式确认删除四份同构：model:629-646 / mcp:541-559 / skills:427-445 / search:423-440
  - `_load`/`_loading`/`_error` + connectedCallback 拉取四份：model:406-416 / mcp:390-399 / skills:391-400 / search:298-307
  - EditingState 表单状态机（mode/id/form + emptyForm + _openNew/_openEdit/_cancelEdit/_setField）：model:89-94/460-538、mcp:31-35/429-463、search:45-49/327-361
  - `.icon-btn` 样式四份：model:212-239 ≈ mcp:201-228 ≈ skills:183-216 ≈ search:172-196；表单样式三处大段重复：model:247-352 / mcp:296-354 / search:203-267；`.toggle` 两份（mcp:230-266、skills:141-177，skills:140 注释自认「复用 mcp-servers-section 视觉语言」——注释承认复制）
  - 行渲染结构 model:936-962 ≈ search:489-511 逐字段对应
- **风险**： Shotgun Surgery 实证路径：toast 行为/删除流程/表单校验任何调整要同步改 4 处；已见漂移（skills 用 `_confirmDeleteName` 变体、脱敏往返两种约定并存）。
- **修复方案**：抽 4 个公共件——① `toast-flash` mixin/controller（setFlash+timer+清理）② confirm-delete controller ③ list-load mixin（_load/_loading/_error/_errMsg）④ shared styles（icon-btn/form/toggle/preset-row CSS）。组件本体不合并（各域表单字段有本质差异，防 DRY Misuse）。
- **回归验证**：`npm run test -- tests/`（各 section 同名 spec 如有）+ `npm run build`；逐页手工冒烟设置页五个分区。

### AP-23 model-presets-section God Object（981 行，8 职责域） [P2] [status: pending]
- **形态**：God Object
- **证据**：① 三组列表渲染（846-962）② CRUD 表单 + 多 kind 分支校验（540-612、739-844）③ API 连通性探测×3：max_tokens 二分/行为学/translate（648-737）④ 套餐额度查询/缓存/渲染（379-435、864-934）⑤ 激活协作（614-627）⑥ 翻译服务目录 + env 键目录硬编码 22 家（62-85）⑦ env 行动态编辑器（504-533、757-770）⑧ IntersectionObserver 可见性重查（389-404）。另 :680-681 有孤儿 JSDoc（两段注释叠放指向同一方法——复制痕迹）。
- **风险**：③④⑦ 各自可独立成子组件；当前全部挤在 render 分派里。
- **修复方案**：探测三兄弟 → `probe-button` 组件；额度域 → `quota-badge`；与 AP-22 的公共层配合收敛。
- **回归验证**：`npm run build` + 手工：模型预设页增删改/探测/额度显示。

### AP-24 search-presets-section 死样式（.head/.badge 无模板匹配） [P3] [status: done(批2 提交待填)]
- **形态**：Dead Styles
- **证据**：`search-presets-section.ts:82-98`（`.head/.head h2/.head .hint`）与 153-161（`.badge`）在全文模板无匹配元素（grep 证实 .badge 仅 mcp/skills/password 使用）。
- **修复方案**：删两段 CSS。
- **回归验证**：`npm run build`

### AP-25 formatSize 六份手抄副本且行为分裂（无 GB 档） [P2] [status: done(批3 提交待填)]
- **形态**：手抄跨文件契约字面量 + Copy-and-Paste（已现行为分裂）
- **证据**：副本：file-row.ts:105-109、file-search-results.ts:28-32、delete-dialog.ts:104-105、backup-dialog.ts:276、git-changes-list.ts:41、preview-pane.ts:2001（`_formatSize`）；而 `utils/format.ts:6-8` 已有正式实现**且支持 GB 档**。副本全部缺 GB 分支 → >1GB 文件显示"xxxx.x MB"。
- **风险**：行为分裂已成事实（同库同一文件大小在不同视图显示口径不同）；GB 级知识库文件真实存在（PDF/PST）。
- **修复方案**：六处全部改 import `utils/format.ts` 的 formatSize，删本地副本。单一真相源清剿（同因多处形态）。
- **回归验证**：`npm run test -- tests/file-card.spec.ts tests/preview-pane.spec.ts` + `npm run build`；手工核对 >1GB 文件在删除对话框/文件行/预览头的显示。

### AP-26 ILLEGAL/RESERVED 文件名校验常量三份手抄 [P3] [status: done(批3 提交待填)]
- **形态**：手抄跨文件契约字面量
- **证据**：`mkdir-dialog.ts:5-6` ≡ `new-file-dialog.ts:5-6` ≡ `rename-dialog.ts:4-5`（正则 + 同一错误文案逐字）；grep 全仓仅这 3 处，无共享模块。后端若改规则需改 3 处。
- **修复方案**：抽 `utils/filename-rules.ts`（ILLEGAL/RESERVED/validateFilename），三处 import。
- **回归验证**：`npm run build` + 手工三个对话框的非法名输入。

### AP-27 对话框外壳样式两大族系 ≥10 份复制（约 340-400 行重复） [P2] [status: done(批4 提交待填)]
- **形态**：Copy-and-Paste Programming（结构级）
- **证据**：
  - **族 A**（自管 scrim 全屏外壳：host fixed+z-1000/:host([open]) 遮罩/.scrim/dialog 边框圆角阴影/.head+.close-btn/.body/移动端 media query）：about-dialog.ts:26-86 与 control-panel-dialog.ts:26-86 **≈95% 逐行相同**（仅 .body gap 差），backup-dialog.ts:23-87 ≈90%；同族还有 watch-changes/reindex/workdir-switch/drop-zone（grep `z-index: 1000` 命中 9 处件）——同一外壳 ≥6 份。行为样板同步复制：Esc 拦截 + _close() 三份 ≈50 行（about:217-259、backup:217-238、control-panel:147-169）。
  - **族 B**（`<dialog>` slot 内嵌件）：`.note` 三份逐行相同 11 行（compact:44-54 / fork:28-38 / import:62-72）；button 基础+primary 三份 ≈17 行（compact:61-77 / fork:45-60 / import:79-95）；`.buttons` + 移动端 column-reverse 四份（compact/fork/import/city）。
  - 按钮样式 pill 变体在 mkdir/new-file/rename/session-rename/reparse/reindex/skill-run 7+ 文件各一份（mkdir:43-58 ≈ reparse:68-82 ≈ skill-run:75-90）；`@media (max-width:1023px)` actions column-reverse 同样 7+ 份。
  - 漂移实证：about-dialog `<dialog>` 无 `open` 属性（323）而 backup(294)/control-panel(202) 写 `<dialog open>`——靠作者样式 `display:flex`(:55) 压制 UA `dialog:not([open]){display:none}` 才正常显示，复制品间已各自演化。
- **风险**：DESIGN.md 标尺要求样式统一走 tokens；外壳改版（如圆角/阴影/backdrop）需改 ≥10 处；漂移已发生。
- **修复方案**：抽 `dialog-shell.ts` shared styles（族 A 外壳 + 族 B note/buttons/button.primary）+ 一个薄 wrapper 组件（族 A 用）；逐族迁移，不强求一次全量。
- **回归验证**：`npm run build` + 手工冒烟全部对话框开合。

### AP-28 「单输入框弹窗五件套」结构近重复（可参数化合一） [P3] [status: done(批4 提交待填)]
- **形态**：结构级近重复（可合并）
- **证据**：mkdir(123)/new-file(125)/rename(123)/session-rename(121) 四件：样式 diff 实测 **mkdir↔new-file 零差异、rename↔session-rename 零差异**；render() 骨架（label+input[autofocus]+Enter 提交+invalid 类+actions 双按钮）逐行同构（mkdir:99-118 ≈ new-file:100-120 ≈ rename:99-118 ≈ session-rename:96-115）；差异集中在 `_validate` 函数体、初始预填、label/placeholder/按钮文案。session-rename.ts:4-6 注释自称「外壳仿 rename-dialog」，reparse-dialog.ts:16 同。move-dialog **不属于本组**（tree 选择器 + checkbox 结构，move-dialog.ts:91-119）。
- **风险**：P3 级：与 AP-26/27 叠加，对话框域重复密度全仓最高。
- **修复方案**：抽 `input-dialog`（props: label/placeholder/value/maxlength/submitLabel + validator 参数），四件套变薄配置；move/reparse 保持独立。
- **回归验证**：`npm run build` + 手工四个对话框。

### AP-29 fork-confirm-dialog 是 compact-confirm-dialog 的真子集（近重复对） [P3] [status: done(批4 提交待填)]
- **形态**：结构级近重复（可合并）
- **证据**：fork 全文 101 行：styles 9-66 是 compact:20-96 删 running/done 态的子集；模板 82-93 与 compact `_renderConfirm`(205-217) 结构同构（h2+p+p.muted+.note+.buttons）；事件协议同为 confirm/cancel 冒泡。fork 是纯静态单态确认框。
- **风险**：P3；DRY Misuse 边界：compact 的四态机（confirm/running/done/error）+ 剪贴板双轨降级不宜与 fork 强合一——**可合并的是 fork 退化用例**（用 compact 的 confirm 态或一个更小的 confirm-dialog 基座承载）。
- **修复方案**：fork 改为通用 confirm 基座的单态配置，或直接复用 compact confirm 态；import/delete 不并入（见反证）。
- **回归验证**：`npm run build` + 手工 fork 确认框。

### AP-30 bookmark-drawer ≈ toc-drawer（~140 行逐行级重复，可合并） [P3] [status: done(批4 提交待填)]
- **形态**：结构级近重复（可合并）
- **证据**：:host 样式逐字符相同（bookmark:24-30 ≡ toc:20-26）；.overlay 仅 keyframes 名 `bm-` vs `toc-` 前缀差（刻意去重痕迹）；.panel 完全相同（37-49 ≡ 33-45）；keyframes fade/slide 内容逐字符相同；.close-btn/.list 相同；connected/disconnected + Esc→close capture 监听同一段逻辑（165-180 ≈ 128-149）；render 骨架 overlay+panel(header+list) 同构。差异仅条目渲染与 bookmark 的 canAdd/add/remove、toc 的 currentLine/firstUpdated 滚动。
- **风险**：P3；两抽屉动画/交互改版漏一处。
- **修复方案**：抽 `side-drawer` 基座（外壳+动画+Esc+overlay），两 drawer 只留条目渲染 slot。
- **回归验证**：`npm run build` + 手工 md/pdf 预览开两抽屉。

### AP-31 tab-bar ≈ activity-bar（整文件级复制） [P3] [status: done(批4 提交待填)]
- **形态**：结构级近重复（可合并）
- **证据**：相同 `_items` 数组（tab-bar:55-60 ≡ activity-bar:67-72）、相同 `_select`/navigate 派发（62-67 ≡ 74-79）、相同 render 过滤与激活态逻辑；仅布局 CSS 不同（顶部 tab 条 vs 左侧图标栏）。
- **风险**：P3；导航项增删（如加新视图）要同步改两处 `_items`——真实 Shotgun Surgery 入口。
- **修复方案**：抽共享 `NAV_ITEMS` 常量 + 导航逻辑 mixin；两个壳组件只留布局。
- **回归验证**：`npm run build` + 手工桌面/移动导航切换。

### AP-32 preview-pane mobile-header 圆钮样式与 focus-header 同构复制 [P4] [status: pending]
- **形态**：Copy-and-Paste（跨组件样式；shadow DOM 隔离下的已知代价）
- **证据**：preview-pane.ts:458-486 与 focus-header.ts:34-59/79-100——32px 圆形/border/hover 三连（primary-soft+primary+primary border）/touch-action/transition 全一致；preview-pane.ts:457 注释自称「同 focus-header」。类似行级 hover/active CSS 习语在 file-row:31-32、file-search-results:94-95、file-card:79-82、tree-node:17-18、deep-read-list:100、pst-email-list:108-110 六处重复（设计 token 层一致性 + 组件级复制并存）。
- **风险**：低——tokens.css 变量已约束色值，复制的是结构声明；改交互态要漏多处。记录为主，可随 AP-27 的 shared styles 一并收敛。
- **修复方案**：并入 AP-27 共享样式层（圆钮/行 hover 习语）。

### AP-33 file-list God Object（992 行，≥8 职责域）+ mobile/desktop 双渲染路径内部重复 [P2] [status: done(批5c 提交待填)]
- **形态**：God Object + 组件内 Copy-and-Paste
- **证据**：职责域：面包屑（29-96、545-601、910-940）/桌面工具栏 11 钮（97-166、941-961）/移动端 header+12 项菜单（167-255、646-796）/列宽拖拽+localStorage（322-351、427-514）/排序列头（360-385、812-846）/全选多选（529-543）/行渲染接线（897-907、977-985）/横滚同步（273-320、798-810）。内部重复：`_renderMobileHeader`(650-665) 与 render()(856-877) 重复计算 readOnly/canRename/canDownload/canAct/canGoUp/breadcrumb/showSetWorkdir 七项（注释 648-649 自认）。store.subscribe→requestUpdate 粗粒度全量重渲 + render 内 sortFileEntries/new Set 重算（854-855、871）。
- **风险**：文件页任何功能改动都 touch 本文件；移动/桌面两路径已开始各自演化。
- **修复方案**：面包屑、列宽拖拽、排序列头各自抽子组件/controller；七项重复计算提为私有 getter。
- **回归验证**：`npm run test:e2e:search`（文件列表在语境内）+ `npm run build`

### AP-34 tree-node 每节点独立订阅 store（全树 N 份订阅 × 全量重渲） [P2] [status: done(批5b 提交待填)]
- **形态**：模板内重计算 + 订阅放大
- **证据**：`tree-node.ts:49` 每个树节点独立 `store.subscribe`；任一 store 变更 → 全树 N 节点各 requestUpdate，render(94) 再跑 `childEntries.filter`。对照：file-list 单点订阅（431-442）。
- **风险**：规模盲区判读：目录树几千节点 × store 高频变更（索引进度/watch 状态推送）时是 N×渲染风暴；demo 小树无感。
- **修复方案**：订阅上提到 file-tree 单点，选中态经属性下发；或 tree-node 只订阅自己关心的 selector 切片。
- **回归验证**：`npm run build` + 手工大目录树展开 + 索引期间观察树 responsiveness。

### AP-35 rewind 与 turn-delete 同构（anchor 摘录 + 不可撤销警示 + 双按钮） [P4] [status: done(批4 提交待填)]
- **形态**：结构级近重复（轻度）
- **证据**：rewind-dialog.ts:222-241 ≈ turn-delete-dialog.ts:120-139（h2+.anchor slice(0,160)+.warn+plain/danger 双按钮）；样式块近似（rewind:27-39/87-97/129-137 ≈ turn-delete:29-41/47-58/65-73）；`slice(0,160)` 两份各写。
- **风险**：低；两个「危险操作确认」框。可随 AP-27 共享层收敛（.warn/.anchor 样式 + excerpt 截断常量）。
- **修复方案**：并入 AP-27/28 的对话框公共层。

### AP-36 turn-delete-dialog 双真相源 `submitting` prop × `_submittingLocal` state [P3] [status: done(批4 提交待填)]
- **形态**：受控属性与内部 @state 双真相源
- **证据**：`turn-delete-dialog.ts:94-97` 两态并存，`_busy = submitting || _submittingLocal`(99-101)；确认后组件置 `_submittingLocal=true`(105) 而宿主随后也置 `d.submitting=true`（chat-view:2115）——同一「提交中」两方先后写。对照 rewind-dialog:157 纯内部 `_submitting` 且失败路径无复位（靠宿主整树卸载对话框兜底）——同一场景两种写法（佐证复制演化）。
- **风险**：状态归属不清；失败重试路径行为取决于宿主卸载时机。
- **修复方案**：统一为单一真相源（推荐：组件自管 busy，宿主只听 confirm 事件）。
- **回归验证**：`npm run build` + 手工 turn 删除成功/失败两路径。

### AP-37 diff-viewer render() 内全量 parseUnifiedDiff 无缓存 [P3] [status: done(批5b 提交待填)]
- **形态**：模板内重计算
- **证据**：`diff-viewer.ts:163` render() 内对整个 diff 文本逐行正则解析，无 memo；任意无关 @state 更新都重解析（注释自述有超长 diff 场景）。
- **修复方案**：按 diff 内容 willUpdate 记忆化。
- **回归验证**：`npm run build` + 手工 git 大 diff 打开。

### AP-38 跨组件硬编码散布（toast 时长/断点/事件名/魔法阈值） [P3] [status: done(批3 提交待填)]
- **形态**：Hard Code / Magic Numbers + 手抄契约字面量
- **证据**：toast 3000ms ×4（AP-22 内）；`cortex:workdir-swap-failed` 事件名三文件手写（workdir-switch-dialog.ts:287、watch-stream.ts:122、app.ts:163）；`slice(0,160)` ×2（AP-35）；session-rename `maxlength=1000`「与后端 SESSION_TITLE_MAX 对齐」靠注释（:103）；session-info `COMPACT_RATIO=0.8`「与后端 compact_threshold 对齐」靠注释（:146）；mcp 轮询 5000ms；额度警示 90%；`@media (max-width:1023px)` 断点五文件各写。
- **风险**：契约靠注释维系，漂移无告警。
- **修复方案**：常量归位 utils/constants（事件名导出常量；前后端对齐值集中注释指向后端常量名）；部分随 AP-22 公共层自然收敛。
- **回归验证**：`npm run build`

### AP-39 _pushToast 帮助方法六份复制（跨 shadow DOM 抓 toast-stack） [P3] [status: done(批3 提交待填)]
- **形态**：Copy-and-Paste + shadow DOM 穿透打洞
- **证据**：app-bar.ts:444-448 ≡ search-view.ts:580 ≡ chat-view.ts:2303 ≡ settings-view.ts:725 ≡ reindex-dialog.ts:82，translate-dialog.ts:251 变体（`document.querySelector("app-bar")?.shadowRoot?.querySelector("toast-stack")`——跨 shadow 抓取，脆弱：换宿主结构即断）。
- **风险**：toast 通道改动（如 toast-stack 挂载点变化）六处齐断。
- **修复方案**：抽 utils/toast.ts 单一入口（事件总线或直接定位函数），六处 import。
- **回归验证**：`npm run build` + 手工触发各页 toast。

### AP-40 chat-message render() 巨方法双分支 + user/assistant 复制按钮模板两份 [P3] [status: done(批5c 提交待填)]
- **形态**：Long Method + Copy-and-Paste
- **证据**：render() 579-631 单方法 if 分叉 user(591)/assistant(612+)，消息类型分派未表驱动；复制按钮模板 user(601)/assistant(626) 两份近同。input-box 内 L403-407 与 L436-440 按钮禁用同步逻辑逐行重复（AP-1 的孪生）。
- **风险**：新增消息类型继续堆 if；P3。
- **修复方案**：抽 `_renderActions(role)`；分派表驱动（与 AP-4 拆分方向一致，可后行）。
- **回归验证**：`npm run build`

### AP-41 chat-tool-trace setTimeout 未清理（对照组有清理） [P3] [status: done(批5a 提交待填)]
- **形态**：监听/定时器不对称
- **证据**：`chat-tool-trace.ts:403、416` 主/降级复制路径各一份 setTimeout 复位，无 disconnectedCallback 清理（对照 chat-message `_copyTimer` :400 有清理）。
- **风险**：低危：回调操作已卸载 @state（Lit 告警级）；与 AP-11 同型。
- **修复方案**：补 disconnectedCallback 清 timer。
- **回归验证**：`npm run build`

### AP-42 app-bar「菜单 + 全部全局对话框 + toast 总线」汇聚点 [P4] [status: pending]
- **形态**：汇聚点（God Object 倾向，但有架构自洽性）
- **证据**：app-bar.ts:665-683 连挂 toast-stack + control-panel + backup + watch-changes + about 四个全局对话框，持 4 个 @state 开关（287-293）+ 级联处理器（353-368）+ SSE/window 转接（316-337、450-456）。仅 1 prop 但 20+ 方法。
- **风险**：记录级：新增全局对话框的默认落点，若无自律会继续膨胀；SSE 转接与对话框开关的耦合是可拆分候选。
- **修复方案**：可不改；若膨胀，全局对话框上提到 cortex-app 级挂载点。

### AP-43 md-viewer/pdf-viewer FAB 与步进导航两套实现 [P4] [status: pending]
- **形态**：Copy-and-Paste（有意对齐但双实现）
- **证据**：pdf-viewer FAB 组手工 DOM 构建（357-395，注释自述「对齐 md-viewer .match-fabs 结构」）；`stepKeywordHit`(519) 与 md-viewer:1219 同名同语义两套。pinch/wheel 缩放钳制同函数内两份近似拷贝（909-911、923-925）。
- **风险**：记录级：两个渲染引擎（marked DOM vs pdf.js canvas）本质不同，强行合一属 DRY Misuse；但「匹配导航」语义接口可统一（两者已同名同参，事实上的duck-typing 契约）。
- **修复方案**：可将接口签名固化到共享 type；实现各自保留。

### AP-44 diary-record-panel 七职责域（580 行） [P4] [status: pending]
- **形态**：God Object 倾向（同域紧耦合，拆分收益需权衡）
- **证据**：文字录入（366-374、526-532）/城市标签（376-378、534）/照片三通道（380-407、542-543）/待传照片状态机 + ObjectURL 手工 revoke（339-340、409-438、545-559）/片段时间线渲染（150-332、474-520）/片段删除两段确认 + inline 编辑（341-345、440-472）/图片旋转总线 + 全屏查看器 + toast（349-364、567-571）。
- **风险**：记录级：均为「记录页」单一交互域的紧耦合，注释清晰；无录音/转写（命名易误导）。
- **修复方案**：可不拆；若动，照片待传状态机与时间线渲染先行。

## 三、反证归档（疑似重复但实为有意设计——不立案）

| 疑点 | 反证出处 |
|---|---|
| ask-card 是 chat-message 特化变体？ | 否：无共享模板/样式/事件；ask-card 是表单交互组件（radio/checkbox/guard/HTTP），chat-message 仅以摘要只读态复用它（chat-message.ts:653）；实时悬置卡由 chat-view.ts:2443 独立挂载。职责正交，**不可合并** |
| 四个确认类对话框（compact/fork/import/delete）合一？ | 部分可合：仅 fork 是纯静态子集（AP-29）；import 三态机+双确认语义（import-confirm-dialog.ts:114-118）、compact 四态机+剪贴板双轨、delete 直读 store+异步 stats+checkbox 门控——强行四合一属 DRY Misuse。文件头注释（chat-view:2175、2214）明示多态复用为刻意设计 |
| move-dialog 并入输入框五件套？ | 否：tree 选择器 + checkbox 结构（move-dialog.ts:91-119），非单输入框同构组 |
| reindex-dialog 与其他对话框外壳相似 = 逻辑复制？ | 否：store 驱动全局组件（app.ts:314 根级、无 props 无事件）与 content 型对话框是两种架构范式；相似是 design-system 缺位（归 AP-27）而非逻辑重复 |
| 五个 section 是 Smart/Dumb 失衡？ | 否：注释明确声明「不进 settings-fields 声明式体系/状态自持有」（password:1-6、mcp:94、skills:29）——刻意与 envVar 驱动的 settings store 隔离。复制问题归 AP-22，架构模式本身有背书 |
| file-list 巨类是无序演化？ | 否（部分）：ADR-0049（67、86、412-425、547-550）、ADR-0041（418）、多决议注释背书——是已裁决决策的累积；但 mobile/desktop 双路径重复无背书（AP-33 立案） |
| file-card 不复用 file-row？ | 否：数据形状不同（FileGroup/MatchItem vs FileEntry）、高亮坐标系（spans 字符区间）有安全绑定注释（file-card.ts:144）——有意独立 |
| search-results 转发 file-card 事件是 Poltergeist？ | 否：有 bug 修复注释（search-results.ts:71-74，双压 detailStack）——转发承载真实修复，删除需处理回归 |
| pst-email-list 用 table 是 Div Soup 反向问题？ | 否：sticky 表头（85-87）与列宽百分比依赖表格布局，非布局滥用 |
| skills/mcp 的 .toggle 两份？ | 是复制（skills:140 注释自认），归 AP-22 |
| pdf-viewer rAF 对齐循环是 Busy Waiting？ | 否：稳态靠 rect 缓存字符串比对短路（441-443），取舍有注释论证（vs ResizeObserver） |
| mcp `_pollStatus` catch{} 静默？ | 否：有意图注释（401「失败不打扰」）且每次轮询重试——与 AP-21 的永久缓存失败本质不同 |
| password `_logout` catch{}？ | 否：注释说明（231-233，网络错误也跳登录是预期） |
| delete-dialog `_stats` 测试后门？ | 弱灰：私有 state 兼作测试接缝（tests/delete-dialog.spec.ts:11 使用）——保留观察 |
| unsafeHTML 注入面 | 全 70 组件 grep 零命中；md-viewer 两处 innerHTML 均先过 sanitizeHtml；code-viewer unsafeCSS 仅喂静态主题常量 |
| 死组件 | 零：70 个组件全部有模板宿主或根级挂载（机械扫描核实） |
| Interface Bloat | 基本不成立：prop 最多的 session-info-dialog 13 个且全消费；compact/import 各 5 个全消费 |
| 属性监听过度 | 基本合规：大对象 prop 均 attribute:false（个别 string/bool 走 attribute 属合理） |

## 四、新型态

- **「注释吞声明」**（AP-3）：未闭合 JSDoc 静默吞掉相邻类字段声明，靠后文另一份重声明维持行为——TS 不报错（被吞的声明从未存在过），行为漂移风险为零但文档指向错误。检测线索：同名字段出现两份声明 + 一份无 JSDoc 一份有。首次实证：本台账。
- **「图标契约双向不闭合」**（AP-2）：集中注册表（ICONS）与散布引用（name="..."）之间无任何编译期/测试期闭合检查，两个方向都可断（未注册被引用、注册了无人用——后者本仓 3 个：message-circle/scale/send）。检测线索：注册表查找失败静默 render null。

## 五、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-11-15 | 批 1（P1） | AP-1、AP-2 | AP-1：提交键统一加 `class="submit"`（含分裂按钮 primary），两处 querySelector 改 `button.submit:not(.caret)` 精确命中（input-box.ts:405-407/437-438 → 620/633/643 + selector 修正）；AP-2：icon.ts 补注册 `file-x`/`loader`（lucide-static 实有此二文件）。回归：input-box.test.ts 13 绿 + pdf-viewer.test.ts 7 绿 + `npm run build` 通过（tsc --noEmit 含内） |
| 2026-11-15 | 批 6a（God Object 拆分·一） | AP-4（部分） | 技能工具箱域迁 utils/skill-toolbox.ts（SkillToolboxController：list→run 状态机/技能拉取/消息拼装/showModal 时机，~90 行），阅读书签域迁 utils/bookmarks-controller.ts（BookmarksController：显隐/列表/收藏锚点捕获/跳转/删除，~90 行）——preview-pane 沿 2026-10-19 P1-1 先例（行选择迁 code-viewer）继续抽域，事件契约不变（skill-chat / bookmark-added/duplicate/full）。回归：4 spec 98 测试全绿 + build 通过 |
| 2026-11-15 | 批 5c（结构收敛） | AP-5、22（核心）、33、40 | AP-5：六个 −/值/+ 渲染方法收敛为 _renderStepper（mobile 菜单行）+ _renderZoomGroup（桌面 header 联排）两个参数化方法（AP-4 子症状，亦为后续拆分的组成件）；AP-22（核心）：新建 utils/section-mixins.ts（ToastFlashMixin：_toast/_toastTimer/_setFlash/3000ms/卸载清理 + apiErrMsg 工厂），model-presets/mcp/skills/search 四 section 迁移（_errMsg 改 apiErrMsg(e, XxxApiError)；confirm-delete/list-load/表单状态机/共享样式四件套其余部分留待后续轮次——模板结构耦合度高，强拆风险大于收益）；AP-33：file-list mobile/desktop 七项重复派生计算提为 _toolbarState getter（readOnly/canRename/canAct/canGoUp/breadcrumb/showSetWorkdir 单一定义，canDownload 因入参不同保留两处）；AP-40：chat-message user/assistant 复制按钮模板两份合一为 _renderCopyBtn。回归：8 spec 170 测试通过（settings-fields/settings-view 3 失败经 stash 基线验证为既有）+ build 通过 |
| 2026-11-15 | 批 5b（性能缓存） | AP-7、12、34、37 | AP-7：md-viewer 单块模式按 content 记忆化 parse+sanitize 结果（keyword 高亮走 _stripKeywordMarks/_highlightKeyword DOM 后处理，不依赖重解析，安全性核实）；AP-12：cm-editor whenReady 改等 _loadCore promise（firstUpdated 记录 _coreReady），删 10ms×200 轮询；AP-34：tree-node 删每节点独立 store 订阅，expandedPaths/currentDir/treeCache 三态经属性由宿主下发（file-tree 单点订阅；move-dialog 同步补传），全树 N 份订阅收敛为 1；AP-37：diff-viewer parseUnifiedDiff 按 diff 内容记忆化。回归：9 spec 165 测试通过（chat-view-preview 1 失败为既有基线失败）+ build 通过 |
| 2026-11-15 | 批 5a（小修快赢） | AP-8、9、10、11、20、21、41 | AP-8：pdf-viewer 交互监听句柄化（_portalHandlers 数组）+ 换文档先 _unbindPortalInteractions 再挂 + _destroyPortal 一并摘除；AP-9：_applyKeyword 400ms setTimeout 补 _loadSeq 代数守卫；AP-10：ask-card 加 _doneDispatched 单次派发守卫（超时与在途 respond 的先到者独占 ask-done，新 requestId 复位）；AP-11：input-box 补 disconnectedCallback 摘 document _onDocClick；AP-20：search-view history-list 补 @copy-failed toast（对齐 chat 侧）；AP-21：mcp _toggleTools 失败不再缓存空数组（cache 判据 id in cache，缺失保持加载中、重展开重试）；AP-41：chat-tool-trace 复制复位 timer 句柄化 + disconnectedCallback 清理。回归：7 spec 100 测试全绿 + build 通过 |
| 2026-11-15 | 批 4（对话框抽公共层） | AP-27、28、29、30、31、35（部分）、36 | AP-31：新建 utils/nav.ts（NAV_ITEMS/navItems/emitNavigate），tab-bar/activity-bar 各删本地 _items+_select 副本；AP-30：新建 utils/side-drawer.ts（sideDrawerStyles+renderSideDrawer 骨架），bookmark-drawer/toc-drawer 重写为薄壳（仅留条目渲染与专属事件，keyframes 前缀改名痕迹一并归一）；AP-28：新建 components/input-dialog-base.ts（InputDialogBase：样式 60 行 + _onInput/_submit/_cancel/Enter/invalid 骨架 + prefill 预填即校验），mkdir/new-file/rename/session-rename 四件套变 ~40 行配置子类（validator/label/prefill/submitDetail）；AP-27/29：新建 utils/dialog-styles.ts（dialogSlotStyles：.note/.buttons/button.primary/移动端断点），fork-confirm/compact-confirm/import-confirm 三件迁移（fork 保留静态单态不并入 compact 四态机——反证防 DRY Misuse）；AP-35（部分）：rewind/turn-delete 样式经核对仅近似非逐字同（.anchor 边色/.warn 配色有真实差异），不做强行归一，ANCHOR_EXCERPT_LEN 已在批 3 常量化——本条按实际差异降档关闭；AP-36：删 turn-delete _submittingLocal 双真相源（dispatchEvent 同步性核实：confirm 派发后宿主随即置 submitting=true 回传，无覆盖窗口），统一为宿主单源。回归：12 spec 183 测试全绿 + npm run build 通过 |
| 2026-11-15 | 批 3（单源清剿） | AP-25、AP-26、AP-38、AP-39 | AP-25：六份 formatSize 副本全部改 import utils/format.ts formatBytes（file-row/delete-dialog/backup-dialog/preview-pane/file-search-results/git-changes-list；>1GB 显示 GB 档自动修复，git-changes-list 的 null→"—" 特判留在本地薄包装）；AP-26：新建 utils/filename-rules.ts（FILENAME_ILLEGAL_RE/FILENAME_RESERVED_RE/validateFilename），mkdir/new-file/rename 三处 _validate 改调公共函数（校验顺序微调：RESERVED 并入 validateFilename 在空白判定前，空白名不在保留集内，行为等价）；AP-38：新建 utils/events.ts（WORKDIR_SWAP_FAILED_EVENT），workdir-switch-dialog/watch-stream/app.ts 四处手写字符串改常量；rewind/turn-delete 的 slice(0,160) 提为各自文件头 ANCHOR_EXCERPT_LEN=160（同口径注释互指）；AP-39：新建 utils/toast.ts（pushLocalToast/pushToast 双通道），app-bar/search-view/chat-view/settings-view/reindex-dialog 五处本地实例 _pushToast 改薄包装（视觉位置不变），translate-dialog 跨 shadow 抓取改全局 pushToast 通道。回归：12 spec 文件 195 测试通过（settings-view.spec.ts 1 失败为基线既有，stash 验证）；npm run build 通过 |
| 2026-11-15 | 批 2（死代码清扫） | AP-3、AP-13~18、AP-24 | AP-3：删 634-636 未闭合 JSDoc 残留三行（保留 710 行生效声明）；AP-13：删 chat-message error prop + 两处死模板分支 + .error 样式；AP-14：删 input-box iconAfter prop（模板简化为 icon/label 单渲染）+ 修正 images-restored 幻影注释为真实受控往返描述；AP-15：删 file-row hideCheckbox prop 及分支；AP-16：删 tree-node loading prop + 永假分支 + file-tree 恒空传值；AP-17：删 search-results `?expanded=${false}` 恒假绑定、删 welcome-pane suffix prop + .sep 样式（heroIcon **反证保留**——宿主以 heroicon attribute 传值，AP-19 关闭为误报）；AP-18：删 app-bar activeView prop + app.ts 传值 + ViewId import；AP-24：删 search-presets .head/.badge 死样式。回归：8 spec 文件 162 测试全绿 + `npm run build` 通过；chat-view-preview.spec.ts 1 失败为基线既有失败（stash 验证），非本批引入 |
