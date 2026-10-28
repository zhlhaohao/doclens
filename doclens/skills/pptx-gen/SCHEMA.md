# PPT 中间格式语法规范

介于自然语言与 PPTX 二进制之间的 Markdown 表示。文档级元数据走 YAML frontmatter，页级与块级指令走 HTML 注释，正文是合法 CommonMark——任何 MD 渲染器可直接预览本格式文件。

转换器（`converter/`）是本规范的唯一参考实现；失败语义贯穿全文：**警告 + 降级，永远产出 PPTX**。

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

## 2. Frontmatter（文档级，全部可选）

```yaml
theme: corporate-blue   # 主题名 = themes/<名>.json 文件名；缺省 clean-white
size: "16:9"            # 16:9 | 4:3 | A4（宽屏/标准/竖版文档）
title: 文档标题          # 仅元数据（不渲染；封面文字写在正文里）
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
| `layout` | 版式名 = `layouts/<名>.html` 文件名（内置 8 个见附录 A） | `title-content` |
| `transition` | `none` / `fade` / `push` / `wipe` / `zoom` | 继承 frontmatter |
| `anim` | `bullets:<入场词>` / `all:<入场词>` / `none` / `<入场词>` | 继承 frontmatter |
| `bg` | 主题角色名（如 `bg-alt`）或 `#RRGGBB` | 主题 `bg` |
| `notes` | 任意文本（渲染到演讲者备注窗格） | — |

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
| `chart` | `bar` / `line` / `pie` | 紧随的 MD 表格 = 数据源 → PPTX 原生图表（Office 可编辑） |
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

底层实现：入场/退场/强调 = OOXML `p:timing` preset（presetID/presetClass 注入）；切换 = `p:transition` 元素。白名单外动画（路径动画、陀螺旋等）不支持。

## 6. 正文（CommonMark + 3 标签行内白名单）

块级元素与 PPTX 渲染映射：

| MD 语法 | 渲染 |
|---|---|
| `#`~`####` 标题 | 文本框，字号映射主题阶梯（h1/h2/h3/h4） |
| 段落 | 文本框 |
| `- ` / `1.` 列表（含嵌套） | 项目符号文本框；嵌套 → 缩进层级（最深 3 级） |
| `>` 引用块 | 左侧 accent 色条 + 斜体强调文本框 |
| MD 表格 | 真 PPTX 表格（表头主题色打底；单元格内支持行内白名单） |
| 代码块 | 等宽字体 + 深底色块文本框 |
| ```` ```mermaid ```` 代码块 | mermaid CLI 渲染 PNG 嵌入；渲染器缺席 → 降级为代码块样式 + 警告 |
| `![alt](本地路径)` | 图片（相对路径相对 md 文件解析）；缺失 → 占位框 + alt 文字 + 警告。**alt 约定带图位编号**（`![P3-图1 ...](...)`）——编号是图位永久身份，重生成只换路径不换编号（见 SKILL.md 生成纪律 6/7） |
| `---` 水平线 | two-col 版式 = **栏切分符**（其前内容 → 左栏 slot，其后 → 右栏）；其他版式 = 水平细线装饰 |

行内白名单（闭合集合，其余 HTML 标签按字面文本处理）：

- MD 原生：`**bold**` `*italic*` `` `code` `` `~~del~~` `[text](url)`（链接渲染为蓝色下划线文本，PPTX 内不可点）
- `<mark>文字</mark>` → 高亮（主题 accent 色底）
- `<span class="角色名">文字</span>` → 文字引用主题角色色
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
    "table-header": "#1B4F8A", "code-bg": "#101418"
  },
  "fonts": { "family": "微软雅黑", "mono": "Consolas" },
  "sizes": { "h1": 40, "h2": 30, "h3": 22, "body": 18, "caption": 14 },
  "chart_series": ["#1B4F8A", "#E8622D", "#2E9E6B", "#8A5CB8", "#C0392B"]
}
```

- `colors` 键即主题角色名，`<span class>` 与 `color=`/`bg=` 按名引用；未知角色名 → 警告 + 回退 `text`
- `sizes` 单位 pt；版式内标题层级 → h1~h4 映射
- 自定义主题：往 `themes/` 放同构 JSON 即可，frontmatter 按名引用

## 8. 版式 HTML（`layouts/<名>.html`）

受限布局引擎（非完整 CSS）四原语：

```html
<div class="root">
  <div class="row" data-gap="2%">          <!-- 行容器：子元素横向排列 -->
    <div class="col" data-grow="2">        <!-- 列容器：纵向；grow=占比权重 -->
      <slot name="title"/>                  <!-- 内容占位框 -->
      <slot name="content" data-min-h="50%"/>
    </div>
    <div class="col" data-grow="1">
      <slot name="image" data-fit="cover"/>
    </div>
  </div>
</div>
```

- 元素仅三种：`div.row` / `div.col` / `slot`
- `data-grow`（默认 1）按权重分配容器主轴剩余空间；`data-gap` 容器内间距
- slot 可带 `data-x/y/w/h`（百分比显式坐标，脱离流式分配）、`data-fit`（默认 cover）、`data-min-h`
- 类名（如 `class="accent-bar"`）引用主题装饰参数，由主题 JSON `decor` 节裁决
- **留白约定**：内置版式根容器统一 `data-x=5% data-y=4% data-w=90% data-h=92%`（四周留白）；`title/section/quote` 聚焦版式用更深的内缩定位。自定义版式应遵循同惯例，内容不顶幻灯片边缘
- 内容落位规则：`#` 标题 → `title` slot（若有）；其余按序填充剩余 slot；blank 版式无 slot，块靠坐标指令定位
- 新增版式 = 新增一个 HTML 文件，零代码改动

## 9. 失败语义汇总

| 场景 | 行为 |
|---|---|
| 未知版式名 | 降级 `title-content` + 警告 |
| 未知动画词 | 降级 `fade` + 警告 |
| 未知主题名 | 回退 `clean-white` + 警告 |
| 未知主题角色 | 回退 `text` 角色 + 警告 |
| 缺失图片文件 | 占位框 + alt 文字 + 警告 |
| mermaid 渲染器缺席 | 降级代码块样式 + 警告 |
| 坐标指令用在非 blank 版式 | 警告并忽略 |
| 未知指令键 / 坏 frontmatter | 忽略（或整段忽略）+ 警告 |
| 非 MD 语法错误 | 按字面文本渲染（MD 容错） |
| 输入根本不是文本/读不到 | 唯一硬错误，退出码非 0 |

## 附录 A：内置版式（8 个）

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

## 附录 B：内置主题（4 个）

`clean-white`（缺省白净）/ `corporate-blue`（商务蓝）/ `dark-tech`（深色科技）/ `warm-paper`（暖纸）。

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
