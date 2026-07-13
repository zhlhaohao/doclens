# 图片 icon 尺寸自适应 设计

- 日期：2026-07-13
- 状态：已批准（待实现）
- 关联分支：0713-1

## 背景与问题

最近 3 天（2026-07-10 起）新增了 PDF / DOCX / PPTX 图片提取与预览能力：

- `treesearch/parsers/image_store.py` 负责图片落盘、去重、resolve
- pdf / docx / pptx parser 在解析阶段把图片注入 markdown（`![图片 N](url)`）
- 前端 `md-viewer.ts` 用 marked 渲染 markdown，`<img>` 通过 `/api/preview/asset` 加载

**问题**：部分图片在原文档里是小尺寸 icon（如 logo、状态图标），但在 MD 预览中被拉伸到容器全宽（约 820px），显得模糊且占用过多空间。

## 根因

`md-viewer.ts` 的图片样式：

```css
:host img {
  max-width: 100%;
  height: auto;
  display: block;
}
```

`max-width: 100%` 对**所有**图片生效。而 `image_store._inline_md` 生成的是无尺寸信息的标准 markdown，`_meta.json` 也只存了 `sha256 / media_type / filename`，没有任何尺寸信息——前端无从区分"该放大的大图"与"不该放大的 icon"。

## 目标

- 小尺寸 icon 按原始像素尺寸显示，不被放大
- 大图维持现有铺满容器行为不变
- 不要求重新索引；改动立即对最近 3 天已解析的全部文档生效

## 非目标（YAGNI）

- 不处理"高分辨率设计 icon"（底层像素 ≥512 但在文档里显示很小）——样本验证此类极少
- 不做点击放大 / lightbox 交互
- 不改后端 parser、不改 `_meta.json` schema、不引入显示尺寸存储
- 不处理 SVG / 矢量图（pdf_parser 仅提取 raster，fitz 限制）

## 验证数据

扫描 `test_work_dir/**/*.docx`（6 个文件，90 张内嵌图片），对比"DOCX 显示尺寸（extent EMU→px）"与"底层图片像素"：

| 指标 | 数值 |
|---|---|
| 总 inline 图片 | 90 |
| 显示宽 ≤200px（icon 类） | 84 |
| 其中"底层像素 > 显示×2"（naturalWidth 会漏判的） | 5（最大底层像素 409） |

**结论**：这批文档库里，icon 的底层像素普遍 ≤400，与显示尺寸接近（差 ≤2x 占 94%）；真正"高分辨率素材缩小显示"的极少。真正的大图（照片 / 截图 / 大示意图）底层像素通常 1000+，与 icon 有明显断层。

→ **前端 `naturalWidth`（底层像素）足以区分 icon 与大图**，无需后端显示尺寸。

## 方案选择

| | A. 纯前端 naturalWidth（✓ 选定） | B. 后端记录显示尺寸 | C. A 为主 + B 预留 |
|---|---|---|---|
| 判定依据 | 浏览器底层像素 | 解析时显示尺寸（PDF bbox / DOCX extent / PPTX shape） | A 兜底，有尺寸时优先 |
| 改动范围 | `md-viewer.ts`（~20 行） | image_store + 3 parser + 前端 | A + 接口预留 |
| 重新索引 | 不需要 | 需要 | 部分 |
| 准确度 | 样本 ~95%+ | 100% | 介于两者 |
| 加载闪烁 | lazy 图瞬铺满再缩回（基本无感） | 无 | 视实现 |

**选 A**：数据证明本库 icon 底层像素普遍 ≤400；零后端改动、零重新索引、立即生效；符合 YAGNI。

## 详细设计

### 改动范围

仅 `doclens/web_v2/frontend/src/components/md-viewer.ts`。

### 阈值常量

```ts
/** 底层像素 ≤ 此值的图片视为 icon，按原始尺寸显示（不放大）。
 *  依据：样本扫描（6 docx / 90 图）显示 icon 底层像素普遍 ≤400，
 *  大图通常 1000+，500 是干净断层。 */
const ICON_PX_THRESHOLD = 500;
```

### 判定纯函数

```ts
/** 根据图片 naturalWidth 返回应设置的 width 样式值，无需调整时返回 null。
 *  抽为纯函数便于单元测试。 */
function iconWidthStyle(naturalWidth: number): string | null {
  if (naturalWidth > 0 && naturalWidth <= ICON_PX_THRESHOLD) {
    return `${naturalWidth}px`;
  }
  return null;
}
```

### 应用方法（MdViewer 成员）

```ts
private _applyIconSizing() {
  const imgs = this.shadowRoot!.querySelectorAll("img");
  imgs.forEach((img) => {
    const apply = () => {
      try {
        const style = iconWidthStyle(img.naturalWidth);
        if (style) img.style.width = style;
        // 大图不动 → 现有 max-width:100% 继续铺满
      } catch {
        // naturalWidth 读取异常（理论上 /api/preview/asset 同源不会触发）：兜底不设
      }
    };
    if (img.complete && img.naturalWidth > 0) apply();          // 已缓存
    else img.addEventListener("load", apply, { once: true });   // 待加载
  });
}
```

### 接入点

在现有 `updated()` 中，`content` 变化时调用（紧邻 `_highlightKeyword`）：

```ts
updated(changedProps: Map<string, unknown>) {
  super.updated?.(changedProps);
  if (changedProps.has("content") || changedProps.has("keyword")) {
    this._highlightKeyword();
  }
  if (changedProps.has("content") || changedProps.has("pages")) {
    this._applyIconSizing();          // 新增：content/pages 变化都会重建 DOM，需重新绑定 img
  }
  if (changedProps.has("line") || changedProps.has("content")) {
    this._locateAndHighlight();
  }
}
```

> `_applyIconSizing` 的 `querySelectorAll("img")` 覆盖整个 shadowRoot，对单块（`.md-body`）与分页（`.page-card`）两种渲染模式都生效。

### CSS

无需改动。现有 `:host img { max-width:100%; height:auto }` 配合 `style.width`：

- icon：`width = naturalWidth`（如 100px），`max-width:100%` 不限制 → 显示 100px
- 大图：不设 width → `max-width:100%` 把它压到容器宽度 → 铺满

### 数据流

```
marked.parse → HTML 字符串
  → .innerHTML 注入 shadowRoot（单块 .md-body 或分页 .page-card）
  → updated() 触发（content changed）
  → _applyIconSizing: querySelectorAll("img")
  → 每张图读 naturalWidth
     ├ ≤500 → 设 style.width = "{naturalWidth}px"（不放大）
     └ >500 → 不动（max-width:100% 铺满）
```

### 错误处理

- `naturalWidth === 0`（图片损坏 / 加载失败）：`iconWidthStyle` 返回 null → 不设 width → 维持 `max-width:100%` 兜底
- `naturalWidth` 读取异常：try-catch 吞掉，不设
- `load` 事件已过（`img.complete`）：立即 apply，不依赖 onload

## 测试计划

### 单元测试（纯函数）

新增 `iconWidthStyle` 测试：

| 输入 naturalWidth | 期望输出 |
|---|---|
| 0 | `null` |
| 1 | `"1px"` |
| 100 | `"100px"` |
| 500 | `"500px"`（边界，含） |
| 501 | `null`（边界外） |
| 1000 | `null` |

### 组件测试（Lit + Vitest）

render `<md-viewer>` content 含 `![](url)`：

- mock 小图（`naturalWidth = 80`，触发 load）→ 断言 `img.style.width === "80px"`
- mock 大图（`naturalWidth = 1200`）→ 断言 `img.style.width === ""`（未设）

jsdom 的 `img.naturalWidth` 默认 0，需在触发 load 前用 `Object.defineProperty` 设值。

### 手动验证

用 `test_work_dir/图片预览测试.docx` 预览，确认 icon 不再被拉伸到全宽；再抽一个含大图的 PDF 确认大图仍铺满。

## 未来升级触发条件（→ 方案 B/C）

当以下任一出现，再考虑后端记录显示尺寸：

1. 文档库出现大量"高分辨率设计 icon"（底层 ≥512、显示 ≤128），前端漏判明显
2. 产品要求无闪烁加载（lazy 图不可接受瞬铺满）
3. 需要在加载前就精确布局（消除 CLS）

升级路径：parser 记录显示尺寸 → `_meta.json` 增 `disp_w / disp_h` → 前端优先用显示尺寸，`naturalWidth` 兜底。

## 改动清单

- [ ] `doclens/web_v2/frontend/src/components/md-viewer.ts`：新增 `ICON_PX_THRESHOLD` 常量、`iconWidthStyle` 纯函数、`_applyIconSizing` 方法、`updated()` 接入
- [ ] `doclens/web_v2/frontend/tests/`：新增 icon-sizing 测试
- [ ] 重新构建前端（`npm run build`）+ 重启后端验证

---

## 修订（2026-07-13）：升级到方案 B（显示尺寸判定）

### 触发
方案 A 上线后 E2E 测试 `公司/无线网络优化AI实践交流.pptx` 发现"部分 icon 仍被拉伸"。build 成功（部署 OK）、部分失效 → 排除部署问题，确定是判定逻辑缺陷。

### 根因（数据验证）
扫描该 PPTX 94 张图：73 个显示≤200 的 icon 中，**29 个底层像素 >500**（最高 1024）：
- slide7: 显示 38×38，底层 800×800
- slide10: 显示 17×19，底层 1024×1024

PPTX 用高分辨率素材，**底层像素（naturalWidth）无法区分 icon 与大图**（≤500 与 >500 各 47 张，各占一半）。方案 A 的 naturalWidth 判定对 PPTX 高分辨率 icon 完全失效。这正是原 spec 列的"未来升级触发条件 #1"，现已触发。

### 方案 B：用文档显示尺寸判定
判定依据从"底层像素"改为"文档显示尺寸"（ground truth）。已验证 API：
- **PPTX**: `shape.width`（EMU÷9525=px）
- **DOCX**: inline shape `width`（EMU÷9525=px）
- **PDF**: fitz `page.get_image_info()` 的 `bbox` 宽（`(bbox[2]-bbox[0])×96/72`=px），`number`=xref

### 详细设计（方案 B）

**后端 `image_store.py`：**
- `ImagePart` 增 `disp_w: int | None`（显示宽 px；None 表示未提供）
- `_meta.json` 每条增 `"disp_w": <px>`（有则写）
- `_inline_md(seq, rel_path, disp_w)`：有 disp_w 时 URL 追加 `&dw=<px>`
- `extract_for_doc` 把 disp_w 透传到 meta + inline_md

**后端 parser：**
- `markitdown_parser._extract_pptx_slide_images`：`ImagePart(..., disp_w=round(shape.width/9525))`
- `docx_parser._extract_docx_headings`：`ImagePart(..., disp_w=round(sh.width/9525))`
- `pdf_parser._extract_pdf_page_images`：改用 `page.get_image_info()`（每条含 bbox+number=xref），`disp_w=round((bbox[2]-bbox[0])*96/72)`，blob 仍用 `doc.extract_image(xref)`

**前端 `md-viewer.ts`：**
- `_applyIconSizing`：每张 img 先解析 `src` 的 `dw` 查询参数；有 `dw` 且 ≤500 → `style.width = dw+"px"`；无 `dw` → 退回 `iconWidthStyle(naturalWidth)`（保留方案 A 兜底，兼容旧索引）
- `iconWidthStyle` / `ICON_PX_THRESHOLD` 不变（仍 500，现作用于显示尺寸）

**重新索引：必须**（让新 meta + dw URL 生效）。

### 方案 A 代码去留
Task 1/2 已实现的 `iconWidthStyle` + `_applyIconSizing`（naturalWidth 路径）**保留为兜底**——无 `dw` 的旧索引图仍按 naturalWidth 判定，不会变坏。
