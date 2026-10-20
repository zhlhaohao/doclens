# 前端对话页面 反模式审计台账

> 审计日期：2026-10-20｜点名范围：`doclens/web_v2/frontend` 对话页面（feature 轨）｜机械扫描：全仓（`as any` 密度、裸 `fetch(` 密度、行数 top 文件、跨文件私有访问、硬编码颜色守卫、架构红线测试）

## 〇、范围界定

「前端对话页面」按依赖关系圈定为 **13 个文件**（对话页视图 + 其专属子组件 + 对话 API/状态层）：

| 文件 | 行数 | 职责 |
|---|---|---|
| `src/views/chat-view.ts` | 1833 | 对话页顶层视图（会话 CRUD / SSE 状态机 / 预览编排 / 5 个 dialog 宿主） |
| `src/views/chat-timeline.ts` | 162 | 消息+回退分隔线合成纯函数 |
| `src/components/chat-message.ts` | 575 | 单条消息渲染（markdown / KaTeX / 图片 / 参考资料锚点） |
| `src/components/chat-tool-trace.ts` | 443 | 工具调用轨迹（diff / 折叠 / 复制） |
| `src/components/chat-stream.ts` | 171 | 流式滚动容器 |
| `src/components/ask-card.ts` | 449 | ask_user_question 交互卡片 |
| `src/components/input-box.ts` | 809 | 对话输入框（附件 / 斜杠菜单 / 历史 / 快捷键） |
| `src/api/chat.ts` | 149 | SSE 流式对话客户端 |
| `src/api/ask.ts` | 66 | 提问答交流程 |
| `src/api/client.ts` | 公共 | fetch + `streamSSE` 封装（仅核对是否被绕过） |
| `src/state/store.ts` | 471 | 全局 store（订阅模式） |
| `src/state/types.ts` | 336 | 对话相关类型 |
| `src/utils/session-memory.ts` | 112 | 会话记忆（localStorage，只存"选择"） |
| `src/utils/preview-controller.ts` | 309 | 预览面板控制器（三宿主共用） |

**未纳入**（共享组件，非对话页专属）：`preview-pane.ts`、`md-viewer.ts`、`toast-stack.ts`、`pst-email-list.ts` 及各会话 dialog；如需扩展请另行点单。

## 一、判据声明

- **栈清单**：`references/frontend.md`「Lit 组件（组件工程形态）」7 条（复检日期 2026-10-20：检索 Lit 官方文档 / LogRocket / MDN SSE / React 状态管理反模式，结论——现有 7 条仍覆盖当前实践，未发现需新增的主流判据；SSE 客户端资源管理作为本次按项目技术事实补充的单条判据）
- **通用兜底**：`references/general.md`「前端模块层 + 组件层 + 功能层」三节，原样装载不裁剪
- **仓库纪律文档（附加判据）**：
  - 根 CLAUDE.md「前端弹窗一律用原生 `<dialog>` + `showModal()`」「样式只用 tokens.css 变量」「前端改动必须 `npm run build`」——本组无违规（`chat-view.ts:579-585` 的 dialog 生命周期与纪律一致）
  - `tests/test_architecture.py` 前端硬编码颜色守卫——**已跑，5 项全绿**
- **探测到的栈**：Lit 3 + TypeScript 5.5 + Vite 5；markdown 走 marked + DOMPurify；SSE 走 `fetch` + `ReadableStream`（非 EventSource）

**机械扫描结论**：
- `as any`：对话页相关文件 **0 处**（全仓 20 处，均在非对话模块）
- 裸 `fetch(` 绕过 `api/client.ts`：**1 处**（`preview-controller.ts:157`，见 AP-5）
- 跨文件私有成员访问（`#private` / 私有字段穿透）：**0 处**
- 硬编码颜色：0 违规（守卫测试通过）
- 行数 top：`chat-view.ts` 1833 行为本域最大（God View 候选，见 AP-10）

## 二、发现条目

### AP-1 input-box 文档级 click 监听无 disconnectedCallback [P2] [status: pending]
- **形态**：ReactiveController 挂/卸不对称（栈清单 Lit §2）
- **证据**：`src/components/input-box.ts` 全文**没有 `connectedCallback` / `disconnectedCallback`**；`_toggleMenu`（:581）与 `_onAttachClick`（:756）在菜单打开时 `document.addEventListener("click", this._onDocClick)`，摘除只发生在三条菜单动作路径（:566/:573/:595）与 `_onDocClick` 自身（:590）。菜单打开状态下组件被卸载（切换会话 / 路由离开）→ document 监听与闭包永久残留，闭包持有已卸载组件。
- **风险**：泄漏 + 幽灵回调（已卸载组件仍响应 document click、写 @state）；在同一浏览器会话内反复进出对话页会累积监听。
- **修复方案**：加 `connectedCallback`/`disconnectedCallback` 对称挂卸；或改为 `_menuOpen` 变化时统一挂/摘（`updated()` 里对账），并把 4 处手工 remove 收敛为一个 `_detachDocListener()`。
- **回归验证**：`npm run build`（tsc + vite）；`npx vitest run tests/input-box.spec.ts`。

### AP-2 chat-tool-trace 计时器未登记且无 disconnectedCallback [P2] [status: pending]
- **形态**：ReactiveController 挂/卸不对称 + Copy-and-Paste（栈清单 Lit §2；兜底 Copy-and-Paste Programming）
- **证据**：`src/components/chat-tool-trace.ts:306` 与 `:319` 两处 `setTimeout(() => { this._copied = false }, 2000)` 均未保存句柄，组件**无 `disconnectedCallback`**；同组 `chat-message.ts:331,366` 对 `_copyTimer` 做了登记 + 清理。同一"复制成功 2s 复位"功能两套实现，一侧清理一侧漏。
- **风险**：卸载后 2s 内计时器回调仍写已卸载元素的 @state（Lit 调度无效更新）；两处复制逻辑已现行为分裂（清理与否），继续漂移则 bug 分叉。
- **修复方案**：`_copied` 复位统一走一个 `_scheduleCopiedReset()`（保存句柄 + `disconnectedCallback` 清理）；`_onCopy` 的成功/降级两分支合并（:306 与 :319 只差在是否兜底 execCommand）。
- **回归验证**：`npx vitest run tests/chat-tool-trace.spec.ts`；`npm run build`。

### AP-3 `streamSSE` 读取器未释放、流未取消 [P2] [status: pending]
- **形态**：SSE 客户端资源管理（本次按项目事实补充的判据）
- **证据**：`src/api/client.ts:56-79` `const reader = res.body.getReader()` 后进入 `while (true)` 循环，**无 `releaseLock()`，无 try/finally `reader.cancel()`**。消费方提前 `break` 出 for-await（非 abort 的主动退出）时 generator 无兜底，底层 body 不取消；异常路径同理。
- **风险**：连接句柄与缓冲区滞留至 GC；同类 SSE 通道（对话 / 日记 / 深度读）共用此函数，泄漏面跨功能。
- **修复方案**：`try { ... } finally { try { await reader.cancel() } catch {} ; reader.releaseLock() }`；注释说明"abort 由调用方 signal 负责，此处兜底主动退出"。
- **回归验证**：`npx vitest run tests/api-client-sse-signal.spec.ts`；`npm run build`。

### AP-4 preview-controller `open`/`openHit` 竞态无护栏 [P2] [status: pending]
- **形态**：Race Hazard（兜底·功能层）
- **证据**：`src/utils/preview-controller.ts:133-143`（`open`）与 `:150-186`（`openHit`）在 `await fetch/fetchPreview` 后**无条件 `_set(...)` 落地**，无 AbortController、无"仍指向当前 path"比对；同一 controller 的 `_reloadTokens`（:253-262）却做了 path 比对并注释"防竞态"。快速连点不同文件时，先发后到的响应会覆盖后发的结果。
- **风险**：用户可见的**错文档**——点 A 再点 B，最终面板显示 A。作者已在 `_reloadTokens` 承认该危害，说明这是已知可修模式而非误判。
- **修复方案**：controller 持有 `_reqSeq` 单调计数（或 `_activePath`），await 后比对序号不匹配即丢弃；可复用 `_reloadTokens` 的既有写法。
- **回归验证**：`npx vitest run tests/preview-controller*.spec.ts`（若存在则跑，否则至少 `tests/chat-view-preview.spec.ts`）；`npm run build`。

### AP-5 preview-controller 裸 fetch 绕过 client.ts + 响应映射四处重复 [P2] [status: pending]
- **形态**：Hard Code（绕过统一封装）+ Copy-and-Paste Programming
- **证据**：
  - `src/utils/preview-controller.ts:157` `const res = await fetch(\`/api/preview?${params}\`)` 绕过 `api/client.ts` 的 `request()`，**丢失 401 统一 `onUnauthorized` 钩子**；同一端点已有 `api/preview.ts:199 fetchPreview`。
  - `:170-185` 内联把 snake_case 响应逐字段映射成 doc（12 字段），与 `:272-284 _docFrom`、`:286-292 _emptyDoc`、`api/preview.ts:205-218` **四处**维护同一 `PreviewResponse→doc` 形态。
  - `:160` 的 `"NOT_INDEXED"` 裸串与 `api/preview.ts:221` 各写一份，漂移即静默改判。
- **风险**：鉴权失效路径分叉（裸 fetch 的 401 无人处理）；后端字段增删需同步改四处，已现 4 份副本。
- **修复方案**：改用 `fetchPreview`；响应→doc 只保留 `_docFrom` 一个真相源，`openHit` 内联映射与 `_emptyDoc` 改为委托；`NOT_INDEXED` 提为 `api/preview.ts` 导出常量。
- **回归验证**：`npx vitest run tests/preview-pane.spec.ts tests/api-preview.spec.ts`；`npm run build`。

### AP-6 chat-message 每次 render 全量重解析 markdown，无缓存 [P2] [status: pending]
- **形态**：模板内重计算（栈清单 Lit §4）
- **证据**：`src/components/chat-message.ts:479-483` `renderBubble` 对 assistant 正文每次执行 `chatMarked.parse(...)` + `linkifyReferences(...)` + `sanitizeHtml(...)`，**无任何缓存**；流式期间每来一个 token delta，当前消息的整段已累积 markdown 就全量重解析（O(n²) 累积）。同组的 `chat-tool-trace.ts:270-273` 对 lineDiff 做了记忆化，注释明言"不记忆化则每 delta 重算"——同仓库已知该模式、markdown 侧却未做。
- **风险**：长回答流式期间主线程持续做重复解析 + 三遍字符串处理，长对话（几十条消息）叠加 `chat-view.ts:1738` 每次 render 重建 `mergeTimeline` 结果，滚动/输入可感知卡顿。
- **修复方案**：以 `(content, error)` 为键做单条 memo（组件实例内 `_mdCache`，或把 content→clean HTML 提成带 `Map` 上限的纯函数）；`mergeTimeline` 结果按 `(messages.length, dividers.length)` 缓存或改由 store 增量维护。
- **回归验证**：`npx vitest run tests/chat-message.spec.ts tests/chat-message-katex.spec.ts`；`npm run build`。

### AP-7 ask-card `willUpdate` 把 props 拷成 4 份内部态 [P2] [status: pending]
- **形态**：受控属性与内部 @state 双真相源（栈清单 Lit §1）
- **证据**：`src/components/ask-card.ts:216-235` `willUpdate` 把 `ask` / `resolvedAnswers` 手工拷贝进 `_selected/_others/_status/_answers` 四份内部态；:218-229 的注释本身在描述与反模式搏斗——父组件重渲染导致引用变化会"复活"已答卡片，只能靠 requestId 比对防御。同一份"答案"存在 prop（`resolvedAnswers`）与 state（`_answers`）两份（:233）。
- **风险**：已答卡片闪回 / 重复提交；每新增一个交互维度就要再加一份内部态与一条防御注释。
- **修复方案**：内部态收敛为单个 `_local: { selected, others, status }`，其生命周期以 `requestId` 为键（`requestId` 变化才重置），确认后状态由 prop 单向驱动；把 :218-229 的 requestId 防御提成显式的 `_stateKey` 比对。
- **回归验证**：`npx vitest run tests/ask-card.spec.ts`；`npm run build`。

### AP-8 input-box 提交复位语义拆在父子两侧 [P2] [status: pending]
- **形态**：Duplicated State Source（兜底·前端模块层）
- **证据**：`src/components/input-box.ts:472-484` `_submit` 内**图在这里清、文字由宿主清**（:479 注释原文承认）；`value` 是受控 prop，但 `_onInput`（:397）本地改写 `this.value` 后又发 `input-change` 让宿主回写。
- **风险**：任何一条"提交后复位"路径漏掉一侧即残留（清空文字但留着图，或反之）；新增提交入口要同时改父子。
- **修复方案**：明确单向契约——组件内部不回写 `value`，提交后只发 `submit` 事件（含 payload），父组件统一重置 `value` + `images`；或反过来全部组件内管理，二选一。
- **回归验证**：`npx vitest run tests/input-box.spec.ts tests/chat-view-stream.spec.ts`；`npm run build`。

### AP-9 chat-view 1833 行 God View（业务/取数/编排混装） [P2] [status: pending]
- **形态**：Smart/Dumb Component Imbalance + God Object（兜底·前端模块层 / 后端模块层同名形态）
- **证据**：`src/views/chat-view.ts` 单文件承担 7 类职责——会话 CRUD 含导入导出（:978-1030）、星标排序（:782-788）、SSE 状态机（:1121-1236）、generating 轮询（:922-947）、预览面板 10+ 事件编排（:1554-1618）、5 个 `<dialog>` 宿主、20 个 @property/@state。
- **风险**：改任一会话功能都 touch 它（Divergent Change）；无法单独测试任一职责（只能整体挂载 1833 行组件）。
- **修复方案**：按职责抽三个协作对象——`session-actions.ts`（CRUD/导入导出/星标）、`chat-stream-runner.ts`（SSE 状态机 + 轮询）、`preview-bridge.ts`（预览事件编排）；chat-view 只剩模板 + 装配。契约变更：仅内部。
- **回归验证**：`npx vitest run tests/chat-view-session.spec.ts tests/chat-view-stream.spec.ts tests/chat-view-preview.spec.ts`；`npm run build`。

### AP-10 chat-view `_activeAsk` 与 store.pendingAsk 双写双清 [P3] [status: pending]
- **形态**：Duplicated State Source（栈清单 Lit §1 的跨层变体）
- **证据**：`src/views/chat-view.ts:483` `_activeAsk`（@state）与 `store.pendingAsk` 同时持有同一 PendingAsk；:1164-1165 同时写入、:1233-1234 finally 同时清空。:481-482 注释说明分离动机（提交后输入恢复但摘要保留至流结束）——有意为之，但同步靠两处手工双写。
- **风险**：任一路径漏写/漏清即闪回；已是有注释的"知道要小心"状态。
- **修复方案**：store 侧改存 `pendingAsk` + `pendingAskSummary` 两个字段（而不是让组件再存一份完整对象），组件只读 store。
- **回归验证**：`npx vitest run tests/chat-view-stream.spec.ts tests/ask-card.spec.ts`；`npm run build`。

### AP-11 generating 轮询（Busy Waiting） [P3] [status: pending]
- **形态**：Busy Waiting（兜底·功能层）
- **证据**：`src/views/chat-view.ts:922-947` `setInterval` 每 5s 拉 `fetchSessionDetail(metaOnly)` 探测 `generating` 标志；对话主通道本就是 SSE，但"后台续跑完成"这一事件无推送通道。
- **风险**：每个打开着的会话页恒定 5s 一次请求；多标签页叠加。ADR-0028 有案可查（前端断连续跑），属**有文档的降级设计**而非失误——但形态成立。
- **修复方案**：后端补一条完成事件（SSE 或轻量 `/api/sessions/{id}/generating` 长轮询），前端退化为事件驱动；短期可把间隔做成指数退避（5s→30s 封顶）降低恒定开销。
- **回归验证**：`npx vitest run tests/chat-view-stream.spec.ts`；`npm run build`。

### AP-12 菜单项可访问性缺口 [P3] [status: pending]
- **形态**：可访问性高频违规（栈清单 frontend.md §语义 HTML）
- **证据**：`src/components/input-box.ts:652/669/675/780/783` 菜单项全部 `<div role="menuitem" @click=...>`——**无 tabindex、无 keydown**，键盘不可达；`role="listbox"`（:690）未与输入框 `aria-activedescendant` 关联；主输入 `input/textarea`（:709/712）只有 `placeholder`，无 label/aria-label；`ask-card.ts:375-380` 的 Other 输入同样无 label。对照：按钮侧 `aria-label` 齐全（:603/629/640/740/797）。
- **风险**：键盘/读屏用户无法选择技能与搜索模式（对话页核心操作）。
- **修复方案**：菜单项改 `<button role="menuistitem">` 或补 `tabindex="0"` + Enter/Space 处理；输入框补 `aria-label`；listbox 补 `aria-activedescendant`。
- **回归验证**：`npx vitest run tests/input-box.spec.ts tests/ask-card.spec.ts`；`npm run build`。

### AP-13 chat-tool-trace `_userToggled` 单向闩锁 [P3] [status: pending]
- **形态**：受控属性与内部 @state 双真相源（栈清单 Lit §1）
- **证据**：`src/components/chat-tool-trace.ts:265-291` `_expanded`（@state）同时被 (a) `willUpdate` 按 `steps` 的 running 态自动翻转、(b) 用户点击 `_toggle` 翻转，靠裸 boolean `_userToggled` 仲裁优先级；:280-281 注释自认置位后"不再覆盖自动行为"，且无复位路径。
- **风险**：用户手点一次折叠后，后续所有工具的自动展开永久失效（跨工具共享同一实例状态）。
- **修复方案**：闩锁改为按工具 id 记录（`_userToggledIds: Set<string>`），新一轮运行开始（steps 全量替换）时清空；或把"是否自动展开"降为一个显式 prop。
- **回归验证**：`npx vitest run tests/chat-tool-trace.spec.ts`；`npm run build`。

### AP-14 input-box 手工 DOM 写绕过响应式 [P3] [status: pending]
- **形态**：Action at a Distance（兜底·功能层）+ Copy-and-Paste
- **证据**：`src/components/input-box.ts:401-403` 与 `:434-435` 各自 `renderRoot.querySelector("button")` 直接改 `btn.disabled`，绕开 Lit 渲染管线；两处逐字重复。DOM 态与响应式态并存，任何新渲染路径忘记这套手工同步就出现按钮态错位。
- **风险**：新增发送入口/条件时按钮可点态与真实可提交态不一致。
- **修复方案**：`disabled` 一律走模板绑定（`?disabled=${this._canSend}`），删掉两处手工写。
- **回归验证**：`npx vitest run tests/input-box.spec.ts`；`npm run build`。

### AP-15 input-box 14 个 @property 承载三种互斥形态 [P3] [status: pending]
- **形态**：Interface Bloat（兜底·组件层）
- **证据**：`src/components/input-box.ts:322-354` 14 个 @property 服务三种互斥消费形态——`modes`（搜索分裂钮）/ `skillItems`（技能菜单，"与 modes 互斥，modes 优先" :345）/ `slashItems`（仅 chat :350）/ `attachments`（仅对话）；互斥规则只能靠 JSDoc 口头约束。另有 `chat-view.ts:1702-1724` 给 `preview-pane` 单处传 12 property + 9 事件（21 绑定），外加 `PreviewController`（:491-504）第二条控制通道。
- **风险**：任一调用方都可能传入互斥组合而无人拦截；新增形态继续往同一组件塞属性。
- **修复方案**：按形态拆 wrapper 组件（`<chat-input>` / `<search-input>` / `<file-input>`）共享内部实现，或至少把互斥组合做成判别联合 prop（`variant: "chat" | "search" | "file"`）由模板分支。
- **回归验证**：`npx vitest run tests/input-box.spec.ts`；`npm run build`。

### AP-16 对话状态用裸字段布尔组合表达 [P3] [status: pending]
- **形态**：Primitive Obsession（兜底·组件层）
- **证据**：`src/state/types.ts:119` `ChatViewState.state: FocusState`（"initial"|"focus"）与 `store.ts:54-60` 的 `state × streaming × pendingAsk` 三个字段组合才是真实状态机——"空闲 / 流式中 / 悬置待答"无单一判别联合；消费侧自行拼裸串。同仓库 `PreviewState` 已是判别联合，两种范式并存。另：`types.ts:73` `images?: { data; media_type }[]` 匿名内联重复 `api/chat.ts:37-40` 的 `ChatImage`（后者注释自称 ADR-0034 契约单源）。
- **风险**：新增状态要同时改三个字段的写入点；消费方判断条件散落且易漏组合。
- **修复方案**：`ChatViewState` 改判别联合 `{ kind: "initial" } | { kind: "focus"; session; streaming: boolean; pendingAsk?: PendingAsk }`；`types.ts` 复用 `ChatImage`。
- **回归验证**：`npx vitest run tests/chat.spec.ts tests/chat-view-session.spec.ts tests/chat-view-stream.spec.ts`；`npm run build`。

### AP-17 魔法值/领域枚举多处维护 [P3] [status: pending]
- **形态**：Magic Numbers / Magic Strings + Hard Code（兜底）
- **证据**：
  - toast 时长散值 `2500/3000/5000` 在 `chat-view.ts` 出现 15+ 次（:753/755/777/984/986/1008/1022/1024/1028/1168/1197/1266/1358/1360…）；
  - 工具名 `"write_file"` / `"edit_file"` 字面量在 `chat-tool-trace.ts:76/78/356` 与 `SHELL_TOOLS` / `TOOL_ICON` 至少三处各自维护同一领域集合；
  - `ask-card.ts:11` `GUARD_CARD_DISMISS_MS = 122_000` 在前端硬编码复刻后端 `GUARD_TIMEOUT_SECONDS`(120s)+2s（:7-10 注释自认跨进程耦合）。
- **风险**：调超时/加工具要改多处；跨进程超时不改则卡片永不等超时。
- **修复方案**：toast 时长提为 `TOAST_DURATION = { short, normal, long }`；工具名集合收敛到 `state/tool-names.ts` 单源；`GUARD_CARD_DISMISS_MS` 由后端配置接口下发（或至少从会话配置读取）。
- **回归验证**：`npx vitest run tests/chat-tool-trace.spec.ts tests/ask-card.spec.ts`；`npm run build`。

### AP-18 chat-view initial/focus 两分支复制 input-box 绑定 [P4] [status: pending]
- **形态**：Copy-and-Paste Programming（兜底·前端模块层）
- **证据**：`src/views/chat-view.ts:1767-1786` 与 `:1668-1685` 各手写一份 `<input-box>`，11 个绑定逐行重复（含同一组 `(e: any) => ...` 箭头）。
- **风险**：新增一个 input 事件要改两处，漏一处即两视图行为分裂。
- **修复方案**：抽 `_renderInputBox()` 私有方法（或模板片段）统一渲染，差异化部分用参数。
- **回归验证**：`npx vitest run tests/chat-view-*.spec.ts`；`npm run build`。

### AP-19 父组件直查子组件内部节点 [P4] [status: pending]
- **形态**：shadow DOM 穿透打洞（栈清单 Lit §3，限于直接子节点，程度轻）
- **证据**：`src/views/chat-view.ts:1621` `this.shadowRoot?.querySelector("toast-stack") as ToastStack` 后直调其方法；`:1444` `renderRoot.querySelector("input-box")` 后调 `focus()`；`:492` `getPane: () => this.shadowRoot?.querySelector("preview-pane")`。
- **风险**：查的是自身 shadow 树的直接子节点（Lit 惯用法），未穿透到子组件 shadow 内部，故不构成真封装破坏；但字符串选择器 + 类型断言脆弱（改名即静默 null）。
- **修复方案**：改 `@query("toast-stack")` / `@query("input-box")` 装饰器获得类型安全；`PreviewController` 的 `getPane` 回调保持现状即可。
- **回归验证**：`npx vitest run tests/chat-view-*.spec.ts`；`npm run build`。

### AP-20 `reloadAfterSave` 选项行为等价（死分支） [P4] [status: pending]
- **形态**：Dead Option（兜底·组件层 Dead Props 变体）
- **证据**：`src/utils/preview-controller.ts:62-63` 声明 `reloadAfterSave: "tokens" | "full"` 两态语义，但 `_reloadFull`（:266-268）实现只有 `await this._reloadTokens()`，而 `_reloadTokens` 本就整文档替换（`_docFrom(r)`）——两选项行为完全等价。
- **风险**：files 视图传 `"full"` 得到的"管理语义全量重拉"是注释承诺而非代码事实；后续维护者会以为两条路径有区别。
- **修复方案**：要么实现真正的 full（重取结构 + 文档），要么删掉选项收敛为单一 `reloadAfterSave: boolean`。
- **回归验证**：`npx vitest run tests/preview-pane.spec.ts`；`npm run build`。

## 三、新型态

无。本次发现均可由栈清单或通用兜底归类。

## 四、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-10-20 | 审计 | 全部 20 条 | 台账建立，等令 |
