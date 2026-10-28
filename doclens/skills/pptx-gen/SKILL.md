---
name: pptx-gen
description: 生成 PPTX 演示文稿。以「PPT 中间格式」（Markdown + frontmatter + HTML 注释指令）写 deck 源文件，再调用随技能分发的转换器产出 PPTX。涵盖版式（8 种）、主题（4 套）、色彩（主题角色）、字体排版、动画（飞入飞出/切换/强调）、图片、表格、原生图表、mermaid、演讲者备注。当用户要求「做 PPT / 生成演示文稿 / 写 slides / 做汇报片」时使用。
icon: presentation
---

# pptx-gen — PPTX 生成技能

## 工作流（严格三步）

1. **写 deck 源文件** `<名>.md`——用本目录 `SCHEMA.md` 定义的中间格式，写到用户指定的知识库目录（与未来产物同目录）。
2. **调转换器** 产出 `<名>.pptx`（同目录）。
3. **自查产物**：读取转换器输出，确认无降级警告（或警告合理），向用户报告页数与文件路径。

## 中间格式速查（详见 SCHEMA.md，写之前必读）

- frontmatter：`theme`（clean-white/corporate-blue/dark-tech/warm-paper）、`size`（16:9/4:3/A4）、`anim`、`transition`、`font`
- 分页：`<!-- slide: layout=... transition=... anim=... bg=... notes="..." -->`
- 块级：`<!-- block: anim=... align=... fit=... style=... chart=... x= y= w= h= color=... -->`（坐标仅 blank 版式）
- 正文 = 合法 CommonMark + 行内白名单 `<mark>` `<span class="角色名">` `<br>`
- 动画词：`enter.fly-in`（direction=left/right/up/down）/ `enter.fade` / `enter.zoom` / `exit.fly-out` / `emphasize.pulse` …
- 图表：`<!-- block: chart=bar|line|pie -->` + 紧随的 MD 表格
- two-col 版式里 `---` 是栏切分符，不是水平线

## 生成纪律

1. **版式优先**：先想清楚每页用什么版式（8 选 1），不要用 blank+坐标手排——除非用户明确要求精确定位。
2. **颜色只写角色名**（primary/accent/text…），不写十六进制——配色由主题统一裁决。
3. **字号不手写**：强调层级用标题层级 `#`~`####`，字号走主题阶梯。
4. **每页一个焦点**：要点 ≤6 条/页；能 two-col 对比就不要单栏堆砌；有贯穿数据就上 `chart` 块。
5. **动画克制**：默认页级 `anim=bullets:enter.fly-in` 足矣；全页 `all:` 慎用。
6. **图片三级流程**（严格按序执行，节约 token 优先）：
   a. **先检测**：用 glob 在知识库内搜已有图片（`**/*.png` `**/*.jpg` 等，优先 `图片/AI/` 等约定目录），找到内容契合的就直接引用 `![alt](路径)`，**不要重复生成**；
   b. **无图才生成**：调 `mcp__jimeng__generate`（prompt 写清楚画面内容与风格，与 deck 主题匹配），落盘后引用返回的本地路径；
   c. **重生成**：用户对某图不满意 → 对**同一画面意图**换 prompt 重调 `generate`（新文件名落盘），更新 md 引用；不删旧图（用户可能反悔）。
   图片引用必须带 deck 内稳定编号：重生成换图换路径，编号不变（见纪律 7）。没有图就好好排文字，不编造路径。
7. **图片编号**：每个图位在 deck 内有稳定编号（P1 图位 1、P1 图位 2…），写在 alt 里——`![P1-图1 架构图](...)`。编号是图位的永久身份：引用户「重新生成第 3 页的图」，就定位 `P3-图1`、换 prompt 重生成、把 md 里该图位的路径换成新文件；其余图位不动。编号也让对话中指代无歧义（"P3-图1" vs 模糊的"那张架构图"）。
8. **notes 常写**：`notes="..."` 写演讲提示，几乎零成本。
9. **缺图/未知词不报错**：转换器会降级（占位框/fade），但你要读警告，能修则修（如拼错的版式名）。

## 调用转换器（双形态，按当前实例身份选）

- 发行版（数据目录 `.doclens`）：
  ```
  doclens-pptx-gen "<deck.md>" -o "<输出.pptx>"
  ```
  不可用时退回：`python -m doclens.skills.pptx-gen.converter "<deck.md>" -o "<输出.pptx>"`
- 开发版（数据目录 `.cortex`，python = `../cortex/.venv/Scripts/python.exe`）：
  ```
  <python> -m doclens.skills.pptx-gen.converter "<deck.md>" -o "<输出.pptx>"
  ```
- 常用参数：`--theme x`（临时换主题）、`--layout-dir`/`--theme-dir`（自定义资产）、`--strict`（警告当错误，调试用）
- 版式/主题资产在技能目录 `layouts/`、`themes/`；用户要新主题/新版式 = 新增同构文件，无需改代码

## 边界

- 只产出 PPTX；不做 PPT → MD 反向转换（那是知识库解析链路的事）
- 动画仅白名单（见 SCHEMA.md §5）；路径动画等不支持，写了会降级 fade
- 图表仅 bar/line/pie 三型；需要更复杂图表让用户出图后按图片引用
