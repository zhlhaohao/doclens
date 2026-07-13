# 对话页（chat-view）桌面端设计 Spec

> 适用宽度：≥1024px。本文件只写桌面端结构与交互，不含视觉样式（颜色、字体、字号、间距数值、渐变、阴影、圆角、像素值）。
> 共享组件定义见 [`../README.md`](../README.md)，本文件只描述其在本页的角色。

## 1. 路由与入口

- **路由 hash**：`#/chat`
- **进入方式**：
  - 桌面左侧 `<activity-bar>` 的 chat 导航图标点击 → 派发 `navigate` 事件 → `router.navigate("chat")`
  - 跨视图会话加载：`store.pendingSession`（`type==="chat"`）由 history-view 等推入，chat-view `connectedCallback` 消费并自动加载该会话进入 focus 态
  - URL 直接访问 `#/chat`
- **挂载点**：`<cortex-app>` 的 `.main` 区域按 `store.view==="chat"` 挂载 `<chat-view>`

## 2. 状态机

### 2.1 主状态机（`store.chat.state`）

| 状态 | 触发条件 | 渲染区域 |
|---|---|---|
| `initial` | 初次进入 / focus-header「新对话」返回 | `.initial-stack`：welcome-pane + history-list + input-row |
| `focus`（无 preview） | 首次提交 / 点历史会话 / 消费 pendingSession | `.focus-body`：focus-header + `.focus-main`（chat-stream 居中限宽）+ input-bar |
| `focus`（有 preview） | 点击 AI 回复中的参考资料链接 | `.focus-main` 加 `has-preview` 类 → flex-row 并排布局 |

### 2.2 子状态

| 子状态 | 类型 | 说明 |
|---|---|---|
| `store.chat.streaming` | boolean | 流式响应进行中；true 时 input-box disabled |
| `store.chat.messages` | ChatMessage[] | 当前对话消息列表 |
| `store.chat.currentSession` | Session \| null | 当前会话元数据 |
| `previewOpen` | boolean | 是否显示预览（控制 has-preview 类） |
| `previewContent` / `previewPath` / `previewLanguage` / `previewPages` / `previewWritable` | 预览数据 | fetchPreview 返回的文档内容与元信息 |
| `previewError` | `"NOT_INDEXED" \| null` | 文件未索引标记 |
| `previewDirty` | boolean | 预览编辑脏标记，切换前需 confirm |
| `_previewPaneWidth` | number | splitter 拖动后的预览栏宽度，持久化 localStorage |

### 2.3 状态转换

```
initial ──提交首条消息──▶ focus(无preview) ──点参考资料──▶ focus(有preview)
  ▲                           │                              │
  │                           │                              │
  └──── focus-header「返回」 ──┴────────────── ✕ 关闭预览 ────┘
```

## 3. 构件树

```
<chat-view>                              flex column · flex:1
├── [initial 态]
│   └── .initial-stack                   flex column · 居中限宽
│       ├── <welcome-pane>               heading="Doclens" suffix="问日程" subheading="与你的知识库对话"
│       ├── <history-list type="chat">   历史会话列表
│       └── .input-row
│           └── <input-box multiline>    placeholder="问 Doclens 任何问题..."
│
└── [focus 态]
    ├── <toast-stack>                    本页通知（保存成功/失败、上传、预览失败）
    └── .focus-body                      flex column · flex:1
        ├── <focus-header>               back-label="新对话" · title=session.title · meta="N 条消息"
        ├── .focus-main                  [无preview] flex column · [有preview] flex row（has-preview）
        │   ├── <chat-stream>            [无preview] 居中限宽 · [有preview] flex:1 让位
        │   ├── .splitter.desktop-only   [有preview] col-resize 拖动条
        │   └── .preview-pane-wrap.desktop-only  [有preview] 固定宽预览容器
        │       ├── button.preview-close ✕        关闭预览
        │       └── <preview-pane> | .not-indexed-hint
        └── .input-bar                   居中限宽
            └── <input-box multiline ?disabled=streaming>  placeholder="继续对话..."
```

## 4. 布局

### 4.1 整体

- `<chat-view>` 本身：`flex column`，`flex:1`，占满 `.main` 区域（`min-height:0` 允许内部滚动）
- 两态切换：initial 态渲染 `.initial-stack`；focus 态渲染 `.focus-body`

### 4.2 initial 态（`.initial-stack`）

- 方向：`flex column`
- 宽度：**居中限宽列**（max-width 约束，不撑满全宽）
- 子元素垂直堆叠：welcome-pane → history-list → input-row
- input-row 为 `flex-shrink:0`（固定底部区域）

### 4.3 focus 态（`.focus-body`）

- 方向：`flex column`
- 三个区域纵向排列：
  1. **focus-header**：固定高度（`flex-shrink:0`）
  2. **`.focus-main`**：`flex:1` 弹性占满剩余空间（`min-height:0`）
  3. **input-bar**：固定底部（`flex-shrink:0`，顶部 border 分隔）

### 4.4 `.focus-main` 无 preview（默认）

- 方向：`flex column`
- chat-stream **居中限宽**（max-width 约束 + `margin: 0 auto`），不撑满全宽
- chat-stream 自身 `overflow-y: auto` 内部滚动

### 4.5 `.focus-main.has-preview`（桌面端关键差异）

- 方向切换为 **`flex row`**（水平并排）
- 三列从左到右：
  1. **chat-stream**：`flex: 1 1 0`（弹性占满剩余宽度），取消居中限宽约束（`max-width: none`），`min-width:0`
  2. **`.splitter.desktop-only`**：`flex: 0 0 固定窄宽`，`cursor: col-resize`，可拖动调整预览栏宽度
  3. **`.preview-pane-wrap.desktop-only`**：`flex: 0 0 var(--preview-pane-width)`（固定宽度，由 splitter 拖动决定），有 min/max 宽度限制，`flex column`
- preview-pane-wrap 内部：
  - 右上角绝对定位 `.preview-close` ✕ 按钮（关闭预览）
  - `<preview-pane>` 或 `.not-indexed-hint`（未索引时）

### 4.6 splitter 拖动调宽

- 拖动方向：水平（col-resize）
- 拖动时实时更新 `_previewPaneWidth`，通过 CSS 变量 `--preview-pane-width` 驱动 preview-pane-wrap 宽度
- 宽度范围有 min/max 限制（clamp）
- 拖动结束（mouseup）持久化到 `localStorage["cortex.chatPreviewWidth"]`
- 首次加载时从 localStorage 恢复用户上次宽度偏好（无记录则用默认值）
- 拖动期间 `document.body` 设 `cursor: col-resize` + `userSelect: none`

## 5. 元素清单

### 5.1 共享组件（本页角色）

| 组件 | 本页角色 |
|---|---|
| `<welcome-pane>` | initial 态头部：heading "Doclens" + suffix "问日程" + subheading "与你的知识库对话"；显示系统状态区（工作目录、文档数、索引大小、监控状态等） |
| `<focus-header>` | focus 态头部：圆形返回按钮（back-label="新对话"，返回 initial 态）+ 居中标题（session.title，ellipsis）+ meta 文本（"N 条消息"） |
| `<input-box>` | initial 态 + focus 态底部各一个；`multiline` 多行自动扩充；focus 态下 `?disabled` 绑定 streaming 状态；提交按钮 label="知识库对话" |
| `<toast-stack>` | 本页通知容器（fixed），用于推送保存成功/失败、上传成功/失败、预览失败等 toast |
| `<preview-pane>` | 预览主体（参考资料点击触发）；支持 dirty-change / saved / save-failed / upload-success / upload-failed 事件 |

### 5.2 本页专有元素

| 元素 | 职责 |
|---|---|
| `<chat-stream>` | 消息流容器：flex column，`overflow-y: auto` 自动滚到底部；空消息列表显"开始与 Doclens 对话"占位 |
| `<chat-message>` | 单条消息气泡：user 右对齐纯文本 / assistant 左对齐 markdown 渲染；空 content 显"思考中..."；可选 tool-trace + 参考资料 + error |
| `<chat-tool-trace>` | 工具调用思考过程：可折叠摘要（步数 + 复制按钮）+ 步骤列表（running 旋转/done ✓/error ✗）；单步输出可展开全部 |
| `.splitter.desktop-only` | 预览栏宽度分隔条（仅 focus + preview 时渲染，桌面端可见） |
| `.preview-pane-wrap.desktop-only` | 预览栏容器（仅 focus + preview 时渲染，桌面端可见） |
| `button.preview-close` | 预览栏右上角关闭按钮 ✕ |
| `.not-indexed-hint` | 文件未索引时的提示区 |
| `<history-list type="chat">` | 历史会话列表：标题"历史会话" + 清空按钮 + history-item 列表或空态 |

## 6. 交互逻辑

### 6.1 AI 对话流式交互（核心）

**用户操作步骤**：

1. 用户在 input-box 输入消息
2. **Enter 发送** / **Shift+Enter 换行**（多行输入）
3. 提交后进入流式响应周期

**提交流程**（`_submit`）：

1. 重置预览状态（`_resetPreview`：清空 previewOpen/content/path/language/pages/writable/error/dirty）
2. 清空 draft
3. **首次提交（initial 态）**：先调 `createSession({type:"chat", title, preview})` 创建会话 → 切 `state="focus"`，设 currentSession
4. **后续提交（focus 态）**：直接追加 user message 到 messages
5. 追加空 assistant 占位消息（`{role:"assistant", content:""}`）到 messages 末尾
6. 设 `streaming=true`（input-box disabled）

**SSE 流式接收**（`chatStream({message, session_id})`）：

逐事件处理，每次都不可变更新 messages 数组：

| 事件类型 | 处理 |
|---|---|
| `token` | 末条 assistant 的 content 追加 text（逐 token 增长） |
| `tool_call` | 末条 assistant 追加新 ToolStep（status="running"） |
| `tool_result` | 更新对应 tool_use_id 的 step：设 output / is_error / duration_ms / status（error 或 done） |
| `references` | 设末条 assistant 的 references 字段 |
| `error` | 向末条 assistant content 追加 `⚠️ {detail}` 文本 |
| `done` | 流结束，不修改 messages |

**流结束后**：

- 调 `appendSession(sessionId, [user_item, ai_item], message_count)` 持久化到后端
- 刷新历史列表（`_loadHistory`）
- `finally`：设 `streaming=false`（input-box 恢复可用）

**流式中断**（连接断开 / 异常）：

- 调 `finalizeInterruptedMessages`：所有残留 `running` 步骤标记为 `error`（is_error=true，output 设为"（已中断）"）
- 设全局 `error` 状态
- 保留已接收的内容不丢失
- `finally` 仍设 `streaming=false`

**空 content 占位**：assistant 消息 content 为空字符串时，chat-message 渲染"思考中..."斜体占位文本。

### 6.2 参考资料点击 → 预览

**触发**：chat-message 内 `.ref-link`（参考资料链接）点击 → 事件委托派发 `reference-click` CustomEvent（携带 path）→ chat-view `_onReferenceClick`

**处理流程**：

1. `_safeAction` 包裹（dirty 保护：若 previewDirty 则 confirm"当前文件有未保存的修改。确定要丢弃吗？"，确认则 discard）
2. `_normalizeReferencePath` 规范化路径：
   - 剥 markdown 链接 `[text](url)` → url
   - 剥 `file://` / `file:///` 前缀
   - URL decode（`decodeURIComponent`）
   - 空路径 → toast"参考路径为空"，中止
3. 调 `fetchPreview(path)`
4. 成功 → 设 previewContent/Path/Language/Writable/Pages + `previewOpen=true`（触发 has-preview 布局）
5. `notIndexed` → 设 `previewError="NOT_INDEXED"` + `previewOpen=true`（预览区显未索引提示）
6. 其他失败 → toast"预览失败：{message}"

### 6.3 chat-tool-trace 自动展开/收起

`willUpdate` 检测 steps 变化：

| 转换 | 行为 |
|---|---|
| 无 running → 有 running（新工具开始调用） | `_expanded = true`（自动展开） |
| 有 running → 无 running（全部完成） | `_expanded = false`（自动收起） |

用户也可手动点击 summary 行 `_toggle` 切换展开/收起（手动操作不受自动逻辑覆盖时机影响）。

**步骤内元素**：
- running 步骤：旋转 spinner + "正在搜索/读取/检索..." 动作文案
- done 步骤：工具图标 + ✓ + 耗时(ms)
- error 步骤：工具图标 + ✗
- 输出超 5 行：截断显示前 5 行 + "展开全部 (N 行) ⌄" 可点击展开
- 复制按钮：复制全部步骤全文（buildFullText），clipboard 不可用时降级 execCommand

### 6.4 关闭预览

- 点击 `.preview-close` ✕ 按钮 → `_closePreview` → `_safeAction` 包裹 → `previewOpen=false`（移除 has-preview 类，恢复 chat-stream 居中限宽）

### 6.5 预览编辑/保存/上传

- preview-pane dirty-change → `previewDirty` 更新
- saved → 清 previewDirty + toast"已保存"
- save-failed → toast"保存失败：{message}"
- upload-success → 清 previewDirty + toast"已覆盖：{path}" + 重新拉取预览内容（`_reloadPreview`）
- upload-failed → toast"上传失败：{message}"

### 6.6 历史会话

- `<history-list>` `@select` → `_loadSession`：重置预览 → 切 focus 态 → fetch 会话详情 → `mapSessionItemsToMessages` 映射消息
- `<history-list>` `@clear` → `clearSessions("chat")` → 清空 historySessions

### 6.7 返回 initial 态

- focus-header `@back` → `_backToInitial`：重置预览 → 切 `state="initial"` + 清 currentSession/messages → 刷新历史

## 7. 边界态

| 边界态 | 表现 |
|---|---|
| **initial 空历史** | history-list 显空态提示（无可聊历史） |
| **focus 空消息** | chat-stream 显"开始与 Doclens 对话"占位文本（正常不应出现，提交后立即有 user 消息） |
| **streaming 思考中** | 末条 assistant content 为空时显"思考中..."斜体占位；input-box disabled |
| **streaming 中 input** | input-box `?disabled=true`，禁止再次提交 |
| **stream 中断** | 残留 running 步骤标 error（output="（已中断）"），保留已收内容，全局 error 设置 |
| **SSE error 事件** | 向 assistant content 追加 `⚠️ {detail}` 文本（不中断流，继续接收） |
| **预览 NOT_INDEXED** | preview-pane-wrap 内显 `.not-indexed-hint`："该文件未索引，无法预览。请先执行 doclens index 后重试。" |
| **预览 dirty 保护** | 关闭预览 / 切换参考资料 / 返回 initial 前，若 previewDirty 则 confirm"当前文件有未保存的修改。确定要丢弃吗？" |
| **参考路径为空** | toast"参考路径为空"（error 级） |
| **预览 fetch 失败** | toast"预览失败：{message}"（error 级） |
| **createSession 失败** | _submit 异常路径捕获，不进入 focus 态 |
| **appendSession 失败** | 消息已在 UI 显示，持久化失败仅 console.warn（不影响用户已见对话） |
| **历史加载失败** | console.warn，historySessions 保持空数组 |
