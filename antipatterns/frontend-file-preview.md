# 前端文件预览模块 反模式审计台账

> 审计日期：2026-11-15｜点名范围：前端文件预览模块（preview-pane / md-viewer / pdf-viewer / code-viewer / cm-editor / image-viewer / diff-viewer + preview-controller / scroll-jump / scroll-memory / marked-math / font-scale 对 / code-theme / code-palette / api/preview，共 17 文件 ~9k 行）｜机械扫描：全仓（跨文件私有成员 import、`as any` 密度、shadowRoot 穿透密度、innerHTML/unsafeHTML 注入面、监听挂/卸配对、魔法数、守卫测试 test_architecture.py=9 passed）

## 一、判据声明

- `references/frontend.md`（Lit 组件节 + 原生 H5 节 + 语义 HTML 节，2026-10-20 版，本次按仓库现状复检：z-index 分层/主题越界两条已有 ADR 修复痕迹，见反证）
- `references/general.md`（前端模块层 + 组件层 + 功能层 + 数据契约层 + 横切判读，全节装载）
- 仓库纪律文档（附加判据）：CLAUDE.md（前端构建为完工标准 / DESIGN.md tokens 标尺 / test_architecture.py 红线 4 禁硬编码颜色——扫描通过）

## 二、发现条目

### AP-1 preview-pane God Object + Interface Bloat [P2] [status: pending]
- **形态**：God Object / Interface Bloat / Feature Envy
- **证据**：`components/preview-pane.ts:588-743` —— 21 个 @property + 17 个 @state + 约 55 个方法，职责块含渲染分发、滚动记忆、双套字号 stepper、代码主题、全屏、查找高亮、目录、翻译、书签、下载、编辑保存/锚点恢复、移动端菜单、路径复制、附件列表 ≥13 块。21 props 中三调用方（chat-view.ts:1522、files-view.ts:1433、search-view.ts:709/762）各用不同子集，无一方过半。且 18 处 `querySelector("md-viewer"/"pdf-viewer"/"cm-editor")` 直读子组件内部方法在本地计算（:899,1183,1359,1584,1644,1675,1749,1893…）——Feature Envy，封装边界靠约定维持
- **风险**：任何预览功能改动都 touch 此文件（Divergent Change），2131 行已是两次拆分后（:640,720 记录 AP-4 拆分史）的剩余过渡态；props 分视图专属使新增视图继续膨胀接口
- **修复方案**：延续既有 controller 拆分方向（对照 chat-skills-controller 模式）：① 按职责块抽 FontScaleController / FindHighlightController / DownloadController 等；② 子组件句柄登记制（对照 files-modes-controller.ts:120 「消 `as any` 穿透」先例）取代散布 querySelector；③ 单视图专属 props 上提为视图侧 wrapper 或模式判定
- **回归验证**：`npm run test -- tests/preview-pane.spec.ts`（同名）+ search-highlight-units / md-viewer / file-card spec + `npm run build`

### AP-2 预览内容/令牌/脏标 三态多真相源手工同步 [P2] [status: pending]
- **形态**：Duplicated State Source（受控 prop + 内部 @state 双真相源）
- **证据**：`preview-pane.ts:767-778`（`content` prop 与 `_content` 编辑副本靠 willUpdate 手工对账）；`preview-pane.ts:1411-1415`（组件自写受控 prop `this.tokens = null` 打断陈旧对齐）；`preview-controller.ts:238-259`（saved 回调清 tokens 再重拉回填）。注释自证历史闪回 bug："保存后一秒变回旧内容的根因"（preview-pane.ts:1411-1414）、"content 回填防宿主旧值回跳"（preview-controller.ts:243-244）。`dirty` 另有三层镜像（组件事件→controller 镜像→视图消费），丢弃路径靠命令式 `getPane().discard()` 复位，一处漏调即失步
- **风险**：每次新增「保存后刷新/丢弃/切换」路径都要重新推演三处交接时序——闪回类 bug 已发生过，时序约定是隐性契约，无类型护栏
- **修复方案**：以 controller 的 `PreviewState` 为单一真相源：`_content` 编辑副本上收到 controller（view-model 层），组件只渲染传入值；`tokens` 自清改为 saved 生命周期事件由 controller 统一驱动；`dirty` 改由 `_content !== content` 派生而非三处镜像
- **回归验证**：preview-pane spec + `tests/test_web_preview_formats.py`（后端契约侧）+ `npm run build`

### AP-3 preview-controller open/openHit 无请求序号守卫 [P2] [status: done(b1c1482c)]
- **形态**：Race Hazard（守卫过窄）
- **证据**：`utils/preview-controller.ts:139-152`（open）与 `:159-195`（openHit）fetch→落 state 无 seq/path 复查；仅 `_reloadTokens():267` 有 `path === path` 复查。`preview-pane.ts:813` updated() 有恢复侧防护，但 fetch 写 state 一侧无守卫——快速连点两个文件时先发请求后到响应可覆盖新文档。对照 pdf-viewer `_loadSeq` 代数守卫（pdf-viewer.ts:282 起 11 处回跳点检查）——同仓已有正确范式，此处未跟进
- **风险**：移动端列表连点/弱网下显示错文档（路径 A 的内容配路径 B 的标题/行定位），用户可感；当前 demo 语料点速慢不显形
- **修复方案**：照 `_loadSeq` 范式给 controller 加请求代数：`const seq = ++this._openSeq`，每个 await 回跳点 `if (seq !== this._openSeq) return`
- **回归验证**：新增 controller 级竞态单测（连开两文件断言终态为后者）+ preview-pane spec + `npm run build`

### AP-4 pinch 手势双实现 + image-viewer 魔法数 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming / Magic Numbers
- **证据**：`pdf-viewer.ts:918-950`（_bindPinch：hypot 距离→ratio→clamp，用命名常量 SCALE_MIN/MAX=0.3/5）与 `image-viewer.ts:221-241`（_pinchDist 基线→ratio→clamp，用裸字面量 `Math.max(0.5, Math.min(5, …))`）——同一 pinch 公式两份独立实现且阈值域不同（0.3 vs 0.5）。`image-viewer.ts:201-202` 双击判定 1.5/目标 2.5 亦裸字面量
- **风险**：改缩放阈值/手感时只改一处，两 viewer 缩放行为分裂（复制已现漂移：clamp 风格、常量命名不一致）
- **修复方案**：抽 `utils/pinch-gesture.ts`（基线距离→ratio + clamp 边界参数化），两 viewer 各传自己的 SCALE 域；image-viewer 裸字面量提命名常量
- **回归验证**：`npm run test -- tests/image-viewer.test.ts` + preview-pane spec + `npm run build`

### AP-5 font-scale / code-font-scale 复制漂移 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming（复制后小改漂移）
- **证据**：`utils/font-scale.ts` 与 `utils/code-font-scale.ts` 结构同构；clamp 已复用（code 版 import clampFontScalePct），但 read 函数异常处理不对称——font-scale.ts:16 `localStorage.getItem` 裸调，code 版包 try/catch。禁 cookie/隐私模式环境下前者可抛未捕获异常
- **风险**：独立键为有意设计（注释声明），但防御不对称是漂移不是设计——后续维护者不知哪份是基准
- **修复方案**：抽公共 `readPct(key: string): number`（含 try/catch 与 clamp），两文件各传键名与常量；或合并为单文件双键导出
- **回归验证**：两文件无同名 spec，跑 `npm run test`（全前端单测）+ `npm run build`

### AP-6 marked 公式扩展双份维护 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming
- **证据**：`utils/marked-math.ts:21` 注释自认"与 md-viewer 同款逻辑"——`singleLineDisplayMath` 正则/renderer 是 `md-viewer.ts:215-224` 附近同名扩展的手工复制（独立实例 vs 全局 marked 之故）
- **风险**：改公式渲染（如新的 `$...$` 边界规则）时漏改一份，聊天流与文档预览的数学公式渲染行为分裂
- **修复方案**：把 tokenizer/renderer 工厂抽到 marked-math.ts 导出，md-viewer 以工厂注入自己的 marked 实例而非复制逻辑体
- **回归验证**：md-viewer spec + `npm run build`

### AP-7 阈值魔法数散布 [P3] [status: pending]
- **形态**：Magic Numbers
- **证据**：`md-viewer.ts:1266`（收敛循环 300 帧超时）、`:1273`（stable>=5）、`scroll-jump.ts:83`（`scrollHeight-clientHeight > 8` 的 8px）、`preview-controller.ts:162-163`（行范围 line-10/line+20）、`preview-pane.ts:1546`（debounce 300ms）、`:892`（滚动落盘 300ms）、`pdf-viewer.ts:957`（wheel 步进 1.1）。对照组：`MATCH_NAV_ROUGH_JUMP_PX`（md-viewer.ts:1242）与 SCALE_MIN/MAX 已命名——团队规范存在但未贯通
- **风险**：调手感/性能阈值时全仓 grep 数字，同名同值散布多处易漏改；「为什么是 300 帧」这类约束只活在注释里
- **修复方案**：逐文件提命名常量（SETTLE_MAX_FRAMES / SCROLL_END_EPS_PX / HIT_CONTEXT_LINES 等），同值同语义的跨文件常量合并到单一来源
- **回归验证**：涉及文件的同名 spec + `npm run build`

### AP-8 api/preview.ts 错误分支复制 + controller 裸 fetch 绕封装 [P3] [status: pending]
- **形态**：Copy-and-Paste Programming / Abstraction Inversion（高层重写底层逻辑绕过接口）
- **证据**：`api/preview.ts:25-35`（savePreview）与 `:78-88`（uploadPreview）错误分支同构（json catch→构造专属 Error→三参 throw）各一份；`preview-controller.ts:166-174` 手写裸 fetch 拼参数，而同文件 `:203-240` 已有 `fetchPreview` 封装可复用
- **风险**：错误契约（状态码→Error 类型/消息）改动时漏改副本；裸 fetch 绕过统一鉴权/错误解析入口
- **修复方案**：save/upload 错误分支抽公共 helper（endpoint+Error 构造器参数化）；controller 的范围请求改走 api 层新增的 `fetchPreviewRange`
- **回归验证**：`tests/test_web_preview_formats.py` + preview-pane spec + `npm run build`

### AP-9 noHeader 死属性 [P4] [status: pending]
- **形态**：Dead Props
- **证据**：`preview-pane.ts:601` 声明 `noHeader`，全仓无任何调用点传 true——files-view.ts:1434 恒 `?? false`、:1649 显式 `false`、:1703 mobile 分支不传；search-view.ts:760 注释明言"不再用 focus-header + noHeader"；chat-view.ts:1516 注释"无需传"
- **风险**：接口面虚胖（与 AP-1 同根），误导后续视图以为有此形态
- **修复方案**：随 AP-1 拆分时删除该 prop 及 :1946 分支判定（记录即处置，删除属低风险清理）
- **回归验证**：preview-pane spec + `npm run build`

### AP-10 观察项（不动代码，记录备查） [P4] [status: pending]
- `md-viewer.ts:890`：`img.addEventListener("load", apply, { once: true })` 无 dataset.bound 防护，updated() 多触发路径可重复挂——apply 幂等故当前无害；若未来 apply 非幂等需补防
- `pdf-viewer.ts:966`：`_bindKeys` 内联箭头函数无 remove——监听在自身元素上随 GC，firstUpdated 仅一次不叠加；keep-alive 场景（mcp-servers-section.ts:329 先例）若引入 pdf-viewer 需复查
- `md-viewer.ts:895-899` `_anchorBlocks()` 每次全量 querySelectorAll 被 4 个高频方法调用——受 rAF 节流且缓存失效时机复杂（懒渲染新增块），无 profiling 证据不定罪
- `pdf-viewer.ts:430-461` rAF 每帧 rect 读取+字符串 key——注释已给出弃 ResizeObserver 的实证理由（首次渲染位移不触发 RO→顶部灰边），权衡记录在案

## 三、新型态

（无——本范围发现均可归入既有词汇表）

## 四、反证归档（审计中排除的嫌疑，留档防复审误判）

- **z-index 军备竞赛**：不成立——tokens.css:24 有层叠分层规范（AP-4 修复产物），全部目标文件使用 `--cortex-z-*` 变量
- **主题越界劫持**（历史事故）：已修——code-theme.ts:1-8 作用域声明 + cm-editor.ts:364-368 markdown 模式判定 + code-palette.ts:69-74 结构色派生，双轨隔离清晰
- **portal 监听叠加**：已修——pdf-viewer.ts:903-916 句柄数组 + :648-651 修复记录（AP-8）
- **文档加载竞态**：已防——`_loadSeq` 代数 11 处回跳点检查 + 过期实例显式 destroy（pdf-viewer.ts:282-899）
- **innerHTML 注入面**：不成立——两条路径均过 `sanitizeHtml`（md-viewer.ts:672,1505），关键词高亮用 TreeWalker 文本节点替换（:1383 注释明示防 XSS）
- **跳转定位不收敛**：不成立——`_settleTo` 收敛循环至 delta≤1px + gen 失效防竞态（md-viewer.ts:1260-1288）；`scrollToSourceLine` 两帧简化版是编辑切换专用路径（:964-966 决策注释）
- **挂/卸不对称**：不成立——scroll-jump.ts:53-76 attach 幂等/detach 清监听+RO；md-viewer.ts:730-745 严格配对；preview-pane.ts:856-868 click/keydown 配对完整
- **pageStarts 死属性嫌疑**：反证排除——pdf-viewer.ts:112-118 `lineToPage` 二分消费 + preview-pane.ts:2040 传递链完整
- **`_codeSelection` 镜像**：有意设计——注释声明"选区态归组件自治，宿主仅镜像驱动按钮显隐"（preview-pane.ts:645-647），标准单向数据流

## 五、执行记录
| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-11-15 | 第一批 | AP-3 | done(b1c1482c) |
|---|---|---|---|
