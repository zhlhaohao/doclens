# Explorer 点击即打开 — 设计文档

**Date**: 2026-06-23
**Status**: Approved
**Topic**: cortex/web_v2/frontend — Explorer Tab 交互重构

## 背景与动机

当前 explorer tab（`#/files`）的交互不符合现代文件管理器直觉：

- 单击文件/文件夹 → 选中（支持 ctrl/shift 多选），右侧 `<file-detail>` 显示**属性**
- 双击文件夹 → 进入（已于 2026-06-23 修复"目录显示为空"bug）
- 双击文件 → 桌面端无动作

用户期望：

- 单击文件夹 → **进入**该文件夹
- 单击文件 → 在最右 pane **预览**该文件
- 预览功能复用 search tab 已有的 `<preview-pane>` 组件

## 目标

| 目标 | 验证 |
|------|------|
| 单击文件夹直接进入 | 面包屑切换、中栏列出目录内容 |
| 单击文件右栏预览 | preview-pane 显示文件内容 |
| 批量操作仍可用 | 复选框多选 + 工具栏批量按钮 |
| 移动端体验一致 | list→preview 切换流畅 |

## 非目标

- 不改造 search tab 的预览行为（仅抽取共享逻辑）
- 不改造 file-tree 组件（左侧树导航保持不变）
- 不引入新的预览后端能力（复用现有 `GET /api/preview`）

## 行为变更

### 点击语义（`<file-row>`）

| 动作 | 当前行为 | 新行为 |
|------|---------|--------|
| 行体单击 | 选中（selectedPaths） | 文件夹=进入；文件=预览 |
| 行体双击 | 文件夹=进入；文件=无 | 冗余触发 activated（无害保留） |
| 复选框单击（新增） | — | toggle selectedPaths |
| 复选框 Ctrl+Click | — | 单选切换 |
| 复选框 Shift+Click | — | 范围选择 |

### 右 pane（`<file-detail>` → `<preview-pane>`）

| 状态 | 显示内容 |
|------|---------|
| 初始（无预览） | 占位 "点击文件预览" |
| 单击文件后 | preview-pane 显示该文件内容 |
| 多个文件复选框选中 | 仍预览最后单击的文件 |
| 文件夹导航后 | preview 状态不变（VS Code 风格持久） |
| 未索引二进制文件 | "未索引"提示 + 下载按钮 |
| Preview 编辑中 dirty | 切换前 confirm("未保存修改，丢弃？") |

### 工具栏（`<file-list>`）

不变：`+ 新目录` / `⬆ 上传` / `✎ 重命名`（单选时） / `→ 移动` / `🗑 删除`。批量按钮作用于 `selectedPaths`（即复选框选中的项）。

## 组件变更

### 1. `file-row.ts`

- **新增**：grid 第一列 28px 宽的 checkbox（`<input type="checkbox">`）
- **新增**：checkbox 点击派发 `checked` 事件，带 `{ path, ctrl, shift }` payload
- **改写**：行体单击从派发 `clicked` 改为派发 `activated`（与现有 dblclick 一致）
- **保留**：`activated` 事件 payload `{ path, is_dir }`，双击仍冗余触发
- **移除**：`clicked` 事件（不再需要 — 选中走 checkbox）

### 2. `file-list.ts`

- **新增**：表头全选 checkbox（28px 列对齐）
- **改写**：`_onRowClicked` → `_onRowChecked`，响应 `checked` 事件调用 `actions.selectEntry`（复用现有 ctrl/shift 逻辑）
- **改写**：`_onRowActivated` 不再只处理 `is_dir`，对所有激活事件都向上冒泡（实际由Lit 的 `composed: true` 自动完成，但内部 `actions.selectDir` 只对 `is_dir` 触发）
- **保留**：所有工具栏按钮、grid 结构（除新列）

### 3. `files-view.ts`

- **替换**：桌面布局 `<file-detail>` → `<preview-pane>`，移动端 `mobilePane="detail"` 内容同样替换
- **新增**：本地 preview state（参照 search-view）：
  ```
  previewPath, previewContent, previewLanguage, previewLine,
  previewWritable, previewPages, previewError, previewDirty
  ```
- **新增**：`_fetchPreview(path)` 方法（复用共享模块 `src/api/preview.ts`）
- **改写**：`_onFileListActivated`：
  - `is_dir=true` → 已有 `_ensureLoaded` 逻辑（保留）
  - `is_dir=false` → `_fetchPreview(path)`
- **新增**：dirty 检查（切换文件、删除、重命名时复用 search-view 的 `_safeAction` 模式）
- **新增**：删除当前预览文件时清空 preview state；重命名时更新 previewPath

### 4. `src/api/preview.ts`（新文件）

抽取 search-view 中的共享逻辑：

```typescript
export const FULL_FILE_PREVIEW_EXTS = [".md", ".pdf", ".docx", ".xlsx", ...];
export function isFullFilePreview(path: string): boolean;
export async function fetchPreview(path: string): Promise<PreviewResult>;
export type PreviewResult = {
  content: string;
  path: string;
  language: string;
  writable: boolean;
  pages: PageMarker[] | null;
} | { notIndexed: true };
```

search-view 重构为使用此模块（保持行为不变）。

### 5. `file-detail.ts`（删除）

完全移除，对应测试 `tests/file-detail.spec.ts` 一并删除。

## 状态管理

- preview 相关 state 放在 `files-view` 本地（与 search-view 一致），不进 store
- `selectedPaths`、`currentDir`、`treeCache` 等继续放 store（已有）

## 数据流

```
用户单击文件行（非 checkbox）
  ↓
file-row 派发 activated { path, is_dir: false }
  ↓ (bubbles + composed)
file-list → files-view._onFileListActivated
  ↓
files-view._fetchPreview(path) → fetch("/api/preview?path=...")
  ↓
更新本地 preview* state → preview-pane 重渲染

用户单击复选框
  ↓
file-row 派发 checked { path, ctrl, shift }
  ↓
file-list._onRowChecked → actions.selectEntry
  ↓
工具栏批量按钮根据 selectedPaths.length 启用/禁用
```

## 边界条件

| 场景 | 处理 |
|------|------|
| 未索引二进制（pdf/docx/xlsx 等） | `previewError = "NOT_INDEXED"` → 显示提示 + 下载按钮 |
| 文件夹导航 | 不触碰 preview state |
| 删除当前预览的文件 | 清空 preview state |
| 重命名当前预览的文件 | 更新 previewPath |
| Dirty 切换 | confirm 弹窗，取消则保留原状态 |
| 移动端 list→preview 切换 | mobilePane 保持 "detail" 名称（语义改为预览） |

## 测试策略

### 单元测试（vitest）

- `file-row.spec.ts`：
  - 行体单击派发 `activated`，不派发 `checked`
  - checkbox 单击派发 `checked`，不派发 `activated`
  - checkbox ctrl/shift 信息正确传递
- `file-list.spec.ts`：
  - `_onRowChecked` 更新 selectedPaths（含 ctrl/shift 范围）
  - 表头全选 checkbox 切换所有条目
- `files-view.spec.ts`：
  - 单击文件 → 调用 fetchPreview
  - 单击文件夹 → 不调用 fetchPreview，触发 list 加载
  - dirty 状态下切换文件 → 触发 confirm
  - 删除当前预览文件 → preview 清空
- `api/preview.spec.ts`（新）：fetchPreview 各分支（文本、二进制、未索引）

### E2E（playwright-cli）

- 进入 explorer → 单击文件夹 → 面包屑切换、内容加载
- 单击文件 → 右 pane 显示 preview-pane，内容正确
- 勾选多个文件 → 工具栏批量按钮启用，右 pane 仍显示最后单击的文件
- 单击未索引 PDF → 显示"未索引"提示

### 回归

- search-view 重构后所有 search 测试必须通过（验证共享模块抽取无破坏）
- file-tree 导航、移动端 tree→list→detail 流程不受影响

## 实施顺序

1. **抽取共享模块** `src/api/preview.ts`（含 `isFullFilePreview` + `fetchPreview`），重构 search-view 使用之；search 全部测试通过
2. **改 `file-row.ts`**：加 checkbox 列，重写点击逻辑
3. **改 `file-list.ts`**：响应 checkbox 事件，表头全选
4. **改 `files-view.ts`**：替换 file-detail 为 preview-pane，加 preview state、fetchPreview、dirty/delete/rename 边界
5. **删除** `file-detail.ts` 和 `tests/file-detail.spec.ts`
6. **更新测试**：file-row / file-list / files-view / api-preview
7. **构建** `npm run build` + 浏览器手动验证（playwright-cli）
