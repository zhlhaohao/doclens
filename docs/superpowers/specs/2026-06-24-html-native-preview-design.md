# HTML 原生预览 — 设计文档

**Date**: 2026-06-24
**Status**: Approved
**Topic**: cortex/web_v2/frontend — preview-pane 对 HTML 文件使用原生渲染

## 背景与动机

当前 preview-pane 对所有非 markdown 文件走纯文本+行号模式（`preview-pane.ts:226-244`）。HTML 文件虽然 `language === "html"`，但也按文本显示源码，用户看不到渲染效果。

用户希望 HTML 文件像浏览器一样渲染原生网页。

## 目标

| 目标 | 验证 |
|------|------|
| 单击 HTML 文件 → 预览栏显示渲染后的网页 | iframe 内可见布局/CSS/交互 |
| 不影响现有 markdown / 文本预览 | 现有测试无回归 |
| 不暴露 cortex 应用到 iframe 脚本 | sandbox 隔离 origin |

## 非目标

- 不为 HTML 增加编辑能力（隐藏 ✏️ 编辑按钮）
- 不处理相对路径资源（图片/css 用相对 URL 会失效，本应用 HTML 多为独立文档）
- 不在渲染后的 HTML 中标记搜索命中行（`line` / `keyword` 对 HTML 忽略）

## 行为变更

### preview-pane 分支优先级

```
loading               → 加载中
empty content         → 占位
language=markdown +
  mode=edit           → md-editor
language=markdown     → md-viewer（含 edit/download/upload 按钮）
language=html         → iframe srcdoc 渲染（download/upload，无 edit） ← 新增
else                  → 纯文本+行号
```

### HTML 分支细节

- **渲染方式**：`<iframe srcdoc="${content}">`
- **沙箱**：`sandbox="allow-scripts"`（脚本可运行但被当作唯一 origin，无法访问 cortex 的 cookies/localStorage/DOM）
- **Header 按钮**：⬇️ 下载 + ⬆️ 上传（与文本分支一致；无 ✏️ 编辑）
- **忽略字段**：`line` / `keyword` / `pages` / `highlights`（渲染后的网页无法标记行号）
- **背景**：iframe 内白底（避免暗色 token 透到网页）

## 组件改动

### `cortex/web_v2/frontend/src/components/preview-pane.ts`

在 markdown 分支后、纯文本分支前插入 HTML 分支：

```ts
if (this.language === "html") {
  return html`
    <input type="file" hidden @change=${this._onFileChange}>
    ${this.noHeader ? null : html`
      <div class="header">
        <span class="path">${this.path}</span>
        ${this._renderDownloadBtn()}
        ${this._renderUploadBtn()}
      </div>
    `}
    <iframe
      class="html-frame"
      srcdoc=${this._content}
      sandbox="allow-scripts"
      title="HTML 预览"
    ></iframe>
  `;
}
```

新增 CSS：

```css
.html-frame {
  flex: 1;
  border: 0;
  width: 100%;
  background: white;
  min-height: 0;
}
```

### 后端

无需改动。`cortex/web_v2/api/preview.py:52-58` 的 `_LANGUAGE_MAP` 已经把 `.html` 映射到 `"html"`，GET /api/preview 对 HTML 文件直接读 utf-8 文本返回。

## 边界情况

| 场景 | 处理 |
|------|------|
| HTML 片段（无 `<!DOCTYPE>` / `<html>` / `<body>`） | iframe srcdoc 自动包装空文档，正常渲染 |
| HTML 含 `<script>` | 脚本运行，但被 sandbox 隔离，不能访问父文档 |
| HTML 含相对路径资源（`<img src="./foo.png">`） | 失效（iframe 无 base URL）。未来可注入 `<base href="...">`，本期不做 |
| 搜索命中 HTML 文件 | 预览栏只显示渲染后网页，不高亮命中行；search-results 列表的 snippet 仍正常 |
| 移动端 preview（`noHeader=true`） | iframe 充满剩余空间，无 header 按钮 |
| HTML 内容为空 | 被 preview-pane 顶部的 empty guard 拦截，显示"点击左侧结果查看预览"占位 |

## 安全考量

- `sandbox="allow-scripts"` 让脚本运行但隔离 origin，iframe 内的脚本无法：
  - 访问 `window.parent`（跨 origin 抛错）
  - 读取/写入 cortex 的 cookies 或 localStorage
  - 发起同源 XHR 拿用户数据
- 不加 `allow-same-origin`，避免 iframe 内脚本绕过 sandbox
- 用户上传的 HTML 文档本身是用户自己的内容，风险有限；sandbox 提供纵深防御

## 测试

### 单元测试（vitest）

新增到 `tests/preview-pane.spec.ts`：

- `language="html"` + 有 content → shadowRoot 含 `<iframe class="html-frame">`
- iframe 的 `srcdoc` 属性等于 content
- iframe 的 `sandbox` 属性包含 `allow-scripts`
- header 不含编辑按钮（只有 download/upload）
- `noHeader=true` 时不渲染 header（移动端）

### 回归

- 所有现有 preview-pane 测试通过
- search-view 测试通过（HTML 走新的 iframe 分支，但 search-view 本身不改）

### 手动 E2E

- 启动 cortex gui
- explorer 中找一个 .html 文件单击
- 预览栏显示渲染的网页（布局/CSS 生效）
- 点"⬇️ 下载"仍能下载原始 HTML
- search 搜索词命中 HTML 文件 → 搜索结果列表显示 snippet；预览栏显示渲染网页（无行高亮，符合设计）

## 实施顺序

1. 改 `preview-pane.ts`：加 HTML 分支 + CSS
2. 加单元测试（4-5 个）
3. `npm run build`
4. 浏览器手动验证
