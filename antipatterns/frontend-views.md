# frontend/views 反模式审计台账

> 审计日期：2026-11-15｜点名范围：`doclens/web_v2/frontend`（深挖 = `src/views/` 8 文件 7.1K 行）｜机械扫描：`src/` 全目录 158 文件（`as any` / `fetch(` / `shadowRoot.querySelector` 链 / `unsafeHTML`·`innerHTML` / `addEventListener` / `setInterval`·`setTimeout` / `z-index ≥10` / `localStorage`·`sessionStorage` / 空 `catch {}` / 行数 top 文件）
>
> 执行说明：子代理调度连续失败（4+1 次全部 round=1 失败），按技能流程降级为**主代理直接精读枢纽文件**补齐；覆盖 views/ 全部 8 文件的关键切面（grep 骨架 + 定点 ±30 行取证）。

## 一、判据声明

- `references/frontend.md`：装载 Lit 组件工程小节（Lit 3.2 + Vite 5 + Shoelace，探测自 package.json）+ z-index/跳转定位增补条。**联网复检（2026-11-15）**：Lit 3 稳定、无新通用形态需增补，清单不过时。
- `references/general.md`：装载前端模块层 + 组件层 + 功能层三节（不裁剪）+ 数据与契约层相关条目。
- 仓库纪律文档（附加判据）：`doclens/web_v2/frontend/docs/DESIGN.md`（弹窗须原生 `<dialog>`+`showModal()`；样式只用 tokens.css 变量）；CLAUDE.md 前端构建纪律。

## 二、发现条目

### AP-1 chat-view.ts God Object（2396 行，11 个对话框渲染器集于一身） [P2] [status: done(35ade81f)]
- **形态**：God Object（Fowler Bloaters；Divergent Change——会话历史/流式 SSE/技能菜单/vision 闸门/rewind/compact/fork/import/rename/delete-turn/interject 十余种变更原因全落一个文件）
- **证据**：`views/chat-view.ts:2313` render() 同时挂 9 个 `_render*Dialog()`；`:518-627` 约 30 个 `@state` 字段；`:935-2513` 有 11 个 `_render*Dialog` 私有渲染器。改任何对话框/流式事件/历史列表都要 touch 同一文件。
- **风险**：将损——合并冲突热点；每加一个会话级对话框该类再长一截；新人定位成本高。
- **修复方案**：按域拆出子组件或 controller——① 9 个对话框各自提为 `components/chat-*-dialog.ts`（已有 `fork-confirm-dialog` 等独立组件可作模板，chat-view 只留 open 状态与事件接线）；② 流式 SSE 消费循环（`:1651-1709` 起）提为 ReactiveController（如 `ChatStreamController`），view 只订阅其状态；③ 历史列表区块（`_loadHistory`/`_onHistory*`/star-pin）提为 `ChatHistoryController`。每步独立提交。
- **回归验证**：`npm run test -- tests/input-box.spec.ts`（涉及 input-box 交互）+ `npm run test:e2e:search`（会话旅程）+ `npm run build`。
- **执行记录（2026-11-15）**：按方案①变体执行——审计判定时发现 9 个对话框中 7 个已是薄宿主（`<dialog>` 包既有独立组件），真正内联的只有 vision-gate 与 interject 两块。实际改动：新建 `components/vision-gate-dialog.ts`（74 行）与 `components/interject-dialog.ts`（98 行，草稿状态内收于组件、submit 事件出参），chat-view 删除两块内联模板 + 33 行专属 CSS + 死状态 `_interjectDraft`，2396→2335 行。方案②③（SSE 循环/历史列表提 controller）经复核**不执行**：二者与组件 @state 及 store 深耦合，强拆需引入回调网，属 Wrong Abstraction 风险（判据 DRY Misuse）；God Object 主病灶（对话框渲染器堆叠）已消解。回归：chat 域 9 个 spec 136 测试全过；`chat-view-preview.spec.ts` 1 个失败与 settings 域 3 个失败经 stash 对照证实为**预存失败**（与本次改动无关）；`npm run build` 通过。

### AP-2 search-view 双层 shadow DOM 穿透打洞 + `as any` 调私有方法 [P2] [status: done(4014f82f)]
- **形态**：shadow DOM 穿透打洞（Lit 栈清单）+ Abstraction Inversion（高层绕过封装直捣两层子组件内部）
- **证据**：`views/search-view.ts:476-480`：`this.shadowRoot?.querySelector("preview-pane") as any` → `pp?.shadowRoot?.querySelector("md-viewer") as any` → `mdv?.reLocate?.()`——search-view 穿透 preview-pane 的 shadow root 直取 md-viewer 并调用其方法，preview-pane 的封装名存实亡。注释自证成因（`:470-474`：Lit 属性批处理合并导致 updated() 不触发的兜底）。
- **风险**：将损——md-viewer 内部结构/方法名任何调整都静默击穿 search-view（`as any` 无编译期检查）；同类需求会在其他视图复制此模式（files-view/chat-view 已有 getPane 单层穿透的苗头）。
- **修复方案**：preview-pane 暴露公共方法 `reLocate()`（内部转发 md-viewer），search-view 只调 `previewPane.reLocate()`；`getPane()` 返回类型从 `as any` 收敛为具体组件类型。同时在 preview-pane 侧根治"同值重击不触发 updated"：加显式 `requestUpdate('previewLine')` 或将定位信号改为事件下发，删掉 search-view 的兜底穿透。
- **回归验证**：`npm run test -- tests/search-highlight-units.spec.ts tests/md-viewer.spec.ts tests/preview-pane.spec.ts` + `npm run test:e2e:search` + `npm run build`。

### AP-3 files-view.ts God Object 次级（1779 行，文件树/git 改动/深读/预览/上传五域混合） [P2] [status: done(857c0d36)]
- **形态**：God Object + Divergent Change
- **证据**：`views/files-view.ts` 内并存：文件树导航（`_lastDirBefore*`）、git 改动模式（`_changesMode`/`_diffResp`，`:435-441`）、深读模式（`_deepReadMode`/`_hasBooks`，`:450-456`）、上传/下载（`_uploading`）、预览协调、两条分栏拖拽（`:741-789`）。`:504-514` 一个 `_onStoreChange` 里顺序处理 sync 轮次/改动模式退出/深读模式退出三件不相关的事。
- **风险**：将损——git/深读/上传三个 feature 的改动全部汇聚此文件；`_onStoreChange` 无条件 `requestUpdate()`（`:515`）使任何 store 变化都触发整视图重渲染。
- **修复方案**：① git 改动域提为 `components/git-changes-panel.ts`（自带 refresh 公共方法，顺带消解 `:499` 的 `as any` 穿透）；② 深读域同理提组件；③ `_onStoreChange` 改为 selector 订阅（store 已支持 `subscribe(selector, cb)`，见 store.ts 头注释）按切片触发。按域分提交。
- **回归验证**：`npm run test -- tests/file-card.spec.ts tests/preview-pane.spec.ts` + `npm run test:e2e:search` + `npm run build`。

### AP-4 z-index 裸数字散布，无分层规范 [P3] [status: done(114a67fa)]
- **形态**：z-index 军备竞赛（前端栈清单，本仓已有实证史——PDF portal 被压灰底）+ Magic Numbers
- **证据**：全仓 z-index 值域从 10 到 10000 无谱系：`views/files-view.ts:267` z-index:10000、`:278` 9999；`components/download-overlay.ts:22` 9999；`components/image-viewer.ts:61` 9999；`app.ts:80` 2000；`styles/dialog-frame.ts:25` 1000；`components/app-bar.ts:43,242` 50/60；`utils/side-drawer.ts:13` 30。两个 9999 互相不知道对方存在，下一个浮层只能再加 1。
- **风险**：将损——历史上已爆过 portal 层叠 bug（栈清单实证条）；每加浮层都是一次猜数。
- **修复方案**：在 tokens.css 定义分层变量（如 `--z-base/--z-drawer/--z-overlay/--z-dialog/--z-toast`，步进 100），全仓替换裸数字；dialog 已在 top-layer 的元素删除冗余 z-index。
- **回归验证**：`npm run build` + 人工过一遍浮层界面（预览 overlay/图片查看器/下载浮层）。

### AP-5 空 `catch {}` 静默吞错 20+ 处 [P3] [status: done(7e8029dc)——审计收口：全域有正当理由，仅补 client.ts:32 注释]
- **形态**：Error Hiding（`catch {}` 无日志无上报）
- **证据**：全仓 ≥20 处空 catch：`app.ts:203,238`、`watch-stream.ts:34,135`、`api/chat.ts:175`、`api/client.ts:32`、`components/chat-message.ts:524,650`、`components/app-bar.ts:424` 等。**反证部分**：探测类静默是有意设计且有注释（`files-view.ts:523` git 根探测、`:534` 家目录探测、`chat-view.ts:1172` 网络抖动）；但 `api/client.ts:32`、`api/chat.ts:175`、`chat-message.ts:524`（内容渲染路径）未见注释说明吞错理由。
- **风险**：将损——渲染/API 链路错误静默 = 用户看到"没反应"，排障无入口（无日志、无 toast）。
- **修复方案**：逐处分类——探测类保留但补一行注释（部分已有）；渲染/IO 类至少 `console.warn` 或落入既有 toast 通道；`api/client.ts:32` 响应解析失败应让 ApiError 透出。
- **回归验证**：`npm run build` + 同名 spec。

### AP-6 settings 字段契约手工双向同步 [P3] [status: done(a5db3e45)]
- **形态**：手抄跨文件契约字面量（前后端各一份字段清单，靠注释维系的漂移风险）
- **证据**：`views/settings-fields.ts:4-6` 注释自证："IMPORTANT: keep the envVar values in sync with KNOWN_KEYS in cortex/web_v2/config_store.py"——同步纪律靠人肉，无测试/生成物守卫。同文件 `:59-60` 出厂基准值"与包内 .env.example 同步"是第二处手工对齐点。
- **风险**：将损——后端加键前端忘加 = 设置项在 UI 不可见（静默缺口）；历史同形态（前后端格式清单漂移 8 后缀）已实证过此类漂移会发生。
- **修复方案**：加守卫测试：pytest 读 config_store.KNOWN_KEYS 与 settings-fields.ts 的 envVar 集合比对（前端导出 JSON 快照或测试解析 ts 文本取 `envVar: "..."` 集合），漂移即红。.env.example 基准值同法。
- **回归验证**：新增测试 + `pytest tests/test_skills_config.py -q`（相邻配置套件）。

### AP-7 登录页密码输入框无关联 label（可访问性） [P3] [status: done(2f909375)]
- **形态**：表单控件缺 label（WCAG 高频违规之首）
- **证据**：`views/login-view.ts:187-199` `<input class="pin-input" type="password">` 无 `<label for>`、无 `aria-label`、无 `aria-labelledby`（placeholder "●●●●●●" 不是标签——输入即消失）。同页 `:171` 的 dots 区有 aria-label，说明项目有 ARIA 意识但密码框漏了。
- **风险**：将损——屏幕阅读器用户无法识别该输入框用途；其余无碍。
- **修复方案**：`aria-label="访问密码"` 一行修复。
- **回归验证**：`npm run build`（无同名 spec，改动一行）。

## 三、反证归档（像反模式但实为有意设计，不进台账条目）

| 观察 | 反证 |
|---|---|
| chat-view SSE 流直写全局 store（疑似「全局存储无归属守卫」） | `chat-view.ts:1654-1666` 有 `stillOwn()` 归属守卫 + 2026-10-22 串台修复注释；`_tabSessionId` 用 sessionStorage 按标签页隔离（`:1253-1270`）——多标签页防劫持是**有意设计且有文档** |
| generating 5s setInterval 轮询（疑似 Busy Waiting） | `chat-view.ts:1177-1181` 注释：断开续跑场景的恢复通道，metaOnly 轻量端点，离开会话自清——事件源（SSE 断线）不可用时的合理兜底 |
| files-view/search-view 大量 `.shadowRoot.querySelector("dialog")` | DESIGN.md 规定弹窗用原生 `<dialog>`+`showModal()`，组件内查询自身 shadowRoot 属正常 Lit 用法（非穿透他人） |
| files-view 事件监听 7 处（疑似泄漏） | `:793-798` disconnectedCallback 配对摘除，配对完整 |
| diary-view/settings-view window 事件 | 均有 disconnectedCallback 配对摘除 |
| search-view 分页 | 服务端分页（`offset/limit` 传后端并用后端 clamp 值 `:439`），非前端全量拉取 |
| localStorage 多处使用 | 抽查均为视图偏好持久化（分栏宽/星标置顶/城市选择），非共享业务状态；chat 会话记忆 localStorage+sessionStorage 双轨是防劫持设计（chat-view.ts:1158-1163 注释） |

## 四、灰色项（证据不足，待复查）

- **chat-view.ts store 订阅粒度**：`:644` `store.subscribe(() => { this.requestUpdate(); ... })` 无 selector——任何 store 切片变化都重渲整个 chat-view。store.ts 头注释声称支持 `subscribe(selector, cb)`，未确认是否此处有意全订阅（同 files-view.ts:515）。若确认非有意，可并入 AP-1 的 controller 拆分一并处理。
- **`app.ts:183`** `document.querySelector("app-bar")?.shadowRoot?.querySelector("toast-stack")`——跨组件穿透取 toast-stack（`utils/toast.ts:23,35` 同模式）。疑似 toast 通道缺乏全局事件总线所致，未深挖 toast-stack 的挂载拓扑，暂列灰色。

## 五、执行记录

| 日期 | 令 | 条目 | 结果（commit） |
|---|---|---|---|
| 2026-11-15 | 修 AP-1 | AP-1 | done(35ade81f→amend ed2fafbd)：新建 vision-gate-dialog.ts / interject-dialog.ts，chat-view.ts 2396→2335 行；chat 域 136 测试过，build 过；chat-view-preview 1 败 + settings 3 败为预存失败（stash 对照证实）。 |
| 2026-11-15 | 按你的想法继续修 | AP-8 | done(b24db34e)：断言同步即梦×4 字段（18→22、AI tab 5→9）；根因 = jimeng 两提交加字段未同步测试（测试滞后，非固化错误）；22 测试过，build 过。 |
| 2026-11-15 | 按你的想法继续修 | AP-2 | done(4014f82f→amend 234a44ee)：preview-pane 新增公共 `reLocate()`（内部转发 md-viewer + 自理 updateComplete），search-view 删双层穿透/`as any`、querySelector 泛型收敛 PreviewPane；130 单测过、build 过、E2E 仅 S7/S8 预存失败（基线对照全同）。 |
| 2026-11-15 | 继续修 | AP-9 | done(f0167682)：S7 断言词改「第五」（分词失联）、S8 固定等待改轮询 + 补 shadow 层、markInView 大小写不敏感；4 例全过。修复中暴露 S6 异常 → 记 AP-10。 |
| 2026-11-15 | 继续修 | AP-10 | done(7ee8221e)：实证非功能回归（定位完全正确，Sheet03 块贴顶 33px），是断言语义失联（找第一个 sheet mark = Sheet1 标题）。S6 断言重写为定位语义；E2E 23 过 0 败。 |
| 2026-11-15 | 继续修（除 AP-3） | AP-7 | done(2f909375)：login 密码框补 aria-label；login-view.spec 11 过。 |
| 2026-11-15 | 继续修（除 AP-3） | AP-6 | done(a5db3e45)：新 tests/test_settings_fields_contract.py——前端 envVar ⊆ KNOWN_KEYS 漂移即红 + 高发键反向抽查；3 测试过。 |
| 2026-11-15 | 继续修（除 AP-3） | AP-5 | done(7e8029dc)：全域取证 16+ 处空 catch 均有正当理由（fallback/注释/事件透出），Error Hiding 嫌疑排除；仅补 client.ts:32 注释。 |
| 2026-11-15 | 继续修（除 AP-3） | AP-4 | done(114a67fa)：tokens.css 五档 z 变量（base/raised/overlay/toast/modal），26 文件 47 处裸数字归层替换；128 测试过、build 过。 |
| 2026-11-15 | 修 AP-3 | AP-3 | done(857c0d36)：新 utils/files-modes-controller.ts（252 行）承载改动/深读模式域（模式互斥/diff 取数/目录守卫/技能探测删除/同步轮次），files-view 删 8 个 @state 与 4 方法只留渲染接线；_onStoreChange 改 subscribeSelector；消 2 处 as any 穿透；新增 controller spec 4 例；46 测试过、全量 1076 过、build 过。 |

## 六、修复中新发现（discovered-during-fix）

### AP-8 settings-fields 测试与字段清单已漂移（22 实际 vs 18 断言） [P2] [status: done(b24db34e)]
- **形态**：测试固化/失联——字段清单演进后断言未同步（AP-6 预言的漂移已实证发生）
- **证据**：`tests/settings-fields.spec.ts` 断言 `SETTINGS_FIELDS` 长度 18，实际 22；AI tab 字段集合断言亦失配。settings-view.spec.ts 同因失败 1 项。
- **风险**：已损——CI 红且 AP-6 的守卫缺失被实证。
- **修复方案**：同步断言到 22 条字段真值；落地 AP-6 的前后端守卫测试防再漂移。
- **回归验证**：`npx vitest run tests/settings-fields.spec.ts tests/settings-view.spec.ts`。

### AP-9 E2E search-preview-locate S7/S8 全平台失败（预存，与 AP-2 无关） [P2] [status: done(f0167682)]
- **形态**：测试与实现失联（S7 pptx 定位 mark 未入视口；S8 grep 模式 file-card 未出现/点击后 preview-pane 未出现）
- **证据**：`tests/e2e/search-preview-locate.spec.ts:190,205` 在 AP-2 改动前后 stash 对照均失败（desktop+mobile 共 4 例）；其余用例全过。
- **根因（修复时查明）**：S7 = 断言词「第五页含」被后端分词切碎（query_words=["第五"]），前端按词高亮只标「第五」——断言与分词行为失联；S8 = 固定 1.5s 等待抢在 code-viewer 异步渲染前 + 选择器少穿一层 shadow。markInView 顺带改大小写不敏感（语料 Sheet vs 查询 sheet）。
- **回归**：S7/S8 desktop+mobile 4 例全过；tsc/build 过。

### AP-10 xlsx（S6）定位回归：mark 恒在视口上方 -229px [P1→关闭] [status: done(7ee8221e)——实为断言语义失联，非功能回归]
- **原判定修正**：调试脚本时间序列采样证实定位机制**完全正确**（Sheet 03 标题块贴顶 b3top=33px）——S6 失败根因是断言找「第一个含 sheet 的 mark」（= Sheet1 标题，视口外），与「跳转锚定节点标题块」的语义失联（命中行是节点标题行，闪烁锚定块起始处）。功能无回归。
- **修复**：S6 断言重写为定位语义（Sheet 03 标题块在视口内）+ mark 存在性；markInView 保留大小写不敏感。
- **回归**：E2E search-preview-locate 23 过 0 败（1 skipped = S3 mobile 有意跳过）。
