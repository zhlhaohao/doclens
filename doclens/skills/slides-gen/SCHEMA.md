# PPT 中间格式语法规范

介于自然语言与演示产物之间的 Markdown 表示。文档级元数据走 YAML frontmatter，页级与块级指令走 HTML 注释，正文是合法 CommonMark——任何 MD 渲染器可直接预览本格式文件。

渲染器（`renderer/`）把本格式编译为**单文件自包含 HTML**（点击翻页 / 动画 / 备注 / 打印导出 PDF），并内置**逐页视觉验收**。失败语义贯穿全文：**警告 + 降级，永远产出可用 deck**。

---

## 1. 文档结构

```
---（frontmatter，可选）---
<!-- slide: ... -->（第 1 页页指令，可选）→ 页 1 内容
<!-- slide: ... --> → 第 2 页内容
...
```

- 每条 `<!-- slide: -->` 注释开启新页；首页无页指令时，文档从 frontmatter 之后的内容起自动成页
- 页指令与块指令内均为空格分隔的 `key=value` 对；值含空格时用引号包裹
- 未识别的键 → 忽略 + 警告；值非法 → 回落默认值 + 警告
- `---` 在 two-col 版式中是**栏切分符**，其他版式渲染为水平细线

## 2. Frontmatter（文档级，全部可选）

```yaml
theme: corporate-blue   # 主题名 = themes/<名>.json 文件名；缺省 clean-white
size: "16:9"            # 16:9 (1280×720) | 4:3 (960×720) | A4 (794×1123)
title: 文档标题          # 浏览器标题 / 元数据
author: 张三
anim: none              # 全局动画默认（页/块可覆盖）；取值同页指令 anim
transition: fade        # 全局切换默认；取值同页指令 transition
font:                   # 可选覆盖主题字体（部分覆盖即可）
  family: "微软雅黑"     # 正文字体族
  mono: "Consolas"      # 等宽字体（代码块）
```

## 3. 页指令 `<!-- slide: k=v k=v -->`

置于每页内容之前，兼作分页符。

| 键 | 取值 | 默认 |
|---|---|---|
| `layout` | 版式名 = `layouts/<名>.html` 文件名（内置 19 个见附录 A） | `title-content` |
| `transition` | `none` / `fade` / `push` / `wipe` / `zoom` | 继承 frontmatter |
| `anim` | `bullets:<入场词>` / `all:<入场词>` / `none` / `<入场词>` | 继承 frontmatter |
| `bg` | 主题角色名（如 `bg-alt`）或 `#RRGGBB` | 主题 `bg` |
| `notes` | 任意文本（渲染到演讲者备注窗格，按 `N` 显示） | — |
| `kicker` | 字符串：标题**上方**小标签（章节胶带），如 `kicker="01 · 数据"` | — |
| `takeaway` | 字符串（支持 `**加粗**`）：页底**结论胶囊**，这一页的一句话结论 | — |
| `source` | 字符串：页底数据来源；不以「来源/Source」开头时自动加「来源：」前缀 | — |
| `footnote` | 字符串：页底一行说明，原样显示（不加前缀） | — |

**槽位优先级**：`takeaway` 与 `source`/`footnote` 并存时，`source` 并入胶囊右侧小字，
`footnote` 放到胶囊下方一行；只有 `source`/`footnote` 时排在页底。

```markdown
<!-- slide: layout=stats kicker="01 · 数据"
     takeaway="日活是 ChatGPT 同期近 3 倍" source="官方公告 2025-09" -->
```

页级 `anim` 语义：
- `bullets:词` — 本页每个顶层列表项按序播放该入场动画（0.3s 递增延迟）
- `all:词` — 本页全部内容块按序播放
- `none` — 本页禁用动画（覆盖全局默认）
- 单独一个入场词 — 等价 `all:词`

## 4. 块指令 `<!-- block: k=v -->`

紧贴其后（允许中间空行）的**单个内容块**生效；一个内容块 = 一个 MD 顶层元素（标题/段落/列表/表格/代码块/图片/引用块/水平线）。

| 键 | 取值 | 说明 |
|---|---|---|
| `anim` | 动画白名单词 + 可选 `direction=left\|right\|up\|down` | 覆盖页级策略 |
| `align` | `left` / `center` / `right` | 文本对齐 |
| `fit` | `cover` / `contain` / `stretch` | 仅图片块；cover=填满裁剪（默认），contain=完整留白，stretch=拉伸变形 |
| `style` | `rounded` / `circle` / `shadow` | 仅图片块装饰，可组合 `style=rounded,shadow` |
| `chart` | `bar` / `line` / `pie` / `doughnut` / `stacked` | 紧随的 MD 表格 = 数据源 → 内联 SVG 图表 |
| `highlight` | 0 基整数 | 突出第几个类目（其余淡化）；饼图/环形图按类目着色顺序生效 |
| `unit` | 字符串，如 `%` `万` | 数值后缀 |
| `format` | `0` / `0.0` / `#,##0` | 数字格式 |

**图表 + 结论（insights）**：图表块后**紧跟一个列表**，会自动排成「图左 + 结论右」两栏：

```markdown
<!-- block: chart=bar highlight=3 unit=万 format=#,##0 -->

| 季度 | 营收 |
|---|---|
| Q1 | 1200 |
| Q4 | 3100 |

- 全年增长 **158%**
- Q4 首次突破 3000 万
```
| `x` `y` `w` `h` | 百分比（如 `x=10%`） | **仅 blank 版式合法**；其他版式下警告并忽略 |
| `color` | 主题角色名（`#RRGGBB` 逃生舱） | 该块文字颜色 |

## 5. 动画词表（封闭白名单）

未识别的动画词 → 降级为 `fade` + 警告，不中断。

| 类别 | 词 | 方向参数 |
|---|---|---|
| 切换 | `none` `fade` `push` `wipe` `zoom` | — |
| 入场 | `enter.appear` `enter.fade` `enter.fly-in` `enter.zoom` `enter.wipe` | fly-in/wipe 支持 `direction=left/right/up/down` |
| 退场 | `exit.fade` `exit.fly-out` | fly-out 支持 direction |
| 强调 | `emphasize.pulse` `emphasize.grow` | — |

时序：默认 `trigger=after`、延迟 0.3s 递增（自动逐项播放）；块指令可写 `trigger=click` 改为点击触发。

底层实现：入场/退场/强调 = CSS keyframes（由 presenter.js 挂类触发）；切换 = 幻灯片切换 keyframes。
白名单外动画（路径动画、陀螺旋等）不支持，写了会降级为 fade 并给出警告。

播放控制：`← →` / 空格 / PgUp / PgDn / Home / End / 点击推进 / 滚轮 / 触摸滑动；
`N` 切换备注窗格、`F` 全屏、`P` 打印导出 PDF、`H` 隐藏操作提示。

## 6. 正文（CommonMark + 3 标签行内白名单）

块级元素与 HTML 渲染映射：

| MD 语法 | 渲染 |
|---|---|
| `#`~`####` 标题 | 标题元素，字号映射主题阶梯（h1/h2/h3/h4） |
| 段落 | 段落元素 |
| `- ` / `1.` 列表（含嵌套） | 列表；嵌套 → 缩进层级（最深 3 级）；bullets 策略时逐项入场 |
| `>` 引用块 | 左侧 accent 色条 + 斜体强调块 |
| MD 表格 | HTML 表格（表头主题色打底；表窄时 `table-layout:fixed` 自动压缩） |
| 代码块 | 等宽字体 + 深底色块 |
| ```` ```mermaid ```` 代码块 | mermaid 渲染 PNG（base64 内嵌）；渲染器缺席 → 降级为代码块 + 警告 |
| `![alt](本地路径)` | 图片（相对路径相对 md 文件解析）；缺失 → 虚线占位框 + alt 文字 + 警告。**alt 约定带图位编号**（`![P3-图1 ...](...)`）——编号是图位永久身份，重生成只换路径不换编号（见 SKILL.md 生成纪律 6） |
| `---` 水平线 | two-col 版式 = **栏切分符**（其前 → 左栏，其后 → 右栏）；其他版式 = 水平细线 |

行内白名单（闭合集合，其余 HTML 标签按字面文本处理）：

- MD 原生：`**bold**` `*italic*` `` `code` `` `~~del~~` `[text](url)`（链接渲染为主色下划线，可点击）
- `<mark>文字</mark>` → 高亮（主题 accent 色底）
- `<span class="角色名">文字</span>` → 文字引用主题角色色
- `<i data-icon="图标名"/>` → 内联 SVG 图标（81 个内置，见 `assets/icons.json`；颜色随所在文字 currentColor；未知名忽略并警告）
- `<br>` → 软换行

**有意不提供 inline 字号**——字号只走主题阶梯，强调层级用标题层级表达。

## 7. 主题 JSON（`themes/<名>.json`）

```json
{
  "name": "corporate-blue",
  "colors": {
    "primary": "#1B4F8A", "accent": "#E8622D",
    "bg": "#FFFFFF", "bg-alt": "#F2F5F9",
    "text": "#1A1A1A", "text-muted": "#6B7280",
    "table-header": "#1B4F8A", "code-bg": "#101418", "stage-bg": "#1B1D21"
  },
  "fonts": { "family": "微软雅黑", "mono": "Consolas" },
  "sizes": { "h1": 40, "h2": 30, "h3": 22, "body": 18, "caption": 14 },
  "chart_series": ["#1B4F8A", "#E8622D", "#2E9E6B", "#8A5CB8", "#C0392B"]
}
```

- `colors` 键即主题角色名，`<span class>` 与 `color=`/`bg=` 按名引用；未知角色名 → 警告 + 回退 `text`
- `stage-bg` = 幻灯片外的舞台底色（演示态背景），浅色主题自动给深灰底
- `sizes` 单位 px；版式内标题层级 → h1~h4 映射
- `shape`（可选）：**形状语言**，决定「硬还是软」——`radius`（卡片圆角 px）、`shadow`（`none`/`soft`/`strong`）、`card_alpha`（卡片底色不透明度，0=透明描边）、`depth`（`flat` 无边框 / `ring` 主色细边 / `whisper` 极淡边）
- `background`（可选）：**背景母题**，`decor` 取 `none`/`gradient`/`grid`/`dots`/`arcs`/`blobs`/`band`（纯 CSS 渐变，零外部资源）；封面可单独用 `cover_decor`

> 光换配色做不出「硬边网格 vs 柔雾薰衣草」的差别——圆角、阴影、卡片质感、背景纹理必须一起变。实测：radius 0/14/22px 三套并排时，视觉模型判定「除配色外质感也明显不同」。
- `fonts.stack`（可选）：CSS 字体回退链，有序候选；`_serif`/`_sans-serif` 前缀表示通用族关键字（不加引号）。
  不写则用 `fonts.family` + 自动补齐到通用族。**任何单一字体都可能没装，务必留系统字体兜底**（见 FONTS.md）
- 自定义主题：往 `themes/` 放同构 JSON 即可，frontmatter 按名引用

## 8. 版式资产（`layouts/<名>.html`）

版式 = 一个 HTML 模板文件 + 自带 `<style>`。占位符 `{{title}}` `{{content}}` `{{left}}` `{{right}}` `{{image}}` 由渲染器填充。

```html
<div class="slide-inner layout-title-content">
  <div class="slot-title">{{title}}</div>
  <div class="slot-content">{{content}}</div>
</div>
<style>
  .layout-title-content .slot-title { padding-bottom: 16px; border-bottom: 2px solid color-mix(in srgb, var(--c-primary) 30%, transparent); }
</style>
```

- 版式内样式只作用于 `.layout-<名>` 命名空间（多版式共存不串味）
- 颜色/字体一律用主题 CSS 变量（`var(--c-primary)` / `var(--fs-body)`），**禁止写死色值**
- slot 语义：`{{title}}` = 本页 `#` 一级标题；`{{content}}` = 其余内容块；双栏版式用 `{{left}}`/`{{right}}`；图文版式的 `{{image}}` = 本页第一张图
- **留白约定**：`.slide` 统一 `padding: var(--pad, 72px)`（四周 72px 安全边距），内容不得顶边
- 内容自适应：presenter.js 的 autofit 会测量真实包围盒并按需缩小（下限 0.6），缩到底仍溢出则验收报 `overflow` → 应拆页
- 新增版式 = 新增一个 HTML 文件，零代码改动（版式名 = 文件名）
- **容量声明**：版式根元素可带 `data-cap`（JSON），声明该版式装多少内容：

  ```html
  <div class="slide-inner layout-title-content"
       data-cap='{"bullets": 6, "bullet_chars": 40, "total_chars": 240,
                  "table_rows": 8, "table_cols": 4, "image_min_ratio": 0.0}'>
  ```

  字段语义：`bullets`=要点条数上限、`bullet_chars`=单条字数、`total_chars`=本页正文总字数、
  `table_rows`/`table_cols`=表格行列上限、`image_min_ratio`=图文版式中图片应占最小面积比。
  `check` 子命令按此预检，`capacity` 子命令汇总打印。未声明则用内置兜底值。

## 7b. 高语义版式（形状驱动，语法零扩展）

这五个版式**不需要新语法**——用普通 Markdown 的表格/列表写成「看形状就懂」的结构，
渲染器按形状还原成结构化版面。剥掉 HTML 注释后仍是可读文档。

| 版式 | 数据形状 | 说明 |
|---|---|---|
| `stats` | 2 列表格：值 \| 标签 | 数据卡片（1-4 张）。首列像数字则作值，否则按 标签\|值 |
| `timeline` | 3 列表格：日期 \| 事件 \| 说明 | 时间线（2-6 节点）。也接受列表：`2025-03 立项：说明` 会被拆解 |
| `matrix` | 3×3 表格（首行首列为轴标签） | 2×2 象限。轴名可用页指令 `x_axis`/`y_axis` 覆盖 |
| `compare` | 正文 `---` 切两栏 + 每栏首个 `**加粗**` 段落作小标题 | 两方对比，右栏默认高亮；`vs_label="对比"` 改中间文字（空串则去掉） |
| `big-number` | 页指令 `number="3 倍"`，或正文首行数字 | 大数字主张页；下一行标题作大字说明，其余降为小字 |

示例：

```markdown
<!-- slide: layout=stats takeaway="日活是同期近 3 倍" -->

# 它火得数据很硬

| 数值 | 说明 |
|---|---|
| **73 万** | 上线 5 天下载量 |
| **250 万** | 13 天全网累计 |

<!-- slide: layout=timeline -->

# 三步走到今天

| 日期 | 事件 | 说明 |
|---|---|---|
| 2025-03 | 立项 | 三人小团队 |
| 2025-09 | 上线 | 5 天下载 73 万 |

<!-- slide: layout=matrix x_axis="实施成本" y_axis="业务价值" -->

# 四个方向怎么排

|  | 低成本 | 高成本 |
|---|---|---|
| **高价值** | 快速试点 | 战略投入 |
| **低价值** | 顺手做 | 暂缓 |

<!-- slide: layout=big-number number="3 倍" -->

# 效率提升

### 同样一个需求，从两天到半天
```

**降级**：形状不符时退回通用渲染并警告，不中断。

**容量**：stats 4 卡/120 字；timeline 6 节点/200 字；matrix 4 象限/160 字；
compare 8 条/200 字；big-number 3 条/130 字。

## 8b. 设计预算（确定性规则，非审美偏好）

| 预算 | 规则 | 检查点 |
|---|---|---|
| **字号阶梯** | autofit 只在 5 档切：`body 22 / 20 / 17 / 15 / 13`（对应 `--fit` = 1 / .909 / .773 / .682 / .591） | 渲染时 |
| **可读下限** | 页内最小字号 ≥ 16px（<16 判 high）；缩到最小档仍溢出 → 判「必须拆页」 | 验收时 |
| **孤字** | 折行末行不得只剩 1-2 字（`text-wrap: pretty` 规避） | 渲染时 |
| **强调色** | 单页 accent ≤ 3 处、着色面积 ≤ 版面 8% | 验收时 |
| **对比度** | 正文/背景 ≥ 4.5:1，主色与强调色/背景 ≥ 3:1（WCAG） | `check` 时 |
| **图标** | 单页 ≤ 3 个；名称必须在 `assets/icons.json` 内 | 渲染时 + 建议 |

## 8c. 五维自评

`qa` 额外产出整册五维评分（0-10）：统一 / 层级 / 细节 / 传达 / 节奏，附最弱项与整册改进建议。
**不阻断交付**（阻断靠 high 问题与单页 score < 70），但必须在交付说明里报给用户。

**评分防呆**：五维**各算各的，不取平均**（「统一 9 / 传达 4」平均 6.5 看起来及格，其实传达不及格）。
分数段：0-4 不及格 / 5-6 能用 / 7-8 扎实 / 9-10 出彩。
量化锚：层级 = 最大字号 ÷ 正文中位 ≥1.5；节奏 = 各页字数变异系数 0.3-0.7（全册一样长会闷）。

## 9. 失败语义汇总

| 场景 | 行为 |
|---|---|
| 未知版式名 | 降级 `title-content` + 警告 |
| 未知动画词 | 降级 `fade` + 警告 |
| 未知主题名 | 回退 `clean-white` + 警告 |
| 未知主题角色 | 回退 `text` 角色 + 警告 |
| 缺失图片文件 | 占位框 + alt 文字 + 警告 |
| mermaid 渲染器缺席 | 降级代码块样式 + 警告 |
| 内容超量（列表 >8 条 / 表格 >9 行） | 渲染警告 + 建议拆页（验收环节会判 overflow/density） |
| 坐标指令用在非 blank 版式 | 警告并忽略 |
| 未知指令键 / 坏 frontmatter | 忽略（或整段忽略）+ 警告 |
| 非 MD 语法错误 | 按字面文本渲染（MD 容错） |
| 输入根本不是文本/读不到 | 唯一硬错误，退出码非 0 |
| **验收不通过** | 退出码 1 + 报告未通过页清单（必须修复后重跑） |

## 附录 A：内置版式（19 个）

| 版式名 | 用途 |
|---|---|
| `title` | 封面页：超大标题 + 副标题 + 落款 |
| `section` | 章节过渡页：accent 打底 + 章节大字 |
| `title-content` | 标题 + 单栏内容（默认工作版式） |
| `two-col` | 左右双栏（`---` 切栏） |
| `image-left` | 图左文右（每页限一张主图） |
| `image-right` | 文左图右 |
| `quote` | 大引述页（引文 + 署名） |
| `blank` | 自由画布（仅此版式允许坐标块） |
| `stats` | 数据卡片（2 列表格：值 \| 标签） |
| `timeline` | 时间线（3 列表格：日期 \| 事件 \| 说明） |
| `matrix` | 2×2 象限（3×3 表格） |
| `compare` | 两方对比（`---` 切栏） |
| `big-number` | 大数字主张页（`number=` 页指令） |
| `grid` | 卡片网格 2-6 张（2 列表格：标题\|说明） |
| `agenda` | 目录/议程（表格或列表，自动编号） |
| `pyramid` | 金字塔 3-4 层（首行为顶层） |
| `funnel` | 转化漏斗（阶段\|数值，自动算转化率） |
| `cycle` | 循环节点 3-5 个（首尾相连） |
| `closing` | 收尾行动页（标题=决定请求，列表=下一步含负责人/期限） |

## 附录 B：内置主题（4 个）

共 14 套，按气质分组：

| 明亮商务 | 深色 | 特色 |
|---|---|---|
| clean-white 白净 | dark-tech 深色科技 | swiss-grid 瑞士网格 |
| corporate-blue 商务蓝 | black-gold 黑金述职 | ink-magazine 墨水杂志 |
| business-blue 企业蓝 | wave-launch 深海发布会 | cobalt-type 钴蓝排版 |
| warm-paper 暖纸 | | geo-blocks 几何色块 |
| mint-fresh 薄荷 | | lavender-soft 薰衣草 |
| warm-orange 暖橙 | | |

全部通过 WCAG 对比度校验（正文 ≥4.5:1、主色与强调色 ≥3:1）。
`extract-style` 可从任意参考图生成新的同构主题。

## 附录 D：视觉验收产物

`build` / `qa` 在 `<name>-qa/` 下产出：

- `pXX.png` — 每页 2x 截图（QA 模式：动画瞬时、演示 UI 隐藏）
- `report.md` — 人类可读问题清单（按严重度排序，含修复建议）
- `report.json` — 结构化 issues（`type/severity/where/detail/fix/source`）

判定：任一 `high` 级问题 或 视觉评分 < 75 → 该页不通过。全部页面通过才算交付完成。

## 附录 C：最小示例

```markdown
---
theme: corporate-blue
size: "16:9"
---

<!-- slide: layout=title -->

# 产品发布会

2026 年度旗舰产品
汇报人 · 2026-11-01

<!-- slide: layout=title-content transition=fade anim=bullets:enter.fly-in notes="开场三要点" -->

# 核心亮点

- **快**：性能提升 3 倍
- **稳**：99.99% 可用性
- **省**：成本下降 40%

<!-- slide: layout=image-right -->

# 架构总览

<!-- block: fit=contain style=rounded,shadow -->
![系统架构图](images/arch.png)

- 接入层
- 服务层
- 存储层

<!-- slide: layout=quote bg=bg-alt -->

> 简单是可靠的先决条件。

—— Edsger Dijkstra

<!-- slide: layout=title-content -->

# 季度数据

<!-- block: chart=bar -->

| 季度 | 营收 |
|---|---|
| Q1 | 120 |
| Q2 | 180 |
| Q3 | 260 |
```
