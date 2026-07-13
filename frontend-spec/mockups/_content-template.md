# Mockup 内容模板（3 页面 × initial/focus × 桌面/移动）

> 供风格 mockup 使用。所有页面共享：`app-bar`（logo「Doclens」+ 右侧头像「L」）；桌面有 `activity-bar`（左侧竖条，3 个 SVG 图标：搜索/对话/文件，当前页高亮）；移动有 `tab-bar`（底部水平，3 tab 含 icon+label，当前页高亮）。
>
> 状态区 2 行（搜索/对话 initial 态的 welcome-pane 内，所有风格共享文本）：
> - 行1：`📁 …/cortex/test_work_dir  ·  📄 69 文档  ·  💾 12 MB`
> - 行2：`👁 ● 监控中  ·  🕒 3 分钟前  ·  🗂 .md 55 · .docx 7 · +2`

---

## 页面 1：search（搜索）

### initial 态
- `welcome-pane`：大标题「Doclens」+ 副标题「结构感知文档检索」+ 状态区 2 行
- `history-list`「历史会话」4 条：
  - 总结应急预案编写要点。 — 2026/7/11
  - 海洋深处的生态系统知识点 — 2026/7/11
  - max.poll.interval.ms — 2026/7/9
  - 固态电池原理 — 2026/7/7
- `input-box`：搜索框 placeholder「输入搜索关键词...」+「搜索」按钮 + keyword/grep 模式切换

### focus 态（有搜索结果）
- `focus-header`：圆形返回按钮（back-label「新搜索」）+ 标题「应急预案」+ meta「3 条结果」
- `results-col`（3-4 个 `result-card`）：每卡 = 路径（如「公司/安全/应急预案.md:42」+「路径」badge）+ snippet（1-2 行 markdown 片段）+ 评分「92%」（第一张高亮 active）
- `preview-pane`：
  - **桌面**：右侧并排常驻（带 header：路径 + 下载/编辑按钮 + md 内容片段含行高亮）
  - **移动**：全屏 overlay（第二个 focus-header「结果」+「编辑」action + preview noHeader）

---

## 页面 2：chat（AI 对话）

### initial 态
- `welcome-pane`：大标题「Doclens · 问日程」+ 副标题「与你的知识库对话」+ 状态区 2 行
- `history-list`「历史会话」4 条（同 search 但 type=chat）
- `input-box`：**多行** textarea placeholder「问 Doclens 任何问题...」+「知识库对话」按钮

### focus 态（对话进行中）
- `focus-header`：圆形返回（back-label「新对话」）+ 标题「新对话」+ meta
- `chat-stream`（3 条消息）：
  - **user 消息**（右对齐，纯文本）：「应急预案的核心要素有哪些？」
  - **assistant 消息**（左对齐，markdown）：含标题 + 2-3 段回复 + 一个**参考资料** ref-link 块（如「📄 应急预案.md」「📄 安全规范.docx」可点击）+ 一个 **tool-trace** 折叠条（「🔍 搜索了知识库 · 3 步」可展开）
- `input-bar`：底部多行输入框 + 提交按钮
- **preview**（可选，参考资料点击后）：
  - 桌面：右侧并排 `.preview-pane-wrap`（带 ✕ 关闭）
  - 移动：全屏 overlay（focus-header「返回」）

---

## 页面 3：files（文件浏览器）

files 无 initial/focus 状态机，按「无选中 vs 有选中」区分。

### 无选中（初始）
- **桌面**：三栏并排
  - 左 `tree-pane`：`file-tree` 目录树（3-4 个目录：「📁 公司/」「📁 项目/」「📁 资料/」，部分展开露子目录）
  - 中 `file-list`：文件表格（表头：名称/大小/修改时间/已索引 + 5-6 个文件行：.md/.docx/.pdf/.xlsx 混合，含类型 badge）
  - 右 `preview-col`：placeholder「点击文件预览」
- **移动**：单 pane 栈，展示 `list` pane（mobile-header 返回 + 路径面包屑 + 更多菜单 + 文件表格）

### 有选中（focus）
- **桌面**：三栏，中间 `file-list` 某行高亮选中，右侧 `preview-col` 显示选中文件（`.md` 内容 + 「✏️ 编辑」按钮 + 行号列）
- **移动**：`detail` pane（preview-pane 自带 mobile-header：返回 + 文件名 + 更多菜单 + 文件内容）

---

## mockup 组织建议

每个风格 HTML 文件含 3 个页面 section（search / chat / files），每 section 内用 grid 展示 4 个 mockup：
- initial-桌面 | initial-移动
- focus-桌面  | focus-移动

mockup 用缩略尺寸（桌面框缩放 0.5 或宽度限制 ~560px，移动框真实 375px）。每 mockup 标注「搜索 · 初始 · 桌面」等。风格说明放顶部。
