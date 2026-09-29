# ADR-0031: PDF 原生预览（pdf.js 组件层）

- 状态：已接受
- 日期：2026-09-28
- 关联决议：2026-08-21 目录抽屉（pdf 部分）、2026-09-28 匹配导航 / 分页懒渲染（pdf 部分退役）

## 背景

PDF 预览历来走「合成 md」链路：pdfplumber 提取纯文本 → DB structure_json →
`render_tree_to_md` 合成 markdown → md-viewer 渲染。提取阶段排版信息即已丢失
（双栏变串行、表格碎裂、图片脱离位置、公式乱码）——「效果不好」的病根在原料，
不在 viewer。换 viewer 治不了，只有把原始 PDF 字节发到前端才能治。

## 决策

采用 **pdf.js 渲染**（pdfjs-dist 官方 viewer **组件层**：PDFViewer +
PDFFindController + PDFLinkService，自有 UI 皮），并作出以下七项配套决策：

1. **单路径，无 fallback**——PDF 预览只走 pdf.js；磁盘文件移走（索引仍在）
   时明确报错，不退回合成 md。
2. **渲染架构 = 组件层而非核心 API 全自建**——官方页面虚拟滚动 + 文本层 +
   查找引擎白拿；也非整套 viewer.html（工具栏双份、无法对接自有 header/高亮
   输入条/TOC 抽屉）。
3. **TOC 目录抽屉只用 PDF 原生书签**（`getOutline()` + PDFLinkService 跳转）；
   无书签隐藏按钮（沿「无 heading 隐藏」既有语义）。不用 DB heading 树换算
   兜底——heading `line_start`（提取文本原始行号）与页边界的换算要跨
   「剥除 `[PAGE N]` 重排行号」的坑，正是当年 pdf line_map 被丢弃的同一鸿沟。
4. **搜索命中定位 = 跳到所在页**。页边界表（`page_starts`：每页起始行号，
   原始提取文本体系）由 pdf_parser 解析时**持久化进索引**（treesearch 侧
   Document/DB 扩展，随 treesearchlib 发版）。无页表不定位、不兜底；存量
   索引以 force 重建换取覆盖。
5. **缩放 = PDF 原生语义**——默认适宽；移动端双指 pinch / 桌面 Ctrl+滚轮 /
   ←/→ 翻页；字号 stepper 对 PDF 隐藏（该控件属流式文档）；缩放不跨会话持久化。
6. **未索引的 PDF 直接渲染**——字节端点只做越权校验与磁盘存在性，不查 DB。
   「预览原文件」与「索引」解耦；DB 增强功能（页表/书签）有则用、无则降级。
7. **匹配导航平移重建**——高亮输入条 → `findController.executeCommand`，
   Enter/Shift+Enter = `findagain` + `findPrevious`，n/m 徽标取
   `updateUIState`。已知语义损失：英文「空格分词多词 OR 高亮」变单短语
   （findController 的 query 是短语语义），接受。

## 关键权衡记录

- **否决浏览器内置 viewer（iframe）**：零体积零工程量，但 Android WebView
  无内置 PDF 渲染器（宿主是一等公民，jsbridge/宿主标题皆为真实场景），
  且内置 viewer 不接受程序化控制——高亮/跳转/TOC 全部失效且无法重建。
- **体积账**：主 bundle 不变（pdfjs-dist 动态 import 分 chunk，仅打开 PDF
  时加载 ≈ +1.5MB 主库 +1MB worker）；SW `/assets/*` cache-first 策略天然
  覆盖新 chunk，首次下载后永久缓存、离线可用，sw.js 零改动。
- **「预览=索引副产品」旧哲学的松动**：旧约束是被迫的（合成 md 只能来自
  DB），原料换成磁盘字节后解耦是诚实的选择，不是纪律松懈。

## 退役清单

- `_extract_pdf_pages`（[PAGE N] 剥除 + 合成页标记）
- pdf 分支 line_map 丢弃逻辑（`final_line_map = None if pdf`）
- TOC 的 pdf heading 提取（extractHeadings 对 pdf 不再消费）
- md-viewer 对 pdf 的服务（docx/pptx/xlsx/epub 不受影响）

## 后果与风险

- treesearch 索引 schema 扩展（page_starts），需发版 treesearchlib；存量
  索引无页表 → 搜索命中不定位（静默），force 重建后覆盖。
- pdf.js 组件层 pinch 手势支持有限，需自接 touch 事件驱动 scale（本方案
  唯一自建交互）。
- pdfjs-dist 5.x 对 JS 引擎要求较新，老 Android WebView 内核可能需 legacy
  build（实施期实测）。
- 搜索命中跳页精度受制于 pdfplumber 提取行号与页边界的对齐（同一解析器
  产物，体系一致，无跨体系换算）。
