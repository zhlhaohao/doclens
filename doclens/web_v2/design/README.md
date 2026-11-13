# FigCraft 复刻与视觉评审工具

用 FigCraft（`figcraft-cli`，MCP server `figcraft`）复刻本 agent 的**文件管理页**
（`doclens/web_v2/frontend/src/views/files-view.ts`），并配套一套**自动化视觉评审**
工具——因为本 agent 的截图通道返回 `unsupported content: image`，无法直接看图评审。

## 产物

```
.doclens/craft_out/
├── files_page_v3.figcraft        # v3 原型（推荐）· 桌面 1440×900 · 分层结构
├── files_page_v3.png / .pdf      # 渲染与导出
├── files_page_v2.figcraft        # v2 桌面稿（平铺图层，已被 v3 取代）
├── files_page_mobile.figcraft    # 移动端 390×844
├── files_page_all.figcraft       # v1 桌面 + 移动（归档稿）
└── files_page*.json              # figcraft-cli run 的命令脚本
```

## v3 的分层结构

v2 的 262 个图层全平铺在一个 frame 下，图层树里无法按区域操作。
v3 按**界面语义**重组为嵌套分组：

```
文件管理页 v3
├── 顶栏 AppBar
│   ├── 品牌区 / 全局搜索 / 状态区
├── 活动栏 ActivityBar
│   └── 导航项 1..4
├── 侧栏 Sidebar
│   ├── 搜索框
│   ├── 快速访问 → 快速访问项 1..4
│   └── 目录树 → 树节点 1..7
├── 主区 Workspace
│   ├── 列表头 → 面包屑 / 主操作区
│   ├── 文件表格 → 表头 / 文件行 1..10
│   └── 状态栏
└── 预览区 Preview
    ├── 文件信息卡 → 元信息 chips → chip 1..4
    ├── 正文预览 → 要点 1..3 / 代码块
    └── 动作条 → 动作 1..4 / 动作·问 AI
```

分组命名带语义前缀（「文件行 3·2025-Q1 产品规划.md」），在 FigCraft 图层树里
可直接按行/按区域选中与移动。

## 目录与产物

本目录（`doclens/web_v2/design/`）是**仓库内的设计资产**，与 frontend 同级：
- `designs/`：`.figcraft` 设计稿（生成物，入库——他人不开 Python 也能在 FigCraft 查看）
- `svg/`：与代码仓库同源的图标
- 生成器/评审器脚本、度量表、codeConnect 定义

`.json` 命令脚本与 `.png` 探针校验图是中间产物，建议 gitignore
（见本目录 `.gitignore`）。

## 快速开始

```bash
# 依赖（仅设计/评审时用，不进运行时依赖链）
pip install -r doclens/web_v2/design/requirements.txt

# SVG 资源一致性检查（设计 svg/ ↔ 代码仓库 lucide-static）
python doclens/web_v2/design/sync_svgs.py
python doclens/web_v2/design/sync_svgs.py --sync --prune   # 同步+清理

# 生成 + 评审 + 像素校验 + SVG 一致性（一条命令当门禁）
python doclens/web_v2/design/gate_visual.py files_page_v3 files_page_mobile
```

## Lit 组件 → FigCraft 组件（已落地：四族组件 + 页面实例化）

`components_figcraft.py` 是「仓库自绘组件 → FigCraft 组件」的翻译层。
四族组件集全部落地（规格取自 tokens.css + 对应 Lit 组件源码）：

| 组件集 | 变体 | 规格来源 |
|---|---|---|
| Button | primary/ink/outline/danger × default/hover/disabled | `input-box.ts` + `--cortex-btn-primary-*` |
| FileBadge | md/pdf/xlsx/pptx/png/docx/txt（加深版 ≥4.5:1） | `utils/file-type.ts` |
| SearchInput | default/focus/disabled | `file-search-box.ts` |
| Chip | text/time/size/indexed | `preview-pane.ts` 信息卡 |

**页面稿已实例化**：`files_page_v3` 的主操作按钮（outline 实例）和
文件行徽标（按扩展名切变体的实例）全部走 `instance.create` +
`instance.setProperties`——改主组件即全稿联动。

**设计↔代码双向关联**（`gen_code_connect.py` + `apply_connect.json`）：
- `codeConnect.import`：4 个组件集挂上仓库 Lit 组件
  （`figcraft.connect.json` 可导出/版本化）
- `devResource.add`：14 个主组件逐个挂仓库源码链接
  （FigCraft 里选中组件即可跳到对应 .ts）
- 门禁重建文档后自动重放 `apply_connect.json` 恢复链接

**实测踩坑（换组件/改工作流时注意）**：
1. 组件集**不能放负坐标**——撑大渲染 bounds 使整页偏移、探针全失准
   （放主画布右侧 x≥1500 的空地）
2. 变体命名约定：主组件名 = `属性=值`（`variant=primary state=default`），
   `combineVariants` 按名解析属性
3. `instance.setProperties` 值是复合串（`"primary state=default"`）
4. `as` 命名要含全部变化维度（`badge-inst-{x}-{y}`），同坐标会撞名
5. `node.set` 的 `$ref` 只认**步骤名**，不认图层名

`components_figcraft.py` + `gen_button_library.py` 试点验证了完整工作流：
**仓库自绘组件的视觉规格 → FigCraft 原生组件（变体集）→ 实例**。

按钮组件集（规格取自 `input-box.ts` + tokens.css）：
- 4 variant：primary（主色 pill，发送）/ ink（黑 pill，对话框确认）/
  outline（描边 pill，工具条）/ danger（删除确认）
- 3 state：default / hover / disabled（hover/disabled 色取自
  `--cortex-primary-hover` / `--cortex-btn-primary-pressed|disabled`）
- 共 12 个主组件 combineVariants 成一个组件集，两个变体属性

**实测要点（换别的组件时同样适用）**：
1. FigCraft 的变体靠**命名约定**：主组件必须命名为
   `variant=primary state=default`（`Property=Value` 空格分隔），
   `combineVariants` 才能解析出属性——显式 `component.addProperty`
   反而不需要
2. `instance.setProperties` 的属性值是**复合串**：
   `"primary state=default"`（不是单值）
3. `instance.create` 引用组件集时取默认变体，随后 setProperties 切换
4. Lit 组件的**行为**（防抖/事件）不可迁移，只能表达「状态的外观」

产物：`.doclens/craft_out/button_library.figcraft`（已入门禁）。

## SVG 资源集中管理

设计稿的 SVG 资源集中在 `svg/`（35 个图标），**与代码仓库同源**：

- 来源：`doclens/web_v2/frontend/node_modules/lucide-static@^1.26.0`
  （与前端 `components/icon.ts` 同一版本，保证设计稿图标与线上渲染一致）
- 真值源：不是扫源码，而是**生成的命令 JSON** 里 `type=vector`、
  `name=ic-<名>` 的节点——条件调用、表驱动映射都已被求值
- `sync_svgs.py` 检查三类失配：
  1. 缺失（设计引用但 svg/ 没有）→ `--sync` 从仓库补齐
  2. 过期（与仓库当前版本哈希不一致，即 lucide 升级后内容漂移）→ `--sync` 更新
  3. 多余（svg/ 有但设计不再用）→ `--prune` 删除
- 已纳入 `gate_visual.py` 门禁：每次评审先验一致性

附带提示「设计使用但前端未 import」的图标集差异（如 `clock`/`database`/`eye`，
设计扩展但前端 icon.ts 尚未引用）——不算失配，但提醒两者收敛。

## 两类检查

| 工具 | 检查什么 | 依据 |
|---|---|---|
| `review_visual.py` | 图标溢出 / 组件重叠 / 文字越界 / 对比度 / 过小元素 / 出血 | `.figcraft` 的 `document.json` 精确几何 |
| `check_render.py` | 关键位置颜色 + 文本墨点 | 渲染出的 PNG 逐像素 |

两者互补：几何 lint 抓「结构错」，像素探针抓「没画出来 / 颜色不对」。

## 关键实测结论（踩过的坑）

### 1. FigCraft 的 vector 节点 x/y 指向「路径自身包围盒左上角」

不是 24 视框的 (0,0)。各 Lucide 图标路径起点不同 →
**偏移量 2~9px 不等** → 图标视觉位置错乱、大小不一、突出按钮边框。

```bash
python doclens/web_v2/design/probe_vector.py       # 验证该行为
python doclens/web_v2/design/calibrate_icons.py \
    icons.txt icon_calibration.json                        # 生成校准表
```

校准表 `icon_calibration.json` 由 `calibrate_icons.py` 实测生成，`figcraft_kit.icon()`
按表反向补偿——**改了图标集就要重跑校准**。

### 2. 文本宽度必须按 CJK 全角估算

`len(s) * 13` 会把中文按钮算窄 → 文字溢出按钮、换行。
用 `figcraft_kit.text_w()`（CJK 按全角、拉丁按 0.55em）。

### 3. 文字布局盒 ≠ 墨迹范围

单行 11px 字的布局盒有 24px 高。越界判定要按字号估算墨迹，
否则全是误报。

### 4. 对比度按 WCAG AA

- 正文 ≥ 4.5:1（用 `TEXT_CAP` = `#5D6C7B`）
- 图形/装饰 ≥ 3:1（可用 `TEXT_SUB` = `#8595A4`）
- 白字徽标底要 ≥ 4.5:1 → `BADGES` 里的颜色已按此调深

### 5. 浮层必须最后绘制

下拉菜单若与列表同层级，会被后画的列头盖住。
`draw_more_menu()` 放在生成脚本末尾。

### 6. 嵌套 frame 的坐标是「相对父 frame」，且默认裁剪

实测（`probe_nested.py`）：父 frame(100,100) 内 frame(50,50) 的子节点
(10,20) 渲染在 (160,170) —— **相对父 frame**。

后果与对策：
- 写生成器时用**页面坐标**书写，`figcraft_kit._rel()` 自动换算
  （`group()` 记录各分组绝对原点）
- frame 的 `clip` 默认 true → 越界的文字/分隔线会被**裁掉**。
  分组尺寸必须留足余量，否则内容静默消失（v3 初稿就踩了：代码块超出
  「正文预览」分组 4px 被裁）

### 7. 评审器要按「同父分组」比较

分组后，跨组的元素（如「品牌区 logo」与「状态区 ic-palette」）绝对坐标
不重叠；若评审器不分组比较，会把它们误判为重叠（实测误报 718 条）。

### 8. FigCraft 会把 path「拉伸填满」节点框——图标变形的根因

实测决定性证据：自然 40×20 的矩形放进 40×40 的 vector 节点 →
渲染成 **42×41（正方形）**。即 FigCraft **忽略路径自身宽高比**。

后果：`chevron-right`（原生 6×12 的窄箭头）被拉成正方形，
视觉上比 `folder`（20×17）大一大圈 —— 这正是「目录树图标太大、
没对齐」的根因。

解法（`figcraft_kit.icon()`）：
1. **按墨迹比例给 width/height** —— 不被拉伸
2. **按墨迹对角线归一化** —— 所有图标的视觉外接圆一致，
   避免 `user`（14×18）比 `palette`（20×20）明显小
3. **光学补偿 `optical`** —— 折叠三角对角线仅 13.4（folder 是 26.2），
   归一化后需反向补偿；展开/折叠两种形态分别设值

实测效果（目录树）：

| 图标 | 宽×高 | 中心 y |
|---|---|---|
| chevron-down（展开） | 12×6 | 294.5 |
| folder | 13×12 | 294.5 |
| 文字 | — | 295.0 |

三者 0.5px 内齐平。

### 9. 图标尺寸只用 5 档等级

`ICON_XS/SM/MD/LG/XL = 11/13/15/18/22`（相当于 CSS 的 icon-size scale）。
散用 7/12/13/14/15/16 会导致「同一图标在不同场景大小不一」。

### 10. path 解析必须用权威实现，不能自研

Lucide 的 `d` 属性含**无分隔符参数**（`A2 2 0 0022 17`），
自研分词会把 `0022` 误读成 `22`，吞掉整段弧线
（实测 `book-open` 只剩 `M20.001 19`，图标根本渲染不出来）。

现用 `svgpathtools`（权威 SVG 实现）解析 + 重建绝对路径，
并以 `path_bbox()` 取真实墨迹范围（圆弧按 SVG 规范 F.6.5 离散采样）。

## 设计取值来源（不拍脑袋）

- **色板 / 字号 / 圆角 / 间距**：`doclens/web_v2/frontend/src/styles/tokens.css`
  的 light 主题 + `breakpoints.css` 的 desktop 断点字号
- **图标**：`node_modules/lucide-static/icons/*.svg`（与 `components/icon.ts` 同一套）
- **文件类型徽标**：`utils/file-type.ts` 的 `KNOWN_TYPES`（配色已按对比度调深）
- **布局尺寸**：`files-view.ts` 的 `TREE_PANE_WIDTH_DEFAULT` 等常量

## v2 相对 v1 的改动

v1 是忠实复刻，v2 是从 0 重画并修掉 v1 的结构缺陷：

1. 13 个 hover-only 图标 → 3 个带文字主操作 + 「更多」下拉（展开态）
2. active/selected 双高亮撞色 → active = 左侧蓝竖条，selected = 浅蓝底 + 实心勾选框
3. 长文件名折行 → 单行 ellipsis，行高统一 34px
4. 页面无专属标题 → 顶栏左侧补「文件管理」+ 目录副标题 + 全局搜索
5. 面包屑与工具条分两行 → 合并成 64px 粘性头部
6. 底部大片空白 → 状态栏（条目数 / 已选 / 总大小 / 索引覆盖）
7. 左树与中列表重复 → 左栏分「快速访问 / 目录」两区，目录树带子项计数
8. 列宽拖拽热区不可发现 → 表头列分隔把手加高亮

## 已知取舍

- **logo 用渐变方块代替真实图标**：`assets/app_icon.svg` 是多段渐变插画，
  FigCraft 侧用 `#ECF3FF → #62ABFF` 近似
- **正文预览用排版示意**：真实预览渲染 Markdown/PDF，静态稿用标题 + 段落 + 代码块示意
- **字体用 `Microsoft YaHei` + `Liberation Mono`**：`Noto Sans CJK SC` 本机未安装
  （`figcraft-cli info` 会报 missing font 并回退）

## 文件说明

| 文件 | 作用 |
|---|---|
| `figcraft_kit.py` | 设计 token + 图层构造助手 + `text_w()` 文本测宽 + `group()` 分组 + `icon()` 光学对齐 |
| `gen_files_page_v3.py` | v3 桌面稿生成器（分层结构，推荐） |
| `gen_files_page_v2.py` | v2 桌面稿（平铺，已被 v3 取代） |
| `gen_mobile_page.py` | 移动端稿生成器 |
| `gen_files_page.py` | v1 桌面稿（归档，保留供对比） |
| `merge_pages.py` | 合并多稿到一个 `.figcraft` |
| `review_visual.py` | 几何 lint（6 类问题，支持嵌套结构） |
| `check_render.py` | 像素探针校验 |
| `gate_visual.py` | 门禁：重新生成 + 两类检查 |
| `probe_vector.py` | 验证 FigCraft vector 坐标语义 |
| `probe_nested.py` | 验证嵌套 frame 的坐标语义与 clip 行为 |
| `sync_svgs.py` | SVG 资源一致性：svg/ ↔ 代码仓库 lucide-static |
| `components_figcraft.py` | Lit 组件 → FigCraft 组件翻译层（按钮试点） |
| `gen_button_library.py` | 按钮组件库生成器（变体集 + 实例） |
| `gen_component_library.py` | 四族组件库总成生成器（26 组件 + 16 实例） |
| `gen_code_connect.py` | 设计↔代码关联（codeConnect + devResource） |
| `apply_connect.json` | 门禁重建文档后重放链接的恢复脚本 |
| `tokens_source.py` | tokens.css 解析器（设计 token 唯一真源） |
| `build_icon_metrics.py` | 生成图标光学度量表（墨迹包围盒） |
| `icon_metrics.json` | 图标度量表（改图标集后需重生成） |
| `icon_calibration.json` | 旧的起点偏移校准表（已被度量表取代，保留供对照） |
