# Doclens Web 前端页面设计 Spec

> 本目录的 spec 描述各页面的**结构 / 布局 / 交互逻辑**，**不含视觉样式**（颜色、字体、字号、间距数值、渐变、阴影、圆角、具体像素值）——样式留待重构阶段重新设计。供 AI 阅读后重构 app 界面。

## 应用总览

Lit (Web Components) SPA，4 个主页面，hash 路由，**单一响应式断点 1024px**（`<1024` 移动 / `≥1024` 桌面）。

## 页面清单

| 页面 | 路由 hash | 桌面 spec | 移动 spec |
|------|----------|----------|-----------|
| 搜索 | `#/search` | [`search/desktop.md`](search/desktop.md) | [`search/mobile.md`](search/mobile.md) |
| 对话 | `#/chat` | [`chat/desktop.md`](chat/desktop.md) | [`chat/mobile.md`](chat/mobile.md) |
| 设置 | `#/settings` | [`settings/desktop.md`](settings/desktop.md) | [`settings/mobile.md`](settings/mobile.md) |
| 文件 | `#/files` | [`files/desktop.md`](files/desktop.md) | [`files/mobile.md`](files/mobile.md) |

## 顶层布局骨架（`<cortex-app>`）

```
<cortex-app>                          flex column · 100dvh · overflow:hidden
├── <app-bar>                         固定顶栏（flex-shrink:0）
├── <div class="app-body">            flex:1
│   ├── <activity-bar>                桌面:左侧竖条  /  移动:隐藏
│   ├── <div class="main">            flex:1 · 挂载当前 view
│   └── <tab-bar>                     桌面:隐藏  /  移动:底部水平条
└── <reindex-dialog>                  全局模态（fixed 居中）
```

- **桌面**：`.app-body` flex-row → activity-bar 左 / main 中弹性 / tab-bar 隐藏
- **移动**：`.app-body` flex-column → activity-bar 隐藏 / main 占满 / tab-bar 底部

## 导航

- **路由**：hash（`#/search | #/chat | #/files | #/settings`）。URL 是 view 唯一真相源。`router.navigate(view)` 写 hash → `hashchange` → `actions.setView` → 重渲染。
- **桌面导航**：`<activity-bar>`（左侧竖条，3 图标：search / chat / files）。
- **移动导航**：`<tab-bar>`（底部水平条，3 tab）。
- **settings 入口**：仅 `<app-bar>` 头像下拉菜单（两端一致）。
- **事件流**：导航元素派发 `CustomEvent("navigate", {view, scope?})` → `cortex-app._navigate` → `router.navigate` → store → 重渲染。

## 共享组件（跨页面）

> 这些组件出现在多个页面，各页 spec 只描述它们"在本页的角色"，不重复定义。

### `<app-bar>` — 顶栏（两端都有）
- 左：品牌 logo + "Doclens"
- 右：保存按钮（仅 settings dirty 时）+ 移动端刷新按钮（**仅移动**，圆形，`location.reload()`）+ 头像按钮（下拉菜单：全局配置 / 强制重建索引 / 放弃修改[settings dirty 时]）
- 监听 `cortex:watch-reindexed` → toast「索引已更新：N 文档」

### `<welcome-pane>` — 搜索/对话 initial 态共享
- 标题（heading + 可选 suffix）+ 副标题
- 系统状态区（2 行纯值，icon 自解释）：
  - 行1：`📁 工作目录路径  ·  📄 N 文档  ·  💾 索引大小`
  - 行2：`👁 监控状态  ·  🕒 上次重建（相对时间）  ·  🗂 文件类型分布（前3 + +N）`
- 订阅 `store.status + store.watcher`，超宽 ellipsis 兜底，行1 title 显完整路径

### `<focus-header>` — 搜索/对话 focus 态共享
- 圆形返回按钮（返回 initial 态）+ 居中标题（ellipsis）+ 右侧 meta 文本 + 可选 kebab 更多菜单（由 actions 数组驱动）
- 桌面/移动结构一致

### `<input-box>` — 搜索/对话输入共享
- 单行 input 或多行 textarea（自动扩充）+ 提交按钮
- 可选 keyword/grep 分裂按钮 + caret 下拉模式选择器（仅搜索用，向上展开菜单）
- 多行时 Shift+Enter 换行、Enter 提交

### `<toast-stack>` — 全局通知（fixed）
- push/dismiss API，自动定时消失，点击关闭
- 移动端位置上移避开 tab-bar

### `<reindex-dialog>` — 全局模态
- 4 状态：confirm / running（SSE 流式进度：已索引 N · 当前文件）/ done / error
- fixed 居中；移动端全宽

## 响应式断点（1024px）全局差异

| 维度 | 桌面 (≥1024) | 移动 (<1024) |
|------|------|------|
| 导航 | activity-bar 左侧竖条 | tab-bar 底部水平条 |
| app-bar 刷新按钮 | 隐藏 | 显示（圆形，硬刷新） |
| hover 反馈 | 大量 :hover 状态 | 无 hover（依赖 :active） |
| 列宽调整 | 支持（splitter / col-resize） | 禁用 |
| 拖拽上传 | 支持（drop-zone） | 不支持 |
| dialog 按钮 | 水平排列（flex-end） | 垂直排列（column-reverse，全宽，min-height 44px） |
| 预览模式 | 并排常驻 pane | 全屏 overlay 覆盖 |
| settings 保存入口 | footer-bar 保存/放弃按钮 | app-bar 头像菜单 + 💾 按钮 + toast |

## spec 文件模板

每份页面 spec 结构：

1. **路由与入口**：hash、进入方式
2. **状态机**：状态列表 + 转换条件
3. **构件树**：该页渲染的组件层级（缩进树）
4. **布局**：flex/grid 方向、固定 vs 弹性、区域划分（**只写本端**）
5. **元素清单**：具体 UI 元素及其行为
6. **交互逻辑**：事件流、状态转换、用户操作步骤
7. **边界态**：loading / empty / error

## 参考材料

- [`_structure-report.md`](_structure-report.md)：探索阶段的完整结构报告（全部组件清单 + 响应式差异矩阵 + 交互流细节）
- 源码：`doclens/web_v2/frontend/src/`
