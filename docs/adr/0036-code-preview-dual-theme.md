# 代码预览双主题（浅色/深色）

代码预览的 8 类语法 token 色硬编码于 preview-pane 组件、仅适配浅底（ADR-0032 服务端分词的前端消费侧）。决定：**「深色」只作用于代码预览（行号视图），不做全应用主题**——行号视图（代码/txt/兜底文本共用渲染路径）整体局部换肤，周边 header/UI 维持 Meta 白画布。

- 入口 = 预览 header 快捷钮两态 toggle（浅 ⇄ 深，太阳/月亮图标），机器级 localStorage 持久化（`"light" | "dark"`，默认 light），即选即生效——与「字号缩放」(font-scale) 完全同构的纯显示偏好，不进设置页（设置页字段与后端 env 有契约，见 settings-fields.ts）。
- 深色色板基准 = GitHub dark（canvas `#0d1117`、行号 `#161b22`、8 类 token 对齐 GitHub dark 语法色）——与 diff-viewer 既有红绿语义色视觉同源；「Meta 白画布」标尺只约束全应用 UI，代码预览局部换肤属编辑器语义、在标尺之外。
- 明确排除：md 文档内 fenced 代码块（白底阅读流不嵌深色拼图）、diff 视图（自有中性底+红绿体系）、PDF/邮件/图像等其他预览形态。
- 否决三态「跟随系统」（`prefers-color-scheme`）：周围 UI 恒浅色，系统深/应用浅/预览深三层混搭更乱；两态将来加 `"auto"` 是兼容扩展不破坏。
- 否决全应用双主题：tokens.css 全量双化 + Shoelace dark.css 切换工程量大，且与 Meta 设计系统白画布基调冲突；将来若立项不与本决策冲突（代码主题独立于全应用主题演进）。

实现口径：token 色从组件硬编码改为随主题属性切换的 CSS 变量（如 `--code-tok-k` 两套值），preview-pane 加 `codeTheme` 状态 + localStorage 读写（新 `utils/code-theme.ts`，模式照抄 font-scale.ts）。
