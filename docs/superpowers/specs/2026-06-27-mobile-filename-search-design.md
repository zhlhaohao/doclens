# 移动端文件名搜索功能设计

> 日期：2026-06-27
> 背景：桌面端 files 视图已实现文件名即时搜索（commit 94801f7），移动端缺失该功能。

## 问题分析

`files-view.ts` 的 `_renderMobile()` 方法（705–734 行）完全没有渲染 `<file-search-box>` 和 `<file-search-results>`。搜索功能仅添加到了 `_renderDesktop()` 的左栏 `tree-pane` 中。

移动端当前导航流为三面板切换：`tree → list → detail`，无搜索入口。

## 方案：tree 面板内联切换（方案 1）

在移动端 tree 面板顶部放置搜索框，搜索激活时面板内 `<file-tree>` 替换为 `<file-search-results>`，清空后恢复。与桌面端左栏行为一致。

### 布局

```
┌───────────────────┐
│  [🔍 按文件名搜索…]  │  ← file-search-box（始终可见）
├───────────────────┤
│                   │
│   file-tree       │  ← 浏览态：文件树
│   或              │
│   file-search-    │  ← 搜索态：搜索结果列表
│     results       │
│                   │
└───────────────────┘
```

- 搜索框始终在 tree 面板顶部
- `_isFilenameSearchActive` 为 true 时，file-tree 隐藏，file-search-results 接替
- 清空搜索后自动恢复 file-tree

### 导航流

```
浏览：tree ──→ list ──→ detail
                     ←──┘     ←──┘

搜索：tree(搜索) ──→ detail
                   ←──┘  (搜索态保留，可继续选其他结果)
```

### 改动清单（全部在 `files-view.ts`，零新增组件，零 store/types 改动）

#### 1. `_renderMobile()` — tree 面板增加搜索框和结果切换

在 `pane === "tree"` 分支中：
- 顶部渲染 `<file-search-box>`（复用桌面端的 disabled/placeholder 逻辑）
- 下方根据 `_isFilenameSearchActive` 条件渲染 `<file-search-results>` 或 `<file-tree>`

搜索框 disabled/placeholder 逻辑需从 `_renderDesktop()` 提取为共享 getter，避免重复。

#### 2. `_goBack()` — 搜索态返回调整

当 `_isFilenameSearchActive` 为 true 且当前面板为 "detail" 时，返回到 "tree" 而非 "list"。

#### 3. `_onFilenameResultActivated` — 增加移动端面板切换

```ts
private _onFilenameResultActivated = async (e: CustomEvent<{ path: string }>) => {
  await this._previewPathWithDirtyCheck(e.detail.path);
  if (this._isMobile) {
    actions.setMobilePane("detail");
  }
};
```

`_onFilenameSearch` 的自动预览首项行为不变——移动端只预加载预览数据，不自动跳转 detail 面板，用户需主动点击结果。

#### 4. CSS 补充

`.mobile-layout` 的 flex 规则增加 `file-search-results`：

```css
.mobile-layout file-tree,
.mobile-layout file-list,
.mobile-layout file-search-results,
.mobile-layout .mobile-preview {
  display: flex; flex-direction: column;
  flex: 1; min-height: 0;
}
```

### 测试方案

**单元测试（Vitest）**— 扩展 `files-view.spec.ts`：

- 移动端 tree 面板渲染 search-box
- 搜索激活时 tree 面板显示 `file-search-results` 而非 `file-tree`
- 清空后恢复 `file-tree`
- `_goBack()` 在搜索态下 detail → tree
- `_onFilenameResultActivated` 移动端触发 `setMobilePane("detail")`

**E2E 测试（Playwright）**— 移动端 viewport（390×844）：

- 搜索框可见 → 输入关键词 → 结果列表出现
- 点击结果 → 进入预览面板
- 点返回 → 回到 tree 面板，搜索结果仍在
- 清空搜索 → 文件树恢复

**回归验证：** 桌面端 filename-search 的 6 个 E2E 用例和 316 个 vitest 用例不受影响。
