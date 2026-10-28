# ADR-0049：pptx-gen 技能与 PPT 中间格式

日期：2026-10-28
状态：已接受

## 背景

需要一个「生成 PPTX」的技能：LLM 不直接操作 PPTX 二进制，而是产出一种介于自然语言与 PPTX 之间的 Markdown 中间格式，再由独立转换器编译为 PPTX。要求涵盖色彩、版式、排版、字体、动画（飞入飞出）、图片等常见能力。

## 决策

1. **中间格式 = 纯 MD 混合形态**：文档级元数据走 YAML frontmatter，页级/块级指令走 HTML 注释（`<!-- slide: k=v -->` / `<!-- block: k=v -->`），正文是合法 CommonMark——任何 MD 渲染器可直接预览，md_to_tree/索引链路零改动。语法规范定稿于 `doclens/skills/pptx-gen/SCHEMA.md`。
2. **颜色 = 主题角色名为首选**（primary/accent/…），十六进制仅为逃生舱；主题是 JSON 资产（内置 4 套），可扩展。动机：LLM 乱配色是已知风险，配色权收归主题统一裁决。
3. **版式 = HTML 版式资产 + 受限布局引擎**：版式是 `layouts/<名>.html` 文件（div.row/div.col/slot + data-grow/gap/x/y/w/h 四原语），新增版式零代码；有意**不**做完整 CSS 渲染（headless 浏览器方案被否决——CSS 与 PPTX 文本度量根本不同构，映射永远有损且转换慢）。`blank` 版式保留百分比坐标块逃生舱。
4. **排版 = MD 原生基座 + 3 标签行内白名单**（`<mark>` / `<span class="角色">` / `<br>`）；有意不提供 inline 字号——字号只走主题阶梯，强调用标题层级。动机：LLM 排版自由度每加一分，主题一致性就丢一分。
5. **动画 = 封闭白名单词表 + 页级默认策略**：python-pptx 1.0.x 无公开动画 API（已核实），动画经手工注入 `p:timing` XML 模板（presetID/presetClass 体系）；切换走 `p:transition`。白名单外词汇降级 fade + 警告。默认 trigger=after、0.3s 递增延迟（自动逐项，开箱即有效）。
6. **图片** = MD 原生语法 + 本地路径；fit 三值（cover/contain/stretch）+ 装饰三值（rounded/circle/shadow）；缺图渲染占位框不中断；mermaid 块经 mmdc/npx 渲染 PNG，缺席降级代码块样式。
7. **失败语义贯穿**：警告 + 降级，永远产出 PPTX（未知版式→title-content、未知主题→clean-white、未知动画词→fade、缺图→占位框、未知键→忽略）；唯一硬错误 = 输入不可读。
8. **技能包自足**：SKILL.md（生成纪律）+ converter/（parser/layouts/anims/renderer + CLI）+ layouts ×8 + themes ×4 + examples/demo.md（全特性夹具）。转换器可脱离技能独立运行；md 源与 pptx 产物同目录落知识库（deck 源即知识）。

## 后果

- 优点：LLM 生成面全部是 MD（认知负担最小）；主题/版式均为数据资产，用户可扩展不碰代码；产物全可编辑（真表格/真图表/真动画）。
- 代价：动画白名单每扩一词需人工验证一张 timing XML 模板；受限布局引擎不支持自动文本度量（超长文本可能溢出占位框，PPT 手调兜底）。
- 后续可演进：列表逐项动画拆分（现为整框动画）、更多主题装饰、PPTX→MD 反向解析（不在本技能范围）。
