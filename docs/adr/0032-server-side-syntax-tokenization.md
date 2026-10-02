# ADR-0032: 代码预览语法高亮——服务端分词 + token 流

- 状态：已接受
- 日期：2026-09-30
- 关联决议：ADR-0031（预览与索引解耦的同款语义延伸）

## 背景

代码文件的预览页此前是纯文本 + 行号视图，无任何语法着色。加高亮的常规
做法是前端引入高亮库（highlight.js / Prism / Shiki），但主 bundle 目前已
1.1MB（gzip 310KB），任一高亮库都是数百 KB 级增量（Shiki 更是 MB 级），
且解析、着色、DOM 构建都在浏览器主线程，长文件首屏渲染成本后置到客户端。

本项目后端是常驻 FastAPI 进程，预览是按需单请求——分词在服务端做，前端
只负责按类别上色，两头各取所长。

## 决策

**语法分词在后端完成（Pygments），前端零高亮库、只按 kind 着色。**

1. **引擎 = Pygments**（`get_lexer_for_filename` 按文件名解析，600+ 语言
   免费全开；**不做**内容嗅探 `guess_lexer`——慢且不可预测）。此前仅作
   rich 的传递依赖存在，本次提升为根 pyproject 显式依赖。
   - 否决 tree-sitter：本机 `tree_sitter_languages` 无 Windows ARM64
     wheel（仓库已知坑），且 AST 节点→语义类别的映射表要逐语言维护。
   - 否决自写正则分词器：每语言一套规则的维护黑洞。

2. **传输 = 逐行 token run 数组**。`PreviewResponse` 新增可选 `tokens`
   字段：外层 = 行（与 `content` 的 `\n` 切分一一对应），内层 = run 的
   `[kind, text]`。kind 归一化为 8 类单字符：`c`注释 `k`关键字 `s`字符串
   `n`数字 `f`函数·方法名 `t`类型·类名 `o`操作符 `p`标点；未归类 run 用
   空串（前端正文色，不挂 class）。相邻同 kind run 后端合并，省 payload。
   - 否决 Pygments HTML 整块（`unsafeHTML` 注入 + 行号槽 hack + 引入
     DOMPurify 面）；否决内联样式（颜色写死 payload、体积最大）。

3. **分词始终整文件进行，再按行切片**——范围预览（`start_line`/
   `end_line`，搜索命中 ±10/+20 行）与整文件预览共享同一次分词结果切片，
   多行字符串/块注释的跨行词法天然正确，切片行号与 `line_range` 同口径。

4. **覆盖面 = 文件名解析全开**：Pygments 认得的扩展（yaml/toml/sql/sh/
   php/ruby/…几百种）全部高亮；未知后缀 / `.txt`（TextLexer）/ `.md` /
   `.html`（前端有专属视图）→ 不下发 tokens，前端回退纯文本渲染（现状）。

5. **上限 = 1MB**（content 字节数）：超限不分词（纯文本兜底），防大文件
   payload 爆炸（token 化约为原文 1.5~2.5 倍体积）与分词延迟。

6. **前端渲染**：preview-pane 非 md 分支按行渲染 run span（Lit 模板安全
   构建，无 `unsafeHTML`），8 类 CSS 配色对齐 Meta 亮色画布（克制不花
   哨）；tokens 行数与 content 行数失配时整体放弃高亮（防御异常 lexer）。

## 索引边界（重要）

**代码文件默认不进索引**——`CORTEX_ALLOWED_SOURCE_TYPES` 默认值明确排除
`code/json/xml`。本特性是纯预览侧能力，预览与索引解耦（ADR-0031 同款
语义）：不碰 `allowed_source_types`，不碰 treesearch，代码文件入口只有
files 页文件树 → 预览。

## 后果与风险

- 前端主 bundle 零增量（无高亮库），高亮成本转移到后端单请求 CPU
  （几百 KB 代码毫秒级~几十毫秒，可接受）。
- payload 增大（tokens ≈ 原文 1.5~2.5 倍）：仅代码文件预览请求，本地
  回环传输，可接受。
- 8 类归一化是有意损失：Pygments 100+ token 类别压到 8 类，换前端
  调色板恒定。未来要加类别需前后端同步（契约共同锁定，kind 单字符
  命名空间留有余量）。
- 颜色不可随暗色主题切换（当前无暗色模式，非问题；若未来加暗色需
  token kind 不变、仅换 CSS 变量——架构已预留）。
